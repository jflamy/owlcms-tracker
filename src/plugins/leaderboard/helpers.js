/**
 * Helper functions for leaderboard plugin
 * Handles various OWLCMS athlete data formats
 */

export function formatResult(result) {
  if (!result) return '-';
  return result === 'good' ? '✓' : '✗';
}

export function getRankStyle(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return '';
}

/**
 * Get athlete rank from various possible fields
 */
export function getAthleteRank(athlete) {
  return athlete.rank || athlete.totalRank || athlete.position || 999;
}

/**
 * Get athlete total from various possible fields
 */
export function getAthleteTotal(athlete) {
  return athlete.total || athlete.totalLift || athlete.totalKg || 0;
}

/**
 * Get athlete best snatch from various possible fields
 */
export function getAthleteBestSnatch(athlete) {
  return athlete.bestSnatch || athlete.snatchTotal || athlete.snatch || 0;
}

/**
 * Get athlete best clean & jerk from various possible fields
 */
export function getAthleteBestCleanJerk(athlete) {
  return athlete.bestCleanJerk || athlete.cleanJerkTotal || athlete.cleanJerk || 0;
}

/**
 * Count good lifts from attempt results
 */
export function countGoodLifts(athlete) {
  let count = 0;
  
  // Check various possible field names for attempts
  const attemptFields = [
    'snatch1Result', 'snatch2Result', 'snatch3Result',
    'cleanJerk1Result', 'cleanJerk2Result', 'cleanJerk3Result',
    'snatch1', 'snatch2', 'snatch3',
    'cleanJerk1', 'cleanJerk2', 'cleanJerk3'
  ];
  
  for (const field of attemptFields) {
    if (athlete[field] === 'good' || athlete[field] === true || (typeof athlete[field] === 'number' && athlete[field] > 0)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Get athlete's display name from various possible fields
 */
export function getAthleteDisplayName(athlete) {
  if (athlete.fullName) return athlete.fullName;
  if (athlete.firstName && athlete.lastName) return `${athlete.firstName} ${athlete.lastName}`;
  if (athlete.name) return athlete.name;
  return 'Unknown Athlete';
}

/**
 * Get athlete's team name from various possible fields
 */
export function getAthleteTeam(athlete) {
  return athlete.team || athlete.teamName || athlete.club || '-';
}

/**
 * Get athlete's category from various possible fields
 */
export function getAthleteCategory(athlete) {
  return athlete.category || athlete.categoryName || athlete.weightClass || athlete.ageGroup || '-';
}