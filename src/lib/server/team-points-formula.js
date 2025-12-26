/**
 * Shared team points calculation formula
 * Used by both team-scoreboard and iwf-results plugins
 * 
 * Formula: 1st place = tp1, 2nd place = tp2, 3rd place = tp3
 *          4th place = tp3-1, 5th place = tp3-2, etc. down to 0
 * 
 * IMPORTANT: Athletes must:
 * - Be team members (teamMember === true)
 * - Have a valid result (liftValue > 0) to earn points
 * Athletes who bomb out (0 kg) or are not team members do not earn points.
 * 
 * @param {number} rank - The athlete's rank (1-based)
 * @param {number} liftValue - The actual weight lifted in kg (must be > 0 to earn points)
 * @param {boolean} teamMember - Whether athlete is a team member (must be true to earn points)
 * @param {number} tp1 - Points for 1st place (default 28)
 * @param {number} tp2 - Points for 2nd place (default 25)
 * @param {number} tp3 - Points for 3rd place (default 23)
 * @returns {number} Points earned for this rank
 */
export function calculateTeamPoints(rank, liftValue, teamMember, tp1 = 28, tp2 = 25, tp3 = 23) {
	// Must have valid rank AND valid lift result AND be a team member
	if (!rank || rank <= 0) return 0;
	if (!liftValue || liftValue <= 0) return 0; // Bombed out = no points
	if (teamMember !== true) return 0; // Not a team member = no points
	
	if (rank === 1) return tp1;
	if (rank === 2) return tp2;
	if (rank === 3) return tp3;
	// 4th place = tp3-1, 5th = tp3-2, etc.
	const points = tp3 - (rank - 3);
	return points > 0 ? points : 0;
}
