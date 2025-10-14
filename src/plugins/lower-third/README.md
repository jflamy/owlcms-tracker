# Lower Third - Minimal Status Overlay

A transparent overlay scoreboard designed for live video streaming. Shows minimal information in the lower corner of the screen.

## Features

- **Transparent Background** - Semi-transparent cards with blur effect for professional overlay look
- **Current Athlete** - Name, team, requested weight, and lift type
- **Countdown Timer** - Only displayed when running (hidden when stopped)
- **Decision Lights** - Replaces timer when decisions are visible
- **Session-Aware** - Automatically hides when session is complete
- **Click-Through** - Overlay doesn't block mouse clicks on underlying content

## Usage

### Basic URL
```
http://localhost:8096/lower-third?fop=Platform_A
```

### URL Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fop` | string | `A` | Field of play name (required) |
| `position` | string | `bottom-right` | Overlay position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `fontSize` | string | `medium` | Text size: `small`, `medium`, `large` |

### Examples

**Bottom right corner (default):**
```
http://localhost:8096/lower-third?fop=Platform_A
```

**Bottom left corner:**
```
http://localhost:8096/lower-third?fop=Platform_A&position=bottom-left
```

**Large text for 4K displays:**
```
http://localhost:8096/lower-third?fop=Platform_A&fontSize=large
```

**Top right corner with small text:**
```
http://localhost:8096/lower-third?fop=Platform_A&position=top-right&fontSize=small
```

## Display States

### 1. Athlete Announced
Shows when athlete is called to the platform:
- **Athlete Card**: Name, team, requested weight, lift type
- Always visible when athlete is active

### 2. Timer Running
Replaces decision card with countdown:
- **Timer Card**: Large countdown display (MM:SS)
- Turns red and pulses when ≤30 seconds remain
- Automatically hides when timer stops

### 3. Decision Visible
Replaces timer card with referee lights:
- **Decision Card**: Three circular lights for referee decisions
- Green = Good lift
- Red = No lift
- Gray = Not decided yet
- Automatically shows when OWLCMS displays decision

### 4. Between Lifts
Only athlete card visible:
- Timer hidden (not running)
- Decision hidden (not visible)

## OBS Studio Integration

### Adding as Browser Source

1. **Add Browser Source**
   - Right-click in Sources → Add → Browser
   - Name: "OWLCMS Lower Third"

2. **Configure**
   - URL: `http://localhost:8096/lower-third?fop=Platform_A`
   - Width: `1920` (match your canvas)
   - Height: `1080` (match your canvas)
   - FPS: `30`
   - ✅ Check "Shutdown source when not visible"
   - ✅ Check "Refresh browser when scene becomes active"

3. **Position**
   - The overlay positions itself based on `position` parameter
   - You can also manually position in OBS if needed

### Multiple FOPs

Add separate browser sources for each platform:
```
Platform A: http://localhost:8096/lower-third?fop=Platform_A
Platform B: http://localhost:8096/lower-third?fop=Platform_B
Platform C: http://localhost:8096/lower-third?fop=Platform_C
```

## Styling

The overlay uses semi-transparent black cards with white text:
- **Background**: `rgba(0, 0, 0, 0.85)` with blur effect
- **Text**: White with shadow for readability
- **Border**: Subtle white border for definition
- **Weight**: Highlighted in yellow/gold
- **Warning State**: Red background with pulse animation

## Data Sources

All data comes from OWLCMS via WebSocket:
- **Athlete Info**: From `type="update"` messages (fullName, teamName, weight, attemptNumber)
- **Timer**: From `type="timer"` messages (athleteTimerEventType, athleteMillisRemaining)
- **Decisions**: From `type="decision"` messages (d1, d2, d3, decisionsVisible)

## Architecture

```
OWLCMS → WebSocket → Competition Hub
                          ↓
                    helpers.data.js (server-side processing)
                          ↓
                    page.svelte (display only)
                          ↓
                    Browser/OBS overlay
```

### Server-Side (helpers.data.js)
- Extracts current athlete info
- Cleans HTML entities (– and — for proper display)
- Detects timer running state
- Detects decision visibility
- Returns minimal data structure

### Client-Side (page.svelte)
- Autonomous timer countdown using shared timer-logic
- Conditional rendering based on state
- Position and font size styling
- Decision light colors

## Troubleshooting

### Overlay not showing
1. Check FOP parameter matches OWLCMS platform name
2. Verify competition hub has data: Check other scoreboards
3. Check browser console for errors

### Timer not counting down
1. Verify OWLCMS is sending timer events
2. Check timer state in browser console: `timerState`
3. Ensure timer-logic.js is working (check other scoreboards)

### Decision lights not showing
1. OWLCMS must have `decisionsVisible=true` in decision message
2. Check decision state: Should have `visible: true`
3. Verify all three referee decisions are being received

### Overlay blocks clicks in OBS
1. This shouldn't happen (CSS has `pointer-events: none`)
2. If it does, check OBS browser source interaction settings

## Performance

- **Lightweight**: Only renders visible components
- **No SSE polling**: Uses shared timer-logic for autonomous countdown
- **Minimal DOM**: Maximum 3 cards on screen at once
- **Efficient**: Hidden cards are completely removed from DOM

## Future Enhancements

- [ ] Custom color themes
- [ ] Team logo display
- [ ] Athlete photo overlay
- [ ] Record attempt indicator (national/world record)
- [ ] Competition name display option
- [ ] Custom CSS via URL parameter
