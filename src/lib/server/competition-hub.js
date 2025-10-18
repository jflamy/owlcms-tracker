/**
 * Competition Hub - Server-side state cache and message broadcaster
 * 
 * Handles OWLCMS WebSocket messages and converts to browser-friendly format
 * 
 * Responsibilities:
 * - Cache competition state from OWLCMS WebSocket updates
 * - Return 428 when database is needed (WebSocket response)
 * - Convert OWLCMS data to JSON format for browsers
 * - Broadcast changes to all connected browsers via SSE
 */

import { logLearningModeStatus } from './learning-mode.js';
class CompetitionHub {
  constructor() {
    // Full database state (raw athlete data from /database)
    this.databaseState = null;
    
    // Per-FOP latest UPDATE messages (precomputed presentation data)
    // Structure: { 'A': { liftingOrderAthletes, groupAthletes, fullName, weight, etc. }, 'B': {...}, ... }
    this.fopUpdates = {};
    
    // Per-FOP session status tracking
    // Structure: { 'A': { isDone: true/false, groupName: 'M1', lastActivity: timestamp }, ... }
    this.fopSessionStatus = {};
    
    // Legacy state property (deprecated, will migrate to fopUpdates)
    this.state = null;
    
    this.isLoadingDatabase = false; // Latch to prevent concurrent database loads
    this.lastDatabaseLoad = 0; // Timestamp of last successful database load
    this.databaseRequested = 0; // Timestamp when database was requested via 428 (to prevent duplicate 428s)
    this.subscribers = new Set();
    this.metrics = {
      activeClients: 0,
      messagesReceived: 0,
      messagesBroadcast: 0
    };

    this.lastDatabaseChecksum = null;
    
    // Debounce state for broadcasts - per FOP and event type
    this.lastBroadcastTime = {};  // Structure: { 'fopName-eventType': timestamp }
    this.broadcastDebounceMs = 100; // Minimum time between identical broadcasts
    
    // Translation map cache - per locale (initially "en", supporting up to 26 locales)
    // Structure: { 'en': { 'Start': 'Start', 'Total': 'Total', ... }, 'fr': {...}, ... }
    this.translations = {};
    this.lastTranslationsChecksum = null;  // Track checksum to avoid reprocessing identical translations
    
    // Log learning mode status on startup
    logLearningModeStatus();
    
    // Indicate system is ready
    console.log('🎯 [Hub] Competition Hub initialized and ready to receive OWLCMS messages');
    console.log('📡 [Hub] Listening for WebSocket connections at /ws');
    console.log('🌐 [Hub] Browser clients can connect to SSE /api/client-stream');
  }

  /**
   * Main handler for OWLCMS WebSocket messages
   */
  handleOwlcmsMessage(params) {
    this.metrics.messagesReceived++;
    
    try {
      // Check if database is currently being loaded
      if (this.isLoadingDatabase) {
        console.log('[Hub] Database load in progress, deferring update');
        return { accepted: false, reason: 'database_loading', retry: true };
      }
      
      // Check if we recently requested database via 428 (within last 1 second) - wait for it to arrive
      const timeSinceDatabaseRequested = Date.now() - this.databaseRequested;
      if (this.databaseRequested > 0 && timeSinceDatabaseRequested < 1000) {
        console.log(`[Hub] Database was requested ${timeSinceDatabaseRequested}ms ago, waiting for arrival (returning 202)`);
        return { accepted: false, reason: 'waiting_for_database', retry: true };
      }
      
      // Extract FOP name early so we can process the update even if we need database
      const fopName = params.fop || params.fopName || 'A';
      
      // Store/merge the update data regardless of database state
      // This ensures we have current athlete, timer, etc. even while waiting for database
      this.fopUpdates[fopName] = {
        ...(this.fopUpdates[fopName] || {}), // Keep previous data
        ...params,                             // Merge new data
        lastUpdate: Date.now(),
        fop: fopName
      };
      
      // Update session status tracking
      this.updateSessionStatus(fopName, params);
      
      // Also update legacy state for backward compatibility
      const competitionState = this.parseOwlcmsUpdate(params);
      this.state = {
        ...this.state,
        ...competitionState,
        lastUpdate: Date.now()
      };
      
      // Broadcast to browsers - even if we're requesting database
      this.broadcast({
        type: 'fop_update',
        fop: fopName,
        data: params,
        timestamp: Date.now()
      });
      
      // Check if we have initialized database state
      if (!this.databaseState || !this.databaseState.athletes || this.databaseState.athletes.length === 0) {
        const missing = this.getMissingPreconditions();
        console.log(`[Hub] Missing preconditions: ${missing.join(', ')}, requesting from OWLCMS (update was still processed)`);
        this.databaseRequested = Date.now();
        return { 
          accepted: false, 
          needsData: true, 
          reason: 'missing_preconditions',
          missing: missing
        };
      }
      
      // DISABLED: SwitchGroup refresh - causes issues with category display
      // Request fresh database on SwitchGroup events (new group = new athletes)
      // if (params.uiEvent === 'SwitchGroup') {
      //   console.log('[Hub] SwitchGroup event detected, requesting fresh database from OWLCMS (update was still processed)');
      //   this.databaseRequested = Date.now();
      //   return { accepted: false, needsData: true, reason: 'switch_group_refresh' };
      // }

      const eventType = params.uiEvent 
        || params.decisionEventType 
        || params.athleteTimerEventType 
        || params.breakTimerEventType 
        || 'unknown';
      console.log(`[Hub] Update processed: ${eventType} for FOP ${fopName}`);
      return { accepted: true };

    } catch (error) {
      console.error('[Hub] Error processing OWLCMS update:', error);
      return { accepted: false, reason: 'processing_error', error: error.message };
    }
  }

