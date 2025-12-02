/**
 * Server-side scoreboard helpers for Attempt Board
 * Copy of session-results helpers adapted for attempt-focused display
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';

// Track timer visibility state per FOP
const timerStateMap = new Map();

/**
 * Plugin-specific cache to avoid recomputing attempt board on every browser request
 */
const attemptBoardCache = new Map();
import { buildCacheKey } from '$lib/server/cache-utils.js';

/**
 * Get the full database state (raw athlete data) - SERVER-SIDE ONLY
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses groupAthletes from UPDATE message with focus on attempt progression
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

	// Check cache first - cache key based on hub FOP version + options.
	// Volatile fields (timer/decision/sessionStatus) are excluded from the cache.
	const cacheKey = buildCacheKey({ fopName, includeFop: true, opts: options });
	
	if (attemptBoardCache.has(cacheKey)) {
		const cached = attemptBoardCache.get(cacheKey);
		
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
		
		// Return cached data with current athlete, timer state, and session status
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
		session: fopUpdate?.sessionName || 'A',
		sessionInfo: (fopUpdate?.sessionInfo || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—'),
		liftsDone: fopUpdate?.liftsDone || ''
	};

	// Extract timer, decision, and records
	const timer = extractTimerState(fopUpdate, fopName);
	const decision = extractDecisionState(fopUpdate);
	const records = extractRecordsFromUpdate(fopUpdate);

	// Get precomputed groupAthletes from UPDATE message
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
			flagUrl: getFlagUrl(currentAthlete.teamName, true),
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
	
	// Extract leaders from fopUpdate
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
	if (groupAthletes.length === 0) {
		return {
			competition,
			currentAttempt,
			timer,
			decision: extractDecisionState(fopUpdate),
			records,
			sessionStatus,
			sessionStatusMessage,
			liftingOrderAthletes: [],
			groupAthletes: [],
			stats,
			status: 'waiting',
			message: 'Waiting for competition update from OWLCMS...',
			lastUpdate: fopUpdate?.lastUpdate || Date.now(),
			learningMode,
			options: { showRecords },
			resultRows: 0,
			leaderRows: 0
		};
	}
	
	// Add flagUrl to each athlete
	const athletesWithFlags = groupAthletes.map(athlete => ({
		...athlete,
		flagUrl: getFlagUrl(athlete.teamName, true)
	}));

	// Determine status and message
	const hasData = !!(fopUpdate || databaseState);
	const status = hasData ? 'ready' : 'waiting';
	const message = hasData ? null : `⏳ Waiting for competition data for platform "${fopName}"...`;
	
	// Calculate max team name length for responsive layout
	const maxTeamNameLength = Math.max(0, ...athletesWithFlags
		.filter(athlete => !athlete.isSpacer)
		.map(athlete => (athlete.teamName || '').length)
	);
	const compactTeamColumn = maxTeamNameLength < 7;

	// Pre-calculate grid-template-rows
	const headerRows = 2;
	let resultRows = 0;
	for (const athlete of athletesWithFlags) {
		resultRows++;
	}
	
	let leaderRows = 0;
	if (leaders && leaders.length > 0) {
		leaderRows++;
		for (const leader of leaders) {
			leaderRows++;
		}
	}
	
	const gridTemplateRows = leaders && leaders.length > 0
		? `repeat(${resultRows}, minmax(10px, auto)) 1fr repeat(${leaderRows}, minmax(10px, auto))`
		: `repeat(${resultRows}, minmax(10px, auto))`;

	const result = {
		scoreboardName: 'Attempt Board',
		competition,
		currentAttempt,
		timer,
		decision,
		sessionStatusMessage,
		sortedAthletes: athletesWithFlags,
		liftingOrderAthletes: athletesWithFlags,
		groupAthletes: athletesWithFlags,
		leaders,
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
		compactTeamColumn,
		gridTemplateRows,
		resultRows,
		leaderRows,
		records,
		status,
		message,
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: { showRecords }
	};
	
	// Cache the result (exclude volatile fields like timer/decision/sessionStatus)
	attemptBoardCache.set(cacheKey, {
		scoreboardName: result.scoreboardName,
		competition: result.competition,
		currentAttempt: result.currentAttempt,
		sortedAthletes: result.sortedAthletes,
		liftingOrderAthletes: result.liftingOrderAthletes,
		groupAthletes: result.groupAthletes,
		leaders: result.leaders,
		records: result.records,
		stats: result.stats,
		displaySettings: result.displaySettings,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		message: result.message,
		compactTeamColumn: result.compactTeamColumn,
		gridTemplateRows: result.gridTemplateRows,
		resultRows: result.resultRows,
		leaderRows: result.leaderRows,
		lastUpdate: result.lastUpdate,
		options: result.options
	});
    
	// Cleanup old cache entries - keep small number of cached variants
	if (attemptBoardCache.size > 3) {
		const firstKey = attemptBoardCache.keys().next().value;
		attemptBoardCache.delete(firstKey);
	}

	return {
		...result,
		sessionStatus,
		learningMode
	};
}

/**
 * Extract timer state from FOP update
 */
