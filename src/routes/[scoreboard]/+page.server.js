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
	const requestId = Math.random().toString(36).substr(2, 9);
	const startTime = Date.now();
	
	try {
		console.log(`[Scoreboard Route] 🔄 Request ${requestId} starting: ${params.scoreboard}?fop=${url.searchParams.get('fop')}`);
		
		// Initialize registry
		await scoreboardRegistry.initialize();
		console.log(`[Scoreboard Route] ✅ Request ${requestId} registry initialized`);
		
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
		
		// Extract FOP from query string
		const fopName = url.searchParams.get('fop');
		if (!fopName) {
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
		
		console.log(`[Scoreboard Route] 📊 Request ${requestId} Loading: type=${type}, fop=${fopName}, options=`, options);
		
		const elapsed = Date.now() - startTime;
		console.log(`[Scoreboard Route] ✅ Request ${requestId} completed in ${elapsed}ms`);
		
		// Return metadata for the page
		return {
			scoreboardType: type,
			scoreboardName: scoreboard.config.name,
			scoreboardDescription: scoreboard.config.description,
			fopName,
			options,
			config: scoreboard.config
		};
		
	} catch (err) {
		const elapsed = Date.now() - startTime;
		console.error(`[Scoreboard Route] ❌ Request ${requestId} failed after ${elapsed}ms:`, err);
		if (err.status) throw err;
		throw error(500, { message: err.message });
	}
}
