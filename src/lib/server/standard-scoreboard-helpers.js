/**
 * Shared server-side helpers for standard scoreboards
 * 
 * All standard scoreboards (lifting-order, session-results, rankings) share this base
 * implementation. They differ only in:
 * - scoreboardName: Display name
 * - dataSource: 'liftingOrder' | 'startOrder' 
 * - sortStrategy: 'none' | 'byRank' (for rankings scoreboard)
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { extractRecordsFromUpdate } from '$lib/server/records-extractor.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { buildCacheKey } from '$lib/server/cache-utils.js';
import { extractTimerAndDecisionState } from '$lib/server/timer-decision-helpers.js';

// Shared cache for all standard scoreboards (keyed by scoreboard type + fop + options)
const scoreboardCache = new Map();

/**
 * Configuration for standard scoreboard types
 */
export const SCOREBOARD_CONFIGS = {
	'lifting-order': {
		scoreboardName: 'Lifting Order',
		dataSource: 'liftingOrder',
		sortStrategy: 'none'  // Already sorted by OWLCMS
	},
	'session-results': {
		scoreboardName: 'Session Results',
		dataSource: 'startOrder',
		sortStrategy: 'none'  // Already sorted by OWLCMS
	},
	'rankings': {
		scoreboardName: 'Rankings',
		dataSource: 'startOrder',
		sortStrategy: 'byRank'  // Re-sort by totalRank or snatchRank
	}
};

/**
 * Get the full database state - SERVER-SIDE ONLY
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
 * @param {string} scoreboardType - One of: 'lifting-order', 'session-results', 'rankings'
 * @param {string} fopName - FOP name (default: 'A')
 * @param {Object} options - User preferences (e.g., { showRecords: true })
 * @returns {Object} Formatted data ready for browser consumption
 */
