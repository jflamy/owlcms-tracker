import { describe, it, expect } from 'vitest';
import { calculatePredictedTotal } from '../../src/plugins/nvf-lagkonkurranse/helpers.data.js';

/**
 * Predicted total mapping tests
 * Verifies that the helper selects the correct prediction based on liftType phase
 * 
 * Function signature: calculatePredictedTotal(athlete, liftType, attemptsDone, cjDecl)
 * - liftType: 'snatch' or 'cleanJerk' - determines which phase we're in
 * - attemptsDone: Number of attempts done within current lift type (0-2)
 * - cjDecl: Whether to include first C&J declaration during snatch phase (default: true)
 */
describe('calculatePredictedTotal', () => {
  it('uses snatch[0] when in snatch phase with 0 attempts done', () => {
    const athlete = {
      bestSnatch: 0,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 0);
    expect(total).toBe(120);
  });

  it('uses snatch[1] when in snatch phase with 1 attempt done', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'request', stringValue: '125' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 1);
    // predictedSnatch=125 (next request), predictedCJ=0 (no declaration) => 125
    expect(total).toBe(125);
  });

  it('uses first C&J declaration during snatch phase when cjDecl=true (default)', () => {
    const athlete = {
      bestSnatch: 130,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'good', stringValue: '130' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '150' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    // During snatch phase with all snatches done (no more requests), uses bestSnatch + CJ declaration
    const total = calculatePredictedTotal(athlete, 'snatch', 2, true);
    // predictedSnatch=130 (no more requests), predictedCJ=150 (first declaration) => 280
    expect(total).toBe(280);
  });

  it('uses cleanJerk next request during C&J phase', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'request', stringValue: '140' } ]
    };
    const total = calculatePredictedTotal(athlete, 'cleanJerk', 2);
    // predictedSnatch=120 (snatches done), predictedCJ=140 (next request) => 260
    expect(total).toBe(260);
  });

  it('uses cleanJerk[1] when C&J phase with 1 attempt done', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 120,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'request', stringValue: '130' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'cleanJerk', 1);
    // predictedSnatch=120, predictedCJ=130 (next request) => 250
    expect(total).toBe(250);
  });

  it('uses cleanJerk[0] when C&J phase with 0 attempts done', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '150' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'cleanJerk', 0);
    // predictedSnatch=120, predictedCJ=150 (next request) => 270
    expect(total).toBe(270);
  });

  it('returns predicted snatch when next declaration is less than current best during snatch', () => {
    const athlete = {
      bestSnatch: 130,
      bestCleanJerk: 140,
      sattempts: [ { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = calculatePredictedTotal(athlete, 'snatch', 1);
    // predictedSnatch=120 (next request, even if lower), predictedCJ=140 (best, no declaration) => 260
    // Note: getPredictedBestLift returns the request even if lower than best
    expect(total).toBe(260);
  });

  it('when no next declaration exists for CJ returns best achieved', () => {
    const athlete = {
      bestSnatch: 120,
      bestCleanJerk: 140,
      sattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '120' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '130' }, { liftStatus: 'good', stringValue: '140' } ]
    };
    const total = calculatePredictedTotal(athlete, 'cleanJerk', 2);
    // predictedSnatch=120, predictedCJ=140 (no more requests, use best) => 260
    expect(total).toBe(260);
  });
});
