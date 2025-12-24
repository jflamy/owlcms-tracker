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

import { EventEmitter } from 'events';
import { logLearningModeStatus } from './learning-mode.js';
import { parseV2Database } from './parser-v2.js';

class CompetitionHub extends EventEmitter {
  constructor() {
    super();
    
    // Full database state (raw athlete data from /database)
    this.databaseState = null;
    
    // Per-FOP latest UPDATE messages (precomputed presentation data)
    // Structure: { 'A': { startOrderAthletes, liftingOrderAthletes, sessionAthletes, ... }, 'B': {...}, ... }
    this.fopUpdates = {};
    
    // Per-FOP session status tracking
    // Structure: { 'A': { isDone: true/false, sessionName: 'M1', lastActivity: timestamp }, ... }
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
    this._hasConfirmedFops = false;
    this.flagsLoaded = false;
    // Always start with translationsReady = false so tracker requests fresh translations on startup
    this.translationsReady = false;
    this.databaseAthleteIndex = new Map();
    this.databaseTeamMap = new Map();
    
    // Debounce state for broadcasts - per FOP and event type
    this.lastBroadcastTime = {};  // Structure: { 'fopName-eventType': timestamp }
    this.broadcastDebounceMs = 100; // Minimum time between identical broadcasts
    
    // Translation map cache - per locale (initially "en", supporting up to 26 locales)
    // Structure: { 'en': { 'Start': 'Start', 'Total': 'Total', ... }, 'fr': {...}, ... }
    this.translations = {};
    this.lastTranslationsChecksum = null;  // Track checksum to avoid reprocessing identical translations
    
    // Log learning mode status on startup (logging moved to hooks.server.js)
    logLearningModeStatus();
    
    // Indicate system is ready
    console.log('[Hub] Competition Hub initialized');
  }

