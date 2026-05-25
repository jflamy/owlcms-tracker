import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  competitionHub: {
    getDatabaseState: vi.fn(),
    getTranslations: vi.fn(),
    getTechnicalOfficials: vi.fn(),
    getTimetable: vi.fn(),
    isReady: vi.fn()
  },
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    trace: vi.fn()
  },
  trackerCore: {
    getHeaderLogoUrl: vi.fn(() => ''),
    formatCategoryDisplay: vi.fn((category) => category),
    sortRecordsByFederation: vi.fn((records) => records),
    sortRecordsList: vi.fn((records) => records)
  },
  utils: {
    getCountryCodeMap: vi.fn(() => ({
      subdivisionNameToCode: {},
      normalizedSubdivisionNameToCode: {}
    })),
    lookupIocCode: vi.fn((teamName) => (teamName === 'Canada' ? 'CAN' : '')),
    getCurrentCompetitionName: vi.fn((db) => db?.competition?.name || ''),
    isCurrentCompetitionProvisionalRecord: vi.fn(
      (record, competitionName) => record?.event === competitionName && Boolean(record?.groupNameString)
    )
  }
}));

vi.mock('$lib/server/competition-hub.js', () => ({
  competitionHub: mocks.competitionHub
}));

vi.mock('@owlcms/tracker-core', () => ({
  logger: mocks.logger,
  getHeaderLogoUrl: mocks.trackerCore.getHeaderLogoUrl,
  formatCategoryDisplay: mocks.trackerCore.formatCategoryDisplay,
  sortRecordsByFederation: mocks.trackerCore.sortRecordsByFederation,
  sortRecordsList: mocks.trackerCore.sortRecordsList
}));

vi.mock('@owlcms/tracker-core/utils', () => ({
  getCountryCodeMap: mocks.utils.getCountryCodeMap,
  lookupIocCode: mocks.utils.lookupIocCode,
  getCurrentCompetitionName: mocks.utils.getCurrentCompetitionName,
  isCurrentCompetitionProvisionalRecord: mocks.utils.isCurrentCompetitionProvisionalRecord
}));

import { clearCache, getScoreboardData } from '../../src/plugins/books/iwf-startbook/helpers.data.js';

const databaseState = {
  databaseChecksum: 'startbook-options-fixture',
  lastUpdate: 1,
  competition: {
    name: 'Test Competition',
    competitionDate: [2026, 5, 24],
    competitionEndDate: [2026, 5, 25],
    competitionCity: 'Lyon',
    competitionSite: 'Arena',
    competitionOrganizer: 'Organizer',
    federation: 'IWF'
  },
  config: {
    appVersion: '2.18.4'
  },
  exportDate: '2026-05-24T10:00:00Z',
  athletes: [
    {
      id: 1,
      key: 1,
      lastName: 'Smith',
      firstName: 'Sam',
      categoryName: 'Men 61',
      categoryCode: 'SR_M61',
      gender: 'M',
      sessionName: '1',
      lotNumber: 1,
      team: 1,
      qualificationTotal: 200,
      participations: [{ categoryCode: 'SR_M61' }]
    }
  ],
  ageGroups: [
    {
      code: 'SR',
      championshipName: 'Senior',
      minAge: 15,
      maxAge: 99,
      active: true,
      categories: [
        {
          code: 'SR_M61',
          categoryName: 'Men 61',
          maximumWeight: 61,
          minimumWeight: 55,
          maxWeight: 61,
          minWeight: 55,
          weightDisplay: '61'
        }
      ]
    }
  ],
  sessions: [
    {
      id: 1,
      name: '1',
      description: 'Men 61 KG',
      competitionTime: [2026, 5, 24, 10, 0],
      weighInTime: [2026, 5, 24, 9, 0],
      platformName: 'A'
    }
  ],
  records: [],
  teams: [{ id: 1, name: 'Canada' }],
  technicalOfficials: [
    {
      id: 101,
      lastName: 'Ref',
      firstName: 'One',
      fullName: 'Ref, One',
      federation: 'CAN',
      technicalOfficialTeam: 1,
      teamRole: 'REFEREE'
    }
  ],
  technicalOfficialsTimetable: [
    {
      sessionName: '1',
      roleCategory: 'REFEREE',
      teamNumber: 1
    }
  ]
};

