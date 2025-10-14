/**
 * Server-side scoreboard helpers - these run on the server and access the competition hub directly
 */

import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Plugin-specific cache to avoid recomputing lifting order on every browser request
 * Structure: { 'cacheKey': { competition, currentAttempt, liftingOrderAthletes, ... } }
 */
const liftingOrderCache = new Map();

/**
 * Per-FOP timer state tracking (persistent across requests)
 * Structure: { 'fopName': { active: boolean|null, running: boolean } }
 */
const timerStateMap = new Map();

/**
 * Get the full database state (raw athlete data) - SERVER-SIDE ONLY
 * @returns {Object|null} Raw database state from OWLCMS
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 * This contains precomputed presentation data like liftingOrderAthletes, groupAthletes, etc.
 * @param {string} fopName - FOP name (default: 'A')
 * @returns {Object|null} Latest UPDATE message with precomputed data
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses the latest UPDATE message which already has precomputed liftingOrderAthletes
 * @param {string} fopName - FOP name (default: 'A')
 * @param {Object} options - User preferences (e.g., { showRecords: true, maxLifters: 8 })
 * @returns {Object} Formatted data ready for browser consumption
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	
	// Extract options with defaults
	const showRecords = options.showRecords ?? false;
	const maxLifters = options.maxLifters ?? 8;
	
	// Get learning mode from environment
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },  // Include default sessionStatus
			liftingOrderAthletes: [],
			groupAthletes: [],
			rankings: [],
			stats: { totalAthletes: 0, activeAthletes: 0, completedAthletes: 0, categories: [], teams: [] },
			status: 'waiting',
			learningMode
		};
	}

	// Get session status early (before cache check, so it's always fresh)
	const sessionStatus = competitionHub.getSessionStatus(fopName);

	// Check cache first - cache key based on lifting order data, NOT timer events
	// Use a hash of liftingOrderAthletes to detect when athlete data actually changes
	// liftingOrderAthletes is now a parsed object, so stringify it first for hashing
	const liftingOrderHash = fopUpdate?.liftingOrderAthletes ? 
		JSON.stringify(fopUpdate.liftingOrderAthletes).substring(0, 100) : ''; // First 100 chars as quick hash
	const cacheKey = `${fopName}-${liftingOrderHash}-${showRecords}-${maxLifters}`;
	
	if (liftingOrderCache.has(cacheKey)) {
		const cached = liftingOrderCache.get(cacheKey);
		
		// Compute sessionStatusMessage from current fopUpdate (even on cache hit)
		let sessionStatusMessage = null;
		if (sessionStatus.isDone && fopUpdate?.fullName) {
			sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		}
		
		// Return cached data with current timer state, decision state, session status, and status message
		return {
			...cached,
			timer: extractTimerState(fopUpdate, fopName),
			decision: extractDecisionState(fopUpdate),
			sessionStatus,  // Fresh session status
			sessionStatusMessage,  // Fresh status message
			learningMode
		};
	}

	// Extract basic competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.groupName || 'A',
		// Replace HTML entities with Unicode characters
		groupInfo: (fopUpdate?.groupInfo || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—'),
		liftsDone: fopUpdate?.liftsDone || ''  // Pre-formatted string from OWLCMS
	};

	// Extract current athlete info from UPDATE message
	let currentAttempt = null;
	let sessionStatusMessage = null;  // For displaying when session is done
	
	if (fopUpdate?.fullName) {
		// Clean up HTML entities in fullName (OWLCMS sends session status here when done)
		const cleanFullName = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		
		currentAttempt = {
			fullName: cleanFullName,
			name: cleanFullName,
			teamName: fopUpdate.teamName,
			team: fopUpdate.teamName,
			startNumber: fopUpdate.startNumber,
			categoryName: fopUpdate.categoryName,
			category: fopUpdate.categoryName,
			attempt: fopUpdate.attempt,
			attemptNumber: fopUpdate.attemptNumber,
			weight: fopUpdate.weight,
			timeAllowed: fopUpdate.timeAllowed,
			startTime: fopUpdate.athleteTimerEventType === 'Start' ? Date.now() - (fopUpdate.timeAllowed - (fopUpdate.athleteMillisRemaining || 0)) : null
		};
		
		// If session is done, save the cleaned message separately
		if (sessionStatus.isDone) {
			sessionStatusMessage = cleanFullName;
		}
	}

	// Extract timer info from UPDATE message or keep previous timer state
	// Extract timer state and decision state
	const timer = extractTimerState(fopUpdate, fopName);
	const decision = extractDecisionState(fopUpdate);

	// Get precomputed liftingOrderAthletes from UPDATE message (already parsed as nested object)
	let liftingOrderAthletes = [];
	if (fopUpdate?.liftingOrderAthletes) {
		liftingOrderAthletes = fopUpdate.liftingOrderAthletes;
	}

	// Get precomputed groupAthletes from UPDATE message (already parsed as nested object)
	let groupAthletes = [];
	if (fopUpdate?.groupAthletes) {
		groupAthletes = fopUpdate.groupAthletes;
	}
	
	// Get top athletes for leaderboard (from database state if needed for custom sorting)
	const rankings = getTopAthletes(databaseState, 10);
	
	// Get competition stats
	const stats = getCompetitionStats(databaseState);

	const result = {
		scoreboardName: 'Lifting Order',  // Scoreboard display name
		competition,
		currentAttempt,
		timer,
		decision,  // Decision state (lights, down signal)
		sessionStatusMessage,  // Cleaned message for when session is done
		sortedAthletes: liftingOrderAthletes, // Standardized field name (lifting order)
		liftingOrderAthletes, // Keep for backwards compatibility
		groupAthletes,         // Precomputed from OWLCMS UPDATE
		rankings,              // Computed from database
		stats,
		displaySettings: fopUpdate?.showTotalRank || fopUpdate?.showSinclair ? {
			showTotalRank: fopUpdate.showTotalRank === 'true',
			showSinclair: fopUpdate.showSinclair === 'true',
			showLiftRanks: fopUpdate.showLiftRanks === 'true',
			showSinclairRank: fopUpdate.showSinclairRank === 'true'
		} : {},
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		sessionStatus,  // Include session status (isDone, groupName, lastActivity)
		status: (fopUpdate || databaseState) ? 'ready' : 'waiting',
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: { showRecords, maxLifters } // Echo back the options used
	};
	
	// Cache the result (excluding timer, learningMode, sessionStatus, and sessionStatusMessage which change frequently)
	liftingOrderCache.set(cacheKey, {
		scoreboardName: result.scoreboardName,
		competition: result.competition,
		currentAttempt: result.currentAttempt,
		sortedAthletes: result.sortedAthletes,
		liftingOrderAthletes: result.liftingOrderAthletes,
		groupAthletes: result.groupAthletes,
		rankings: result.rankings,
		stats: result.stats,
		displaySettings: result.displaySettings,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		lastUpdate: result.lastUpdate,
		options: result.options
	});
	
	// Cleanup old cache entries (keep last 20)
	if (liftingOrderCache.size > 20) {
		const firstKey = liftingOrderCache.keys().next().value;
		liftingOrderCache.delete(firstKey);
	}

	return {
		...result,
		sessionStatus,  // Always include fresh session status
		learningMode
	};
}

/**
 * Extract timer state from FOP update (called separately since timer changes frequently)
 * @param {Object} fopUpdate - FOP update data
 * @returns {Object} Timer state
 */
