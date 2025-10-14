import { getScoreboardData } from './helpers.data.js';

/**
 * Server-side load function for the scoreboard plugin
 * This runs on the server and provides initial data to the page
 */
export async function load() {
	try {
		// Get the current scoreboard data from server-side helpers
		const scoreboardData = getScoreboardData();
		
		console.log('[Scoreboard +page.server.js] Loading scoreboard data...');
		console.log('[Scoreboard +page.server.js] Status:', scoreboardData.status);
		console.log('[Scoreboard +page.server.js] Competition:', scoreboardData.competition);
		console.log('[Scoreboard +page.server.js] Current Athlete:', scoreboardData.currentAthlete);
		console.log('[Scoreboard +page.server.js] Lifting Order Athletes:', scoreboardData.liftingOrderAthletes?.length || 0);
		
		return {
			scoreboardData,
			serverTime: Date.now()
		};
	} catch (error) {
		console.error('[Scoreboard] Error loading data:', error);
		
		// Return empty state on error
		return {
			scoreboardData: {
				competition: { name: 'Error Loading Data', fop: 'unknown' },
				currentAthlete: null,
				timer: { state: 'stopped', timeRemaining: 0 },
				decision: { visible: false, isSingleReferee: false },
				liftingOrderAthletes: [],
				rankings: [],
				stats: { totalAthletes: 0, activeAthletes: 0, completedAthletes: 0, categories: [], teams: [] },
				status: 'error'
			},
			serverTime: Date.now()
		};
	}
}