<!-- markdownlint-disable -->
# Display Switcher Architecture

This document describes the technical architecture of the Display Switcher plugin.

## Overview

The Display Switcher is a video overlay system that automatically switches a fullscreen display between OWLCMS pages and video content based on competition events.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              OWLCMS                                      │
│                         (Vaadin server)                                  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ WebSocket (competition data)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          tracker-core                                    │
│                      (Competition Hub)                                   │
│  - Receives OWLCMS messages                                              │
│  - Emits events: DECISION, TIMER, UPDATE                                │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ EventEmitter events
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      helpers.data.js                                     │
│                     (State Machine)                                      │
│  - Listens to tracker-core events                                        │
│  - Manages per-FOP display state                                         │
│  - Broadcasts SSE commands                                               │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ SSE broadcast (display_command)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        page.svelte                                       │
│                    (Browser Display)                                     │
│  - Receives SSE commands                                                 │
│  - Toggles between iframe and video                                      │
│  - Fullscreen display output                                             │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Renders
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           <iframe src="/proxy/...">  OR  <video src="...">              │
│                                                                          │
│  iframe: OWLCMS pages via reverse proxy                                  │
│  video: Local or remote video files                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Reverse Proxy (`src/lib/server/owlcms-proxy.js`)

The proxy enables OWLCMS Vaadin pages to be displayed in iframes.

**Problem:** OWLCMS pages send `X-Frame-Options: DENY` which blocks iframe embedding.

**Solution:** Reverse proxy that:
- Strips `X-Frame-Options` and `Content-Security-Policy` headers
- Forwards all requests to OWLCMS server
- Supports WebSocket upgrade for Vaadin push
- Handles all Vaadin transports (websocket, long-polling, SSE)

**Routes:**
```
/proxy/*  →  OWLCMS_URL/*

Examples:
/proxy/display/scoreboard?fop=A  →  http://localhost:8080/display/scoreboard?fop=A
/proxy/VAADIN/push              →  http://localhost:8080/VAADIN/push
```

**Configuration:**
- `OWLCMS_URL` environment variable (default: `http://localhost:8080`)

### 2. State Machine (`helpers.data.js`)

Manages display state and automation logic per FOP.

**States:**
```
SCOREBOARD      - Showing OWLCMS scoreboard (default)
GOOD_LIFT_VIDEO - Playing good lift celebration video
BAD_LIFT_VIDEO  - Playing bad lift video
REPLAY          - Showing replay video
BREAK_VIDEO     - Playing break/intermission video
MANUAL          - Operator has taken manual control
```

**State Transitions:**
```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐                                    │
    ┌────────▶│SCOREBOARD│◀─────────────────────────────────┐ │
    │         └────┬─────┘                                  │ │
    │              │                                        │ │
    │              │ DECISION event                         │ │
    │              ▼                                        │ │
    │    ┌─────────────────────┐                            │ │
    │    │ GOOD_LIFT_VIDEO  or │                            │ │
    │    │ BAD_LIFT_VIDEO      │                            │ │
    │    └─────────┬───────────┘                            │ │
    │              │                                        │ │
    │              │ After X seconds                        │ │
    │              ▼                                        │ │
    │         ┌────────┐                                    │ │
    │         │ REPLAY │ (if replayUrl configured)         │ │
    │         └────┬───┘                                    │ │
    │              │                                        │ │
    │              │ After X seconds                        │ │
    │              └────────────────────────────────────────┘ │
    │                                                         │
    │ TIMER start                                             │
    └─────────────────────────────────────────────────────────┘

    Any state ──── manualShowIframe() ────▶ MANUAL
    Any state ──── manualShowVideo()  ────▶ MANUAL
    MANUAL    ──── resumeAutomation() ────▶ SCOREBOARD
```

**Event Handlers:**

| Event | Action |
|-------|--------|
| `DECISION` (good lift) | Show good lift video → replay → scoreboard |
| `DECISION` (bad lift) | Show bad lift video → replay → scoreboard |
| `TIMER` (StartTime) | Immediately show scoreboard |
| `BREAK` | Show break video playlist |
| Manual control | Pause automation, show specified content |

**Per-FOP State Storage:**
```javascript
const fopStates = new Map();

// Each FOP has independent state:
fopStates.get('A') = {
  currentState: 'scoreboard',
  automationPaused: false,
  config: { ... },
  timers: []  // Active setTimeout IDs
}
```

### 3. SSE Communication

The state machine broadcasts commands to displays via SSE.

**Event Types:**

```javascript
// Display command - tells browser what to show
{
  type: 'display_command',
  fop: 'A',
  command: 'showIframe',  // or 'showVideo'
  url: '/proxy/display/scoreboard?fop=A',
  state: 'scoreboard'
}

// State update - for control panel UI
{
  type: 'display_state',
  fop: 'A',
  automationPaused: false,
  currentState: 'scoreboard'
}
```

**Flow:**
1. State machine calls `sseBroker.broadcast()`
2. SSE broker sends to all connected browsers
3. Display page filters by FOP and processes command
4. Control page updates status display

### 4. Display Page (`page.svelte`)

Single Svelte component with two modes:

**Display Mode (`mode=display`, default):**
- Fullscreen, black background
- Purely reactive - only responds to SSE commands
- No user controls visible
- Switches between `<iframe>` and `<video>` elements

**Control Mode (`mode=control`):**
- Operator interface
- Shows current state and connection status
- Buttons for pause/resume, manual control
- Configuration form
- Sends POST requests to `/api/scoreboard`

