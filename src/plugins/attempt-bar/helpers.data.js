/**
 * Server-side scoreboard helpers for Attempt Bar
 * Simplified version that just provides the current attempt bar data
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { buildCacheKey, registerCache } from '$lib/server/cache-utils.js';
import { extractTimerAndDecisionState } from '$lib/server/timer-decision-helpers.js';
import { computeAttemptBarVisibility } from '$lib/server/attempt-bar-visibility.js';

/**
 * Plugin-specific cache
 */
const attemptBarCache = new Map();
registerCache(attemptBarCache);

/**
 * Get the full database state (raw athlete data) - SERVER-SIDE ONLY
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * Provides just the data needed for CurrentAttemptBar component
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	
	// Get learning mode from environment
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	// Extract timer, breakTimer, decision, and displayMode using shared helpers
	const { timer, breakTimer, decision, displayMode } = extractTimerAndDecisionState(fopUpdate, fopName);
	
	if (!fopUpdate && !databaseState) {
		return {
			scoreboardName: 'Attempt Bar',
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAttempt: null,
			timer,
			breakTimer,
			decision,
			displayMode,
			sessionStatus: { isDone: false },
			status: 'waiting',
			message: 'Waiting for competition data...',
			learningMode
		};
	}

	// Get session status
	const sessionStatus = competitionHub.getSessionStatus(fopName);

	// Extract basic competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.sessionName || 'A',
		sessionInfo: (fopUpdate?.sessionInfo || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—'),
		liftsDone: fopUpdate?.liftsDone || ''
	};

	// Get precomputed athletes from UPDATE message
	const athletes = fopUpdate?.athletes || [];
	
	// Extract current athlete from athletes
	let currentAttempt = null;
	const currentAthlete = athletes.find(a => a.classname && a.classname.includes('current'));
	if (currentAthlete) {
		currentAttempt = {
			fullName: currentAthlete.fullName,
			name: currentAthlete.fullName,
			teamName: currentAthlete.teamName,
			team: currentAthlete.teamName,
			flagUrl: getFlagUrl(currentAthlete.teamName, true),
			startNumber: currentAthlete.startNumber,
			categoryName: currentAthlete.category,
			category: currentAthlete.category,
			attempt: fopUpdate?.attempt || '',
			attemptNumber: fopUpdate?.attemptNumber,
			weight: fopUpdate?.weight || '-',
			timeAllowed: fopUpdate?.timeAllowed,
			startTime: null
		};
	}
	
	// Compute sessionStatusMessage
	let sessionStatusMessage = null;
	if (sessionStatus.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
	}

	// Determine status
	const hasData = !!(fopUpdate || databaseState);
	const status = hasData ? 'ready' : 'waiting';
	const message = hasData ? null : `⏳ Waiting for competition data for platform "${fopName}"...`;
	
	// Compute attempt bar visibility based on session state
	const attemptBarClass = computeAttemptBarVisibility(fopUpdate);

	return {
		scoreboardName: 'Attempt Bar',
		competition,
		currentAttempt,
		timer,
		breakTimer,
		decision,
		displayMode,
		sessionStatus,
		sessionStatusMessage,
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		status,
		message,
		attemptBarClass,
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		learningMode
	};
}

/**
 * Get competition metrics and statistics
 */
export function getCompetitionStats(competitionState = null) {
	if (!competitionState) {
		competitionState = getDatabaseState();
	}
	
	if (!competitionState?.athletes) {
		return {
			totalAthletes: 0,
			activeAthletes: 0,
			completedAthletes: 0,
			categories: [],
			teams: []
		};
	}

	const athletes = competitionState.athletes;
	const categories = [...new Set(athletes.map(a => a.categoryName || a.category).filter(Boolean))];
	const teams = [...new Set(athletes.map(a => a.teamName || a.team).filter(Boolean))];

	return {
		totalAthletes: athletes.length,
		activeAthletes: athletes.filter(a => a.total > 0 || a.bestSnatch > 0 || a.bestCleanJerk > 0).length,
		completedAthletes: athletes.filter(a => a.total > 0).length,
		categories,
		teams,
		averageTotal: athletes.filter(a => a.total > 0).reduce((sum, a, _, arr) => sum + a.total / arr.length, 0) || 0
	};
}
