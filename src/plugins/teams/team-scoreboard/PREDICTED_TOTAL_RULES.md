# Predicted Total Computation Rules

This document describes the rules for computing predicted totals in the team scoreboard, based on the **CJ Declaration** and **Bombout** options.

**Note:** This document targets the `teams/team-scoreboard` plugin — the repository's extension-capable base. Extensions that delegate to `team-scoreboard` (via `delegateTo`) inherit these rules unless they explicitly override them.

---

## Configuration Options

### `cjDecl` - Include CJ Declaration

- **URL Parameter:** `?cjDecl=true` or `?cjDecl=false`
- **Default:** `true`
- **Effect:** When `true`, includes the first C&J declaration weight in the predicted total during the snatch phase.

### `enforceBombout` - Bomb-out Rule

- **URL Parameter:** `?enforceBombout=true` or `?enforceBombout=false`
- **Default:** `true` (IWF standard), `false` for France extension
- **Effect:** When `true`, if an athlete fails all 3 attempts in snatch OR all 3 attempts in C&J, their total becomes 0.

---

## Prediction Logic

The predicted total represents what the athlete's total would be **if their next attempt succeeds**.

### Phase-Based Logic

| Phase                  | Attempts Done | Predicted Total Calculation                            |
| ---------------------- | ------------- | ------------------------------------------------------ |
| **Pre-competition**    | 0             | First snatch request (+ first CJ request if `cjDecl=true`) |
| **Snatch in progress** | 1-2           | Next snatch request (+ first CJ request if `cjDecl=true`)  |
| **Snatch complete**    | 3             | Best snatch + first C&J request                        |
| **C&J in progress**    | 4-5           | Best snatch + next C&J request                         |
| **Competition complete** | 6           | Best snatch + best C&J (actual total)                  |

### Detailed Rules

#### During Snatch Phase (0-2 attempts completed)

**When `cjDecl=false` (default):**

- Predicted total = next snatch request weight only
- No C&J is included in prediction
- Rationale: C&J declaration may change significantly after snatch phase

**When `cjDecl=true`:**

- Predicted total = next snatch request + first C&J request
- Includes the athlete's declared opening C&J
- Rationale: Show full expected total including C&J opener

#### After Snatch Phase (3+ attempts completed)

- `cjDecl` option has no effect
- Predicted total = best snatch + next C&J request
- Once snatch is complete, standard prediction logic applies

---

## Bombout Rule Effects

### When `enforceBombout=true` (IWF Standard)

If an athlete fails ALL 3 attempts in snatch OR ALL 3 attempts in C&J:

- `actualTotal` = 0
- `predictedTotal` = 0
- `actualScore` = 0
- `predictedScore` = 0

**Detection logic:**

1. Check snatch attempts: if all 3 are `status='bad'` → bombed
2. Check C&J attempts: if all 3 are `status='bad'` → bombed
3. If either check returns true → athlete has bombed out

### When `enforceBombout=false` (French Federation Practice)

Bombout is not enforced:

- `actualTotal` = best snatch + best C&J (as normal)
- `predictedTotal` = calculated as normal
- Scores are calculated from actual totals

**Note:** Even with bombout disabled, an athlete who fails all snatches AND all C&Js will naturally have total=0 (since both best values are 0).

---

## Examples

### Example 1: Snatch in Progress, cjDecl=false

**Athlete state:**

- Snatch attempt 1: Good (100 kg)
- Snatch attempt 2: Pending request (105 kg)
- C&J attempt 1: Declared (130 kg)

**Predicted total:** `105` (next snatch only, no C&J)

### Example 2: Snatch in Progress, cjDecl=true

Same athlete state as above.

**Predicted total:** `105 + 130 = 235` (includes C&J declaration)

### Example 3: Snatch Complete

**Athlete state:**

- Best snatch: 100 kg
- C&J attempt 1: Pending request (130 kg)

**Predicted total:** `100 + 130 = 230` (cjDecl option irrelevant after snatch phase)

### Example 4: Bombed Out in Snatch (enforceBombout=true)

**Athlete state:**

- Snatch attempt 1: Bad (-95 kg)
- Snatch attempt 2: Bad (-95 kg)
- Snatch attempt 3: Bad (-95 kg)
- C&J attempt 1: Declared (120 kg)

**Results:**

- `actualTotal` = 0 (bombed out)
- `predictedTotal` = 0 (bombed out, cannot recover)
- `actualScore` = 0
- `predictedScore` = 0

### Example 5: Bombed Out in Snatch (enforceBombout=false)

Same athlete state as Example 4.

**Results:**

- `actualTotal` = 0 (no successful snatches, but rule not enforced)
- `predictedTotal` = calculated normally (though likely still low)
- Since best snatch = 0, prediction would be `0 + 120 = 120`

---

## Code Compliance Verification

### Files Implementing These Rules

