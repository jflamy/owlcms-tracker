import { describe, expect, it } from 'vitest';

import {
  extractNewRecords,
  isCurrentCompetitionProvisionalRecord
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
});