  /**
   * Handler for full competition database from OWLCMS
   */
  handleFullCompetitionData(params) {
    this.metrics.messagesReceived++;
    
    try {
      const incomingChecksum = params?.databaseChecksum || params?.checksum || null;
      if (incomingChecksum && this.lastDatabaseChecksum && incomingChecksum === this.lastDatabaseChecksum) {
        console.log(`[Hub] Database checksum ${incomingChecksum} matches current state, skipping reload`);
        this.databaseRequested = 0;
        this.lastDatabaseLoad = Date.now();
        return { accepted: true, reason: 'duplicate_checksum', cached: true };
      }
      
      // Check if already loading to prevent concurrent loads
      if (this.isLoadingDatabase) {
        const timeSinceStart = Date.now() - this.isLoadingDatabase;
        console.log(`[Hub] Database load already in progress (${Math.round(timeSinceStart / 1000)}s), rejecting duplicate`);
        return { accepted: false, reason: 'already_loading' };
      }
      
      if (!incomingChecksum) {
        const timeSinceLastLoad = Date.now() - this.lastDatabaseLoad;
        if (this.lastDatabaseLoad > 0 && timeSinceLastLoad < 2000) {
          console.log(`[Hub] Database was loaded ${Math.round(timeSinceLastLoad)}ms ago (no checksum provided), accepting but skipping duplicate load`);
          return { accepted: true, reason: 'duplicate_skipped', cached: true };
        }
      }

      // Set loading latch with timestamp
      this.isLoadingDatabase = Date.now();
      console.log('[Hub] Processing full competition data');
      
      // Parse the full competition state
      const fullState = this.parseFullCompetitionData(params);
      
      // Validate that we got meaningful data
      if (!fullState || typeof fullState !== 'object') {
        console.error('[Hub] Failed to parse competition data - result is not an object');
        return { accepted: false, reason: 'invalid_data_structure' };
      }
      
      // Check if we have at least competition info or athletes
      const hasCompetitionInfo = fullState.competition && typeof fullState.competition === 'object';
      const hasAthletes = Array.isArray(fullState.athletes) && fullState.athletes.length > 0;
      
      if (!hasCompetitionInfo && !hasAthletes) {
        console.error('[Hub] Failed to parse competition data - no valid competition info or athletes found');
        console.error('[Hub] Parsed result:', JSON.stringify(fullState).substring(0, 200));
        return { accepted: false, reason: 'no_valid_data_parsed' };
      }
      
      // Store in databaseState (raw competition data)
      this.databaseState = {
        ...fullState,
        lastUpdate: Date.now(),
        initialized: true,
        databaseChecksum: incomingChecksum || fullState?.databaseChecksum || null
      };
      
      // Also update legacy state for backward compatibility
      this.state = this.databaseState;

      // Broadcast complete state to browsers
      this.broadcast({
        type: 'competition_initialized',
        payload: this.state,
        timestamp: Date.now()
      });

      console.log(`[Hub] Full competition data loaded: ${this.databaseState.competition?.name || 'unknown competition'}`);
      console.log(`[Hub] Athletes loaded: ${this.databaseState.athletes?.length || 0}`);
      
      // Release loading latch and record successful load time
      this.isLoadingDatabase = false;
      this.lastDatabaseLoad = Date.now();
      this.databaseRequested = 0; // Reset request flag since database has arrived
      this.lastDatabaseChecksum = this.databaseState.databaseChecksum;
      
      return { accepted: true };

    } catch (error) {
      console.error('[Hub] Error processing full competition data:', error);
      
      // Release loading latch on error
      this.isLoadingDatabase = false;
      
      return { accepted: false, reason: 'processing_error', error: error.message };
    }
  }

