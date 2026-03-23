import { competitionHub } from '$lib/server/competition-hub.js';
import { logger, requestResources } from '@owlcms/tracker-core';

/**
 * Requests a fresh database from OWLCMS and waits for it to load.
 * Robust implementation that retries requests if the connection is erratic
 * or if the response is lost (e.g. during authentication race conditions).
 * 
 * @param {number} timeoutMs - Max time to wait (default 5000ms)
 * @returns {Promise<boolean>} true if database updated, false if timed out
 */
export async function refreshDatabaseForDocuments(timeoutMs = 5000) {
	const startTime = Date.now();
	// Capture baseline before we start - we want a load NEWER than this
	const baselineLoad = competitionHub.lastDatabaseLoad || 0;

	// Check if a load happened since we started (unlikely, but possible)
	const hasAdvancedLoad = () => (competitionHub.lastDatabaseLoad || 0) > baselineLoad;

	let attempt = 1;

	// Helper to wait for the database update
	const waitForUpdate = (waitTime) => {
		return new Promise(resolve => {
			if (hasAdvancedLoad()) return resolve(true);

			let settled = false;
			let checkInterval = null;
			let timeout = null;

			const finish = (value) => {
				if (settled) return;
				settled = true;
				if (checkInterval) clearInterval(checkInterval);
				if (timeout) clearTimeout(timeout);
				resolve(value);
			};

			checkInterval = setInterval(() => {
				if (hasAdvancedLoad()) finish(true);
			}, 100);

			timeout = setTimeout(() => finish(false), waitTime);
		});
	};

	logger.debug('[Documents] Requesting fresh database from OWLCMS...');

	while (Date.now() - startTime < timeoutMs) {
		const sent = requestResources(['database']);

		if (sent) {
			const waitTime = Math.min(2000, timeoutMs - (Date.now() - startTime));
			const success = await waitForUpdate(waitTime);

			if (success) {
				logger.debug(`[Documents] Database refreshed (attempt ${attempt})`);
				return true;
			}
		}

		if (Date.now() - startTime < timeoutMs) {
			await new Promise(r => setTimeout(r, 500));
		}
		attempt++;
	}

	logger.warn(`[Documents] Timed out after ${timeoutMs}ms waiting for refreshed database; continuing with cached state`);
	return false;
}