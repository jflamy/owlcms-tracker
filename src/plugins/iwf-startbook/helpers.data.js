import { competitionHub } from '$lib/server/competition-hub.js';
import { logger, getHeaderLogoUrl } from '@owlcms/tracker-core';
import { registerCache } from '$lib/server/cache-epoch.js';

const OFFICIAL_ROLE_TRANSLATION_KEYS = {
  REFEREE: 'Referee',
  CENTER_REFEREE: 'CenterReferee',
  LEFT_REFEREE: 'SideReferee',
  RIGHT_REFEREE: 'SideReferee',
  REFEREE_RESERVE: 'ReserveReferee',
  MARSHAL1: 'ChiefMarshal',
  MARSHAL2: 'AssistantMarshal',
  MARSHALL: 'Marshall',
  TIMEKEEPER: 'Timekeeper',
  TECHNICAL_CONTROLLER: 'TechnicalController',
  TECHNICAL_CONTROLLER1: 'TechnicalController',
  TECHNICAL_CONTROLLER2: 'TechnicalController',
  DOCTOR: 'Doctor',
  DOCTOR2: 'Doctor',
  DOCTOR3: 'Doctor',
  COMPETITION_SECRETARY: 'CompetitionSecretary',
  COMPETITION_SECRETARY2: 'CompetitionSecretary',
  ANNOUNCER: 'Announcer',
  WEIGHIN1: 'Weighin',
  WEIGHIN2: 'Weighin',
  JURY_PRESIDENT: 'JuryPresident',
  JURY_MEMBER: 'JuryMember',
  JURY_A: 'JuryMember',
  JURY_B: 'JuryMember',
  JURY_C: 'JuryMember',
  JURY_D: 'JuryMember',
  JURY_RESERVE: 'ReserveJury',
  JURY: 'Jury'
};

export function getOfficialRoleTranslationKey(roleCategory) {
  return OFFICIAL_ROLE_TRANSLATION_KEYS[roleCategory] || roleCategory;
}

const OFFICIAL_ROLE_PRESENTATION_ORDER = [
  'JURY',
  'JURY_PRESIDENT',
  'JURY_MEMBER',
  'JURY_A',
  'JURY_B',
  'JURY_C',
  'JURY_D',
  'JURY_RESERVE',
  'REFEREE',
  'CENTER_REFEREE',
  'LEFT_REFEREE',
  'RIGHT_REFEREE',
  'REFEREE_RESERVE',
  'MARSHAL1',
  'MARSHAL2',
  'MARSHALL',
  'TIMEKEEPER',
  'TECHNICAL_CONTROLLER1',
  'TECHNICAL_CONTROLLER2',
  'TECHNICAL_CONTROLLER',
  'DOCTOR',
  'DOCTOR2',
  'DOCTOR3',
  'COMPETITION_SECRETARY',
  'COMPETITION_SECRETARY2',
  'ANNOUNCER',
  'WEIGHIN1',
  'WEIGHIN2'
];

function sortOfficialsList(officials = []) {
  return [...officials].sort((a, b) => {
    const lastNameComparison = (a.lastName || '').localeCompare(b.lastName || '');
    if (lastNameComparison !== 0) {
      return lastNameComparison;
    }
    return (a.firstName || '').localeCompare(b.firstName || '');
  });
}

function buildOfficialSections(officials = []) {
  const buckets = new Map();
  officials.forEach((official) => {
    const roleCategory = official.teamRole || 'OTHER';
    if (!buckets.has(roleCategory)) {
      buckets.set(roleCategory, []);
    }
    buckets.get(roleCategory).push(official);
  });

  const sections = [];
  OFFICIAL_ROLE_PRESENTATION_ORDER.forEach((roleCategory) => {
    if (buckets.has(roleCategory)) {
      sections.push({
        roleCategory,
        officials: sortOfficialsList(buckets.get(roleCategory)),
        translationKey: getOfficialRoleTranslationKey(roleCategory)
      });
      buckets.delete(roleCategory);
    }
  });

  for (const [roleCategory, officials] of buckets.entries()) {
    sections.push({
      roleCategory,
      officials: sortOfficialsList(officials),
      translationKey: getOfficialRoleTranslationKey(roleCategory)
    });
  }

  return sections;
}

function buildTimetableData(sessions = [], entries = []) {
  const sessionMeta = new Map();
  const platformSet = new Set();
  sessions.forEach((session) => {
    if (!session || !session.name) {
      return;
    }
    // Extract date and time from startTime (format: "2025-11-08 09:00:00")
    let date = '';
    let time = '';
    if (session.startTime) {
      const parts = session.startTime.split(' ');
      date = parts[0] || '';
      time = parts[1] || '';
    }
    
    sessionMeta.set(session.name, {
      description: session.description || session.name,
      date,
      time,
      platform: session.platform || '',
      sessionName: session.name
    });
    if (session.platform) {
      platformSet.add(session.platform);
    }
  });

  const roleSet = new Set();
  const rowMap = new Map();

  entries.forEach((entry) => {
    if (!entry) {
      return;
    }
    const sessionName = entry.sessionName || entry.session;
    const roleCategory = entry.roleCategory;
    if (!sessionName || !roleCategory || roleCategory === 'JURY_PRESIDENT') {
      return;
    }
    const teamNumber = entry.teamNumber || entry.team;
    roleSet.add(roleCategory);

    if (!rowMap.has(sessionName)) {
      const sessionInfo = sessionMeta.get(sessionName) || {};
      rowMap.set(sessionName, {
        sessionName,
        description: sessionInfo.description || sessionName,
        date: sessionInfo.date,
        time: sessionInfo.time,
        platform: sessionInfo.platform || sessionInfo.sessionPlatform,
        roles: {}
      });
    }

    const row = rowMap.get(sessionName);
    if (!row.roles[roleCategory]) {
      row.roles[roleCategory] = new Set();
    }
    if (teamNumber) {
      row.roles[roleCategory].add(teamNumber);
    }
  });

  const orderedRoles = OFFICIAL_ROLE_PRESENTATION_ORDER.filter((roleCategory) => roleSet.has(roleCategory) && roleCategory !== 'JURY_PRESIDENT');
  const extraRoles = [...roleSet].filter((roleCategory) => !orderedRoles.includes(roleCategory) && roleCategory !== 'JURY_PRESIDENT');
  extraRoles.sort();

  const roleInfo = [...orderedRoles, ...extraRoles].map((roleCategory) => ({
    roleCategory,
    translationKey: getOfficialRoleTranslationKey(roleCategory)
  }));

  const rows = [...rowMap.values()].map((row) => ({
    ...row,
    roles: Object.fromEntries(
      Object.entries(row.roles).map(([roleCategory, teamSet]) => [
        roleCategory,
        [...teamSet].sort((a, b) => a - b)
      ])
    )
  }));

  return {
    rows,
    roleInfo,
    hasMultiplePlatforms: platformSet.size > 1
  };
}

/**
 * Plugin-specific cache to avoid recomputing on every browser request
 */
const protocolCache = new Map();
registerCache(protocolCache);

/**
 * Clear the plugin cache - useful for development or when processing logic changes
 */
export function clearCache() {
  const size = protocolCache.size;
  protocolCache.clear();
  logger.debug(`[StartBook] Cache cleared (${size} entries removed)`);
  return { cleared: size };
}

/**
 * Build category mapping from ageGroups
 * Returns: Map<categoryCode, {ageGroupName, maxAge, minAge, gender, weight}>
 * 
 * This enables quick lookup of category properties without iterating ageGroups repeatedly.
 * Skips inactive age groups. Extracts gender from category code (e.g., "SR_M89" -> "M").
 * Uses ag.championshipName as the age group identifier (matching buildParticipationData).
 * 
 * @param {Array} ageGroups - Array of age group objects from database
 * @returns {Map} Map of categoryCode -> category info object
 */