  /**
   * Parse OWLCMS form parameters into browser-friendly format
   */
  parseOwlcmsUpdate(params) {
    const result = {};

    // Competition info
    if (params.competitionName) {
      result.competition = {
        name: params.competitionName,
        fop: params.fop,
        state: params.fopState,
        currentSession: params.groupName || 'A'
      };
    }

    // Current athlete and attempt
    if (params.fullName) {
      result.currentAttempt = {
        athleteName: params.fullName,
        teamName: params.teamName,
        startNumber: params.startNumber ? parseInt(params.startNumber) : null,
        categoryName: params.categoryName,
        attempt: params.attempt,
        attemptNumber: params.attemptNumber ? parseInt(params.attemptNumber) : null,
        weight: params.weight ? parseInt(params.weight) : null,
        timeAllowed: params.timeAllowed ? parseInt(params.timeAllowed) : null
      };
    }

    // Timer state (from embedded timer info)
    const timerState = this.parseTimerState(params);
    if (timerState) {
      result.timer = timerState;
    }

    // Athletes data (nested objects from OWLCMS WebSocket)
    if (params.groupAthletes && typeof params.groupAthletes === 'object') {
      result.athletes = params.groupAthletes;
    }

    if (params.liftingOrderAthletes && typeof params.liftingOrderAthletes === 'object') {
      result.liftingOrder = params.liftingOrderAthletes;
    }

    if (params.leaders && typeof params.leaders === 'object') {
      result.leaders = params.leaders;
    }

    // Break/ceremony state
    if (params.break === 'true') {
      result.isBreak = true;
      result.breakType = params.breakType;
      result.ceremonyType = params.ceremonyType;
    } else {
      result.isBreak = false;
    }

    // Display settings
    result.displaySettings = {
      showLiftRanks: params.showLiftRanks === 'true',
      showTotalRank: params.showTotalRank === 'true',
      showSinclair: params.showSinclair === 'true',
      showSinclairRank: params.showSinclairRank === 'true',
      wideTeamNames: params.wideTeamNames === 'true',
      sinclairMeet: params.sinclairMeet === 'true',
      stylesDir: params.stylesDir,
      mode: params.mode
    };

    // Group info
    if (params.groupName) {
      result.groupInfo = {
        name: params.groupName,
        description: params.groupDescription,
        info: params.groupInfo,
        liftsDone: params.liftsDone
      };
    }

    // Records info
    if (params.recordKind && params.recordKind !== 'none') {
      result.records = {
        kind: params.recordKind,
        message: params.recordMessage,
        records: params.records
      };
    }

    return result;
  }

  /**
   * Parse timer state from OWLCMS parameters
   */
  parseTimerState(params) {
    // OWLCMS includes timer info in the main update
    // Look for timer-related parameters
    if (params.timeAllowed && params.timeRemaining !== undefined) {
      return {
        state: params.timeRemaining > 0 ? 'running' : 'stopped',
        timeAllowed: parseInt(params.timeAllowed),
        timeRemaining: parseInt(params.timeRemaining || 0),
        indefinite: params.indefinite === 'true'
      };
    }
    
    // Default timer state
    return {
      state: 'stopped',
      timeAllowed: 60000,
      timeRemaining: 0,
      indefinite: false
    };
  }

  /**
   * Handle config upload from OWLCMS
   */
  handleConfig(configData) {
    console.log('[Hub] Received config from OWLCMS');
    this.hasConfig = true;
    
    // Initial state setup
    if (!this.state) {
      this.state = {
        competition: { name: 'Loading...', fop: 'A', state: 'INACTIVE' },
        athletes: [],
        liftingOrder: [],
        currentAttempt: null,
        timer: { state: 'stopped', timeAllowed: 60000, timeRemaining: 0 },
        lastUpdate: Date.now()
      };
    }

    return { accepted: true };
  }

