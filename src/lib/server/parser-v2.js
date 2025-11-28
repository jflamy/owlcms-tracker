/**
 * V2 Format Parser - Parses OWLCMS V2 database format
 * 
 * V2 Format Features:
 * - formatVersion: "2.0"
 * - Uses name/code references instead of numeric IDs
 * - Numeric values are numbers, not strings
 * - categoryCode in participations
 * - No @id fields from Jackson @JsonIdentityInfo
 */

/**
 * Parse V2 format database from OWLCMS
 * @param {Object} params - V2 database payload
 * @returns {Object} Normalized competition state
 */
export function parseV2Database(params) {
  console.log('[V2 Parser] Parsing V2 format database');
  
  // Handle nested database structure: { databaseChecksum, database: { ... } }
  const db = params.database || params;
  const providedChecksum = params?.databaseChecksum || params?.checksum || db?.databaseChecksum || null;
  
  if (!db.athletes || !Array.isArray(db.athletes)) {
    console.error('[V2 Parser] No athletes array found in V2 format');
    return null;
  }
  
  console.log(`[V2 Parser] Processing ${db.athletes.length} athletes`);
  console.log(`[V2 Parser] Has ageGroups:`, !!db.ageGroups, 'count:', db.ageGroups?.length || 0);
  console.log(`[V2 Parser] Has competition:`, !!db.competition);
  console.log(`[V2 Parser] Has platforms:`, !!db.platforms, 'count:', db.platforms?.length || 0);
  console.log(`[V2 Parser] Has teams:`, !!db.teams, 'count:', db.teams?.length || 0);
  
  // Build team lookup map (V2 uses numeric team IDs)
  const teamMap = buildTeamMap(db.teams || []);
  
  // Parse athletes from V2 format
  const athletes = db.athletes.map(athlete => normalizeV2Athlete(athlete, teamMap));
  
  // Parse age groups and categories
  const categories = extractV2Categories(db.ageGroups || []);
  
  // Parse platforms/FOPs
  const fops = extractV2FOPs(db.platforms || []);
  
  // Parse sessions
  const sessions = db.sessions || [];
  
  // Build normalized result
  const result = {
    formatVersion: '2.0',
    athletes,
    ageGroups: db.ageGroups || [],
    categories,
    fops,
    sessions,
    platforms: db.platforms || [],
    teams: db.teams || [],
    competition: {
      name: db.competition?.competitionName || 'Competition',
      city: db.competition?.competitionCity || '',
      date: formatV2Date(db.competition?.competitionDate),
      organizer: db.competition?.competitionOrganizer || '',
      federation: db.competition?.federation || '',
      scoringSystem: db.competition?.scoringSystem || '',
      ...db.competition
    },
    config: db.config || {},
    initialized: true,
    lastUpdate: Date.now(),
    databaseChecksum: providedChecksum || db.databaseChecksum || null
  };
  
  console.log(`[V2 Parser] ✅ Parsed ${athletes.length} athletes, ${categories.length} categories, ${fops.length} FOPs`);
  
  return result;
}

/**
 * Build team lookup map from teams array
 * @param {Array} teams - V2 teams array
 * @returns {Map} Map of team ID to team name
 */
function buildTeamMap(teams) {
  const map = new Map();
  for (const team of teams) {
    if (team.id && team.name) {
      map.set(team.id, team.name);
    }
  }
  return map;
}

/**
 * Normalize V2 athlete to internal format
 * Preserves raw V2 data and adds derived fields clearly marked
 * 
 * @param {Object} athlete - V2 athlete object (raw from OWLCMS)
 * @param {Map} teamMap - Map of team ID to team name
 * @returns {Object} Normalized athlete with raw + derived data
 */
