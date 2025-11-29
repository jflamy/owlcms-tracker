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

function logAndTest(description, athlete, liftType, attemptsDone, cjDecl, expected) {
  const result = calculatePredictedTotal(athlete, liftType, attemptsDone, cjDecl);
  
  // Find the next snatch request (first attempt with status 'request')
  const nextSnatchRequest = athlete.sattempts?.find(a => a.liftStatus === 'request')?.stringValue || 'none';
  // Find the next CJ request
  const nextCJRequest = athlete.cattempts?.find(a => a.liftStatus === 'request')?.stringValue || 'none';
  // First CJ declaration (always cattempts[0].stringValue if available)
  const firstCJDecl = athlete.cattempts?.[0]?.stringValue || 'none';
  
  console.log(`${description}:`);
  console.log(`  Parameters: liftType=${liftType}, attemptsDone=${attemptsDone}, cjDecl=${cjDecl}`);
  console.log(`  Best lifts: bestSnatch=${athlete.bestSnatch}, bestCJ=${athlete.bestCleanJerk}`);
  console.log(`  Next snatch request: ${nextSnatchRequest}`);
  console.log(`  First CJ declaration: ${firstCJDecl}`);
  console.log(`  Next CJ request: ${nextCJRequest}`);
  console.log(`  sattempts: ${athlete.sattempts?.map(a => `${a.liftStatus}:${a.stringValue || '-'}`).join(', ') || 'none'}`);
  console.log(`  cattempts: ${athlete.cattempts?.map(a => `${a.liftStatus}:${a.stringValue || '-'}`).join(', ') || 'none'}`);
  console.log(`  => RESULT: predictedTotal=${result} (expected=${expected})`);
  console.log('');
  return result;
}

describe('calculatePredictedTotal - Snatch Phase with cjDecl=true', () => {
  it('before snatch (0 attempts done): uses snatch[0] + CJ declaration', () => {
    const athlete = {
      bestSnatch: 0,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'request', stringValue: '100' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=true: before snatch (0 done)', athlete, 'snatch', 0, true, 220);
    expect(total).toBe(220);
  });

  it('during snatch (1 attempt done): uses snatch[1] + CJ declaration', () => {
    const athlete = {
      bestSnatch: 100,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'request', stringValue: '105' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=true: during snatch (1 done)', athlete, 'snatch', 1, true, 225);
    expect(total).toBe(225);
  });

  it('during snatch (2 attempts done): uses snatch[2] + CJ declaration', () => {
    const athlete = {
      bestSnatch: 105,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'request', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=true: during snatch (2 done)', athlete, 'snatch', 2, true, 230);
    expect(total).toBe(230);
  });

  it('after 3 snatches (all done, no more requests): uses bestSnatch + CJ declaration', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=true: after 3 snatches', athlete, 'snatch', 2, true, 230);
    expect(total).toBe(230);
  });
});

describe('calculatePredictedTotal - Snatch Phase with cjDecl=false', () => {
  it('before snatch (0 attempts done): uses snatch[0] only, no CJ', () => {
    const athlete = {
      bestSnatch: 0,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'request', stringValue: '100' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=false: before snatch (0 done)', athlete, 'snatch', 0, false, 100);
    expect(total).toBe(100);
  });

  it('during snatch (1 attempt done): uses snatch[1] only, no CJ', () => {
    const athlete = {
      bestSnatch: 100,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'request', stringValue: '105' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=false: during snatch (1 done)', athlete, 'snatch', 1, false, 105);
    expect(total).toBe(105);
  });

  it('during snatch (2 attempts done): uses snatch[2] only, no CJ', () => {
    const athlete = {
      bestSnatch: 105,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'request', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=false: during snatch (2 done)', athlete, 'snatch', 2, false, 110);
    expect(total).toBe(110);
  });

  it('after 3 snatches (all done): uses bestSnatch only, no CJ', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Snatch cjDecl=false: after 3 snatches', athlete, 'snatch', 2, false, 110);
    expect(total).toBe(110);
  });
});

describe('calculatePredictedTotal - C&J Phase with cjDecl=true', () => {
  it('on first C&J (0 C&J attempts done): uses bestSnatch + CJ[0]', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('C&J cjDecl=true: first C&J (0 done)', athlete, 'cleanJerk', 0, true, 230);
    expect(total).toBe(230);
  });

  it('during C&J (1 C&J attempt done): uses bestSnatch + CJ[1]', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 120,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'request', stringValue: '125' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('C&J cjDecl=true: during C&J (1 done)', athlete, 'cleanJerk', 1, true, 235);
    expect(total).toBe(235);
  });

  it('at last C&J (2 C&J attempts done): uses bestSnatch + CJ[2]', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 125,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'request', stringValue: '130' } ]
    };
    const total = logAndTest('C&J cjDecl=true: last C&J (2 done)', athlete, 'cleanJerk', 2, true, 240);
    expect(total).toBe(240);
  });

  it('after all C&J done (no more requests): uses bestSnatch + bestCJ', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'good', stringValue: '130' } ]
    };
    const total = logAndTest('C&J cjDecl=true: after all C&J', athlete, 'cleanJerk', 2, true, 240);
    expect(total).toBe(240);
  });
});