export function getScoreboardData(scoreboardType, fopName = 'A', options = {}) {
	const config = SCOREBOARD_CONFIGS[scoreboardType];
	if (!config) {
		throw new Error(`Unknown scoreboard type: ${scoreboardType}`);
	}
	
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	const showRecords = options.showRecords ?? true;
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	const sessionStatus = competitionHub.getSessionStatus(fopName);
	
	// Extract timer, break timer, decision, and display mode using shared helper
	const { timer, breakTimer, decision, displayMode, activeTimer } = extractTimerAndDecisionState(fopUpdate);
	
	// Determine if timer should be shown (active competition state)
	const hasActiveSession = fopUpdate?.fopState && fopUpdate.fopState !== 'INACTIVE';
	
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.sessionName || 'A',
		sessionInfo: (fopUpdate?.sessionInfo || '').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014'),
		liftsDone: fopUpdate?.liftsDone || '',
		showTimer: hasActiveSession,
		showWeight: true
	};
	
	// Get athlete entries based on data source
	let athleteEntries = getAthleteEntries(config.dataSource, fopName, fopUpdate);
	
	const records = extractRecordsFromUpdate(fopUpdate);
	
	// Build cache key
	const cacheKey = buildCacheKey({ fopName, includeFop: true, opts: { ...options, type: scoreboardType } });
	
	// Extract current athlete
	let currentAttempt = extractCurrentAttempt(athleteEntries, fopUpdate);
	
	// Compute sessionStatusMessage
	let sessionStatusMessage = null;
	if (sessionStatus.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014');
	}

	// Check cache
	if (scoreboardCache.has(cacheKey)) {
		const cached = scoreboardCache.get(cacheKey);
		return {
			...cached,
			currentAttempt,
			timer,
			breakTimer,
			decision,
			displayMode,
			sessionStatus,
			sessionStatusMessage,
			learningMode
		};
	}

	const stats = getCompetitionStats(databaseState);
	const leaders = extractLeaders(fopUpdate);
	
	// Return waiting status if no athletes
	if (athleteEntries.length === 0) {
		return {
			scoreboardName: config.scoreboardName,
			competition,
			currentAttempt,
			timer,
			breakTimer,
			decision,
			displayMode,
			records,
			sessionStatus,
			sessionStatusMessage,
			sortedAthletes: [],
			liftingOrderAthletes: [],
			startOrderAthletes: [],
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
	
	// Process athletes with flags and normalized arrays
	let athletesWithFlags = processAthletes(athleteEntries);
	
	// Apply sort strategy if needed
	if (config.sortStrategy === 'byRank') {
		athletesWithFlags = sortByRank(athletesWithFlags);
	}

	// Calculate layout
	const hasData = !!(fopUpdate || databaseState);
	const status = hasData ? 'ready' : 'waiting';
	const message = hasData ? null : `Waiting for competition data for platform "${fopName}"...`;
	
	const maxTeamNameLength = Math.max(0, ...athletesWithFlags
		.filter(a => !a.isSpacer)
		.map(a => (a.teamName || '').length)
	);
	const compactTeamColumn = maxTeamNameLength < 7;
	
	const { resultRows, leaderRows, gridTemplateRows } = calculateGridLayout(athletesWithFlags, leaders);

	const result = {
		scoreboardName: config.scoreboardName,
		competition,
		currentAttempt,
		timer,
		breakTimer,
		decision,
		displayMode,
		sessionStatusMessage,
		sortedAthletes: athletesWithFlags,
		liftingOrderAthletes: athletesWithFlags,
		startOrderAthletes: athletesWithFlags,
		rankedAthletes: athletesWithFlags,  // For rankings compatibility
		leaders,
		stats,
		displaySettings: extractDisplaySettings(fopUpdate),
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
	
	// Cache result (excluding volatile fields)
	scoreboardCache.set(cacheKey, {
		scoreboardName: result.scoreboardName,
		competition: result.competition,
		sortedAthletes: result.sortedAthletes,
		liftingOrderAthletes: result.liftingOrderAthletes,
		startOrderAthletes: result.startOrderAthletes,
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
	
	// Cleanup old cache entries
	// Null out large objects before deletion to help V8 GC
	if (scoreboardCache.size > 10) {
		const firstKey = scoreboardCache.keys().next().value;
		const expiredEntry = scoreboardCache.get(firstKey);
		if (expiredEntry) {
			// Null out large arrays to help GC
			if (expiredEntry.resultRows) expiredEntry.resultRows = null;
			if (expiredEntry.leaderRows) expiredEntry.leaderRows = null;
		}
		scoreboardCache.delete(firstKey);
	}

	return {
		...result,
		sessionStatus,
		learningMode
	};
}

/**
 * Get athlete entries based on data source
 */
function getAthleteEntries(dataSource, fopName, fopUpdate) {
	let entries = [];
	
	try {
		if (dataSource === 'liftingOrder') {
			entries = competitionHub.getLiftingOrderEntries(fopName, { includeSpacers: true }) || [];
		} else {
			entries = competitionHub.getStartOrderEntries(fopName, { includeSpacers: true }) || [];
		}
	} catch (err) {
		entries = [];
	}

	// Backwards compatibility fallback
	if ((!Array.isArray(entries) || entries.length === 0) && fopUpdate) {
		let raw;
		if (dataSource === 'liftingOrder') {
			raw = fopUpdate?.liftingOrderAthletes ?? fopUpdate?.liftingOrderKeys ?? [];
		} else {
			raw = fopUpdate?.startOrderAthletes ?? fopUpdate?.startOrderKeys ?? [];
		}
		
		if (typeof raw === 'string') {
			try { raw = JSON.parse(raw); } catch (e) { raw = []; }
		}
		
		if (Array.isArray(raw) && raw.length > 0) {
			entries = raw.map(e => {
				if (!e) return { isSpacer: true };
				if (typeof e === 'object' && (e.isSpacer || e.type === 'spacer')) return { isSpacer: true };
				if (typeof e === 'string' || typeof e === 'number') return { athleteKey: e };
				if (e.athlete || e.athleteKey || e.key) {
					return { 
						athlete: e.athlete || null, 
						athleteKey: e.athleteKey || e.key || null, 
						classname: e.classname || e.className || '',
						...e
					};
				}
				return e;
			});
		}
	}
	
	return entries;
}

/**
 * Extract current attempt from athlete entries
 */
function extractCurrentAttempt(entries, fopUpdate) {
	let currentEntry = entries.find(e => 
		!e.isSpacer && (
			(e.classname && e.classname.includes('current')) || 
			(e.athlete && e.athlete.classname && e.athlete.classname.includes('current'))
		)
	);
	
	if (!currentEntry && Array.isArray(entries)) {
		currentEntry = entries.find(e => 
			e && e.athlete && e.athlete.classname && e.athlete.classname.includes('current')
		) || null;
	}
	
	if (!currentEntry) return null;
	
	const athleteObj = currentEntry.athlete || currentEntry;
	return {
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

/**
 * Process athletes with flags and normalized attempt arrays
 */
function processAthletes(entries) {
	return entries.map(entry => {
		if (!entry || entry.isSpacer) return { isSpacer: true };
		
		const classname = entry.classname || '';
		
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
}

/**
 * Sort athletes by rank (for rankings scoreboard)
 */
function sortByRank(athletes) {
	// Filter out spacers for sorting
	const athletesOnly = athletes.filter(a => !a.isSpacer);
	
	// Determine phase: has C&J started?
	const cjStarted = athletesOnly.some(a => a.bestCleanJerk && a.bestCleanJerk !== '-');
	
	// Sort by category, then by rank
	const sorted = [...athletesOnly].sort((a, b) => {
		const catA = a.category || '';
		const catB = b.category || '';
		if (catA !== catB) {
			return catA.localeCompare(catB);
		}
		
		const rankField = cjStarted ? 'totalRank' : 'snatchRank';
		const rankA = a[rankField] === '-' ? Infinity : parseInt(a[rankField]) || Infinity;
		const rankB = b[rankField] === '-' ? Infinity : parseInt(b[rankField]) || Infinity;
		return rankA - rankB;
	});
	
	// Insert spacers between categories
	const categories = [...new Set(athletesOnly.map(a => a.category).filter(Boolean))];
	if (categories.length > 1) {
		const result = [];
		let lastCategory = '';
		
		sorted.forEach(athlete => {
			if (athlete.category && athlete.category !== lastCategory) {
				result.push({ isSpacer: true });
			}
			result.push({
				...athlete,
				displayRank: cjStarted 
					? (athlete.totalRank !== '-' ? athlete.totalRank : '-')
					: (athlete.snatchRank !== '-' ? athlete.snatchRank : '-')
			});
			lastCategory = athlete.category;
		});
		
		return result;
	}
	
	// Single category - just add displayRank
	return sorted.map(athlete => ({
		...athlete,
		displayRank: cjStarted 
			? (athlete.totalRank !== '-' ? athlete.totalRank : '-')
			: (athlete.snatchRank !== '-' ? athlete.snatchRank : '-')
	}));
}

/**
 * Extract leaders from fopUpdate
 */
function extractLeaders(fopUpdate) {
	if (!fopUpdate?.leaders || !Array.isArray(fopUpdate.leaders)) return [];
	
	return fopUpdate.leaders
		.map(leader => {
			if (!leader) return null;
			if (leader.isSpacer) return { isSpacer: true };
			
			// V2 format
			if (leader.athlete && leader.displayInfo) {
				const flat = {
					...leader.athlete,
					...leader.displayInfo
				};
				flat.athlete = leader.athlete;
				flat.displayInfo = leader.displayInfo;
				flat.athleteKey = leader.athlete?.key ?? leader.athlete?.id ?? flat.athleteKey ?? null;
				flat.flagUrl = flat.teamName ? getFlagUrl(flat.teamName, true) : null;
				
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

/**
 * Extract display settings from fopUpdate
 */
function extractDisplaySettings(fopUpdate) {
	if (!fopUpdate?.showTotalRank && !fopUpdate?.showSinclair) return {};
	
	return {
		showTotalRank: fopUpdate.showTotalRank === 'true',
		showSinclair: fopUpdate.showSinclair === 'true',
		showLiftRanks: fopUpdate.showLiftRanks === 'true',
		showSinclairRank: fopUpdate.showSinclairRank === 'true'
	};
}

/**
 * Calculate grid layout (rows for athletes and leaders)
 * 
 * IMPORTANT: This must count exactly the number of rows rendered by AthletesGrid.svelte:
 * - resultRows: one row per entry in athletes array (including spacers)
 * - leaderRows: 1 (title row) + one row per entry in leaders array (including spacers)
 * 
 * The template structure is:
 *   repeat(resultRows, minmax(10px, auto)) 1fr repeat(leaderRows, minmax(10px, auto))
 * Where the 1fr corresponds to the .leaders-spacer div that pushes leaders to bottom.
 */
function calculateGridLayout(athletes, leaders) {
	// Count all athlete entries (including spacers) - one row per entry
	const resultRows = athletes.length;
	
	// Count leader rows: 1 title row + all leader entries (including spacers)
	let leaderRows = 0;
	if (leaders && leaders.length > 0) {
		leaderRows = 1 + leaders.length;  // Title row + each leader/spacer entry
	}
	
	const gridTemplateRows = leaders && leaders.length > 0
		? `repeat(${resultRows}, minmax(10px, auto)) 1fr repeat(${leaderRows}, minmax(10px, auto))`
		: `repeat(${resultRows}, minmax(10px, auto))`;
	
	return { resultRows, leaderRows, gridTemplateRows };
}

/**
 * Get competition statistics
 */
export function getCompetitionStats(databaseState) {
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

/**
 * Get top athletes from competition state
 */
export function getTopAthletes(competitionState, limit = 10) {
	if (!competitionState?.athletes || !Array.isArray(competitionState.athletes)) {
		return [];
	}

	return competitionState.athletes
		.filter(athlete => athlete && (athlete.total > 0 || athlete.bestSnatch > 0 || athlete.bestCleanJerk > 0))
		.sort((a, b) => {
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
 * Get team rankings from hub
 */
export function getTeamRankings() {
	return competitionHub.getTeamRankings();
}

/**
 * Get athletes by category
 */
export function getAthletesByCategory(weightClass = null, gender = null) {
	const state = competitionHub.getState();
	if (!state?.athletes) return [];

	return state.athletes.filter(athlete => {
		if (weightClass && athlete.category !== weightClass) return false;
		if (gender && athlete.gender !== gender) return false;
		return true;
	});
}

/**
 * Get lifting order from competition state
 */
export function getLiftingOrder() {
	const state = competitionHub.getState();
	return state?.liftingOrder || [];
}