  /**
   * Subscribe to state changes (for SSE clients)
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    this.metrics.activeClients++;

    // Send current state if available
    if (this.state) {
      callback({
        type: 'init',
        payload: this.state,
        timestamp: Date.now()
      });
    } else {
      callback({
        type: 'waiting',
        message: 'Waiting for competition data from OWLCMS...',
        timestamp: Date.now()
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      this.metrics.activeClients--;
    };
  }

  /**
   * Broadcast message to all subscribers (with debouncing per FOP and event type)
   */
  broadcast(message) {
    // Debounce only identical event types for same FOP
    // Example: stop-stop can be debounced, but stop-start-stop should all go through
    const fopName = message.fop || 'global';
    const eventType = message.data?.athleteTimerEventType || message.data?.uiEvent || message.type || 'unknown';
    const debounceKey = `${fopName}-${eventType}`;
    
    const now = Date.now();
    const lastBroadcast = this.lastBroadcastTime[debounceKey] || 0;
    const timeSinceLastBroadcast = now - lastBroadcast;
    
    // Skip broadcast if same event type for same FOP occurred too recently
    if (timeSinceLastBroadcast < this.broadcastDebounceMs) {
      console.log(`[Hub] Debouncing ${eventType} for ${fopName} (${timeSinceLastBroadcast}ms since last)`);
      return;
    }
    
    this.lastBroadcastTime[debounceKey] = now;
    this.metrics.messagesBroadcast++;
    
    for (const callback of this.subscribers) {
      try {
        callback(message);
      } catch (error) {
        console.error('[Hub] Error broadcasting to subscriber:', error);
        this.subscribers.delete(callback);
        this.metrics.activeClients--;
      }
    }
  }

  /**
   * Get hub metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get current state (legacy - returns combined state)
   */
  getState() {
    return this.state;
  }
  
  /**
   * Get the full database state (raw athlete data)
   */
  getDatabaseState() {
    return this.databaseState;
  }
  
  /**
   * Check which preconditions are missing
   * @returns {string[]} Array of missing precondition names: 'database', 'translations', 'flags'
   * 
   * Precondition Details:
   * - 'database': Full competition data (athletes, categories, FOPs) via type="database" message
   * - 'translations': All 26 locale translation maps (~1MB uncompressed, 400KB gzipped)
   *   * Format: type="translations" with payload { "en": {...}, "fr": {...}, ... }
   *   * OWLCMS can send as JSON text message OR as binary frame with ZIP payload
   *   * If using ZIP: Send as binary frame with [type_length:4] ["translations_zip"] [ZIP buffer]
   *   * ZIP should contain single file "translations.json" with all 26 locales
   * - 'flags': Country/team flag images as binary ZIP frames with type="flags"
   */
  getMissingPreconditions() {
    const missing = [];
    
    // Check database
    if (!this.databaseState || !this.databaseState.athletes || this.databaseState.athletes.length === 0) {
      missing.push('database');
    }
    
    // Check translations (OWLCMS sends all 26 locales in one message, can be JSON or ZIP)
    if (Object.keys(this.translations).length === 0) {
      missing.push('translations');
      console.log(`[Hub] 🔄 Requesting translations from OWLCMS (428 response)`);
    }
    
    // Always request flags (used in all scoreboards for team identification)
    // OWLCMS will respond with binary frames if needed
    if (!missing.includes('flags')) {
      missing.push('flags');
    }
    
    return missing;
  }
  
  /**
   * Get the latest UPDATE message for a specific FOP
   * @param {string} fopName - Name of the FOP (e.g., 'A', 'B')
   * @returns {Object|null} Latest update data with precomputed liftingOrderAthletes, groupAthletes, etc.
   */
  getFopUpdate(fopName = 'A') {
    return this.fopUpdates[fopName] || null;
  }
  
  /**
   * Get all FOP updates
   * @returns {Object} Map of FOP name to latest update data
   */
  getAllFopUpdates() {
    return this.fopUpdates;
  }
  