describe('calculatePredictedTotal - C&J Phase with cjDecl=false', () => {
  it('on first C&J (0 C&J attempts done): uses bestSnatch + CJ[0]', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('C&J cjDecl=false: first C&J (0 done)', athlete, 'cleanJerk', 0, false, 230);
    expect(total).toBe(230);
  });

  it('during C&J (1 C&J attempt done): uses bestSnatch + CJ[1]', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 120,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'request', stringValue: '125' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('C&J cjDecl=false: during C&J (1 done)', athlete, 'cleanJerk', 1, false, 235);
    expect(total).toBe(235);
  });

  it('at last C&J (2 C&J attempts done): uses bestSnatch + CJ[2]', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 125,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'request', stringValue: '130' } ]
    };
    const total = logAndTest('C&J cjDecl=false: last C&J (2 done)', athlete, 'cleanJerk', 2, false, 240);
    expect(total).toBe(240);
  });

  it('after all C&J done (no more requests): uses bestSnatch + bestCJ', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'good', stringValue: '125' }, { liftStatus: 'good', stringValue: '130' } ]
    };
    const total = logAndTest('C&J cjDecl=false: after all C&J', athlete, 'cleanJerk', 2, false, 240);
    expect(total).toBe(240);
  });
});

describe('calculatePredictedTotal - Edge Cases', () => {
  it('handles failed snatches correctly', () => {
    const athlete = {
      bestSnatch: 100,
      bestCleanJerk: 0,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'fail', stringValue: '(105)' }, { liftStatus: 'request', stringValue: '105' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Edge: failed snatches', athlete, 'snatch', 2, true, 225);
    expect(total).toBe(225);
  });

  it('handles failed C&J correctly', () => {
    const athlete = {
      bestSnatch: 110,
      bestCleanJerk: 120,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'good', stringValue: '105' }, { liftStatus: 'good', stringValue: '110' } ],
      cattempts: [ { liftStatus: 'good', stringValue: '120' }, { liftStatus: 'fail', stringValue: '(125)' }, { liftStatus: 'request', stringValue: '125' } ]
    };
    const total = logAndTest('Edge: failed C&J', athlete, 'cleanJerk', 2, true, 235);
    expect(total).toBe(235);
  });

  it('handles null/undefined athlete', () => {
    console.log('Edge: null athlete => 0');
    console.log('Edge: undefined athlete => 0');
    expect(calculatePredictedTotal(null, 'snatch', 0, true)).toBe(0);
    expect(calculatePredictedTotal(undefined, 'snatch', 0, true)).toBe(0);
  });

  it('handles missing attempts arrays', () => {
    const athlete = {
      bestSnatch: 100,
      bestCleanJerk: 120
    };
    const total = logAndTest('Edge: missing attempts arrays', athlete, 'snatch', 0, true, 220);
    expect(total).toBe(220);
  });

  it('uses bestCJ when CJ declaration is lower during snatch phase', () => {
    const athlete = {
      bestSnatch: 100,
      bestCleanJerk: 130,
      sattempts: [ { liftStatus: 'good', stringValue: '100' }, { liftStatus: 'request', stringValue: '105' }, { liftStatus: 'empty', stringValue: '' } ],
      cattempts: [ { liftStatus: 'request', stringValue: '120' }, { liftStatus: 'empty', stringValue: '' }, { liftStatus: 'empty', stringValue: '' } ]
    };
    const total = logAndTest('Edge: bestCJ > CJ declaration', athlete, 'snatch', 1, true, 235);
    expect(total).toBe(235);
  });
});
