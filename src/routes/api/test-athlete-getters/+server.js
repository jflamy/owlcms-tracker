/**
 * API endpoint for testing athlete getter methods
 * GET /api/test-athlete-getters?fop=A
 */

import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';

export async function GET({ url }) {
	const fopName = url.searchParams.get('fop') || 'A';

	try {
		// Call the new getter methods
		const currentAthlete = competitionHub.getCurrentAthlete(fopName);
		const nextAthlete = competitionHub.getNextAthlete(fopName);
		const previousAthlete = competitionHub.getPreviousAthlete(fopName);

		return json({
			success: true,
			fop: fopName,
			currentAthlete,
			nextAthlete,
			previousAthlete,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('[API] Error testing athlete getters:', error);
		return json(
			{
				success: false,
				error: error.message
			},
			{ status: 500 }
		);
	}
}
