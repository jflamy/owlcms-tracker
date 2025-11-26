# V2 Format Support Implementation Summary

## Overview

Implemented modular V2 format detection and processing for owlcms-tracker, allowing it to handle both V1 (legacy) and V2 (new) database formats from OWLCMS.

## Changes Made

### 1. Format Detection Module (`format-detector.js`)

**Location:** `src/lib/server/format-detector.js`

**Purpose:** Detect which format version a database payload uses

**Functions:**

- `detectFormat(params)` - Returns 'v1' or 'v2' based on presence of `formatVersion: "2.0"`
- `isV2Format(params)` - Boolean check for V2 format
- `isV1Format(params)` - Boolean check for V1 format

**Detection Logic:**

```javascript
// V2 format has explicit formatVersion field
if (params.formatVersion === '2.0' || params.formatVersion === 2.0) {
  return 'v2';
}
// Otherwise, V1 (legacy)
return 'v1';
```

### 2. V2 Format Parser (`parser-v2.js`)

**Location:** `src/lib/server/parser-v2.js`

**Purpose:** Parse OWLCMS V2 database format with name/code references

**Key Features:**

- ✅ Recognizes `formatVersion: "2.0"` field
- ✅ Handles numeric values (not strings) for weights, rankings, etc.
- ✅ Uses `categoryCode` strings instead of numeric category IDs
- ✅ Processes `participations` array with `categoryCode` field
- ✅ Extracts categories from `ageGroups` structure
- ✅ Extracts FOPs from `platforms` array
- ✅ Formats date arrays `[year, month, day]` to ISO strings
- ✅ No @id fields (clean DTOs)

**Main Function:**

```javascript
parseV2Database(params) -> {
  formatVersion: '2.0',
  athletes: [...],      // Normalized with numeric types
  categories: [...],    // Extracted from ageGroups
  fops: [...],          // Extracted from platforms
  sessions: [...],
  competition: {...},
  config: {...}
}
```

**Athlete Normalization:**

- All numeric fields remain numeric (no string conversion)
- `categoryCode` mapped to both `categoryName` and `category` for compatibility
- Attempt fields use raw numeric values (`snatch1Declaration`, etc.)
- Results use numeric types (`bestSnatch`, `total`, `sinclair`)
- Rankings use numeric types (`totalRank`, `sinclairRank`)

### 3. V1 Format Parser (`parser-v1.js`)

**Location:** `src/lib/server/parser-v1.js`

**Purpose:** Parse OWLCMS V1 (legacy) database format with ID references

**Key Features:**

- ✅ No `formatVersion` field
- ✅ Handles string representations of numbers (converts to numeric)
- ✅ Parses `-` strings as null/0 values
- ✅ Processes `groupAthletes` embedded format
- ✅ Backward compatible with existing tracker behavior

**Main Function:**

```javascript
parseV1Database(params) -> {
  athletes: [...],      // Normalized with converted types
  liftingOrder: [...],
  competition: {...},
  timer: {...},
  displaySettings: {...}
}
```

**Legacy Conversions:**

- String numbers converted to numeric (`parseInt`, `parseFloat`)
- String `-` converted to 0 or null
- `athlete.sattempts[0].stringValue` parsed to numeric weight
- Boolean strings `'true'`/`'false'` converted to booleans

### 4. Competition Hub Updates (`competition-hub.js`)

**Location:** `src/lib/server/competition-hub.js`

**Changes:**

- Added imports for format detector and both parsers
- Refactored `parseFullCompetitionData()` to use modular format detection
- Kept legacy parsing logic as `parseFullCompetitionDataLegacy()` for reference
- Auto-detects format and routes to appropriate parser

**New Logic:**

```javascript
parseFullCompetitionData(params) {
  const format = detectFormat(params);
  console.log(`[Hub] 📋 Detected format: ${format.toUpperCase()}`);
  
  if (isV2Format(params)) {
    result = parseV2Database(params);
  } else {
    result = parseV1Database(params);
  }
  
  return result;
}
```

## V1 vs V2 Comparison

| Feature | V1 (Legacy) | V2 (New) |
|---------|-------------|----------|
| Format marker | None | `formatVersion: "2.0"` |
| Category references | Numeric IDs | String codes (`"M73"`, `"W59"`) |
| Number types | Strings (`"120"`, `"-"`) | Numeric (`120`, `null`) |
| Participations | Category ID | `categoryCode` string |
| Jackson @id fields | May have @id | No @id (clean DTOs) |
| Date format | ISO strings | Arrays `[year, month, day]` |
| Weight values | Strings in attempts | Direct numeric fields |