1. **`src/plugins/teams/team-scoreboard/helpers.data.js`**
   - **Layer 2 - Raw Extraction:**
     - `teamAthleteFromSession()` - Extracts raw data, returns `rawTotal`, `rawPredictedTotal`, `bombed` flag
     - `teamAthleteFromDatabase()` - Same for database athletes
     - `calculatePredictedTotal(athlete, includeCjDeclaration)` - Phase-based prediction (raw values)
     - `calculatePredictedIfNext(athlete)` - Core prediction logic
     - `hasBombedOut(athlete)` - Detects bombout condition (no enforceBombout param)
   
   - **Layer 2.5 - Scoring Computation:**
     - `computeAthleteScoring(athlete, context)` - Applies `enforceBombout` to get actual/display values
     - `applyScoring(athletes, context)` - Bulk scoring application
     - `computeScore(total, bodyWeight, gender, scoringSystem, age)` - Score calculation
     - `formatScore(score, scoringSystem)` - Display formatting
   
   - **Layer 3 - Team Grouping:**
     - `groupByTeams()` - Groups athletes and computes team scores
     - `getScoreboardData()` - Orchestrates the entire flow

2. **`src/plugins/teams/team-scoreboard/config.js`**
   - `cjDecl` option definition (default: `true`)
   - `enforceBombout` option definition (default: `false`)

3. **`extensions/France/équipes/config.js`**
   - Inherits from base `team-scoreboard` via `delegateTo`
   - Can override defaults if needed
   - `calculateScore()` - Uses pre-computed total (respects bombout)

### Architecture: Separation of Extraction and Scoring

**Key principle:** The same competition can display different totals on different scoreboards.

- **IWF Results Scoreboard:** Uses `enforceBombout=true` → bombed athletes show total=0
- **Team Competition Scoreboard:** Uses `enforceBombout=false` → bombed athletes show sum of best lifts

This is achieved by separating data extraction from bombout application:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: Raw Extraction                                              │
│ - teamAthleteFromSession() / teamAthleteFromDatabase()               │
│ - Returns: rawTotal, rawPredictedTotal, bombed flag                  │
│ - Does NOT apply enforceBombout                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2.5: Scoring Computation                                       │
│ - applyScoring(athletes, { enforceBombout, scoringSystem })          │
│ - Applies enforceBombout: actualTotal = (enforceBombout && bombed) ? 0 : rawTotal │
│ - Computes scores: Sinclair, GAMX, etc.                              │
│ - Returns: actualTotal, actualScore, displayTotal, displayScore     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Team Grouping                                               │
│ - groupByTeams() uses computed scores for ranking                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Parameter Flow

```text
1. Base plugin config.js defines defaults (e.g., teams/team-scoreboard)
    ↓
2. Extension config.js overrides base defaults (e.g., France/équipes)
    ↓
3. URL parameters override extension defaults
    ↓
4. helpers.data.js fallbacks apply ONLY if option not defined anywhere
    ↓
getScoreboardData() receives fully-resolved options:
    - cjDecl → includeCjDeclaration
    - enforceBombout
    ↓
teamAthleteFromSession/teamAthleteFromDatabase() receive context:
    - { includeCjDeclaration }  (NOT enforceBombout - applied later)
    ↓
hasBombedOut(athlete) detects bombout condition
    ↓
calculatePredictedTotal(athlete, includeCjDeclaration) computes raw prediction
    ↓
applyScoring(athletes, { enforceBombout, scoringSystem }) applies bombout rule:
    - actualTotal = (enforceBombout && bombed) ? 0 : rawTotal
    - predictedTotal = (enforceBombout && bombed) ? 0 : rawPredictedTotal
    - Computes scores from bombout-aware totals
```

### Extension Integration

Extensions (like France équipes) with a `calculateScore()` function:

- Receive `total` as first parameter (already accounts for bombout if `enforceBombout=true`)
- Should NOT recalculate total from best lifts
- Return `null` to delegate to base scoring systems

---

## Summary Table

| Option           | Default (Base) | Default (France) | Effect                                       |
| ---------------- | -------------- | ---------------- | -------------------------------------------- |
| `cjDecl`         | `true`         | `true`           | Include C&J decl in snatch-phase predictions |
| `enforceBombout` | `false`        | `false`          | Zero total on 3 failed attempts in any lift  |

---

## Architecture Refactoring (2026-02-01)

### Issue
The same competition may need to show:
- **IWF Results Scoreboard:** Bombed athletes display total = 0 (strict IWF rule)
- **Team Scoreboard:** Bombed athletes display sum of best lifts (French federation practice)

### Previous Approach (Problematic)
Bombout was applied during extraction in `teamAthleteFromSession()` and `teamAthleteFromDatabase()`.
This meant all scoreboards received the same (bombout-applied) totals.

### New Approach (Correct)
Bombout is applied in a separate **Layer 2.5 (Scoring Computation)** phase:
1. Extraction functions return **raw values** (`rawTotal`, `rawPredictedTotal`, `bombed` flag)
2. `applyScoring()` applies `enforceBombout` option to convert raw → actual values
3. Each scoreboard can use different `enforceBombout` settings

### Bugs Fixed

1. **`teamAthleteFromDatabase` was not extracting `enforceBombout` from context** (obsolete - now not needed)
2. **Bombout applied at extraction time prevented different scoreboards from showing different rules**
   - Fixed by separating extraction from scoring computation
