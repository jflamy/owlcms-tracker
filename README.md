# OWLCMS Tracker

A SvelteKit application that receives real-time competition updates from OWLCMS and displays them through multiple scoreboard types. **Runs on port 8095**.

## 📚 Documentation

- **[CREATE_YOUR_OWN.md](./CREATE_YOUR_OWN.md)** - Create custom scoreboards ✨
- **[docs/SCOREBOARD_ARCHITECTURE.md](./docs/SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture
- **[Plugin README](./src/plugins/lifting-order/README.md)** - Example scoreboard with AI prompts

## ⚙️ OWLCMS Configuration Required

**Before using this tracker**, you must configure OWLCMS to send data here:

In OWLCMS: **Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `http://localhost:8095` (or your tracker's address)

**That's it!** No code changes to OWLCMS needed - just this URL setting.

## 🎯 Features

✅ **Multiple Scoreboard Types** - Lifting order, results, team rankings, and more  
✅ **Multi-FOP Support** - Display up to 6 FOPs simultaneously  
✅ **Simple OWLCMS Setup** - One URL configuration, no code changes  
✅ **AI-Assisted Development** - Create new scoreboards with AI help  
✅ **URL-Based Options** - Configure each scoreboard via query parameters  
✅ **Real-Time SSE Updates** - Instant display of decisions and timer events  
✅ **Server-Side Processing** - Process once, serve hundreds of browsers

## 🏗️ Architecture

**Real-time SSE push architecture** - Competition data flows from OWLCMS through the Competition Hub to browsers via Server-Sent Events, triggering instant updates on decisions and timer events.

```
OWLCMS → Competition Hub → SSE Broadcast → Browsers
```

**For complete architecture details**, see **[docs/SCOREBOARD_ARCHITECTURE.md](./docs/SCOREBOARD_ARCHITECTURE.md)**

## 🚀 Quick Start

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
# Normal mode (port 8095)
npm run dev

# Learning mode - captures all OWLCMS messages to samples/ directory
npm run dev:learning

# Windows PowerShell learning mode
$env:LEARNING_MODE="true"; npm run dev

# Windows Command Prompt learning mode  
set LEARNING_MODE=true && npm run dev
```

The app will be available at **http://localhost:8095**

## 🔬 Learning Mode

**Learning mode is essential for the first runs** to understand what OWLCMS actually sends.

**Enable Learning Mode:**
- VS Code: Use "OWLCMS Tracker - Learning Mode" launch configuration
- Command Line: `npm run dev:learning` 
- Environment Variable: `LEARNING_MODE=true`

**What it captures:**
- Every HTTP POST from OWLCMS with ISO8601 timestamp
- Raw form data and parsed fields
- Message size and content type
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
http://localhost:8095/lifting-order?fop=A
```

Change `fop=A` to match your FOP name (e.g., `Platform_A`, `Platform_B`).

### 3. Configure OWLCMS

**IMPORTANT:** You must configure OWLCMS to send data to this tracker.

In OWLCMS, go to:

**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `http://localhost:8095` (or your tracker host)

OWLCMS will then send to these endpoints:
- `http://localhost:8095/database` - Full competition data
- `http://localhost:8095/update` - Lifting order updates
- `http://localhost:8095/timer` - Timer events
- `http://localhost:8095/decision` - Referee decisions

**No code changes to OWLCMS are needed** - just this one configuration setting.

### 4. Create More Scoreboard Types

See **[QUICKSTART.md](./QUICKSTART.md)** for step-by-step instructions.

## 📊 Available Scoreboards

### Lifting Order (`/lifting-order`)

Shows current lifter and upcoming attempts with countdown timer.

**URL:** `/lifting-order?fop=Platform_A&maxLifters=8`

**Options:**
- `fop` (required) - FOP name
- `showRecords` (optional) - Show competition records (true/false)
- `maxLifters` (optional) - Number of upcoming lifters (default: 8)

## 🎨 Creating Custom Scoreboards

Want to create your own scoreboard types? See **[CREATE_YOUR_OWN.md](./CREATE_YOUR_OWN.md)** for step-by-step instructions.

The plugin system makes it easy to create custom displays - whether you're a programmer or using AI assistance.

## 🔬 Learning Mode

**Learning mode captures all OWLCMS messages** to understand the data format.

**Enable:**

In OWLCMS, configure the EventForwarder settings:

- **URL**: `http://your-tracker-host:8095/api/update`
- **Update Key**: Set `UPDATE_KEY` environment variable (default: "development-key")

### 3. View Competition Data

Open http://localhost:5173 to see available views:

- **Leaderboard**: Overall competition rankings
- **Current Lifter**: Live attempt display with timer
- **Team Standings**: Team-based scores

## 📊 API Endpoints

### `/api/update` (POST)
Receives form-encoded updates from OWLCMS EventForwarder
- Authentication via `updateKey` parameter
- Returns 412 when configuration is needed
- Returns 200 when update is accepted

### `/api/config` (POST) 
Receives configuration uploads from OWLCMS
- Handles multipart uploads with local.zip

### `/api/client-stream` (GET)
Server-Sent Events stream for browsers
- Real-time updates to all connected clients
- No authentication required (read-only)

### `/api/refresh` (POST)
Manual refresh endpoint
- Forces re-sync with OWLCMS
- Useful for troubleshooting

## 🔧 Configuration

### Environment Variables

```bash
# Required: Authentication key matching OWLCMS
UPDATE_KEY=your-secret-key-here

# Optional: Logging level
LOG_LEVEL=info
```

### OWLCMS Settings

In OWLCMS configuration:
1. Set "Public Results URL" to your tracker's `/api/update` endpoint
2. Set "Update Key" to match your `UPDATE_KEY`
3. Enable "Public Results" in competition settings

## 🎨 Creating Custom Plugins

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

## 🛠️ Development

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

1. **OWLCMS** sends form-encoded POST to `/api/update`
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
- Monitor `/api/update` endpoint for OWLCMS posts
- Use `/api/refresh` to force OWLCMS resync
- Verify `UPDATE_KEY` matches between systems

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with real OWLCMS data
5. Submit a pull request

## 📞 Support

For issues related to:
- **OWLCMS integration**: Check OWLCMS documentation
- **SvelteKit tracker**: Open GitHub issue
- **Plugin development**: See plugin examples in `src/plugins/`