import { describe, it, expect } from 'vitest';
import { calculatePredictedTotal, calculatePredictedIfNext } from '../../src/plugins/nvf-lagkonkurranse/helpers.data.js';

/**
 * Predicted total tests
 * Verifies that the helper calculates predicted total based on attempt progress
 */
describe('calculatePredictedTotal', () => {
  it('uses first snatch request when no attempts done', () => {
    const athlete = {
      bestSnatch: 0,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '150' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    // With includeCjDeclaration=true (default): 120 (snatch) + 150 (cj) = 270
    expect(calculatePredictedTotal(athlete, true)).toBe(270);
    // With includeCjDeclaration=false: just 120 (snatch)
    expect(calculatePredictedTotal(athlete, false)).toBe(120);
  });

  it('uses next snatch request after first snatch completed', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'request', stringValue: '125' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '150' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    // With includeCjDeclaration=true: 125 (next snatch) + 150 (cj decl) = 275
    expect(calculatePredictedTotal(athlete, true)).toBe(275);
    // With includeCjDeclaration=false: just 125 (next snatch)
    expect(calculatePredictedTotal(athlete, false)).toBe(125);
  });

  it('after snatch complete uses first clean&jerk declaration', () => {
    const athlete = {
      bestSnatch: 130,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'good', stringValue: '130' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '150' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    // Snatch complete (3 done), uses calculatePredictedIfNext logic
    // bestSnatch=130, firstCJ=150 => 130 + 150 = 280
    expect(calculatePredictedTotal(athlete)).toBe(280);
  });

  it('uses next CJ request during clean & jerk phase', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'request', stringValue: '140' } ]
    };
    // 5 attempts done, next CJ = 140
    // bestSnatch=120, nextCJ=140 => 120 + 140 = 260
    expect(calculatePredictedTotal(athlete)).toBe(260);
  });

  it('returns actual total when all attempts complete', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 140,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'good', stringValue: '140' } ]
    };
    // 6 attempts done => bestSnatch + bestCJ = 120 + 140 = 260
    expect(calculatePredictedTotal(athlete)).toBe(260);
  });

  it('returns 0 when no athlete provided', () => {
    expect(calculatePredictedTotal(null)).toBe(0);
    expect(calculatePredictedTotal(undefined)).toBe(0);
  });
});
