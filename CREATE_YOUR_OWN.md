# Create Your Own Scoreboard with AI Assistance

This guide shows you how to create custom scoreboards **using an AI coding agent** like GitHub Copilot. You don't need to be a programmer—just describe what you want, and the agent will generate the code.

> **The Goal:** You describe your scoreboard in plain English, and the AI creates it for you. Then you iterate by describing changes until it's exactly what you need.

---

## Prerequisites

### 1. Install Node.js

Download and install Node.js (which includes npm) from: https://nodejs.org/

Choose the **LTS (Long Term Support)** version. This installs both Node.js and npm (the package manager).

Verify installation by opening a terminal and running:
```bash
node --version
npm --version
```

### 2. Install Visual Studio Code

Download and install VS Code from: https://code.visualstudio.com/

### 3. Get GitHub Copilot

1. Sign up for GitHub Copilot at: https://github.com/features/copilot
2. Install the **GitHub Copilot** extension in VS Code
3. Install the **GitHub Copilot Chat** extension for agent mode

### 4. Clone This Repository

```bash
git clone https://github.com/owlcms/owlcms-tracker.git
cd owlcms-tracker
npm install
```

### 5. Open in VS Code

```bash
code .
```

---

## Running the Tracker for Development

### Method 1: VS Code Launch Menu

**This workspace is pre-configured for VS Code with Git Bash as the default shell.**

