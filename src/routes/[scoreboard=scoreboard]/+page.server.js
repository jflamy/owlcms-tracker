/**
 * Dynamic Scoreboard Route
 * 
 * Handles URLs like:
 * /lifting-order?fop=Platform_A&showRecords=true
 * /results?fop=Platform_B&sortBy=sinclair
 * /team-rankings?fop=Platform_C&showTop=5
 */

import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';
import { error } from '@sveltejs/kit';

export async function load({ params, url }) {
	try {
		// Initialize registry
		await scoreboardRegistry.initialize();
		
		// Get scoreboard type from route param (e.g., "lifting-order")
		const type = params.scoreboard;
		
		// Check if scoreboard exists
		const scoreboard = scoreboardRegistry.getScoreboard(type);
		if (!scoreboard) {
			throw error(404, {
				message: `Scoreboard type "${type}" not found`,
				available: scoreboardRegistry.getAllScoreboards().map(s => s.type)
			});
		}
		
		// Check if FOP is required for this scoreboard type
		const fopRequired = scoreboard.config?.fopRequired !== false; // Default to required if not specified
		
		// Extract FOP from query string
		const fopName = url.searchParams.get('fop');
		if (!fopName && fopRequired) {
			throw error(400, {
				message: 'FOP parameter is required',
				example: `/${type}?fop=Platform_A`
			});
		}
		
		// Extract all other parameters as options
		const options = {};
		for (const [key, value] of url.searchParams.entries()) {
			if (key !== 'fop') {
				// Parse boolean/number values
				if (value === 'true') options[key] = true;
				else if (value === 'false') options[key] = false;
				else if (!isNaN(value) && value !== '') options[key] = parseFloat(value);
				else options[key] = value;
			}
		}
		
		// Return metadata for the page
		return {
			scoreboardType: type,
			pluginPath: scoreboard.pluginPath || scoreboard.folderName,  // For component loading
			scoreboardName: scoreboard.config.name,
			scoreboardDescription: scoreboard.config.description,
			fopName,
			options,
			config: scoreboard.config
		};
		
	} catch (err) {
		console.error('[Scoreboard Route] Error:', err);
		if (err.status) throw err;
		throw error(500, { message: err.message });
	}
}
