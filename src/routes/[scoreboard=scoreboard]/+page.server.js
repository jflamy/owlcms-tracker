/**
 * Dynamic Scoreboard Route
 * 
 * Handles URLs like:
 * /lifting-order?fop=Platform_A&showRecords=true
 * /results?fop=Platform_B&sortBy=sinclair
 * /team-rankings?fop=Platform_C&showTop=5
 */

import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';
import { competitionHub } from '$lib/server/competition-hub.js';
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
		
		// Extract FOP from query string, or auto-select if only one FOP exists
		let fopName = url.searchParams.get('fop');
		if (!fopName && fopRequired) {
			// Try to auto-select if only one FOP is available
			const availableFOPs = competitionHub.getAvailableFOPs();
			if (availableFOPs.length === 1) {
				fopName = availableFOPs[0];
				console.log(`[Scoreboard Route] Auto-selected single FOP: ${fopName}`);
			} else if (availableFOPs.length > 1) {
				throw error(400, {
					message: 'FOP parameter is required (multiple FOPs available)',
					example: `/${type}?fop=Platform_A`,
					availableFOPs
				});
			} else {
				throw error(400, {
					message: 'FOP parameter is required (no FOPs available yet - waiting for OWLCMS connection)',
					example: `/${type}?fop=Platform_A`
				});
			}
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
		
		// Get live data from plugin helpers (includes current config with overrides)
		let liveData = null;
		if (scoreboard.dataHelper) {
			try {
				liveData = await scoreboard.dataHelper(fopName, options);
			} catch (err) {
				console.warn(`[Scoreboard Route] Failed to get live data for ${type}:`, err.message);
			}
		}
		
		// Return metadata for the page
		// For plugins with category=documents or customSSE=true, include full liveData
		// since they use server load data directly (skipRouteSSE=true in +page.svelte)
		const returnData = {
			scoreboardType: type,
			pluginPath: scoreboard.pluginPath || scoreboard.folderName,  // For component loading
			scoreboardName: scoreboard.config.name,
			scoreboardDescription: scoreboard.config.description,
			fopName,
			options,
			config: scoreboard.config,  // Static config with defaults
			liveConfig: liveData?.config,  // Current config with overrides (if available)
			...(liveData || {})  // Include all data for skipRouteSSE plugins
		};
		return returnData;
		
	} catch (err) {
		console.error('[Scoreboard Route] Error:', err);
		if (err.status) throw err;
		throw error(500, { message: err.message });
	}
}
