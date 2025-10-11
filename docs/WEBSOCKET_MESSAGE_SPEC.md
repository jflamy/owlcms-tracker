# OWLCMS WebSocket Event Forwarding - Message Format Specification

## Overview
OWLCMS can send competition events over WebSocket connections when configured with `ws://` or `wss://` URLs. All messages use a consistent wrapper format with a type indicator and payload.

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
- `uiEvent` - Event class name that triggered the update
- `updateKey` - Validation key
- `competitionName` - Name of the competition
- `fop` - Field of play name
- `break` - Boolean indicating if in break
- `breakType` - Type of break if applicable
- `fullName` - Current athlete's full name
- `teamName` - Current athlete's team
- `attemptNumber` - Current attempt number (1-6)
- `weight` - Requested weight
- Plus additional athlete, group, and competition data

**Frequency:** Sent on most UI events + keepalive every 15 seconds

---

### 2. TIMER Messages
**Type:** `"timer"`

**Purpose:** Clock countdown updates for athlete timer and break timer

**Key Payload Fields:**
- `updateKey` - Validation key
- `fopName` - Field of play name
- `mode` - Board display mode
- `fullName` - Current athlete's full name
- `attemptNumber` - Current attempt number
- `athleteTimerEventType` - Timer event type for athlete clock
- `breakTimerEventType` - Timer event type for break clock
- `athleteMillisRemaining` - Milliseconds remaining on athlete clock
- `breakMillisRemaining` - Milliseconds remaining on break clock
- `athleteStartTimeMillis` - Absolute start time for athlete timer
- `breakStartTimeMillis` - Absolute start time for break timer
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
- `fop` - Field of play name
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

**Payload:** Complete competition data structure (format differs from other message types - this is a full export of all competition data)

**Frequency:** Sent when remote system requests full data (typically in response to HTTP 428 status or missing data)

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

**Timer Message:**
```json
{
  "type": "timer",
  "payload": {
    "updateKey": "secret123",
    "fopName": "Platform A",
    "athleteTimerEventType": "StartTime",
    "athleteMillisRemaining": "60000",
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

