# Using Logos in Scoreboards

## Overview

Once OWLCMS sends the `logos_zip` binary frame, all logo files are extracted to `/local/logos/` and are immediately available to all scoreboards.

## File Access

### From Svelte Components (page.svelte)

```svelte
<script>
  export let data = {};
</script>

<div class="team-row">
  <img 
    src="/local/logos/{data.logoFileName}" 
    alt="{data.teamName} Logo"
    class="logo"
  />
  <span>{data.teamName}</span>
</div>

<style>
  .logo {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }
</style>
```

### From Helpers (helpers.data.js)

If you need to compute logo paths in server-side processing:

```javascript
export function getScoreboardData(fopName = 'A', options = {}) {
  const { competitionHub } = await import('./competition-hub.js');
  const fopUpdate = competitionHub.getFopUpdate(fopName);
  const databaseState = competitionHub.getDatabaseState();
  
  // Process athletes with logo paths
  const athletes = (fopUpdate?.groupAthletes || []).map(athlete => ({
    ...athlete,
    // Compute logo path based on team name
    logoPath: `/local/logos/${athlete.teamName}.png`,
    // Or use team ID if logos are named by ID
    logoPath: `/local/logos/${athlete.teamId}.png`
  }));
  
  return { athletes };
}
```

## Common Patterns

### 1. Team Logo with Fallback

```svelte
<img 
  src="/local/logos/{teamName}.png" 
  alt="{teamName}"
  onerror="this.src='/static/default-team-logo.png'"
/>
```

### 2. Logo Gallery

```svelte
<div class="logo-gallery">
  {#each teams as team}
    <div class="team-card">
      <img src="/local/logos/{team.name}.png" alt="{team.name}" />
      <h3>{team.name}</h3>
    </div>
  {/each}
</div>

<style>
  .logo-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }
  
  .team-card {
    text-align: center;
  }
  
  img {
    max-width: 100%;
    height: auto;
  }
</style>
```

### 3. Logo as Team Identifier

In lifting-order style scoreboards:

```svelte
<div class="team-header">
  <img src="/local/logos/{currentAthlete.teamName}.png" class="team-logo" />
  <span class="team-name">{currentAthlete.teamName}</span>
</div>

<style>
  .team-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .team-logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }
</style>
```

### 4. Responsive Logo Sizing

```svelte
<picture>
  <!-- High resolution for desktop -->
  <source media="(min-width: 800px)" srcset="/local/logos/{team}.png 2x" />
  <!-- Standard resolution for mobile -->
  <img src="/local/logos/{team}.png" alt="{team} Logo" />
</picture>
```

## Logo Naming Conventions

### Option 1: Team Name (Recommended)
```
local/logos/
  ├── USA Weightlifting.png
  ├── CAN Weightlifting.png
  ├── Brazil Weightlifting.png
  └── Australia Weightlifting.png
```

Usage:
```html
<img src="/local/logos/{athlete.teamName}.png" />
```

### Option 2: Country Code
```
local/logos/
  ├── USA.png
  ├── CAN.png
  ├── BRA.png
  └── AUS.png
```

Usage:
```html
<img src="/local/logos/{athlete.countryCode}.png" />
```

### Option 3: Team ID
```
local/logos/
  ├── 123.png
  ├── 456.png
  ├── 789.png
  └── 101.png
```

Usage:
```html
<img src="/local/logos/{athlete.teamId}.png" />
```

## Logging and Diagnostics

### Check What Logos Were Received

View server logs:
```
[LOGOS] ✓ Extracted 42 logo files in 45ms
[LOGOS] First 10 logos from this message:
  1. USA Weightlifting.png
  2. CAN Weightlifting.png
  3. Brazil Weightlifting.png
  ...
```

### Verify Files on Disk

```bash
# From tracker root directory
ls -la local/logos/

# Should show:
# total 1234
# -rw-r--r--  1 user  group    45678 Dec 24 10:30 USA Weightlifting.png
# -rw-r--r--  1 user  group    23456 Dec 24 10:30 CAN Weightlifting.png
# ...
```

