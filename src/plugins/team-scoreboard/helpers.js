/**
 * Scoreboard helpers - process OWLCMS update data for display
 * These helpers can read directly from the competition hub state for convenience
 */

import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Get the full competition state directly from the hub
 * @returns {Object|null} Current competition state
 */
export function getCompetitionState() {
	return competitionHub.getState();
}

/**
 * Parse the latest competition state from OWLCMS update message
 * @param {Object} competitionState - State from competition hub
 * @returns {Object} Formatted data for scoreboard display
 */
export function formatScoreboardData(competitionState) {
	// If no state provided, get it directly from the hub
	if (!competitionState) {
		competitionState = getCompetitionState();
	}

	if (!competitionState) {
		return {
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			rankings: [],
			status: 'waiting'
		};
	}

	// Extract basic competition info
	const competition = {
		name: competitionState.competition?.name || 'Competition',
		fop: competitionState.competition?.fop || 'A',
		state: competitionState.competition?.state || 'INACTIVE',
		session: competitionState.competition?.currentSession || competitionState.competition?.sessionName || 'A',
		date: competitionState.competition?.date || new Date().toISOString().split('T')[0]
	};

	// Extract current athlete info (multiple possible sources)
	let currentAthlete = null;
	if (competitionState.currentAttempt) {
		currentAthlete = {
			name: competitionState.currentAttempt.athleteName || competitionState.currentAttempt.fullName,
			team: competitionState.currentAttempt.teamName,
			startNumber: competitionState.currentAttempt.startNumber,
			category: competitionState.currentAttempt.categoryName,
			attempt: competitionState.currentAttempt.attempt,
			attemptNumber: competitionState.currentAttempt.attemptNumber,
			weight: competitionState.currentAttempt.weight,
			timeAllowed: competitionState.currentAttempt.timeAllowed
		};
	} else if (competitionState.fullName) {
		// Fallback to direct fields from OWLCMS update
		currentAthlete = {
			name: competitionState.fullName,
			team: competitionState.teamName,
			startNumber: competitionState.startNumber,
			category: competitionState.categoryName,
			attempt: competitionState.attempt,
			attemptNumber: competitionState.attemptNumber,
			weight: competitionState.weight,
			timeAllowed: competitionState.timeAllowed
		};
	}

	// Extract timer info
	const timer = {
		state: competitionState.timer?.state || (competitionState.timerRunning === 'true' ? 'running' : 'stopped'),
		timeRemaining: competitionState.timer?.timeRemaining || competitionState.timeRemaining || 0,
		duration: competitionState.timer?.duration || competitionState.timeAllowed || 60000,
		startTime: competitionState.timer?.startTime
	};

	// Get top athletes for leaderboard
	const rankings = getTopAthletes(competitionState, 10);

	return {
		competition,
		currentAthlete,
		timer,
		rankings,
		displaySettings: competitionState.displaySettings || {},
		sessionInfo: competitionState.sessionInfo || {},
		groups: competitionState.groups || [],
		categories: competitionState.categories || [],
		records: competitionState.records || null,
		isBreak: competitionState.isBreak || false,
		breakType: competitionState.breakType,
		ceremonyType: competitionState.ceremonyType,
		status: competitionState ? 'ready' : 'waiting',
		lastUpdate: competitionState.lastUpdate || Date.now()
	};
}

/**
 * Get top athletes from the competition state
 * @param {Object} competitionState - Full competition state
 * @param {number} limit - Number of athletes to return
 * @returns {Array} Top athletes sorted by total
 */
export function getTopAthletes(competitionState, limit = 10) {
	if (!competitionState?.athletes || !Array.isArray(competitionState.athletes)) {
		return [];
	}

	return competitionState.athletes
		.filter(athlete => athlete && (athlete.total > 0 || athlete.bestSnatch > 0 || athlete.bestCleanJerk > 0))
		.sort((a, b) => {
			// Sort by total first, then by Sinclair, then by best snatch
			const totalA = a.total || 0;
			const totalB = b.total || 0;
			if (totalA !== totalB) return totalB - totalA;
			
			const sinclairA = a.sinclair || 0;
			const sinclairB = b.sinclair || 0;
			if (sinclairA !== sinclairB) return sinclairB - sinclairA;
			
			const snatchA = a.bestSnatch || 0;
			const snatchB = b.bestSnatch || 0;
			return snatchB - snatchA;
		})
		.slice(0, limit);
}

