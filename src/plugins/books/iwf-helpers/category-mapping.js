/**
 * Category mapping and age group helpers
 * Shared between iwf-startbook and iwf-results plugins
 * 
 * PURE FUNCTIONS - No external imports (logger passed as parameter when needed)
 */

/**
 * Build category mapping from ageGroups
 * Returns: Map<categoryCode, {ageGroupName, maxAge, minAge, gender, weight, weightDisplay, minWeight, maxWeight}>
 * 
 * This enables quick lookup of category properties without iterating ageGroups repeatedly.
 * Skips inactive age groups. Extracts gender from category code (e.g., "SR_M89" -> "M").
 * Uses ag.championshipName as the age group identifier.
 * 
 * @param {Array} ageGroups - Array of age group objects from database
 * @param {Object} logger - Optional logger for debug output
 * @returns {Map} Map of categoryCode -> category info object
 */
export function buildCategoryMap(ageGroups, logger = null) {
  const categoryMap = new Map();
  
  (ageGroups || []).forEach(ag => {
    if (ag.active === false) return; // Skip inactive age groups
    
    // Use ag.championshipName as the age group identifier
    const ageGroupName = ag.championshipName;
    
    (ag.categories || []).forEach(cat => {
      const code = cat.code; // Use explicit code field
      if (!code) return;
      
      // Extract gender from category code (e.g., "SR_M89" -> "M", "YTH_F58" -> "F")
      const genderMatch = code.match(/[_\s]([MF])/);
      const gender = genderMatch ? genderMatch[1] : 'M';
      
      // Extract maximum weight from category name
      // Handles formats: "YTH F >77", "YTH F 77+", "YTH F +77", "YTH F 77"
      let weight = 999;
      let weightDisplay = '';
      const catName = cat.categoryName || cat.name || '';

      // Trust maximumWeight ONLY if it's a valid weight (not the 999 sentinel for superheavyweights)
      if (cat.maximumWeight !== null && cat.maximumWeight !== undefined && cat.maximumWeight !== 999) {
        weight = cat.maximumWeight;
        weightDisplay = String(weight);
      } else if (catName) {
        // Check for superheavyweight patterns: ">77", "77+", "+77"
        const superHeavyMatch = catName.match(/([>+])?(\d+)([+])?$/);
        if (superHeavyMatch) {
          const prefix = superHeavyMatch[1] || '';
          const num = superHeavyMatch[2];
          const suffix = superHeavyMatch[3] || '';
          weight = parseInt(num);
          
          // Preserve the prefix/suffix for display
          if (prefix || suffix) {
            weightDisplay = `${prefix}${num}${suffix}`;
          } else {
            weightDisplay = num;
          }
        } else {
          // Fallback: try extracting from code (but not if it's 999)
          const codeMatch = code.match(/(\d+)$/);
          if (codeMatch && codeMatch[1] !== '999') {
            weight = parseInt(codeMatch[1]);
            weightDisplay = codeMatch[1];
          }
        }
      }
      
      // Debug superheavyweight categories
      if (logger && (weight === 999 || weight > 200)) {
        logger.debug(`[buildCategoryMap] Weight issue: code="${code}", name="${catName}", weight=${weight}, weightDisplay="${weightDisplay}", maximumWeight=${cat.maximumWeight}`);
      }
      
      // Store weight bounds from category definition
      const minWeight = cat.minimumWeight || 0;
      const maxWeight = cat.maximumWeight || 999;
      
      categoryMap.set(code, {
        ageGroupName,         // Championship identifier: "Senior", "Junior", "Youth", etc.
        categoryName: cat.categoryName || code,
        maxAge: ag.maxAge || 999,
        minAge: ag.minAge || 0,
        gender,
        weight,           // Extracted weight for display
        weightDisplay,    // Display string (e.g., ">77")
        minWeight,        // Category lower bound (e.g., 94 for 94-110)
        maxWeight         // Category upper bound (e.g., 110 for 94-110, 999 for superheavy)
      });
    });
  });
  
  return categoryMap;
}

/**
 * Build athlete participation mapping
 * Returns: Map<athleteId, {mainCategory, allParticipations[], team}>
 * 
 * Each athlete has a registration category (main) + optional additional participations.
 * Resolves team ID to name using database teams lookup.
 * 
 * @param {Array} athletes - Array of athlete objects from database
 * @param {Map} categoryMap - Pre-built category map (from buildCategoryMap)
 * @param {Array} teams - Array of team objects from database
 * @returns {Map} Map of athleteId -> athlete participation info
 */
export function buildAthleteParticipationMap(athletes, categoryMap, teams) {
  const teamIdToName = new Map();
  (teams || []).forEach(t => {
    if (t.id != null && t.name) {
      teamIdToName.set(t.id, t.name);
    }
  });
  
  const participationMap = new Map();
  
  (athletes || []).forEach(a => {
    if (!a.id && !a.key) return; // Skip athletes without ID
    
    const athleteId = a.id || a.key;
    
    // Resolve team name
    let team = a.teamName || a.team || a.club || 'Unknown';
    if (typeof team === 'number') {
      team = teamIdToName.get(team) || `Team ${team}`;
    }
    
    // Main participation is the categoryCode (registration category)
    const mainCategory = a.categoryCode || 'Unknown';
    
    // Additional participations array (or fallback to main category)
    let allParticipations = a.participations || [];
    if (allParticipations.length === 0 && mainCategory !== 'Unknown') {
      allParticipations = [{ categoryCode: mainCategory }];
    }
    
    participationMap.set(athleteId, {
      mainCategory,
      allParticipations,
      team: String(team),
      lastName: a.lastName || '',
      firstName: a.firstName || '',
      gender: a.gender || 'M'
    });
  });
  
  return participationMap;
}

