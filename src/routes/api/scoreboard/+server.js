/**
 * Unified Scoreboard API Endpoint
 * 
 * Handles all scoreboard types with FOP and option parameters
 * 
 * URL: /api/scoreboard?type=lifting-order&fop=Platform_A&showRecords=true
 */

import { json } from '@sveltejs/kit';
import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';

export async function GET({ url }) {
	const requestId = Math.random().toString(36).substr(2, 9);
	const startTime = Date.now();
	
	try {
		console.log(`[API /api/scoreboard] 🔄 Request ${requestId} starting`);
		
		// Initialize registry on first call
		await scoreboardRegistry.initialize();
		console.log(`[API /api/scoreboard] ✅ Request ${requestId} registry initialized`);
		
		// Extract parameters
		const type = url.searchParams.get('type') || 'lifting-order';
		const fopName = url.searchParams.get('fop');
		
		// If no FOP specified, return error
		if (!fopName) {
			return json({
				success: false,
				error: 'missing_fop',
				message: 'FOP name is required. Example: ?type=lifting-order&fop=Platform_A'
			}, { status: 400 });
		}
		
		// Extract all other parameters as options
		const options = {};
		for (const [key, value] of url.searchParams.entries()) {
			if (key !== 'type' && key !== 'fop') {
				// Try to parse as boolean/number
				if (value === 'true') options[key] = true;
				else if (value === 'false') options[key] = false;
				else if (!isNaN(value) && value !== '') options[key] = parseFloat(value);
				else options[key] = value;
			}
		}
		
		console.log(`[API /api/scoreboard] 📊 Request ${requestId} Processing: type=${type}, fop=${fopName}, options=`, options);
		
		// Process data using the scoreboard's helper
		const dataStartTime = Date.now();
		const data = await scoreboardRegistry.processData(type, fopName, options);
		const dataElapsed = Date.now() - dataStartTime;
		console.log(`[API /api/scoreboard] ✅ Request ${requestId} data processing complete (${dataElapsed}ms)`);
		
		const totalElapsed = Date.now() - startTime;
		console.log(`[API /api/scoreboard] ✅ Request ${requestId} completed in ${totalElapsed}ms`);
		
		return json({
			success: true,
			type,
			fop: fopName,
			options,
			data,
			timestamp: Date.now()
		});
		
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error(`[API /api/scoreboard] ❌ Request ${requestId} failed after ${elapsed}ms:`, error.message);
		console.error('[API /api/scoreboard] Stack:', error.stack);
		return json({
			success: false,
			error: error.message,
			timestamp: Date.now()
		}, { status: 500 });
	}
}

/**
 * Get list of available scoreboards and FOPs
 */
export async function POST({ request }) {
	try {
		await scoreboardRegistry.initialize();
		
		const body = await request.json();
		const action = body.action;
		
		if (action === 'list_scoreboards') {
			const scoreboards = scoreboardRegistry.getAllScoreboards();
			return json({
				success: true,
				scoreboards: scoreboards.map(s => ({
					type: s.type,
					name: s.config.name,
					description: s.config.description,
					options: s.config.options
				}))
			});
		}
		
		if (action === 'list_fops') {
			// Get available FOPs from competition hub
			const { competitionHub } = await import('$lib/server/competition-hub.js');
			const fops = competitionHub.getAvailableFOPs();
			
			return json({
				success: true,
				fops
			});
		}
		
		return json({
			success: false,
			error: 'unknown_action',
			message: 'Valid actions: list_scoreboards, list_fops'
		}, { status: 400 });
		
	} catch (error) {
		console.error('[API /api/scoreboard POST] Error:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}
