# WebSocket Protocol Version Configuration

## OWLCMS Configuration

### Step 1: Configure WebSocket URL in OWLCMS

**Location:** OWLCMS → Prepare Competition → Language and System Settings → Connections → URL for Video Data

**Set to:**
```
ws://localhost:8096/ws
```

**For remote trackers, use:**
```
ws://your-tracker-host:8096/ws
```

**For secure connections:**
```
wss://your-tracker-host:8096/ws
```

That's the only configuration needed in OWLCMS. No code changes required.

---

## Protocol Version Settings

### Tracker Side (SvelteKit)

**File:** `src/lib/server/protocol-config.js`

**Lines 12-14:**
```javascript
export const PROTOCOL_VERSION = '2.0.0';           // Current tracker version
export const MINIMUM_PROTOCOL_VERSION = '2.0.0';   // Minimum OWLCMS version required
```

**To require a newer OWLCMS version:**
```javascript
export const MINIMUM_PROTOCOL_VERSION = '2.0.1';  // Require at least 2.0.1
export const MINIMUM_PROTOCOL_VERSION = '2.1.0';  // Require at least 2.1.0
export const MINIMUM_PROTOCOL_VERSION = '3.0.0';  // Require at least 3.0.0
```

After changing, redeploy the tracker.

### Backend Side (OWLCMS Java)

**File:** `owlcms/monitors/websocket/WebSocketEventSender.java`

**Line 41:**
```java
public static final String PROTOCOL_VERSION = "2.0.0";
```

This is where OWLCMS declares its protocol version. It's automatically sent in all WebSocket messages.

---

## How It Works

1. **OWLCMS connects** to tracker at the WebSocket URL configured above
2. **OWLCMS sends messages** with `"version": "2.0.0"` in each message
3. **Tracker validates** that version ≥ MINIMUM_PROTOCOL_VERSION
4. **If version OK:** Message is processed ✅
5. **If version too old:** Message is rejected with HTTP 400 error ❌

---

## Version Mismatch Error

**When OWLCMS version is too old:**

The tracker returns:
```json
{
  "status": 400,
  "error": "Protocol version check failed",
  "reason": "OWLCMS protocol version 1.9.0 is below required minimum 2.0.0. Please upgrade OWLCMS."
}
```

**Solution:** Update OWLCMS to the required version.

---

## Semantic Versioning

Version format: `MAJOR.MINOR.PATCH` (e.g., 2.0.0)

- **2.0.0** = Version 2, Release 0, Patch 0
- **2.0.1** = Bugfix only (backward compatible)
- **2.1.0** = New features (backward compatible)
- **3.0.0** = Breaking changes (NOT backward compatible)

Tracker accepts any version ≥ minimum required.

---

## Summary

| What | Where | What to Change |
|------|-------|-----------------|
| **WebSocket URL** | OWLCMS settings | `ws://tracker-host:8096/ws` |
| **Tracker min version** | `src/lib/server/protocol-config.js` line 14 | `MINIMUM_PROTOCOL_VERSION` |
| **OWLCMS version** | `owlcms/monitors/websocket/WebSocketEventSender.java` line 41 | `PROTOCOL_VERSION` |
