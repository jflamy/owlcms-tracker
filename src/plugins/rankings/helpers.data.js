/**
 * Server-side scoreboard helpers - Rankings scoreboard
 * Shows current session athletes sorted by rank (category + totalRank or snatchRank)
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { extractRecordsFromUpdate } from '$lib/server/records-extractor.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';

// Track timer visibility state per FOP so StopTime events behave like SetTime when clock is idle
const timerStateMap = new Map();

/**
 * Defensive helper to get the hub-provided FOP version used for cache invalidation
 */
import { buildCacheKey } from '$lib/server/cache-utils.js';

/**
 * Plugin-specific cache to avoid recomputing rankings on every browser request
 * Structure: { 'cacheKey': { competition, rankedAthletes, ... } }
 */
const rankingsCache = new Map();

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
 * Uses session athletes sorted by rank (category + totalRank or snatchRank)
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
		sessionInfo: (fopUpdate?.sessionInfo || '').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014'),
		liftsDone: fopUpdate?.liftsDone || ''
	};
	
	// Get session athletes from hub (includes spacers and resolved athlete payloads)
	// Rankings uses start order as base, then re-sorts by rank
	let sessionEntries = [];
	try {
		sessionEntries = competitionHub.getStartOrderEntries(fopName, { includeSpacers: false }) || [];
	} catch (err) {
		sessionEntries = [];
	}

	// Backwards compatibility: if hub returned nothing, try raw fields from update
	if ((!Array.isArray(sessionEntries) || sessionEntries.length === 0) && fopUpdate) {
		let raw = fopUpdate?.startOrderAthletes ?? fopUpdate?.groupAthletes ?? fopUpdate?.sessionAthletes ?? [];
		if (typeof raw === 'string') {
			try { raw = JSON.parse(raw); } catch (e) { raw = []; }
		}
		if (Array.isArray(raw) && raw.length > 0) {
			// Normalize legacy array into entry objects
			sessionEntries = raw.map(e => {
				if (!e) return null;
				if (typeof e === 'object' && (e.isSpacer || e.type === 'spacer')) return null; // Skip spacers
				if (e.athlete || e.athleteKey || e.key) return { athlete: e.athlete || null, athleteKey: e.athleteKey || e.key || null, classname: e.classname || e.className || '', ...e };
				return e;
			}).filter(Boolean);
		}
	}
	
	const records = extractRecordsFromUpdate(fopUpdate);
	const decision = extractDecisionState(fopUpdate);
	
	// Check cache first - cache key based on hub FOP version + options
	const cacheKey = buildCacheKey({ fopName, includeFop: true, opts: options });
	
	// Extract current athlete from session entries (has classname="current" or "current blink")
	let currentAttempt = null;
	let currentEntry = sessionEntries.find(e => e && ((e.classname && e.classname.includes('current')) || (e.athlete && e.athlete.classname && e.athlete.classname.includes('current'))));
	if (currentEntry) {
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

	if (rankingsCache.has(cacheKey)) {
		const cached = rankingsCache.get(cacheKey);
		return {
			...cached,
			currentAttempt,
			timer,
			decision,
			sessionStatus,
			sessionStatusMessage,
			learningMode
		};
	}

	// Get competition stats (needed even for waiting status)
	const stats = getCompetitionStats(databaseState);

	// Extract leaders from fopUpdate (V2 format: { athlete: {...}, displayInfo: {...} })
	let leaders = [];
	if (fopUpdate?.leaders && Array.isArray(fopUpdate.leaders)) {
		leaders = fopUpdate.leaders
			.map(leader => {
				if (!leader) return null;
				if (leader.isSpacer) {
					return { isSpacer: true };
				}
				// V2 format: { athlete: {...}, displayInfo: {...} }
				if (leader.athlete && leader.displayInfo) {
					const flat = {
						...leader.athlete,
						...leader.displayInfo
					};
					flat.athlete = leader.athlete;
					flat.displayInfo = leader.displayInfo;
					flat.athleteKey = leader.athlete?.key ?? leader.athlete?.id ?? flat.athleteKey ?? null;
					flat.flagUrl = flat.teamName ? getFlagUrl(flat.teamName, true) : null;
					
					// Ensure sattempts/cattempts arrays have 3 elements
					let sattempts = Array.isArray(flat.sattempts) ? [...flat.sattempts] : [];
					let cattempts = Array.isArray(flat.cattempts) ? [...flat.cattempts] : [];
					while (sattempts.length < 3) sattempts.push(null);
					while (cattempts.length < 3) cattempts.push(null);
					flat.sattempts = sattempts;
					flat.cattempts = cattempts;
					
					return flat;
				}

				return {
					...leader,
					flagUrl: leader.teamName ? getFlagUrl(leader.teamName, true) : null
				};
			})
			.filter(Boolean);
	}
	
	// If no session athletes available, return waiting status
	if (sessionEntries.length === 0) {
		return {
			competition,
			currentAttempt,
			timer,
			decision,
			records,
			sessionStatus,
			sessionStatusMessage,
			rankedAthletes: [],
			sortedAthletes: [],
			leaders,
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
	
	// Process session athletes - add flagUrl and ensure arrays have 3 elements
	const athletesWithFlags = sessionEntries.map(entry => {
		if (!entry) return null;
		
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
	}).filter(Boolean);
	
	// Determine competition phase: has C&J started?
	// If ANY athlete has a bestCleanJerk that's not "-", C&J has started
	const cjStarted = athletesWithFlags.some(a => a.bestCleanJerk && a.bestCleanJerk !== '-');
	
	// Sort athletes based on competition phase
	let rankedAthletes;
	if (cjStarted) {
		// C&J has started: sort by category, then by totalRank
		rankedAthletes = [...athletesWithFlags].sort((a, b) => {
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
		rankedAthletes = [...athletesWithFlags].sort((a, b) => {
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
	const categories = [...new Set(athletesWithFlags.map(a => a.category).filter(Boolean))];
	if (categories.length > 1) {
		const athletesWithSpacers = [];
		let lastCategory = '';
		
		rankedAthletes.forEach(athlete => {
			// Add spacer before new category
			if (athlete.category && athlete.category !== lastCategory) {
				athletesWithSpacers.push({ isSpacer: true });
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

	// Determine status and message
	const hasData = !!(fopUpdate || databaseState);
	const status = hasData ? 'ready' : 'waiting';
	const message = hasData ? null : `⏳ Waiting for competition data for platform "${fopName}"...`;
	
	// Calculate max team name length (for responsive layout)
	const maxTeamNameLength = Math.max(0, ...rankedAthletes
		.filter(athlete => !athlete.isSpacer)
		.map(athlete => (athlete.teamName || '').length)
	);
	const compactTeamColumn = maxTeamNameLength < 7;

	// Pre-calculate grid-template-rows with repeats for each section
	let resultRows = 0;
	for (const athlete of rankedAthletes) {
		resultRows++;
	}
	
	// Leaders: count leader rows (include spacers, title, and data rows)
	let leaderRows = 0;
	if (leaders && leaders.length > 0) {
		leaderRows++; // Title row
		let lastLeaderCategory = null;
		for (const leader of leaders) {
			if (leader.isSpacer) {
				leaderRows++;
			} else {
				if (leader.category !== lastLeaderCategory && lastLeaderCategory !== null) {
					leaderRows++;
				}
				leaderRows++;
				lastLeaderCategory = leader.category;
			}
		}
	}
	
	const gridTemplateRows = leaders && leaders.length > 0
		? `repeat(${resultRows}, minmax(10px, auto)) 1fr repeat(${leaderRows}, minmax(10px, auto))`
		: `repeat(${resultRows}, minmax(10px, auto))`;

	const result = {
		scoreboardName: 'Rankings',
		competition,
		currentAttempt,
		timer,
		decision,
		sessionStatusMessage,
		sortedAthletes: rankedAthletes,
		rankedAthletes,
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
	rankingsCache.set(cacheKey, {
		scoreboardName: result.scoreboardName,
		competition: result.competition,
		sortedAthletes: result.sortedAthletes,
		rankedAthletes: result.rankedAthletes,
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
    
	// Cleanup old cache entries - keep a small number to limit memory
	if (rankingsCache.size > 3) {
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