/**
 * Format time remaining for display
 * @param {number} milliseconds - Time remaining in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTimeRemaining(milliseconds) {
	if (!milliseconds || milliseconds <= 0) return '--';
	
	const seconds = Math.ceil(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	
	if (minutes > 0) {
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	} else {
		return `${remainingSeconds}s`;
	}
}

/**
 * Get status color based on timer state and time remaining
 * @param {Object} timer - Timer state object
 * @returns {string} CSS color class
 */
export function getTimerStatusColor(timer) {
	if (timer.state !== 'running') return 'text-gray-500';
	
	const timeRemaining = timer.timeRemaining || 0;
	if (timeRemaining <= 30000) return 'text-red-600'; // 30 seconds warning
	if (timeRemaining <= 60000) return 'text-yellow-600'; // 1 minute warning
	return 'text-green-600';
}

/**
 * Get team rankings computed from the hub
 * @returns {Array} Team rankings with scores
 */
export function getTeamRankings() {
	return competitionHub.getTeamRankings();
}

/**
 * Get athletes by weight class
 * @param {string} weightClass - Weight class to filter by (e.g., "73kg")
 * @param {string} gender - Gender to filter by ("M" or "F")
 * @returns {Array} Athletes in the specified category
 */
export function getAthletesByCategory(weightClass = null, gender = null) {
	const state = getCompetitionState();
	if (!state?.athletes) return [];

	return state.athletes.filter(athlete => {
		if (weightClass && athlete.weightClass !== weightClass) return false;
		if (gender && athlete.gender !== gender) return false;
		return true;
	});
}

/**
 * Get lifting order from the competition state
 * @returns {Array} Current lifting order
 */
export function getLiftingOrder() {
	const state = getCompetitionState();
	return state?.liftingOrder || [];
}

/**
 * Get competition metrics and statistics
 * @returns {Object} Competition statistics
 */
export function getCompetitionStats() {
	const state = getCompetitionState();
	if (!state?.athletes) {
		return {
			totalAthletes: 0,
			activeAthletes: 0,
			completedAthletes: 0,
			categories: [],
			teams: []
		};
	}

	const athletes = state.athletes;
	const categories = [...new Set(athletes.map(a => a.categoryName || a.weightClass).filter(Boolean))];
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

/**
 * Get records information
 * @returns {Object|null} Records data if available
 */
export function getRecords() {
	const state = getCompetitionState();
	return state?.records || null;
}

/**
 * Format time remaining for display
 * @param {number} milliseconds - Time remaining in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTimeRemaining(milliseconds) {
	if (!milliseconds || milliseconds <= 0) return '--';
	
	const seconds = Math.ceil(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	
	if (minutes > 0) {
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	} else {
		return `${remainingSeconds}s`;
	}
}

/**
 * Get status color based on timer state and time remaining
 * @param {Object} timer - Timer state object
 * @returns {string} CSS color class
 */
export function getTimerStatusColor(timer) {
	if (timer.state !== 'running') return 'text-gray-500';
	
	const timeRemaining = timer.timeRemaining || 0;
	if (timeRemaining <= 30000) return 'text-red-600'; // 30 seconds warning
	if (timeRemaining <= 60000) return 'text-yellow-600'; // 1 minute warning
	return 'text-green-600';
}

/**
 * Get competition status message
 * @param {Object} data - Formatted scoreboard data
 * @returns {string} Status message for display
 */
export function getCompetitionStatus(data) {
	if (data.status === 'waiting') {
		return 'Waiting for competition data...';
	}
	
	if (data.isBreak) {
		return `Break: ${data.breakType || 'Unknown'}`;
	}
	
	if (data.ceremonyType) {
		return `Ceremony: ${data.ceremonyType}`;
	}
	
	if (data.competition.state === 'INACTIVE') {
		return 'Competition inactive';
	}
	
	if (data.currentAthlete) {
		return `${data.currentAthlete.name} - ${data.currentAthlete.attempt}`;
	}
	
	return 'Competition in progress';
}