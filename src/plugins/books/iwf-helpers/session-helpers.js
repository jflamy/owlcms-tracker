/**
 * Session and timetable helper functions
 * Shared between iwf-startbook and iwf-results plugins
 * 
 * PURE FUNCTIONS - No external imports (dependencies passed as parameters)
 */

import { 
  OFFICIAL_ROLE_PRESENTATION_ORDER, 
  getOfficialRoleTranslationKey,
  sortOfficialsList 
} from './official-roles.js';

/**
 * Format session competition time array to string
 * @param {Array} timeArray - [year, month, day, hour, minute]
 * @returns {string} Formatted time string "YYYY-MM-DD HH:MM"
 */
export function formatSessionTime(timeArray) {
  if (!timeArray || !Array.isArray(timeArray)) return '';
  const [y, m, d, h, min] = timeArray;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Build timetable data from sessions and official entries
 * @param {Array} sessions - Array of session objects
 * @param {Array} entries - Array of official entries (timetable)
 * @returns {Object} { rows, roleInfo, hasMultiplePlatforms }
 */
export function buildTimetableData(sessions = [], entries = []) {
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

  const orderedRoles = OFFICIAL_ROLE_PRESENTATION_ORDER.filter(
    (roleCategory) => roleSet.has(roleCategory) && roleCategory !== 'JURY_PRESIDENT'
  );
  const extraRoles = [...roleSet].filter(
    (roleCategory) => !orderedRoles.includes(roleCategory) && roleCategory !== 'JURY_PRESIDENT'
  );
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
 * Map session officials from session fields to structured object
 * @param {Object} session - Session object with official references
 * @param {Object} db - Database state with technicalOfficials
 * @returns {Object} Mapped officials by role
 */
export function mapOfficials(session, db) {
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
        officials[officialKey] = { 
          fullName,
          federation
        };
      } else {
        // Fallback when the official can't be found in the technical officials list
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