1. Open the project in VS Code
2. Go to **Run and Debug** (Ctrl+Shift+D) or click the play icon in the sidebar
3. Select one of the configurations from the dropdown:
   - **"OWLCMS Tracker - Production Mode"** - Normal operation
   - **"OWLCMS Tracker - Learning Mode"** - Captures all incoming messages to `samples/` directory (see [Learning Mode](#learning-mode) below)
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

---

## Learning Mode

Learning mode is useful when developing custom scoreboards. It captures every WebSocket message from OWLCMS so you can understand the data structure and build your scoreboard logic accordingly.

**Enable Learning Mode:**
- VS Code: Use "OWLCMS Tracker - Learning Mode" launch configuration
- Command Line: `npm run dev:learning` 
- Environment Variable: `LEARNING_MODE=true`

**What it captures:**
- Every WebSocket message from OWLCMS with ISO8601 timestamp
- Message type and parsed payload fields
- Message size and content
- Saves to `samples/message-[timestamp].json`

**When to use it:**
- Understanding what data OWLCMS sends during competition events
- Debugging custom scoreboard data processing
- Learning the data structures for building new plugins

---

## Configure OWLCMS (One-time Setup)

Before creating scoreboards, configure OWLCMS to send data:

In OWLCMS, navigate to:
**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set the URL to:
```
ws://localhost:8096/ws
```

That's it! OWLCMS will now send competition data to the tracker.

---

## Using Agent Mode

### Open Copilot Chat in Agent Mode

1. Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac) to open Copilot Chat
2. Click the **Agent** button (or type `@workspace` to give the agent context)
3. The agent can now read your project files and create new ones

### Key Agent Capabilities

- ✅ **Read existing plugins** to understand the patterns
- ✅ **Create new files** in the correct locations
- ✅ **Modify code** based on your descriptions
- ✅ **Understand the architecture** from documentation

---

## Example 1: Copy an Existing Scoreboard

The easiest way to create a new scoreboard is to start from an existing one.

### Step 1: Ask the Agent to Copy a Plugin

**Your prompt:**

> Create a copy of the team-scoreboard plugin called "qpoints-scoreboard". Keep all the same functionality for now—I'll modify it next.

**What the agent does:**
1. Reads `src/plugins/team-scoreboard/` to understand the structure
2. Creates `src/plugins/qpoints-scoreboard/` with copies of:
   - `config.js` - Plugin metadata and options
   - `helpers.data.js` - Server-side data processing
   - `page.svelte` - Display component
   - `README.md` - Documentation

### Step 2: Verify the Copy Works

```bash
npm run dev
```

Open: `http://localhost:8096/qpoints-scoreboard?fop=A`

You should see the same display as the team scoreboard.

---

## Example 2: Change the Scoring System

Now let's modify the copied scoreboard to use a different scoring system.

### Step 1: Point the Agent at the Definition

**Your prompt:**

> I want to replace Sinclair scoring with QPoints in the qpoints-scoreboard plugin.
> 
> QPoints was developed by Dr. Marianne Huebner (Michigan State University) as an alternative to Sinclair for comparing lifters across weight categories. 
> 
> Read the official definition here:
> https://msu.edu/~hueblerm/qpoints/
> 
> The formula uses regression coefficients derived from world records:
> - QPoints = Total × Coefficient(bodyweight, gender)
> - Coefficients are published in tables on the Huebner website
> 
> Please:
> 1. Fetch the coefficient tables from the Huebner website or use the published values
> 2. Add a `calculateQPoints(total, bodyWeight, gender)` function to helpers.data.js
> 3. Replace all references to `sinclair` with `qpoints`
> 4. Update the display to show QPoints instead of Sinclair
> 5. Sort teams by total QPoints score

**What the agent does:**
1. Opens `src/plugins/qpoints-scoreboard/helpers.data.js`
2. Reads the Huebner coefficient tables (or you paste them into the prompt)
3. Adds the QPoints calculation function with proper coefficients
4. Modifies the athlete processing to compute QPoints
5. Updates `page.svelte` to display QPoints
6. Changes the team sorting to use QPoints

### Step 2: Refine with Coefficient Tables

If the agent needs the exact coefficients, paste them from the Huebner website:

**Your prompt:**

> Here are the QPoints coefficients from https://msu.edu/~huebner/qpoints/
> 
> [Paste the coefficient table here]
> 
> Use linear interpolation for bodyweights between table values.

The agent will implement the calculation with the official coefficients.

---

## Example 3: Create a Completely New Scoreboard

You can also describe a scoreboard from scratch.

### Step 1: Describe What You Want

**Your prompt:**

> Create a new scoreboard plugin called "top-lifters" that shows:
> 
> 1. The top 5 athletes by total, regardless of category
> 2. Each athlete row shows: rank, name, team, category, total, and Sinclair
> 3. Highlight the current lifter if they're in the top 5
> 4. Use a dark theme with gold/silver/bronze colors for top 3
> 5. Add a URL parameter `limit` to control how many athletes to show (default 5)
> 
> Look at the existing lifting-order plugin for styling patterns.

**What the agent creates:**
1. `src/plugins/top-lifters/config.js` - With the `limit` option
2. `src/plugins/top-lifters/helpers.data.js` - Sorting and filtering logic
3. `src/plugins/top-lifters/page.svelte` - Display with styling

### Step 2: Test It

```bash
npm run dev
```

Open: `http://localhost:8096/top-lifters?fop=A&limit=10`

### Step 3: Iterate

**More prompts to refine:**

> "Add a transition animation when the ranking changes"

> "Show a small flag icon next to each team name"

> "Make the current lifter row pulse with a subtle glow"

> "Add a header showing the competition name and current session"

---

## Tips for Effective Agent Prompts


### Point to Existing Patterns

**Good:**
> Create a timer display

**Better:**
> Create a timer display using the same pattern as in the lifting-order plugin.

### Show Examples

**Good:**
> Format attempts like this: good lifts show the weight (e.g., "120"), failed lifts show the weight in parentheses (e.g., "(120)"), and pending attempts show just the requested weight.

**Better:**
> Paste a screenshot of a mockup or a screenshot of an existing scoreboard highlighting where you want the change.

---

## Understanding the Plugin Structure

When asking the agent to create or modify plugins, it helps to understand what each file does:

### `config.js` - Plugin Metadata

```javascript
export default {
  name: 'My Scoreboard',           // Display name
  description: 'What it does',     // Shown in plugin list
  options: [                       // URL parameters
    {
      key: 'limit',                // ?limit=10
      label: 'Show Top',
      type: 'number',
      default: 10
    }
  ]
};
```

### `helpers.data.js` - Server-Side Processing

This is where all data manipulation happens:
- Fetches data from the Competition Hub
- Sorts, filters, and groups athletes
- Computes scores and rankings
- Returns processed data for display

**Key principle:** All calculations happen here, not in the browser.

### `page.svelte` - Display Component

This only displays pre-processed data:
- Maps data to HTML elements
- Applies CSS styling
- Handles timer countdown (client-side)
- Shows/hides elements based on flags

**Key principle:** No data manipulation—just display.

---

## Key Documentation for Agents

Point the agent to these files for context:

| Document | What It Contains |
|----------|------------------|
| `docs/SCOREBOARD_ARCHITECTURE.md` | Complete system architecture, data flow, caching, display fields |
| `docs/WEBSOCKET_MESSAGE_SPEC.md` | Message formats from OWLCMS |
| `docs/OWLCMS_TRANSLATIONS_SPEC.md` | Translation system and displayInfo structure |
| `src/plugins/team-scoreboard/` | Complex example with team grouping |
| `src/plugins/lifting-order/` | Standard scoreboard pattern |
| `src/lib/timer-logic.js` | Reusable timer countdown logic |

---

## Testing Your Scoreboard

### Start the Development Server

```bash
npm run dev
```

### View Your Scoreboard

```
http://localhost:8096/{plugin-name}?fop=A
```

Replace `{plugin-name}` with your plugin folder name.

### Load Test Data

If you don't have OWLCMS running:

```bash
./tests/test-sample-data.sh
```

This loads sample competition data for testing.

### Check for Errors

1. Open browser Developer Tools (F12)
2. Check the Console tab for JavaScript errors
3. Check the Network tab for failed API requests
4. Check the VS Code terminal for server-side errors

---

## Troubleshooting

### "Scoreboard type not found"

**Cause:** Plugin folder name doesn't match URL

**Fix:** 
- Folder: `src/plugins/my-scoreboard/`
- URL: `http://localhost:8096/my-scoreboard?fop=A`
- Restart the dev server after creating new plugins

### "No competition data"

**Cause:** No data from OWLCMS yet

**Fix:**
1. Check OWLCMS URL configuration (see Prerequisites)
2. Start OWLCMS, go to the Announcer screen, use the Reload Session button.

### Styling Doesn't Look Right

**Cause:** CSS conflicts or missing styles

**Fix:**

> Look at the CSS in `src/plugins/lifting-order/page.svelte` and use similar patterns. The scoreboard uses a dark theme with CSS custom properties.

---

## Real-World Example: QPoints Team Scoreboard

Here's a complete conversation flow for creating a QPoints-based team scoreboard:

### Prompt 1: Initial Request

> I want to create a team scoreboard that uses QPoints instead of Sinclair for scoring. QPoints rewards lighter athletes more than Sinclair does.
>
> Start by copying the team-scoreboard plugin to a new plugin called "qpoints-teams".

### Prompt 2: Add QPoints Calculation

> Add a QPoints calculation to the helpers.data.js file.
> 
> QPoints was developed by Dr. Marianne Huebner at Michigan State University.
> The official definition and coefficient tables are at: https://msu.edu/~huebner/qpoints/
> 
> Fetch the page and extract the coefficient tables for men and women.
> The formula is: QPoints = Total × Coefficient(bodyweight, gender)
> Use linear interpolation for bodyweights between table values.

### Prompt 3: Update Sorting

> Now update the team scoring to:
> 1. Calculate QPoints for each athlete
> 2. Sum the top 4 QPoints scores for each team
> 3. Sort teams by total QPoints descending
> 4. Show individual QPoints next to each athlete's total

### Prompt 4: Refine Display

> Update the display to:
> 1. Show "QPoints" in the column header instead of "Score"
> 2. Format QPoints to 3 decimal places
> 3. Highlight athletes whose QPoints contribute to the team score

### Prompt 5: Add Documentation

> Add a README.md to the plugin explaining:
> 1. What QPoints is and why it's used
> 2. The coefficient table
> 3. How team scores are calculated
> 4. Available URL parameters

---

## Summary

**The AI-Assisted Workflow:**

1. **Copy** an existing plugin as a starting point
2. **Describe** the changes you want in plain English
3. **Point** the agent at relevant documentation
4. **Test** the result in your browser
5. **Iterate** with more prompts until it's perfect

**Key Principles:**

- Be specific about what you want
- Reference existing plugins as patterns
- Point to documentation for complex features
- Test frequently and describe what's wrong
- The agent can read your entire project—use that!

**No Programming Required:**

You don't need to understand JavaScript, Svelte, or any of the underlying technology. Just describe what you want to see on screen, and let the agent figure out how to build it.