/**
 * Extract timer state from FOP update (called separately since timer changes frequently)
 * Timer visibility rules (same as session-results):
 * - Show when SetTime or StartTime is received
 * - Timer stays visible even after StopTime (until decision shown)
 * - On page load, initialize from current timer event type
 * @param {Object} fopUpdate - FOP update data
 * @param {string} fopName - FOP name for state tracking
 * @returns {Object} Timer state with isActive flag
 */
function extractTimerState(fopUpdate, fopName = 'A') {
	if (!timerStateMap.has(fopName)) {
		timerStateMap.set(fopName, { active: null, running: false });
	}

	const stateRef = timerStateMap.get(fopName);
	let { active, running } = stateRef;

	const eventType = fopUpdate?.athleteTimerEventType;
	const timeRemaining = parseInt(fopUpdate?.athleteMillisRemaining || 0);

	// Initialize state on first call from current fopUpdate data
	if (active === null) {
		if (eventType === 'StartTime') {
			active = true;
			running = true;
		} else if (eventType === 'SetTime') {
			active = true;
			running = false;
		} else if (eventType === 'StopTime') {
			active = false;
			running = false;
		} else if (timeRemaining > 0) {
			active = true;
			running = false;
		} else {
			active = false;
			running = false;
		}
	}

	// State machine for timer visibility and running state
	// For lifting order scoreboard: timer stays visible until decision is shown
	if (eventType === 'SetTime') {
		active = true;
		running = false;
	} else if (eventType === 'StartTime') {
		active = true;
		running = true;
	} else if (eventType === 'StopTime') {
		// StopTime keeps timer visible (just stops counting)
		// Decision display will hide it when referee decisions come
		active = true;
		running = false;
	}

	timerStateMap.set(fopName, { active, running });

	let state = 'stopped';
	if (active && running) {
		state = 'running';
	} else if (active) {
		state = 'set';
	}

	return {
		state,
		isActive: active,  // Key flag: should timer be visible?
		timeRemaining,
		duration: parseInt(fopUpdate?.timeAllowed || 60000),
		startTime: null
	};
}

/**
 * Extract decision state from FOP update
 * @param {Object} fopUpdate - FOP update data
 * @returns {Object} Decision state with visibility and referee decisions
 */
