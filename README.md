# OWLCMS Tracker

> This project is a proof of concept for using AI-Assisted coding to create customizable owlcms scoreboards.  *Except for this note, everything in this repository has been generated without actual programming, strictly by providing instructions to a coding Agent*.
>
> **The idea is that you should be able to open this repository in a development environment, start an LLM Agent like Claude or ChatGPT, and argue with the agent until you get the scoreboard you want.** You can even paste screen shots of existing scoreboards, or of defects in the generated scoreboards to guide the evolution. The author did not write *any* JavaScript and does not know Svelte.
>
> This is the first workable scoreboard generated with this approach.  
>
> ![WhatsApp Image 2025-10-08 at 12 23 27_e98fafa4](https://github.com/user-attachments/assets/2e98bdc8-3ba6-43af-ae7d-85cee68cb11a)
>
> Since the tracker has the full database available + the current group, it can do team scoreboards.  Because there is full
> javascript processing and a backend layer, you could add your own scoring grids and algorithms.  And the same layer could
> serve to publish CSV output.

## Description

A SvelteKit application that receives real-time competition updates from OWLCMS and displays them through multiple scoreboard types. Runs on port 8096 (default).

## Documentation

- **[CREATE_YOUR_OWN.md](./CREATE_YOUR_OWN.md)** - Create custom scoreboards
- **[docs/SCOREBOARD_ARCHITECTURE.md](./docs/SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture
- **[docs/CACHING_IMPLEMENTATION.md](./docs/CACHING_IMPLEMENTATION.md)** - Performance optimization guide
- **[docs/FIELD_MAPPING_INDEX.md](./docs/FIELD_MAPPING_INDEX.md)** - Data source mapping reference
- **[Plugin README](./src/plugins/lifting-order/README.md)** - Example scoreboard with AI prompts

## OWLCMS Configuration Required

**Before using this tracker**, you must configure OWLCMS to send data via WebSocket:

In OWLCMS: **Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://localhost:8096/ws` (or `wss://your-tracker-host:8096/ws` for secure connections)

**That's it!** No code changes to OWLCMS needed - just this URL setting.

### WebSocket Message Format

OWLCMS sends messages in this format:

```json
{
  "type": "update|timer|decision|database",
  "payload": {
    // Nested JSON objects with competition data
  }
}
```

**Message Types:**
- **`database`** - Full competition data synchronization (athletes, FOPs, categories, databaseChecksum)
- **`update`** - Lifting order changes, athlete switches, UI events
- **`timer`** - Timer start/stop/set events
- **`decision`** - Referee decisions and down signals

## Features

- **Multiple Scoreboard Types** - Lifting order, results, team rankings, and more  
- **Multi-FOP Support** - Display up to 6 FOPs simultaneously  
- **Simple OWLCMS Setup** - One URL configuration, no code changes  
- **AI-Assisted Development** - Create new scoreboards with AI help  
- **URL-Based Options** - Configure each scoreboard via query parameters  
- **Real-Time SSE Updates** - Instant display of decisions and timer events  
- **Server-Side Processing** - Process once, serve hundreds of browsers

## Architecture

**Real-time SSE push architecture** - Competition data flows from OWLCMS through the Competition Hub to browsers via Server-Sent Events, triggering instant updates on decisions and timer events.

```
OWLCMS → Competition Hub → SSE Broadcast → Browsers
```

**For complete architecture details**, see **[docs/SCOREBOARD_ARCHITECTURE.md](./docs/SCOREBOARD_ARCHITECTURE.md)**

## Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **Git Bash** for Windows (configured as default terminal in VS Code)

### 1. Install and Run

### Method 1: VS Code Launch Menu (Recommended)

**This workspace is pre-configured for VS Code with Git Bash as the default shell.**

1. Open the project in VS Code
2. Go to **Run and Debug** (Ctrl+Shift+D) or click the play icon in the sidebar
3. Select one of the configurations from the dropdown:
   - **"OWLCMS Tracker - Production Mode"** - Normal operation
   - **"OWLCMS Tracker - Learning Mode"** - Captures all incoming messages to `samples/` directory
4. Press **F5** (or click the green play button) to start
5. The integrated terminal will open automatically using Git Bash

### Method 2: Command Line

```bash
# Normal mode (port 8096)
npm run dev

# Learning mode - captures all OWLCMS messages to samples/ directory
npm run dev:learning

# Windows PowerShell learning mode
$env:LEARNING_MODE="true"; npm run dev

# Windows Command Prompt learning mode  
set LEARNING_MODE=true && npm run dev
```

The app will be available at **http://localhost:8096**

## Learning Mode

**Learning mode is essential for the first runs** to understand what OWLCMS actually sends.

**Enable Learning Mode:**
- VS Code: Use "OWLCMS Tracker - Learning Mode" launch configuration
- Command Line: `npm run dev:learning` 
- Environment Variable: `LEARNING_MODE=true`

**What it captures:**
- Every WebSocket message from OWLCMS with ISO8601 timestamp
- Message type and parsed payload fields
- Message size and content
- Saves to `samples/message-[timestamp].json`

**Startup logs in learning mode:**
```
🔬 =============== LEARNING MODE ACTIVE ===============
📁 Messages will be saved to: samples/
🕐 Each message includes ISO8601 timestamp
```

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

### 2. Open a Scoreboard

```
http://localhost:8096/lifting-order?fop=A
```

Change `fop=A` to match your FOP name (e.g., `Platform_A`, `Platform_B`).

### 3. Configure OWLCMS

**IMPORTANT:** You must configure OWLCMS to send data to this tracker.

In OWLCMS, go to:

**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://localhost:8096/ws` (or `ws://your-tracker-host:8096/ws`)

**No code changes to OWLCMS are needed** - just this one configuration setting.

### 4. Create More Scoreboard Types

See **[QUICKSTART.md](./QUICKSTART.md)** for step-by-step instructions.

## Available Scoreboards

### Lifting Order (`/lifting-order`)

Shows current lifter and upcoming attempts with countdown timer.

**URL:** `/lifting-order?fop=Platform_A&maxLifters=8`

**Options:**
- `fop` (required) - FOP name
- `showRecords` (optional) - Show competition records (true/false)
- `maxLifters` (optional) - Number of upcoming lifters (default: 8)

## Creating Custom Scoreboards

Want to create your own scoreboard types? See **[CREATE_YOUR_OWN.md](./CREATE_YOUR_OWN.md)** for step-by-step instructions.

The plugin system makes it easy to create custom displays - whether you're a programmer or using AI assistance.

## API Endpoints

### `/api/scoreboard` (GET)
Get processed data for any scoreboard type.

**Parameters:**
- `type` - Scoreboard type (e.g., `lifting-order`)
- `fop` - FOP name (required)
- Any other options defined in the scoreboard's config

**Example:**
```
GET /api/scoreboard?type=lifting-order&fop=Platform_A&maxLifters=10
```

### `/api/scoreboard` (POST)
Get metadata about available scoreboards and FOPs.

**Actions:**
- `list_scoreboards` - Get all registered scoreboard types
- `list_fops` - Get available FOP names from current competition

### `/api/client-stream` (GET)
Server-Sent Events stream for browsers
- Real-time updates to all connected clients
- No authentication required (read-only)

## Configuration

### Environment Variables

```bash
# Optional: Logging level
LOG_LEVEL=info

# Optional: Enable learning mode
LEARNING_MODE=true

# TODO: Authentication key for OWLCMS connection (future feature)
# OWLCMS_UPDATEKEY=your-secret-key-here
```

## Creating Custom Plugins

Plugins are Svelte components in `src/plugins/[name]/page.svelte`.

### Example Plugin

```svelte
<!-- src/plugins/myView/page.svelte -->
<script>
  import { athletes, competitionInfo } from '$lib/stores';
  
  // Reactive statement updates when data changes
  $: myData = $athletes.filter(a => a.total > 200);
</script>

<h1>My Custom View</h1>
<p>Competition: {$competitionInfo.name}</p>

{#each myData as athlete}
  <div>{athlete.fullName}: {athlete.total}kg</div>
{/each}
```

### Available Stores

```javascript
import { 
  athletes,        // Array of athlete data
  currentAttempt,  // Current lifter info
  timer,           // Timer state
  competitionInfo, // Competition details
  liftingOrder,    // Lifting order
  leaders,         // Competition leaders
  isBreak,         // Break status
  records          // Record information
} from '$lib/stores';
```

## Development

### Project Structure

```
src/
├── lib/
│   ├── server/
│   │   └── competition-hub.js    # OWLCMS integration
│   ├── components/
│   │   └── Timer.svelte          # Autonomous countdown timer
│   └── stores.js                 # Client-side reactive stores
├── routes/
│   ├── api/                      # Server endpoints
│   └── [plugin]/                 # Dynamic plugin loader
└── plugins/                      # Plugin implementations
    ├── leaderboard/
    ├── currentLifter/
    └── teamStandings/
```

### Data Flow

1. **OWLCMS** sends WebSocket messages to `ws://localhost:8096/ws`
2. **Competition Hub** parses OWLCMS data and caches state
3. **Hub** broadcasts updates via Server-Sent Events
4. **Browser stores** receive SSE messages and update reactively
5. **Plugin components** re-render automatically

### Adding New Plugins

1. Create `src/plugins/[name]/page.svelte`
2. Import needed stores from `$lib/stores`
3. Use reactive statements (`$:`) for auto-updating data
4. Plugin automatically appears in navigation

### Debugging

- Check browser console for SSE connection status
- Verify OWLCMS WebSocket configuration is correct (`ws://localhost:8096/ws`)
- Use learning mode to capture incoming messages
- Check server console for WebSocket connection logs

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with real OWLCMS data
5. Submit a pull request

## Support

For issues related to:
- **OWLCMS integration**: Check OWLCMS documentation
- **SvelteKit tracker**: Open GitHub issue
- **Plugin development**: See plugin examples in `src/plugins/`