function buildCategoryMap(ageGroups) {
  const categoryMap = new Map();
  
  (ageGroups || []).forEach(ag => {
    if (ag.active === false) return; // Skip inactive age groups
    
    // Use ag.championshipName as the age group identifier (this is what buildParticipationData uses)
    const ageGroupName = ag.championshipName;
    
    (ag.categories || []).forEach(cat => {
      const code = cat.code; // Use explicit code field
      if (!code) return;
      
      // Extract gender from category code (e.g., "SR_M89" -> "M", "YTH_F58" -> "F")
      const genderMatch = code.match(/[_\s]([MF])/);
      const gender = genderMatch ? genderMatch[1] : 'M';
      
      // Extract maximum weight from category name
      // Handles formats: "YTH F >77", "YTH F 77+", "YTH F +77", "YTH F 77"
      // Store both numeric weight (for sorting) and display string (for UI)
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
      if (weight === 999 || weight > 200) {
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
function buildAthleteParticipationMap(athletes, categoryMap, teams) {
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
 * Subcategories are used to distinguish athletes within the same category.
 * 
 * @param {Array} athletes - Array of athlete objects from database
 * @returns {Map} Map of athleteId -> subcategory (default "A")
 */
function buildSubcategoryMap(athletes) {
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
 * This determines what columns appear in the session start list table.
 * Orders age groups by age bounds: smallest maxAge first, then smallest minAge.
 * Uses ageGroupCode (e.g., "JUNIOR", "YOUTH") as identifier, not display name.
 * 
 * @param {Object} sessionData - Session from databaseState.sessions
 * @param {Array} allAthletes - All athletes from database
 * @param {Map} categoryMap - Pre-built category map (from buildCategoryMap)
 * @param {Array} dbAgeGroups - All age groups from database (for age bounds)
 * @returns {Array} Array of {ageGroup, weightClasses: [44, 48, ...]} sorted by age
 */
function extractSessionAgeGroupsWithWeights(sessionData, allAthletes, categoryMap, dbAgeGroups) {
  const ageGroupWeights = new Map(); // ageGroupCode -> Set<weightClass>
  const ageGroupBounds = new Map(); // ageGroupCode -> {minAge, maxAge}
  
  // Build mapping of age group championship name to its bounds (e.g., "Junior" -> {minAge: 13, maxAge: 14})
  (dbAgeGroups || []).forEach(ag => {
    if (ag.active !== false) {
      // Use ag.championshipName as the key (matching buildCategoryMap)
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
    
    // Use ageGroupName (from ag.championshipName, matching buildCategoryMap)
    const ageGroup = catInfo.ageGroupName;
    const weightClass = catInfo.weight; // Extracted weight (e.g., 44, 48)
    
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
 * Used to populate the dynamic age group columns in the session start list.
 * Uses ag.championshipName as the age group identifier (matching buildCategoryMap).
 * 
 * @param {Array} allAthletes - All athletes from database
 * @param {Map} categoryMap - Pre-built category map (from buildCategoryMap)
 * @returns {Map} Map of athleteId -> {ageGroupName: weightClass}
 */
function buildAthleteAgeGroupParticipation(allAthletes, categoryMap) {
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
      
      // Use ageGroupName (from ag.championshipName)
      const ageGroup = catInfo.ageGroupName;
      const weightClass = catInfo.weightDisplay; // e.g., "48", ">77", "110+"
      
      // Store: ageGroupName -> weightClass (as display string)
      participationByAgeGroup[ageGroup] = weightClass;
    });
    
    if (Object.keys(participationByAgeGroup).length > 0) {
      participationMap.set(athleteId, participationByAgeGroup);
    }
  });
  
  return participationMap;
}

export function getScoreboardData(fopName = '', options = {}, locale = 'en') {
  const databaseState = competitionHub.getDatabaseState();
  const translations = competitionHub.getTranslations(locale) || {};

  // Check if hub is ready (has database + translations)
  if (!competitionHub.isReady()) {
    return { status: 'waiting', message: 'Waiting for competition data...' };
  }

  // Extract options
  const includeSessionStartLists = options.includeSessionStartLists !== false;
  const includeOfficials = options.includeOfficials !== false;
  const includeCategoryParticipants = options.includeCategoryParticipants !== false;
  
  // Cache key based on database checksum, options, and code version
  // Increment CODE_VERSION when processing logic changes to bust cache
  const CODE_VERSION = 8;
  const dbVersion = databaseState.databaseChecksum || databaseState.lastUpdate;
  const cacheKey = `v${CODE_VERSION}-${dbVersion}-startbook-${includeSessionStartLists}-${includeOfficials}-${includeCategoryParticipants}-${locale}`;

  logger.debug(`[StartBook] Cache key: ${cacheKey}, cache size: ${protocolCache.size}`);

  if (protocolCache.has(cacheKey)) {
    logger.debug('[StartBook] CACHE HIT - returning cached data');
    return protocolCache.get(cacheKey);
  }

  logger.debug('[StartBook] CACHE MISS - building fresh data');
  
  // Clear old cache entries to prevent memory bloat
  if (protocolCache.size > 10) {
    logger.debug('[StartBook] Clearing old cache entries');
    protocolCache.clear();
  }
  
  // Format date array [year, month, day] to ISO string
  const formatISODate = (dateArray) => {
    if (!dateArray || dateArray.length < 3) return '';
    const [year, month, day] = dateArray;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const startDate = formatISODate(databaseState.competition?.competitionDate);
  const endDate = formatISODate(databaseState.competition?.competitionEndDate);
  const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : (startDate || '');

  const competition = {
    name: databaseState.competition?.name || 'Competition',
    city: databaseState.competition?.competitionCity || '',
    site: databaseState.competition?.competitionSite || '',
    dateRange,
    organizer: databaseState.competition?.competitionOrganizer || '',
    federation: databaseState.competition?.federation || '',
    owlcmsVersion: databaseState.config?.appVersion || databaseState.config?.version || '',
    exportDate: databaseState.exportDate || ''
  };

  // 1. Determine which sessions to include
  const athletesToProcess = databaseState.athletes;
  logger.debug(`[StartBook] Processing all sessions with includeSessionStartLists=${includeSessionStartLists}, includeOfficials=${includeOfficials}`);

  // Build category and participation maps once
  const categoryMap = buildCategoryMap(databaseState.ageGroups);
  const athleteParticipationByAgeGroup = buildAthleteAgeGroupParticipation(athletesToProcess, categoryMap);

  // 2. Group athletes by session then by category
  const sessionMap = new Map(); // { sessionName => { categoryCode => [athletes] } }

  athletesToProcess.forEach(athlete => {
    const sName = athlete.sessionName;
    
    // 🎯 FILTERING: Session unknown -- athlete not in session -- should not be included
    if (!sName || sName === 'Unknown') return;
    
    // Initialize session
    if (!sessionMap.has(sName)) {
      sessionMap.set(sName, new Map());
    }
    
    const catCode = athlete.categoryCode || 'Unknown';
    const sessionCategories = sessionMap.get(sName);
    if (!sessionCategories.has(catCode)) {
      sessionCategories.set(catCode, {
        categoryName: athlete.categoryName || catCode,
        categorySortCode: catCode,
        items: []
      });
    }
    sessionCategories.get(catCode).items.push(transformAthlete(athlete, databaseState, athleteParticipationByAgeGroup));
  });

  if (sessionMap.size === 0) {
    return { status: 'ready', message: 'No athletes found' };
  }

  // 3. Build sessions array (single session if filtered, multiple if not)
  const sessions = [];
  const dbSessions = databaseState.sessions || [];

  // Sort session names
  const sortedSessionNames = Array.from(sessionMap.keys())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  sortedSessionNames.forEach(sName => {
    const sessionCategories = sessionMap.get(sName);
    const dbSession = dbSessions.find(s => s.name === sName) || { name: sName };
    const displayByAgeGroup = true; // TEMP TEST: hardcoded to true
    // const displayByAgeGroup = databaseState.competition?.displayByAgeGroup || false;
    
    // Get all athletes from all categories in this session
    const allSessionAthletes = [];
    sessionCategories.forEach(cat => {
      allSessionAthletes.push(...cat.items);
    });
    
    // First-level grouping: by bodyweight category (gender + weight range)
    // Use both minWeight and maxWeight for correct grouping:
    // - JR/SR 94-110 → same group (same weight range)
    // - YTH 94-999 (superheavy) → different group (different upper bound)
    // - JR/SR 110-999 (superheavy) → different group (different lower bound than YTH superheavy)
    const bodyweightGroups = new Map();
    
    allSessionAthletes.forEach(athlete => {
      const catCode = athlete.categoryCode || '';
      const gender = athlete.gender || '';
      
      // Get weight bounds from categoryMap
      const catInfo = categoryMap.get(catCode);
      const minWeight = catInfo?.minWeight || 0;
      const maxWeight = catInfo?.maxWeight || 999;
      
      // Bodyweight group key: gender + minWeight + maxWeight (e.g., "F_0_48", "M_94_110", "M_94_999")
      const bwKey = `${gender}_${minWeight}_${maxWeight}`;
      
      if (!bodyweightGroups.has(bwKey)) {
        bodyweightGroups.set(bwKey, {
          gender,
          minWeight,
          maxWeight,
          categoryName: catInfo?.categoryName || `${gender} ${maxWeight}`,
          weightDisplay: catInfo?.weightDisplay || String(maxWeight),
          maxAge: catInfo?.maxAge || 999,
          minAge: catInfo?.minAge || 0,
          athletes: []
        });
      }
      
      bodyweightGroups.get(bwKey).athletes.push(athlete);
    });
    
    // Sort bodyweight groups: by gender (F first), then by maxWeight ascending
    const sortedBodyweightGroups = Array.from(bodyweightGroups.values())
      .sort((a, b) => {
        if (a.gender !== b.gender) return a.gender === 'F' ? -1 : 1;
        if (a.maxWeight !== b.maxWeight) return a.maxWeight - b.maxWeight;
        return a.minWeight - b.minWeight;
      });
    
    // Process each bodyweight group
    const finalCategories = [];
    
    sortedBodyweightGroups.forEach(bwGroup => {
      if (displayByAgeGroup) {
        // Sort athletes by age group (younger first), then by lot number
        bwGroup.athletes.sort((a, b) => {
          const aAgeGroup = a.ageGroupName || '';
          const bAgeGroup = b.ageGroupName || '';
          
          if (aAgeGroup !== bAgeGroup) {
            // Get age bounds for each athlete's age group
            const aAgeInfo = categoryMap.get(a.categoryCode);
            const bAgeInfo = categoryMap.get(b.categoryCode);
            
            const aMaxAge = aAgeInfo?.maxAge || 999;
            const aMinAge = aAgeInfo?.minAge || 0;
            const bMaxAge = bAgeInfo?.maxAge || 999;
            const bMinAge = bAgeInfo?.minAge || 0;
            
            // Sort by maxAge (younger first = lower maxAge), then by minAge
            if (aMaxAge !== bMaxAge) return aMaxAge - bMaxAge;
            if (aMinAge !== bMinAge) return aMinAge - bMinAge;
          }
          
          // Within same age group: sort by lot number
          return (a.lotNumber || 0) - (b.lotNumber || 0);
        });
      } else {
        // No age group ordering: just sort by lot number
        bwGroup.athletes.sort((a, b) => (a.lotNumber || 0) - (b.lotNumber || 0));
      }
      
      // Single category row for this bodyweight (no sub-grouping)
      // Use weightDisplay for proper superheavy display (e.g., ">94", ">110")
      finalCategories.push({
        categoryName: `${bwGroup.gender} ${bwGroup.weightDisplay}`,
        categorySortCode: `${bwGroup.gender}_${bwGroup.minWeight}_${bwGroup.maxWeight}`,
        items: bwGroup.athletes
      });
    });

    sessions.push({
      name: dbSession.name,
      description: dbSession.description || '',
      platform: dbSession.platformName || '',
      startTime: formatSessionTime(dbSession.competitionTime),
      athletes: finalCategories,
      ageGroupsWithWeights: extractSessionAgeGroupsWithWeights(dbSession, athletesToProcess, categoryMap, databaseState.ageGroups),
      athleteParticipationByAgeGroup: Object.fromEntries(athleteParticipationByAgeGroup),
      officials: mapOfficials(dbSession, databaseState),
      records: extractRecords(databaseState, finalCategories, sessions.length === 0),
      newRecords: extractNewRecords(databaseState, dbSession.name)
    });
    
    // Debug: Show what participation data looks like for first session
    if (sessions.length === 1) {
      const firstSession = sessions[0];
      logger.debug(`[StartBook] First session athleteParticipationByAgeGroup keys:`, Object.keys(firstSession.athleteParticipationByAgeGroup).slice(0, 3));
      const firstAthleteId = Object.keys(firstSession.athleteParticipationByAgeGroup)[0];
      if (firstAthleteId) {
        logger.debug(`[StartBook] Sample athlete participation (${firstAthleteId}):`, firstSession.athleteParticipationByAgeGroup[firstAthleteId]);
      }
      if (firstSession.athletes[0]?.items[0]) {
        const sampleAthlete = firstSession.athletes[0].items[0];
        logger.debug(`[StartBook] Sample transformed athlete:`, { id: sampleAthlete.id, key: sampleAthlete.key, lotNumber: sampleAthlete.lotNumber });
      }
    }
  });

  // Build participants matrix (Teams × Categories)
  const participants = buildParticipationData(databaseState);

  // Build category participants data (Championship → Gender → Category → Items, sorted by lot number)
  const rankings = buildCategoryParticipantsData(databaseState, transformAthlete, athleteParticipationByAgeGroup);

  // Build all records data structure: Federation → Gender → Age Group (with deduplication - highest value wins)
  const allRecordsData = buildAllRecordsData(databaseState);

  // Get technical officials data
  const technicalOfficials = competitionHub.getTechnicalOfficials?.() || [];
  const technicalOfficialsTimetable = competitionHub.getTimetable?.() || [];

  // Pre-translate official role names for client-side display
  const uniqueRoleCategories = [...new Set(technicalOfficials.map(o => o.teamRole))];
  const officialRoleLabels = {};
  uniqueRoleCategories.forEach(roleCategory => {
    const translationKey = OFFICIAL_ROLE_TRANSLATION_KEYS[roleCategory] || roleCategory;
    officialRoleLabels[roleCategory] = translations[translationKey] || roleCategory;
  });

  const timetableData = buildTimetableData(sessions, technicalOfficialsTimetable);

  // Resolve header logos (try header_left/header_right first, then left/right)
  const headerLeftUrl = getHeaderLogoUrl({ baseNames: ['header_left', 'left'] });
  const headerRightUrl = getHeaderLogoUrl({ baseNames: ['header_right', 'right'] });
  const frontLogoUrl = getHeaderLogoUrl({ baseNames: ['front'] });

  // Cache and return
  const processedData = {
    competition: {
      ...competition,
      frontLogoUrl
    },
    sessions,
    participants,
    rankings,
    allRecords: allRecordsData.records,
    hasRecords: allRecordsData.hasRecords,
    newRecordsBroken: allRecordsData.newRecordsBroken,
    headerLeftUrl,
    headerRightUrl,
    technicalOfficials,
    technicalOfficialsTimetable,
    officialSections: buildOfficialSections(technicalOfficials),
    technicalOfficialsTimetableRows: timetableData.rows,
    technicalOfficialsTimetableRoles: timetableData.roleInfo,
    technicalOfficialsTimetableHasMultiplePlatforms: timetableData.hasMultiplePlatforms,
    officialRoleLabels,
    includeSessionStartLists,
    includeOfficials,
    includeCategoryParticipants,
    productionTime: new Date().toLocaleString(locale, { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    }),
    labels: {
      lot: translations['Lot'] || 'Lot',
      name: translations['Name'] || 'Name',
      birth: translations['Results.Birth'] || 'Birth',
      team: translations['Results.Team'] || 'Team',
      bw: translations['Results.BodyWeight'] || 'BW',
      snatch: translations['Results.Snatch'] || 'Snatch',
      cleanJerk: translations['Results.Clean_and_Jerk'] || 'Clean & Jerk',
      total: translations['Results.Total'] || 'Total',
      rank: translations['Results.Rank'] || 'Rank',
      category: translations['Results.Category'] || 'Category',
      referee: translations['SideReferee'] || 'Referee',
      centerReferee: translations['CenterReferee'] || 'Center Referee',
      jury: translations['Jury.JuryMember'] || 'Jury',
      secretary: translations['CompetitionSecretary'] || 'Secretary',
      doctor: translations['Doctor'] || 'Doctor',
      records: translations['Records'] || 'Records',
      newRecords: translations['NewRecords'] || 'New Records',
      lift: translations['Lift'] || 'Lift',
      value: translations['Value'] || 'Value',
      holder: translations['Holder'] || 'Holder',
      recordName: translations['Record'] || 'Record',
      session: translations['Session'] || 'Session',
      date: translations['Date'] || 'Date',
      time: translations['Time'] || 'Time'
    },
    status: 'ready'
  };

  protocolCache.set(cacheKey, processedData);
  return processedData;
}

function extractRecords(db, sessionCategories = [], isFirstSession = false) {
  const allRecords = db.records || [];
  if (isFirstSession) logger.debug(`[extractRecords] Session 1: Starting with ${allRecords.length} total records in database`);
  
  // Build list of athletes with their matching criteria
  const sessionAthletes = [];
  let athleteCount = 0;
  
  sessionCategories.forEach(category => {
    category.items?.forEach(athlete => {
      athleteCount++;
      
      // Parse record federations (comma-separated, trimmed)
      // Field name is 'federationCodes' in OWLCMS database
      const recordFederationsStr = athlete.federationCodes || athlete.federation || '';
      const recordFederations = recordFederationsStr 
        ? recordFederationsStr.split(',').map(f => f.trim().toUpperCase())
        : []; // Empty array means all federations acceptable
      
      // Get category info to extract age range and weight limit
      // categoryCode format: "SR_F48", "JR_M73", etc.
      const categoryCode = athlete.categoryCode || '';
      
      // Extract maximum body weight from category (subtract 0.1 for upper bound)
      // bwCatUpper from athlete or parse from category code
      let maxBodyWeight = parseFloat(athlete.bwCatUpper) || 999;
      if (!athlete.bwCatUpper && categoryCode) {
        const weightMatch = categoryCode.match(/(\d+)$/);
        if (weightMatch) {
          maxBodyWeight = parseFloat(weightMatch[1]);
        }
      }
      const searchBodyWeight = maxBodyWeight - 0.1;
      
      // Extract maximum age from category's age group
      // ageGrpUpper from athlete or default to 999 for senior
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
  
  if (isFirstSession && sessionAthletes.length > 0) {
    const first = sessionAthletes[0];
    logger.debug(`[extractRecords] Session 1: Found ${sessionAthletes.length} athletes`);
    logger.debug(`[extractRecords] Session 1: First athlete: ${first.name}`);
    logger.debug(`[extractRecords] Session 1: ═══ EXTRACTED VALUES FOR FILTERING ═══`);
    logger.debug(`[extractRecords]   Category code: ${first.categoryCode}`);
    logger.debug(`[extractRecords]   Record federations: ${first.recordFederations.length > 0 ? first.recordFederations.join(', ') : '(ALL ACCEPTABLE)'}`);
    logger.debug(`[extractRecords]   Body weight for search: ${first.bodyWeight} kg (max category weight - 0.1)`);
    logger.debug(`[extractRecords]   Age for search: ${first.age} years (max age for category)`);
    logger.debug(`[extractRecords]   Gender: ${first.gender}`);
  }
  
  // Group records by: federation + lift + gender + ageGrp + bwCatLower + bwCatUpper
  // For each group, keep the record with the highest value
  const recordMap = new Map();
  let matchedCount = 0;
  let loggingComplete = false;
  const firstRecordDetails = [];
  
  allRecords.forEach((r, idx) => {
    // Collect first 5 records for logging
    if (isFirstSession && firstRecordDetails.length < 5) {
      firstRecordDetails.push({
        idx,
        federation: r.recordFederation,
        bwRange: `${r.bwCatLower}-${r.bwCatUpper}`,
        ageRange: `${r.ageGrpLower || '?'}-${r.ageGrpUpper || '?'}`,
        ageGrp: r.ageGrp,
        gender: r.gender,
        lift: r.recordLift,
        name: r.recordName,
        value: r.recordValue
      });
    }
    
    // Skip if missing critical fields
    if (!r.recordFederation || !r.recordLift || !r.gender || 
        r.bwCatLower === undefined || r.bwCatUpper === undefined ||
        r.ageGrpLower === undefined || r.ageGrpUpper === undefined) {
      return;
    }
    
    // Skip new records (those are shown in newRecords section)
    if (r.groupNameString && r.groupNameString !== '') {
      return;
    }
    
    // Log first 5 records structure for Session 1
    if (isFirstSession && !loggingComplete) {
      loggingComplete = true;
      logger.debug(`[extractRecords] Session 1: ═══ EXAMINING RECORDS ═══`);
      logger.debug(`[extractRecords] Session 1: First 5 records in database:`);
      firstRecordDetails.forEach(rec => {
        logger.debug(`[extractRecords]   [${rec.idx}] ${rec.federation} | BW:${rec.bwRange} | Age:${rec.ageRange}(${rec.ageGrp}) | ${rec.gender} | ${rec.lift} | ${rec.name} ${rec.value}kg`);
      });
    }
    
    // Check if record matches any athlete in session
    let matched = false;
    for (const athlete of sessionAthletes) {
      // 1. Check federation (if athlete has record federations, must match one; if empty, all acceptable)
      const federationMatch = athlete.recordFederations.length === 0 || 
                             athlete.recordFederations.includes(r.recordFederation.toUpperCase());
      
      // 2. Check gender (exact match)
      const genderMatch = athlete.gender === r.gender;
      
      // 3. Check body weight (athlete's BW must be within record's range: lower exclusive, upper inclusive)
      const bwMatch = athlete.bodyWeight > r.bwCatLower && athlete.bodyWeight <= r.bwCatUpper;
      
      // 4. Check age (athlete's age must be within record's age range)
      const ageMatch = athlete.age >= r.ageGrpLower && athlete.age <= r.ageGrpUpper;
      
      if (federationMatch && genderMatch && bwMatch && ageMatch) {
        matched = true;
        if (isFirstSession && matchedCount < 3) {
          logger.debug(`[extractRecords] Session 1: ✓ MATCHED record [${idx}]: ${r.recordName} for ${athlete.name}`);
          logger.debug(`[extractRecords]   Federation: ${r.recordFederation} (athlete accepts: ${athlete.recordFederations.join(', ') || 'ALL'})`);
          logger.debug(`[extractRecords]   BW: ${athlete.bodyWeight} in [${r.bwCatLower}, ${r.bwCatUpper}]`);
          logger.debug(`[extractRecords]   Age: ${athlete.age} in [${r.ageGrpLower}, ${r.ageGrpUpper}]`);
          logger.debug(`[extractRecords]   Gender: ${athlete.gender} === ${r.gender}`);
        }
        break;
      }
    }
    
    if (!matched) {
      return;
    }
    
    matchedCount++;
    
    // Create a unique key for this record type (including age group and weight boundaries)
    const key = `${r.recordFederation}|${r.recordLift}|${r.gender}|${r.ageGrp || ''}|${r.bwCatLower}|${r.bwCatUpper}`;
    
    const existing = recordMap.get(key);
    const currentValue = parseFloat(r.recordValue) || 0;
    
    // Keep the record with the highest value
    if (!existing || currentValue > parseFloat(existing.recordValue || 0)) {
      recordMap.set(key, r);
    }
  });
  
  if (isFirstSession) {
    logger.debug(`[extractRecords] Session 1: Matched ${matchedCount} records out of ${allRecords.length}`);
    logger.debug(`[extractRecords] Session 1: Final recordMap has ${recordMap.size} unique records`);
  }
  
  // Convert map to array and format for display
  const sessionRecords = Array.from(recordMap.values()).map(r => {
    const athleteTeam = getAthleteTeam(db, r.athleteName);
    
    return {
      federation: r.recordFederation || 'WFA',
      recordName: r.recordName,
      ageGroup: r.ageGrp || '',
      category: r.bwCatString || '',
      categoryCode: r.bwCatString || '',
      lift: r.recordLift,
      value: r.recordValue,
      holder: r.athleteName,
      nation: athleteTeam || r.nation || '',
      born: ''
    };
  });
  
  if (isFirstSession) logger.debug(`[extractRecords] Session 1: Returning ${sessionRecords.length} formatted session records`);

  return sessionRecords;
}

function extractNewRecords(db, sessionName) {
  const allRecords = db.records || [];
  return allRecords
    .filter(r => r.groupNameString === sessionName)
    .map(r => {
      const athleteTeam = getAthleteTeam(db, r.athleteName);
      
      return {
        federation: r.recordFederation || 'WFA',
        recordName: r.recordName,
        ageGroup: r.ageGrp || '',
        category: r.bwCatString || '',
        categoryCode: r.bwCatString || '',
        lift: r.recordLift,
        value: r.recordValue,
        holder: r.athleteName,
        nation: athleteTeam || r.nation || '',
        born: ''
      };
    });
}

function getAthleteTeam(db, athleteName) {
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

function transformAthlete(a, db, athleteParticipationByAgeGroup) {
  const teamName = a.teamName || (a.team ? db.teams?.find(t => t.id === a.team)?.name : '');
  
  // Find ranks in participations
  const p = a.participations?.[0] || {};
  const totalRank = p.totalRank || a.totalRank || '';
  const snatchRank = p.snatchRank || a.snatchRank || '';
  const cleanJerkRank = p.cleanJerkRank || a.cleanJerkRank || '';

  // Get athlete's age group participation (computed server-side)
  const athleteId = a.id || a.key;
  const ageGroupParticipation = athleteParticipationByAgeGroup.get(athleteId) || {};
  
  // Extract age group name from category code (e.g., "YTH_F58" -> look up in categoryMap)
  let ageGroupName = '';
  if (a.categoryCode && db.ageGroups) {
    // Find the age group that contains this category
    const ageGroup = db.ageGroups.find(ag => 
      ag.categories?.some(cat => cat.code === a.categoryCode)
    );
    if (ageGroup) {
      ageGroupName = ageGroup.championshipName || ageGroup.name || '';
    }
  }

  // Use database values if available (V2 export includes these computed fields)
  // Otherwise compute from actual lifts
  let bestSnatchValue, bestCleanJerkValue, computedTotal;
  
  if (a.bestSnatch !== null && a.bestSnatch !== undefined) {
    // V2 export: use precomputed values from database
    bestSnatchValue = a.bestSnatch || 0;
    bestCleanJerkValue = a.bestCleanJerk || 0;
    computedTotal = a.total || 0;
  } else {
    // V1 export or missing data: compute from actual lifts
    const snatchLifts = [a.snatch1ActualLift, a.snatch2ActualLift, a.snatch3ActualLift]
      .filter(val => val && val > 0);
    bestSnatchValue = snatchLifts.length > 0 ? Math.max(...snatchLifts) : 0;
    
    const cleanJerkLifts = [a.cleanJerk1ActualLift, a.cleanJerk2ActualLift, a.cleanJerk3ActualLift]
      .filter(val => val && val > 0);
    bestCleanJerkValue = cleanJerkLifts.length > 0 ? Math.max(...cleanJerkLifts) : 0;
    
    computedTotal = (bestSnatchValue > 0 && bestCleanJerkValue > 0) ? (bestSnatchValue + bestCleanJerkValue) : 0;
  }

  // Calculate TeamPoints based on totalRank (1st=tp1, 2nd=tp2, 3rd=tp2-1, 4th=tp2-2, etc. until 0)
  let teamPoints = 0;
  if (totalRank === 1) {
    teamPoints = db.competition?.teamPoints1st || 28;
  } else if (totalRank === 2) {
    teamPoints = db.competition?.teamPoints2nd || 26;
  } else if (totalRank > 2) {
    const tp2 = db.competition?.teamPoints2nd || 26;
    teamPoints = Math.max(0, tp2 - (totalRank - 2));
  }

  return {
    id: a.id,
    key: a.key,
    lastName: (a.lastName || '').toUpperCase(),
    firstName: a.firstName || '',
    categoryName: a.categoryName || '',
    categoryCode: a.categoryCode || '',
    ageGroupName,  // Age group for sorting when displayByAgeGroup is enabled
    gender: a.gender || '',
    formattedBirth: a.fullBirthDate ? a.fullBirthDate[0] : '',
    lotNumber: a.lotNumber,
    team: teamName,
    bodyWeight: a.bodyWeight ? a.bodyWeight.toFixed(2) : '',
    participations: a.participations || [],
    
    // Age group participation - pre-computed server-side
    ageGroupParticipation,
    
    // Snatch
    snatch1: formatAttempt(a.snatch1ActualLift, a.snatch1Change2 || a.snatch1Change1 || a.snatch1Declaration),
    snatch2: formatAttempt(a.snatch2ActualLift, a.snatch2Change2 || a.snatch2Change1 || a.snatch2Declaration),
    snatch3: formatAttempt(a.snatch3ActualLift, a.snatch3Change2 || a.snatch3Change1 || a.snatch3Declaration),
    bestSnatch: bestSnatchValue > 0 ? String(bestSnatchValue) : '',
    snatchRank: snatchRank === 0 ? '' : snatchRank,

    // Clean & Jerk
    cleanJerk1: formatAttempt(a.cleanJerk1ActualLift, a.cleanJerk1Change2 || a.cleanJerk1Change1 || a.cleanJerk1Declaration),
    cleanJerk2: formatAttempt(a.cleanJerk2ActualLift, a.cleanJerk2Change2 || a.cleanJerk2Change1 || a.cleanJerk2Declaration),
    cleanJerk3: formatAttempt(a.cleanJerk3ActualLift, a.cleanJerk3Change2 || a.cleanJerk3Change1 || a.cleanJerk3Declaration),
    bestCleanJerk: bestCleanJerkValue > 0 ? String(bestCleanJerkValue) : '',
    cleanJerkRank: cleanJerkRank === 0 ? '' : cleanJerkRank,

    // Use computed total (not the database field which may be 0) or fall back to database total
    total: computedTotal > 0 ? String(computedTotal) : (a.total ? String(a.total) : ''),
    totalRank: totalRank === 0 ? '' : totalRank,
    
    // Team points for 1st/2nd place
    teamPoints
  };
}

function formatAttempt(actual, declared) {
  if (actual !== null && actual !== undefined && actual !== '') {
    const val = parseFloat(actual);
    if (val === 0) return '-';
    if (val < 0) return `(${Math.abs(val)})`;
    return String(val);
  }
  return declared ? String(declared) : '';
}

function formatSessionTime(timeArray) {
  if (!timeArray || !Array.isArray(timeArray)) return '';
  const [y, m, d, h, min] = timeArray;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function mapOfficials(session, db) {
  const officials = {};
  const toList = db.technicalOfficials || [];
  
  logger.error(`[mapOfficials] Called for session ${session.name}, technicalOfficials count: ${toList.length}`);
  logger.error(`[mapOfficials] Session official fields:`, JSON.stringify({
    referee1: session.referee1,
    referee2: session.referee2,
    referee3: session.referee3,
    refereeReserve: session.refereeReserve,
    marshall: session.marshall,
    marshall2: session.marshall2,
    timeKeeper: session.timeKeeper,
    technicalController: session.technicalController,
    technicalController2: session.technicalController2,
    doctor: session.doctor,
    doctor2: session.doctor2,
    secretary: session.secretary,
    juryPresident: session.juryPresident
  }, null, 2));
  if (toList.length > 0) {
    logger.error(`[mapOfficials] First official sample:`, JSON.stringify(toList[0], null, 2));
  }

  // Map session fields to officials
  const fieldMappings = {
    centerReferee: session.referee1,
    sideReferee1: session.referee2,
    sideReferee2: session.referee3,
    sideReferee3: session.referee4,
    reserveReferee: session.refereeReserve,
    technicalController1: session.technicalController,
    technicalController2: session.technicalController2,
    juryPresident: session.juryPresident,
    juryMember1: session.jury1,
    juryMember2: session.jury2,
    juryMember3: session.jury3,
    juryMember4: session.jury4,
    juryMember5: session.jury5,
    competitionSecretary: session.secretary,
    competitionSecretary2: session.secretary2,
    doctor1: session.doctor,
    doctor2: session.doctor2,
    marshal1: session.marshall,
    marshal2: session.marshal2,
    timekeeper: session.timeKeeper
  };

  Object.entries(fieldMappings).forEach(([officialKey, officialNameOrId]) => {
    if (officialNameOrId) {
      // Session stores official names as strings, not IDs - match by fullName
      const to = toList.find(o => 
        o.id === officialNameOrId || 
        o.key === officialNameOrId || 
        o.fullName === officialNameOrId ||
        o.fullName?.toUpperCase() === String(officialNameOrId).toUpperCase()
      );
      if (to) {
        const fullName = `${to.lastName?.toUpperCase() || ''} ${to.firstName || ''}`.trim();
        const federation = to.federation || '';
        logger.error(`[mapOfficials] ${officialKey}: name=${officialNameOrId}, FOUND, fullName=${fullName}, federation='${federation}'`);
        officials[officialKey] = { 
          fullName,
          federation
        };
      } else {
        logger.error(`[mapOfficials] ${officialKey}: name=${officialNameOrId} NOT FOUND in technicalOfficials list`);
        officials[officialKey] = { fullName: String(officialNameOrId), federation: '' };
      }
    }
  });

  // Special handling for Jury: if no president but jury members exist, first one is president
  if (!officials.juryPresident) {
    for (let i = 1; i <= 5; i++) {
      if (officials[`juryMember${i}`]) {
        officials.juryPresident = officials[`juryMember${i}`];
        delete officials[`juryMember${i}`];
        break;
      }
    }
  }

  return officials;
}
/**
 * Build rankings data structure grouped by Championship → Gender
 * Each group contains multiple categories (like session protocols)
 */
function buildRankingsData(db, transformAthleteFn) {
  const athletes = db.athletes || [];
  const ageGroups = db.ageGroups || [];
  
  if (athletes.length === 0) return [];
  
  // Build age group lookup for championship info - map by category CODE (not id)
  const ageGroupMap = new Map();
  ageGroups.forEach(ag => {
    // Skip inactive age groups — only active groups should contribute mappings
    if (ag.active === false) return;
    ag.categories?.forEach(cat => {
      // Map by category code (e.g., "SR_F48") which matches athlete.categoryCode
      ageGroupMap.set(cat.code, {
        championshipName: ag.championshipName || ag.code || 'Open',
        ageGroupCode: ag.code,
        maxAge: ag.maxAge || 999,
        minAge: ag.minAge || 0
      });
    });
  });
  
  // Group athletes by Championship → Gender → Category
  const championshipMap = new Map();
  
  athletes.forEach(athlete => {
    // 🎯 FILTERING: Session unknown -- athlete not in session -- should not be included in the rankings
    if (!athlete.sessionName || athlete.sessionName === 'Unknown') return;

    // Transform athlete once
    const transformed = transformAthleteFn(athlete, db);
    
    // Use participations if available, otherwise create a synthetic one from categoryCode
    let participationsToProcess = athlete.participations;
    if (!participationsToProcess || participationsToProcess.length === 0) {
      // Athlete has no participations - create a default entry from their categoryCode
      if (!athlete.categoryCode) return; // Skip athletes with no category at all
      participationsToProcess = [{
        categoryCode: athlete.categoryCode,
        totalRank: athlete.totalRank,
        snatchRank: athlete.snatchRank,
        cleanJerkRank: athlete.cleanJerkRank
      }];
    }
    
    participationsToProcess.forEach(p => {
      const gender = athlete.gender || 'M';
      const catCode = p.categoryCode || athlete.categoryCode;
      
      // Get category weight for sorting
      const catWeight = extractMaxWeight(catCode);

      // Always resolve championship via category map
      const info = catCode ? ageGroupMap.get(catCode) : null;
      const champName = info?.championshipName || 'Open';
      
      // Use championshipName as the grouping key (e.g., "Senior", "Youth", "Masters")
      if (!championshipMap.has(champName)) {
        championshipMap.set(champName, {
          name: champName,
          genders: new Map()
        });
      }
      
      const champ = championshipMap.get(champName);
      
      if (!champ.genders.has(gender)) {
        champ.genders.set(gender, {
          gender,
          genderName: gender === 'F' ? 'Women' : 'Men',
          categories: new Map()
        });
      }
      
      const genderGroup = champ.genders.get(gender);
      
      if (!genderGroup.categories.has(catCode)) {
        genderGroup.categories.set(catCode, {
          categoryCode: catCode,
          categoryName: athlete.categoryName || catCode,
          maximumWeight: catWeight,
          items: [],
          seenLotNumbers: new Set()  // Track which athletes are already added
        });
      }
      
      const category = genderGroup.categories.get(catCode);
      
      // Avoid duplicate athletes (same lotNumber in same category)
      const lotKey = athlete.lotNumber || athlete.key || `${athlete.lastName}-${athlete.firstName}`;
      if (category.seenLotNumbers.has(lotKey)) {
        return; // Skip duplicate
      }
      category.seenLotNumbers.add(lotKey);
      
      // Add athlete with participation-specific ranks
      category.items.push({
        ...transformed,
        totalRank: p.totalRank || transformed.totalRank || '',
        snatchRank: p.snatchRank || transformed.snatchRank || '',
        cleanJerkRank: p.cleanJerkRank || transformed.cleanJerkRank || ''
      });
    });
  });
  
  // Convert to sorted array structure
  const rankings = Array.from(championshipMap.values())
    .sort((a, b) => {
      // Sort order: IWF first, then others alphabetically, DEFAULT last
      const order = { 'IWF': 0, 'U': 1, 'MASTERS': 2, 'DEFAULT': 99 };
      return (order[a.type] ?? 50) - (order[b.type] ?? 50);
    })
    .map(champ => ({
      ...champ,
      genders: Array.from(champ.genders.values())
        .sort((a, b) => a.gender === 'F' ? -1 : 1) // Women first
        .map(genderGroup => ({
          ...genderGroup,
          categories: Array.from(genderGroup.categories.values())
            .sort((a, b) => a.maximumWeight - b.maximumWeight) // Lightest first
            .map(cat => ({
              ...cat,
              items: cat.items.sort((a, b) => {
                // Sort order: Total Rank -> CJ Rank -> Snatch Rank -> Lot Number
                // Ranks are 1, 2, 3... 
                // EXCEPTION: A rank of 0 or empty sorts last (treated as 9999)
                
                let aTotalRank = parseInt(a.totalRank);
                if (isNaN(aTotalRank) || aTotalRank === 0) aTotalRank = 9999;
                let bTotalRank = parseInt(b.totalRank);
                if (isNaN(bTotalRank) || bTotalRank === 0) bTotalRank = 9999;
                if (aTotalRank !== bTotalRank) return aTotalRank - bTotalRank;

                let aCJRank = parseInt(a.cleanJerkRank);
                if (isNaN(aCJRank) || aCJRank === 0) aCJRank = 9999;
                let bCJRank = parseInt(b.cleanJerkRank);
                if (isNaN(bCJRank) || bCJRank === 0) bCJRank = 9999;
                if (aCJRank !== bCJRank) return aCJRank - bCJRank;

                let aSnatchRank = parseInt(a.snatchRank);
                if (isNaN(aSnatchRank) || aSnatchRank === 0) aSnatchRank = 9999;
                let bSnatchRank = parseInt(b.snatchRank);
                if (isNaN(bSnatchRank) || bSnatchRank === 0) bSnatchRank = 9999;
                if (aSnatchRank !== bSnatchRank) return aSnatchRank - bSnatchRank;
                
                // Final tie-breaker: lot number
                return (a.lotNumber || 0) - (b.lotNumber || 0);
              })
            }))
        }))
    }));
  
  return rankings;
}

/**
 * Build category participants data structure - similar to buildRankingsData but sorted by lot number
 * Structure: Championship → Gender → Category → Items (sorted by lotNumber ascending)
 * Items are deduped via seenLotNumbers Set, same as Rankings
 */
function buildCategoryParticipantsData(db, transformAthleteFn, athleteParticipationByAgeGroup) {
  const athletes = db.athletes || [];
  const ageGroups = db.ageGroups || [];
  
  if (athletes.length === 0) return [];
  
  // Build age group lookup for championship info - map by category CODE (not id)
  const ageGroupMap = new Map();
  ageGroups.forEach(ag => {
    // Skip inactive age groups — only active groups should contribute mappings
    if (ag.active === false) return;
    ag.categories?.forEach(cat => {
      // Map by category code (e.g., "SR_F48") which matches athlete.categoryCode
      ageGroupMap.set(cat.code, {
        championshipName: ag.championshipName || ag.code || 'Open',
        ageGroupCode: ag.code,
        maxAge: ag.maxAge || 999,
        minAge: ag.minAge || 0
      });
    });
  });
  
  // Group athletes by Championship → Gender → Category
  const championshipMap = new Map();
  
  athletes.forEach(athlete => {
    // 🎯 FILTERING: Session unknown -- athlete not in session -- should not be included
    if (!athlete.sessionName || athlete.sessionName === 'Unknown') return;

    // Transform athlete once - pass the athleteParticipationByAgeGroup map
    const transformed = transformAthleteFn(athlete, db, athleteParticipationByAgeGroup);
    
    // Use participations if available, otherwise create a synthetic one from categoryCode
    let participationsToProcess = athlete.participations;
    if (!participationsToProcess || participationsToProcess.length === 0) {
      // Athlete has no participations - create a default entry from their categoryCode
      if (!athlete.categoryCode) return; // Skip athletes with no category at all
      participationsToProcess = [{
        categoryCode: athlete.categoryCode,
        totalRank: athlete.totalRank,
        snatchRank: athlete.snatchRank,
        cleanJerkRank: athlete.cleanJerkRank
      }];
    }
    
    participationsToProcess.forEach(p => {
      const gender = athlete.gender || 'M';
      const catCode = p.categoryCode || athlete.categoryCode;
      
      // Get category weight for sorting
      const catWeight = extractMaxWeight(catCode);

      // Always resolve championship via category map
      const info = catCode ? ageGroupMap.get(catCode) : null;
      const champName = info?.championshipName || 'Open';
      
      // Use championshipName as the grouping key (e.g., "Senior", "Youth", "Masters")
      if (!championshipMap.has(champName)) {
        championshipMap.set(champName, {
          name: champName,
          genders: new Map()
        });
      }
      
      const champ = championshipMap.get(champName);
      
      if (!champ.genders.has(gender)) {
        champ.genders.set(gender, {
          gender,
          genderName: gender === 'F' ? 'Women' : 'Men',
          categories: new Map()
        });
      }
      
      const genderGroup = champ.genders.get(gender);
      
      if (!genderGroup.categories.has(catCode)) {
        genderGroup.categories.set(catCode, {
          categoryCode: catCode,
          categoryName: athlete.categoryName || catCode,
          maximumWeight: catWeight,
          items: [],
          seenLotNumbers: new Set()  // Track which athletes are already added
        });
      }
      
      const category = genderGroup.categories.get(catCode);
      
      // Avoid duplicate athletes (same lotNumber in same category)
      const lotKey = athlete.lotNumber || athlete.key || `${athlete.lastName}-${athlete.firstName}`;
      if (category.seenLotNumbers.has(lotKey)) {
        return; // Skip duplicate
      }
      category.seenLotNumbers.add(lotKey);
      
      // Add athlete to category
      category.items.push(transformed);
    });
  });
  
  // Convert to sorted array structure
  const participants = Array.from(championshipMap.values())
    .sort((a, b) => {
      // Sort order: IWF first, then others alphabetically, DEFAULT last
      const order = { 'IWF': 0, 'U': 1, 'MASTERS': 2, 'DEFAULT': 99 };
      return (order[a.type] ?? 50) - (order[b.type] ?? 50);
    })
    .map(champ => ({
      ...champ,
      genders: Array.from(champ.genders.values())
        .sort((a, b) => a.gender === 'F' ? -1 : 1) // Women first
        .map(genderGroup => ({
          ...genderGroup,
          categories: Array.from(genderGroup.categories.values())
            .sort((a, b) => a.maximumWeight - b.maximumWeight) // Lightest first
            .map(cat => ({
              ...cat,
              // IMPORTANT: Sort items by LOT NUMBER ONLY (ascending)
              // This is different from Rankings which sorts by rank fields first
              items: cat.items.sort((a, b) => (a.lotNumber || 0) - (b.lotNumber || 0))
            }))
        }))
    }));
  
  return participants;
}

function getChampionshipDisplayName(type) {
  const names = {
    'DEFAULT': 'Open Championship',
    'IWF': 'IWF Championship',
    'U': 'Youth Championship',
    'MASTERS': 'Masters Championship'
  };
  return names[type] || type;
}

function extractMaxWeight(categoryCode) {
  // Extract number from category code like "SR_M89" → 89, or "M 65" → 65
  const match = categoryCode?.match(/(\d+)\s*$/);
  return match ? parseInt(match[1]) : 999;
}

/**
 * Build all records data structure grouped by Federation → Gender → Age Group
 * Includes ALL records (not just new ones), with deduplication - highest value wins
 */
function buildAllRecordsData(db) {
  const allRecords = db.records || [];
  logger.warn('[buildAllRecordsData] Total records in DB:', allRecords.length);
  
  // hasRecords = true if any records are loaded (even if none broken during competition)
  const hasRecords = allRecords.length > 0;
  
  if (!hasRecords) {
    logger.warn('[buildAllRecordsData] No records found, returning object with hasRecords=false');
    return { hasRecords: false, newRecordsBroken: false, records: [] };
  }

  // Count records by federation and groupNameString status
  const fedCounts = {};
  const newRecordsByFed = {};
  allRecords.forEach(r => {
    const fed = r.recordFederation || 'UNKNOWN';
    fedCounts[fed] = (fedCounts[fed] || 0) + 1;
    if (r.groupNameString && r.groupNameString !== '') {
      newRecordsByFed[fed] = (newRecordsByFed[fed] || 0) + 1;
    }
  });
  logger.warn('[buildAllRecordsData] Records by federation:', fedCounts);
  logger.warn('[buildAllRecordsData] NEW records by federation:', newRecordsByFed);

  // Deduplication map: federation + lift + gender + ageGrp + bwCatLower + bwCatUpper -> highest record value
  const dedupeMap = new Map();
  let recordsWithGroup = 0;

  allRecords.forEach(r => {
    // Count new records
    if (r.groupNameString && r.groupNameString !== '') {
      recordsWithGroup++;
    }
    
    // Create deduplication key (for highest value wins)
    const dedupKey = `${r.recordFederation || 'WFA'}|${r.recordLift}|${r.gender || 'M'}|${r.ageGrp || 'Open'}|${r.bwCatLower || 0}|${r.bwCatUpper || 999}`;
    
    const existing = dedupeMap.get(dedupKey);
    const currentValue = parseFloat(r.recordValue) || 0;
    
    // Keep the record with the highest value
    if (!existing || currentValue > parseFloat(existing.recordValue || 0)) {
      dedupeMap.set(dedupKey, r);
    }
  });

  // Grouping: Federation -> Gender -> Age Group
  const fedMap = new Map();

  dedupeMap.forEach(r => {
    const fed = r.recordFederation || 'WFA';
    const gender = r.gender || 'M';
    const ageGrp = r.ageGrp || 'Open';
    const ageGrpUpper = r.ageGrpUpper || 999;

    if (!fedMap.has(fed)) {
      fedMap.set(fed, new Map());
    }
    const genderMap = fedMap.get(fed);

    if (!genderMap.has(gender)) {
      genderMap.set(gender, new Map());
    }
    const ageMap = genderMap.get(gender);

    if (!ageMap.has(ageGrp)) {
      ageMap.set(ageGrp, {
        name: ageGrp,
        upperLimit: ageGrpUpper,
        records: []
      });
    }
    
    const athleteTeam = getAthleteTeam(db, r.athleteName);
    
    ageMap.get(ageGrp).records.push({
      recordName: r.recordName,
      category: r.bwCatString || '',
      lift: r.recordLift,
      value: r.recordValue,
      holder: r.athleteName,
      nation: athleteTeam || r.nation || '',
      isNew: !!(r.groupNameString && r.groupNameString !== '')
    });
  });

  // Convert to sorted array
  logger.warn('[buildAllRecordsData] Total unique records (after deduplication):', dedupeMap.size);
  logger.warn('[buildAllRecordsData] New records set during competition:', recordsWithGroup);
  logger.warn('[buildAllRecordsData] Federation map size:', fedMap.size);
  
  const result = Array.from(fedMap.entries())
    .sort(([fedA], [fedB]) => {
      if (fedA === 'IWF') return -1;
      if (fedB === 'IWF') return 1;
      return fedA.localeCompare(fedB);
    })
    .map(([fedName, genderMap]) => ({
      federation: fedName,
      genders: Array.from(genderMap.entries())
        .sort(([genA], [genB]) => genA === 'F' ? -1 : 1)
        .map(([gender, ageMap]) => ({
          gender,
          genderName: gender === 'F' ? 'Women' : 'Men',
          ageGroups: Array.from(ageMap.values())
            .sort((a, b) => a.upperLimit - b.upperLimit)
        }))
    }));
  
  logger.warn('[buildAllRecordsData] Returning result with', result.length, 'federations');
  result.forEach(fed => {
    fed.genders.forEach(gen => {
      const totalRecords = gen.ageGroups.reduce((sum, ag) => sum + ag.records.length, 0);
      logger.warn(`[buildAllRecordsData]   ${fed.federation} - ${gen.genderName}: ${totalRecords} records`);
    });
  });
  
  const newRecordsBroken = recordsWithGroup > 0;
  logger.warn('[buildAllRecordsData] hasRecords:', hasRecords, 'newRecordsBroken:', newRecordsBroken);
  
  return {
    hasRecords,
    newRecordsBroken,
    records: result
  };
}

/**
 * Build team participation matrix: Teams × Categories
 * Returns { teams: [...], womenCategories: [...], menCategories: [...], matrix: Map<team, Map<catCode, count>> }
 */
function buildParticipationData(db) {
  logger.warn('[Participation] buildParticipationData: start');
  const athletes = db?.athletes || [];
  logger.debug(`[Participation] Athletes count: ${athletes.length}`);
  if (athletes.length === 0) return { championships: [] };

  const ageGroups = db?.ageGroups || [];
  logger.debug(`[Participation] Age groups count: ${ageGroups.length}`);

  // Build team ID to name lookup
  const teamIdToName = new Map();
  (db?.teams || []).forEach(t => {
    if (t.id != null && t.name) {
      teamIdToName.set(t.id, t.name);
    }
  });
  logger.debug(`[Participation] Teams lookup size: ${teamIdToName.size}`);

  // Build category-to-championship lookup AND category name lookup
  const catToChampionship = new Map();
  const catToName = new Map();  // catCode -> categoryName for display
  const catToWeight = new Map();  // catCode -> maximumWeight for sorting
  const catToGender = new Map();  // catCode -> 'M' or 'F'
  ageGroups.forEach(ag => {
    if (ag.active === false) return;
    ag.categories?.forEach(cat => {
      catToChampionship.set(cat.code, {
        championshipName: ag.championshipName || ag.code || 'Open'
      });
      catToName.set(cat.code, cat.categoryName || cat.code);
      catToWeight.set(cat.code, cat.maximumWeight || 999);
      // Extract gender from category code (e.g., "SR_M89" -> "M", "YTH_F58" -> "F")
      const genderMatch = cat.code?.match(/[_\s]([MF])/);
      catToGender.set(cat.code, genderMatch ? genderMatch[1] : 'M');
    });
  });
  logger.debug(`[Participation] Category-to-championship map size: ${catToChampionship.size}`);

  // Group by championship: { champName -> { teamCounts, womenCatSet, menCatSet } }
  // Pre-populate ALL categories from age groups into each championship
  const championshipMap = new Map();
  ageGroups.forEach(ag => {
    if (ag.active === false) return;
    const champName = ag.championshipName || ag.code || 'Open';
    
    if (!championshipMap.has(champName)) {
      championshipMap.set(champName, {
        name: champName,
        teamCounts: new Map(),
        womenCatSet: new Set(),
        menCatSet: new Set()
      });
    }
    
    const champ = championshipMap.get(champName);
    
    // Add ALL categories from this age group to the appropriate gender set
    ag.categories?.forEach(cat => {
      const gender = catToGender.get(cat.code) || 'M';
      if (gender === 'F') {
        champ.womenCatSet.add(cat.code);
      } else {
        champ.menCatSet.add(cat.code);
      }
    });
  });

  // Helper to resolve team name
  function resolveTeam(a) {
    let team = a.team || a.club || 'Unknown';
    if (typeof team === 'number') {
      team = teamIdToName.get(team) || `Team ${team}`;
    }
    return String(team);
  }

  // Debug: check first few athletes
  athletes.slice(0, 3).forEach((a, i) => {
    logger.debug(`[Participation] Athlete ${i}: team=${a.team} (type: ${typeof a.team}), categoryCode=${a.categoryCode}, participations=${JSON.stringify(a.participations?.length || 0)}`);
  });

  // Process each athlete's participations
  athletes.forEach(a => {
    const team = resolveTeam(a);
    const gender = (a.gender || 'M').toUpperCase();

    if (team === 'JOR' || team === 'PLE') {
      logger.warn(`[Participation] Processing athlete for team ${team}: cat=${a.categoryCode}, participations=${JSON.stringify(a.participations || [])}`);
    }

    // Get participations or create synthetic one
    let participations = a.participations;
    if (!participations || participations.length === 0) {
      if (!a.categoryCode) return;
      participations = [{ categoryCode: a.categoryCode }];
    }

    participations.forEach(p => {
      const catCode = p.categoryCode || a.categoryCode;
      if (!catCode) return;

      // Resolve championship via category map
      const info = catToChampionship.get(catCode);
      const champName = info?.championshipName || 'Open';

      // Get championship entry (should already exist from pre-population)
      const champ = championshipMap.get(champName);
      if (!champ) {
        logger.warn(`[Participation] Warning: Championship "${champName}" not found for category ${catCode}`);
        return;
      }

      // Initialize team entry for this championship
      if (!champ.teamCounts.has(team)) {
        champ.teamCounts.set(team, { categories: new Map(), womenTotal: 0, menTotal: 0, total: 0 });
        if (team === 'JOR' || team === 'PLE') {
          logger.warn(`[Participation] Created team entry for ${team} in championship ${champName}`);
        }
      }
      const teamData = champ.teamCounts.get(team);

      // Increment category count
      const current = teamData.categories.get(catCode) || 0;
      teamData.categories.set(catCode, current + 1);

      // Increment totals
      if (gender === 'F') {
        teamData.womenTotal++;
      } else {
        teamData.menTotal++;
      }
      teamData.total++;
    });
  });

  // Sort categories by weight (using the lookup map)
  function getCatWeight(catCode) {
    return catToWeight.get(catCode) || 999;
  }

  // Build output for each championship
  logger.debug(`[Participation] Championship map size: ${championshipMap.size}`);
  championshipMap.forEach((v, k) => {
    logger.debug(`[Participation] Championship "${k}": ${v.teamCounts.size} teams, ${v.womenCatSet.size} women cats, ${v.menCatSet.size} men cats`);
  });
  
  const championships = Array.from(championshipMap.values()).map(champ => {
    // Sort by weight using the lookup
    const womenCatCodes = Array.from(champ.womenCatSet).sort((a, b) => getCatWeight(a) - getCatWeight(b));
    const menCatCodes = Array.from(champ.menCatSet).sort((a, b) => getCatWeight(a) - getCatWeight(b));
    
    // Build category objects with code and name
    const womenCategories = womenCatCodes.map(code => ({ code, name: catToName.get(code) || code }));
    const menCategories = menCatCodes.map(code => ({ code, name: catToName.get(code) || code }));
    
    logger.debug(`[Participation] Women categories: ${JSON.stringify(womenCategories)}`);
    logger.debug(`[Participation] Men categories: ${JSON.stringify(menCategories)}`);

    // Sort teams alphabetically
    const teams = Array.from(champ.teamCounts.keys()).sort((a, b) => a.localeCompare(b));

    // Build rows for display
    const rows = teams.map(team => {
      const teamData = champ.teamCounts.get(team);
      const row = {
        team,
        womenTotal: teamData.womenTotal,
        menTotal: teamData.menTotal,
        total: teamData.total,
        womenCells: womenCatCodes.map(code => teamData.categories.get(code) || 0),
        menCells: menCatCodes.map(code => teamData.categories.get(code) || 0)
      };

      if (team === 'JOR' || team === 'PLE') {
        logger.warn(`[Participation] Row for ${team} in ${champ.name}: womenCells=${JSON.stringify(row.womenCells)}, menCells=${JSON.stringify(row.menCells)}, totals w:${row.womenTotal} m:${row.menTotal} t:${row.total}`);
      }

      return row;
    });

    // Build column totals
    const womenColTotals = womenCatCodes.map((code, i) => rows.reduce((sum, r) => sum + r.womenCells[i], 0));
    const menColTotals = menCatCodes.map((code, i) => rows.reduce((sum, r) => sum + r.menCells[i], 0));

    return {
      name: champ.name,
      womenCategories,
      menCategories,
      rows,
      totals: {
        womenCells: womenColTotals,
        menCells: menColTotals,
        womenTotal: rows.reduce((sum, r) => sum + r.womenTotal, 0),
        menTotal: rows.reduce((sum, r) => sum + r.menTotal, 0),
        total: rows.reduce((sum, r) => sum + r.total, 0)
      }
    };
  });

  logger.debug(`[Participation] Returning ${championships.length} championships`);
  championships.forEach(c => {
    logger.warn(`[Participation] Championship ${c.name}: rows=${c.rows?.length || 0}, womenCats=${c.womenCategories.length}, menCats=${c.menCategories.length}`);
  });
  if (championships.length > 0) {
    logger.debug(`[Participation] First championship has ${championships[0].rows?.length} rows`);
  }

  logger.warn('[Participation] buildParticipationData: end');

  return { championships };
}

/**
 * Build team points by scanning all athletes and their ranks.
 * Formula: 1st=tp1, 2nd=tp2, 3rd=tp3, 4th=tp3-1, 5th=tp3-2, etc. down to 0
 * If includeSnCj is true, include snatch and clean&jerk ranks in addition to total ranks.
 * If topNMale or topNFemale are set (>0), only count the top N scores per team+gender.
 * Returns { championships:[], women:[], men:[], combined:[] } with team points per team.
 */
function buildTeamPointsData(db, includeSnCj = false, tp1 = 28, tp2 = 25, tp3 = 23, topNMale = 0, topNFemale = 0) {
  const athletes = db.athletes || [];
  const ageGroups = db.ageGroups || [];

  // Build category -> championship mapping
  const catToChamp = new Map();
  const catToAgeGroup = new Map();
  const catToParent = new Map();
  const championships = new Map();
  ageGroups.forEach(ag => {
    if (ag.active === false) return;
    const champName = ag.championshipName || ag.code || 'Open';
    if (!championships.has(champName)) {
      championships.set(champName, { type: champName, name: champName, categories: new Set() });
    }
    (ag.categories || []).forEach(cat => {
      const codes = [];
      if (cat.code) codes.push(String(cat.code));
      if (cat.categoryCode) codes.push(String(cat.categoryCode));
      if (cat.id !== undefined && cat.id !== null) codes.push(String(cat.id));
      codes.forEach(code => {
        if (code) {
          const champName = ag.championshipName || ag.code || 'Open';
          catToChamp.set(code, champName);
          championships.get(champName).categories.add(code);
          catToAgeGroup.set(code, ag);
          const parentKey = ag.code || ag.key || ag.championshipName || ag.name || champName;
          catToParent.set(code, parentKey);
        }
      });
    });
  });

  if (!championships.has('Open')) championships.set('Open', { type: 'Open', name: 'Open' });

  // Use shared team points formula
  const calculatePoints = (rank) => calculateTeamPoints(rank, tp1, tp2, tp3);

  // Helpers to manage team point maps
  function ensureMap(map, team) {
    const key = team || 'No Team';
    if (!map.has(key)) map.set(key, { 
      team: key, 
      points: 0, 
      memberCount: 0,
      memberIds: new Set(),
      scores: [], // Array of individual scores for topN filtering
      count1st: 0, 
      count2nd: 0, 
      count3rd: 0, 
      count4th: 0,
      count5th: 0
    });
    return map.get(key);
  }
  function addPoints(map, team, rank, liftValue, teamMember, athleteId) {
    const row = ensureMap(map, team);
    const pts = calculateTeamPoints(rank, liftValue, teamMember, tp1, tp2, tp3);
    
    // If this is a team member score and it earns points, add to scores array for topN processing
    if (pts > 0 && teamMember) {
      row.scores.push({ points: pts, rank, athleteId });
    }
    
    // Count unique team members (track by athlete ID)
    if (pts > 0 && teamMember && athleteId) {
      row.memberIds.add(athleteId);
      row.memberCount = row.memberIds.size;
    }
  }

  // Determine which championships are used
  const usedChampTypes = new Set();
  athletes.forEach(a => {
    const parts = a.participations && a.participations.length > 0 ? a.participations : [];
    if (!parts || parts.length === 0) return;
    parts.forEach(p => {
      const cat = p.categoryCode || a.categoryCode || '';
      const matchedAG = catToAgeGroup.get(String(cat)) || null;
      const champName = matchedAG ? (matchedAG.championshipName || matchedAG.code || 'Open') : 'Open';
      usedChampTypes.add(champName);
    });
  });

  // Initialize per-championship maps
  const champData = {};
  usedChampTypes.forEach(name => {
    const info = championships.get(name) || { name: name };
    champData[name] = { women: new Map(), men: new Map(), name: info.name };
  });

  // Overall totals
  const overall = { women: new Map(), men: new Map() };

  // Process each athlete
  athletes.forEach(a => {
    const team = a.teamName || (a.team ? (db.teams?.find(t => t.id === a.team)?.name) : '') || 'No Team';
    const gender = (a.gender || 'M').toUpperCase() === 'F' ? 'F' : 'M';

    const parts = a.participations && a.participations.length > 0 ? a.participations : [];
    if (!parts || parts.length === 0) return;

    parts.forEach(p => {
      const cat = p.categoryCode || a.categoryCode || '';
      const matchedAgeGroup = catToAgeGroup.get(String(cat)) || null;
      const champName = matchedAgeGroup ? (matchedAgeGroup.championshipName || matchedAgeGroup.code || 'Open') : 'Open';
      const dataForChamp = champData[champName];
      if (!dataForChamp) return;

      const totalRank = parseInt(p.totalRank || a.totalRank || 0, 10) || 0;
      const total = parseInt(a.total || 0, 10) || 0;
      if (totalRank >= 1) {
        if (gender === 'F') addPoints(dataForChamp.women, team, totalRank, total, p.teamMember, a.id);
        else addPoints(dataForChamp.men, team, totalRank, total, p.teamMember, a.id);

        if (gender === 'F') addPoints(overall.women, team, totalRank, total, p.teamMember, a.id);
        else addPoints(overall.men, team, totalRank, total, p.teamMember, a.id);
      }

      if (includeSnCj) {
        // Pass actual lift values to shared formula for validation
        const bestSnatch = parseInt(a.bestSnatch || 0, 10) || 0;
        const sRank = parseInt(p.snatchRank || a.snatchRank || 0, 10) || 0;
        if (sRank >= 1) {
          if (gender === 'F') addPoints(dataForChamp.women, team, sRank, bestSnatch, p.teamMember, a.id);
          else addPoints(dataForChamp.men, team, sRank, bestSnatch, p.teamMember, a.id);

          if (gender === 'F') addPoints(overall.women, team, sRank, bestSnatch, p.teamMember, a.id);
          else addPoints(overall.men, team, sRank, bestSnatch, p.teamMember, a.id);
        }

        // Pass actual lift values to shared formula for validation
        const bestCleanJerk = parseInt(a.bestCleanJerk || 0, 10) || 0;
        const cjRank = parseInt(p.cleanJerkRank || a.cleanJerkRank || 0, 10) || 0;
        if (cjRank >= 1) {
          if (gender === 'F') addPoints(dataForChamp.women, team, cjRank, bestCleanJerk, p.teamMember, a.id);
          else addPoints(dataForChamp.men, team, cjRank, bestCleanJerk, p.teamMember, a.id);

          if (gender === 'F') addPoints(overall.women, team, cjRank, bestCleanJerk, p.teamMember, a.id);
          else addPoints(overall.men, team, cjRank, bestCleanJerk, p.teamMember, a.id);
        }
      }
    });
  });

  // Sort by points with tiebreaker (more 1st places, then 2nd, then 3rd, then 4th, then 5th)
  function mapToSortedArray(map, topN = 0) {
    // First, apply topN filtering if enabled (topN > 0)
    if (topN > 0) {
      map.forEach(row => {
        // Group scores by athleteId and sum each athlete's total contribution
        const athleteTotals = new Map();
        row.scores.forEach(score => {
          const id = score.athleteId;
          if (!athleteTotals.has(id)) {
            athleteTotals.set(id, { athleteId: id, totalPoints: 0, scores: [] });
          }
          const athlete = athleteTotals.get(id);
          athlete.totalPoints += score.points;
          athlete.scores.push(score);
        });
        
        // Sort athletes by total points descending and keep top N
        const sortedAthletes = Array.from(athleteTotals.values())
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .slice(0, topN);
        
        // Collect all scores from top N athletes
        const topScores = sortedAthletes.flatMap(a => a.scores);
        
        // Compute total points from top N athletes
        row.points = topScores.reduce((sum, s) => sum + s.points, 0);
        
        // Count ranks in top N athletes' scores
        row.count1st = topScores.filter(s => s.rank === 1).length;
        row.count2nd = topScores.filter(s => s.rank === 2).length;
        row.count3rd = topScores.filter(s => s.rank === 3).length;
        row.count4th = topScores.filter(s => s.rank === 4).length;
        row.count5th = topScores.filter(s => s.rank === 5).length;
        
        // memberCount = number of top N athletes
        row.memberCount = sortedAthletes.length;
      });
    } else {
      // No topN filtering - use all scores
      map.forEach(row => {
        row.points = row.scores.reduce((sum, s) => sum + s.points, 0);
        
        // Count all ranks
        row.count1st = row.scores.filter(s => s.rank === 1).length;
        row.count2nd = row.scores.filter(s => s.rank === 2).length;
        row.count3rd = row.scores.filter(s => s.rank === 3).length;
        row.count4th = row.scores.filter(s => s.rank === 4).length;
        row.count5th = row.scores.filter(s => s.rank === 5).length;
      });
    }
    
    // Sort teams by total points with tiebreaker
    return Array.from(map.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.count1st !== a.count1st) return b.count1st - a.count1st;
      if (b.count2nd !== a.count2nd) return b.count2nd - a.count2nd;
      if (b.count3rd !== a.count3rd) return b.count3rd - a.count3rd;
      if (b.count4th !== a.count4th) return b.count4th - a.count4th;
      return b.count5th - a.count5th;
    });
  }

  // Build championships array
  logger.warn(`[TeamPoints] Used championship names: ${Array.from(usedChampTypes).join(', ')}`);
  logger.warn(`[TeamPoints] topN settings: Male=${topNMale}, Female=${topNFemale}`);
  const championshipsArr = Array.from(usedChampTypes).map(name => {
    const champ = {
      type: name,
      name: champData[name] && champData[name].name ? champData[name].name : (championships.get(name)?.name || name),
      women: mapToSortedArray(champData[name].women, topNFemale),
      men: mapToSortedArray(champData[name].men, topNMale)
    };
    logger.warn(`[TeamPoints] Championship ${name}: women=${champ.women.length}, men=${champ.men.length}`);
    return champ;
  });

  return {
    championships: championshipsArr,
    women: mapToSortedArray(overall.women, topNFemale),
    men: mapToSortedArray(overall.men, topNMale),
    tp1,
    tp2
  };
}

/**
 * Build medals counts by scanning all athletes and their ranks.
 * If includeSnCj is true, include snatch and clean&jerk ranks in the counts
 * in addition to total ranks. Returns { women:[], men:[], combined:[] } arrays.
 */
function buildMedalsData(db, includeSnCj = false) {
  const athletes = db.athletes || [];
  const ageGroups = db.ageGroups || [];

  // Build category -> championship mapping
  const catToChamp = new Map();
  const catToAgeGroup = new Map(); // map exact category code -> ageGroup object
  const catToParent = new Map(); // map exact category code -> ageGroup code/key
  const championships = new Map();
  ageGroups.forEach(ag => {
    // Skip inactive age groups — only active groups should contribute mappings
    if (ag.active === false) return;
    const champName = ag.championshipName || ag.code || 'Open';
    if (!championships.has(champName)) {
      championships.set(champName, { type: champName, name: champName, categories: new Set() });
    }
    (ag.categories || []).forEach(cat => {
      // Use explicit category code fields from DB - do not parse names
      const codes = [];
      if (cat.code) codes.push(String(cat.code));
      if (cat.categoryCode) codes.push(String(cat.categoryCode));
      if (cat.id !== undefined && cat.id !== null) codes.push(String(cat.id));
      // Register all explicit keys to point to this championship
      codes.forEach(code => {
        if (code) {
          const champName = ag.championshipName || ag.code || 'Open';
          catToChamp.set(code, champName);
          championships.get(champName).categories.add(code);
          // also map exact category code to the ageGroup object for direct lookup
          catToAgeGroup.set(code, ag);
          // map category code back to parent ageGroup key/code
          const parentKey = ag.code || ag.key || ag.championshipName || ag.name || champName;
          catToParent.set(code, parentKey);
        }
      });
    });
  });

  // Ensure there is at least a DEFAULT championship (covers uncategorized participations)
  if (!championships.has('Open')) championships.set('Open', { type: 'Open', name: 'Open' });

  // helpers to create maps
  function ensureMap(map, team) {
    const key = team || 'No Team';
    if (!map.has(key)) map.set(key, { team: key, gold: 0, silver: 0, bronze: 0 });
    return map.get(key);
  }
  function addMedal(map, team, rank) {
    const row = ensureMap(map, team);
    if (rank === 1) row.gold += 1;
    else if (rank === 2) row.silver += 1;
    else if (rank === 3) row.bronze += 1;
  }

  // Determine which championships are actually used by participations
  const usedChampTypes = new Set();
  athletes.forEach(a => {
    const parts = a.participations && a.participations.length > 0 ? a.participations : [];
    if (!parts || parts.length === 0) {
      logger.warn(`[Medals Debug] Skipping athlete ${a.lastName} - no participations (no fallback)`);
      return; // skip this athlete entirely
    }
    parts.forEach(p => {
      const cat = p.categoryCode || a.categoryCode || '';
      // Always resolve championship name via category map
      const matchedAG = catToAgeGroup.get(String(cat)) || null;
      const champName = matchedAG ? (matchedAG.championshipName || matchedAG.code || 'Open') : 'Open';
      usedChampTypes.add(champName);
    });
  });

  // Initialize per-championship maps only for championships that are used
  const champData = {};
  usedChampTypes.forEach(name => {
    const info = championships.get(name) || { name: name };
    champData[name] = { women: new Map(), men: new Map(), combined: new Map(), name: info.name };
  });

  // Overall totals
  const overall = { women: new Map(), men: new Map(), combined: new Map() };

  // Process each athlete and their participations
  athletes.forEach(a => {
    const team = a.teamName || (a.team ? (db.teams?.find(t => t.id === a.team)?.name) : '') || 'No Team';
    const gender = (a.gender || 'M').toUpperCase() === 'F' ? 'F' : 'M';

    const parts = a.participations && a.participations.length > 0 ? a.participations : [];
    if (!parts || parts.length === 0) {
      // Do not fallback to eligibility categories — skip athlete
      logger.warn(`[Medals Debug] Skipping athlete ${a.lastName} during medal counting - no participations`);
      return;
    }

    parts.forEach(p => {
      const cat = p.categoryCode || a.categoryCode || '';
      // Always resolve age group and championship via category map
      const matchedAgeGroup = catToAgeGroup.get(String(cat)) || null;
      const champName = matchedAgeGroup ? (matchedAgeGroup.championshipName || matchedAgeGroup.code || 'Open') : 'Open';
      const dataForChamp = champData[champName];
      if (!dataForChamp) return; // skip if unknown

      const totalRank = parseInt(p.totalRank || a.totalRank || 0, 10) || 0;
      if (totalRank >= 1 && totalRank <= 3) {
        if (gender === 'F') addMedal(dataForChamp.women, team, totalRank);
        else addMedal(dataForChamp.men, team, totalRank);
        addMedal(dataForChamp.combined, team, totalRank);

        if (gender === 'F') addMedal(overall.women, team, totalRank);
        else addMedal(overall.men, team, totalRank);
        addMedal(overall.combined, team, totalRank);
      }

      if (includeSnCj) {
        const sRank = parseInt(p.snatchRank || a.snatchRank || 0, 10) || 0;
        if (sRank >= 1 && sRank <= 3) {
          if (gender === 'F') addMedal(dataForChamp.women, team, sRank);
          else addMedal(dataForChamp.men, team, sRank);
          addMedal(dataForChamp.combined, team, sRank);

          if (gender === 'F') addMedal(overall.women, team, sRank);
          else addMedal(overall.men, team, sRank);
          addMedal(overall.combined, team, sRank);
        }

        const cjRank = parseInt(p.cleanJerkRank || a.cleanJerkRank || 0, 10) || 0;
        if (cjRank >= 1 && cjRank <= 3) {
          if (gender === 'F') addMedal(dataForChamp.women, team, cjRank);
          else addMedal(dataForChamp.men, team, cjRank);
          addMedal(dataForChamp.combined, team, cjRank);

          if (gender === 'F') addMedal(overall.women, team, cjRank);
          else addMedal(overall.men, team, cjRank);
          addMedal(overall.combined, team, cjRank);
        }
      }
    });
  });

  function mapToSortedArray(map) {
    return Array.from(map.values()).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });
  }

  // Build championships array from used championships (preserve ordering by insertion from usedChampTypes)
  logger.warn(`[Medals] Used championship names: ${Array.from(usedChampTypes).join(', ')}`);
  logger.warn(`[Medals] champData keys: ${Object.keys(champData).join(', ')}`);
  const championshipsArr = Array.from(usedChampTypes).map(name => {
    const champ = {
      type: name,
      name: champData[name] && champData[name].name ? champData[name].name : (championships.get(name)?.name || name),
      women: mapToSortedArray(champData[name].women),
      men: mapToSortedArray(champData[name].men),
      combined: mapToSortedArray(champData[name].combined)
    };
    logger.warn(`[Medals] Championship ${name}: women=${champ.women.length}, men=${champ.men.length}, combined=${champ.combined.length}`);
    return champ;
  });
  logger.warn(`[Medals] Total championships in result: ${championshipsArr.length}`);

  return {
    championships: championshipsArr,
    women: mapToSortedArray(overall.women),
    men: mapToSortedArray(overall.men),
    combined: mapToSortedArray(overall.combined)
  };
}