/**
 * Server-side scoreboard helpers - these run on the server and access the competition hub directly
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { extractRecordsFromUpdate } from '$lib/server/records-extractor.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { getCompetitionState } from './helpers.js';

// Track timer visibility state per FOP so StopTime events behave like SetTime when clock is idle
const timerStateMap = new Map();

/**
 * Plugin-specific cache to avoid recomputing session results on every browser request
 * Structure: { 'cacheKey': { competition, startOrderAthletes, rankings, ... } }
 */
const sessionResultsCache = new Map();

/**
 * Get the full database state (raw athlete data) - SERVER-SIDE ONLY
 * @returns {Object|null} Raw database state from OWLCMS
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 * This contains precomputed presentation data like liftingOrderAthletes, startOrderAthletes, etc.
 * @param {string} fopName - FOP name (default: 'A')
 * @returns {Object|null} Latest UPDATE message with precomputed data
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses startOrderAthletes from UPDATE message (standard order: category, lot number)
 * @param {string} fopName - FOP name (default: 'A')
 * @param {Object} options - User preferences (e.g., { showRecords: true })
 * @returns {Object} Formatted data ready for browser consumption
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	const showRecords = options.showRecords ?? true;
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	const sessionStatus = competitionHub.getSessionStatus(fopName);
	const timer = extractTimerState(fopUpdate, fopName);
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.sessionName || 'A',
		groupInfo: (fopUpdate?.groupInfo || '').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014'),
		liftsDone: fopUpdate?.liftsDone || ''
	};
	// Prefer hub-normalized start order entries (includes spacers and resolved athlete payloads)
	// fall back to raw startOrderAthletes/sessionAthletes if hub normalization not available
	let startOrderEntries = [];
	try {
		startOrderEntries = competitionHub.getStartOrderEntries(fopName, { includeSpacers: true }) || [];
	} catch (err) {
		startOrderEntries = [];
	}

	// Backwards compatibility: if hub returned nothing, try raw fields from update
	if ((!Array.isArray(startOrderEntries) || startOrderEntries.length === 0) && fopUpdate) {
		let raw = fopUpdate?.startOrderAthletes ?? fopUpdate?.groupAthletes ?? fopUpdate?.startOrderKeys ?? [];
		if (typeof raw === 'string') {
			try { raw = JSON.parse(raw); } catch (e) { raw = []; }
		}
		if (Array.isArray(raw) && raw.length > 0) {
			// Normalize legacy array into entry objects: strings/numbers -> { athleteKey }
			startOrderEntries = raw.map(e => {
				if (!e) return { isSpacer: true };
				if (typeof e === 'object' && (e.isSpacer || e.type === 'spacer')) return { isSpacer: true };
				if (typeof e === 'string' || typeof e === 'number') return { athleteKey: e };
				if (e.athlete || e.athleteKey || e.key) return { athlete: e.athlete || null, athleteKey: e.athleteKey || e.key || null, classname: e.classname || e.className || '' };
				return { entry: e };
			});
		}
	}
	const records = extractRecordsFromUpdate(fopUpdate);
	const decision = extractDecisionState(fopUpdate);
	
	// Check cache first - cache key based on the last update timestamp from the Hub.
	// This ensures all clients see the same data for a given update, 
	// and invalidation is instant when a new update arrives.
	const lastUpdate = fopUpdate?.lastDataUpdate || 0;
	const cacheKey = `${fopName}-${lastUpdate}-${JSON.stringify(options)}`;
	
	// Extract current athlete from startOrderAthletes (has classname="current" or "current blink")
	let currentAttempt = null;
	// Find current athlete from normalized entries (entry.athlete) or legacy array
	let currentEntry = startOrderEntries.find(e => !e.isSpacer && ((e.classname && e.classname.includes('current')) || (e.athlete && e.athlete.classname && e.athlete.classname.includes('current'))));
	if (!currentEntry && Array.isArray(startOrderEntries)) {
		// fallback: find athlete object with classname
		currentEntry = startOrderEntries.find(e => e && e.athlete && e.athlete.classname && e.athlete.classname.includes('current')) || null;
	}
	if (currentEntry && !currentAttempt) {
		const athleteObj = currentEntry.athlete || currentEntry;
		currentAttempt = {
			fullName: athleteObj.fullName || `${athleteObj.firstName || ''} ${athleteObj.lastName || ''}`.trim(),
			name: athleteObj.fullName || `${athleteObj.firstName || ''} ${athleteObj.lastName || ''}`.trim(),
			teamName: athleteObj.teamName || athleteObj.team || null,
			team: athleteObj.teamName || athleteObj.team || null,
			flagUrl: getFlagUrl(athleteObj.teamName || athleteObj.team, true),
			startNumber: athleteObj.startNumber,
			categoryName: athleteObj.category || athleteObj.categoryName,
			category: athleteObj.category || athleteObj.categoryName,
			attempt: fopUpdate?.attempt || '',
			attemptNumber: fopUpdate?.attemptNumber,
			weight: fopUpdate?.weight || '-',
			timeAllowed: fopUpdate?.timeAllowed,
			startTime: null
		};
	}
	
	// Compute sessionStatusMessage from current fopUpdate
	let sessionStatusMessage = null;
	if (sessionStatus.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014');
	}

	if (sessionResultsCache.has(cacheKey)) {
		const cached = sessionResultsCache.get(cacheKey);
		return {
			...cached,
			timer,
			decision,
			sessionStatus,
			sessionStatusMessage,
			learningMode
		};
	}

	// Get competition stats (needed even for waiting status)
	const stats = getCompetitionStats(databaseState);

	// Extract leaders from fopUpdate (now a proper JSON array from OWLCMS)
	// Keep OWLCMS spacers (isSpacer flag) for accurate grid row counting
	let leaders = [];
	if (fopUpdate?.leaders && Array.isArray(fopUpdate.leaders)) {
		leaders = fopUpdate.leaders
			.map(leader => ({
				...leader,
				flagUrl: leader.teamName ? getFlagUrl(leader.teamName, true) : null
			}));
	}
	
	// If no session athletes available, return waiting status
	// We need the UPDATE message from OWLCMS with precomputed presentation data (stored in startOrderAthletes key)
	if (startOrderEntries.length === 0) {
		return {
			competition,
			currentAttempt,
			timer,
			decision,
			records,
			sessionStatus,  // Include session status even in waiting state
			sessionStatusMessage,  // Include status message
			liftingOrderAthletes: [],
			startOrderAthletes: [],
			stats,
			status: 'waiting',
			message: 'Waiting for competition update from OWLCMS...',
			lastUpdate: fopUpdate?.lastUpdate || Date.now(),
			learningMode,
			options: { showRecords },
			resultRows: 0,  // No athletes yet
			leaderRows: 0   // No leaders yet
		};
	}
	
	// For session results, we use startOrderAthletes (standard order) instead of liftingOrderAthletes
	// startOrderAthletes is already sorted by category and lot number from OWLCMS
	// The hub has already flattened session athletes with:
	// - fullName, teamName, category, yearOfBirth computed
	// - sattempts/cattempts normalized to { stringValue, liftStatus } format
	// - bestSnatch, bestCleanJerk computed
	// Just add flagUrl and ensure arrays have 3 elements
	const athletesWithFlags = (Array.isArray(startOrderEntries) ? startOrderEntries : []).map(entry => {
		if (!entry || entry.isSpacer) return { isSpacer: true };
		
		// Entry is now a flat athlete object from the hub's _flattenSessionAthletes
		const classname = entry.classname || '';
		
		// Ensure sattempts/cattempts arrays have 3 elements
		let sattempts = Array.isArray(entry.sattempts) ? [...entry.sattempts] : [];
		let cattempts = Array.isArray(entry.cattempts) ? [...entry.cattempts] : [];
		while (sattempts.length < 3) sattempts.push(null);
		while (cattempts.length < 3) cattempts.push(null);
		
		return {
			...entry,
			classname,
			sattempts,
			cattempts,
			flagUrl: getFlagUrl(entry.teamName, true)
		};
	});

	// Determine status and message
	const hasData = !!(fopUpdate || databaseState);
	const status = hasData ? 'ready' : 'waiting';
	const message = hasData ? null : `⏳ Waiting for competition data for platform "${fopName}"...`;
	
	// Calculate max team name length (for responsive layout)
	// Narrow team column if longest team name is short (< 7 characters)
	const maxTeamNameLength = Math.max(0, ...athletesWithFlags
		.filter(athlete => !athlete.isSpacer)
		.map(athlete => (athlete.teamName || '').length)
	);
	const compactTeamColumn = maxTeamNameLength < 7; // Narrow team column if max name length < 7

	// Pre-calculate grid-template-rows with repeats for each section
	// Header: 2 rows (primary + secondary)
	const headerRows = 2;
	
	// Results: count all athlete/spacer rows in the session
	let resultRows = 0;
	let lastCategory = null;
	for (const athlete of athletesWithFlags) {
		if (athlete.isSpacer) {
			resultRows++; // Spacer row (initial spacer or category separator)
		} else {
			resultRows++; // Athlete row
			lastCategory = athlete.category;
		}
	}
	
	// Leaders: count leader rows (include spacers, title, and data rows)
	let leaderRows = 0;
	if (leaders && leaders.length > 0) {
		leaderRows++; // Title row (leaders-header with leaders-title-cell)
		let lastLeaderCategory = null;
		for (const leader of leaders) {
			if (leader.isSpacer) {
				leaderRows++; // Spacer row
			} else {
				// Category spacer before first leader of new category
				if (leader.category !== lastLeaderCategory && lastLeaderCategory !== null) {
					leaderRows++; // Category separator
				}
				leaderRows++; // Leader row
				lastLeaderCategory = leader.category;
			}
		}
	}
	
	// Build grid-template-rows string with repeats
	// IMPORTANT: Header rows are now defined in CSS using
	//   grid-template-rows: var(--header-primary-height) var(--header-secondary-height) var(--template-rows)
	// Therefore, DO NOT include header rows here; only include rows after headers.
	// Format produced here (consumed as --template-rows):
	//   "repeat(resultRows, minmax(10px, auto)) 1fr repeat(leaderRows, minmax(10px, auto))"
	// Results: athlete rows + category spacers (NOT including the final spacer after last athlete)
	// Leaders-spacer: 1fr (elastic spacing between results and leaders title)
	// Leaders: title + athlete rows + category spacers
	const gridTemplateRows = leaders && leaders.length > 0
		? `repeat(${resultRows}, minmax(10px, auto)) 1fr repeat(${leaderRows}, minmax(10px, auto))`
		: `repeat(${resultRows}, minmax(10px, auto))`;


	const result = {
		scoreboardName: 'Session Results',  // Scoreboard display name
		competition,
		currentAttempt,
		timer,
		decision,
		sessionStatusMessage,  // Cleaned message for when session is done
		sortedAthletes: athletesWithFlags,        // Standardized field name (OWLCMS standard order)
		liftingOrderAthletes: athletesWithFlags, // Keep for backwards compatibility
		startOrderAthletes: athletesWithFlags,                        // Also keep raw startOrderAthletes
		leaders,                              // Leaders from previous sessions (from OWLCMS)
		stats,
		displaySettings: fopUpdate?.showTotalRank || fopUpdate?.showSinclair ? {
			showTotalRank: fopUpdate.showTotalRank === 'true',
			showSinclair: fopUpdate.showSinclair === 'true',
			showLiftRanks: fopUpdate.showLiftRanks === 'true',
			showSinclairRank: fopUpdate.showSinclairRank === 'true'
		} : {},
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		sessionStatus,  // Include session status (isDone, sessionName, lastActivity)
		compactTeamColumn,  // Narrow team column if max team size < 7
		gridTemplateRows,  // Pre-calculated grid template with repeats
		resultRows,        // Expose row count for results section (for frontend overrides)
		leaderRows,        // Expose row count for leaders section (for frontend overrides)
		records,           // Records from current session UPDATE
		status,
		message,  // Add helpful waiting message
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: { showRecords } // Echo back the options used
	};
	
	// Cache the result (excluding timer, learningMode, sessionStatus, and sessionStatusMessage which change frequently)
	sessionResultsCache.set(cacheKey, {
		scoreboardName: result.scoreboardName,
		competition: result.competition,
		currentAttempt: result.currentAttempt,
		sortedAthletes: result.sortedAthletes,
		liftingOrderAthletes: result.liftingOrderAthletes,
		startOrderAthletes: result.startOrderAthletes,
		leaders: result.leaders,  // Include leaders in cache
		records: result.records,   // Include records in cache
		stats: result.stats,
		displaySettings: result.displaySettings,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		message: result.message,  // Include waiting message in cache
		compactTeamColumn: result.compactTeamColumn,  // Include responsive layout flag
		gridTemplateRows: result.gridTemplateRows,  // Include pre-calculated grid template
		resultRows: result.resultRows,  // Include result row count
		leaderRows: result.leaderRows,  // Include leader row count
		lastUpdate: result.lastUpdate,
		options: result.options
	});
	
	// Cleanup old cache entries (keep last 20)
	if (sessionResultsCache.size > 20) {
		const firstKey = sessionResultsCache.keys().next().value;
		sessionResultsCache.delete(firstKey);
	}

	return {
		...result,
		sessionStatus,  // Always include fresh session status
		learningMode
	};
}

/**
 * Extract timer state from FOP update (called separately since timer changes frequently)
 * Timer visibility rules (same as lower-third):
 * - Show when SetTime or StartTime is received
 * - Hide ONLY when StopTime is received while timer is running
 * - SetTime after StopTime makes timer visible again
 * - On page load, initialize from current timer event type
 * @param {Object} fopUpdate - FOP update data
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
	// For session scoreboard: timer stays visible until decision is shown
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