  /**
   * Update session status tracking based on incoming message
   * Detects when a session is done (GroupDone event) and when it's reopened
   * 
   * A session returns to "in progress" (not done) when ANY of the following is received:
   * - Timer event (athleteTimerEventType)
   * - Decision event (decisionEventType)
   * - Any other update event (uiEvent that is not GroupDone)
   * 
   * @param {string} fopName - Name of the FOP
   * @param {Object} params - Message parameters
   */
  updateSessionStatus(fopName, params) {
    const uiEvent = params.uiEvent;
    const groupName = params.groupName || '';
    const breakType = params.breakType || '';
    
    // Initialize status if not exists
    if (!this.fopSessionStatus[fopName]) {
      this.fopSessionStatus[fopName] = {
        isDone: false,
        groupName: '',
        lastActivity: Date.now()
      };
    }
    
    const status = this.fopSessionStatus[fopName];
    const wasSessionDone = status.isDone;
    
    // Check if session is done
    if (uiEvent === 'GroupDone' || breakType === 'GROUP_DONE') {
      status.isDone = true;
      status.groupName = groupName;
      status.lastActivity = Date.now();
      
      if (!wasSessionDone) {
        console.log(`[Hub] 🏁 Session completed for FOP ${fopName} (group: ${groupName || 'none'})`);
      }
    }
    // Check if session was reopened (any activity other than GroupDone while marked as done)
    else if (status.isDone && (uiEvent || params.athleteTimerEventType || params.decisionEventType)) {
      // Session is active again - could be timer, decision, or any other update
      const previousGroupName = status.groupName;
      status.isDone = false;
      status.groupName = groupName;
      status.lastActivity = Date.now();
      
      console.log(`[Hub] 🔄 Session reopened for FOP ${fopName} (was: ${previousGroupName}, now: ${groupName || 'active'})`);
    }
    // Normal activity update
    else if (!status.isDone) {
      status.groupName = groupName;
      status.lastActivity = Date.now();
    }
  }
  
  /**
   * Get session status for a specific FOP
   * @param {string} fopName - Name of the FOP
   * @returns {Object} Session status { isDone, groupName, lastActivity }
   */
  getSessionStatus(fopName = 'A') {
    return this.fopSessionStatus[fopName] || { 
      isDone: false, 
      groupName: '', 
      lastActivity: 0 
    };
  }
  
  /**
   * Check if a session is done for a specific FOP
   * @param {string} fopName - Name of the FOP
   * @returns {boolean} True if session is complete
   */
  isSessionDone(fopName = 'A') {
    const status = this.fopSessionStatus[fopName];
    return status ? status.isDone : false;
  }
  
  /**
   * Get list of available FOP names (extracted from database or FOP updates)
   * @returns {Array<string>} Array of FOP names (e.g., ['Platform_A', 'Platform_B'])
   */
  getAvailableFOPs() {
    // Get FOPs from database state if available
    if (this.databaseState?.fops && Array.isArray(this.databaseState.fops)) {
      return this.databaseState.fops.map(fop => fop.name || fop);
    }
    
    // Fallback: get FOPs from received updates
    const fopsFromUpdates = Object.keys(this.fopUpdates);
    if (fopsFromUpdates.length > 0) {
      return fopsFromUpdates;
    }
    
    // Default: return single FOP 'A' if nothing else available
    return ['A'];
  }

  /**
   * Cache translation map for a specific locale
   * @param {string} locale - Language locale code (e.g., 'en', 'fr', 'es', 'fr-CA', 'es-AR')
   * @param {object} translationMap - Map of translation keys to display strings
   * 
   * Implements locale fallback merging (like Java's ResourceBundle):
   * - When caching 'fr-CA' with 10 keys, merges with 'fr' (1300 keys) if available
   * - Result: fr-CA has 1310 keys (10 regional + 1300 from base)
   * - Also handles reverse: if 'fr' cached after 'fr-CA', updates all 'fr-*' variants
   */
  /**
   * Decode HTML entities in translation strings
   * Converts: &amp; → &, &nbsp; → non-breaking space, &ndash; → –, etc.
   * @param {string} str - String with HTML entities
   * @returns {string} Decoded string with Unicode characters
   */
  decodeHTMLEntities(str) {
    if (typeof str !== 'string') return str;
    
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
      '&nbsp;': '\u00A0',  // Non-breaking space (U+00A0)
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };
    
