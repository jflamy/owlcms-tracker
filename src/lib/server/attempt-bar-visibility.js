/**
 * Attempt Bar Visibility Logic - Shared across all scoreboards
 * 
 * Determines whether to show/hide the attempt bar based on:
 * - Session status (INACTIVE vs active)
 * - Current athlete presence (currentAthleteKey)
 * - Session completion status (isDone)
 */

/**
 * Compute attempt bar visibility class
 * 
 * Hide the attempt bar when:
 * - FOP is INACTIVE (no session selected) AND
 * - No current athlete key is present (confirming null session)
 * 
 * Show the attempt bar in all other cases:
 * - Active session with current athlete
 * - Active session without current athlete (between attempts)
 * - Active session when session is done
 * - INACTIVE but currentAthleteKey present (edge case - should transition to active)
 * 
 * @param {Object} fopUpdate - Latest UPDATE message from OWLCMS hub
 * @returns {string} CSS class name: '' (visible) or 'hide-because-null-session' (hidden)
 */
export function computeAttemptBarVisibility(fopUpdate) {
	const platformState = fopUpdate?.fopState || 'INACTIVE';
	const hasCurrentAthleteKey = Boolean(fopUpdate?.currentAthleteKey);
	const hasActiveSession = platformState !== 'INACTIVE';
	
	// Hide only when BOTH conditions are true: INACTIVE AND no currentAthleteKey
	if (!hasActiveSession && !hasCurrentAthleteKey) {
		return 'hide-because-null-session';
	}
	
	return ''; // Show attempt bar
}

/**
 * Determine if there's a current athlete actively lifting
 * 
 * A current athlete is present when:
 * - fullName is set in fopUpdate
 * - FOP state is not INACTIVE (session is active)
 * - Session is not marked as done
 * 
 * @param {Object} fopUpdate - Latest UPDATE message from OWLCMS hub
 * @param {Object} sessionStatus - Session status object with isDone flag
 * @returns {boolean} true if there's a current athlete lifting
 */
export function hasCurrentAthlete(fopUpdate, sessionStatus) {
	const platformState = fopUpdate?.fopState || 'INACTIVE';
	return Boolean(
		fopUpdate?.fullName && 
		platformState !== 'INACTIVE' && 
		!sessionStatus?.isDone
	);
}

/**
 * Debug logging helper
 * 
 * @param {Object} fopUpdate - Latest UPDATE message from OWLCMS hub
 * @param {Object} sessionStatus - Session status object
 * @param {string} context - Optional context label (e.g., 'Team helpers', 'Lifting order')
 */
export function logAttemptBarDebug(fopUpdate, sessionStatus, context = 'Scoreboard') {
	const platformState = fopUpdate?.fopState || 'INACTIVE';
	const hasCurrentAthleteKey = Boolean(fopUpdate?.currentAthleteKey);
	const hasActiveSession = platformState !== 'INACTIVE';
	const visibilityClass = computeAttemptBarVisibility(fopUpdate);
	const hasCurrent = hasCurrentAthlete(fopUpdate, sessionStatus);
	
	console.log(
		`[${context}] Attempt bar visibility: ` +
		`fopState=${platformState}, ` +
		`hasCurrentAthleteKey=${hasCurrentAthleteKey}, ` +
		`hasActiveSession=${hasActiveSession}, ` +
		`hasCurrent=${hasCurrent}, ` +
		`class=${visibilityClass || 'visible'}`
	);
}
