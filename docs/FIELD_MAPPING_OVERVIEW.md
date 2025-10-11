# Field Mapping Documentation - Overview

## Overview

This directory contains comprehensive documentation on how data flows from OWLCMS through the competition hub to scoreboard displays.

## Documents

### 1. [FIELD_MAPPING.md](./FIELD_MAPPING.md) - Complete Reference
**Purpose:** Detailed field-by-field mapping showing where each piece of data comes from.

**Contains:**
- Complete field mapping tables organized by category
- Data source comparison (Group Athletes vs Database Athletes)
- Real sample data examples (embedded in main document)
- Attempt object structure and formatting
- Merging strategy explanation
- Type conversions required
- Field Mapping Summary Table
- Edge cases and troubleshooting

**Use when:** You need to understand exactly where a specific field comes from, how it's computed, or see real OWLCMS data examples.

---

## Quick Navigation

### Common Questions

**Q: Why is my athlete not highlighted?**
→ See [FIELD_MAPPING.md - State Fields](./FIELD_MAPPING.md#state-fields-current-lifting)
→ `classname` and `className` are ONLY in Group Athletes from `/update` endpoint

**Q: Where does category name come from?**
→ Group Athletes: Use `category` field (e.g., "M 79")
→ Database Athletes: Use `categoryName` field (both have formatted names now!)

**Q: How do I merge Group and Database athletes?**
→ See [FIELD_MAPPING.md - Merging Strategy](./FIELD_MAPPING.md#merging-strategy)
→ Priority: Use Group Athletes as-is, transform Database-only athletes

**Q: What's the difference between `classname` and `className`?**
→ `classname` = on athlete object ("current blink", "next", "NONE") → highlights row
→ `className` = on attempt object (" current blink", "") → highlights weight cell
→ Both ONLY exist in Group Athletes!

**Q: Why convert lotNumber to string?**
→ Group Athletes have strings ("42"), Database Athletes have numbers (42)
→ Must convert for Set membership checks

**Q: When do I transform Database athletes?**
→ ONLY when athlete is NOT in current `groupAthletes`
→ Example: Athletes from previous sessions, other teams

**Q: How do I format database attempts?**
→ See [FIELD_MAPPING.md - Attempts Fields](./FIELD_MAPPING.md#attempts-fields)
→ Priority: actualLift > change2 > change1 > declaration > automaticProgression

---

## Data Source Summary

### OWLCMS Sends to Competition Hub

```
WebSocket type="database" → databaseState.athletes[]
                            - Full competition roster (all sessions)
                            - Raw lift data (6 fields per attempt)
                            - categoryName field with formatted name (e.g., "M 79")
                            - category field with ID number (legacy)
                            - fullBirthDate array [year, month, day]
                            - ❌ No classname/className (no highlighting)

WebSocket type="update"   → fopUpdates[fopName].groupAthletes
                            - Current session athletes only
                            - Precomputed display data (ready to show)
                            - category field with formatted name (e.g., "M 79")
                            - ⭐ Has classname on athlete ("current blink", "next", "NONE")
                            - ⭐ Has className on attempts (" current blink", "")
```

### Scoreboard Processing Strategy

```
helpers.data.js:
1. Parse groupAthletes JSON (current session)
2. Build Set of current group lot numbers
3. Transform Database-only athletes (NOT in current group)
   - Concatenate fullName
   - Convert lotNumber to string
   - Use categoryName field (no lookup needed!)
   - Format 6 attempts per lift type
   - Add inCurrentGroup: false flag
4. Merge: [...groupAthletes, ...databaseOnlyAthletes]
5. Group by team
6. Sort and filter by options
7. Cache result (using data hash, not timestamp)
8. Return to browser

page.svelte:
1. Receive merged data
2. Map to table rows
3. Apply CSS classes from classname/className
4. Display with highlighting (Group athletes only)
```

---

## Field Categories

### Identity Fields
- `fullName`, `firstName`, `lastName`
- `startNumber`, `lotNumber`
- `gender`, `bodyWeight`, `yearOfBirth`
- **Source:** Both (Group has preformatted strings, Database may need conversion)

### Team/Category Fields
- `teamName`, `team`
- `category` (Group Athletes - formatted name like "M 79")
- `categoryName` (Database Athletes - formatted name like "M 79")
- **Source:** Both now have formatted category names! No lookup needed.

### Attempt Fields
- `sattempts[]`, `cattempts[]`
- Each attempt: `{ liftStatus, stringValue, className }`
- **Source:** Group has complete objects, Database needs `formatAttempt()` processing
- **Critical:** `className` only in Group! Never in Database.

### Results Fields
- `bestSnatch`, `bestCleanJerk`, `total`
- `totalRank`, `sinclair`, `globalScore`
- **Source:** Both (Group has precomputed values, Database may need computation)

### State Fields (Current Lifting)
- `classname` on athlete ("current blink", "next", "NONE")
- `className` on attempts (" current blink", "")
- **Source:** Group ONLY! Critical for highlighting.

---

## Architecture Context

These field mapping documents complement:
- [SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md) - Overall system design
- [CACHING_IMPLEMENTATION.md](./CACHING_IMPLEMENTATION.md) - Performance optimization

**Together they explain:**
1. How OWLCMS data flows to browsers (Architecture)
2. How plugins cache processed results (Caching)
3. How data is merged and mapped (Field Mapping - this directory)

---

## For Developers

### Creating Custom Scoreboards

If you're creating a custom scoreboard plugin:

1. **Understand data sources** → Read [FIELD_MAPPING.md](./FIELD_MAPPING.md) - see embedded samples
2. **Copy proven patterns** → Use existing `helpers.data.js` as template
3. **Implement caching** → Follow [CACHING_IMPLEMENTATION.md](./CACHING_IMPLEMENTATION.md)
4. **Test with real data** → Use sample files in `samples/` directory

### Key Decisions for Custom Scoreboards

| Question | Answer | Reference |
|----------|--------|-----------|
| Do I need Group Athletes? | Yes if highlighting current/next athlete | [State Fields](./FIELD_MAPPING.md#state-fields-current-lifting) |
| Do I need Database Athletes? | Yes if showing athletes outside current session | [Sample Data Examples](./FIELD_MAPPING.md#sample-data-examples) |
| How do I merge them? | Use Group as-is, transform Database-only | [Merging Strategy](./FIELD_MAPPING.md#merging-strategy) |
| What should my cache key include? | Data hash + user options (NOT timestamp) | [Caching Implementation](./CACHING_IMPLEMENTATION.md#cache-key-strategy) |
| How do I get category names? | Group: `category` field, Database: `categoryName` field | [Category Fields](./FIELD_MAPPING.md#category-fields) |

---

## Troubleshooting

### No Highlighting Appears

**Check:**
1. Is `classname` field present on athlete? → Must be in Group Athletes
2. Is `className` field present on attempt? → Must be in Group Athletes
3. Is athlete in current group? → Check `inCurrentGroup` flag
4. Are CSS classes applied? → Check browser dev tools

**Debug:**
```javascript
console.log('Athlete:', athlete.fullName);
console.log('classname:', athlete.classname);           // Should be "current" or "next"
console.log('Attempt className:', athlete.sattempts[0]?.className);  // Should be " current blink"
```

### Wrong Team Members Shown

**Check:**
1. Are you merging Group + Database? → See merging strategy
2. Is lotNumber conversion correct? → String vs Number
3. Are duplicates filtered? → Check Set membership

**Debug:**
```javascript
console.log('Group lot numbers:', currentGroupLotNumbers);
console.log('Database athlete lot:', String(dbAthlete.lotNumber));
console.log('Is in group?', currentGroupLotNumbers.has(String(dbAthlete.lotNumber)));
```

### Category Names Missing

**Problem:** Category shows as ID number instead of name

**Check:**
1. Are you using the correct field?
   - Group Athletes: Use `category` field (has "M 79")
   - Database Athletes: Use `categoryName` field (has "M 79")
2. Both sources now have formatted names - no lookup needed!

**Debug:**
```javascript
// Group Athlete
console.log('Group category:', groupAthlete.category);  // "M 79"

// Database Athlete
console.log('Database categoryName:', dbAthlete.categoryName);  // "M 79"
console.log('Database category (legacy ID):', dbAthlete.category);  // 15 (don't use!)
```

---

## Version History

- **2025-10-09:** Comprehensive field mapping documentation created
  - Consolidated into single FIELD_MAPPING.md with embedded samples
  - Removed FIELD_MAPPING_VISUAL.md (ASCII alignment issues)
  - Updated to reflect categoryName now in Database Athletes
  - Clarified Group Athletes use `category` field, Database uses `categoryName`
  - Documented transformation only needed for Database-only athletes
  - Added real OWLCMS sample data examples

---

## Related Files

**Documentation:**
- [FIELD_MAPPING.md](./FIELD_MAPPING.md) - Complete field reference with samples
- [SCOREBOARD_ARCHITECTURE.md](./SCOREBOARD_ARCHITECTURE.md) - Overall system design
- [CACHING_IMPLEMENTATION.md](./CACHING_IMPLEMENTATION.md) - Performance optimization

**Source Code:**
- `src/lib/server/competition-hub.js` - Stores OWLCMS data
- `src/plugins/team-scoreboard/helpers.data.js` - Example: Merges and processes data
- `src/plugins/team-scoreboard/page.svelte` - Example: Displays data with highlighting

**Sample Data:**
- `samples/2025-10-*-DATABASE-*.json` - Database endpoint samples
- `samples/2025-10-*-UPDATE-*.json` - Update endpoint samples with groupAthletes

**Tests:**
- `test-sample-data.sh` - Script to send sample data to hub
