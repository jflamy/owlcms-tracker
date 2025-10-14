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
