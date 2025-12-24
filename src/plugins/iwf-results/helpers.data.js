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
  
  // Cache key based on database checksum and options
  const dbVersion = databaseState.databaseChecksum || databaseState.lastUpdate;
  const cacheKey = sessionFilter 
    ? `${dbVersion}-session-${sessionFilter}-${locale}`
    : `${dbVersion}-all-sessions-${locale}`;

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

  const competition = {
    name: databaseState.competition?.name || 'Competition',
    city: databaseState.competition?.competitionCity || '',
    site: databaseState.competition?.competitionSite || '',
    dateRange,
    organizer: databaseState.competition?.competitionOrganizer || '',
    federation: databaseState.competition?.federation || '',
    snatchCJTotalMedals: databaseState.competition?.snatchCJTotalMedals || false
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
  const allRecords = buildAllRecordsData(databaseState);

  // Cache and return
  const processedData = {
    competition,
    sessions,
    rankings,
    allRecords,
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
    totalRank: totalRank === 0 ? '' : totalRank
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
    ag.categories?.forEach(cat => {
      // Map by category code (e.g., "SR_F48") which matches athlete.categoryCode
      ageGroupMap.set(cat.code, {
        championshipType: ag.championshipType || 'DEFAULT',
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
        championshipType: 'DEFAULT',
        categoryCode: athlete.categoryCode,
        totalRank: athlete.totalRank,
        snatchRank: athlete.snatchRank,
        cleanJerkRank: athlete.cleanJerkRank
      }];
    }
    
    participationsToProcess.forEach(p => {
      const champType = p.championshipType || 'DEFAULT';
      const gender = athlete.gender || 'M';
      const catCode = p.categoryCode || athlete.categoryCode;
      
      // Get category weight for sorting
      const catWeight = extractMaxWeight(catCode);

      // Determine championship name from ageGroup - this is the actual grouping key
      let champName = getChampionshipDisplayName(champType);  // fallback
      if (catCode && ageGroupMap.has(catCode)) {
         const info = ageGroupMap.get(catCode);
         if (info.championshipName) {
             champName = info.championshipName;
         }
      }
      
      // Use championshipName as the grouping key (e.g., "Senior", "Youth", "Masters")
      if (!championshipMap.has(champName)) {
        championshipMap.set(champName, {
          type: champType,
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
  
  if (allRecords.length === 0) {
    console.warn('[buildAllRecordsData] No records found, returning empty array');
    return [];
  }

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
  return result;
}