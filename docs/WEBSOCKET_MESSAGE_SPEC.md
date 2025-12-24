# OWLCMS WebSocket Event Forwarding - Message Format Specification

## Overview

OWLCMS can send competition events over WebSocket connections when configured with `ws://` or `wss://` URLs. All messages use a consistent wrapper format with a type indicator and payload.

**Format Version:** V2 only - Tracker expects modern OWLCMS format with `sessionAthletes` (not legacy `groupAthletes`)

## Message Structure

All messages follow this JSON structure:

```json
{
  "type": "update|timer|decision|database",
  "payload": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

## Message Types

### 1. UPDATE Messages

**Type:** `"update"`

**Purpose:** General competition state updates including athlete changes, lifting order, group information

**Key Payload Fields:**

- `uiEvent` - Event class name that triggered the update (e.g., "LiftingOrderUpdated", "SwitchGroup", "GroupDone")
- `updateKey` - Validation key
- `competitionName` - Name of the competition
- `fop` - Field of play name (or `fopName` - both field names are accepted)
- `fopState` - Current FOP state (e.g., "BREAK", "CURRENT_ATHLETE", etc.)
- `break` - Boolean string indicating if in break ("true"/"false")
- `breakType` - Type of break if applicable (e.g., "GROUP_DONE", "BEFORE_INTRODUCTION", etc.)
- `groupName` - Name of the current group (empty when session is done)
- `fullName` - Current athlete's full name
- `teamName` - Current athlete's team
- `attemptNumber` - Current attempt number (1-6)
- `weight` - Requested weight
- Plus additional athlete, group, and competition data

**Special Events:**

- **`uiEvent: "GroupDone"`** - Indicates the current session/group has completed
  - `fopState` will be "BREAK"
  - `breakType` will be "GROUP_DONE"
  - `groupName` will be empty string
  - This signals scoreboards to show final results or session complete message
  - **Session returns to "in progress" when ANY of the following is received:**
    - Timer event (type="timer" with any athleteTimerEventType)
    - Decision event (type="decision" with any decisionEventType)
    - Any other update event (type="update" with uiEvent that is not "GroupDone")
  - Tracker automatically detects session reopening and logs: "🔄 Session reopened for FOP X"

**Frequency:** Sent on most UI events + keepalive every 15 seconds

#### V2 Session Athletes Format

UPDATE messages include a `sessionAthletes` array in V2 format. Each entry contains an `athlete` DTO with raw athlete data and a `displayInfo` object with precomputed display values that match OWLCMS internal scoreboards:

```json
{
  "sessionAthletes": [
    {
      "athlete": {
        "id": 123,
        "key": "123",
        "firstName": "John",
        "lastName": "DOE",
        "fullBirthDate": "1995-03-15",
        "categoryCode": "M89",
        "team": 456,
        "gender": "M",
        "startNumber": 5,
        "lotNumber": 12,
        "snatch1Declaration": 100,
        "snatch1ActualLift": -100,
        "snatch2Declaration": 100,
        "snatch2ActualLift": 100,
        ...
      },
      "displayInfo": {
        "fullName": "DOE, John",
        "teamName": "USA Weightlifting",
        "yearOfBirth": "1995",
        "gender": "M",
        "startNumber": "5",
        "lotNumber": "12",
        "category": "M89 Senior",
        "sattempts": [
          {"value": 100, "status": "bad"},
          {"value": 100, "status": "good"},
          {"value": null, "status": null}
        ],
        "cattempts": [
          {"value": 120, "status": "current"},
          {"value": null, "status": null},
          {"value": null, "status": null}
        ],
        "bestSnatch": "100",
        "bestCleanJerk": "120",
        "total": "220",
        "snatchRank": "2",
        "cleanJerkRank": "1",
        "totalRank": "1",
        "sinclair": "285.432",
        "sinclairRank": "1",
        "classname": "current blink",
        "group": "A",
        "subCategory": "",
        "flagURL": "/local/flags/USA Weightlifting.svg",
        "flagClass": "longTeam",
        "teamLength": 16,
        "custom1": "",
        "custom2": "",
        "membership": "123456"
      }
    }
  ]
}
```

**displayInfo fields:**

| Field | Type | Description |
|-------|------|-------------|
| `fullName` | string | Formatted as "LASTNAME, FirstName" |
| `teamName` | string | Team/club name (resolved from team ID) |
| `yearOfBirth` | string | Year only (e.g., "1995") |
| `gender` | string | "M" or "F" |
| `startNumber` | string | Start number as string |
| `lotNumber` | string | Lot number as string |
| `category` | string | Category name with age group (e.g., "M89 Senior") |
| `sattempts` | array | Snatch attempts as objects `[{value, status}, ...]` - see below |
| `cattempts` | array | Clean&jerk attempts as objects `[{value, status}, ...]` - see below |

**Attempt object format:**

Each attempt in `sattempts` and `cattempts` is an object with:

- `value` - The weight in kg (integer), or `null` if no data
- `status` - One of:
  - `"good"` - Successful lift
  - `"bad"` - Failed lift
  - `"current"` - Pending attempt for current athlete (should blink)
  - `"next"` - Pending attempt for next athlete
  - `"request"` - Pending attempt for other athletes
  - `null` - No data for this attempt

| `bestSnatch` | string | Best successful snatch or "-" |
| `bestCleanJerk` | string | Best successful clean&jerk or "-" |
| `total` | string | Competition total or "-" |
| `snatchRank` | string | Session rank in snatch or "-" |
| `cleanJerkRank` | string | Session rank in clean&jerk or "-" |
| `totalRank` | string | Session rank in total or "-" |
| `sinclair` | string | Computed score (e.g., Sinclair) or "-" |
| `sinclairRank` | string | Computed score rank or "-" |
| `classname` | string | CSS class: "current blink", "next", or "" |
| `group` | string | Session/group name |
| `subCategory` | string | Subcategory if applicable |
| `flagURL` | string | Path to team flag SVG |
| `flagClass` | string | "shortTeam" or "longTeam" based on name length |
| `teamLength` | number | Character length of team name |
| `custom1` | string | Custom field 1 |
| `custom2` | string | Custom field 2 |
| `membership` | string | Membership/federation ID |

**Key ordering arrays:**

UPDATE messages also include ordering arrays that reference athletes by key:

- `startOrderKeys` - Athletes in registration/start order with category spacers
- `liftingOrderKeys` - Athletes in lifting order with snatch/C&J spacers
- `currentAthleteKey` - Key of current lifting athlete
- `nextAthleteKey` - Key of next athlete

---

### 2. TIMER Messages

**Type:** `"timer"`

**Purpose:** Clock countdown updates for athlete timer and break timer

**Key Payload Fields:**

- `updateKey` - Validation key
- `fopName` - Field of play name (or `fop` - both field names are accepted)
- `mode` - Board display mode
- `fullName` - Current athlete's full name
- `attemptNumber` - Current attempt number

**Athlete Timer Fields:**
- `athleteTimerEventType` - Timer event type for athlete clock:
  - `StartTime` - Athlete timer starts counting down
  - `StopTime` - Athlete timer stops (display time but don't count)
  - `SetTime` - Athlete timer is set but not running
- `athleteMillisRemaining` - Milliseconds remaining on athlete clock
- `athleteStartTimeMillis` - Absolute start time for athlete timer
- `timeAllowed` - Total time allowed for athlete (usually 60000ms)

**Break Timer Fields:**
- `breakTimerEventType` - Timer event type for break clock:
  - `StartTime` - Break timer starts
  - `StopTime` - Break timer stops
  - `SetTime` - Break timer is set but not running
  - `Pause` - Break timer paused (clears all break timer fields)
- `breakMillisRemaining` - Milliseconds remaining on break clock
- `breakStartTimeMillis` - Absolute start time for break timer

**Other Fields:**
- `serverLocalTime` - Current server time for synchronization

**Frequency:** Sent on timer start/stop/set events

---

### 3. DECISION Messages

**Type:** `"decision"`

**Purpose:** Referee decision lights and down signal

**Key Payload Fields:**

- `decisionEventType` - Type of decision event:
  - `FULL_DECISION` - All three referees have decided
  - `RESET` - Decisions cleared
  - `DOWN_SIGNAL` - Bar has been lowered
- `updateKey` - Validation key
- `mode` - Board display mode
- `competitionName` - Name of the competition
- `fop` - Field of play name (or `fopName` - both field names are accepted)
- `fullName` - Current athlete's full name
- `attemptNumber` - Current attempt number
- `liftTypeKey` - Lift type (SNATCH/CLEANJERK)
- `d1` - Referee 1 decision (true=good, false=no lift, null=not decided)
- `d2` - Referee 2 decision
- `d3` - Referee 3 decision
- `decisionsVisible` - Boolean indicating if lights should be shown
- `down` - Boolean indicating down signal

**Frequency:** Sent when referees make decisions or bar is lowered

---

### 4. DATABASE Messages

**Type:** `"database"`

**Purpose:** Full competition state synchronization - complete data dump

**Payload Structure:**

The DATABASE message contains the complete competition export with the following top-level keys:

```json
{
  "formatVersion": "2.0",
  "competition": { ... },
  "config": { ... },
  "ageGroups": [ ... ],
  "sessions": [ ... ],
  "platforms": [ ... ],
  "teams": [ ... ],
  "athletes": [ ... ],
  "records": [ ... ],
  "technicalOfficials": [ ... ]
}
```

**Key Differences from UPDATE Messages:**

| Field | DATABASE format | UPDATE format (sessionAthletes) |
|-------|----------------|--------------------------------|
| Athletes | Raw `athletes[]` array | Wrapped `{ athlete, displayInfo }` |
| Birth date | `fullBirthDate: [year, month, day]` | `displayInfo.yearOfBirth: "1995"` |
| Team | `team: 12345` (numeric ID) | `displayInfo.teamName: "USA"` |
| Category | `categoryCode: "SR_M89"` | `displayInfo.category: "M89 Senior"` |
| Attempts | `snatch1ActualLift: -100` (negative=fail) | `displayInfo.sattempts: [{value, status}]` |
| Full name | `firstName + lastName` (separate) | `displayInfo.fullName: "DOE, John"` |

**Athlete Object (DATABASE format):**

```json
{
  "key": -1204379830,
  "lastName": "DOE",
  "firstName": "John",
  "fullBirthDate": [1996, 6, 17],
  "gender": "F",
  "bodyWeight": 45.9,
  "categoryCode": "SR_F48",
  "team": 74797,
  "sessionName": "1",
  "startNumber": 1,
  "lotNumber": 4,
  "snatch1Declaration": 40,
  "snatch1Change1": null,
  "snatch1Change2": null,
  "snatch1ActualLift": 40,
  "snatch1LiftTime": [2025, 11, 8, 13, 24, 11, 221181000],
  "snatch2Declaration": 43,
  "snatch2ActualLift": -43,
  ...
  "cleanJerk1Declaration": 50,
  "cleanJerk1ActualLift": 58,
  ...
  "participations": [
    {
      "categoryCode": "SR_F48",
      "snatchRank": 6,
      "cleanJerkRank": 5,
      "totalRank": 6,
      "teamMember": true,
      "championshipType": "IWF"
    }
  ]
}
```

**Attempt Value Convention (DATABASE format):**
- Positive value (e.g., `100`): Successful lift
- Negative value (e.g., `-100`): Failed lift
- `null`: Not yet attempted or no declaration
- Declaration/Change fields contain requested weights

**Records Array:**

```json
{
  "records": [
    {
      "id": 1848108757857399600,
      "recordValue": 87,
      "ageGrp": "JR",
      "athleteName": "Asian Standard",
      "bwCatLower": 0,
      "bwCatUpper": 48,
      "gender": "F",
      "recordFederation": "AWF",
      "recordLift": "SNATCH",
      "recordName": "Asia",
      "bwCatString": "48",
      "groupNameString": ""
    }
  ]
}
```

**New Records Detection:**
- `groupNameString` is empty for pre-existing records
- `groupNameString` contains the session name (e.g., `"1"`) for records broken during the competition

**Frequency:** Sent when remote system requests full data (typically in response to HTTP 428 status or missing data)

## Binary Frames (ZIP payloads)

In addition to the JSON text frames documented above, OWLCMS can send large binary payloads over the same WebSocket connection. These are used to transfer ZIP archives for flags, pictures, styles, and translations. The tracker recognizes a small set of binary message types and routes each ZIP to an appropriate handler.

### Frame Structure

Binary frames are sent as **binary WebSocket frames** (not text) and use a length-prefixed type header:

```
[4 bytes: typeLength (big-endian)] [typeLength bytes: UTF-8 type] [remaining bytes: ZIP payload]
```

**Parsing Algorithm:**

1. Read first 4 bytes as unsigned 32-bit big-endian (network byte order): `typeLength`
2. Read next `typeLength` bytes as UTF-8 string: `type`
3. Remaining bytes: ZIP archive binary payload
4. **Fallback:** If typeLength parsing fails but buffer begins with ZIP magic bytes (`50 4B 03 04`), treat as `flags_zip` (legacy behavior)

**Example Byte Layout (flags_zip):**

```
[00 00 00 09] [66 6C 61 67 73 5F 7A 69 70] [50 4B 03 04 ... ZIP data ...]
     ↓              ↓                          ↓
  typeLength    "flags_zip" (9 bytes)      ZIP archive
   (big-endian)    (UTF-8)                (binary payload)