function extractDecisionState(fopUpdate) {
	// Clear decisions when timer starts (new lift beginning)
	const eventType = fopUpdate?.athleteTimerEventType;
	if (eventType === 'StartTime') {
		return {
			visible: false,
			type: null,
			isSingleReferee: false,
			ref1: null,
			ref2: null,
			ref3: null,
			down: false
		};
	}
	
	// Decision is visible when:
	// 1. decisionsVisible flag is true (referee decisions)
	// 2. decisionEventType is FULL_DECISION (all refs decided)
	// 3. down signal is true (bar lowered)
	const isVisible = fopUpdate?.decisionsVisible === 'true' || 
	                  fopUpdate?.decisionEventType === 'FULL_DECISION' ||
	                  fopUpdate?.down === 'true';
	const isSingleReferee = fopUpdate?.singleReferee === 'true' || fopUpdate?.singleReferee === true;

	const mapDecision = (value) => {
		if (value === 'true') return 'good';
		if (value === 'false') return 'bad';
		return null;
	};

	// If down signal is true but no decisions yet, show pending (null) lights
	// Otherwise use the actual referee decisions
	const isDownOnly = fopUpdate?.down === 'true' && fopUpdate?.decisionEventType !== 'FULL_DECISION';
	
	return {
		visible: isVisible,
		type: fopUpdate?.decisionEventType || null,
		isSingleReferee,
		ref1: isDownOnly ? null : mapDecision(fopUpdate?.d1),
		ref2: isDownOnly ? null : mapDecision(fopUpdate?.d2),
		ref3: isDownOnly ? null : mapDecision(fopUpdate?.d3),
		down: fopUpdate?.down === 'true'
	};
}

/**
 * Get top athletes from the competition state (SERVER-SIDE ONLY)
 * @param {Object} competitionState - Full competition state
 * @param {number} limit - Number of athletes to return
 * @returns {Array} Top athletes sorted by total
 */
export function getTopAthletes(competitionState, limit = 10) {
	if (!competitionState?.athletes || !Array.isArray(competitionState.athletes)) {
		return [];
	}

	return competitionState.athletes
		.filter(athlete => athlete && (athlete.total > 0 || athlete.bestSnatch > 0 || athlete.bestCleanJerk > 0))
		.sort((a, b) => {
			// Sort by total first, then by Sinclair, then by best snatch
			const totalA = a.total || 0;
			const totalB = b.total || 0;
			if (totalA !== totalB) return totalB - totalA;
			
			const sinclairA = a.sinclair || 0;
			const sinclairB = b.sinclair || 0;
			if (sinclairA !== sinclairB) return sinclairB - sinclairA;
			
			const snatchA = a.bestSnatch || 0;
			const snatchB = b.bestSnatch || 0;
			return snatchB - snatchA;
		})
		.slice(0, limit);
}

/**
 * Get team rankings computed from the hub (SERVER-SIDE ONLY)
 * @returns {Array} Team rankings with scores
 */
export function getTeamRankings() {
	return competitionHub.getTeamRankings();
}

/**
 * Get athletes by weight class (SERVER-SIDE ONLY)
 * @param {string} weightClass - Weight class to filter by (e.g., "73kg")
 * @param {string} gender - Gender to filter by ("M" or "F")
 * @returns {Array} Athletes in the specified category
 */
export function getAthletesByCategory(weightClass = null, gender = null) {
	const state = getCompetitionState();
	if (!state?.athletes) return [];

	return state.athletes.filter(athlete => {
		if (weightClass && athlete.category !== weightClass) return false;
		if (gender && athlete.gender !== gender) return false;
		return true;
	});
}

/**
 * Get lifting order from the competition state (SERVER-SIDE ONLY)
 * @returns {Array} Current lifting order
 */
export function getLiftingOrder() {
	const state = getCompetitionState();
	return state?.liftingOrder || [];
}

/**
 * Get competition metrics and statistics (SERVER-SIDE ONLY)
 * @param {Object} competitionState - Competition state (optional, will fetch if not provided)
 * @returns {Object} Competition statistics
 */
export function getCompetitionStats(competitionState = null) {
	if (!competitionState) {
		competitionState = getCompetitionState();
	}
	
	if (!competitionState?.athletes) {
		return {
			totalAthletes: 0,
			activeAthletes: 0,
			completedAthletes: 0,
			categories: [],
			teams: []
		};
	}

	const athletes = competitionState.athletes;
	const categories = [...new Set(athletes.map(a => a.categoryName || a.category).filter(Boolean))];
	const teams = [...new Set(athletes.map(a => a.teamName || a.team).filter(Boolean))];

	return {
		totalAthletes: athletes.length,
		activeAthletes: athletes.filter(a => a.total > 0 || a.bestSnatch > 0 || a.bestCleanJerk > 0).length,
		completedAthletes: athletes.filter(a => a.total > 0).length,
		categories,
		teams,
		averageTotal: athletes.filter(a => a.total > 0).reduce((sum, a, _, arr) => sum + a.total / arr.length, 0) || 0
	};
}