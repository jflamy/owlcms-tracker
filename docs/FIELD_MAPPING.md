# Field Mapping - OWLCMS Data Sources

## Overview

The team scoreboard merges data from two sources:
1. **Group Athletes** - From OWLCMS `/update` endpoint (`fopUpdate.groupAthletes`)
2. **Database Athletes** - From OWLCMS `/database` endpoint (`databaseState.athletes`)

**Strategy:** Use Group Athletes first (they have computed fields), then add Database-only athletes.

## Data Flow

```
OWLCMS /database → Competition Hub → databaseState.athletes[]
OWLCMS /update   → Competition Hub → fopUpdates[fopName].groupAthletes (JSON string)
                                   ↓
                        Team Scoreboard helpers.data.js
                                   ↓
                    Merged Athletes (groupAthletes + database-only)
                                   ↓
                         Browser Display (page.svelte)
```

## Field Mapping Table

### Core Identity Fields

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `fullName` | `groupAthlete.fullName` | `"${dbAthlete.firstName} ${dbAthlete.lastName}".trim()` | Group version is preformatted |
| `firstName` | `groupAthlete.firstName` | `dbAthlete.firstName` | Raw first name |
| `lastName` | `groupAthlete.lastName` | `dbAthlete.lastName` | Raw last name |
| `startNumber` | `groupAthlete.startNumber` | `dbAthlete.startNumber` | Athlete's start number |
| `lotNumber` | `groupAthlete.lotNumber` | `dbAthlete.lotNumber` | Drawing lot number |
| `gender` | `groupAthlete.gender` | `dbAthlete.gender` | "M" or "F" |

### Team/Club Fields

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `teamName` | `groupAthlete.teamName` | `dbAthlete.team \|\| dbAthlete.club` | Primary display name |
| `team` | `groupAthlete.team` | `dbAthlete.team \|\| dbAthlete.club` | Fallback field |

### Category Fields

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `categoryName` | **✓ `groupAthlete.category`** | **✓ `dbAthlete.categoryName`** | Both sources now have formatted category name |
| `category` | `groupAthlete.category` | `dbAthlete.categoryName` | Same as `categoryName` |
| `bodyWeight` | `groupAthlete.bodyWeight` | `dbAthlete.bodyWeight` | In kilograms |
| `yearOfBirth` | `groupAthlete.yearOfBirth` | `dbAthlete.fullBirthDate?.[0]` | Year only |

### Attempt Fields - Snatch

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `sattempts[0]` | `groupAthlete.sattempts[0]` | `formatAttempt(...)` | **Group has `className` field!** |
| `sattempts[1]` | `groupAthlete.sattempts[1]` | `formatAttempt(...)` | See attempt object structure below |
| `sattempts[2]` | `groupAthlete.sattempts[2]` | `formatAttempt(...)` | |
| **Attempt Object** | | | |
| ↳ `liftStatus` | Precomputed | `'empty'\|'request'\|'fail'\|'good'` | Computed from raw data |
| ↳ `stringValue` | Precomputed | Weight string or `(failed)` | Priority: actual→change2→change1→declaration |
| ↳ `className` | **✓ Only in Group!** | ❌ Not available | `"current blink"`, `"next"`, `""` |

**Database fields for Snatch attempts:**
- `dbAthlete.snatch1Declaration`
- `dbAthlete.snatch1Change1`
- `dbAthlete.snatch1Change2`
- `dbAthlete.snatch1ActualLift`
- `dbAthlete.snatch1AutomaticProgression`

### Attempt Fields - Clean & Jerk

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `cattempts[0]` | `groupAthlete.cattempts[0]` | `formatAttempt(...)` | **Group has `className` field!** |
| `cattempts[1]` | `groupAthlete.cattempts[1]` | `formatAttempt(...)` | |
| `cattempts[2]` | `groupAthlete.cattempts[2]` | `formatAttempt(...)` | |

**Database fields for C&J attempts:**
- `dbAthlete.cleanJerk1Declaration`
- `dbAthlete.cleanJerk1Change1`
- `dbAthlete.cleanJerk1Change2`
- `dbAthlete.cleanJerk1ActualLift`
- `dbAthlete.cleanJerk1AutomaticProgression`

