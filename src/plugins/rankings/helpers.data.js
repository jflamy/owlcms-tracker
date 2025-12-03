/**
 * Rankings Scoreboard - Server-side helpers
 * 
 * Uses shared standard scoreboard implementation with 'startOrder' data source
 * and 'byRank' sort strategy (re-sorted by totalRank or snatchRank)
 */

import { 
	getScoreboardData as getSharedScoreboardData,
	getDatabaseState,
	getFopUpdate,
	getTopAthletes,
	getTeamRankings,
	getAthletesByCategory,
	getLiftingOrder,
	getCompetitionStats
} from '$lib/server/standard-scoreboard-helpers.js';

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses startOrderAthletes, re-sorted by totalRank (or snatchRank if C&J not started)
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	return getSharedScoreboardData('rankings', fopName, options);
}

// Re-export shared functions for backwards compatibility
export { getDatabaseState, getFopUpdate, getTopAthletes, getTeamRankings, getAthletesByCategory, getLiftingOrder, getCompetitionStats };
