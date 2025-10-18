# Translation Locale Fallback Mechanism

## Overview

The translation caching system implements a locale fallback mechanism similar to Java's `ResourceBundle`, where regional locale variants (e.g., `fr-CA`) automatically inherit keys from their base locale (e.g., `fr`).

## How It Works

### Scenario: Regional Variant Cached First

When OWLCMS sends translations with regional variants:

```javascript
// OWLCMS sends all 26 locales
{
  "type": "translations",
  "payload": {
    "en": { "Start": "Start", ... (100 keys) },
    "fr": { "Start": "Commencer", ... (1300 keys) },
    "fr-CA": { "Start": "Démarrer", ... (10 region-specific keys) },
    "es": { "Start": "Comenzar", ... (1200 keys) },
    "es-AR": { "Start": "Empezar", ... (5 region-specific keys) },
    // ... 21 more locales
  }
}
```

### Processing Order in Hub

**Example: fr-CA is processed before fr**

1. **fr-CA arrives (10 keys)**
   - Hub checks: Is there a base locale `fr`? No.
   - Result: fr-CA cached with just 10 keys
   - Console: `📚 Cached translations for locale 'fr-CA' (10 keys)`

2. **fr arrives (1300 keys)**
   - Hub checks: Is this a base locale? Yes.
   - Hub updates all `fr-*` variants: `fr-CA`, `fr-BE`, etc.
   - fr-CA is updated: `{ ...1300 fr keys, ...10 fr-CA keys }`
   - fr-CA now has: **1310 keys** (1300 from fr + 10 regional overrides)
   - Console:
     ```
     📚 Cached translations for locale 'fr' (1300 keys)
     📚 Updated regional variant 'fr-CA' with base locale 'fr' keys: 10 → 1310 keys
     ```

### Client-Side Behavior

When browser requests `fr-CA`:

```javascript
// Browser SSE connection: /api/client-stream?lang=fr-CA
// Server responds with: fr-CA (1310 keys)
// Client-side lookup in fr-CA:
const value = $translations['fr-CA']['Clean_and_Jerk']; // Found! (from fr base)
const value = $translations['fr-CA']['Regional_Key'];   // Found! (from fr-CA override)
```

**Result:** No runtime fallback needed. Browser always gets complete locale map.

## Implementation Details

### Step 1: Extract Base Locale

```javascript
const baseLocale = locale.includes('-') ? locale.split('-')[0] : null;
// 'fr-CA' → 'fr'
// 'es-AR' → 'es'
// 'en'    → null (it's already a base locale)
```

### Step 2: Merge with Base (If Available)

**When caching regional variant:**

```javascript
if (baseLocale && this.translations[baseLocale]) {
  const baseTranslations = this.translations[baseLocale];
  mergedMap = { ...baseTranslations, ...translationMap };
  // Result: base keys + regional overrides
}
```

**Example:**
```javascript
// fr-CA (10 keys)
{ "Start": "Démarrer", "Stop": "Arrêter", ... }

// fr (1300 keys)
{ "Start": "Commencer", "Day": "Jour", "Month": "Mois", ... }

// Merged result (1310 keys)
{
  "Start": "Démarrer",      // ← Regional override
  "Stop": "Arrêter",        // ← Regional override
  "Day": "Jour",            // ← Base locale
  "Month": "Mois",          // ← Base locale
  // ... 1306 more keys
}
```

### Step 3: Update All Regional Variants (If Base Cached)

**When caching base locale after regional:**

```javascript
if (!baseLocale) {  // This IS a base locale
  const currentLocales = Object.keys(this.translations);
  for (const existingLocale of currentLocales) {
    if (existingLocale.startsWith(locale + '-')) {
      // This is 'fr-CA', 'fr-BE', etc.
      const updatedRegional = { ...translationMap, ...regionalTranslations };
      this.translations[existingLocale] = updatedRegional;
    }
  }
}
```

**Example:**
```
// Already cached: fr-CA (10 keys)
// New arrival: fr (1300 keys)
// Update: fr-CA from 10 keys → 1310 keys (1300 from fr + 10 regional)
```

## Supported Formats

The system supports both:

1. **Base Locales** (language code only)
   - `en`, `fr`, `es`, `de`, `it`, `pt`, `ja`, `zh`, `ru`, `ar`
   - 1000-1300+ keys each