### Test in Browser

Open DevTools Console and test:

```javascript
// Check if logo loads
fetch('/local/logos/USA%20Weightlifting.png')
  .then(r => r.ok ? 'OK' : 'NOT FOUND')
  .then(console.log);

// Or directly in an image tag
document.createElement('img').src = '/local/logos/USA%20Weightlifting.png';
```

## Performance Considerations

### 1. Image Caching

```svelte
<img 
  src="/local/logos/{teamName}.png?v={timestamp}" 
  alt="{teamName}"
/>
```

### 2. Lazy Loading

```svelte
<img 
  src="/local/logos/{teamName}.png" 
  alt="{teamName}"
  loading="lazy"
/>
```

### 3. Preloading

In `+page.svelte` data function:

```javascript
// Preload logos that will be displayed
export const load = async ({ data }) => {
  return {
    ...data,
    preloadLogos: data.teams.map(t => `/local/logos/${t.name}.png`)
  };
};
```

## Troubleshooting

### Logo Not Displaying

1. **Check filename**: Must exactly match how OWLCMS created the ZIP
   - Look at server logs for exact filenames
   - Check `local/logos/` directory contents
   - File names are case-sensitive on Linux/Mac

2. **Check URL encoding**:
   - Spaces in names must be encoded: `USA%20Weightlifting.png`
   - Or use a naming convention without spaces: `USA-Weightlifting.png`

3. **Check Content-Type**:
   - Browser DevTools → Network tab
   - Should show `Content-Type: image/png` (or appropriate format)

4. **Check CORS**:
   - `/local/logos/` is served from same origin, so no CORS issues
   - But firewall rules might block access

### 404 Not Found

1. Verify logos_zip was received:
   - Check server logs for `[LOGOS] ✓ Extracted` message
   - If missing, check 428 Precondition Required response

2. Check file exists:
   ```bash
   ls -la local/logos/MyTeam.png
   ```

3. Check path in HTML is correct:
   ```html
   <!-- ❌ Wrong -->
   <img src="local/logos/USA.png" />
   
   <!-- ✅ Correct -->
   <img src="/local/logos/USA.png" />
   ```

## Examples by Scoreboard Type

### Lifting Order Scoreboard

```svelte
<div class="current-athlete">
  <img src="/local/logos/{currentAthlete.teamName}.png" class="logo" />
  <div class="athlete-info">
    <h2>{currentAthlete.fullName}</h2>
    <p>{currentAthlete.teamName}</p>
  </div>
</div>
```

### Team Rankings Scoreboard

```svelte
{#each teams as team, idx}
  <tr class="rank-{idx + 1}">
    <td class="logo-cell">
      <img src="/local/logos/{team.name}.png" alt="{team.name}" />
    </td>
    <td>{team.name}</td>
    <td>{team.totalScore}</td>
  </tr>
{/each}
```

### Results Board with Logos

```svelte
<div class="result-row">
  <img src="/local/logos/{athlete.teamName}.png" class="mini-logo" />
  <span>{athlete.fullName}</span>
  <span class="total">{athlete.total}</span>
</div>

<style>
  .mini-logo {
    width: 30px;
    height: 30px;
    object-fit: contain;
  }
</style>
```

## File Formats Supported

OWLCMS tracker supports any image format:
- ✅ PNG (recommended)
- ✅ JPG/JPEG
- ✅ SVG (best for scalability)
- ✅ WebP
- ✅ GIF

SVG is recommended for best scaling at any size:

```html
<img src="/local/logos/USA.svg" alt="USA" />
```

## See Also

- [LOGOS_ZIP_IMPLEMENTATION.md](./LOGOS_ZIP_IMPLEMENTATION.md) - Implementation guide
- [WEBSOCKET_MESSAGE_SPEC.md](./docs/WEBSOCKET_MESSAGE_SPEC.md) - Binary message format
- [SCOREBOARD_ARCHITECTURE.md](./docs/SCOREBOARD_ARCHITECTURE.md) - Plugin development