```

### Supported Binary Message Types

| Type | Purpose | Handler Behavior |
|------|---------|------------------|
| `flags_zip` or `flags` | Country/team flag images | Extracts ZIP to `./local/flags/`, updates hub state, runs sanity checks |
| `logos_zip` | Team/federation logos | Extracts ZIP to `./local/logos/`, updates hub state, runs sanity checks |
| `pictures` | Athlete/team photos | Extracts ZIP to `./local/pictures/`, updates hub state |
| `styles` | Custom CSS/asset files | Extracts ZIP to `./local/styles/`, updates hub state |
| `translations_zip` | Localized text for UI | Parses `translations.json`, merges by locale, updates hub, checks checksum |

### Type-Specific Handling

#### `flags_zip` (or `flags`)

**Source:** ZIP archive containing flag image files

**Handler Processing:**
1. Extract all ZIP entries to `./local/flags/` directory
2. Files can have any image format (PNG, JPG, SVG, etc.)
3. Typical naming: `<country-code>.png` (e.g., `US.png`, `FR.png`)
4. After extraction, hub state is updated and marked as ready
5. Sanity check: Logs number of flags extracted

**Usage:** Scoreboards access flags via path: `/local/flags/<country-code>.png`

#### `logos_zip` (or `logos`)

**Source:** ZIP archive containing team/federation logo files

**Handler Processing:**
1. Extract all ZIP entries to `./local/logos/` directory
2. Files can have any image format (PNG, JPG, SVG, etc.)
3. Typical naming: `<team-name>.png` or `<logo-id>.png`
4. After extraction, hub state is updated and marked as ready
5. Sanity check: Logs number of logos extracted

**Usage:** Scoreboards access logos via path: `/local/logos/<team-name>.png`

#### `pictures`

**Source:** ZIP archive containing athlete/team picture files

**Handler Processing:**
1. Extract all ZIP entries to `./local/pictures/` directory
2. Files can have any image format
3. Typical naming: `<athlete-id>.png` or `<team-name>.png`
4. After extraction, hub state is updated
5. Sanity check: Logs number of pictures extracted

**Usage:** Scoreboards access pictures via path: `/local/pictures/<athlete-id>.png`

#### `styles`

**Source:** ZIP archive containing CSS and asset files

**Handler Processing:**
1. Extract all ZIP entries to `./local/styles/` directory
2. May contain CSS files, fonts, images, or other assets
3. After extraction, hub state is updated
4. Sanity check: Logs number of files extracted

**Usage:** Scoreboards include CSS via: `<link rel="stylesheet" href="/local/styles/custom.css">`

#### `translations_zip`

**Source:** ZIP archive containing exactly one file: `translations.json`

**File Format:**

`translations.json` uses one of two wrapper formats:

```json
// Wrapper form (with checksum):
{
  "locales": {
    "en": { "Start": "Start", "Stop": "Stop", ... },
    "fr": { "Start": "Commencer", ... },
    "fr-CA": { "Start": "Démarrer" }  // Regional variant
  },
  "translationsChecksum": "abc123def456"
}

