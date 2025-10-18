# Translation 428 Precondition - What to Tell OWLCMS

## Quick Summary

OWLCMS needs to send a complete **translations** data payload (~1MB, compresses to 400KB) in response to a **428 Precondition Required** response with `"translations"` in the `missing` array.

## The 428 Flow

### 1. Tracker Requests Translations

When tracker first receives a WebSocket connection and translations cache is empty:

```json
{
  "status": 428,
  "message": "Precondition Required: Missing required data",
  "reason": "missing_preconditions",
  "missing": ["translations"]
}
```

### 2. OWLCMS Responds with Translations

OWLCMS should respond with a **single WebSocket message** containing all 26 locales:

```json
{
  "type": "translations",
  "payload": {
    "en": {
      "Start": "Start",
      "Name": "Name",
      ... (100+ keys)
    },
    "fr": {
      "Start": "Commencer",
      "Name": "Nom",
      ... (1300+ keys)
    },
    "fr-CA": {
      "Start": "Démarrer",
      ... (10-50 regional overrides)
    },
    "es": { ... },
    "es-AR": { ... },
    ... (19 more locales: de, it, pt, ja, zh, ru, ar, ko, tr, etc.)
    ... (and their regional variants)
  }
}
```

### 3. Tracker Caches All 26 Locales

Hub receives the message, parses all 26 locales, and stores them:
- `hub.translations['en']` = {1000+ keys}
- `hub.translations['fr']` = {1300+ keys}
- `hub.translations['fr-CA']` = {10 keys} → auto-merged with 'fr' → {1310 keys}
- etc.

**Auto-Fallback Merging:** Regional variants (fr-CA) automatically inherit all keys from base locale (fr). If fr-CA arrives first with 10 keys, and fr arrives later with 1300 keys, fr-CA is updated to have all 1310 keys.

### 4. Tracker Returns Success

```json
{
  "status": 200,
  "message": "Translations cached for 26 locales",
  "localesCount": 26,
  "totalKeys": 31500
}
```

## Key Requirements

### Message Format

| Field | Value | Notes |
|-------|-------|-------|
| `type` | `"translations"` | Literal string |
| `payload` | Object with 26 locales | Each locale maps string keys to display values |
| Locale format | `"language"` or `"language-country"` | E.g., `"en"`, `"fr-CA"`, `"es-AR"` |
| Size | ~1MB uncompressed, 400KB gzipped | WebSocket may compress automatically |

### Locale Codes (26 Total)

**Base Locales (10):**
- `en`, `fr`, `es`, `de`, `it`, `pt`, `ja`, `zh`, `ru`, `ar`

**Regional Variants (16):**
- `en-US`, `en-GB`, `en-AU`
- `fr-CA`, `fr-BE`, `fr-CH`
- `es-AR`, `es-MX`, `es-ES`
- `de-AT`, `de-CH`
- `pt-BR`
- `zh-Hans`, `zh-Hant`
- `ar-AE`
- `ja-JP`
- (Or any custom regional variants you support)

### Key Structure

Each locale should have translation keys with display values:

```javascript
{
  "Start": "Start",              // UI button labels
  "Stop": "Stop",
  "Name": "Name",                // Column headers
  "Team": "Team",
  "Category": "Category",
  "Snatch": "Snatch",
  "Clean_and_Jerk": "Clean & Jerk",
  "TOTAL": "Total",
  "Rank": "Rank",
  "Leaders": "Leaders:",
  "Birth": "Born",
  // ... plus all other UI strings
}
```

### Regional Variant Strategy

Regional variants only need to include keys that differ from the base locale:

```javascript
{
  "fr": {
    "Start": "Commencer",
    "Stop": "Arrêter",
    "Name": "Nom",
    // ... 1300 keys
  },
  "fr-CA": {
    "Start": "Démarrer",    // Canadian French spelling
    "Stop": "Arrêt",        // Canadian French variation
    // ... only 10 different keys
    // Tracker auto-merges: fr-CA gets all 1300 fr keys + 10 fr-CA overrides
  }
}
```

## Compression Hint

The payload is large (1MB uncompressed → 400KB compressed). You may want to:

1. **Enable WebSocket compression** - Most WebSocket servers support deflate compression
2. **Or compress in OWLCMS** - Send compressed payload and document that tracker should decompress
3. **Or split into multiple messages** - Send one locale per message (slower but simpler debugging)

Current tracker expects **uncompressed JSON** in the WebSocket message. If compressing, add that info to WebSocket spec.

## Next Steps for OWLCMS

### Implementation Checklist

- [ ] Create method to export all 26 locale translation maps
- [ ] Serialize each locale to JSON object
- [ ] Combine into single payload: `{ "en": {...}, "fr": {...}, "fr-CA": {...} }`
- [ ] Send as WebSocket message with `type: "translations"`
- [ ] Handle 200 OK response (tracker parsed successfully)
- [ ] (Optional) Implement WebSocket compression for payload size

### Testing

```bash
# Send test message manually
curl -X POST http://localhost:8096/api/scoreboard \
  -H "Content-Type: application/json" \
  -d '{"action": "list_fops"}'

# If get 428 with "translations", send translations message via WebSocket simulator
# Expected: 200 OK response
```

## Documentation Files

These files explain translations 428 in detail:

- `docs/WEBSOCKET_MESSAGE_SPEC.md` - WebSocket message format including translations type
- `docs/TRANSLATION_LOCALE_FALLBACK.md` - How regional variants merge with base locales
- `compliance/428_MISSING_PRECONDITIONS.md` - Complete 428 preconditions explanation

## Browser Impact

Once translations cached:

1. **SSE broadcasts translations** to each browser connecting with language parameter
   - URL: `http://localhost:8096/session-results?fop=A&lang=fr-CA`
   - Server sends only requested locale (fr-CA with 1310 merged keys)

2. **Svelte stores** update with translations
   - Components access: `$translations['fr-CA']['Start']` → "Démarrer"

3. **Auto-fallback** per browser
   - Requested: `fr-CA` → Gets 1310 keys (1300 fr + 10 fr-CA)
   - No key missing → No runtime fallback needed

4. **Multi-language support** out of box
   - Change URL lang parameter → SSE reconnects with new language
   - Complete translation map delivered instantly

---

**Summary:** Send all 26 locales in one `type="translations"` message. Tracker handles caching, per-browser delivery, and locale fallback automatically. 🎉
