/**
 * Records extraction helpers
 * Shared between iwf-startbook and iwf-results plugins
 * 
 * Note: These functions require sortRecordsByFederation and formatCategoryDisplay 
 * from @owlcms/tracker-core, which must be passed in or imported in the caller.
 */

import { getAthleteTeam } from './athlete-transforms.js';

/**
 * Extract records relevant to a session's athletes
 * Filters records by matching athlete criteria (federation, gender, body weight, age)
 * Deduplicates by keeping highest value per record type
 * 
 * @param {Object} db - Database state with records, athletes arrays
 * @param {Array} sessionCategories - Array of category objects with items (athletes)
 * @param {Function} sortRecordsByFederation - Sort function from tracker-core
 * @param {Function} formatCategoryDisplay - Format function from tracker-core
 * @param {boolean} isFirstSession - Whether this is the first session (for logging)
 * @returns {Array} Filtered and formatted records for the session
 */
export function extractRecords(db, sessionCategories, sortRecordsByFederation, formatCategoryDisplay, isFirstSession = false) {
  const allRecords = db.records || [];
  
  // Build list of athletes with their matching criteria
  const sessionAthletes = [];
  
  sessionCategories.forEach(category => {
    category.items?.forEach(athlete => {
      // Parse record federations (comma-separated, trimmed)
      const recordFederationsStr = athlete.federationCodes || athlete.federation || '';
      const recordFederations = recordFederationsStr 
        ? recordFederationsStr.split(',').map(f => f.trim().toUpperCase())
        : []; // Empty array means all federations acceptable
      
      // Extract maximum body weight from category
      const categoryCode = athlete.categoryCode || '';
      let maxBodyWeight = parseFloat(athlete.bwCatUpper) || 999;
      if (!athlete.bwCatUpper && categoryCode) {
        const weightMatch = categoryCode.match(/(\d+)$/);
        if (weightMatch) {
          maxBodyWeight = parseFloat(weightMatch[1]);
        }
      }
      const searchBodyWeight = maxBodyWeight - 0.1;
      
      // Extract maximum age
      const maxAge = parseInt(athlete.ageGrpUpper) || 999;
      
      sessionAthletes.push({
        name: `${athlete.firstName} ${athlete.lastName}`,
        recordFederations: recordFederations,
        bodyWeight: searchBodyWeight,
        age: maxAge,
        gender: athlete.gender,
        categoryCode: categoryCode
      });
    });
  });
  
  // Group records by type, keep highest value per group
  const recordMap = new Map();
  
  allRecords.forEach((r) => {
    // Skip if missing critical fields
    if (!r.recordFederation || !r.recordLift || !r.gender || 
        r.bwCatLower === undefined || r.bwCatUpper === undefined ||
        r.ageGrpLower === undefined || r.ageGrpUpper === undefined) {
      return;
    }
    
    // Skip new records (shown in newRecords section)
    if (r.groupNameString && r.groupNameString !== '') {
      return;
    }
    
    // Check if record matches any athlete in session
    let matched = false;
    for (const athlete of sessionAthletes) {
      const federationMatch = athlete.recordFederations.length === 0 || 
                             athlete.recordFederations.includes(r.recordFederation.toUpperCase());
      const genderMatch = athlete.gender === r.gender;
      const bwMatch = athlete.bodyWeight > r.bwCatLower && athlete.bodyWeight <= r.bwCatUpper;
      const ageMatch = athlete.age >= r.ageGrpLower && athlete.age <= r.ageGrpUpper;
      
      if (federationMatch && genderMatch && bwMatch && ageMatch) {
        matched = true;
        break;
      }
    }
    
    if (!matched) return;
    
    // Unique key for this record type
    const key = `${r.recordFederation}|${r.recordLift}|${r.gender}|${r.ageGrp || ''}|${r.bwCatLower}|${r.bwCatUpper}`;
    
    const existing = recordMap.get(key);
    const currentValue = parseFloat(r.recordValue) || 0;
    
    // Keep the record with the highest value
    if (!existing || currentValue > parseFloat(existing.recordValue || 0)) {
      recordMap.set(key, r);
    }
  });
  
  // Convert map to array and format for display
  const sessionRecords = sortRecordsByFederation(
    Array.from(recordMap.values()).map(r => {
      const athleteTeam = getAthleteTeam(db, r.athleteName);
      const categoryString = r.bwCatString || '';
      
      return {
        federation: r.recordFederation || 'WFA',
        recordName: r.recordName,
        ageGroup: r.ageGrp || '',
        category: formatCategoryDisplay(categoryString),
        categoryCode: categoryString,
        bwCatUpper: r.bwCatUpper,
        lift: r.recordLift,
        value: r.recordValue,
        holder: r.athleteName,
        nation: athleteTeam || r.nation || '',
        born: ''
      };
    })
  );

  return sessionRecords;
}

/**
 * Extract new records broken in a specific session
 * 
 * @param {Object} db - Database state with records array
 * @param {string} sessionName - Session name to filter by
 * @param {Function} sortRecordsByFederation - Sort function from tracker-core
 * @param {Function} formatCategoryDisplay - Format function from tracker-core
 * @returns {Array} New records broken in the session
 */
export function extractNewRecords(db, sessionName, sortRecordsByFederation, formatCategoryDisplay) {
  const allRecords = db.records || [];
  
  return sortRecordsByFederation(
    allRecords
      .filter(r => r.groupNameString === sessionName)
      .map(r => {
        const athleteTeam = getAthleteTeam(db, r.athleteName);
        const categoryString = r.bwCatString || '';
        
        return {
          federation: r.recordFederation || 'WFA',
          recordName: r.recordName,
          ageGroup: r.ageGrp || '',
          category: formatCategoryDisplay(categoryString),
          categoryCode: categoryString,
          bwCatUpper: r.bwCatUpper,
          lift: r.recordLift,
          value: r.recordValue,
          holder: r.athleteName,
          nation: athleteTeam || r.nation || '',
          born: ''
        };
      })
  );
}