// Direct form (legacy):
{
  "en": { "Start": "Start", "Stop": "Stop", ... },
  "fr": { "Start": "Commencer", ... },
  "fr-CA": { "Start": "Démarrer" }
}
```

**Handler Processing:**

1. Extract `translations.json` from ZIP
2. Parse JSON to get locale maps
3. For each locale:
   - **If base locale (e.g., "en", "fr"):** Store complete map in hub
   - **If regional variant (e.g., "fr-CA"):** Merge with base locale, keeping both base and variant keys
4. Cache `translationsChecksum` in hub (if provided)
5. On next `translations_zip` with same checksum: Skip processing (cached result)
6. Sanity checks:
   - Verify `translations.json` exists in ZIP
   - Count locale maps
   - Count translation keys per locale
   - Log results

**Hub Integration:**

After translations are loaded, plugins access them via:

```javascript
const translations = competitionHub.getTranslations('fr-CA');
// Returns: { "Start": "Démarrer", "Stop": "Stop", ... }
// (fr-CA keys override base locale "fr" where defined)
```

**Regional Variant Merging:**

When `fr-CA` is requested but `fr` is the base:
- Start with `fr` locale map
- Override with any keys provided in `fr-CA`
- Result: French Canadian with fallback to French

### Checksum Optimization

**Purpose:** Avoid reprocessing identical translations

**Flow:**
1. OWLCMS sends `translations_zip` with `translationsChecksum: "abc123"`
2. Handler checks hub's `lastTranslationsChecksum`
3. If match: Skip JSON parsing, use cached result (fast path)
4. If mismatch: Parse, merge, cache new checksum (slow path)
5. Log: `[Hub] Translations checksum match - skipping reprocessing`

### Security Considerations

**File Name Safety:**
- ZIP entries are extracted using their names as-is
- Ensure OWLCMS produces safe file names (no path traversal like `../`)
- Tracker validates `typeLength` against upper bound (default 1MB)

**Buffer Validation:**
1. Read `typeLength` (first 4 bytes)
2. If `typeLength > 1MB`: Attempt ZIP magic byte detection
3. If no ZIP magic bytes found: Reject frame as malformed
4. This prevents memory exhaustion from huge `typeLength` values

**ZIP Archive Validation:**
- Verifies ZIP format before extraction
- Logs error if ZIP is corrupted or unreadable
- Skips malformed entries silently

---

## Implementation Notes

1. **Parsing:** Parse the top-level JSON to extract `type` and `payload` fields
2. **Routing:** Use the `type` field to route to the appropriate message handler
3. **Payload Access:** All message-specific data is nested in the `payload` object
4. **Field Isolation:** No field name conflicts between message types since each is wrapped separately
5. **Encoding:** All messages sent as WebSocket text frames with UTF-8 encoding
6. **Connection:** One persistent WebSocket connection per unique URL (reused across all message types)
7. **Reconnection:** Client automatically attempts to reconnect up to 3 times with 5-second delays

## Example Messages

**Update Message:**

```json
{
  "type": "update",
  "payload": {
    "uiEvent": "LiftingOrderUpdated",
    "updateKey": "secret123",
    "competitionName": "2025 National Championships",
    "fop": "Platform A",
    "break": "false",
    "fullName": "John Doe",
    "teamName": "USA",
    "attemptNumber": "2",
    "weight": "120"
  }
}
```

**Timer Message (Athlete Clock):**

```json
{
  "type": "timer",
  "payload": {
    "updateKey": "secret123",
    "fopName": "Platform A",
    "athleteTimerEventType": "StartTime",
    "athleteMillisRemaining": "60000",
    "timeAllowed": "60000",
    "serverLocalTime": "14:23:45.123"
  }
}
```

**Timer Message (Break Clock):**
```json
{
  "type": "timer",
  "payload": {
    "updateKey": "secret123",
    "fopName": "Platform A",
    "breakTimerEventType": "StartTime",
    "breakMillisRemaining": "300000",
    "breakStartTimeMillis": "1702598625123",
    "serverLocalTime": "14:23:45.123"
  }
}
```

**Decision Message:**

```json
{
  "type": "decision",
  "payload": {
    "decisionEventType": "FULL_DECISION",
    "updateKey": "secret123",
    "fullName": "John Doe",
    "attemptNumber": "2",
    "d1": "true",
    "d2": "true",
    "d3": "false",
    "decisionsVisible": "true",
    "down": "true"
  }
}
```

## WebSocket-Only Architecture

The tracker **only** supports WebSocket connections from OWLCMS. Legacy HTTP POST endpoints have been removed.

**OWLCMS Configuration:**

- Set "URL for Video Data" to: `ws://localhost:8096/ws` (or `wss://` for secure connections)
- No code changes needed in OWLCMS - just the URL configuration

