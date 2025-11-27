<!-- markdownlint-disable -->
# Athlete Getter Methods - API Reference

## Overview

The Competition Hub now provides three convenience methods to identify and extract data for the current, next, and previous athletes on any Field of Play (FOP). These methods support both V1 and V2 update formats from OWLCMS.

**Key Features:**
- ✅ Automatic V1/V2 format detection
- ✅ Weight extraction with change priority (change2 → change1 → declaration → automatic)
- ✅ Attempt number and lift type calculation
- ✅ Fallback handling for missing data

## Methods

### `getCurrentAthlete(fopName = 'A')`

Returns the athlete currently lifting on the specified FOP.

**Parameters:**
- `fopName` (string, optional) - FOP identifier (default: 'A')

**Returns:**
- `Object` - Enriched athlete object with current weight and attempt info
- `null` - If no current athlete found

**Enriched Fields:**
```javascript
{
  // Original athlete fields (OWLCMS V2 sessionAthletes payload)
  fullName: "ØKLAND, Hanna",
  teamName: "Trondheim AK",
  startNumber: 1,
  lotNumber: 31,
  categoryName: "SK 64",
  gender: "F",
  yearOfBirth: 2001,
  
  // Additional fields provided by OWLCMS V2
  key: 1816345641203026224,
  snatch1Declaration: 67,
  sattempts: [...],           // Precomputed snatch attempts (objects with liftStatus/stringValue)
  cattempts: [...],           // Precomputed clean & jerk attempts
  classname: "current blink",
  attemptsDone: 2,
  currentLiftType: "snatch",  // "snatch" or "cleanJerk"
  currentAttempt: 3,          // Attempt number (1-3)
  currentWeight: 69           // Weight requested for current attempt
}
```

**V2 Format Detection:**
- Uses `update.currentAthleteKey` to find athlete in `update.sessionAthletes` array
- Extracts weight from attempt declaration/change fields

**V1 Format Detection:**
- Uses `update.liftingOrderAthletes[0]` (first in lifting order)
- Fallback: finds athlete with `classname` containing "current"
- Extracts weight from `update.weight` (root level string)

**Example:**
```javascript
import { competitionHub } from '$lib/server/competition-hub.js';

const current = competitionHub.getCurrentAthlete('Platform_A');
if (current) {
  console.log(`${current.fullName} attempting ${current.currentWeight}kg on attempt ${current.currentAttempt}`);
}
```

---

### `getNextAthlete(fopName = 'A')`

Returns the athlete scheduled to lift next on the specified FOP.

**Parameters:**
- `fopName` (string, optional) - FOP identifier (default: 'A')

**Returns:**
- `Object` - Enriched athlete object with next weight and attempt info
- `null` - If no next athlete found

**Enriched Fields:** Same as `getCurrentAthlete()`

**V2 Format Detection:**
- Uses `update.nextAthleteKey` to find athlete in `update.sessionAthletes` array

**V1 Format Detection:**
- Uses `update.liftingOrderAthletes[1]` (second in lifting order)
- Fallback: finds athlete with `classname` containing "next"

**Example:**
```javascript
const next = competitionHub.getNextAthlete('Platform_A');
if (next) {
  console.log(`Next: ${next.fullName} - ${next.currentWeight}kg`);
}
```

---

### `getPreviousAthlete(fopName = 'A')`

Returns the athlete who just completed their lift on the specified FOP.

**Parameters:**
- `fopName` (string, optional) - FOP identifier (default: 'A')

**Returns:**
- `Object` - Enriched athlete object (V2 format only)
- `null` - If no previous athlete found (or V1 format)

**Enriched Fields:** Same as `getCurrentAthlete()`

**V2 Format Detection:**
- Uses `update.previousAthleteKey` to find athlete in `update.sessionAthletes` array

**V1 Format Limitation:**
- Returns `null` - V1 format does not track previous athlete explicitly
- Future enhancement could search `groupAthletes` for last completed lift

**Example:**
```javascript
const previous = competitionHub.getPreviousAthlete('Platform_A');
if (previous) {
  console.log(`Previous: ${previous.fullName} - ${previous.currentWeight}kg`);
} else {
  console.log('No previous athlete data (V1 format or no data)');
}
```

---

## Weight Extraction Priority

For V2 format, weight is extracted with this priority order:

1. **`[lift][attempt]Change2`** - Most recent weight change
2. **`[lift][attempt]Change1`** - Earlier weight change
3. **`[lift][attempt]Declaration`** - Original declared weight
4. **`[lift][attempt]AutomaticProgression`** - Calculated default

**Example field names:**
- `snatch1Declaration`, `snatch1Change1`, `snatch1Change2`
- `cleanJerk2Declaration`, `cleanJerk2Change1`, `cleanJerk2Change2`

