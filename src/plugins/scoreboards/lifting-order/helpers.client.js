/**
 * Client-side scoreboard helpers - these run in the browser and handle formatting/display only
 * All data access happens server-side and gets passed to these functions
 */

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
 * @param {Object} data - Scoreboard data from server
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

/**
 * Format weight for display
 * @param {number} weight - Weight in kg
 * @returns {string} Formatted weight string
 */
export function formatWeight(weight) {
	if (!weight || weight <= 0) return '--';
	return `${weight} kg`;
}

/**
 * Format athlete rank for display
 * @param {number} rank - Athlete rank
 * @returns {string} Formatted rank string
 */
export function formatRank(rank) {
	if (!rank || rank <= 0) return '--';
	return `#${rank}`;
}

/**
 * Get attempt status icon
 * @param {string} result - Attempt result ("good", "no", null)
 * @returns {string} Status icon
 */
export function getAttemptIcon(result) {
	switch (result) {
		case 'good': return '✅';
		case 'no': return '❌';
		default: return '⏸️';
	}
}

/**
 * Calculate good lifts count for an athlete
 * @param {Object} athlete - Athlete object
 * @returns {number} Number of successful lifts
 */
export function countGoodLifts(athlete) {
	if (!athlete) return 0;
	
	let count = 0;
	if (athlete.snatch1Result === 'good') count++;
	if (athlete.snatch2Result === 'good') count++;
	if (athlete.snatch3Result === 'good') count++;
	if (athlete.cleanJerk1Result === 'good') count++;
	if (athlete.cleanJerk2Result === 'good') count++;
	if (athlete.cleanJerk3Result === 'good') count++;
	return count;
}