import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Plugin-specific cache to avoid recomputing on every browser request
 */
const protocolCache = new Map();

export function getScoreboardData(fopName = '', options = {}, locale = 'en') {
  const databaseState = competitionHub.getDatabaseState();
  const translations = competitionHub.getTranslations(locale) || {};

  if (!databaseState || !databaseState.athletes || databaseState.athletes.length === 0) {
    return { status: 'waiting', message: 'Waiting for database...' };
  }

  // 🎯 FILTERING: If no session specified, use all sessions combined
  const sessionFilter = options.session;
  
  // Cache key based on database checksum, options, and records state
  const dbVersion = databaseState.databaseChecksum || databaseState.lastUpdate;
  const recordsCount = (databaseState.records || []).length;
  const newRecordsCount = (databaseState.records || []).filter(r => r.groupNameString && r.groupNameString !== '').length;
  const cacheKey = sessionFilter 
    ? `${dbVersion}-session-${sessionFilter}-${locale}-r${recordsCount}-n${newRecordsCount}`
    : `${dbVersion}-all-sessions-${locale}-r${recordsCount}-n${newRecordsCount}`;

  if (protocolCache.has(cacheKey)) {
    return protocolCache.get(cacheKey);
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

  // Extract team points values from competition or use options as fallback
  const teamPoints1st = databaseState.competition?.teamPoints1st || options.tp1 || 28;
  const teamPoints2nd = databaseState.competition?.teamPoints2nd || options.tp2 || 26;

  const competition = {
    name: databaseState.competition?.name || 'Competition',
    city: databaseState.competition?.competitionCity || '',
    site: databaseState.competition?.competitionSite || '',
    dateRange,
    organizer: databaseState.competition?.competitionOrganizer || '',
    federation: databaseState.competition?.federation || '',
    snatchCJTotalMedals: databaseState.competition?.snatchCJTotalMedals || false,
    owlcmsVersion: databaseState.config?.appVersion || databaseState.config?.version || '',
    exportDate: databaseState.exportDate || '',
    teamPoints1st,
    teamPoints2nd
  };

  // 1. Determine which sessions to include
  const athletesToProcess = databaseState.athletes;
  console.log(`[Protocol] Processing ${sessionFilter ? 'session: ' + sessionFilter : 'all sessions'}`);

  // 2. Group athletes by session then by category
  const sessionMap = new Map(); // { sessionName => { categoryCode => [athletes] } }

  athletesToProcess.forEach(athlete => {
    const sName = athlete.sessionName;
    
    // 🎯 FILTERING: Session unknown -- athlete not in session -- should not be included
    if (!sName || sName === 'Unknown') return;
    
    // Skip if filtering by session and this isn't it
    if (sessionFilter && sName !== sessionFilter) return;
    
    // Initialize session
    if (!sessionMap.has(sName)) {
      sessionMap.set(sName, new Map());
    }
    
    const catCode = athlete.categoryCode || 'Unknown';
    const categoryMap = sessionMap.get(sName);
    if (!categoryMap.has(catCode)) {
      categoryMap.set(catCode, {
        categoryName: athlete.categoryName || catCode,
        categorySortCode: catCode,
        items: []
      });
    }
    categoryMap.get(catCode).items.push(transformAthlete(athlete, databaseState));
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
    const categoryMap = sessionMap.get(sName);
    const dbSession = dbSessions.find(s => s.name === sName) || { name: sName };
    
    // Sort categories
    const sortedCategories = Array.from(categoryMap.values())
      .sort((a, b) => a.categorySortCode.localeCompare(b.categorySortCode));

    // Sort athletes within categories
    sortedCategories.forEach(cat => {
      cat.items.sort((a, b) => {
        // Athletes with valid ranks (non-zero, non-empty) come first, sorted by rank
        const aRank = parseInt(a.totalRank) || 0;
        const bRank = parseInt(b.totalRank) || 0;
        
        if (aRank > 0 && bRank > 0) return aRank - bRank;  // Both ranked: sort by rank
        if (aRank > 0) return -1;  // Only a is ranked: a comes first
        if (bRank > 0) return 1;   // Only b is ranked: b comes first
        // Both unranked: sort by lot number
        return a.lotNumber - b.lotNumber;
      });
    });

    sessions.push({
      name: dbSession.name,
      description: dbSession.description || '',
      platform: dbSession.platformName || '',
      startTime: formatSessionTime(dbSession.competitionTime),
      athletes: sortedCategories,
      officials: mapOfficials(dbSession, databaseState),
      records: extractRecords(databaseState, sortedCategories.map(c => c.categorySortCode)),
      newRecords: extractNewRecords(databaseState, dbSession.name)
    });
  });

  // Build rankings data structure: Championship → Gender → Categories (with multiple category headers in one table)
  const rankings = buildRankingsData(databaseState, transformAthlete);

  // Build all records data structure: Federation → Gender → Age Group
  const allRecordsData = buildAllRecordsData(databaseState);

  // Build medals data
  const medals = buildMedalsData(databaseState, competition.snatchCJTotalMedals);

  // Build participants matrix (Teams × Categories)
  const participants = buildParticipationData(databaseState);

  // Cache and return
  console.warn('[getScoreboardData] allRecordsData:', {
    hasRecords: allRecordsData.hasRecords,
    newRecordsBroken: allRecordsData.newRecordsBroken,
    recordsLength: allRecordsData.records?.length
  });
  
  const processedData = {
    competition,
    sessions,
    rankings,
    allRecords: allRecordsData.records,
    hasRecords: allRecordsData.hasRecords,
    newRecordsBroken: allRecordsData.newRecordsBroken,
    medals,
    participants,
    allAthletes: databaseState.athletes || [],
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
  console.warn('[getScoreboardData] Returning data with allRecords length:', processedData.allRecords?.length || 0);
  if (processedData.allRecords && processedData.allRecords.length > 0) {
    console.warn('[getScoreboardData] allRecords[0]:', processedData.allRecords[0]);
  }
  return processedData;
}

function extractRecords(db, categoryCodes) {
  const allRecords = db.records || [];
  const sessionRecords = [];

  categoryCodes.forEach(catCode => {
    const cat = db.ageGroups?.flatMap(ag => ag.categories).find(c => c.id === catCode || c.categoryName === catCode);
    if (!cat) return;

    const catRecords = allRecords.filter(r => 
      r.gender === cat.gender && 
      r.bwCatUpper === cat.maximumWeight &&
      (!r.groupNameString || r.groupNameString === '') // Existing records only
    );

    catRecords.forEach(r => {
      // Try to find the athlete's team if possible
      const athleteTeam = getAthleteTeam(db, r.athleteName);

      sessionRecords.push({
        federation: r.recordFederation || 'WFA',
        recordName: r.recordName,
        ageGroup: r.ageGrp || '',
        category: cat.categoryName,
        categoryCode: r.bwCatString || catCode,
        lift: r.recordLift,
        value: r.recordValue,
        holder: r.athleteName,
        nation: athleteTeam || r.nation || r.recordFederation || '',
        born: ''
      });
    });
  });

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
        nation: athleteTeam || r.nation || r.recordFederation || '',
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

function transformAthlete(a, db) {
  const teamName = a.teamName || (a.team ? db.teams?.find(t => t.id === a.team)?.name : '');
  
  // Find ranks in participations
  const p = a.participations?.[0] || {};
  const totalRank = p.totalRank || a.totalRank || '';
  const snatchRank = p.snatchRank || a.snatchRank || '';
  const cleanJerkRank = p.cleanJerkRank || a.cleanJerkRank || '';

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
    lastName: (a.lastName || '').toUpperCase(),
    firstName: a.firstName || '',
    categoryName: a.categoryName || '',
    categoryCode: a.categoryCode || '',
    gender: a.gender || '',
    formattedBirth: a.fullBirthDate ? a.fullBirthDate[0] : '',
    lotNumber: a.lotNumber,
    team: teamName,
    bodyWeight: a.bodyWeight ? a.bodyWeight.toFixed(2) : '',
    participations: a.participations || [],
    
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
    marshal2: session.marshall2,
    timekeeper: session.timeKeeper
  };

  Object.entries(fieldMappings).forEach(([officialKey, officialId]) => {
    if (officialId) {
      const to = toList.find(o => o.id === officialId || o.key === officialId);
      if (to) {
        officials[officialKey] = { 
          fullName: `${to.lastName?.toUpperCase() || ''} ${to.firstName || ''}`.trim(),
          federationId: to.federationId || to.federation || ''
        };
      } else {
        officials[officialKey] = { fullName: String(officialId), federationId: '' };
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
 */
function buildAllRecordsData(db) {
  const allRecords = db.records || [];
  console.warn('[buildAllRecordsData] Total records in DB:', allRecords.length);
  
  // hasRecords = true if any records are loaded (even if none broken during competition)
  const hasRecords = allRecords.length > 0;
  
  if (!hasRecords) {
    console.warn('[buildAllRecordsData] No records found, returning object with hasRecords=false');
    return { hasRecords: false, newRecordsBroken: false, records: [] };
  }

  // Debug: Show sample records to understand the data structure
  console.warn('[buildAllRecordsData] Sample records from DB:');
  allRecords.slice(0, 5).forEach((r, i) => {
    console.warn(`  [${i}] federation=${r.recordFederation}, gender=${r.gender}, ageGrp=${r.ageGrp}, groupNameString="${r.groupNameString}", athlete=${r.athleteName}`);
  });
  
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
  console.warn('[buildAllRecordsData] Records by federation:', fedCounts);
  console.warn('[buildAllRecordsData] NEW records by federation:', newRecordsByFed);

  // Grouping: Federation -> Gender -> Age Group
  // 🎯 FILTER: Only include records with non-empty groupNameString (new records set during competition)
  // This matches the behavior of session protocols which only show newRecords
  const fedMap = new Map();
  let recordsWithGroup = 0;

  allRecords.forEach(r => {
    // Only include records set during competition (non-empty groupNameString)
    if (!r.groupNameString || r.groupNameString === '') {
      return;
    }
    recordsWithGroup++;

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
      nation: athleteTeam || r.nation || r.recordFederation || '',
      isNew: !!(r.groupNameString && r.groupNameString !== '')
    });
  });

  // Convert to sorted array
  console.warn('[buildAllRecordsData] Records with groupNameString (new records):', recordsWithGroup);
  console.warn('[buildAllRecordsData] Federation map size:', fedMap.size);
  
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
  
  console.warn('[buildAllRecordsData] Returning result with', result.length, 'federations');
  result.forEach(fed => {
    fed.genders.forEach(gen => {
      const totalRecords = gen.ageGroups.reduce((sum, ag) => sum + ag.records.length, 0);
      console.warn(`[buildAllRecordsData]   ${fed.federation} - ${gen.genderName}: ${totalRecords} records`);
    });
  });
  
  const newRecordsBroken = recordsWithGroup > 0;
  console.warn('[buildAllRecordsData] hasRecords:', hasRecords, 'newRecordsBroken:', newRecordsBroken);
  
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
  console.warn('[Participation] buildParticipationData: start');
  const athletes = db?.athletes || [];
  console.log(`[Participation] Athletes count: ${athletes.length}`);
  if (athletes.length === 0) return { championships: [] };

  const ageGroups = db?.ageGroups || [];
  console.log(`[Participation] Age groups count: ${ageGroups.length}`);

  // Build team ID to name lookup
  const teamIdToName = new Map();
  (db?.teams || []).forEach(t => {
    if (t.id != null && t.name) {
      teamIdToName.set(t.id, t.name);
    }
  });
  console.log(`[Participation] Teams lookup size: ${teamIdToName.size}`);

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
  console.log(`[Participation] Category-to-championship map size: ${catToChampionship.size}`);

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
    console.log(`[Participation] Athlete ${i}: team=${a.team} (type: ${typeof a.team}), categoryCode=${a.categoryCode}, participations=${JSON.stringify(a.participations?.length || 0)}`);
  });

  // Process each athlete's participations
  athletes.forEach(a => {
    const team = resolveTeam(a);
    const gender = (a.gender || 'M').toUpperCase();

    if (team === 'JOR' || team === 'PLE') {
      console.warn(`[Participation] Processing athlete for team ${team}: cat=${a.categoryCode}, participations=${JSON.stringify(a.participations || [])}`);
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
        console.warn(`[Participation] Warning: Championship "${champName}" not found for category ${catCode}`);
        return;
      }

      // Initialize team entry for this championship
      if (!champ.teamCounts.has(team)) {
        champ.teamCounts.set(team, { categories: new Map(), womenTotal: 0, menTotal: 0, total: 0 });
        if (team === 'JOR' || team === 'PLE') {
          console.warn(`[Participation] Created team entry for ${team} in championship ${champName}`);
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
  console.log(`[Participation] Championship map size: ${championshipMap.size}`);
  championshipMap.forEach((v, k) => {
    console.log(`[Participation] Championship "${k}": ${v.teamCounts.size} teams, ${v.womenCatSet.size} women cats, ${v.menCatSet.size} men cats`);
  });
  
  const championships = Array.from(championshipMap.values()).map(champ => {
    // Sort by weight using the lookup
    const womenCatCodes = Array.from(champ.womenCatSet).sort((a, b) => getCatWeight(a) - getCatWeight(b));
    const menCatCodes = Array.from(champ.menCatSet).sort((a, b) => getCatWeight(a) - getCatWeight(b));
    
    // Build category objects with code and name
    const womenCategories = womenCatCodes.map(code => ({ code, name: catToName.get(code) || code }));
    const menCategories = menCatCodes.map(code => ({ code, name: catToName.get(code) || code }));
    
    console.log(`[Participation] Women categories: ${JSON.stringify(womenCategories)}`);
    console.log(`[Participation] Men categories: ${JSON.stringify(menCategories)}`);

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
        console.warn(`[Participation] Row for ${team} in ${champ.name}: womenCells=${JSON.stringify(row.womenCells)}, menCells=${JSON.stringify(row.menCells)}, totals w:${row.womenTotal} m:${row.menTotal} t:${row.total}`);
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

  console.log(`[Participation] Returning ${championships.length} championships`);
  championships.forEach(c => {
    console.warn(`[Participation] Championship ${c.name}: rows=${c.rows?.length || 0}, womenCats=${c.womenCategories.length}, menCats=${c.menCategories.length}`);
  });
  if (championships.length > 0) {
    console.log(`[Participation] First championship has ${championships[0].rows?.length} rows`);
  }

  console.warn('[Participation] buildParticipationData: end');

  return { championships };
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
      console.warn(`[Medals Debug] Skipping athlete ${a.lastName} - no participations (no fallback)`);
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
      console.warn(`[Medals Debug] Skipping athlete ${a.lastName} during medal counting - no participations`);
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
  console.warn(`[Medals] Used championship names: ${Array.from(usedChampTypes).join(', ')}`);
  console.warn(`[Medals] champData keys: ${Object.keys(champData).join(', ')}`);
  const championshipsArr = Array.from(usedChampTypes).map(name => {
    const champ = {
      type: name,
      name: champData[name] && champData[name].name ? champData[name].name : (championships.get(name)?.name || name),
      women: mapToSortedArray(champData[name].women),
      men: mapToSortedArray(champData[name].men),
      combined: mapToSortedArray(champData[name].combined)
    };
    console.warn(`[Medals] Championship ${name}: women=${champ.women.length}, men=${champ.men.length}, combined=${champ.combined.length}`);
    return champ;
  });
  console.warn(`[Medals] Total championships in result: ${championshipsArr.length}`);

  return {
    championships: championshipsArr,
    women: mapToSortedArray(overall.women),
    men: mapToSortedArray(overall.men),
    combined: mapToSortedArray(overall.combined)
  };
}