For V1 format, weight is taken from `update.weight` (root level string).

---

## Attempt Number Calculation

The attempt number is calculated from `attemptsDone`:

```javascript
const attemptsDone = athlete.attemptsDone || 0; // 0-5
const currentLiftType = attemptsDone < 3 ? 'snatch' : 'cleanJerk';
const currentAttemptNum = (attemptsDone % 3) + 1; // 1, 2, or 3
```

**Examples:**
- `attemptsDone: 0` → `snatch` attempt 1
- `attemptsDone: 2` → `snatch` attempt 3
- `attemptsDone: 3` → `cleanJerk` attempt 1
- `attemptsDone: 5` → `cleanJerk` attempt 3

---

## HTTP API Usage

A test endpoint is available for debugging:

```
GET /api/test-athlete-getters?fop=A
```

**Response:**
```json
{
  "success": true,
  "fop": "A",
  "currentAthlete": {
    "fullName": "ØKLAND, Hanna",
    "currentWeight": 69,
    "currentAttempt": 3,
    "currentLiftType": "snatch",
    "attemptsDone": 2
  },
  "nextAthlete": {
    "fullName": "SMITH, Jane",
    "currentWeight": 75,
    "currentAttempt": 1,
    "currentLiftType": "snatch"
  },
  "previousAthlete": null,
  "timestamp": 1732649123456
}
```

---

## Internal Helper Methods

### `_isV2Format(update)`

Detects V2 format by checking for `sessionAthletes` array and `currentAthleteKey` field.

**Returns:** `boolean`

---

### `_enrichAthleteData(athlete, update)`

Adds `currentWeight`, `currentAttempt`, `currentLiftType`, and `attemptsDone` fields to athlete object.

**Parameters:**
- `athlete` - Raw athlete object
- `update` - FOP update object for context

**Returns:** Enriched athlete object

---

### `_extractWeight(athlete, fieldPrefix)`

Extracts weight for a specific attempt with change priority.

**Parameters:**
- `athlete` - Athlete object
- `fieldPrefix` - Field prefix (e.g., 'snatch1', 'cleanJerk2')

**Returns:** Weight in kg (number) or `null`

---

## Testing

Run the test script to verify functionality:

```bash
# Start tracker (in separate terminal)
npm run dev

# Run test (in another terminal)
node tests/test-athlete-getters.js
```

**Expected output:**
```
✅ Connected to tracker WebSocket
📂 Loading sample UPDATE message...
📤 Sending UPDATE message to tracker...

🔍 Testing athlete getter methods via HTTP API...

📊 Results for FOP "A":

✅ Current Athlete:
   Name: ØKLAND, Hanna
   Weight: 69 kg
   Attempt: 3
   Lift Type: snatch
   Attempts Done: 2

✅ Next Athlete:
   Name: SMITH, Jane
   Weight: 75 kg
   Attempt: 1
   Lift Type: snatch

ℹ️  No previous athlete found (expected for V1 format)

✅ Test complete!
```

---

## Migration Guide for Plugin Developers

**Before:**
```javascript
// Old approach - direct access to raw update data
const fopUpdate = competitionHub.getFopUpdate(fopName);
const currentAthlete = fopUpdate.liftingOrderAthletes?.[0];
const currentWeight = fopUpdate.weight; // String, not parsed
```

**After:**
```javascript
// New approach - use getter methods
const currentAthlete = competitionHub.getCurrentAthlete(fopName);
if (currentAthlete) {
  const weight = currentAthlete.currentWeight;  // Parsed number
  const attempt = currentAthlete.currentAttempt; // Computed 1-3
  const liftType = currentAthlete.currentLiftType; // "snatch" or "cleanJerk"
}
```

**Benefits:**
- ✅ Automatic V1/V2 format handling
- ✅ Weight parsing and priority handling
- ✅ Attempt calculation
- ✅ Consistent API across format versions

---

## V2 Format Support

The methods are designed for V2 format but work with V1 as fallback:

**V2 Features:**
- Athlete keys for precise lookup
- Numeric types for weights
- Separate first/last names
- `attemptsDone` field for attempt tracking

**V1 Compatibility:**
- Falls back to `liftingOrderAthletes` array
- Uses `classname` field for current/next identification
- Extracts weight from root-level `update.weight` string

**Future Enhancement:**
When OWLCMS fully implements V2 export, these methods will automatically use the more efficient V2 lookup paths.

---

## See Also

- [SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md) - Overall system architecture
- [WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md) - OWLCMS message formats
- [FIELD_MAPPING.md](./FIELD_MAPPING.md) - Data field mappings between V1/V2
- [tests/test-athlete-getters.js](../tests/test-athlete-getters.js) - Test script
