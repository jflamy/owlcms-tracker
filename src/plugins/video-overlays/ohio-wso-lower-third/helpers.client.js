// Client-side helper functions (runs in browser)

/**
 * Format time in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get CSS class for decision light
 * @param {string} decision - 'good', 'bad', or null
 * @returns {string} CSS class name
 */
export function getDecisionClass(decision) {
	if (decision === 'good') return 'decision-good';
	if (decision === 'bad') return 'decision-bad';
	return 'decision-none';
}

/**
 * Get CSS class for attempt cell status
 * @param {string} status - 'good', 'bad', 'request', 'current', 'next', or 'empty'
 * @returns {string} CSS class name
 */
export function getAttemptClass(status) {
	const normalized = String(status || '').toLowerCase();
	if (normalized === 'good') return 'attempt-good';
	if (normalized === 'bad') return 'attempt-bad';
	if (normalized === 'request' || normalized === 'current' || normalized === 'next') return 'attempt-request';
	return 'attempt-empty';
}
