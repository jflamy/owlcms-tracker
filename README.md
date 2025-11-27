<!-- markdownlint-disable -->
# OWLCMS Tracker

## Description

A SvelteKit application that receives real-time competition updates from OWLCMS and displays them through multiple scoreboard types.

## **Goals**

This project aims at giving users of owlcms the capability to create their own scoreboards, TV graphics, and documents.  The program receives the database from owlcms and all lifting order, decisions and timer updates.

Scoreboards can be created using AI agents like ChatGPT, Claude, etc.  The examples in this repository have been built in this way.  The author spelled  provided screen shots of existing scoreboards to start the process, and spelled out the required modifications.

## Example

Since the tracker has the full database available and the current session, it can do team scoreboards.  In this example, the AI assistant was asked to implement grouping by teams, filtering by gender, score totals based on top athletes per team, and even next attempt predictions.  The teams are reordered based on the team score.  There was no actual programming used.  The translation strings are provided by owlcms as part of the initialization.

![nvf](https://github.com/user-attachments/assets/cccf32f8-3ec9-450b-90ab-f4a76f2f244e)



## Documentation

### Getting Started
- **[CREATE_YOUR_OWN.md](./CREATE_YOUR_OWN.md)** - Create custom scoreboards (step-by-step guide)

### Core Reference
- **[docs/SCOREBOARD_ARCHITECTURE.md](./docs/SCOREBOARD_ARCHITECTURE.md)** - Complete system architecture
- **[docs/WEBSOCKET_MESSAGE_SPEC.md](./docs/WEBSOCKET_MESSAGE_SPEC.md)** - OWLCMS message formats

### Examples
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
- **`update`** - Lifting order changes, athlete switches, UI events (includes session athletes in `startOrderAthletes` field, formerly `groupAthletes`)
- **`timer`** - Timer start/stop/set events
- **`decision`** - Referee decisions and down signals

**See [docs/WEBSOCKET_MESSAGE_SPEC.md](./docs/WEBSOCKET_MESSAGE_SPEC.md) for complete message format details.**

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

## Running the Tracker

### Prerequisites

- **Node.js** 18+ installed

### Method 1: VS Code Launch Menu

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
```

The app will be available at **http://localhost:8096**



## Learning Mode

Learning mode is used to understand what OWLCMS actually sends.  You can use learning mode to see what is actually received during updates. The tracker core was built in this fashion built by observing what was received.

**Enable Learning Mode:**
- VS Code: Use "OWLCMS Tracker - Learning Mode" launch configuration
- Command Line: `npm run dev:learning` 
- Environment Variable: `LEARNING_MODE=true`

**What it captures:**
- Every WebSocket message from OWLCMS with ISO8601 timestamp
- Message type and parsed payload fields
- Message size and content
- Saves to `samples/message-[timestamp].json`


