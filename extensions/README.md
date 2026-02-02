<!-- markdownlint-disable -->
# Extensions Directory

This directory contains **extensions** (git submodules) - runtime add-ons that customize existing bundled plugins without modifying the owlcms-tracker source code.

**What are extensions?** Extensions are NOT standalone plugins. They are configuration overlays that add custom scoring logic and options to existing bundled plugins.

## How Extensions Work

**Bundled plugins** (`src/plugins/`):
- Complete scoreboard implementations compiled into owlcms-tracker
- Contain UI components (`.svelte` files) and data processing logic
- Examples: `lifting-order`, `team-scoreboard`, `iwf-results`

**Extensions** (`extensions/`):
- Runtime add-ons that customize bundled plugins
- Separate git repositories added as submodules
- **Do NOT contain `.svelte` files** (no UI code)
- Use `delegateTo` to specify which bundled plugin they extend
- Provide custom `calculateScore()` functions and options
- Ideal for federation-specific customizations
- Each country/federation maintains their own git repository

## Creating an Extension

Extensions are **runtime add-ons** that extend bundled plugins by:
1. Specifying which bundled plugin to extend via `delegateTo`
2. Adding custom scoring logic via `calculateScore()` function
3. Defining additional options and metadata

**Key concept:** An extension is NOT a new scoreboard - it's a customization layer on top of an existing bundled plugin.

### Directory Structure

```
extensions/
  your-country-name/
    your-extension-name/
      config.js         # Required - extension configuration (adds to bundled plugin)
```

**Note:** Each extension folder contains a single `config.js` file that extends a bundled plugin.

### Minimal Example

Here's a simplified `federationScores` extension that adds custom scoring to the `team-scoreboard` plugin:

```javascript
/**
 * Scoreboard configuration
 */

import { parseFormattedNumber } from '@owlcms/tracker-core/utils';
import { calculateSinclair2024 } from '@owlcms/tracker-core/scoring';

export default {
  // Display name
  name: 'Federation Scores',

  // Description for AI assistants
  description: 'Team competitions with Sinclair totals or bodyweight-normalized totals',

  // Category for homepage grouping
  category: 'team',

  // Delegate page rendering to parent plugin
  delegateTo: 'teams/team-scoreboard',

  // Required resources
  requires: ['flags_zip'],

  // User-configurable options
  options: [
    {
      key: 'scoringSystem',
      label: 'Scoring System',
      type: 'select',
      options: ['BW', 'SinclairM'],
      default: 'BW',
      group: 'display',
      description: 'BW = Bodyweight ratio (total/bodyweight). SinclairM = Sinclair with modifications'
    },
    {
      key: 'gender',
      label: 'Gender',
      type: 'select',
      options: ['M', 'F', 'MF'],
      default: 'M',
      group: 'display'
    },
    {
      key: 'allAthletes',
      label: 'Include All Athletes',
      type: 'boolean',
      default: true,
      group: 'scoring',
      description: 'Count all athletes toward team score'
    }
  ]
};

/**
 * Custom scoring systems
 * 
 * @param {number} total - Athlete total (actual or predicted)
 * @param {number} bw - Body weight
 * @param {string} gender - 'M' or 'F'
 * @param {number} age - Athlete age
 * @param {string} system - Scoring system name
 * @param {Object} context - Extended context
 * @param {Object} context.athlete - Full athlete object
 * @returns {number|null} Score or null to delegate to base plugin
 */
export function calculateScore(total, bw, gender, age, system, context = {}) {
  const { athlete } = context;

  // Calculate athlete total from best lifts
  const bestSnatch = parseFormattedNumber(athlete?.bestSnatch);
  const bestCleanJerk = parseFormattedNumber(athlete?.bestCleanJerk);
  const athleteTotal = bestSnatch + bestCleanJerk;

  if (system === 'BW') {
    // BW = (best snatch + best clean & jerk) / body weight
    return bw > 0 ? athleteTotal / bw : 0;
  }
  
  if (system === 'SinclairM') {
    // SinclairM = Sinclair with federation modifications
    // Men: standard Sinclair
    // Women: Sinclair × 1.5
    const sinclair = calculateSinclair2024(athleteTotal, bw, gender);
    return gender === 'F' ? sinclair * 1.5 : sinclair;
  }
  
  // Delegate to base plugin for all other scoring systems
  return null;
}
```

## Key Requirements

### 1. Must Use `delegateTo`

Extensions cannot render their own UI - they must specify which bundled plugin they extend:

```javascript
delegateTo: 'teams/team-scoreboard'  // Use team-scoreboard's compiled page.svelte
```

Available delegation targets:
- `teams/team-scoreboard` - Team scoring with customizable systems (supports `calculateScore()`)

**Note:** Currently only `teams/team-scoreboard` supports custom scoring via `calculateScore()`. Other scoreboards (`scoreboards/lifting-order`, `scoreboards/start-order`, `scoreboards/rankings`) do not include, at the moment, a custom score column.

### 2. Custom Scoring Function

Export a `calculateScore()` function to implement custom scoring logic:

```javascript
export function calculateScore(total, bw, gender, age, system, context = {}) {
  if (system === 'MyCustomSystem') {
    // Your scoring logic here
    return customScore;
  }
  
  // Return null to delegate to base plugin
  return null;
}
```

