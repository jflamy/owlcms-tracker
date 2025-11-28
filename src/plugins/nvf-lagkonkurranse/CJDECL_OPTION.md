# NVF Lagkonkurranse: cjDecl Option

## Overview

Added a new `cjDecl` (Clean & Jerk Declaration) option to control how predicted totals are calculated in the NVF team scoreboard.

## New Option

### Configuration (config.js)

```javascript
{
    key: 'cjDecl',
    label: 'Include first C&J attempt in predicted',
    type: 'boolean',
    default: true,
    description: 'en=Include first C&J attempt in predicted; no=Inkluder første støt i anslått samenlagt.'
}
```

### URL Parameter

- `cjDecl=true` (default): Predicted total mode
- `cjDecl=false`: Prediction after next lift mode

Example URLs:
```
/nvf-lagkonkurranse?fop=Platform_A&cjDecl=true
/nvf-lagkonkurranse?fop=Platform_A&cjDecl=false
```

## New Rules

### When cjDecl=true (Predicted Total Mode)

**Behavior:** Includes the first C&J declaration in the predicted total at all times.

**Logic:**
- During snatches: Predicts next snatch + includes first C&J declaration in total
- After snatches: Uses achieved best snatch + predicts C&J (based on first C&J declaration if no C&J achieved yet)

**Result:** Shows what the final total would be if the predicted snatch AND the declared C&J are both achieved.

**Purpose:** Provides a full predicted total that includes the declared C&J weight in the calculation.

### When cjDecl=false (Prediction After Next Lift Mode)

**Behavior:** Only includes the first C&J declaration AFTER all snatches are completed. This is the "conservative" prediction that only looks ahead to the next lift.

**Calculation:**
- During snatches (attemptsDone < 3): Uses achieved values only
- After snatches (attemptsDone >= 3): Includes C&J declaration in prediction

**Timing:**
- Zero snatch done (attemptsDone=0): No CJ declaration used
- One snatch done (attemptsDone=1): No CJ declaration used
- Two snatches done (attemptsDone=2): No CJ declaration used
- Snatches finished (attemptsDone=3): CJ declaration is used in prediction

**Purpose:** Shows the prediction for what happens after the current/next lift, without looking too far ahead.

## Implementation Details

### Modified Files

1. **config.js**
   - Added new `cjDecl` option to the options array

2. **helpers.data.js**
   - Extract `cjDecl` option: `const cjDecl = options.cjDecl !== 'false' && options.cjDecl !== false;`
   - Updated `calculatePredictedTotal()` function signature to accept `cjDecl` parameter
   - Updated function logic to use `attemptsDone` to determine whether to include CJ declaration
   - Updated cache key to include `cjDecl`: `const cacheKey = \`${fopName}-${groupAthletesHash}-${gender}-${topN}-${sortBy}-${currentAttemptInfo}-${language}-${cjDecl}\`;`
   - Updated all options returns to include `cjDecl` in the options object

### Function: calculatePredictedTotal()

```javascript
/**
 * Calculate the predicted total
 * @param {Object} athlete - Athlete object with sattempts, cattempts, bestSnatch, bestCleanJerk
 * @param {string} preferredLiftType - 'snatch' or 'cleanJerk'
 * @param {number} attemptsDone - Number of attempts completed (0-6)
 *   attemptsDone=0: zero snatch done (about to do snatch 1)
 *   attemptsDone=1: one snatch done (about to do snatch 2)
 *   attemptsDone=2: two snatches done (about to do snatch 3)
 *   attemptsDone=3: snatches finished (about to do C&J 1)
 * @param {boolean} cjDecl - Whether to include first C&J declaration in predicted total (default: true)
 *   When true (predicted total): uses CJ declaration even during snatches (attemptsDone 0-2)
 *   When false (prediction after next lift): uses CJ declaration only after snatches finished (attemptsDone >= 3)
 * @returns {number} Predicted total
 */
function calculatePredictedTotal(athlete, preferredLiftType = 'snatch', attemptsDone = 0, cjDecl = true) {
    if (!athlete) return 0;
    
    const bestSnatch = parseFormattedNumber(athlete.bestSnatch) || 0;
    const bestCJ = parseFormattedNumber(athlete.bestCleanJerk) || 0;
    
    let cjValue = bestCJ;
    
    // When cjDecl=true: always consider CJ declaration (predicted total)
    if (cjDecl) {
        const firstCJDecl = parseInt(athlete.cattempts?.[0]?.stringValue || '', 10);
        if (!isNaN(firstCJDecl) && firstCJDecl > 0) {
            cjValue = Math.max(bestCJ, firstCJDecl);
        }
    }
    // When cjDecl=false: only consider CJ declaration after snatches finished
    else if (attemptsDone >= 3) {
        const firstCJDecl = parseInt(athlete.cattempts?.[0]?.stringValue || '', 10);
        if (!isNaN(firstCJDecl) && firstCJDecl > 0) {
            cjValue = Math.max(bestCJ, firstCJDecl);
        }
    }

    return bestSnatch + cjValue;
}
```

## Translation Keys

| Language | Key | Value |
|----------|-----|-------|
| English | cjDecl label | "Include first C&J attempt in predicted" |
| Norwegian | cjDecl label | "Inkluder første støt i anslått samenlagt" |
| English | cjDecl description | "en=Include first C&J attempt in predicted; no=Inkluder første støt i anslått samenlagt." |

## Notes for Future Implementation

- The `attemptsDone` parameter is critical - it represents the number of completed attempts (not the array index)
- Default value should be `true` to maintain backward compatibility with existing behavior (showing predicted totals)
- Cache key must include `cjDecl` to avoid cache collisions between different settings
- All early "waiting" states should also include `cjDecl` in their returned options
