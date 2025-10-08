/**
 * Competition Hub - Server-side state cache and message broadcaster
 * 
 * Handles real OWLCMS UpdateEvent form data and converts to browser-friendly format
 * 
 * Responsibilities:
 * - Cache competition state from OWLCMS updates
 * - Return 428 when database is needed (triggers OWLCMS to send /database)
 * - Return 412 when icons/pictures/config is needed (reserved for future use)
 * - Convert OWLCMS form data to JSON format for browsers
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
    
    // Debounce state for broadcasts - per FOP and event type
    this.lastBroadcastTime = {};  // Structure: { 'fopName-eventType': timestamp }
    this.broadcastDebounceMs = 100; // Minimum time between identical broadcasts
    
    // Log learning mode status on startup
    logLearningModeStatus();
    
    // Indicate system is ready
    console.log('🎯 [Hub] Competition Hub initialized and ready to receive OWLCMS messages');
    console.log('📡 [Hub] Listening for updates at POST /update');
    console.log('🌐 [Hub] Browser clients can connect to SSE /api/client-stream');
  }

  /**
   * Main handler for OWLCMS form-encoded updates
   */
  handleOwlcmsUpdate(params) {
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
      
      // Check if we have initialized database state
      if (!this.databaseState || !this.databaseState.athletes || this.databaseState.athletes.length === 0) {
        console.log('[Hub] No database state yet, requesting full database from OWLCMS');
        this.databaseRequested = Date.now(); // Record that we're requesting the database
        return { accepted: false, needsData: true, reason: 'no_database_state' };
      }

      // Extract FOP name
      const fopName = params.fop || params.fopName || 'A';
      
      // Merge the raw UPDATE message for this FOP (preserve previous data like liftingOrderAthletes)
      // Timer updates don't include athlete data, so we need to merge not replace
      this.fopUpdates[fopName] = {
        ...(this.fopUpdates[fopName] || {}), // Keep previous data
        ...params,                             // Merge new data
        lastUpdate: Date.now(),
        fop: fopName
      };

      // Also update legacy state for backward compatibility
      const competitionState = this.parseOwlcmsUpdate(params);
      this.state = {
        ...this.state,
        ...competitionState,
        lastUpdate: Date.now()
      };

      // Broadcast to browsers - include all raw FOP params
      // Note: Individual plugins will process this data client-side or via their API endpoints
      this.broadcast({
        type: 'fop_update',
        fop: fopName,
        data: params,  // Raw FOP update with all fields
        timestamp: Date.now()
      });

      console.log(`[Hub] Update processed: ${params.uiEvent || params.decisionEventType || params.athleteTimerEventType || 'unknown'} for FOP ${fopName}`);
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
      // Check if already loading to prevent concurrent loads
      if (this.isLoadingDatabase) {
        const timeSinceStart = Date.now() - this.isLoadingDatabase;
        console.log(`[Hub] Database load already in progress (${Math.round(timeSinceStart / 1000)}s), rejecting duplicate`);
        return { accepted: false, reason: 'already_loading' };
      }
      
      // Check if we loaded recently (within last 2 seconds) - accept but skip reprocessing
      const timeSinceLastLoad = Date.now() - this.lastDatabaseLoad;
      if (this.lastDatabaseLoad > 0 && timeSinceLastLoad < 2000) {
        console.log(`[Hub] Database was loaded ${Math.round(timeSinceLastLoad)}ms ago, accepting but skipping duplicate load`);
        return { accepted: true, reason: 'duplicate_skipped', cached: true };
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
        initialized: true
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

    // Athletes data (parse JSON strings from OWLCMS)
    if (params.groupAthletes) {
      try {
        result.athletes = JSON.parse(params.groupAthletes);
      } catch (e) {
        console.warn('[Hub] Failed to parse groupAthletes JSON:', e.message);
      }
    }

    if (params.liftingOrderAthletes) {
      try {
        result.liftingOrder = JSON.parse(params.liftingOrderAthletes);
      } catch (e) {
        console.warn('[Hub] Failed to parse liftingOrderAthletes JSON:', e.message);
      }
    }

    if (params.leaders) {
      try {
        result.leaders = JSON.parse(params.leaders);
      } catch (e) {
        console.warn('[Hub] Failed to parse leaders JSON:', e.message);
      }
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
    
    const result = {};

    // Basic competition info
    result.competition = {
      name: params.competitionName || 'Competition',
      fop: params.fop || 'A',
      state: params.fopState || 'INACTIVE',
      currentSession: params.groupName || 'A',
      date: new Date().toISOString().split('T')[0] // Default to today
    };

    // Parse athletes data - handle both parsed objects and JSON strings
    if (params.groupAthletes) {
      try {
        // If it's already an object/array, use it directly; otherwise parse as JSON
        const rawAthletes = typeof params.groupAthletes === 'string' 
          ? JSON.parse(params.groupAthletes)
          : params.groupAthletes;
        result.athletes = rawAthletes
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
      } catch (e) {
        console.warn('[Hub] Failed to parse groupAthletes:', e.message);
        result.athletes = [];
      }
    } else if (params.athletes) {
      try {
        // If it's already an object/array, use it directly; otherwise parse as JSON
        result.athletes = typeof params.athletes === 'string'
          ? JSON.parse(params.athletes)
          : params.athletes;
        console.log(`[Hub] Loaded ${result.athletes.length} athletes from athletes field`);
      } catch (e) {
        console.warn('[Hub] Failed to parse athletes:', e.message);
        result.athletes = [];
      }
    } else {
      result.athletes = [];
    }

    // Parse lifting order if provided
    if (params.liftingOrderAthletes) {
      try {
        const rawLiftingOrder = typeof params.liftingOrderAthletes === 'string'
          ? JSON.parse(params.liftingOrderAthletes)
          : params.liftingOrderAthletes;
        result.liftingOrder = rawLiftingOrder
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
      } catch (e) {
        console.warn('[Hub] Failed to parse liftingOrderAthletes:', e.message);
        result.liftingOrder = [];
      }
    } else if (params.liftingOrder) {
      try {
        result.liftingOrder = typeof params.liftingOrder === 'string'
          ? JSON.parse(params.liftingOrder)
          : params.liftingOrder;
      } catch (e) {
        console.warn('[Hub] Failed to parse liftingOrder:', e.message);
        result.liftingOrder = [];
      }
    } else {
      result.liftingOrder = [];
    }

    // Current attempt info
    if (params.currentAthlete) {
      try {
        result.currentAttempt = typeof params.currentAthlete === 'string'
          ? JSON.parse(params.currentAthlete)
          : params.currentAthlete;
      } catch (e) {
        console.warn('[Hub] Failed to parse currentAthlete:', e.message);
        result.currentAttempt = null;
      }
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
    if (params.groups) {
      try {
        result.groups = typeof params.groups === 'string'
          ? JSON.parse(params.groups)
          : params.groups;
      } catch (e) {
        console.warn('[Hub] Failed to parse groups:', e.message);
        result.groups = [];
      }
    }

    // Categories info
    if (params.categories) {
      try {
        result.categories = typeof params.categories === 'string'
          ? JSON.parse(params.categories)
          : params.categories;
      } catch (e) {
        console.warn('[Hub] Failed to parse categories:', e.message);
        result.categories = [];
      }
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

    return result;
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