**WebSocket Message Types:**

- `type="database"` - Full competition data (athletes, categories, FOPs)
- `type="update"` - Lifting order changes, athlete switches, UI events
- `type="timer"` - Timer start/stop/set events
- `type="decision"` - Referee decisions

---

## Response Format

The tracker sends JSON responses back to OWLCMS over the WebSocket connection:

### Success Response (200 OK)

```json
{
  "status": 200,
  "message": "Update processed"
}
```

### Missing Preconditions (428 Precondition Required)

When the tracker needs additional data before processing messages, it returns a 428 status with a list of missing preconditions:

```json
{
  "status": 428,
  "message": "Precondition Required: Missing required data",
  "reason": "missing_preconditions",
  "missing": ["database", "flags_zip", "logos_zip", "translations_zip"]
}
```

**Preconditions:**

- `"database"` - Full competition data (athletes, categories, FOPs) - **Currently implemented**
- `"translations_zip"` - Localized UI text for all locales - **Currently implemented**
- `"flags_zip"` - Country/team flag images - **Currently implemented**
- `"logos_zip"` - Team/federation logos - **Currently implemented**
- `"pictures_zip"` - Athlete/team photos - **Future**

**OWLCMS Response:** When receiving a 428 status, OWLCMS should send the missing data types. The `missing` array indicates which data types are needed. For example:

- If `missing: ["database"]`, send a `type="database"` message
- If `missing: ["database", "flags_zip", "logos_zip"]`, send `type="database"`, `type="flags_zip"`, and `type="logos_zip"` messages as binary frames

**Note:** The WebSocket connection remains open after a 428 response - this is NOT a termination code.

### Error Response (500 Internal Server Error)

```json
{
  "status": 500,
  "message": "Unable to process update",
  "reason": "database_parsing_error"
}
```
