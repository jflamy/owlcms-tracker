/**
 * Athlete transformation and formatting helpers
 * Shared between iwf-startbook and iwf-results plugins
 * 
 * PURE FUNCTIONS - No external imports
 */

/**
 * Format an attempt value for display
 * - Actual lift > 0: show value (e.g., "120")
 * - Actual lift < 0: show in parentheses (failed lift, e.g., "(120)")
 * - Actual lift = 0: show "-" (no lift)
 * - No actual: show declared value
 * 
 * @param {number|null} actual - Actual lift result (positive=good, negative=failed, 0=no lift)
 * @param {number|null} declared - Declared/requested weight
 * @returns {string} Formatted attempt string
 */
export function formatAttempt(actual, declared) {
  if (actual !== null && actual !== undefined && actual !== '') {
    const val = parseFloat(actual);
    if (val === 0) return '-';
    if (val < 0) return `(${Math.abs(val)})`;
    return String(val);
  }
  return declared ? String(declared) : '';
}

/**
 * Resolve athlete's team name from database
 * @param {Object} db - Database state with teams array
 * @param {string} athleteName - Athlete name to search for
 * @returns {string|null} Team name or null if not found
 */
export function getAthleteTeam(db, athleteName) {
  if (!athleteName || !db.athletes) return null;
  
  const searchName = athleteName.toUpperCase();
  const athlete = db.athletes.find(a => {
    const lastName = (a.lastName || '').toUpperCase();
    const firstName = (a.firstName || '').toUpperCase();
    return searchName === `${lastName}, ${firstName}` || 
           searchName === `${firstName} ${lastName}` ||
           searchName === lastName ||
           searchName === firstName;
  });
  
  if (athlete) {
    return athlete.teamName || (athlete.team ? db.teams?.find(t => t.id === athlete.team)?.name : '');
  }
  return null;
}

/**
 * Compute best lifts and total from athlete data
 * Handles both V1 (compute from actual lifts) and V2 (precomputed) export formats
 * 
 * @param {Object} athlete - Athlete object with lift data
 * @returns {Object} { bestSnatch, bestCleanJerk, total }
 */
export function computeBestLifts(athlete) {
  let bestSnatchValue, bestCleanJerkValue, computedTotal;
  
  if (athlete.bestSnatch !== null && athlete.bestSnatch !== undefined) {
    // V2 export: use precomputed values from database
    bestSnatchValue = athlete.bestSnatch || 0;
    bestCleanJerkValue = athlete.bestCleanJerk || 0;
    computedTotal = athlete.total || 0;
  } else {
    // V1 export or missing data: compute from actual lifts
    const snatchLifts = [athlete.snatch1ActualLift, athlete.snatch2ActualLift, athlete.snatch3ActualLift]
      .filter(val => val && val > 0);
    bestSnatchValue = snatchLifts.length > 0 ? Math.max(...snatchLifts) : 0;
    
    const cleanJerkLifts = [athlete.cleanJerk1ActualLift, athlete.cleanJerk2ActualLift, athlete.cleanJerk3ActualLift]
      .filter(val => val && val > 0);
    bestCleanJerkValue = cleanJerkLifts.length > 0 ? Math.max(...cleanJerkLifts) : 0;
    
    computedTotal = (bestSnatchValue > 0 && bestCleanJerkValue > 0) ? (bestSnatchValue + bestCleanJerkValue) : 0;
  }
  
  return { bestSnatch: bestSnatchValue, bestCleanJerk: bestCleanJerkValue, total: computedTotal };
}

/**
 * Calculate team points based on rank
 * @param {number} totalRank - Athlete's total rank (1, 2, 3, etc.)
 * @param {Object} competition - Competition object with teamPoints1st, teamPoints2nd
 * @returns {number} Team points (0 if unranked)
 */
export function calculateTeamPointsForRank(totalRank, competition) {
  if (!totalRank || totalRank <= 0) return 0;
  
  const tp1 = competition?.teamPoints1st || 28;
  const tp2 = competition?.teamPoints2nd || 26;
  
  if (totalRank === 1) return tp1;
  if (totalRank === 2) return tp2;
  // 3rd place and beyond: tp2 - (rank - 2), minimum 0
  return Math.max(0, tp2 - (totalRank - 2));
}
