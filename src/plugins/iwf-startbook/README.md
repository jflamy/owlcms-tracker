# IWF Results Plugin - Multi-Section Document Structure

## Overview

This plugin generates official IWF competition results documents with support for both:
- **Complete Document** (title page, TOC, all sections with Paged.js pagination)
- **Session Protocols Only** (individual session results - default)

## Document Structure

### Complete Document Sections

1. **Title Page** - Competition name, location, dates, organizers
2. **Table of Contents** - Auto-generated with page numbers (via Paged.js)
3. **Participants** - Complete athlete list by session and category
4. **Medals** - Medal standings and podium results
5. **Rankings** - Overall rankings by various scoring systems
6. **Session Protocols** - Detailed attempt-by-attempt results (fully implemented)
7. **Records** - New records set during competition

## File Structure

```
src/plugins/iwf-results/
├── page.svelte                    # Main entry point (routes between formats)
├── config.js                      # Plugin configuration with format option
├── helpers.data.js                # Server-side data processing
├── sections/                      # Modular section components
│   ├── TitlePage.svelte           # ✅ Implemented
│   ├── TableOfContents.svelte     # ✅ Implemented (with Paged.js)
│   ├── Participants.svelte        # 🚧 Placeholder
│   ├── Medals.svelte              # 🚧 Placeholder
│   ├── Rankings.svelte            # 🚧 Placeholder
│   ├── SessionProtocols.svelte    # ✅ Fully implemented
│   └── Records.svelte             # 🚧 Placeholder
└── README.md                      # This file
```

## Usage

### Default (Session Protocols Only)

```
http://localhost:8096/iwf-results?fop=all
```

Shows only the session protocols (existing functionality).

### Complete Document

```
http://localhost:8096/iwf-results?fop=all&format=complete
```

Generates the full document with all sections.

### Session-Specific

```
http://localhost:8096/iwf-results?fop=all&session=M1
```

Shows protocols for a specific session only.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | select | `protocols-only` | `complete` or `protocols-only` |
| `session` | text | `''` | Session name (e.g., `M1`), empty = all |
| `hideOfficials` | boolean | `false` | Hide officials section |

## Paged.js Integration

Complete format uses [Paged.js](https://pagedjs.org/) for:
- Automatic page numbering
- Table of contents with page references
- Print-ready pagination
- Page headers/footers

## Print Styling

See `.github/copilot-instructions.md` for document styling guidelines.

## Development

Each section is a standalone Svelte component that can be developed and tested independently. The modular structure allows generating complete documents or individual sections as needed.

See the old README (README-old.md) for detailed implementation guidance.
