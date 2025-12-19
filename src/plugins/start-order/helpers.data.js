/**
 * Session Results Scoreboard - Server-side helpers
 * 
 * Uses shared standard scoreboard implementation with 'startOrder' data source
 * Athletes are sorted by standard order (category, lot number)
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
import { getCompetitionState } from './helpers.js';

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses startOrderAthletes from UPDATE message (standard order: category, lot number)
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	return getSharedScoreboardData('session-results', fopName, options);
}

// Re-export shared functions for backwards compatibility
export { getDatabaseState, getFopUpdate, getTopAthletes, getTeamRankings, getAthletesByCategory, getLiftingOrder, getCompetitionStats };
