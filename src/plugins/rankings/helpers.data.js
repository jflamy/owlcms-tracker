/**
 * Server-side scoreboard helpers - Rankings scoreboard
 * Shows current session athletes sorted by total (highest first)
 */

import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Plugin-specific cache to avoid recomputing rankings on every browser request
 * Structure: { 'cacheKey': { competition, currentAttempt, rankedAthletes, ... } }
 */
const rankingsCache = new Map();

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
 * @param {string} fopName - FOP name (default: 'A')
 * @returns {Object|null} Latest UPDATE message with precomputed data
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
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
			currentAttempt: null,
			timer: { state: 'stopped', timeRemaining: 0, isActive: false },
			decision: { visible: false, isSingleReferee: false, ref1: null, ref2: null, ref3: null, down: false },
			sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },
			rankedAthletes: [],
			groupAthletes: [],
			stats: { totalAthletes: 0, activeAthletes: 0, completedAthletes: 0, categories: [], teams: [] },
			status: 'waiting',
			learningMode
		};
	}

	// Get session status early (before cache check, so it's always fresh)
	const sessionStatus = competitionHub.getSessionStatus(fopName);

	// Check cache first - cache key based on athlete data, NOT timer events
	const groupAthletesHash = fopUpdate?.groupAthletes ? 
		JSON.stringify(fopUpdate.groupAthletes).substring(0, 100) : '';
	const cacheKey = `${fopName}-${groupAthletesHash}-${showRecords}`;
	
	if (rankingsCache.has(cacheKey)) {
		const cached = rankingsCache.get(cacheKey);
		
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
				startNumber: currentAthlete.startNumber,
				categoryName: currentAthlete.category,
				category: currentAthlete.category,
				attempt: fopUpdate?.attempt || '',
				attemptNumber: fopUpdate?.attemptNumber,
				weight: fopUpdate?.weight || '-',
				timeAllowed: fopUpdate?.timeAllowed,
				startTime: null
			};
		}
		
		// Compute sessionStatusMessage from current fopUpdate (even on cache hit)
		let sessionStatusMessage = null;
		if (sessionStatus.isDone && fopUpdate?.fullName) {
			sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		}
		
		// Return cached data with current athlete, timer state, decision state, session status, and status message
		return {
			...cached,
			currentAttempt,
			timer: extractTimerState(fopUpdate, fopName),
			decision: extractDecisionState(fopUpdate),
			sessionStatus,
			sessionStatusMessage,
			learningMode
		};
	}

	// Extract basic competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.groupName || 'A',
		groupInfo: (fopUpdate?.groupInfo || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—'),
		liftsDone: fopUpdate?.liftsDone || ''  // Pre-formatted string from OWLCMS
	};

	// Get groupAthletes from UPDATE message (already parsed as nested object)
	let groupAthletes = [];
	if (fopUpdate?.groupAthletes) {
		groupAthletes = fopUpdate.groupAthletes;
	}

	// Extract current athlete from groupAthletes
	let currentAttempt = null;
	const currentAthlete = groupAthletes.find(a => a.classname && a.classname.includes('current'));
	if (currentAthlete) {
		currentAttempt = {
			fullName: currentAthlete.fullName,
			name: currentAthlete.fullName,
			teamName: currentAthlete.teamName,
			team: currentAthlete.teamName,
			startNumber: currentAthlete.startNumber,
			categoryName: currentAthlete.category,
			category: currentAthlete.category,
			attempt: fopUpdate?.attempt || '',
			attemptNumber: fopUpdate?.attemptNumber,
			weight: fopUpdate?.weight || '-',
			timeAllowed: fopUpdate?.timeAllowed,
			startTime: null
		};
	}

	// Get competition stats
	const stats = getCompetitionStats(databaseState);
	
	// Compute sessionStatusMessage from current fopUpdate
	let sessionStatusMessage = null;
	if (sessionStatus.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
	}
	
	// If no session athletes available, return waiting status
	if (groupAthletes.length === 0) {
		return {
			competition,
			currentAttempt,
			timer: extractTimerState(fopUpdate, fopName),
			decision: extractDecisionState(fopUpdate),
			sessionStatus,
			sessionStatusMessage,
			rankedAthletes: [],
			groupAthletes: [],
			stats,
			status: 'waiting',
			message: 'Waiting for competition update from OWLCMS...',
			lastUpdate: fopUpdate?.lastUpdate || Date.now(),
			learningMode,
			options: { showRecords }
		};
	}
	
	// Determine competition phase: has C&J started?
	// If ANY athlete has a bestCleanJerk that's not "-", C&J has started
	const cjStarted = groupAthletes.some(a => a.bestCleanJerk && a.bestCleanJerk !== '-');
	
	// Sort athletes based on competition phase
	let rankedAthletes;
	if (cjStarted) {
		// C&J has started: sort by category, then by totalRank
		rankedAthletes = [...groupAthletes].sort((a, b) => {
			// First sort by category
			const catA = a.category || '';
			const catB = b.category || '';
			if (catA !== catB) {
				return catA.localeCompare(catB);
			}
			
			// Within category, sort by totalRank
			const rankA = a.totalRank === '-' ? Infinity : parseInt(a.totalRank) || Infinity;
			const rankB = b.totalRank === '-' ? Infinity : parseInt(b.totalRank) || Infinity;
			return rankA - rankB;
		});
	} else {
		// C&J not started yet: sort by category, then by snatchRank
		rankedAthletes = [...groupAthletes].sort((a, b) => {
			// First sort by category
			const catA = a.category || '';
			const catB = b.category || '';
			if (catA !== catB) {
				return catA.localeCompare(catB);
			}
			
			// Within category, sort by snatchRank
			const rankA = a.snatchRank === '-' ? Infinity : parseInt(a.snatchRank) || Infinity;
			const rankB = b.snatchRank === '-' ? Infinity : parseInt(b.snatchRank) || Infinity;
			return rankA - rankB;
		});
	}
	
	// Insert spacers between categories if there are multiple categories
	const categories = [...new Set(groupAthletes.map(a => a.category).filter(Boolean))];
	if (categories.length > 1) {
		const athletesWithSpacers = [];
		let lastCategory = null;
		
		rankedAthletes.forEach(athlete => {
			// Add spacer before new category (except first)
			if (athlete.category && athlete.category !== lastCategory && lastCategory !== null) {
				athletesWithSpacers.push({ 
					isSpacer: true,
					displayRank: '',
					startNumber: '',
					fullName: '',
					teamName: '',
					category: ''
				});
			}
			// Add display rank to athlete (use appropriate rank based on competition phase)
			const athleteWithDisplay = {
				...athlete,
				displayRank: cjStarted 
					? (athlete.totalRank !== '-' ? athlete.totalRank : '-')
					: (athlete.snatchRank !== '-' ? athlete.snatchRank : '-')
			};
			athletesWithSpacers.push(athleteWithDisplay);
			lastCategory = athlete.category;
		});
		
		rankedAthletes = athletesWithSpacers;
	} else {
		// Single category - just add displayRank to each athlete
		rankedAthletes = rankedAthletes.map(athlete => ({
			...athlete,
			displayRank: cjStarted 
				? (athlete.totalRank !== '-' ? athlete.totalRank : '-')
				: (athlete.snatchRank !== '-' ? athlete.snatchRank : '-')
		}));
	}

	// Extract timer and decision state
	const timer = extractTimerState(fopUpdate, fopName);
	const decision = extractDecisionState(fopUpdate);

	const result = {
		scoreboardName: 'Rankings',  // Scoreboard display name
		competition,
		currentAttempt,
		timer,
		decision,
		sessionStatusMessage,
		sortedAthletes: rankedAthletes,  // Standardized field name (sorted by category + rank)
		rankedAthletes,  // Keep for backwards compatibility
		groupAthletes,   // Original groupAthletes for reference
		stats,
		displaySettings: fopUpdate?.showTotalRank || fopUpdate?.showSinclair ? {
			showTotalRank: fopUpdate.showTotalRank === 'true',
			showSinclair: fopUpdate.showSinclair === 'true',
			showLiftRanks: fopUpdate.showLiftRanks === 'true',
			showSinclairRank: fopUpdate.showSinclairRank === 'true'
		} : {},
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		sessionStatus,
		status: (fopUpdate || databaseState) ? 'ready' : 'waiting',
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: { showRecords }
	};
	
	// Cache the result (excluding timer, decision, learningMode, sessionStatus, currentAttempt, and sessionStatusMessage which change frequently)
	rankingsCache.set(cacheKey, {
		scoreboardName: result.scoreboardName,
		competition: result.competition,
		sortedAthletes: result.sortedAthletes,
		rankedAthletes: result.rankedAthletes,
		groupAthletes: result.groupAthletes,
		stats: result.stats,
		displaySettings: result.displaySettings,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		lastUpdate: result.lastUpdate,
		options: result.options
	});
	
	// Cleanup old cache entries (keep last 20)
	if (rankingsCache.size > 20) {
		const firstKey = rankingsCache.keys().next().value;
		rankingsCache.delete(firstKey);
	}

 	return {
		...result,
		sessionStatus,
		learningMode
	};
}

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
	// For rankings scoreboard: timer stays visible until decision is shown
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
 * Get competition statistics (SERVER-SIDE ONLY)
 * @param {Object} databaseState - Full database state
 * @returns {Object} Competition stats
 */
function getCompetitionStats(databaseState) {
	if (!databaseState?.athletes || !Array.isArray(databaseState.athletes)) {
		return {
			totalAthletes: 0,
			activeAthletes: 0,
			completedAthletes: 0,
			categories: [],
			teams: []
		};
	}

	const athletes = databaseState.athletes;
	const categories = new Set();
	const teams = new Set();

	athletes.forEach(athlete => {
		if (athlete.category) categories.add(athlete.category);
		if (athlete.team) teams.add(athlete.team);
	});

	return {
		totalAthletes: athletes.length,
		activeAthletes: athletes.filter(a => a.total > 0 || a.bestSnatch > 0 || a.bestCleanJerk > 0).length,
		completedAthletes: athletes.filter(a => a.total > 0).length,
		categories: Array.from(categories),
		teams: Array.from(teams)
	};
}