/**
 * Build subcategory mapping from athletes
 * Returns: Map<athleteId, subcategoryCode>
 * 
 * If subcategory field is missing or empty, defaults to "A".
 * 
 * @param {Array} athletes - Array of athlete objects from database
 * @returns {Map} Map of athleteId -> subcategory (default "A")
 */
export function buildSubcategoryMap(athletes) {
  const subcategoryMap = new Map();
  
  (athletes || []).forEach(a => {
    const athleteId = a.id || a.key;
    if (!athleteId) return;
    
    // Use explicit subCategory field, default to "A" if missing
    const subCategory = (a.subCategory && a.subCategory.trim()) || 'A';
    subcategoryMap.set(athleteId, subCategory);
  });
  
  return subcategoryMap;
}

/**
 * Extract age groups with their weight classes for a session
 * Returns: Array<{ageGroup, weightClasses}>
 * 
 * Scans all athletes in a session to find unique (ageGroup, weightClass) pairs.
 * Orders age groups by age bounds: smallest maxAge first, then smallest minAge.
 * 
 * @param {Object} sessionData - Session from databaseState.sessions
 * @param {Array} allAthletes - All athletes from database
 * @param {Map} categoryMap - Pre-built category map (from buildCategoryMap)
 * @param {Array} dbAgeGroups - All age groups from database (for age bounds)
 * @returns {Array} Array of {ageGroup, weightClasses: [44, 48, ...]} sorted by age
 */
export function extractSessionAgeGroupsWithWeights(sessionData, allAthletes, categoryMap, dbAgeGroups) {
  const ageGroupWeights = new Map(); // ageGroupCode -> Set<weightClass>
  const ageGroupBounds = new Map(); // ageGroupCode -> {minAge, maxAge}
  
  // Build mapping of age group championship name to its bounds
  (dbAgeGroups || []).forEach(ag => {
    if (ag.active !== false) {
      const ageGroupName = ag.championshipName;
      ageGroupBounds.set(ageGroupName, {
        minAge: ag.minAge ?? 0,
        maxAge: ag.maxAge ?? 999
      });
    }
  });
  
  (allAthletes || []).forEach(athlete => {
    // Only process athletes in this session
    if (athlete.sessionName !== sessionData.name) return;
    
    // Get category info
    const catCode = athlete.categoryCode;
    if (!catCode) return;
    
    const catInfo = categoryMap.get(catCode);
    if (!catInfo) return;
    
    const ageGroup = catInfo.ageGroupName;
    const weightClass = catInfo.weight;
    
    if (!ageGroupWeights.has(ageGroup)) {
      ageGroupWeights.set(ageGroup, new Set());
    }
    ageGroupWeights.get(ageGroup).add(weightClass);
  });
  
  // Convert to array and sort weights ascending, order age groups by age bounds
  const result = Array.from(ageGroupWeights.entries())
    .map(([ageGroup, weights]) => {
      const bounds = ageGroupBounds.get(ageGroup) || { minAge: 0, maxAge: 999 };
      return {
        ageGroup,
        weightClasses: Array.from(weights).sort((a, b) => a - b),
        minAge: bounds.minAge,
        maxAge: bounds.maxAge
      };
    })
    .sort((a, b) => {
      // Sort by smallest maxAge first, then by smallest minAge
      if (a.maxAge !== b.maxAge) return a.maxAge - b.maxAge;
      return a.minAge - b.minAge;
    })
    .map(({ ageGroup, weightClasses }) => ({ ageGroup, weightClasses }));  // Remove bounds
  
  return result;
}

/**
 * Build athlete participation mapping by age group
 * Returns: Map<athleteId, {ageGroupName -> weightClass}>
 * 
 * For each athlete, determines which weight classes they compete in per age group.
 * Used to populate dynamic age group columns in session start list.
 * 
 * @param {Array} allAthletes - All athletes from database
 * @param {Map} categoryMap - Pre-built category map (from buildCategoryMap)
 * @returns {Map} Map of athleteId -> {ageGroupName: weightClass}
 */
export function buildAthleteAgeGroupParticipation(allAthletes, categoryMap) {
  const participationMap = new Map();
  
  (allAthletes || []).forEach(athlete => {
    const athleteId = athlete.id || athlete.key;
    if (!athleteId) return;
    
    const participationByAgeGroup = {};
    
    // Process main category + any additional participations
    const participations = athlete.participations || [];
    if (participations.length === 0 && athlete.categoryCode) {
      participations.push({ categoryCode: athlete.categoryCode });
    }
    
    participations.forEach(p => {
      const catCode = p.categoryCode || athlete.categoryCode;
      if (!catCode) return;
      
      const catInfo = categoryMap.get(catCode);
      if (!catInfo) return;
      
      const ageGroup = catInfo.ageGroupName;
      const weightClass = catInfo.weightDisplay; // e.g., "48", ">77", "110+"
      
      participationByAgeGroup[ageGroup] = weightClass;
    });
    
    if (Object.keys(participationByAgeGroup).length > 0) {
      participationMap.set(athleteId, participationByAgeGroup);
    }
  });
  
  return participationMap;
}
