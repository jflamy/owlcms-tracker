# Ranking Box - Modality Options Guide

The ranking-box scoreboard now supports three different display modalities for showing athlete performance data.

## URL Parameters

Access the scoreboard with the modality option:

```
http://localhost:8096/ranking-box?fop=Platform_A&modality=snatch
http://localhost:8096/ranking-box?fop=Platform_A&modality=cj
http://localhost:8096/ranking-box?fop=Platform_A&modality=total
```

## Modality Modes

### 1. **Snatch** (`modality=snatch`)
Displays the three snatch attempts plus the best snatch result.

**Columns:**
- Rank (green box)
- Flag (country flag image)
- Country Code (3-letter code)
- Athlete Name
- **Attempt 1** (red/green/white box based on result)
- **Attempt 2** (red/green/white box based on result)
- **Attempt 3** (red/green/white box based on result)
- **Best Snatch** (green box for successful lift)

**Example:**
```
1 | 🇸🇦 | KSA | Ahmed Ali          | 00 | 00 | 00 | 145
2 | 🇮🇷 | IRN | Mohammad Nasiri    | 10 | 10 | 10 | 148
3 | 🇪🇬 | EGY | Hassan El-Shafei   | 20 | 20 | 20 | 152
```

### 2. **Clean & Jerk** (`modality=cj`)
Displays the three clean & jerk attempts plus the best C&J result.

**Columns:**
- Rank (green box)
- Flag (country flag image)
- Country Code (3-letter code)
- Athlete Name
- **Attempt 1** (red/green/white box based on result)
- **Attempt 2** (red/green/white box based on result)
- **Attempt 3** (red/green/white box based on result)
- **Best C&J** (green box for successful lift)

### 3. **Total** (`modality=total`) - Default
Displays best snatch, best clean & jerk, and total in three columns.

**Columns:**
- Rank (green box)
- Flag (country flag image)
- Country Code (3-letter code)
- Athlete Name
- **Best Snatch** (green box for successful lift)
- **Best C&J** (green box for successful lift)
- **Total** (green box if total > 0)

**Example:**
```
1 | 🇸🇦 | KSA | Ahmed Ali          | 145 | 180 | 325
2 | 🇮🇷 | IRN | Mohammad Nasiri    | 148 | 185 | 333
3 | 🇪🇬 | EGY | Hassan El-Shafei   | 152 | 188 | 340
```

## Score Box Colors

Each score box has three possible states:

### ⚪ **Successful Lift** (White)
- Status: Successful lift recorded
- Background: White (#FFFFFF)
- Text: Dark (#0F1419)
- Shows the weight successfully lifted

### 🔴 **Failed Lift** (Red)
- Status: Lift attempt failed
- Background: Red (#F44336)
- Text: White
- Shows the attempted weight

### ⭕ **Not Lifted Yet** (Transparent)
- Status: No attempt yet
- Background: Transparent
- Border: Light gray outline (rgba(255, 255, 255, 0.3))
- Text: White
- Shows "--" or empty space

## Page Cycling

The scoreboard automatically cycles through pages:
- **8 athletes per page** (matches StandingResults template)
- **Page interval**: Default 5 seconds (configurable via `pageInterval` URL parameter)
- Smooth animated transitions with staggered reveals

**Example with page interval:**
```
http://localhost:8096/ranking-box?fop=Platform_A&modality=snatch&pageInterval=3
```

## Display Order

Athletes are **always sorted by total score in descending order** (highest to lowest), regardless of modality. This ensures consistency across all display modes.

## Integration Notes

- All data comes from the competition hub via OWLCMS WebSocket
- Athletes are filtered to show only those with valid name and total
- Country codes are extracted from the athlete's team name (first word or first 3 characters)
- Flag images are resolved from the `local/flags/` directory
- The scoreboard is autonomous and self-contained within the `ranking-box` plugin

## Configuration

Edit `src/plugins/ranking-box/config.js` to add additional modality options or change defaults:

```javascript
{
  key: 'modality',
  label: 'Display Mode',
  type: 'select',
  options: ['snatch', 'cj', 'total'],  // Add/remove modalities here
  default: 'total',
  description: 'Choose which lifts to display'
}
```