### Results Fields

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `bestSnatch` | `groupAthlete.bestSnatch` | `computeBestLift([snatch1/2/3ActualLift])` | Highest successful snatch |
| `bestCleanJerk` | `groupAthlete.bestCleanJerk` | `computeBestLift([cleanJerk1/2/3ActualLift])` | Highest successful C&J |
| `total` | `groupAthlete.total` | `dbAthlete.total \|\| 0` | Sum of best snatch + best C&J |
| `totalRank` | `groupAthlete.totalRank` | `0` (not computed) | Ranking by total |

### Scoring Fields

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `sinclair` | `groupAthlete.sinclair` | `dbAthlete.sinclair \|\| 0` | Sinclair coefficient score |
| `globalScore` | `groupAthlete.globalScore` | `dbAthlete.globalScore \|\| null` | Competition-specific score |

### Current Lifting State (Group Athletes ONLY)

| Display Field | Group Athlete Source | Database Athlete Source | Notes |
|--------------|---------------------|------------------------|-------|
| `classname` | **✓ `groupAthlete.classname`** | ❌ Not available | `"current"`, `"current blink"`, `"next"`, `"NONE"` |
| `inCurrentGroup` | Derived (in group) | `false` | Flag to identify group membership |

### Attempt Object Structure

#### From Group Athletes (Precomputed by OWLCMS)
```javascript
{
  liftStatus: 'request',        // 'empty' | 'request' | 'fail' | 'good'
  stringValue: '120',           // Weight or '(120)' for failed
  className: ' current blink'   // ✓ CRITICAL for highlighting!
}
```

#### From Database Athletes (Computed by helpers.data.js)
```javascript
formatAttempt(declaration, change1, change2, actualLift, automaticProgression)
// Returns:
{
  liftStatus: 'request',        // Computed from actualLift or declaration
  stringValue: '120',           // Priority: actual > change2 > change1 > declaration
  // ❌ NO className field!
}
```

## Key Differences

### Group Athletes (Current Session)
✅ **Have:**
- Precomputed attempt objects with `liftStatus` and `stringValue`
- **`className` field on attempts** (critical for highlighting!)
- `classname` field on athlete (current/next/NONE)
- Computed totals and rankings
- Best lifts already calculated

❌ **Don't Have:**
- Athletes not in current group/session
- Full competition data

### Database Athletes (Full Competition)
✅ **Have:**
- All athletes in competition
- Raw declaration/change/actualLift data
- Complete category information
- Full competition history

❌ **Don't Have:**
- `className` on attempts (no highlighting info)
- `classname` on athlete (no current/next status)
- Precomputed attempt display strings
- Current lifting order info

## Merging Strategy in helpers.data.js

```javascript
// Step 1: Start with all groupAthletes (they have className!)
allAthletes = groupAthletes.map(ga => ga);

// Step 2: Identify who's in the group
const currentGroupLotNumbers = new Set(
  groupAthletes.map(a => String(a.lotNumber)).filter(Boolean)
);

// Step 3: Add database-only athletes (not in current group)
const databaseOnlyAthletes = databaseState.athletes
  .filter(dbAthlete => !currentGroupLotNumbers.has(String(dbAthlete.lotNumber)))
  .map(dbAthlete => {
    // Format to match groupAthlete structure
    return {
      fullName: `${dbAthlete.firstName || ''} ${dbAthlete.lastName || ''}`.trim(),
      teamName: dbAthlete.team || dbAthlete.club,
      // ... format attempts using formatAttempt()
      sattempts: [
        formatAttempt(snatch1Declaration, snatch1Change1, ...), // ❌ No className!
        formatAttempt(snatch2Declaration, snatch2Change1, ...),
        formatAttempt(snatch3Declaration, snatch3Change1, ...)
      ],
      // ... etc
      inCurrentGroup: false // ✓ Flag for identification
    };
  });

// Step 4: Combine
allAthletes = [...groupAthletes, ...databaseOnlyAthletes];
```

## Why This Strategy?

### Problem: Highlighting Requires `className`

The highlighting CSS in `page.svelte` depends on:
```css
.scoreboard-table tbody tr.current td.attempt.request.current {
  color: #fbbf24 !important; /* Yellow for current requested weight */
}
```