describe('iwf-startbook technical officials options', () => {
  beforeEach(() => {
    clearCache();

    mocks.competitionHub.getDatabaseState.mockReset();
    mocks.competitionHub.getTranslations.mockReset();
    mocks.competitionHub.getTechnicalOfficials.mockReset();
    mocks.competitionHub.getTimetable.mockReset();
    mocks.competitionHub.isReady.mockReset();

    mocks.competitionHub.getDatabaseState.mockReturnValue(databaseState);
    mocks.competitionHub.getTranslations.mockReturnValue({});
    mocks.competitionHub.getTechnicalOfficials.mockReturnValue(databaseState.technicalOfficials);
    mocks.competitionHub.getTimetable.mockReturnValue(databaseState.technicalOfficialsTimetable);
    mocks.competitionHub.isReady.mockReturnValue(true);
  });

  it('defaults the standalone section to off when the option is omitted', async () => {
    const data = await getScoreboardData('', { includeOfficials: true }, 'en');

    expect(data.includeOfficials).toBe(true);
    expect(data.includeTechnicalOfficialsSection).toBe(false);
    expect(data.scheduleRows).toHaveLength(1);
    expect(data.scheduleRows[0]).toMatchObject({
      sessionName: '1',
      description: 'Men 61 kg',
      weighIn: '09:00',
      time: '10:00'
    });
    expect(data.technicalOfficials).toEqual([]);
    expect(data.technicalOfficialsTimetableRows).toEqual([]);
  });

  it('uses the language option for book translations', async () => {
    await getScoreboardData('', { language: 'fr' }, 'en');

    expect(mocks.competitionHub.getTranslations).toHaveBeenCalledWith({ locale: 'fr' });
  });

  it('supports OWLCMS underscore regional locale codes', async () => {
    const data = await getScoreboardData('', { language: 'fr_CA' }, 'en');

    expect(mocks.competitionHub.getTranslations).toHaveBeenCalledWith({ locale: 'fr_CA' });
    expect(data.status).toBe('ready');
    expect(data.productionTime).toEqual(expect.any(String));
  });

  it('allows publishing the standalone teams and timetable section independently', async () => {
    const data = await getScoreboardData('', {
      includeOfficials: false,
      includeTechnicalOfficialsSection: true
    }, 'en');

    expect(data.includeOfficials).toBe(false);
    expect(data.includeTechnicalOfficialsSection).toBe(true);
    expect(data.technicalOfficials).toHaveLength(1);
    expect(data.technicalOfficialsTimetableRows).toHaveLength(1);
  });

  it('allows hiding the standalone section while keeping session officials enabled', async () => {
    const data = await getScoreboardData('', {
      includeOfficials: true,
      includeTechnicalOfficialsSection: false
    }, 'en');

    expect(data.includeOfficials).toBe(true);
    expect(data.includeTechnicalOfficialsSection).toBe(false);
    expect(data.technicalOfficials).toEqual([]);
    expect(data.technicalOfficialsTimetableRows).toEqual([]);
  });

  it('sorts all-record age groups by upper bound then lower bound and keeps groups distinct', async () => {
    mocks.competitionHub.getDatabaseState.mockReturnValue({
      ...databaseState,
      databaseChecksum: 'startbook-record-order-fixture',
      records: [
        {
          recordFederation: 'IWF',
          recordName: 'Senior Record',
          ageGrp: 'SR',
          ageGrpLower: 15,
          ageGrpUpper: 99,
          bwCatString: '61',
          bwCatLower: 55,
          bwCatUpper: 61,
          recordLift: 'SNATCH',
          recordValue: 100,
          athleteName: 'Smith, Sam',
          nation: 'CAN',
          groupNameString: '',
          gender: 'M'
        },
        {
          recordFederation: 'IWF',
          recordName: 'Junior Record',
          ageGrp: 'JR',
          ageGrpLower: 15,
          ageGrpUpper: 20,
          bwCatString: '61',
          bwCatLower: 55,
          bwCatUpper: 61,
          recordLift: 'SNATCH',
          recordValue: 99,
          athleteName: 'Smith, Sam',
          nation: 'CAN',
          groupNameString: '',
          gender: 'M'
        },
        {
          recordFederation: 'IWF',
          recordName: 'Masters 40-44 Record',
          ageGrp: 'Masters',
          ageGrpLower: 40,
          ageGrpUpper: 44,
          bwCatString: '61',
          bwCatLower: 55,
          bwCatUpper: 61,
          recordLift: 'SNATCH',
          recordValue: 98,
          athleteName: 'Smith, Sam',
          nation: 'CAN',
          groupNameString: '',
          gender: 'M'
        },
        {
          recordFederation: 'IWF',
          recordName: 'Masters 35-39 Record',
          ageGrp: 'Masters',
          ageGrpLower: 35,
          ageGrpUpper: 39,
          bwCatString: '61',
          bwCatLower: 55,
          bwCatUpper: 61,
          recordLift: 'SNATCH',
          recordValue: 97,
          athleteName: 'Smith, Sam',
          nation: 'CAN',
          groupNameString: '',
          gender: 'M'
        }
      ]
    });

    const data = await getScoreboardData('', {}, 'en');
    const menAgeGroups = data.allRecords[0].genders.find((group) => group.gender === 'M').ageGroups;

    expect(menAgeGroups.map(({ name, lowerLimit, upperLimit }) => ({ name, lowerLimit, upperLimit }))).toEqual([
      { name: 'JR', lowerLimit: 15, upperLimit: 20 },
      { name: 'Masters', lowerLimit: 35, upperLimit: 39 },
      { name: 'Masters', lowerLimit: 40, upperLimit: 44 },
      { name: 'SR', lowerLimit: 15, upperLimit: 99 }
    ]);
  });

  it('normalizes open-ended all-record categories to suffix plus notation', async () => {
    mocks.competitionHub.getDatabaseState.mockReturnValue({
      ...databaseState,
      databaseChecksum: 'startbook-open-ended-category-fixture',
      records: [
        {
          recordFederation: 'IWF',
          recordName: 'Open Record',
          ageGrp: 'SR',
          ageGrpLower: 15,
          ageGrpUpper: 99,
          bwCatString: '>87',
          bwCatLower: 87,
          bwCatUpper: 999,
          recordLift: 'SNATCH',
          recordValue: 100,
          athleteName: 'Smith, Sam',
          nation: 'CAN',
          groupNameString: '',
          gender: 'F'
        }
      ]
    });

    const data = await getScoreboardData('', {}, 'en');
    const record = data.allRecords[0].genders[0].ageGroups[0].records[0];

    expect(record.category).toBe('87+');
    expect(record.categoryCode).toBe('87+');
  });
});