import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';
import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Landing page - discovers available scoreboards and FOPs
 */
export async function load() {
	// Initialize registry if needed
	await scoreboardRegistry.initialize();
	
	// Get available scoreboards
	const allScoreboards = scoreboardRegistry.getAllScoreboards();
	const scoreboards = allScoreboards.map(sb => ({
		type: sb.type,
		name: sb.config.name,
		description: sb.config.description,
		options: sb.config.options || []
	}));
	
	// Get available FOPs from competition data
	const availableFOPs = competitionHub.getAvailableFOPs();
	
	// Get competition info
	const databaseState = competitionHub.getDatabaseState();
	const competitionName = databaseState?.competition?.name || 'OWLCMS Competition';
	
	return {
		scoreboards,
		fops: availableFOPs,
		competitionName,
		hasData: availableFOPs.length > 0
	};
}