### 5. API Endpoints

Control actions are sent via POST to `/api/scoreboard`:

| Action | Parameters | Description |
|--------|------------|-------------|
| `display_pause` | `fop` | Pause automation |
| `display_resume` | `fop` | Resume automation |
| `display_show_iframe` | `fop`, `url` | Show iframe (pauses automation) |
| `display_show_video` | `fop`, `url` | Show video (pauses automation) |
| `display_config` | `fop`, `config` | Update configuration |
| `display_state` | `fop` | Get current state |

**Example Request:**
```javascript
fetch('/api/scoreboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'display_pause',
    fop: 'A'
  })
});
```

**Example Response:**
```json
{
  "success": true,
  "message": "Automation paused"
}
```

## Data Flow Examples

### Decision Event Flow

```
1. Athlete makes lift
2. Referees give decision
3. OWLCMS sends decision via WebSocket
4. tracker-core emits DECISION event
5. helpers.data.js receives event:
   - If good lift: state → GOOD_LIFT_VIDEO
   - Broadcasts: { command: 'showVideo', url: goodLiftVideo }
   - Sets timer for goodLiftDuration
6. page.svelte receives SSE:
   - Hides iframe, shows video element
   - Video plays automatically
7. Timer fires in helpers.data.js:
   - If replayUrl: state → REPLAY, broadcast replay
   - Else: state → SCOREBOARD, broadcast scoreboard
8. Eventually: state → SCOREBOARD
   - Broadcasts: { command: 'showIframe', url: scoreboardUrl }
9. page.svelte:
   - Hides video, shows iframe
   - Scoreboard visible
```

### Manual Control Flow

```
1. Operator opens control page (?mode=control)
2. Control page connects to SSE
3. Control page fetches current state via display_state action
4. Operator clicks "Pause Automation":
   - POST { action: 'display_pause', fop: 'A' }
   - helpers.data.js sets automationPaused = true
   - Broadcasts display_state event
   - Control page updates status badge
5. Operator enters URL and clicks "Show":
   - POST { action: 'display_show_iframe', url: '/proxy/display/medals' }
   - helpers.data.js sets state = MANUAL
   - Broadcasts: { command: 'showIframe', url: '/proxy/display/medals' }
6. Display page shows medals ceremony
7. Operator clicks "Resume Automation":
   - POST { action: 'display_resume' }
   - helpers.data.js sets automationPaused = false, state = SCOREBOARD
   - Broadcasts: { command: 'showIframe', url: scoreboardUrl }
8. Display page shows scoreboard, automation resumes
```

## File Structure

```
src/plugins/video-overlays/display-switcher/
├── config.js           # Plugin metadata and options
├── helpers.data.js     # State machine and event handlers
├── page.svelte         # Combined display/control UI
├── README.md           # Usage documentation
└── ARCHITECTURE.md     # This file

src/lib/server/
└── owlcms-proxy.js     # Reverse proxy for OWLCMS pages

src/routes/api/scoreboard/
└── +server.js          # Handles display_* actions (POST)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OWLCMS_URL` | `http://localhost:8080` | OWLCMS server base URL |

### Runtime Configuration (per FOP)

Set via control UI or `display_config` API:

```javascript
{
  scoreboardPage: '/display/scoreboard',  // OWLCMS page path
  replayUrl: '',                          // Replay server URL
  goodLiftVideo: '',                      // Good lift video URL
  badLiftVideo: '',                       // Bad lift video URL
  goodLiftDuration: 5,                    // Seconds
  badLiftDuration: 5,                     // Seconds
  replayDuration: 10                      // Seconds
}
```

## Proxy Details

### Header Modifications

**Removed from responses:**
- `X-Frame-Options` - Allows iframe embedding
- `Content-Security-Policy` - Prevents frame-ancestors restrictions

**Added to requests:**
- Preserves original `Host` header for OWLCMS

### Vaadin Push Support

Vaadin uses push for real-time updates. The proxy supports all transports:

| Transport | Path | Method |
|-----------|------|--------|
| WebSocket | `/VAADIN/push` | Upgrade |
| Long-polling | `/VAADIN/push` | HTTP |
| SSE | `/VAADIN/push` | HTTP |

The proxy handles WebSocket upgrade requests and forwards them to OWLCMS.

### Path Rewriting

```
Request:  GET /proxy/display/scoreboard?fop=A
Proxy:    GET http://localhost:8080/display/scoreboard?fop=A

Request:  GET /proxy/VAADIN/static/push/vaadinPush.js
Proxy:    GET http://localhost:8080/VAADIN/static/push/vaadinPush.js
```

## Error Handling

### SSE Reconnection

If SSE connection is lost, the display page:
1. Waits 3 seconds
2. Attempts reconnection
3. Repeats until successful

### Proxy Errors

If OWLCMS is unavailable:
- Proxy returns 502 Bad Gateway
- Iframe shows browser error page
- State machine continues operating (will recover when OWLCMS returns)

### Missing Videos

If video URL is empty or fails to load:
- State machine skips that phase
- Transitions directly to next state (replay or scoreboard)

## Security Considerations

### Proxy Access

The proxy at `/proxy/*` forwards all requests to OWLCMS. Consider:
- Limiting access if tracker is publicly exposed
- Using authentication if needed
- Running on internal network only

### Video URLs

Video URLs are trusted and played directly. Ensure:
- Only authorized operators can configure video URLs
- Video sources are trusted

### SSE

SSE is read-only from client perspective. Control actions require POST requests which could be protected with authentication if needed.