## Modular Design Benefits

### Easy V1 Removal

When V1 format is no longer needed:

1. Delete `parser-v1.js`
2. Remove V1 import from `competition-hub.js`
3. Remove V1 branch from `parseFullCompetitionData()`
4. Remove legacy detection from `format-detector.js`

### Clean Separation

- **Format detection** - One place (`format-detector.js`)
- **V1 parsing** - One file (`parser-v1.js`)
- **V2 parsing** - One file (`parser-v2.js`)
- **Hub orchestration** - Routes to correct parser

### Testability

Each parser can be tested independently:

```javascript
import { parseV2Database } from './parser-v2.js';
const result = parseV2Database(v2Payload);
// Verify result structure
```

## WebSocket Flow

```text
OWLCMS
  ↓ WebSocket: type="database"
  ↓ payload: { formatVersion: "2.0", athletes: [...], ... }
  ↓
Competition Hub
  ↓ handleFullCompetitionData()
  ↓ parseFullCompetitionData()
  ↓ detectFormat() → "v2"
  ↓ parseV2Database()
  ↓ Normalize athletes with numeric types
  ↓ Extract categories from ageGroups
  ↓ Extract FOPs from platforms
  ↓
databaseState: {
  formatVersion: '2.0',
  athletes: [normalized],
  categories: [extracted],
  fops: ['Platform_A', 'Platform_B'],
  ...
}
  ↓
Broadcast to browsers via SSE
```

## Testing Instructions

1. **Enable v2Export feature switch** in OWLCMS:
   - Database config table: Add `v2Export` to feature switches
   - Or set `OWLCMS_FEATURESWITCHES=v2Export` environment variable

2. **Start OWLCMS** with tracker URL configured:
   - `ws://localhost:8096/ws`

3. **Start tracker** and monitor console:

   ```bash
   npm run dev
   ```

4. **Expected console output:**

   ```text
   [Hub] Parsing full competition database
   [Hub] 📋 Detected format: V2
   [V2 Parser] Parsing V2 format database
   [V2 Parser] Processing 42 athletes
   [V2 Parser] Has ageGroups: true count: 15
   [V2 Parser] Has competition: true
   [V2 Parser] Has platforms: true count: 3
   [V2 Parser] ✅ Parsed 42 athletes, 15 categories, 3 FOPs
   ```

5. **Verify numeric types** in browser console:

   ```javascript
   fetch('/api/scoreboard?type=lifting-order&fop=A')
     .then(r => r.json())
     .then(data => {
       console.log('Weight type:', typeof data.athletes[0].snatch1Declaration); // 'number'
       console.log('Rank type:', typeof data.athletes[0].totalRank); // 'number'
     });
   ```

## Migration Path

### Phase 1: Dual Support (Current)

- Both V1 and V2 formats supported
- Automatic detection and routing
- No breaking changes

### Phase 2: V2 Preferred

- OWLCMS defaults to V2 format
- V1 support remains for legacy installations
- Documentation encourages V2 adoption

### Phase 3: V1 Deprecation (Future)

- Remove `parser-v1.js`
- Remove V1 detection logic
- Simplify format detector to assert V2

## Files Created/Modified

### Created

1. `src/lib/server/format-detector.js` - Format version detection
2. `src/lib/server/parser-v2.js` - V2 format parser
3. `src/lib/server/parser-v1.js` - V1 format parser (extracted)

### Modified

1. `src/lib/server/competition-hub.js` - Updated to use modular parsers

## Backward Compatibility

✅ **V1 format continues to work** - No breaking changes

✅ **V2 format automatically detected** - No configuration needed

✅ **Legacy code preserved** - `parseFullCompetitionDataLegacy()` kept for reference

✅ **Existing scoreboards unchanged** - Both formats normalize to same internal structure

## Summary

The tracker now:

- ✅ Automatically detects V1 vs V2 format
- ✅ Uses modular parsers for each format
- ✅ Handles V2 numeric types correctly
- ✅ Processes V2 categoryCode references
- ✅ Extracts categories from ageGroups
- ✅ Extracts FOPs from platforms
- ✅ Maintains backward compatibility with V1
- ✅ Provides easy path to remove V1 support later
