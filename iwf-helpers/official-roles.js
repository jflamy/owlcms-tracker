/**
 * Official role constants and helper functions
 * Shared between iwf-startbook and iwf-results plugins
 * 
 * PURE FUNCTIONS - No external imports
 */

export const OFFICIAL_ROLE_TRANSLATION_KEYS = {
  REFEREE: 'Referee',
  CENTER_REFEREE: 'CenterReferee',
  LEFT_REFEREE: 'SideReferee',
  RIGHT_REFEREE: 'SideReferee',
  REFEREE_RESERVE: 'ReserveReferee',
  MARSHAL1: 'ChiefMarshal',
  MARSHAL2: 'AssistantMarshal',
  MARSHALL: 'Marshall',
  MARSHAL: 'Marshall',
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

export const OFFICIAL_ROLE_PRESENTATION_ORDER = [
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
  'MARSHAL',
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

/**
 * Get the translation key for an official role category
 * @param {string} roleCategory - The role category code (e.g., 'REFEREE', 'JURY_PRESIDENT')
 * @returns {string} Translation key for the role
 */
export function getOfficialRoleTranslationKey(roleCategory) {
  return OFFICIAL_ROLE_TRANSLATION_KEYS[roleCategory] || roleCategory;
}

/**
 * Sort officials list alphabetically by last name, then first name
 * @param {Array} officials - Array of official objects with lastName and firstName
 * @returns {Array} Sorted array of officials
 */
export function sortOfficialsList(officials = []) {
  return [...officials].sort((a, b) => {
    const lastNameComparison = (a.lastName || '').localeCompare(b.lastName || '');
    if (lastNameComparison !== 0) {
      return lastNameComparison;
    }
    return (a.firstName || '').localeCompare(b.firstName || '');
  });
}

/**
 * Build official sections grouped by role category
 * @param {Array} officials - Array of official objects with teamRole
 * @returns {Array} Array of sections: {roleCategory, officials, translationKey}
 */
export function buildOfficialSections(officials = []) {
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

  // Add any remaining roles not in presentation order
  for (const [roleCategory, officials] of buckets.entries()) {
    sections.push({
      roleCategory,
      officials: sortOfficialsList(officials),
      translationKey: getOfficialRoleTranslationKey(roleCategory)
    });
  }

  return sections;
}
