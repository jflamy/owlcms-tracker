/**
 * Server-side scoreboard helpers - these run on the server and access the competition hub directly
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';

// Track timer visibility state per FOP so StopTime events behave like SetTime when clock is idle
const timerStateMap = new Map();

/**
 * Plugin-specific cache to avoid recomputing session results on every browser request
 * Structure: { 'cacheKey': { competition, groupAthletes, rankings, ... } }
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
 * This contains precomputed presentation data like liftingOrderAthletes, groupAthletes, etc.
 * @param {string} fopName - FOP name (default: 'A')
 * @returns {Object|null} Latest UPDATE message with precomputed data
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses groupAthletes from UPDATE message (standard order: category, lot number)
 * @param {string} fopName - FOP name (default: 'A')
 * @param {Object} options - User preferences (e.g., { showRecords: true })
 * @returns {Object} Formatted data ready for browser consumption
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	
	// Extract options with defaults
	const showRecords = options.showRecords ?? false;
	
	// Get learning mode from environment
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			decision: extractDecisionState(fopUpdate),
			records: [],
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

	// Check cache first - cache key based on session athletes data, NOT timer events or UI preferences
	// Use length + first item ID as quick hash instead of expensive JSON.stringify
	// This avoids memory spikes when loading multiple scoreboards simultaneously
	const sessionAthletesHash = fopUpdate?.groupAthletes ? 
		`${fopUpdate.groupAthletes.length}-${fopUpdate.groupAthletes[0]?.id || 0}` : '';
	const cacheKey = `${fopName}-${sessionAthletesHash}`;
	
	if (sessionResultsCache.has(cacheKey)) {
		const cached = sessionResultsCache.get(cacheKey);
		
		// Extract current athlete from groupAthletes (single source of truth)
		let currentAttempt = null;
		const groupAthletes = fopUpdate?.groupAthletes || [];
		const currentAthlete = groupAthletes.find(a => a.classname && a.classname.includes('current'));
		if (currentAthlete) {
			currentAttempt = {
				fullName: currentAthlete.fullName,
				name: currentAthlete.fullName,
				teamName: currentAthlete.teamName,
				team: currentAthlete.teamName,
				flagUrl: getFlagUrl(currentAthlete.teamName, true),
				startNumber: currentAthlete.startNumber,
				categoryName: currentAthlete.category,
				category: currentAthlete.category,
				attempt: fopUpdate?.attempt || '',  // Use preformatted attempt from fopUpdate
				attemptNumber: fopUpdate?.attemptNumber,
				weight: fopUpdate?.weight || '-',  // Use weight directly from fopUpdate
				timeAllowed: fopUpdate?.timeAllowed,
				startTime: null
			};
		}
		
		// Compute sessionStatusMessage from current fopUpdate (even on cache hit)
		let sessionStatusMessage = null;
		if (sessionStatus.isDone && fopUpdate?.fullName) {
			sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		}
		
		// Return cached data with current athlete, timer state, session status, and status message
		return {
			...cached,
			currentAttempt,  // Fresh current athlete from groupAthletes
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

	// Extract timer info from UPDATE message or keep previous timer state
	const timer = extractTimerState(fopUpdate, fopName);
	const decision = extractDecisionState(fopUpdate);
	const records = extractRecordsFromUpdate(fopUpdate);

	// Get precomputed groupAthletes from UPDATE message (already JSON-encoded string)
	// This contains all athletes in standard order (sorted by category, lot number)
	let groupAthletes = [];
	if (fopUpdate?.groupAthletes) {
		// groupAthletes is already a parsed object (nested JSON from WebSocket)
		groupAthletes = fopUpdate.groupAthletes;
	}
	
	// Extract current athlete from groupAthletes (has classname="current" or "current blink")
	let currentAttempt = null;
	const currentAthlete = groupAthletes.find(a => a.classname && a.classname.includes('current'));
	if (currentAthlete) {
		currentAttempt = {
			fullName: currentAthlete.fullName,
			name: currentAthlete.fullName,
			teamName: currentAthlete.teamName,
			team: currentAthlete.teamName,
			flagUrl: getFlagUrl(currentAthlete.teamName, true),
			startNumber: currentAthlete.startNumber,
			categoryName: currentAthlete.category,
			category: currentAthlete.category,
			attempt: fopUpdate?.attempt || '',  // Use preformatted attempt from fopUpdate
			attemptNumber: fopUpdate?.attemptNumber,
			weight: fopUpdate?.weight || '-',  // Use weight directly from fopUpdate
			timeAllowed: fopUpdate?.timeAllowed,
			startTime: null
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
	
	// Compute sessionStatusMessage from current fopUpdate
	let sessionStatusMessage = null;
	if (sessionStatus.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
	}
	
	// If no session athletes available, return waiting status
	// We need the UPDATE message from OWLCMS with precomputed presentation data (stored in groupAthletes key)
	if (groupAthletes.length === 0) {
		return {
			competition,
			currentAttempt,
			timer,
			decision: extractDecisionState(fopUpdate),
			records,
			sessionStatus,  // Include session status even in waiting state
			sessionStatusMessage,  // Include status message
			liftingOrderAthletes: [],
			groupAthletes: [],
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
	
	// For session results, we use groupAthletes (standard order) instead of liftingOrderAthletes
	// groupAthletes is already sorted by category and lot number from OWLCMS
	// Add flagUrl to each athlete
	const athletesWithFlags = groupAthletes.map(athlete => ({
		...athlete,
		// ask resolver to return null for missing flags so the template doesn't
		// render a transparent placeholder image (which simply shows the
		// cell background, e.g. green for the current row)
		flagUrl: getFlagUrl(athlete.teamName, true)
	}));

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
		groupAthletes: athletesWithFlags,                        // Also keep raw groupAthletes
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
		sessionStatus,  // Include session status (isDone, groupName, lastActivity)
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
		groupAthletes: result.groupAthletes,
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

/**
 * Extract records from UPDATE message
 * Records come as a JSON string in fopUpdate.records
 * Format: {"recordNames":["PanAm"],"recordCategories":["JR 86","SR 86"],"recordTable":[...]}
 * Returns: Array of objects grouped by federation with categories and lift values
 */
