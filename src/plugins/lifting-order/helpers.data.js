/**
 * Lifting Order Scoreboard - Server-side helpers
 * 
 * Uses shared standard scoreboard implementation with 'liftingOrder' data source
 * Athletes are sorted by lifting order (next lifter first)
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
 * Uses liftingOrderAthletes from UPDATE message (lifting order: next lifter first)
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	return getSharedScoreboardData('lifting-order', fopName, options);
}

// Re-export shared functions for backwards compatibility
export { getDatabaseState, getFopUpdate, getTopAthletes, getTeamRankings, getAthletesByCategory, getLiftingOrder, getCompetitionStats };