function normalizeV2Athlete(athlete, teamMap) {
  // Derived: Team name resolved from numeric ID
  const teamName = athlete.team ? teamMap.get(athlete.team) : null;
  
  // Use precomputed key from OWLCMS (V2 format includes this)
  const athleteKey = athlete.key;
  
  return {
    // ===== RAW V2 DATA (from OWLCMS export) =====
    
    // Identity - raw V2 fields (numeric types)
    startNumber: athlete.startNumber,
    lotNumber: athlete.lotNumber,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    
    // Category - raw V2 field (string code)
    categoryCode: athlete.categoryCode,
    
    // Physical - raw V2 fields (numeric types)
    gender: athlete.gender,
    bodyWeight: athlete.bodyWeight,
    presumedBodyWeight: athlete.presumedBodyWeight,
    yearOfBirth: athlete.fullBirthDate?.[0], // Extract year from [year, month, day]
    fullBirthDate: athlete.fullBirthDate,
    
    // Team - raw V2 field (numeric ID)
    team: athlete.team, // Keep original numeric ID
    
    // Session - raw V2 field
    groupName: athlete.groupName,
    
    // Administrative - raw V2 fields
    membership: athlete.membership,
    federationCodes: athlete.federationCodes,
    entryTotal: athlete.entryTotal,
    qualifyingTotal: athlete.qualifyingTotal,
    
    // Snatch attempts - raw V2 fields (numeric values, null for empty)
    snatch1Declaration: athlete.snatch1Declaration,
    snatch1Change1: athlete.snatch1Change1,
    snatch1Change2: athlete.snatch1Change2,
    snatch1ActualLift: athlete.snatch1ActualLift,
    snatch1AutomaticProgression: athlete.snatch1AutomaticProgression,
    snatch1LiftTime: athlete.snatch1LiftTime,
    
    snatch2Declaration: athlete.snatch2Declaration,
    snatch2Change1: athlete.snatch2Change1,
    snatch2Change2: athlete.snatch2Change2,
    snatch2ActualLift: athlete.snatch2ActualLift,
    snatch2AutomaticProgression: athlete.snatch2AutomaticProgression,
    snatch2LiftTime: athlete.snatch2LiftTime,
    
    snatch3Declaration: athlete.snatch3Declaration,
    snatch3Change1: athlete.snatch3Change1,
    snatch3Change2: athlete.snatch3Change2,
    snatch3ActualLift: athlete.snatch3ActualLift,
    snatch3AutomaticProgression: athlete.snatch3AutomaticProgression,
    snatch3LiftTime: athlete.snatch3LiftTime,
    
    // Clean & Jerk attempts - raw V2 fields (numeric values, null for empty)
    cleanJerk1Declaration: athlete.cleanJerk1Declaration,
    cleanJerk1Change1: athlete.cleanJerk1Change1,
    cleanJerk1Change2: athlete.cleanJerk1Change2,
    cleanJerk1ActualLift: athlete.cleanJerk1ActualLift,
    cleanJerk1AutomaticProgression: athlete.cleanJerk1AutomaticProgression,
    cleanJerk1LiftTime: athlete.cleanJerk1LiftTime,
    
    cleanJerk2Declaration: athlete.cleanJerk2Declaration,
    cleanJerk2Change1: athlete.cleanJerk2Change1,
    cleanJerk2Change2: athlete.cleanJerk2Change2,
    cleanJerk2ActualLift: athlete.cleanJerk2ActualLift,
    cleanJerk2AutomaticProgression: athlete.cleanJerk2AutomaticProgression,
    cleanJerk2LiftTime: athlete.cleanJerk2LiftTime,
    
    cleanJerk3Declaration: athlete.cleanJerk3Declaration,
    cleanJerk3Change1: athlete.cleanJerk3Change1,
    cleanJerk3Change2: athlete.cleanJerk3Change2,
    cleanJerk3ActualLift: athlete.cleanJerk3ActualLift,
    cleanJerk3AutomaticProgression: athlete.cleanJerk3AutomaticProgression,
    cleanJerk3LiftTime: athlete.cleanJerk3LiftTime,
    
    // Results - raw V2 fields (numeric values computed by OWLCMS)
    bestSnatch: athlete.bestSnatch,
    bestCleanJerk: athlete.bestCleanJerk,
    total: athlete.total,
    
    // Scoring - raw V2 fields (numeric values computed by OWLCMS)
    sinclair: athlete.sinclair,
    sinclairFactor: athlete.sinclairFactor,
    smm: athlete.smm,
    smmFactor: athlete.smmFactor,
    robi: athlete.robi,
    robiPoints: athlete.robiPoints,
    ageAdjustedTotal: athlete.ageAdjustedTotal,
    customScore: athlete.customScore,
    
    // Rankings - raw V2 fields (numeric values computed by OWLCMS)
    snatchRank: athlete.snatchRank,
    cleanJerkRank: athlete.cleanJerkRank,
    totalRank: athlete.totalRank,
    sinclairRank: athlete.sinclairRank,
    customRank: athlete.customRank,
    combinedRank: athlete.combinedRank,
    
    // Participations - raw V2 fields (array with categoryCode)
    participations: athlete.participations || [],
    
    // ===== DERIVED DATA (computed by tracker for convenience) =====
    
    // Derived: Athlete key (from OWLCMS key field)
    id: athleteKey,
    key: athleteKey, // Alias for consistency - both 'id' and 'key' contain the same value
    
    // Derived: Full name from firstName + lastName
    fullName: `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim(),
    
    // Derived: Team name resolved from numeric ID
    teamName: teamName,
    
    // Derived: Aliases for backward compatibility
    categoryName: athlete.categoryCode, // Alias for categoryCode
    category: athlete.categoryCode, // Alias for categoryCode
    group: athlete.groupName, // Alias for groupName
    name: `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() // Alias for fullName
  };
}

/**
 * Extract categories from V2 age groups
 * @param {Array} ageGroups - V2 age groups
 * @returns {Array} Flattened categories
 */
function extractV2Categories(ageGroups) {
  const categories = [];
  
  for (const ageGroup of ageGroups) {
    if (ageGroup.categories && Array.isArray(ageGroup.categories)) {
      for (const category of ageGroup.categories) {
        categories.push({
          id: category.id,
          code: category.code,
          name: category.name,
          gender: category.gender,
          minimumWeight: category.minimumWeight,
          maximumWeight: category.maximumWeight,
          ageGroupCode: ageGroup.code,
          ageGroupName: ageGroup.championshipName || ageGroup.code
        });
      }
    }
  }
  
  return categories;
}

/**
 * Extract FOPs from V2 platforms
 * @param {Array} platforms - V2 platforms
 * @returns {Array} FOP names
 */
function extractV2FOPs(platforms) {
  if (!platforms || platforms.length === 0) {
    return ['A']; // Default FOP
  }
  
  return platforms.map(platform => platform.name || platform);
}

/**
 * Format V2 date array to ISO string
 * @param {Array} dateArray - V2 date [year, month, day]
 * @returns {string} ISO date string
 */
function formatV2Date(dateArray) {
  if (!dateArray || !Array.isArray(dateArray) || dateArray.length < 3) {
    return new Date().toISOString().split('T')[0];
  }
  
  const [year, month, day] = dateArray;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
