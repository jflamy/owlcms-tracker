# IWF Results Plugin

This plugin replicates the official IWF competition protocol (`Protocol_All_IWF-A4.xlsx`) as a dynamic, print-ready HTML document.

## Features

- **Multi-Session Support**: Automatically generates a new page for each session in the competition.
- **Category Grouping**: Athletes are grouped by weight category with bold headers.
- **Official Signatures**: Includes signature lines for Referees, Jury, and Secretary.
- **Print Optimized**: Designed for A4 portrait printing with CSS page breaks.
- **Real-time Data**: Pulls directly from the Competition Hub's database state.

## URL Parameters

- `session`: Filter by a specific session name (e.g., `?session=M1`).
- `fop`: Filter by a specific platform (e.g., `?fop=A`).
- `hideOfficials`: Set to `true` to hide the signature section (e.g., `?hideOfficials=true`).

## Data Mapping

This plugin uses the `databaseState` from the Competition Hub. It transforms the flat athlete list into a nested structure:
1. **Sessions** (Top level)
2. **Categories** (Grouped within sessions)
3. **Athletes** (Sorted by rank or lot number)

## Implementation Details

- **Helpers**: `helpers.data.js` handles the complex grouping and formatting logic.
- **Svelte**: `page.svelte` provides a clean, table-based layout optimized for printing.
- **Caching**: Uses a plugin-level cache based on the database checksum to ensure high performance.
