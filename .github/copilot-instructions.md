# ��� Context for GitHub Copilot: Olympic Weightlifting Competition Display

You are helping build a **SvelteKit application** that displays the state of an Olympic weightlifting competition in real time.

## ��� Primary Documentation

**READ THESE FIRST** when working on this project:

1. **[README.md](../README.md)** - Project overview & setup
2. **[CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md)** - Create custom scoreboards
3. **[docs/SCOREBOARD_ARCHITECTURE.md](../docs/SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture

This instructions file provides **AI context only**. For detailed architecture, see the docs above.

## ���️ Development Environment

**Operating System:** Windows with bash shell (Git Bash or WSL)
- When generating terminal commands, use bash syntax
- File paths use Windows format (`c:\Dev\...`) but commands are bash-style

------

## 🏗️ Architecture Summary

**Full details in [docs/SCOREBOARD_ARCHITECTURE.md](../docs/SCOREBOARD_ARCHITECTURE.md)**

```
OWLCMS (Java Backend)
  ↓ POST /database (full competition data)
  ↓ POST /update (UI events, lifting order)
  ↓ POST /timer (timer start/stop)
  ↓ POST /decision (referee decisions)
  ↓
Competition Hub (src/lib/server/competition-hub.js)
  • Stores databaseState (full competition data)
  • Stores fopUpdates[fopName] (per-FOP updates)
  • Broadcasts SSE to all connected browsers
  • getAvailableFOPs() - discovers FOP names
  ↓
Scoreboard System
  • Registry auto-discovers plugins in src/plugins/*/
  • SSE triggers data refresh: /api/scoreboard?type=lifting-order&fop=Platform_A
  • Dynamic routes: /scoreboard-{type}?fop={name}&{options}
  ↓
Browsers
  • Subscribe to SSE (/api/client-stream) for real-time updates
  • Fetch fresh data from API when SSE event received
  • Display processed data immediately
  • No business logic
```


------

## ��� OWLCMS Configuration & Endpoints

**OWLCMS Configuration Required:**

In OWLCMS: **Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `http://localhost:8095` (or your tracker host)

**These endpoints already exist in `src/routes/` and receive OWLCMS data:**

| Endpoint | Purpose | OWLCMS Sends |
|----------|---------|--------------|
| `POST /database` | Full competition data | Athletes, FOPs, categories |
| `POST /update` | UI events | LiftingOrderUpdated, current athlete, precomputed JSON |
| `POST /timer` | Timer events | Start/stop, time remaining, FOP name |
| `POST /decision` | Referee decisions | Decision type, athlete, FOP |

**No code changes to OWLCMS needed** - only the URL configuration above.

**Status Codes:**
- `200 OK` - Data accepted and stored
- `412 Precondition Failed` - Hub needs database before accepting updates
- `500 Internal Server Error` - Processing error

------

## ��� Project Structure (Current)

```
src/
├── lib/
│   ├── server/
│   │   ├── competition-hub.js         # Central state storage
│   │   └── scoreboard-registry.js     # Auto-discovers scoreboard plugins
│   ├── components/
│   │   ├── Timer.svelte               # Autonomous countdown timer
│   │   └── SystemStatus.svelte        # Connection status
│   └── stores.js                      # Client-side reactive stores
├── routes/
│   ├── database/+server.js            # POST /database endpoint
│   ├── update/+server.js              # POST /update endpoint
│   ├── timer/+server.js               # POST /timer endpoint
│   ├── decision/+server.js            # POST /decision endpoint
│   ├── [scoreboard]/                  # Dynamic scoreboard routes
│   │   ├── +page.server.js            # Route handler
│   │   └── +page.svelte               # Generic wrapper
│   └── api/
│       ├── scoreboard/+server.js      # Unified scoreboard API
│       └── client-stream/+server.js   # SSE for legacy support
└── plugins/
    ├── scoreboard-lifting-order/      # Example scoreboard plugin
    │   ├── config.js                  # Metadata & options
    │   ├── helpers.data.js            # Server-side processing
    │   ├── page-simple.svelte         # Display component
    │   └── README.md                  # AI prompts
    ├── results/            # (Future) Results board
    └── team-rankings/      # (Future) Team rankings
```

------

## ��� Creating Scoreboards with AI Assistance

### Workflow for Novice Developer

1. **Describe what you want:**

   > "Create a scoreboard that shows the athletes grouped by team, sorted by descending QPoints score, with a team total at the bottom of each group, including the athletes that have not lifted yet. The information on each athlete line is the same as in the standard scoreboard, plus the QPoints and the QPoints rank within their gender."

2. **AI generates the plugin** using scoreboard pattern (see [docs/SCOREBOARD_ARCHITECTURE.md](../docs/SCOREBOARD_ARCHITECTURE.md))

3. **Iterate with natural language:**

   > "Add a column showing how many good lifts each athlete has"  
   > "Highlight the current leader in gold"

### Key Principles

- **Server-side (helpers.data.js):** Parse JSON, filter/sort, extract fields
- **Client-side (page-simple.svelte):** Map data to screen, apply styles
- **No business logic in browser:** OWLCMS computes rankings, lifts, etc.
- **URL-based options:** Every preference as query parameter

For complete examples and patterns, see [docs/SCOREBOARD_ARCHITECTURE.md](../docs/SCOREBOARD_ARCHITECTURE.md).

------

## ���️ Division of Responsibilities

### OWLCMS (Authoritative Source)
- ✅ **ALL** competition business logic (rankings, lifting order, Sinclair, validation)
- ✅ Precomputed display data in `/update` messages

### SvelteKit Hub (Cache & Scoreboard Server)
- ✅ Stores per-FOP data from OWLCMS
- ✅ Auto-discovers scoreboard plugins
- ✅ Processes data once, serves hundreds of browsers
- ✅ Broadcasts SSE events on every OWLCMS update
- ❌ NO athlete ranking or lift validation

### Browser Scoreboards (Display Only)
- ✅ Subscribe to SSE (/api/client-stream) for instant updates
- ✅ Fetch fresh data from API when SSE event received
- ✅ Autonomous timer countdown
- ❌ NO data processing or business logic

------

## ��� AI-Assisted Development Target

This architecture is **designed for AI pair programming**. A novice programmer using GitHub Copilot should be able to:

1. Create new scoreboard types by describing requirements in plain English
2. Modify existing scoreboards without understanding SSE/WebSocket internals
3. Add custom scoring rules (team rankings, bonus points, etc.) via helpers

For detailed examples of AI conversations and plugin creation patterns, see [docs/SCOREBOARD_ARCHITECTURE.md](../docs/SCOREBOARD_ARCHITECTURE.md).
