# Ranking Box - Lower-Third Scoreboard

## Overview

A lower-third overlay scoreboard that displays animated ranking information in a styled SVG box positioned in the lower left corner. Perfect for broadcast displays showing current lifting session rankings.

## Features

- **SVG-Based Display** - Scalable vector graphics for crisp rendering at any resolution
- **Rounded Corner Box** - Modern design with rounded corners and semi-transparent background
- **Animated Paging** - Automatically cycles through athletes at configurable intervals
- **Session Display** - Shows current lifting session name in the box
- **Athlete Rankings** - Displays ranked athletes with their total scores

## Current Display

The SVG box shows:
- Session name (top center)
- Current athlete name (center)
- Total score (bottom center)

Text is automatically animated when transitioning between athletes.

## Configuration

### Options

- **pageInterval** (number, default: 5)
  - Time in seconds between page transitions
  - Range: 2-30 seconds
  - Controls how long each athlete is displayed before advancing

## Data Flow

1. **Receives data from FOP** via URL parameter: `?fop=Platform_A`
2. **Processes athlete data** from current lifting session
3. **Sorts by total** (highest to lowest)
4. **Cycles through athletes** automatically with configured interval
5. **Updates display** with smooth animations

## Customization Guide

### To modify the SVG box appearance:

Edit `page.svelte` - Look for the `<svg>` element:

```svelte
<rect
  x="10"
  y="10"
  width={boxWidth - 20}
  height={boxHeight - 20}
  rx={cornerRadius}
  ry={cornerRadius}
  fill="#1a1a2e"
  fill-opacity="0.95"
  stroke="#667eea"
  stroke-width="2"
/>
```

**Properties you can change:**
- `fill` - Background color
- `fill-opacity` - Transparency (0-1)
- `stroke` - Border color
- `stroke-width` - Border thickness
- `rx`, `ry` - Corner radius size

### To modify text layout:

Edit `page.svelte` - Modify `<text>` elements:

```svelte
<text
  x={boxWidth / 2}
  y={boxHeight / 2 + 20}
  text-anchor="middle"
  dominant-baseline="middle"
  class="athlete-text"
>
  {currentAthlete.fullName}
</text>
```

**Properties you can change:**
- `x`, `y` - Position in SVG coordinates
- `class` - CSS class for styling (font-size, color, font-weight, etc.)
- Content - What text is displayed

### To add more information:

Add new `<text>` elements in the SVG or modify `helpers.data.js` to extract additional fields:

```javascript
// In helpers.data.js, add fields to the athlete object
athletes = athletes.map(a => ({
	...a,
	snatchRank: getSnatchRank(a),
	cjRank: getCJRank(a),
	// ... etc
}));
```

Then display in page.svelte:
```svelte
<text x="..." y="...">
	Snatch: {currentAthlete.snatchRank}
</text>
```

### To change animation style:

Edit `page.svelte` - Modify keyframes:

```css
@keyframes slideIn {
	from {
		opacity: 0;
		transform: translateX(-20px);
	}
	to {
		opacity: 1;
		transform: translateX(0);
	}
}
```

Or change the animation in the `.ranking-box` class:
```css
.ranking-box {
	animation: slideIn 0.3s ease-out;
}
```

## File Structure

- `config.js` - Scoreboard metadata and options
- `helpers.data.js` - Data processing and athlete sorting
- `page.svelte` - SVG display and paging logic
- `README.md` - This file

## Usage

Open in browser:
```
http://localhost:8096/ranking-box?fop=Platform_A&pageInterval=5
```

**URL Parameters:**
- `fop` (required) - FOP name (e.g., Platform_A, B, C)
- `pageInterval` (optional) - Seconds between transitions (default: 5)

### On a Broadcast Screen

Set up OBS or similar software:
1. Add Browser source
2. Set URL to: `http://localhost:8096/ranking-box?fop=Platform_A`
3. Set resolution to match screen (e.g., 1920×1080)
4. Position over lower-left area of broadcast
5. Use transparency to show video underneath

## AI Assistant Prompts

To request modifications, you can say:

> "Add more athlete information: rank, category, best snatch, best clean & jerk"

> "Change the box to appear on the lower right instead of lower left"

> "Make the text larger and add a glowing effect around the box"

> "Create multiple boxes showing different filtered views (e.g., top 3 by Sinclair)"

> "Add page indicators (e.g., '2 of 15') to show current position in list"

> "Change the color scheme to match our broadcast branding"

## Technical Details

- **SVG Scaling** - Uses `preserveAspectRatio="xMinYMax"` to keep box in lower-left
- **Fixed Layout** - SVG is positioned fixed on screen, doesn't interfere with main scoreboard
- **Responsive** - SVG scales based on container size
- **Performance** - Minimal CPU usage due to static SVG elements and simple animations

## Future Enhancements

Possible additions based on user needs:

- [ ] Multiple box layouts (side-by-side for comparison)
- [ ] Conditional filtering (show only certain categories)
- [ ] Custom styling per competition
- [ ] Decision/timer indicator integration
- [ ] Graphics/images in boxes (team logos, athlete photos)
- [ ] Database athlete fallback (when session data unavailable)
- [ ] Team-based grouping instead of individual rankings
