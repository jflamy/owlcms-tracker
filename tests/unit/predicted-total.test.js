import { describe, it, expect } from 'vitest';
import { calculatePredictedTotal } from '../../src/plugins/nvf-lagkonkurranse/helpers.data.js';

/**
 * Predicted total mapping tests
 * Verifies that the helper selects the single next declaration based on attemptsDone
 */
describe('calculatePredictedTotal', () => {
  it('uses snatch[0] when attemptsDone=0 (snatch stage)', () => {
    const athlete = {
      bestSnatch: 0,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 0);
    expect(total).toBe(120);
  });

  it('uses snatch[1] when attemptsDone=1 and adds delta over bestSnatch', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'request', stringValue: '125' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 1);
    // baseTotal = 120 + 0 = 120; chosenRequest=125; delta=5 => predicted=125
    expect(total).toBe(125);
  });

  it('after snatch3 (attemptsDone=3) uses first clean&jerk declaration', () => {
    const athlete = {
      bestSnatch: 130,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'good', stringValue: '130' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '150' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 3);
    // baseTotal = 130 + 0 = 130; chosenRequest=150 (CJ1) currentBestForChosen=bestCJ=0 => delta=150 => predicted=280
    expect(total).toBe(280);
  });

  it('uses cleanJerk[2] when attemptsDone=2 during clean & jerk', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'request', stringValue: '140' } ]
    };
    const total = calculatePredictedTotal(athlete, 'cleanJerk', 2);
    // baseTotal = 120 + 130 = 250; chosenRequest=140 currentBestForChosen=130 => delta=10 => predicted=260
    expect(total).toBe(260);
  });

  it('returns base total when next declaration is less than current best (no delta)', () => {
    const athlete = {
      bestSnatch: 130,
      bestCleanJerk: 140,
      sattempts: [ { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 1);
    // chosenRequest=120 <= bestSnatch=130 => delta 0 => predicted = baseTotal = 270
    expect(total).toBe(270);
  });

  it('when no next declaration exists for CJ at attemptsDone=3 returns base total', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'good', stringValue: '140' } ]
    };
    const total = calculatePredictedTotal(athlete, 'cleanJerk', 3);
    // No next declaration after CJ3 -> chosenRequest=0 => predicted=baseTotal=250
    expect(total).toBe(250);
  });
});
