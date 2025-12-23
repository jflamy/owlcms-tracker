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
    federation: databaseState.competition?.federation || ''
  };

  // 1. Determine which sessions to include
  const athletesToProcess = databaseState.athletes;
  console.log(`[Protocol] Processing ${sessionFilter ? 'session: ' + sessionFilter : 'all sessions'}`);

  // 2. Group athletes by session then by category
  const sessionMap = new Map(); // { sessionName => { categoryCode => [athletes] } }

  athletesToProcess.forEach(athlete => {
    const sName = athlete.sessionName || 'Unknown';
    
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

  // Cache and return
  const processedData = {
    competition,
    sessions,
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
      sessionRecords.push({
        federation: r.recordFederation || 'WFA',
        recordName: r.recordName,
        ageGroup: r.ageGrp || '',
        category: cat.categoryName,
        categoryCode: r.bwCatString || catCode,
        lift: r.recordLift,
        value: r.recordValue,
        holder: r.athleteName,
        nation: r.recordFederation || r.nation || '',
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
    .map(r => ({
      federation: r.recordFederation || 'WFA',
      recordName: r.recordName,
      ageGroup: r.ageGrp || '',
      category: r.bwCatString || '',
      categoryCode: r.bwCatString || '',
      lift: r.recordLift,
      value: r.recordValue,
      holder: r.athleteName,
      nation: r.recordFederation || r.nation || '',
      born: ''
    }));
}

function transformAthlete(a, db) {
  const teamName = a.teamName || (a.team ? db.teams?.find(t => t.id === a.team)?.name : '');
  
  // Find ranks in participations
  const p = a.participations?.[0] || {};
  const totalRank = p.totalRank || a.totalRank || '';
  const snatchRank = p.snatchRank || a.snatchRank || '';
  const cleanJerkRank = p.cleanJerkRank || a.cleanJerkRank || '';

  // Compute best snatch: max of successful lifts (>= 0)
  const snatchLifts = [a.snatch1ActualLift, a.snatch2ActualLift, a.snatch3ActualLift]
    .filter(val => val && val > 0);
  const bestSnatchValue = snatchLifts.length > 0 ? Math.max(...snatchLifts) : 0;
  
  // Compute best clean & jerk: max of successful lifts (>= 0)
  const cleanJerkLifts = [a.cleanJerk1ActualLift, a.cleanJerk2ActualLift, a.cleanJerk3ActualLift]
    .filter(val => val && val > 0);
  const bestCleanJerkValue = cleanJerkLifts.length > 0 ? Math.max(...cleanJerkLifts) : 0;
  
  // Compute total from best lifts: if either is 0, total is 0
  const computedTotal = (bestSnatchValue > 0 && bestCleanJerkValue > 0) ? (bestSnatchValue + bestCleanJerkValue) : 0;

  return {
    lastName: (a.lastName || '').toUpperCase(),
    firstName: a.firstName || '',
    categoryName: a.categoryName || '',
    formattedBirth: a.fullBirthDate ? a.fullBirthDate[0] : '',
    lotNumber: a.lotNumber,
    team: teamName,
    bodyWeight: a.bodyWeight ? a.bodyWeight.toFixed(2) : '',
    
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