  /**
   * Wait for database to be ready (handles JSON, binary, or empty+binary sequences)
   * Returns immediately if database exists and is not loading
   * Otherwise waits for 'database:ready' event
   * @param {number} timeoutMs - Maximum time to wait (default 10000ms)
   * @returns {Promise<object>} The database state
   */
  async waitForDatabase(timeoutMs = 10000) {
    // Already ready?
    if (this.databaseState && !this.isLoadingDatabase) {
      return this.databaseState;
    }

    // Not ready - wait for signal
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('database:ready', onReady);
        reject(new Error(`Database not ready after ${timeoutMs}ms`));
      }, timeoutMs);

      const onReady = () => {
        clearTimeout(timeout);
        resolve(this.databaseState);
      };

      this.once('database:ready', onReady);
    });
  }

  /**
   * Main handler for OWLCMS WebSocket messages
   * @param {Object} params - The message payload
   * @param {string} messageType - The WebSocket message type: 'update', 'timer', 'decision'
   */
  handleOwlcmsMessage(params, messageType = 'update') {
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
      this._hasConfirmedFops = true;
      
      // Normalize payload (parse JSON strings, ensure arrays)
      const normalizedParams = this._sanitizeInboundPayload(params);

      // Store/merge the update data regardless of database state
      // This ensures we have current athlete, timer, etc. even while waiting for database
      // Use the actual messageType to determine if this is timer/decision (not the field contents!)
      // UPDATE messages can have timer/decision fields like athleteTimerEventType="SetTime", decisionEventType="RESET"
      // but those should NOT prevent lastDataUpdate from being updated.
      const isTimerOrDecision = messageType === 'timer' || messageType === 'decision';
      const now = Date.now();
      const prevDataUpdate = this.fopUpdates[fopName]?.lastDataUpdate || now;

      // Debug: Check currentAthleteKey in incoming update
      const oldKey = this.fopUpdates[fopName]?.currentAthleteKey;
      const newKey = normalizedParams.currentAthleteKey;
      console.log(`[Hub] currentAthleteKey transition for FOP ${fopName}: ${oldKey} -> ${newKey} (exists in update: ${normalizedParams.hasOwnProperty('currentAthleteKey')})`);
      
      // Build merged state
      const mergedState = {
        ...this.fopUpdates[fopName], // Keep existing state (timer, etc.)
        ...normalizedParams,                 // Merge new data
        lastUpdate: now,
        lastDataUpdate: isTimerOrDecision ? prevDataUpdate : now,
        fop: fopName
      };
      
      // Clear currentAthleteKey if not present in new update (prevents stale athlete data)
      if (!normalizedParams.currentAthleteKey && mergedState.currentAthleteKey) {
        console.log(`[Hub] Clearing stale currentAthleteKey for FOP ${fopName}`);
        delete mergedState.currentAthleteKey;
      }
      
      this.fopUpdates[fopName] = mergedState;

      // Rebuild derived state (session maps, ordered lists, etc.)
      this._rebuildDerivedState(fopName);

      // Use sessionAthletes payloads to keep database cache fresh
      this._mergeSessionAthletesIntoDatabase(fopName);
      
      // Update session status tracking
      this.updateSessionStatus(fopName, normalizedParams);
      
      // Also update legacy state for backward compatibility
      const competitionState = this.parseOwlcmsUpdate(normalizedParams);
      this.state = {
        ...this.state,
        ...competitionState,
        lastUpdate: Date.now()
      };
      
      // Broadcast to browsers - even if we're requesting database
      this.broadcast({
        type: 'fop_update',
        fop: fopName,
        data: normalizedParams,
        timestamp: Date.now()
      });
      
      // Check if we have initialized database state
      if (!this.databaseState || !this.databaseState.athletes || this.databaseState.athletes.length === 0) {
        // Only request database at this point - translations/flags will arrive via OWLCMS startup callback
        console.log(`[Hub] Database not yet received, requesting from OWLCMS (update was still processed)`);
        this.databaseRequested = Date.now();
        return { 
          accepted: false, 
          needsData: true, 
          reason: 'missing_database',
          missing: ['database']
        };
      }
      
      // Database is present - OWLCMS has already sent translations_zip and flags_zip via startup callback
      // Don't request them again unless explicitly missing from binary handler
      
      // DISABLED: SwitchGroup refresh - causes issues with category display
      // Request fresh database on SwitchGroup events (new group = new athletes)
      // if (params.uiEvent === 'SwitchGroup') {
      //   console.log('[Hub] SwitchGroup event detected, requesting fresh database from OWLCMS (update was still processed)');
      //   this.databaseRequested = Date.now();
      //   return { accepted: false, needsData: true, reason: 'switch_group_refresh' };
      // }

      const eventType = normalizedParams.uiEvent 
        || normalizedParams.decisionEventType 
        || normalizedParams.athleteTimerEventType 
        || normalizedParams.breakTimerEventType 
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
    
    const hadDatabase = this.databaseState && this.databaseState.athletes && this.databaseState.athletes.length > 0;
    
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

      if (hasCompetitionInfo || hasAthletes) {
        this._hasConfirmedFops = true;
      }
      
      // Store in databaseState (raw competition data)
      this.databaseState = {
        ...fullState,
        lastUpdate: Date.now(),
        initialized: true,
        databaseChecksum: incomingChecksum || fullState?.databaseChecksum || null
      };

      // Rebuild database athlete index for fast lookup by key
      this._reindexDatabaseAthletes();
      
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
      
      // Log when database is received for the first time vs updated
      if (!hadDatabase) {
        console.log(`[Hub] ✅ DATABASE INITIALIZED - Competition: ${this.databaseState.competition?.name || 'unknown'}, ${this.databaseState.athletes?.length || 0} athletes`);
      } else {
        console.log(`[Hub] ✅ DATABASE UPDATED - Competition: ${this.databaseState.competition?.name || 'unknown'}, ${this.databaseState.athletes?.length || 0} athletes`);
      }
      
      // Release loading latch and record successful load time
      this.isLoadingDatabase = false;
      this.lastDatabaseLoad = Date.now();
      this.databaseRequested = 0; // Reset request flag since database has arrived
      this.lastDatabaseChecksum = this.databaseState.databaseChecksum;
      
      // ✅ Signal all waiters that database is ready (handles JSON, binary, and empty+binary paths)
      this.emit('database:ready');

      this.isLoadingDatabase = false;
      
      return { accepted: true };

    } catch (error) {
      console.error('[Hub] Error processing full competition data:', error);
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
        currentSession: params.sessionName || 'A'
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
    if (params.sessionAthletes && typeof params.sessionAthletes === 'object') {
      result.athletes = params.sessionAthletes;
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

    // Session info
    if (params.sessionName) {
      result.sessionInfo = {
        name: params.sessionName,
        description: params.sessionDescription,
        info: params.sessionInfo,
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
    // IMPORTANT: Check uiEvent FIRST - UPDATE messages have both uiEvent and athleteTimerEventType,
    // and we want to debounce based on the primary event type (uiEvent for updates)
    const eventType = message.data?.uiEvent || message.data?.athleteTimerEventType || message.type || 'unknown';
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
   * @returns {string[]} Array of missing precondition names: 'database', 'translations', 'flags', 'pictures'
   * 
   * Precondition Details:
   * - 'database': Full competition data (athletes, categories, FOPs) via type="database" message
   * - 'translations': All 26 locale translation maps (~1MB uncompressed, 400KB gzipped)
   *   * Format: type="translations" with payload { "en": {...}, "fr": {...}, ... }
   *   * OWLCMS can send as JSON text message OR as binary frame with ZIP payload
   *   * If using ZIP: Send as binary frame with [type_length:4] ["translations_zip"] [ZIP buffer]
   *   * ZIP should contain single file "translations.json" with all 26 locales
   * - 'flags': Country/team flag images as binary ZIP frames with type="flags_zip"
   * - 'pictures': Athlete/team pictures as binary ZIP frames with type="pictures_zip"
   */
  getMissingPreconditions() {
    const missing = [];
    
    // Check database
    if (!this.databaseState || !this.databaseState.athletes || this.databaseState.athletes.length === 0) {
      missing.push('database');
    }
    
    // Check translations (OWLCMS sends as binary frame type="translations_zip")
    if (!this.translationsReady) {
      missing.push('translations_zip');
      console.log(`[Hub] 🔄 Requesting translations_zip from OWLCMS (428 response)`);
    }
    
    // Check flags (OWLCMS sends as binary frame type="flags_zip")
    if (!this.flagsLoaded) {
      missing.push('flags_zip');
      console.log(`[Hub] 🔄 Requesting flags_zip from OWLCMS (428 response)`);
    }
    
    // Check pictures (OWLCMS sends as binary frame type="pictures_zip")
    if (!this.picturesLoaded) {
      missing.push('pictures_zip');
      console.log(`[Hub] 🔄 Requesting pictures_zip from OWLCMS (428 response)`);
    }
    
    return missing;
  }
  
  /**
   * Get the latest UPDATE message for a specific FOP
   * @param {string} fopName - Name of the FOP (e.g., 'A', 'B')
   * @returns {Object|null} Latest update data with precomputed liftingOrderAthletes, sessionAthletes, etc.
   */
  getFopUpdate(fopName = 'A') {
    return this.fopUpdates[fopName] || null;
  }

  /**
   * Get ordered session entries (start order) with spacer markers (V2 only).
   */
  getStartOrderEntries(fopName = 'A', { includeSpacers = true } = {}) {
    const update = this.getFopUpdate(fopName);
    if (!update) return [];

    // Use the resolved startOrderAthletes array (flat athlete objects with classname)
    const entries = update.startOrderAthletes || [];
    if (!entries.length) return [];
    
    if (includeSpacers) {
      return entries;
    }
    // Filter out spacers
    return entries.filter(entry => entry && !entry.isSpacer);
  }

  /**
   * Convenience helper returning session athletes (no spacers) from the normalized start order.
   * @returns {Array<Object>} Array of athlete payloads enriched with classname/athleteKey
   */
  getSessionAthletes(fopName = 'A') {
    // Just return non-spacer entries - they're already flat athlete objects
    return this.getStartOrderEntries(fopName, { includeSpacers: false });
  }

  /**
   * Get ordered lifting queue entries with spacer markers (snatch vs clean & jerk split) using V2 data only.
   */
  getLiftingOrderEntries(fopName = 'A', { includeSpacers = true } = {}) {
    const update = this.getFopUpdate(fopName);
    if (!update) return [];

    // Use the resolved liftingOrderAthletes array (flat athlete objects with classname)
    const entries = update.liftingOrderAthletes || [];
    if (!entries.length) return [];
    
    if (includeSpacers) {
      return entries;
    }
    // Filter out spacers
    return entries.filter(entry => entry && !entry.isSpacer);
  }
  
  /**
   * Get all FOP updates
   * @returns {Object} Map of FOP name to latest update data
   */
  getAllFopUpdates() {
    return this.fopUpdates;
  }
  
  /**
   * Resolve team name from team ID using indexed teams from database
   * @param {number|string} teamId - Team ID
   * @returns {string|null} Team name or null if not found
   */
  getTeamNameById(teamId) {
    return this._getTeamNameById(teamId);
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
    const sessionName = params.sessionName || '';
    const breakType = params.breakType || '';
    
    // Initialize status if not exists
    if (!this.fopSessionStatus[fopName]) {
      this.fopSessionStatus[fopName] = {
        isDone: false,
        sessionName: '',
        lastActivity: Date.now()
      };
    }
    
    const status = this.fopSessionStatus[fopName];
    const wasSessionDone = status.isDone;
    
    // Check if session is done
    if (uiEvent === 'GroupDone' || breakType === 'GROUP_DONE') {
      status.isDone = true;
      status.sessionName = sessionName;
      status.lastActivity = Date.now();
      
      if (!wasSessionDone) {
        console.log(`[Hub] 🏁 Session completed for FOP ${fopName} (session: ${sessionName || 'none'})`);
      }
    }
    // Check if session was reopened (any activity other than GroupDone while marked as done)
    else if (status.isDone && (uiEvent || params.athleteTimerEventType || params.decisionEventType)) {
      // Session is active again - could be timer, decision, or any other update
      const previousSessionName = status.sessionName;
      status.isDone = false;
      status.sessionName = sessionName;
      status.lastActivity = Date.now();
      
      console.log(`[Hub] 🔄 Session reopened for FOP ${fopName} (was: ${previousSessionName}, now: ${sessionName || 'active'})`);
    }
    // Normal activity update
    else if (!status.isDone) {
      status.sessionName = sessionName;
      status.lastActivity = Date.now();
    }
  }
  
  /**
   * Get session status for a specific FOP
   * @param {string} fopName - Name of the FOP
   * @returns {Object} Session status { isDone, sessionName, lastActivity }
   */
  getSessionStatus(fopName = 'A') {
    return this.fopSessionStatus[fopName] || { 
      isDone: false, 
      sessionName: '', 
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

  hasConfirmedFops() {
    return this._hasConfirmedFops;
  }

  /**
   * Get current athlete from FOP update
   * @param {string} fopName - Name of the FOP (default 'A')
   * @returns {Object|null} Current athlete with weight and attempt info, or null if not available
   */
  getCurrentAthlete(fopName = 'A') {
    const update = this.getFopUpdate(fopName);
    if (!update) return null;

    if (!update.currentAthleteKey) {
      return null;
    }

    const athlete = this._resolveAthleteByKey(update, update.currentAthleteKey);
    if (!athlete) {
      return null;
    }

    return this._enrichAthleteData(athlete, update);
  }

  /**
   * Get next athlete from FOP update
   * @param {string} fopName - Name of the FOP (default 'A')
   * @returns {Object|null} Next athlete with weight and attempt info, or null if not available
   */
  getNextAthlete(fopName = 'A') {
    const update = this.getFopUpdate(fopName);
    if (!update) return null;

    const nextKey = update.nextAthleteKey || this._findNeighborKeyInOrder(update, 1);
    if (!nextKey) {
      return null;
    }

    const athlete = this._resolveAthleteByKey(update, nextKey);
    if (!athlete) {
      return null;
    }

    return this._enrichAthleteData(athlete, update);
  }

  /**
   * Get previous athlete from FOP update
   * @param {string} fopName - Name of the FOP (default 'A')
   * @returns {Object|null} Previous athlete with weight and attempt info, or null if not available
   */
  getPreviousAthlete(fopName = 'A') {
    const update = this.getFopUpdate(fopName);
    if (!update) return null;

    const prevKey = update.previousAthleteKey || this._findNeighborKeyInOrder(update, -1);
    if (!prevKey) {
      return null;
    }

    const athlete = this._resolveAthleteByKey(update, prevKey);
    if (!athlete) {
      return null;
    }

    return this._enrichAthleteData(athlete, update);
  }

  /**
   * Enrich athlete data with current weight and attempt information
   * @private
   * @param {Object} athlete - Raw athlete object
   * @param {Object} update - FOP update object for context
   * @returns {Object} Enriched athlete object with currentWeight, currentAttempt, currentLiftType
   */
  _enrichAthleteData(athlete, update) {
    if (!athlete) return null;

    // Handle V2 enriched format: { athlete: {...}, displayInfo: {...} }
    // Unwrap the athlete data and merge displayInfo at the top level
    let baseAthlete = athlete;
    let displayInfo = null;
    if (athlete.athlete && typeof athlete.athlete === 'object') {
      baseAthlete = athlete.athlete;
      displayInfo = athlete.displayInfo || null;
    } else {
      // Already flat or legacy format
      baseAthlete = { ...athlete };
    }

    // Start with athlete's existing data
    const enriched = { ...baseAthlete };

    // Merge displayInfo if present (contains precomputed fields like total, ranks, attempts)
    if (displayInfo && typeof displayInfo === 'object') {
      Object.assign(enriched, displayInfo);
    }

    // Determine current lift type and attempt number
    const attemptsDone = baseAthlete.attemptsDone || 0;
    const currentLiftType = attemptsDone < 3 ? 'snatch' : 'cleanJerk';
    const currentAttemptNum = (attemptsDone % 3) + 1; // 1, 2, or 3
    
    // Extract current weight based on lift type and attempt
    let currentWeight = null;
    
    if (currentLiftType === 'snatch') {
      const fieldPrefix = 'snatch' + currentAttemptNum;
      currentWeight = this._extractWeight(baseAthlete, fieldPrefix);
    } else {
      const fieldPrefix = 'cleanJerk' + currentAttemptNum;
      currentWeight = this._extractWeight(baseAthlete, fieldPrefix);
    }

    // Add computed fields
    enriched.currentWeight = currentWeight;
    enriched.currentAttempt = currentAttemptNum;
    enriched.currentLiftType = currentLiftType;
    enriched.attemptsDone = attemptsDone;

    return enriched;
  }

  /**
   * Extract weight for a specific attempt (V2 format)
   * Priority: change2 > change1 > declaration > automaticProgression
   * @private
   * @param {Object} athlete - Athlete object
   * @param {string} fieldPrefix - Field prefix (e.g., 'snatch1', 'cleanJerk2')
   * @returns {number|null} Weight in kg, or null if not found
   */
  _extractWeight(athlete, fieldPrefix) {
    // Check in order of priority
    const change2 = this._parseNumeric(athlete[fieldPrefix + 'Change2']);
    if (change2 !== null) {
      return change2;
    }

    const change1 = this._parseNumeric(athlete[fieldPrefix + 'Change1']);
    if (change1 !== null) {
      return change1;
    }

    const declaration = this._parseNumeric(athlete[fieldPrefix + 'Declaration']);
    if (declaration !== null) {
      return declaration;
    }

    const automatic = this._parseNumeric(athlete[fieldPrefix + 'AutomaticProgression']);
    if (automatic !== null) {
      return automatic;
    }

    return null;
  }

  _extractWeightForContext(athlete, attemptContext) {
    if (!attemptContext || !attemptContext.hasRemainingAttempt) {
      return null;
    }

    const prefix = attemptContext.currentLiftType === 'snatch' ? 'snatch' : 'cleanJerk';
    const attemptNumber = Math.min(Math.max(attemptContext.attemptNumber, 1), 3);
    return this._extractWeight(athlete, `${prefix}${attemptNumber}`);
  }

  _determineAttemptContext(athlete) {
    const snatchAttempts = this._countActualLifts([
      athlete.snatch1ActualLift,
      athlete.snatch2ActualLift,
      athlete.snatch3ActualLift
    ]);

    const cleanJerkAttempts = this._countActualLifts([
      athlete.cleanJerk1ActualLift,
      athlete.cleanJerk2ActualLift,
      athlete.cleanJerk3ActualLift
    ]);

    const totalAttemptsDone = snatchAttempts + cleanJerkAttempts;
    const hasRemainingAttempt = totalAttemptsDone < 6;
    const inSnatch = totalAttemptsDone < 3;
    let attemptNumber = inSnatch ? snatchAttempts + 1 : cleanJerkAttempts + 1;
    attemptNumber = Math.max(1, Math.min(attemptNumber, 3));

    return {
      snatchAttempts,
      cleanJerkAttempts,
      totalAttemptsDone,
      hasRemainingAttempt,
      currentLiftType: inSnatch ? 'snatch' : 'cleanJerk',
      attemptNumber
    };
  }

  _countActualLifts(values = []) {
    return values.reduce((count, value) => (value !== null && value !== undefined ? count + 1 : count), 0);
  }

  _parseNumeric(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isNaN(value) ? null : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  _sanitizeInboundPayload(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sanitized = { ...params };
    // Only parse the V2-shaped JSON fields. Legacy names removed - V2 is canonical.
    const jsonFields = [
      'sessionAthletes',
      'startOrderKeys',
      'liftingOrderKeys',
      'startOrderAthletes',
      'liftingOrderAthletes',
      'leaders',
      'records'
    ];

    for (const field of jsonFields) {
      if (field in sanitized) {
        sanitized[field] = this._parseMaybeJson(sanitized[field]);
      }
    }

    // Provide canonical V2 sources for start/lifting orders when present.
    const startOrderSource = Array.isArray(sanitized.startOrderAthletes)
      ? sanitized.startOrderAthletes
      : (Array.isArray(sanitized.startOrderKeys) ? sanitized.startOrderKeys : null);

    const liftingOrderSource = Array.isArray(sanitized.liftingOrderAthletes)
      ? sanitized.liftingOrderAthletes
      : (Array.isArray(sanitized.liftingOrderKeys) ? sanitized.liftingOrderKeys : null);

    // Normalize startOrderKeys -> startOrderAthletes format: entries of { athleteKey } or { isSpacer: true }
    if (Array.isArray(sanitized.startOrderKeys)) {
      const normalized = [];
      for (const e of sanitized.startOrderKeys) {
        if (!e) continue;
        if (typeof e === 'string' || typeof e === 'number') {
          normalized.push({ athleteKey: e });
        } else if (e.isSpacer || e.type === 'spacer') {
          normalized.push({ isSpacer: true });
        } else if (e.athleteKey || e.key) {
          normalized.push({ athleteKey: e.athleteKey || e.key, classname: e.classname || e.className });
        } else {
          // unknown shape - push as-is
          normalized.push(e);
        }
      }
      // sanitized.startOrderAthletes = normalized; // DO NOT OVERWRITE if already present
      if (!sanitized.startOrderAthletes) {
        sanitized.startOrderAthletes = normalized;
      }
    }

    if (Array.isArray(sanitized.liftingOrderKeys)) {
      const normalized = [];
      for (const e of sanitized.liftingOrderKeys) {
        if (!e) continue;
        if (typeof e === 'string' || typeof e === 'number') {
          normalized.push({ athleteKey: e });
        } else if (e.isSpacer || e.type === 'spacer') {
          normalized.push({ isSpacer: true });
        } else if (e.athleteKey || e.key) {
          normalized.push({ athleteKey: e.athleteKey || e.key, classname: e.classname || e.className });
        } else {
          normalized.push(e);
        }
      }
      // sanitized.liftingOrderAthletes = normalized; // DO NOT OVERWRITE if already present
      if (!sanitized.liftingOrderAthletes) {
        sanitized.liftingOrderAthletes = normalized;
      }
    }

    if (liftingOrderSource) {
      sanitized.liftingOrderAthletes = liftingOrderSource;
      if (!sanitized.liftingOrderAthletesV2) {
        sanitized.liftingOrderAthletesV2 = liftingOrderSource;
      }
    }

    return sanitized;
  }

  _parseMaybeJson(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return value;
      }
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        console.warn('[Hub] Failed to parse JSON field from OWLCMS payload:', error.message);
        return value;
      }
    }

    return value;
  }

  _rebuildDerivedState(fopName) {
    const update = this.fopUpdates[fopName];
    if (!update) {
      return;
    }

    if (typeof update.leaders === 'string') {
      update.leaders = this._parseMaybeJson(update.leaders);
    }

    // Get currentAthleteKey to set classname on current athlete
    const currentAthleteKey = this._normalizeAthleteKey(update.currentAthleteKey);

    // Step 1: Flatten sessionAthletes - unwrap V2 { athlete, displayInfo } format
    // and compute fullName. Store as both a map (by key) and array.
    const { athletesByKey, athletesArray } = this._flattenSessionAthletes(update.sessionAthletes, currentAthleteKey);
    update._sessionAthletesByKey = athletesByKey;
    update._sessionAthletesFlat = athletesArray;

    // Step 2: Build order arrays - just keys and spacers that reference _sessionAthletesByKey
    // Use V2-only canonical fields (startOrderKeys, liftingOrderKeys)
    const startOrderKeys = update.startOrderKeys || update.startOrderAthletes || null;
    const liftingOrderKeys = update.liftingOrderKeys || update.liftingOrderAthletes || null;

    update._startOrder = this._buildOrderKeys(startOrderKeys);
    update._liftingOrder = this._buildOrderKeys(liftingOrderKeys);

    // Step 3: For backwards compatibility, store resolved arrays with full athlete data
    // Plugins can access fopUpdate.startOrderAthletes and get flat athlete objects
    update.startOrderAthletes = this._resolveOrderToAthletes(update._startOrder, athletesByKey);
    update.liftingOrderAthletes = this._resolveOrderToAthletes(update._liftingOrder, athletesByKey);
  }

  /**
   * Flatten sessionAthletes array - unwrap V2 { athlete, displayInfo } format
   * and compute fullName if missing.
   * @returns {{ athletesByKey: Object, athletesArray: Array }}
   */
  _flattenSessionAthletes(sessionAthletes, currentAthleteKey = null) {
    const athletesByKey = Object.create(null);
    const athletesArray = [];

    if (!Array.isArray(sessionAthletes) || sessionAthletes.length === 0) {
      return { athletesByKey, athletesArray };
    }

    for (const entry of sessionAthletes) {
      if (!entry) continue;

      // Unwrap V2 format: { athlete: {...}, displayInfo: {...} }
      // displayInfo contains all precomputed display values from OWLCMS:
      // - fullName, teamName, yearOfBirth, gender, startNumber, lotNumber
      // - category (with age group), bestSnatch, bestCleanJerk, total
      // - snatchRank, cleanJerkRank, totalRank, sinclair, sinclairRank
      // - classname ("current blink", "next", ""), group, subCategory
      // - flagURL, flagClass, teamLength, custom1, custom2, membership
      // - sattempts, cattempts (attempt arrays)
      let flat;
      let usedDisplayInfo = false;
      if (entry.athlete && typeof entry.athlete === 'object') {
        flat = { ...entry.athlete };
        if (entry.displayInfo && typeof entry.displayInfo === 'object') {
          // displayInfo values override athlete DTO values
          Object.assign(flat, entry.displayInfo);
          usedDisplayInfo = true;
          // console.log('[Hub] Using displayInfo for athlete:', flat.fullName);
        }
      } else {
        // Already flat or legacy format
        flat = { ...entry };
      }

      // Fallback: Compute fullName if OWLCMS didn't provide it
      if (!flat.fullName && (flat.firstName || flat.lastName)) {
        const lastName = (flat.lastName || '').toUpperCase();
        const firstName = flat.firstName || '';
        flat.fullName = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName;
      }

      // Fallback: Compute teamName from team ID if OWLCMS didn't provide it
      if (!flat.teamName && flat.team) {
        flat.teamName = this._getTeamNameById(flat.team);
      }

      // Fallback: Compute category display name from categoryCode if OWLCMS didn't provide it
      if (!flat.category && flat.categoryCode) {
        flat.category = flat.categoryCode;
      }

      // Fallback: Compute yearOfBirth from fullBirthDate if OWLCMS didn't provide it
      if (!flat.yearOfBirth && flat.fullBirthDate) {
        const year = flat.fullBirthDate.substring(0, 4);
        if (year && year.length === 4) {
          flat.yearOfBirth = year;
        }
      }

      // Normalize sattempts and cattempts to standard format: { stringValue, liftStatus }
      // OWLCMS V2 sends { value, status }, legacy sends numbers (positive=good, negative=bad)
      // Always normalize so frontend can use liftStatus directly as CSS class
      if (Array.isArray(flat.sattempts)) {
        flat.sattempts = flat.sattempts.map(v => this._normalizeAttemptValue(v));
      }
      if (Array.isArray(flat.cattempts)) {
        flat.cattempts = flat.cattempts.map(v => this._normalizeAttemptValue(v));
      }

      // Fallback: Compute bestSnatch and bestCleanJerk if OWLCMS didn't provide them
      if ((flat.bestSnatch === undefined || flat.bestSnatch === '-') && Array.isArray(flat.sattempts)) {
        flat.bestSnatch = this._computeBestLift(flat.sattempts);
      }
      if ((flat.bestCleanJerk === undefined || flat.bestCleanJerk === '-') && Array.isArray(flat.cattempts)) {
        flat.bestCleanJerk = this._computeBestLift(flat.cattempts);
      }

      // Get the key
      const key = this._normalizeAthleteKey(flat.key ?? flat.id ?? flat.athleteKey);
      if (!key) continue;

      // Note: classname is now provided by OWLCMS displayInfo ("current blink", "next", "")
      // We only need to set it as fallback if not already present
      if (flat.classname === undefined && currentAthleteKey && key === currentAthleteKey) {
        flat.classname = 'current';
      }

      flat.athleteKey = key;
      athletesByKey[key] = flat;
      athletesArray.push(flat);
    }

    return { athletesByKey, athletesArray };
  }

  /**
   * Normalize an attempt value to standard format { stringValue, liftStatus }
   * 
   * OWLCMS V2 format sends objects: { value: 85, status: "good"|"bad"|"request"|"current"|"next"|null }
   * Legacy format sends numbers: positive = good lift, negative = failed, 0 or null = not attempted
   * 
   * Output liftStatus values (can be used directly as CSS classes):
   * - 'good' - successful lift (green)
   * - 'bad' - failed lift (red)
   * - 'current' - pending attempt for current athlete (should blink)
   * - 'next' - pending attempt for next athlete (highlighted)
   * - 'request' - pending attempt (not current or next athlete)
   * - 'empty' - no data
   */
  _normalizeAttemptValue(v) {
    if (v === null || v === undefined) {
      return { stringValue: '-', liftStatus: 'empty' };
    }
    
    // V2 format: object with 'value' key from OWLCMS (status may or may not be present)
    if (typeof v === 'object' && 'value' in v) {
      if (v.value === null || v.value === undefined) {
        return { stringValue: '-', liftStatus: 'empty' };
      }
      // Map null/missing status to 'request' (pending attempt, not yet lifted)
      const status = v.status || 'request';
      return { 
        stringValue: String(v.value), 
        liftStatus: status  // Directly use OWLCMS status: good, bad, request, current, next
      };
    }
    
    // Already normalized to our format (stringValue + liftStatus)
    if (typeof v === 'object' && v.stringValue !== undefined && v.liftStatus !== undefined) {
      return v;
    }
    
    // Legacy format: plain number
    if (typeof v === 'number') {
      if (v === 0) return { stringValue: '-', liftStatus: 'empty' };
      if (v > 0) return { stringValue: String(v), liftStatus: 'good' };
      // Negative = failed attempt
      return { stringValue: String(Math.abs(v)), liftStatus: 'bad' };
    }
    
    // String that might be a number
    const str = String(v).trim();
    if (str === '' || str === '-') return { stringValue: '-', liftStatus: 'empty' };
    const n = parseFloat(str.replace(/[()]/g, ''));
    if (!Number.isNaN(n)) {
      const isFail = str.includes('(') || n < 0;
      return { stringValue: String(Math.abs(n)), liftStatus: isFail ? 'bad' : 'good' };
    }
    return { stringValue: str, liftStatus: 'empty' };
  }

  /**
   * Compute best lift from normalized attempts array
   */
  _computeBestLift(attempts) {
    if (!Array.isArray(attempts)) return null;
    let best = null;
    for (const a of attempts) {
      if (a && a.liftStatus === 'good' && a.stringValue) {
        const val = parseFloat(a.stringValue);
        if (!Number.isNaN(val) && (best === null || val > best)) {
          best = val;
        }
      }
    }
    return best;
  }

  /**
   * Build order keys array - normalize entries to { athleteKey } or { isSpacer: true }
   * @returns {{ keys: Array, spacerIndices: Set }}
   */
  _buildOrderKeys(orderEntries) {
    if (!Array.isArray(orderEntries) || orderEntries.length === 0) {
      return { keys: [], spacerIndices: new Set() };
    }

    const keys = [];
    const spacerIndices = new Set();

    for (let i = 0; i < orderEntries.length; i++) {
      const entry = orderEntries[i];
      if (!entry) continue;

      if (entry.isSpacer || entry.type === 'spacer') {
        keys.push({ isSpacer: true });
        spacerIndices.add(keys.length - 1);
      } else if (typeof entry === 'string' || typeof entry === 'number') {
        keys.push({ athleteKey: this._normalizeAthleteKey(entry) });
      } else if (entry.athleteKey || entry.key || entry.athlete?.key) {
        keys.push({ athleteKey: this._normalizeAthleteKey(entry.athleteKey ?? entry.key ?? entry.athlete?.key) });
      } else {
        // Unknown format, skip
        continue;
      }
    }

    return { keys, spacerIndices };
  }

  /**
   * Resolve order keys to full athlete objects for backwards compatibility
   * @returns {Array} Array of { isSpacer: true } or flat athlete objects with classname
   */
  _resolveOrderToAthletes(order, athletesByKey) {
    if (!order?.keys?.length) {
      return [];
    }

    return order.keys.map(entry => {
      if (entry.isSpacer) {
        return { isSpacer: true };
      }
      const athlete = athletesByKey[entry.athleteKey];
      if (!athlete) {
        // Athlete not found in session, return minimal entry
        return { athleteKey: entry.athleteKey, isSpacer: false };
      }
      return athlete;
    });
  }

  _buildSessionAthleteMap(sessionAthletes) {
    if (!Array.isArray(sessionAthletes) || sessionAthletes.length === 0) {
      return {};
    }

    const map = Object.create(null);
    for (const athlete of sessionAthletes) {
      if (!athlete) continue;
      // Support both flat session-athlete records and V2 enriched objects:
      // - flat: { key: '123', ... }
      // - enriched: { athlete: { key: '123', ... }, displayInfo: { ... } }
      const rawKey = athlete.key ?? athlete.id ?? athlete.athlete?.key ?? athlete.athlete?.id ?? athlete.athleteKey;
      const key = this._normalizeAthleteKey(rawKey);
      if (key) {
        map[key] = athlete;
      }
    }
    return map;
  }

  _mergeSessionAthletesIntoDatabase(fopName) {
    const update = this.fopUpdates[fopName];
    const sessionAthletes = update?.sessionAthletes;
    if (!Array.isArray(sessionAthletes) || sessionAthletes.length === 0) {
      return;
    }

    this._ensureDatabaseContainers(update);

    let changed = false;

    for (const sessionAthlete of sessionAthletes) {
      if (!sessionAthlete || typeof sessionAthlete !== 'object') {
        continue;
      }

      // Handle V2 enriched format: { athlete: {...}, displayInfo: {...} }
      // Extract the actual athlete data and merge displayInfo
      let athleteData = sessionAthlete;
      if (sessionAthlete.athlete && typeof sessionAthlete.athlete === 'object') {
        // Unwrap V2 format
        athleteData = { ...sessionAthlete.athlete };
        if (sessionAthlete.displayInfo && typeof sessionAthlete.displayInfo === 'object') {
          Object.assign(athleteData, sessionAthlete.displayInfo);
        }
      }

      const normalizedKey = this._normalizeAthleteKey(athleteData.key);
      if (!normalizedKey) {
        continue;
      }

      const existing = this.databaseAthleteIndex.get(normalizedKey);
      if (existing) {
        if (this._mergeAthleteRecords(existing, athleteData)) {
          this._indexDatabaseAthleteRecord(existing);
          changed = true;
        }
      } else {
        const copy = this._cloneAthleteRecord(athleteData);
        this.databaseState.athletes.push(copy);
        this._indexDatabaseAthleteRecord(copy);
        changed = true;
      }
    }

    if (changed) {
      this.databaseState.initialized = true;
      this.databaseState.lastUpdate = Date.now();
      if (this.state) {
        this.state.athletes = this.databaseState.athletes;
        this.state.lastUpdate = Date.now();
      }
    }

    // TEMPORARY DEBUG: Verify session athletes match database athletes by key
    this._verifySessionAthleteKeys(fopName);
  }

  /**
   * TEMPORARY DEBUG: Verify all session athletes can be found in database by key
   * This helps debug key matching issues between session and database athletes
   */
  _verifySessionAthleteKeys(fopName) {
    const update = this.fopUpdates[fopName];
    const sessionAthletes = update?.sessionAthletes;
    if (!Array.isArray(sessionAthletes) || sessionAthletes.length === 0) {
      return;
    }
    if (!this.databaseAthleteIndex || this.databaseAthleteIndex.size === 0) {
      console.log(`[Hub DEBUG] No database athletes indexed yet`);
      return;
    }

    let matched = 0;
    let unmatched = 0;
    const unmatchedKeys = [];

    for (const sessionAthlete of sessionAthletes) {
      // Extract key from session athlete (handle V2 nested format)
      let key;
      if (sessionAthlete?.athlete?.key) {
        key = this._normalizeAthleteKey(sessionAthlete.athlete.key);
      } else if (sessionAthlete?.key) {
        key = this._normalizeAthleteKey(sessionAthlete.key);
      }
      
      if (!key) continue;

      const dbAthlete = this.databaseAthleteIndex.get(key);
      if (dbAthlete) {
        matched++;
      } else {
        unmatched++;
        const name = sessionAthlete?.displayInfo?.fullName || sessionAthlete?.athlete?.lastName || 'Unknown';
        unmatchedKeys.push({ key, name });
      }
    }

    if (unmatched > 0) {
      console.log(`[Hub DEBUG] Session→Database key matching for FOP ${fopName}: ${matched} matched, ${unmatched} UNMATCHED`);
      console.log(`[Hub DEBUG] Unmatched athletes:`, unmatchedKeys.slice(0, 5).map(u => `${u.name} (key=${u.key})`).join(', '));
      console.log(`[Hub DEBUG] Database has ${this.databaseAthleteIndex.size} athletes indexed. Sample keys:`, 
        Array.from(this.databaseAthleteIndex.keys()).slice(0, 5));
    } else if (matched > 0) {
      console.log(`[Hub DEBUG] ✓ All ${matched} session athletes match database by key`);
    }
  }

  _ensureDatabaseContainers(update = null) {
    if (!this.databaseState || typeof this.databaseState !== 'object') {
      this.databaseState = {
        competition: update?.competition || {
          name: update?.competitionName || this.state?.competition?.name || 'Competition'
        },
        athletes: [],
        teams: [],
        initialized: false,
        lastUpdate: Date.now()
      };

    }

    if (!Array.isArray(this.databaseState.athletes)) {
      this.databaseState.athletes = [];
    }

    if (!Array.isArray(this.databaseState.teams)) {
      this.databaseState.teams = [];
    }

    if (!(this.databaseAthleteIndex instanceof Map)) {
      this.databaseAthleteIndex = new Map();
    }

    if (!(this.databaseTeamMap instanceof Map)) {
      this.databaseTeamMap = new Map();
    }
  }

  _mergeAthleteRecords(target, source) {
    if (!target || !source) {
      return false;
    }

    let changed = false;
    for (const [key, value] of Object.entries(source)) {
      if (target[key] !== value) {
        target[key] = value;
        changed = true;
      }
    }
    return changed;
  }

  _cloneAthleteRecord(record) {
    if (!record || typeof record !== 'object') {
      return record;
    }

    if (typeof structuredClone === 'function') {
      return structuredClone(record);
    }

    return JSON.parse(JSON.stringify(record));
  }

  _indexDatabaseAthleteRecord(athlete) {
    if (!athlete) {
      return;
    }

    const key = this._normalizeAthleteKey(athlete?.key);
    if (key) {
      this.databaseAthleteIndex.set(key, athlete);
    }
  }

  _normalizeAthleteKey(key) {
    if (key === null || key === undefined) {
      return null;
    }
    if (typeof key === 'number') {
      return key.toString();
    }
    if (typeof key === 'string') {
      const trimmed = key.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  _resolveAthleteByKey(update, key) {
    if (!update) {
      return null;
    }

    const normalizedKey = this._normalizeAthleteKey(key);
    if (!normalizedKey) {
      return null;
    }

    // Primary lookup: flattened session athletes map
    if (update._sessionAthletesByKey && update._sessionAthletesByKey[normalizedKey]) {
      return update._sessionAthletesByKey[normalizedKey];
    }

    // Fallback: search raw sessionAthletes array (before _rebuildDerivedState runs)
    if (Array.isArray(update.sessionAthletes)) {
      const found = update.sessionAthletes.find(ath => {
        const candidate = ath?.key ?? ath?.id ?? ath?.athlete?.key ?? ath?.athlete?.id ?? ath?.athleteKey;
        return this._normalizeAthleteKey(candidate) === normalizedKey;
      });
      if (found) {
        // Cache the found athlete for future lookups
        update._sessionAthletesByKey = update._sessionAthletesByKey || {};
        update._sessionAthletesByKey[normalizedKey] = found;
        return found;
      }
    }

    return null;
  }

  _findNeighborKeyInOrder(update, offset = 1) {
    // Use the resolved liftingOrderAthletes array (flat athlete objects)
    const entries = update?.liftingOrderAthletes;
    if (!Array.isArray(entries) || entries.length === 0 || !offset) {
      return null;
    }

    // Filter to only athlete entries (no spacers)
    const athleteEntries = entries.filter(entry => entry && !entry.isSpacer);
    
    const normalizedCurrent = this._normalizeAthleteKey(update.currentAthleteKey);
    if (!normalizedCurrent) {
      return null;
    }

    const currentIndex = athleteEntries.findIndex(entry => {
      const key = this._normalizeAthleteKey(entry?.athleteKey ?? entry?.key);
      return key && key === normalizedCurrent;
    });

    if (currentIndex === -1) {
      return null;
    }

    const neighbor = athleteEntries[currentIndex + offset];
    return neighbor?.athleteKey ?? neighbor?.key ?? null;
  }

  _composeFullName(athlete, dbAthlete) {
    const last = athlete.lastName || dbAthlete?.lastName || '';
    const first = athlete.firstName || dbAthlete?.firstName || '';
    if (last && first) {
      return `${last}, ${first}`;
    }
    if (last) {
      return last;
    }
    if (first) {
      return first;
    }
    return athlete.fullName || dbAthlete?.fullName || '';
  }

  _resolveTeamName(athlete, dbAthlete) {
    if (athlete.teamName) {
      return athlete.teamName;
    }
    if (dbAthlete?.teamName) {
      return dbAthlete.teamName;
    }
    const teamId = athlete.team ?? dbAthlete?.team;
    if (teamId === null || teamId === undefined) {
      return null;
    }
    return this._getTeamNameById(teamId);
  }

  _getDatabaseAthleteByKey(key) {
    if (!this.databaseAthleteIndex || this.databaseAthleteIndex.size === 0) {
      return null;
    }
    const normalizedKey = this._normalizeAthleteKey(key);
    if (!normalizedKey) {
      return null;
    }
    return this.databaseAthleteIndex.get(normalizedKey) || null;
  }

  _getTeamNameById(teamId) {
    if (teamId === null || teamId === undefined) {
      return null;
    }
    if (!this.databaseTeamMap || this.databaseTeamMap.size === 0) {
      return null;
    }
    const normalizedId = typeof teamId === 'number' ? teamId.toString() : `${teamId}`;
    return this.databaseTeamMap.get(normalizedId) || null;
  }

  _reindexDatabaseAthletes() {
    this.databaseAthleteIndex = new Map();
    this.databaseTeamMap = new Map();

    const athletes = this.databaseState?.athletes;
    if (Array.isArray(athletes)) {
      for (const athlete of athletes) {
        this._indexDatabaseAthleteRecord(athlete);
      }
    }

    // Teams may be at databaseState.teams or databaseState.database.teams depending on message format
    const teams = this.databaseState?.teams || this.databaseState?.database?.teams;
    if (Array.isArray(teams)) {
      for (const team of teams) {
        if (!team) continue;
        if (team.id === null || team.id === undefined) continue;
        const id = team.id.toString();
        this.databaseTeamMap.set(id, team.name || team.fullName || team.code || null);
      }
    }
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
    
    const hadTranslations = Object.keys(this.translations).length > 0;
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
      if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
        console.log(`[Hub] � Merging regional '${locale}' (${keyCount} keys) + base '${baseLocale}' (${baseKeyCount} keys) → ${Object.keys(mergedMap).length} total`);
      }
    }
    
    // Cache the (possibly merged) translation map
    this.translations[locale] = mergedMap;
    const finalKeyCount = Object.keys(mergedMap).length;
    
    if (isNew) {
      if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
        console.log(`[Hub] Cached locale '${locale}': ${finalKeyCount} keys`);
      }

      // Log when first translation is received
      if (!hadTranslations && locale === 'en') {
        if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
          console.log(`[Hub] ✅ TRANSLATIONS INITIALIZED - locale: ${locale}, ${finalKeyCount} keys`);
        }
      } else if (!hadTranslations) {
        if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
          console.log(`[Hub] ✅ TRANSLATIONS INITIALIZED - locale: ${locale}, ${finalKeyCount} keys`);
        }
      }
    } else if (!hadTranslations && Object.keys(this.translations).length > 0) {
      // Translations were just fully populated
      const totalLocales = Object.keys(this.translations).length;
      if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
        console.log(`[Hub] ✅ TRANSLATIONS UPDATED - ${totalLocales} locales available`);
      }
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

    if (Object.keys(this.translations).length > 0) {
      this.translationsReady = true;
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
   * Mark flags data as loaded so we don't keep requesting them
   */
  markFlagsLoaded() {
    if (!this.flagsLoaded) {
      this.flagsLoaded = true;
      console.log('[Hub] ✅ Flags ZIP processed and cached');
    }
  }

  /**
   * Get category-to-ageGroup mapping for all active age groups
   * Returns a Map: categoryCode -> ageGroup object
   * This map is cached and only rebuilt when database changes
   * @returns {Map<string, object>} Map of category codes to their parent age group
   */
  getCategoryToAgeGroupMap() {
    // Check if we have a cached map and database hasn't changed
    const currentChecksum = this.databaseState?.databaseChecksum || this.databaseState?.lastUpdate || Date.now();
    if (this._catToAgeGroupMap && this._catToAgeGroupMapChecksum === currentChecksum) {
      return this._catToAgeGroupMap;
    }

    // Build fresh map
    console.log('[Hub] Building category-to-ageGroup map from database');
    const map = new Map();
    const ageGroups = this.databaseState?.ageGroups || [];
    
    ageGroups.forEach(ag => {
      // Only include active age groups
      if (ag.active === false) return;
      
      (ag.categories || []).forEach(cat => {
        // Register all explicit category code fields
        const codes = [];
        if (cat.code) codes.push(String(cat.code));
        if (cat.categoryCode) codes.push(String(cat.categoryCode));
        if (cat.id !== undefined && cat.id !== null) codes.push(String(cat.id));
        
        codes.forEach(code => {
          if (code) {
            map.set(code, ag);
          }
        });
      });
    });
    
    console.log(`[Hub] Built category map with ${map.size} entries from ${ageGroups.filter(ag => ag.active !== false).length} active age groups`);
    
    // Cache the map
    this._catToAgeGroupMap = map;
    this._catToAgeGroupMapChecksum = currentChecksum;
    
    return map;
  }

  /**
   * Force refresh (clear ALL state to trigger 428 and show "waiting for competition data")
   * Called when OWLCMS disconnects - clears everything so browsers show waiting state
   */
  refresh() {
    console.log('[Hub] Forcing refresh - clearing ALL state (database, session, translations, flags)');
    this.state = null;
    this.databaseState = null;
    this.fopUpdates = {};
    this.databaseAthleteIndex = new Map();
    this.databaseTeamMap = new Map();
    this.lastDatabaseChecksum = null;
    this.lastDatabaseLoad = 0;
    this.flagsLoaded = false;
    // Clear translations completely so a reconnect forces a fresh translations_zip
    this.translations = {};
    this.lastTranslationsChecksum = null;
    this.translationsReady = false;
    this._hasConfirmedFops = false;
    this.broadcast({
      type: 'waiting',
      message: 'Waiting for competition data...',
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
   * Automatically detects V1 (legacy) or V2 (new) format and routes to appropriate parser
   */
  parseFullCompetitionData(params) {
    console.log('[Hub] Parsing full competition database');
    
    // Route to V2 parser (only format supported)
    let result;
    result = parseV2Database(params);
    
    if (!result) {
      console.error('[Hub] Failed to parse competition data');
      return null;
    }
    
    return result;
  }


}

// Export singleton instance
// Use globalThis to persist across HMR (Vite hot reload)
// Translations and other state persist - OWLCMS pushes fresh data when needed
if (!globalThis.__competitionHub) {
  globalThis.__competitionHub = new CompetitionHub();
}

// Mark Vite as ready after first startup
globalThis.__viteReady = true;

export const competitionHub = globalThis.__competitionHub;
if (!competitionHub.hasConfirmedFops) {
  competitionHub.hasConfirmedFops = () => competitionHub._hasConfirmedFops;
}