function extractRecordsFromUpdate(fopUpdate) {
	if (!fopUpdate?.records) {
		return [];
	}

	try {
		// Parse the JSON string
		const recordsData = typeof fopUpdate.records === 'string' 
			? JSON.parse(fopUpdate.records) 
			: fopUpdate.records;

		if (!recordsData?.recordTable || !recordsData?.recordNames) {
			return [];
		}

		// Helper to check if a value is "empty" (spaces, empty string, falsy, etc.)
		const isEmpty = (val) => !val || val === '' || (typeof val === 'string' && val.trim() === '');

		// Track unique categories to detect collisions (e.g., two "JR 77" with different meanings)
		const categoryNameCounts = {};
		const categoryKeyMap = {}; // Maps displayName to unique keys: "JR 77" -> ["JR 77-1", "JR 77-2"]

		// First pass: identify category collisions and create unique keys
		for (const block of recordsData.recordTable) {
			const displayName = block.cat || '';
			if (!categoryNameCounts[displayName]) {
				categoryNameCounts[displayName] = 0;
			}
			categoryNameCounts[displayName]++;
		}

		// Create unique keys for categories with collisions
		const categoryCounters = {}; // Tracks current count for each display name
		for (const block of recordsData.recordTable) {
			const displayName = block.cat || '';
			const hasCollision = categoryNameCounts[displayName] > 1;
			
			if (!categoryCounters[displayName]) {
				categoryCounters[displayName] = 0;
			}
			categoryCounters[displayName]++;
			
			// Create unique key: use display name if no collision, else add -1, -2, etc.
			const uniqueKey = hasCollision ? `${displayName}-${categoryCounters[displayName]}` : displayName;
			
			if (!categoryKeyMap[displayName]) {
				categoryKeyMap[displayName] = [];
			}
			if (!categoryKeyMap[displayName].includes(uniqueKey)) {
				categoryKeyMap[displayName].push(uniqueKey);
			}
			
			block._uniqueKey = uniqueKey; // Store unique key for later use
		}

		// Build structure: recordsByFederation[fedName] = { categories: Set, recordsByCategory: {...} }
		const recordsByFederation = {};
		
		// Initialize each federation
		for (const fedName of recordsData.recordNames) {
			recordsByFederation[fedName] = {
				categories: new Set(),
				recordsByCategory: {}
			};
		}

		// Iterate through each record block
		for (const block of recordsData.recordTable) {
			if (!block.records || block.records.length === 0) {
				continue;
			}

			const displayName = block.cat || '';
			const uniqueKey = block._uniqueKey; // Use the unique key we created
			
			// Each position in block.records corresponds to a federation in recordNames
			for (let fedIndex = 0; fedIndex < recordsData.recordNames.length; fedIndex++) {
				const recordObj = block.records[fedIndex];
				const fedName = recordsData.recordNames[fedIndex];
				
				if (!recordObj) continue;

				// Initialize category for this federation if not already present
				if (!recordsByFederation[fedName].recordsByCategory[uniqueKey]) {
					recordsByFederation[fedName].recordsByCategory[uniqueKey] = {
						displayName, // Store display name for rendering
						S: null,
						CJ: null,
						T: null
					};
				}

				// Track this category for this federation
				recordsByFederation[fedName].categories.add(uniqueKey);

				// Extract SNATCH with optional snatchHighlight
				if (!isEmpty(recordObj.SNATCH)) {
					recordsByFederation[fedName].recordsByCategory[uniqueKey].S = {
						value: recordObj.SNATCH,
						highlight: recordObj.snatchHighlight || null
					};
				}

				// Extract CLEANJERK with optional cjHighlight
				if (!isEmpty(recordObj.CLEANJERK)) {
					recordsByFederation[fedName].recordsByCategory[uniqueKey].CJ = {
						value: recordObj.CLEANJERK,
						highlight: recordObj.cjHighlight || null
					};
				}

				// Extract TOTAL with optional totalHighlight
				if (!isEmpty(recordObj.TOTAL)) {
					recordsByFederation[fedName].recordsByCategory[uniqueKey].T = {
						value: recordObj.TOTAL,
						highlight: recordObj.totalHighlight || null
					};
				}
			}
		}

		// Convert to flat array format for easier frontend consumption
		// Returns: [ { federation, categories: [cat1, cat2, ...], records: { cat1: {displayName, S, CJ, T}, cat2: {...}, ... } } ]
		return Object.entries(recordsByFederation)
			.filter(([fedName, data]) => data.categories.size > 0)
			.map(([fedName, data]) => ({
				federation: fedName,
				categories: Array.from(data.categories).sort(),
				records: data.recordsByCategory
			}));
	} catch (error) {
		console.error('[Session Results] Error parsing records:', error);
		return [];
	}
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