**Parameters:**
- `total` - Athlete's total (actual or predicted)
- `bw` - Body weight
- `gender` - 'M' or 'F'
- `age` - Athlete age
- `system` - Name of the scoring system (from options)
- `context.athlete` - Full athlete object with all fields

**Return value:**
- Number: Your custom score
- `null`: Delegate to base plugin's scoring

### 3. Import from tracker-core

Use functions from `@owlcms/tracker-core` for common operations:

```javascript
// Utility functions
import { parseFormattedNumber } from '@owlcms/tracker-core/utils';

// Scoring functions
import { 
  calculateSinclair2024,
  calculateQPoints,
  calculateGamx
} from '@owlcms/tracker-core/scoring';
```

### 4. Define Scoring System Option

Include a `scoringSystem` option so users can select your custom scoring:

```javascript
options: [
  {
    key: 'scoringSystem',
    label: 'Scoring System',
    type: 'select',
    options: ['BW', 'SinclairM', 'Sinclair', 'QPoints'],  // Add your custom systems
    default: 'BW'
  }
]
```

### 5. Declare Additional Dependencies (Optional)

If your extension requires npm packages beyond tracker-core, declare them in `additionalDependencies`:

```javascript
export default {
  name: 'My Plugin',
  delegateTo: 'teams/team-scoreboard',
  
  // NPM packages required by this plugin (installed during packaging)
  additionalDependencies: [
    'moment@^2.29.4',           // Specific version
    'lodash',                    // Latest version
    'some-package@1.2.3'        // Exact version
  ],
  
  options: [...]
};
```

**When to use:**
- Custom scoring libraries not in tracker-core
- Specialized data processing packages
- Third-party utilities

**How it works:**
- During `npm run zip`, the packaging script scans all extension `config.js` files
- Packages declared in `additionalDependencies` are installed into `node_modules/`
- They're available for import in your extension's `config.js` scoring functions

**⚠️ Manual Installation:**
If you copy an extension to an already-deployed tracker (not built from source), you must manually install dependencies:

```bash
# Navigate to the tracker installation directory
cd /path/to/owlcms-tracker

# Install the required packages
npm install moment@^2.29.4 lodash some-package@1.2.3

# Restart the tracker
node start-with-ws.js
```

**Recommendation:** Extensions with additional dependencies should include installation instructions in their README.

**Example with external library:**

```javascript
// config.js
import customScoring from 'my-federation-scoring-lib';

export default {
  name: 'Federation Scores',
  delegateTo: 'teams/team-scoreboard',
  
  additionalDependencies: [
    'my-federation-scoring-lib@^2.0.0'
  ],
  
  options: [...]
};

export function calculateScore(total, bw, gender, age, system, context) {
  if (system === 'FederationFormula') {
    return customScoring.calculate(total, bw, gender);
  }
  return null;
}
```

## How It Works

1. **Discovery**: The scoreboard registry recursively scans both `src/plugins/` (bundled) and `extensions/` (add-ons)
2. **Git Submodules**: Extensions are tracked as git submodules (separate repositories)
3. **Extension Resolution**: When an extension is requested, it loads the bundled plugin specified in `delegateTo`
4. **Score Calculation**: The extension's `calculateScore()` function is called for each athlete
5. **Options Merging**: The extension's options are merged with the base plugin's options

## Adding an Extension

**For developers with access to private extension repos:**

```bash
# Clone owlcms-tracker
git clone https://github.com/owlcms/owlcms-tracker.git
cd owlcms-tracker

# Add your extension as a submodule
git submodule add https://github.com/your-org/tracker-yourCountry.git extensions/yourCountry

# Initialize the submodule
git submodule update --init extensions/yourCountry

# Run tracker
npm run dev
```

**For developers maintaining their own extensions:**

See [Git Submodule Workflow](#git-submodule-workflow) below for managing local modifications.

## Testing Your Extension

1. Add your extension as a submodule in `extensions/your-country/`
2. Create extension folders with `config.js` files
3. Run tracker: `npm run dev`
4. Access your extension: `http://localhost:8096/your-country/your-extension-name?fop=A`

**The extension will use the UI from the bundled plugin specified in `delegateTo`, but with your custom scoring and options.**

## Git Submodule Workflow

**For federation developers maintaining private extensions:**

If you need to keep your submodules private and don't want to commit them to the main repo:

```bash
# Add your private submodule locally
git submodule add https://github.com/myorg/tracker-myCountry.git extensions/myCountry

# Tell git to ignore your local .gitmodules changes
git update-index --skip-worktree .gitmodules

# Your extension works locally but won't be committed upstream
```

**To pull upstream changes:**

```bash
# Temporarily un-skip .gitmodules
git update-index --no-skip-worktree .gitmodules

# Pull changes (may need to resolve conflicts)
git pull origin main

# Re-apply skip-worktree
git update-index --skip-worktree .gitmodules
```

## Example Use Cases

- **Federation-specific scoring**: Custom formulas (PDC, modified Sinclair)
- **Regional competitions**: Different team scoring rules
- **Custom age group adjustments**: Masters coefficients
- **Combined scoring systems**: Multi-factor rankings

## Need Help?

See the complete `équipes/config.js` in this directory for a full example with all available options and French translations.