2. **Regional Variants** (language-country code)
   - `en-US`, `en-GB`, `fr-CA`, `fr-BE`, `es-AR`, `es-MX`, etc.
   - 5-50 region-specific overrides per variant
   - Inherit from base locale automatically

## Console Output Examples

### Scenario 1: Regional Before Base

```
[Hub] 📚 Cached translations for locale 'fr-CA' (10 keys)
[Hub] 📚 Cached translations for locale 'fr' (1300 keys)
[Hub] 📚 Updated regional variant 'fr-CA' with base locale 'fr' keys: 10 → 1310 keys
```

### Scenario 2: Base Before Regional

```
[Hub] 📚 Cached translations for locale 'fr' (1300 keys)
[Hub] 📚 Locale fallback: Merging 'fr-CA' (10 keys) with 'fr' (1300 keys) → 1310 total keys
[Hub] 📚 Cached translations for locale 'fr-CA' (1310 keys)
```

### Scenario 3: Multiple Regional Variants

```
[Hub] 📚 Cached translations for locale 'fr' (1300 keys)
[Hub] 📚 Updated regional variant 'fr-CA' with base locale 'fr' keys: 10 → 1310 keys
[Hub] 📚 Updated regional variant 'fr-BE' with base locale 'fr' keys: 8 → 1308 keys
[Hub] 📚 Updated regional variant 'fr-CH' with base locale 'fr' keys: 12 → 1312 keys
```

## Browser Behavior

### Language Selection Flow

```
Browser: ?lang=fr-CA
    ↓
Client-Stream: Extract language parameter
    ↓
Hub: getTranslations('fr-CA')
    ↓
SSE Message: { locale: 'fr-CA', data: { 1310 keys } }
    ↓
Svelte Store: translations.setLocale('fr-CA', data)
    ↓
Components: $translations.fr_CA.key_name
```

### Fallback Chain (if requested locale missing)

1. **Exact match:** `fr-CA` → ✅ Use complete merged map (1310 keys)
2. **Base locale:** `fr` → ✅ Use base locale (1300 keys)
3. **Default:** `en` → ✅ Use English (100+ keys)
4. **Empty:** `{}` → Show missing key as-is

## Key Benefits

✅ **No Runtime Fallback Overhead** - All keys available on client immediately
✅ **Consistent Display** - Regional variants always have complete sets
✅ **Correct Precedence** - Regional keys override base keys
✅ **Automatic Updates** - If base locale added later, variants auto-update
✅ **Flexible Loading Order** - Works regardless of OWLCMS message ordering
✅ **Scalable** - Works with any number of regional variants
✅ **Transparent** - Browser code doesn't know about fallback mechanism

## Related Code

- **Implementation:** `src/lib/server/competition-hub.js` → `setTranslations()` method
- **Retrieval:** `src/lib/server/competition-hub.js` → `getTranslations()` method
- **Broadcasting:** `src/routes/api/client-stream/+server.js` → SSE endpoint
- **Client Store:** `src/lib/stores.js` → `createTranslationStore()`
- **Router:** `src/routes/[scoreboard]/+page.svelte` → Language parameter handling

## Testing

### Manual Test: Verify Fallback Merging

1. **Enable learning mode:** `npm run dev:learning`
2. **Check console logs for:**
   ```
   📚 Locale fallback: Merging 'fr-CA' (10 keys) with 'fr' (1300 keys) → 1310 total keys
   ```
3. **Verify in browser:**
   - Open: `http://localhost:8096/session-results?fop=A&lang=fr-CA`
   - All headers should display in French (Canadian or inherited from base)
   - Check DevTools → Network → client-stream (should show 1310+ keys for fr-CA)

### Programmatic Test

```javascript
// Simulate OWLCMS message with regional first
const mockTranslations = {
  'fr': { /* 1300 keys */ },
  'fr-CA': { /* 10 keys */ }
};

// Cache fr-CA first (10 keys only)
hub.setTranslations('fr-CA', mockTranslations['fr-CA']);

// Cache fr (1300 keys)
hub.setTranslations('fr', mockTranslations['fr']);

// Check result
const frCa = hub.getTranslations('fr-CA');
console.log(Object.keys(frCa).length); // Should be ~1310
```

## Future Enhancements

- **Fallback chain display:** Show which keys come from base vs regional
- **Partial caching:** Support receiving only new/changed keys per release
- **Dynamic locale loading:** Load additional locales on-demand
- **Cache statistics:** Report cache hit rates per locale