function extractTimerState(fopUpdate, fopName = 'A') {
	if (!timerStateMap.has(fopName)) {
		timerStateMap.set(fopName, { active: null, running: false });
	}

	const stateRef = timerStateMap.get(fopName);
	let { active, running } = stateRef;

	const eventType = fopUpdate?.athleteTimerEventType;
	const timeRemaining = parseInt(fopUpdate?.athleteMillisRemaining || 0);

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

	if (eventType === 'SetTime') {
		active = true;
		running = false;
	} else if (eventType === 'StartTime') {
		active = true;
		running = true;
	} else if (eventType === 'StopTime') {
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
		isActive: active,
		timeRemaining,
		duration: parseInt(fopUpdate?.timeAllowed || 60000),
		startTime: null
	};
}

/**
 * Extract records from UPDATE message
 */
function extractRecordsFromUpdate(fopUpdate) {
	if (!fopUpdate?.records) {
		return [];
	}

	try {
		const recordsData = typeof fopUpdate.records === 'string' 
			? JSON.parse(fopUpdate.records) 
			: fopUpdate.records;

		if (!recordsData?.recordTable || !recordsData?.recordNames) {
			return [];
		}

		const isEmpty = (val) => !val || val === '' || (typeof val === 'string' && val.trim() === '');
		const categoryNameCounts = {};

		for (const block of recordsData.recordTable) {
			const displayName = block.cat || '';
			if (!categoryNameCounts[displayName]) {
				categoryNameCounts[displayName] = 0;
			}
			categoryNameCounts[displayName]++;
		}

		const categoryCounters = {};
		for (const block of recordsData.recordTable) {
			const displayName = block.cat || '';
			
			if (!categoryCounters[displayName]) {
				categoryCounters[displayName] = 0;
			}
			categoryCounters[displayName]++;
		}

		const recordsByFederation = {};
		
		for (const fedName of recordsData.recordNames) {
			recordsByFederation[fedName] = {
				categories: new Set(),
				recordsByCategory: {}
			};
		}

		for (const block of recordsData.recordTable) {
			if (!block.records || block.records.length === 0) {
				continue;
			}

			const displayName = block.cat || '';
			
			for (let fedIndex = 0; fedIndex < recordsData.recordNames.length; fedIndex++) {
				const recordObj = block.records[fedIndex];
				const fedName = recordsData.recordNames[fedIndex];
				
				if (!recordObj) continue;

				if (!recordsByFederation[fedName].recordsByCategory[displayName]) {
					recordsByFederation[fedName].recordsByCategory[displayName] = {
						displayName,
						S: null,
						CJ: null,
						T: null
					};
				}

				recordsByFederation[fedName].categories.add(displayName);

				if (!isEmpty(recordObj.SNATCH)) {
					recordsByFederation[fedName].recordsByCategory[displayName].S = {
						value: recordObj.SNATCH,
						highlight: recordObj.snatchHighlight || null
					};
				}

				if (!isEmpty(recordObj.CLEANJERK)) {
					recordsByFederation[fedName].recordsByCategory[displayName].CJ = {
						value: recordObj.CLEANJERK,
						highlight: recordObj.cjHighlight || null
					};
				}

				if (!isEmpty(recordObj.TOTAL)) {
					recordsByFederation[fedName].recordsByCategory[displayName].T = {
						value: recordObj.TOTAL,
						highlight: recordObj.totalHighlight || null
					};
				}
			}
		}

		return Object.entries(recordsByFederation)
			.filter(([fedName, data]) => data.categories.size > 0)
			.map(([fedName, data]) => ({
				federation: fedName,
				categories: Array.from(data.categories).sort(),
				records: data.recordsByCategory
			}));
	} catch (error) {
		console.error('[Attempt Board] Error parsing records:', error);
		return [];
	}
}

/**
 * Extract decision state from FOP update
 */
function extractDecisionState(fopUpdate) {
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
	
	const isVisible = fopUpdate?.decisionsVisible === 'true' || 
	                  fopUpdate?.decisionEventType === 'FULL_DECISION' ||
	                  fopUpdate?.down === 'true';
	const isSingleReferee = fopUpdate?.singleReferee === 'true' || fopUpdate?.singleReferee === true;

	const mapDecision = (value) => {
		if (value === 'true') return 'good';
		if (value === 'false') return 'bad';
		return null;
	};

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
 * Get competition metrics and statistics
 */
export function getCompetitionStats(competitionState = null) {
	if (!competitionState) {
		competitionState = getDatabaseState();
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
