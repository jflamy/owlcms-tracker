/**
 * Server-side scoreboard helpers for Attempt Bar
 * 
 * Attempt Bar is a "castrated scoreboard" - uses standard scoreboard helpers
 * and returns a subset of the data.
 */

import { getScoreboardData as getStandardScoreboardData, getDatabaseState, getFopUpdate } from '$lib/server/standard-scoreboard-helpers.js';
import { computeAttemptBarVisibility } from '$lib/server/attempt-bar-visibility.js';

// Re-export for any consumers that need them
export { getDatabaseState, getFopUpdate };

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Uses standard scoreboard helpers with 'attempt-bar' config
 * Returns only the subset needed for CurrentAttemptBar component
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	// Use standard scoreboard helpers with attempt-bar config
	const scoreboardData = getStandardScoreboardData('attempt-bar', fopName, options);

	// Add attempt-bar specific visibility class
	const fopUpdate = getFopUpdate(fopName);
	const attemptBarClass = computeAttemptBarVisibility(fopUpdate);

	// Return subset of data needed by attempt bar
	return {
		scoreboardName: 'Attempt Bar',
		competition: scoreboardData.competition,
		currentAttempt: scoreboardData.currentAttempt,
		timer: scoreboardData.timer,
		breakTimer: scoreboardData.breakTimer,
		decision: scoreboardData.decision,
		displayMode: scoreboardData.displayMode,
		sessionStatus: scoreboardData.sessionStatus,
		sessionStatusMessage: scoreboardData.sessionStatusMessage,
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		status: scoreboardData.status,
		message: scoreboardData.message,
		attemptBarClass,
		lastUpdate: scoreboardData.lastUpdate,
		learningMode: scoreboardData.learningMode
	};
}

