# Tracker Books

Document generation plugins for OWLCMS Tracker.

## Structure

```
tracker-books/
├── iwf-helpers/          # Shared pure utility functions
│   ├── official-roles.js      # Official role constants and helpers
│   ├── athlete-transforms.js  # Athlete data formatting
│   ├── category-mapping.js    # Category and age group mapping
│   ├── records-extraction.js  # Record filtering and formatting
│   ├── session-helpers.js     # Session and timetable helpers
│   └── timetable.js           # Re-exports for backward compatibility
├── iwf-startbook/        # IWF Start Book plugin
│   ├── config.js
│   ├── helpers.data.js
│   ├── page.svelte
│   └── sections/
└── iwf-results/          # IWF Results Book plugin
    ├── config.js
    ├── helpers.data.js
    ├── page.svelte
    └── sections/
```

## Integration

This repository is integrated into [owlcms-tracker](https://github.com/owlcms/owlcms-tracker) as a git subtree at `src/plugins/books/`.

## Development

When working in the tracker repo, edit files in `owlcms-tracker/src/plugins/books/`, then push changes back:

```bash
cd owlcms-tracker
npm run books:push    # Push subtree changes to this repo
npm run books:pull    # Pull updates from this repo
```

## Plugin Pattern

Each plugin follows the tracker scoreboard pattern:

- **config.js** - Plugin metadata and configurable options
- **helpers.data.js** - Server-side data processing (imports from `$lib/server` and `@owlcms/tracker-core`)
- **page.svelte** - Display component (pure presentation, no logic)
- **sections/** - Reusable Svelte components for document sections

## iwf-helpers

Shared pure functions extracted to avoid duplication between plugins:

- **official-roles.js** - `OFFICIAL_ROLE_TRANSLATION_KEYS`, `OFFICIAL_ROLE_PRESENTATION_ORDER`, `getOfficialRoleTranslationKey()`, `sortOfficialsList()`, `buildOfficialSections()`
- **athlete-transforms.js** - `formatAttempt()`, `getAthleteTeam()`, `computeBestLifts()`, `calculateTeamPointsForRank()`
- **category-mapping.js** - `buildCategoryMap()`, `buildAthleteParticipationMap()`, `buildSubcategoryMap()`, `extractSessionAgeGroupsWithWeights()`, `buildAthleteAgeGroupParticipation()`
- **records-extraction.js** - `extractRecords()`, `extractNewRecords()`
- **session-helpers.js** - `formatSessionTime()`, `buildTimetableData()`, `mapOfficials()`

These are **pure functions** with minimal dependencies. External imports like `sortRecordsByFederation` from `@owlcms/tracker-core` are passed as parameters.

## License

MIT - See LICENSE
