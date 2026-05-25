import { describe, expect, it } from 'vitest';

import {
  extractRecords,
  extractNewRecords,
  isCurrentCompetitionProvisionalRecord,
  keepLargestRecordsBySummaryCategory
} from '../../src/plugins/books/iwf-helpers/records-extraction.js';

const sortRecordsByFederation = (records) => records;
const formatCategoryDisplay = (category) => category;

function createRecord(overrides = {}) {
  return {
    recordFederation: 'QC',
    recordName: 'Provincial',
    ageGrp: 'SR',
    bwCatString: '76',
    bwCatUpper: 76,
    recordLift: 'SNATCH',
    recordValue: 100,
    athleteName: 'Athlete One',
    nation: 'CAN',
    groupNameString: 'A',
    event: 'Current Event',
    ...overrides
  };
}

describe('records extraction', () => {
  it('includes junior records for session athletes using category metadata', () => {
    const db = {
      ageGroups: [
        {
          code: 'JR',
          minAge: 15,
          maxAge: 20,
          active: true,
          categories: [
            {
              code: 'JR_M61',
              maximumWeight: 61
            }
          ]
        }
      ],
      athletes: [
        {
          firstName: 'One',
          lastName: 'Athlete',
          team: 1
        }
      ],
      teams: [
        { id: 1, name: 'CAN' }
      ],
      records: [
        createRecord({
          recordFederation: 'IWF',
          ageGrp: 'JR',
          ageGrpLower: 15,
          ageGrpUpper: 20,
          bwCatLower: 55,
          bwCatUpper: 61,
          bwCatString: '61',
          gender: 'M',
          athleteName: 'Athlete, One',
          groupNameString: ''
        }),
        createRecord({
          recordFederation: 'IWF',
          ageGrp: 'YTH',
          ageGrpLower: 13,
          ageGrpUpper: 17,
          bwCatLower: 55,
          bwCatUpper: 61,
          bwCatString: '61',
          gender: 'M',
          athleteName: 'Athlete, One',
          groupNameString: ''
        })
      ]
    };

    const sessionCategories = [
      {
        items: [
          {
            firstName: 'One',
            lastName: 'Athlete',
            gender: 'M',
            categoryCode: 'JR_M61',
            participations: []
          }
        ]
      }
    ];

    const records = extractRecords(db, sessionCategories, sortRecordsByFederation, formatCategoryDisplay);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      ageGroup: 'JR',
      categoryCode: '61',
      nation: 'CAN'
    });
  });

  it('normalizes open-ended session record categories to suffix plus notation', () => {
    const db = {
      ageGroups: [
        {
          code: 'SR',
          minAge: 15,
          maxAge: 99,
          active: true,
          categories: [
            {
              code: 'SR_F87PLUS',
              maximumWeight: 999
            }
          ]
        }
      ],
      athletes: [
        {
          firstName: 'One',
          lastName: 'Athlete',
          team: 1
        }
      ],
      teams: [
        { id: 1, name: 'CAN' }
      ],
      records: [
        createRecord({
          recordFederation: 'IWF',
          ageGrp: 'SR',
          ageGrpLower: 15,
          ageGrpUpper: 99,
          bwCatLower: 87,
          bwCatUpper: 999,
          bwCatString: '>87',
          gender: 'F',
          athleteName: 'Athlete, One',
          groupNameString: ''
        })
      ]
    };

    const sessionCategories = [
      {
        items: [
          {
            firstName: 'One',
            lastName: 'Athlete',
            gender: 'F',
            categoryCode: 'SR_F87PLUS',
            participations: []
          }
        ]
      }
    ];

    const records = extractRecords(db, sessionCategories, sortRecordsByFederation, formatCategoryDisplay);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      category: '87+',
      categoryCode: '87+'
    });
  });

  it('sorts session records by age-group upper then lower bounds within federation', () => {
    const db = {
      ageGroups: [
        {
          code: 'JR',
          minAge: 15,
          maxAge: 20,
          active: true,
          categories: [
            {
              code: 'JR_M61',
              maximumWeight: 61
            }
          ]
        },
        {
          code: 'Masters35',
          minAge: 35,
          maxAge: 39,
          active: true,
          categories: [
            {
              code: 'Masters35_M61',
              maximumWeight: 61
            }
          ]
        },
        {
          code: 'Masters40',
          minAge: 40,
          maxAge: 44,
          active: true,
          categories: [
            {
              code: 'Masters40_M61',
              maximumWeight: 61
            }
          ]
        },
        {
          code: 'SR',
          minAge: 15,
          maxAge: 99,
          active: true,
          categories: [
            {
              code: 'SR_M61',
              maximumWeight: 61
            }
          ]
        }
      ],
      athletes: [
        {
          firstName: 'One',
          lastName: 'Athlete',
          team: 1
        }
      ],
      teams: [
        { id: 1, name: 'CAN' }
      ],
      records: [
        createRecord({
          recordFederation: 'IWF',
          recordName: 'Senior Record',
          ageGrp: 'SR',
          ageGrpLower: 15,
          ageGrpUpper: 99,
          bwCatLower: 55,
          bwCatUpper: 61,
          bwCatString: '61',
          gender: 'M',
          athleteName: 'Athlete, One',
          groupNameString: ''
        }),
        createRecord({
          recordFederation: 'IWF',
          recordName: 'Junior Record',
          ageGrp: 'JR',
          ageGrpLower: 15,
          ageGrpUpper: 20,
          bwCatLower: 55,
          bwCatUpper: 61,
          bwCatString: '61',
          gender: 'M',
          athleteName: 'Athlete, One',
          groupNameString: ''
        }),
        createRecord({
          recordFederation: 'IWF',
          recordName: 'Masters 40-44 Record',
          ageGrp: 'Masters',
          ageGrpLower: 40,
          ageGrpUpper: 44,
          bwCatLower: 55,
          bwCatUpper: 61,
          bwCatString: '61',
          gender: 'M',
          athleteName: 'Athlete, One',
          groupNameString: ''
        }),
        createRecord({
          recordFederation: 'IWF',
          recordName: 'Masters 35-39 Record',
          ageGrp: 'Masters',
          ageGrpLower: 35,
          ageGrpUpper: 39,
          bwCatLower: 55,
          bwCatUpper: 61,
          bwCatString: '61',
          gender: 'M',
          athleteName: 'Athlete, One',
          groupNameString: ''
        })
      ]
    };

    const sessionCategories = [
      {
        items: [
          {
            firstName: 'One',
            lastName: 'Athlete',
            gender: 'M',
            categoryCode: 'SR_M61',
            participations: [
              { categoryCode: 'JR_M61' },
              { categoryCode: 'Masters35_M61' },
              { categoryCode: 'Masters40_M61' }
            ]
          }
        ]
      }
    ];

    const records = extractRecords(db, sessionCategories, sortRecordsByFederation, formatCategoryDisplay);

    expect(records.map(({ ageGroup, ageGroupLower, ageGroupUpper }) => ({ ageGroup, ageGroupLower, ageGroupUpper }))).toEqual([
      { ageGroup: 'JR', ageGroupLower: 15, ageGroupUpper: 20 },
      { ageGroup: 'Masters', ageGroupLower: 35, ageGroupUpper: 39 },
      { ageGroup: 'Masters', ageGroupLower: 40, ageGroupUpper: 44 },
      { ageGroup: 'SR', ageGroupLower: 15, ageGroupUpper: 99 }
    ]);
  });

  it('keeps only current-event provisional records', () => {
    expect(isCurrentCompetitionProvisionalRecord(createRecord(), 'Current Event')).toBe(true);
    expect(isCurrentCompetitionProvisionalRecord(createRecord({ event: '' }), 'Current Event')).toBe(false);
    expect(isCurrentCompetitionProvisionalRecord(createRecord({ event: 'Old Event' }), 'Current Event')).toBe(false);
    expect(isCurrentCompetitionProvisionalRecord(createRecord({ groupNameString: '' }), 'Current Event')).toBe(false);
  });

  it('filters session new records by session and current event', () => {
    const db = {
      competition: { name: 'Current Event' },
      records: [
        createRecord({ recordValue: 100 }),
        createRecord({ recordValue: 101, event: '' }),
        createRecord({ recordValue: 102, event: 'Old Event' }),
        createRecord({ recordValue: 103, groupNameString: 'B' })
      ]
    };

    const records = extractNewRecords(db, 'A', sortRecordsByFederation, formatCategoryDisplay);

    expect(records).toHaveLength(1);
    expect(records[0].value).toBe(100);
  });

  it('keeps only the largest summary record per category and lift', () => {
    const records = keepLargestRecordsBySummaryCategory([
      createRecord({ recordValue: 100, athleteName: 'First Snatch' }),
      createRecord({ recordValue: 105, athleteName: 'Best Snatch' }),
      createRecord({ recordValue: 103, athleteName: 'Middle Snatch' }),
      createRecord({ recordLift: 'CLEANJERK', recordValue: 120, athleteName: 'Best Clean and Jerk' }),
      createRecord({ ageGrp: 'JR', ageGrpLower: 15, ageGrpUpper: 20, recordValue: 95, athleteName: 'Junior Snatch' })
    ], 'Open');

    expect(records.map((record) => record.athleteName)).toEqual([
      'Best Snatch',
      'Best Clean and Jerk',
      'Junior Snatch'
    ]);
  });

  it('collapses session new-record improvements by default', () => {
    const db = {
      competition: { name: 'Current Event' },
      records: [
        createRecord({ recordValue: 100, athleteName: 'First Snatch' }),
        createRecord({ recordValue: 105, athleteName: 'Best Snatch' })
      ]
    };

    const records = extractNewRecords(db, 'A', sortRecordsByFederation, formatCategoryDisplay);

    expect(records.map((record) => record.value)).toEqual([105]);
  });

  it('can keep all session new-record improvements when collapse is disabled', () => {
    const db = {
      competition: { name: 'Current Event' },
      records: [
        createRecord({ recordValue: 100, athleteName: 'First Snatch' }),
        createRecord({ recordValue: 105, athleteName: 'Best Snatch' })
      ]
    };

    const records = extractNewRecords(db, 'A', sortRecordsByFederation, formatCategoryDisplay, {}, { collapse: false });

    expect(records.map((record) => record.value)).toEqual([100, 105]);
  });
});