    let result = str;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'g'), char);
    }
    
    return result;
  }

  setTranslations(locale = 'en', translationMap) {
    if (!translationMap || typeof translationMap !== 'object') {
      console.warn(`[Hub] Invalid translation map for locale '${locale}'`);
      return;
    }
    
    const keyCount = Object.keys(translationMap).length;
    
    // Decode HTML entities in all translation values
    const decodedMap = {};
    for (const [key, value] of Object.entries(translationMap)) {
      decodedMap[key] = this.decodeHTMLEntities(value);
    }
    
    const isNew = !this.translations[locale];
    
    // 1. Extract base locale from regional variant (e.g., 'fr' from 'fr-CA')
    const baseLocale = locale.includes('-') ? locale.split('-')[0] : null;
    
    // 2. If this is a regional variant, merge with base locale if available
    let mergedMap = decodedMap;
    let wasMerged = false;
    if (baseLocale && this.translations[baseLocale]) {
      const baseTranslations = this.translations[baseLocale];
      const baseKeyCount = Object.keys(baseTranslations).length;
      // Merge with base locale keys (regional keys override base)
      mergedMap = { ...baseTranslations, ...decodedMap };
      wasMerged = true;
      console.log(`[Hub] � Merging regional '${locale}' (${keyCount} keys) + base '${baseLocale}' (${baseKeyCount} keys) → ${Object.keys(mergedMap).length} total`);
    }
    
    // Cache the (possibly merged) translation map
    this.translations[locale] = mergedMap;
    const finalKeyCount = Object.keys(mergedMap).length;
    
    if (isNew) {
      console.log(`[Hub] Cached locale '${locale}': ${finalKeyCount} keys`);
    }
    
    // 3. If this is a base locale, update all existing regional variants to include these keys
    if (!baseLocale) {
      // This is a base locale (e.g., 'fr'), so update all regional variants (e.g., 'fr-CA', 'fr-BE')
      const currentLocales = Object.keys(this.translations);
      const updatedRegionals = [];
      for (const existingLocale of currentLocales) {
        if (existingLocale.startsWith(locale + '-')) {
          // This is a regional variant of the locale just cached
          const regionalTranslations = this.translations[existingLocale];
          const updatedRegional = { ...decodedMap, ...regionalTranslations };
          this.translations[existingLocale] = updatedRegional;
        }
      }
    }
  }

  /**
   * Get cached translations for a specific locale
   * Implements fallback chain:
   * 1. Exact match (e.g., 'fr-CA')
   * 2. Base language (e.g., 'fr' from 'fr-CA')
   * 3. English fallback (e.g., 'en')
   * 
   * @param {string} locale - Language locale code (default 'en')
   * @returns {object|null} Translation map with fallback chain applied
   */
  getTranslations(locale = 'en') {
    // 1. Try exact match
    if (this.translations[locale]) {
      return this.translations[locale];
    }
    
    // 2. Try base language (e.g., 'pt' from 'pt-PT')
    if (locale.includes('-')) {
      const baseLanguage = locale.split('-')[0];
      if (this.translations[baseLanguage]) {
        console.log(`[Hub] Locale '${locale}' not found, falling back to base language '${baseLanguage}'`);
        return this.translations[baseLanguage];
      }
    }
    
    // 3. Fall back to English
    if (locale !== 'en' && this.translations['en']) {
      console.log(`[Hub] Locale '${locale}' not found, falling back to English`);
      return this.translations['en'];
    }
    
    // No translations available - return empty object (expected until OWLCMS sends translations)
    // Don't warn for 'en' locale as it's normal for English to not be loaded yet
    if (locale !== 'en') {
      console.warn(`[Hub] No translations available for locale '${locale}' (no fallback options)`);
    }
    return {};
  }

  /**
   * Get all available translation locales
   * @returns {Array<string>} Array of locale codes (e.g., ['en', 'fr', 'es'])
   */
  getAvailableLocales() {
    return Object.keys(this.translations).sort();
  }

  /**
   * Force refresh (clear state to trigger 428)
   */
  refresh() {
    console.log('[Hub] Forcing refresh - clearing state');
    this.state = null;
    this.broadcast({
      type: 'waiting',
      message: 'Competition data refresh in progress...',
      timestamp: Date.now()
    });
  }

  /**
   * Compute team rankings (hub-specific logic)
   */
  getTeamRankings() {
    if (!this.state?.athletes) return [];

    const teamScores = {};
    
    for (const athlete of this.state.athletes) {
      if (!athlete.team || !athlete.total) continue;
      
      if (!teamScores[athlete.team]) {
        teamScores[athlete.team] = {
          name: athlete.team,
          athletes: [],
          totalScore: 0
        };
      }
      
      teamScores[athlete.team].athletes.push(athlete);
    }

    // Calculate team scores (top 3 athletes per team)
    for (const team of Object.values(teamScores)) {
      const sorted = team.athletes
        .filter(a => a.total > 0)
        .sort((a, b) => b.total - a.total);
      
      const top3 = sorted.slice(0, 3);
      team.totalScore = top3.reduce((sum, a) => sum + a.total, 0);
      team.topAthletes = top3;
    }

    return Object.values(teamScores)
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Parse full competition database from OWLCMS
   * This handles the complete competition state sent via /database endpoint
   */
  parseFullCompetitionData(params) {
    console.log('[Hub] Parsing full competition database');
    
    const providedChecksum = params?.databaseChecksum || params?.checksum || null;

    // If params is already the full database structure (with athletes, ageGroups, etc.),
    // just return it directly with minimal processing
    if (params.athletes && Array.isArray(params.athletes)) {
      console.log(`[Hub] Received full database structure with ${params.athletes.length} athletes`);
      console.log(`[Hub] Database has ageGroups:`, !!params.ageGroups, 'count:', params.ageGroups?.length || 0);
      console.log(`[Hub] Database has competition:`, !!params.competition);
      console.log(`[Hub] Database has platforms:`, !!params.platforms, 'count:', params.platforms?.length || 0);
      
      // Return the entire database structure as-is
      return {
        ...params,
        initialized: true,
        lastUpdate: Date.now(),
        databaseChecksum: providedChecksum || params.databaseChecksum || null
      };
    }
    
    // Otherwise, parse from groupAthletes (legacy format)
    console.log('[Hub] Parsing from groupAthletes format (legacy)');
    const result = {};

    // Basic competition info
    result.competition = {
      name: params.competitionName || 'Competition',
      fop: params.fop || 'A',
      state: params.fopState || 'INACTIVE',
      currentSession: params.groupName || 'A',
      date: new Date().toISOString().split('T')[0] // Default to today
    };

    // Parse athletes data - expect nested objects from WebSocket
    if (params.groupAthletes && Array.isArray(params.groupAthletes)) {
      result.athletes = params.groupAthletes
        .filter(athlete => !athlete.isSpacer) // Remove spacer rows
        .map(athlete => ({
          id: athlete.startNumber,
          startNumber: parseInt(athlete.startNumber),
          fullName: athlete.fullName,
          name: athlete.fullName,
          teamName: athlete.teamName,
          team: athlete.teamName,
          yearOfBirth: athlete.yearOfBirth,
          category: athlete.category,
          categoryName: athlete.category,
          group: athlete.group,
          
          // Snatch attempts
          snatch1Weight: athlete.sattempts?.[0]?.stringValue ? parseInt(athlete.sattempts[0].stringValue) : null,
          snatch1Result: athlete.sattempts?.[0]?.liftStatus === 'good' ? 'good' : 
                        athlete.sattempts?.[0]?.liftStatus === 'fail' ? 'no' : null,
          snatch2Weight: athlete.sattempts?.[1]?.stringValue ? parseInt(athlete.sattempts[1].stringValue) : null,
          snatch2Result: athlete.sattempts?.[1]?.liftStatus === 'good' ? 'good' : 
                        athlete.sattempts?.[1]?.liftStatus === 'fail' ? 'no' : null,
          snatch3Weight: athlete.sattempts?.[2]?.stringValue ? parseInt(athlete.sattempts[2].stringValue) : null,
          snatch3Result: athlete.sattempts?.[2]?.liftStatus === 'good' ? 'good' : 
                        athlete.sattempts?.[2]?.liftStatus === 'fail' ? 'no' : null,
          
          // Clean & Jerk attempts
          cleanJerk1Weight: athlete.cattempts?.[0]?.stringValue ? parseInt(athlete.cattempts[0].stringValue) : null,
          cleanJerk1Result: athlete.cattempts?.[0]?.liftStatus === 'good' ? 'good' : 
                           athlete.cattempts?.[0]?.liftStatus === 'fail' ? 'no' : null,
          cleanJerk2Weight: athlete.cattempts?.[1]?.stringValue ? parseInt(athlete.cattempts[1].stringValue) : null,
          cleanJerk2Result: athlete.cattempts?.[1]?.liftStatus === 'good' ? 'good' : 
                           athlete.cattempts?.[1]?.liftStatus === 'fail' ? 'no' : null,
          cleanJerk3Weight: athlete.cattempts?.[2]?.stringValue ? parseInt(athlete.cattempts[2].stringValue) : null,
          cleanJerk3Result: athlete.cattempts?.[2]?.liftStatus === 'good' ? 'good' : 
                           athlete.cattempts?.[2]?.liftStatus === 'fail' ? 'no' : null,
          
          // Computed totals (from OWLCMS)
          bestSnatch: athlete.bestSnatch !== '-' ? parseInt(athlete.bestSnatch) : 0,
          bestCleanJerk: athlete.bestCleanJerk !== '-' ? parseInt(athlete.bestCleanJerk) : 0,
          total: athlete.total !== '-' ? parseInt(athlete.total) : 0,
          sinclair: athlete.sinclair !== '-' ? parseFloat(athlete.sinclair) : 0,
          
          // Rankings
          snatchRank: athlete.snatchRank !== '-' ? parseInt(athlete.snatchRank) : null,
          cleanJerkRank: athlete.cleanJerkRank !== '-' ? parseInt(athlete.cleanJerkRank) : null,
          totalRank: athlete.totalRank !== '-' ? parseInt(athlete.totalRank) : null,
          sinclairRank: athlete.sinclairRank !== '-' ? parseInt(athlete.sinclairRank) : null,
          
          // UI state
          classname: athlete.classname,
          isCurrent: athlete.classname?.includes('current'),
          isNext: athlete.classname?.includes('next')
        }));
      
      console.log(`[Hub] Loaded ${result.athletes.length} athletes from groupAthletes`);
    } else if (params.athletes && Array.isArray(params.athletes)) {
      result.athletes = params.athletes;
      console.log(`[Hub] Loaded ${result.athletes.length} athletes from athletes field`);
    } else {
      result.athletes = [];
    }

    // Parse lifting order if provided
    if (params.liftingOrderAthletes && Array.isArray(params.liftingOrderAthletes)) {
      result.liftingOrder = params.liftingOrderAthletes
        .filter(athlete => !athlete.isSpacer)
        .map((athlete, index) => ({
          athleteId: athlete.startNumber,
          athleteName: athlete.fullName,
          teamName: athlete.teamName,
          position: index + 1,
          weight: athlete.sattempts?.[0]?.stringValue ? parseInt(athlete.sattempts[0].stringValue) : null,
          lift: 'snatch', // Default, could be determined from competition state
          attemptNumber: 1, // Default, could be computed
          isCurrent: athlete.classname?.includes('current'),
          isNext: athlete.classname?.includes('next')
        }));
      
      console.log(`[Hub] Loaded ${result.liftingOrder.length} athletes in lifting order`);
    } else if (params.liftingOrder && Array.isArray(params.liftingOrder)) {
      result.liftingOrder = params.liftingOrder;
    } else {
      result.liftingOrder = [];
    }

    // Current attempt info
    if (params.currentAthlete && typeof params.currentAthlete === 'object') {
      result.currentAttempt = params.currentAthlete;
    } else if (params.fullName) {
      // Fallback to individual fields
      result.currentAttempt = {
        athleteName: params.fullName,
        teamName: params.teamName,
        startNumber: params.startNumber ? parseInt(params.startNumber) : null,
        categoryName: params.categoryName,
        attempt: params.attempt,
        attemptNumber: params.attemptNumber ? parseInt(params.attemptNumber) : null,
        weight: params.weight ? parseInt(params.weight) : null
      };
    }

    // Timer state
    result.timer = {
      state: params.timerRunning === 'true' ? 'running' : 'stopped',
      timeRemaining: params.timeRemaining ? parseInt(params.timeRemaining) : 0,
      duration: params.timeAllowed ? parseInt(params.timeAllowed) : 60000,
      startTime: params.timerRunning === 'true' ? Date.now() : null
    };

    // Group and session info
    if (params.groups && Array.isArray(params.groups)) {
      result.groups = params.groups;
    }

    // Categories info
    if (params.categories && Array.isArray(params.categories)) {
      result.categories = params.categories;
    }

    // Display settings
    result.displaySettings = {
      showLiftRanks: params.showLiftRanks === 'true',
      showTotalRank: params.showTotalRank === 'true',  
      showSinclair: params.showSinclair === 'true',
      showSinclairRank: params.showSinclairRank === 'true',
      wideTeamNames: params.wideTeamNames === 'true',
      sinclairMeet: params.sinclairMeet === 'true',
      stylesDir: params.stylesDir,
      mode: params.mode
    };

    return {
      ...result,
      databaseChecksum: providedChecksum || null
    };
  }
}

// Export singleton instance
// Use globalThis to persist across HMR (Vite hot reload)
if (!globalThis.__competitionHub) {
  globalThis.__competitionHub = new CompetitionHub();
  console.log('[Hub] Creating new CompetitionHub instance');
} else {
  console.log('[Hub] Reusing existing CompetitionHub instance (HMR)');
}

export const competitionHub = globalThis.__competitionHub;