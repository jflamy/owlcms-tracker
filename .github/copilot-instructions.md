# 📋 Context for GitHub Copilot: Olympic Weightlifting Competition Display

You are helping build a **SvelteKit application** that displays the state of an Olympic weightlifting competition in real time.

## 📚 Primary Documentation

**READ THESE FIRST** when working on this project:

1. **[README.md](../README.md)** - Project overview & setup
2. **[CREATE_YOUR_OWN.md](../CREATE_YOUR_OWN.md)** - Create custom scoreboards
3. **[docs/SCOREBOARD_ARCHITECTURE.md](../docs/SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture
4. **WEBSOCKET_MESSAGE_SPEC.md** (in `@owlcms/tracker-core`) - WebSocket message format & responses


**⚠️ IMPORTANT:** Before making any significant changes to the codebase:
- Read ALL documentation files in the `/docs` folder
- Understand the complete architecture and data flow
- Check existing patterns and conventions
- Consult the field mapping to understand data structures


This instructions file provides **AI context only**. For detailed technical information, always refer to the comprehensive documentation in the `/docs` folder.

## ���️ Development Environment

**Operating System:** Windows with bash shell (Git Bash or WSL)
- When generating terminal commands, use bash syntax
- File paths use Windows format (`c:\Dev\...`) but commands are bash-style- **CRITICAL:** Git Bash has limitations with heredocs - see section below

------

## 🚨 Git Bash Shell Limitations

### DO NOT use heredocs with inline code

**❌ WRONG - This will corrupt files:**
```bash
cat > file.js << 'EOF'
const x = 'value';
EOF
```

**❌ WRONG - Python heredocs also fail:**
```bash
python - <<'PY'
import sys
print("hello")
PY
```

**Why it fails:**
- Git Bash on Windows has issues with heredoc parsing
- Results in corrupted files with mangled content
- Particularly dangerous with search-and-replace operations

### ✅ CORRECT Alternatives

**Option 1: Create external script file first**
```bash
# Create the script file separately
cat > /tmp/script.py
# Then paste content manually or use text editor

# Run it
python /tmp/script.py
```

**Option 2: Use Node.js for simple replacements**
```bash
node -e "
const fs = require('fs');
let text = fs.readFileSync('file.js', 'utf8');
text = text.replace(/oldPattern/g, 'newPattern');
fs.writeFileSync('file.js', text);
"
```

**Option 3: Create .cjs script file (for ESM projects)**
```bash
# Save script to file first
cat > fix_script.cjs
# Add content via editor or create_file tool

# Run it
node fix_script.cjs
```

**Option 4: Use sed for simple replacements**
```bash
# Single replacement (be careful with special characters)
sed -i 's/console\.log(/logger.log(/g' file.js
```

**REMEMBER:** 
- Always prefer creating files via the `create_file` tool
- For complex multi-line scripts, create the file first, then execute
- Test on a backup copy before modifying important files
------

## 🏗️ Architecture Summary

```
OWLCMS (Java Backend)
  ↓ WebSocket (ws:// or wss://)
  ↓   • type: "database" (full competition data)
  ↓   • type: "update" (UI events, lifting order)
  ↓   • type: "timer" (timer start/stop)
  ↓   • type: "decision" (referee decisions)
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

Set to: `ws://localhost:8095/ws` (or your tracker host with `ws://` or `wss://` scheme)

**WebSocket message types the tracker receives:**

| Message Type | Purpose | OWLCMS Sends |
|----------|---------|--------------|
| `type: "database"` | Full competition data | Athletes, FOPs, categories, databaseChecksum |
| `type: "update"` | UI events | LiftingOrderUpdated, current athlete, precomputed JSON |
| `type: "timer"` | Timer events | Start/stop, time remaining, FOP name |
| `type: "decision"` | Referee decisions | Decision type, athlete, FOP |

**No code changes to OWLCMS needed** - only the URL configuration above.

**Security:** 🚧 TODO - WebSocket authentication with OWLCMS_UPDATEKEY shared secret (future feature)

**Status Codes:**
- `200 OK` - Data accepted and stored
- `428 Precondition Required` - Hub needs data before accepting updates (includes `missing` array with list of required data types)
  - Currently implemented: `database`
  - Future: `flags`, `styles`, `pictures`
- `500 Internal Server Error` - Processing error

------

## ��� Project Structure (Current)

```
src/
├── lib/
│   ├── server/
│   │   ├── competition-hub.js         # Central state storage
│   │   ├── websocket-server.js        # WebSocket message handler
│   │   ├── embedded-database.js       # Parse bundled database payloads
│   │   └── scoreboard-registry.js     # Auto-discovers scoreboard plugins
│   ├── components/
│   │   ├── Timer.svelte               # Autonomous countdown timer
│   │   └── SystemStatus.svelte        # Connection status
│   └── stores.js                      # Client-side reactive stores
├── routes/
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

tests/                      # Test scripts and utilities
├── test-428-response.js    # Tests 428 status with missing preconditions
├── check-websocket.js      # WebSocket connection verification
├── test-load-sample.js     # Sample data loader
├── send-test-update.js     # Send test messages
├── test-sample-data.sh     # Shell script for integration testing
└── README.md               # Test documentation
```

------

## ��� Creating Scoreboards with AI Assistance

### Workflow for Novice Developer

1. **Describe what you want:**

   > "Create a scoreboard that shows the athletes grouped by team, sorted by descending QPoints score, with a team total at the bottom of each group, including the athletes that have not lifted yet. The information on each athlete line is the same as in the standard scoreboard, plus the QPoints and the QPoints rank within their gender."

2. **AI generates the plugin** using scoreboard pattern 

3. **Iterate with natural language:**

   > "Add a column showing how many good lifts each athlete has"  
   > "Highlight the current leader in gold"

### Key Principles

- **Server-side (helpers.data.js):** Parse JSON, filter/sort, extract fields, compute ALL data transformations
- **Client-side (page-simple.svelte):** Map data to screen, apply styles - **ZERO data manipulation**
- **No business logic in browser:** OWLCMS computes rankings, lifts, etc.
- **URL-based options:** Every preference as query parameter
- **Caching for scale:** Server processes once, caches result, serves hundreds of browsers

**CRITICAL:** All sorting, filtering, grouping, and data transformations happen in `helpers.data.js` and are cached. Svelte components only display pre-processed data. This ensures hundreds of browsers can connect without redundant computation.

------

## ���️ Division of Responsibilities

### OWLCMS (Authoritative Source)
- ✅ **ALL** competition business logic (rankings, lifting order, Sinclair, validation)
- ✅ Precomputed display data in `/update` messages

### SvelteKit Hub (Cache & Scoreboard Server)
- ✅ Receives WebSocket messages from OWLCMS
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

## 📁 Documentation Structure

### `/docs` - Permanent Reference Documentation (Committed)
- Architecture guides, API specifications, field mapping
- Performance guides, caching strategies
- **These are committed to the repository** and available to all developers

### `/compliance` - Temporary Working Files (Gitignored)
- Change logs, compliance checks, refactoring notes
- **Only README.md is committed** - all other files are gitignored
- Use for temporary AI context during long coding sessions
- Each developer maintains their own local working files
- Can be deleted when work is complete

### `/tests` - Test Scripts and Utilities (Committed)
- WebSocket connection tests, response validation
- Sample data loading and sending utilities
- Shell scripts for integration testing
- **All test files go here** - see `tests/README.md` for details
- Run tests from project root: `node tests/test-name.js`

**When to use each:**
- ✅ Permanent reference → `/docs` (e.g., SCOREBOARD_ARCHITECTURE.md)
- ✅ Temporary change log → `/compliance` (e.g., TERMINOLOGY_UPDATE.md)
- ✅ Test scripts → `/tests` (e.g., test-428-response.js)

------

## 🖨️ Document Generation Plugins (iwf-startbook, iwf-results)

When creating or modifying document generation plugins (printable start books, results books, etc.):

### Styling Requirements
- **No rounded corners** - All borders must use square corners (0px border-radius)
- **Table borders**: Use solid black borders (1px) with `border-collapse: collapse`
- **Cell borders**: Define borders on individual cells (`th`, `td`) with `border: 1px solid black`
- **Page size**: A4 landscape with 10mm margins
- **Font**: Arial, 10-11px base size for tables
- **Column widths**: Use percentage-based widths for print consistency

### Data Architecture
- **All data computation in `helpers.data.js`** - Server-side only
- **Svelte components are display-only** - No calculations, filtering, or sorting
- **Attach computed data to athlete objects** - e.g., `athlete.ageGroupParticipation`
- **Use pre-computed display values** - Don't recompute in templates

------

## 🎯 AI-Assisted Development Target

This architecture is **designed for AI pair programming**. A novice programmer using GitHub Copilot should be able to:

1. Create new scoreboard types by describing requirements in plain English
2. Modify existing scoreboards without understanding SSE/WebSocket internals
3. Add custom scoring rules (team rankings, bonus points, etc.) via helpers