This requires:
1. `tr.current` - from athlete's `classname` field
2. `td.attempt.request.current` - from attempt's `className` field

**Only Group Athletes have both!**

### Solution: Prioritize Group Athletes

1. Use Group Athletes for current session (have `className`)
2. Add Database Athletes for everyone else (no highlighting needed - they're not lifting)
3. Merge into single list for team grouping/display

## Lot Number Matching

**Critical:** Lot numbers must be string-compared!

```javascript
// Group Athletes: lotNumber is STRING
groupAthlete.lotNumber = "42"

// Database Athletes: lotNumber is NUMBER
dbAthlete.lotNumber = 42

// Must convert for comparison:
currentGroupLotNumbers.has(String(dbAthlete.lotNumber))
```

## formatAttempt() Priority Logic

When computing attempts from database, the priority order is:

1. **actualLift** - If lift was attempted (with `-` prefix for fails)
2. **change2** - Most recent weight change
3. **change1** - Earlier weight change
4. **declaration** - Original declared weight
5. **automaticProgression** - Calculated default (e.g., after good lift)

```javascript
function formatAttempt(declaration, change1, change2, actualLift, automaticProgression) {
  // If attempted
  if (actualLift && actualLift !== '' && actualLift !== '0') {
    if (actualLift.startsWith('-')) {
      return { liftStatus: 'fail', stringValue: `(${actualLift.substring(1)})` };
    } else {
      return { liftStatus: 'good', stringValue: actualLift };
    }
  }
  
  // Not attempted yet - check for requested weight
  const displayWeight = change2 || change1 || declaration || automaticProgression;
  
  if (displayWeight) {
    return { liftStatus: 'request', stringValue: displayWeight };
  }
  
  return { liftStatus: 'empty', stringValue: '' };
}
```

## Category Name Lookup

Database athletes have `category` as an **ID number**, must look up name:

```javascript
function getCategoryName(categoryId, databaseState) {
  if (!categoryId || !databaseState?.ageGroups) return '';
  
  for (const ageGroup of databaseState.ageGroups) {
    if (ageGroup.categories) {
      const category = ageGroup.categories.find(c => c.id === categoryId);
      if (category) {
        return category.name || category.code || '';
      }
    }
  }
  return '';
}
```

## Display in page.svelte

```svelte
<!-- Athlete row with classname for highlighting -->
<tr class="{athlete.classname || ''}">
  <td class="start-num">{athlete.startNumber}</td>
  <td class="name">{athlete.fullName}</td>
  
  <!-- Snatch attempts with className for weight highlighting -->
  <td class="attempt {getAttemptClass(athlete.sattempts?.[0])} {athlete.sattempts?.[0]?.className || ''}">
    {displayAttempt(athlete.sattempts?.[0])}
  </td>
  <!-- ... more attempts ... -->
</tr>
```

**CSS Targeting:**
- `tr.current` - Athlete with `classname="current"` or `"current blink"`
- `tr.next` - Athlete with `classname="next"`
- `td.attempt.request.current` - Attempt cell with `className=" current blink"`

## Summary

| Data Need | Source | Reason |
|-----------|--------|--------|
| Current athlete highlighting | Group Athletes `classname` | Only group has current/next/NONE |
| Requested weight highlighting | Group Athletes attempt `className` | Only group has current/blink on attempts |
| All athletes in team | Merge both sources | Database has full roster |
| Computed totals/ranks | Group Athletes (preferred) | OWLCMS precomputes these |
| Raw lift data | Database Athletes | For athletes not in current session |
| Team grouping | Both sources | Combine for complete team view |

## Sample Data Examples

### Sample 1: Group Athlete (Currently Lifting)

**Source:** `fopUpdate.groupAthletes` (JSON parsed from `/update` endpoint)

```json
{
  "fullName": "GARCIA, Steven",
  "teamName": "NORTH",
  "yearOfBirth": "1994",
  "startNumber": "3",
  "category": "M 79",
  
  "sattempts": [
    {
      "liftStatus": "request",
      "stringValue": "71",
      "className": " current blink"
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    }
  ],
  
  "cattempts": [
    {
      "liftStatus": "request",
      "stringValue": "85",
      "className": ""
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    },
    {
      "liftStatus": "empty",
      "stringValue": "",
      "className": ""
    }
  ],
  
  "bestSnatch": "-",
  "bestCleanJerk": "-",
  "total": "-",
  "totalRank": "-",
  "sinclair": "-",
  "sinclairRank": "-",
  "group": "M1",
  
  "classname": "current blink"
}
```

**Key Points:**
- `classname: "current blink"` enables row highlighting
- `sattempts[0].className: " current blink"` enables weight cell highlighting
- `category` is already formatted as "M 79" (no lookup needed)
- All attempts are precomputed objects with `liftStatus`, `stringValue`, and `className`
- Note: Field is `category`, not `categoryName` in Group Athletes

### Sample 2: Database Athlete (Same Person)

**Source:** `databaseState.athletes[]` (from `/database` endpoint)

```json
{
  "firstName": "Steven",
  "lastName": "GARCIA",
  "team": "Barbell Club",
  "club": "Barbell Club",
  "startNumber": 12,
  "lotNumber": 42,
  "category": 15,
  "gender": "M",
  "bodyWeight": 72.5,
  "fullBirthDate": [1995, 5, 15],
  
  "snatch1Declaration": "71",
  "snatch1Change1": "",
  "snatch1Change2": "",
  "snatch1ActualLift": "",
  "snatch1AutomaticProgression": "",
  
  "snatch2Declaration": "",
  "snatch2Change1": "",
  "snatch2Change2": "",
  "snatch2ActualLift": "",
  "snatch2AutomaticProgression": "",
  
  "snatch3Declaration": "",
  "snatch3Change1": "",
  "snatch3Change2": "",
  "snatch3ActualLift": "",
  "snatch3AutomaticProgression": "",
  
  "cleanJerk1Declaration": "85",
  "cleanJerk1Change1": "",
  "cleanJerk1Change2": "",
  "cleanJerk1ActualLift": "",
  "cleanJerk1AutomaticProgression": "",
  
  "cleanJerk2Declaration": "",
  "cleanJerk2Change1": "",
  "cleanJerk2Change2": "",
  "cleanJerk2ActualLift": "",
  "cleanJerk2AutomaticProgression": "",
  
  "cleanJerk3Declaration": "",
  "cleanJerk3Change1": "",
  "cleanJerk3Change2": "",
  "cleanJerk3ActualLift": "",
  "cleanJerk3AutomaticProgression": "",
  
  "total": 0,
  "sinclair": 0.0,
  "globalScore": null
}
```

**Key Points:**
- NO `classname` field (can't highlight rows)
- NO attempt objects with `className` (can't highlight cells)
- `lotNumber` is a number, not a string (needs conversion)
- `category` is an ID (15), not a name (needs lookup to get "M73")
- Raw attempt data requires calling `formatAttempt()` 6 times per athlete
- `fullBirthDate` is an array (need to extract year)

### Sample 3: Completed Lifts

**Source:** `fopUpdate.groupAthletes`

```json
{
  "fullName": "JONES, Mary",
  "teamName": "PowerHouse Gym",
  "startNumber": 5,
  "lotNumber": "15",
  "categoryName": "W59",
  "gender": "F",
  "bodyWeight": 58.7,
  
  "sattempts": [
    {
      "liftStatus": "good",
      "stringValue": "65",
      "className": ""
    },
    {
      "liftStatus": "fail",
      "stringValue": "(68)",
      "className": ""
    },
    {
      "liftStatus": "good",
      "stringValue": "68",
      "className": ""
    }
  ],
  
  "cattempts": [
    {
      "liftStatus": "good",
      "stringValue": "85",
      "className": ""
    },
    {
      "liftStatus": "good",
      "stringValue": "90",
      "className": ""
    },
    {
      "liftStatus": "fail",
      "stringValue": "(93)",
      "className": ""
    }
  ],
  
  "bestSnatch": 68,
  "bestCleanJerk": 90,
  "total": 158,
  "totalRank": 1,
  "sinclair": 196.52,
  "globalScore": 196.52,
  
  "classname": "NONE"
}
```

**Key Points:**
- `classname: "NONE"` (not currently lifting, no row highlight)
- All `className` fields are empty (no cell highlighting)
- Failed lifts shown with parentheses: `"(68)"`, `"(93)"`
- `bestSnatch`, `bestCleanJerk`, `total` are computed

## Field Mapping Summary Table

This table shows the complete mapping for a sample athlete (GARCIA, Steven) from both data sources:

| Field | Group Athlete Value | Database Athlete Value | Transformation | Priority |
|-------|---------------------|------------------------|----------------|----------|
| **Identity** |
| `fullName` | `"GARCIA, Steven"` ✓ | Computed: `"Steven GARCIA"` | Concatenate firstName + lastName | Group (preformatted) |
| `firstName` | `"Steven"` ✓ | `"Steven"` ✓ | None | Equal |
| `lastName` | `"GARCIA"` ✓ | `"GARCIA"` ✓ | None | Equal |
| `startNumber` | `12` ✓ | `12` ✓ | None | Equal |
| `lotNumber` | `"42"` (string) ✓ | `42` (number) | Convert to string: `String(42)` | Group (correct type) |
| `gender` | `"M"` ✓ | `"M"` ✓ | None | Equal |
| `bodyWeight` | `72.5` ✓ | `72.5` ✓ | None | Equal |
| `yearOfBirth` | `1995` ✓ | Extract: `[1995, 5, 15][0]` | Extract from fullBirthDate array | Group (direct value) |
| **Team/Category** |
| `teamName` | `"Barbell Club"` ✓ | `"Barbell Club"` ✓ | Fallback: `team \|\| club` | Group (preformatted) |
| `team` | `"Barbell Club"` ✓ | `"Barbell Club"` ✓ | None | Equal |
| `categoryName` | **✓ From `category`: `"M 79"`** | **✓ `"M 79"`** | Both sources now have formatted name | **Equal (both preformatted!)** |
| `category` | **✓ `"M 79"`** (formatted name) | **✓ `"M 79"`** (formatted name, was ID) | Database now has name, not ID | Equal |
| **Attempts - Snatch 1** |
| `sattempts[0].liftStatus` | `"request"` ✓ | Computed: `"request"` | Parse 5 fields → determine status | Group (precomputed) |
| `sattempts[0].stringValue` | `"71"` ✓ | Computed: `"71"` | Priority: actual→change2→change1→declaration | Group (precomputed) |
| `sattempts[0].className` | **⭐ `" current blink"`** | ❌ Not available | N/A - not in database | **Group ONLY!** |
| **Results** |
| `bestSnatch` | `0` ✓ | Computed: `computeBestLift([actualLift1,2,3])` | Find highest successful lift | Group (precomputed) |
| `bestCleanJerk` | `0` ✓ | Computed: `computeBestLift([actualLift1,2,3])` | Find highest successful lift | Group (precomputed) |
| `total` | `0` ✓ | `0` ✓ | Sum of best snatch + best C&J | Equal |
| `totalRank` | `0` ✓ | `0` (not computed) | OWLCMS ranking logic | Group (precomputed) |
| **Scoring** |
| `sinclair` | `0.0` ✓ | `0.0` ✓ | Sinclair coefficient calculation | Equal |
| `globalScore` | `null` ✓ | `null` ✓ | Competition-specific score | Equal |
| **State (Current Lifting)** |
| `classname` | **⭐ `"current blink"`** | ❌ Not available | N/A - not in database | **Group ONLY!** |
| `inCurrentGroup` | `true` (implicit) | `false` (set by code) | Flag added during merge | Derived |

### Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Field exists with this value |
| ⭐ | Critical for highlighting (ONLY in Group!) |
| ❌ | Field does not exist in this source |
| **Bold** | Preferred source or important note |

### Key Takeaways from Summary

1. **Group Athletes are preformatted** - OWLCMS computes display values
2. **Database Athletes need transformation** - Must parse, lookup, compute
3. **categoryName now in Group!** - No longer need lookup for current session athletes
4. **className/classname ONLY in Group** - Essential for highlighting current/next
5. **Type conversions required** - lotNumber (string vs number), category (name vs ID)
6. **Merge preserves Group data** - Group athletes keep all their precomputed fields

**Key Insight:** Group Athletes are the "source of truth" for current session, Database Athletes fill in the gaps for everyone else.
