<!-- markdownlint-disable -->
# Extensions Directory

This directory contains **extensions** (git submodules) for federation-specific scoreboards that can be added without modifying the owlcms-tracker source code.

## Extensions vs. Bundled Plugins

**Bundled plugins** (`src/plugins/`):
- Part of the owlcms-tracker source code, compiled during build
- Can contain `.svelte` files
- Examples: `lifting-order`, `team-scoreboard`, `iwf-results`

**Extensions** (`extensions/`):
- Separate git repositories added as submodules
- **Cannot contain `.svelte` files** (no runtime compilation)
- Must use `delegateTo` to reuse compiled components from bundled plugins
- Ideal for federation-specific customizations
- Each country/federation maintains their own git repository

## Creating an Extension

Extensions are **config-only derivatives** that:
1. Delegate rendering to a bundled plugin via `delegateTo`
2. Provide custom scoring logic via `calculateScore()` function
3. Define their own options and metadata

### Directory Structure

```
extensions/
  your-country-name/
    your-plugin-name/
      config.js         # Required - plugin configuration
```

### Minimal Example

Here's a simplified version of a `federationScores` plugin that demonstrates the pattern:

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

Runtime plugins cannot render their own UI - they must delegate to a bundled plugin:

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

## How It Works

1. **Plugin Discovery**: The scoreboard registry recursively scans both `src/plugins/` and `extensions/`
2. **Git Submodules**: Extensions are tracked as git submodules (separate repositories)
3. **Delegation**: When an extension plugin is requested, it loads the delegate plugin's compiled page
4. **Score Calculation**: The `calculateScore()` function is called for each athlete
5. **Options**: User-selected options are passed to both the score calculation and base plugin

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
2. Create plugin folders with `config.js` files
3. Run tracker: `npm run dev`
4. Access your plugin: `http://localhost:8096/your-country/your-plugin-name?fop=A`

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
