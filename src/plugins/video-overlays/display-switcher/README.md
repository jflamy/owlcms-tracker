<!-- markdownlint-disable -->
# Display Switcher Plugin

Controls a fullscreen display that switches between OWLCMS Vaadin pages and video content based on competition events.

## Quick Start

### 1. Start the Tracker

```bash
npm run dev
```

### 2. Configure OWLCMS

Set the WebSocket URL in OWLCMS:
**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://localhost:8096/ws`

### 3. Open the Display

On the big screen (display output):
```
http://localhost:8096/display-switcher?fop=A
```

### 4. Open the Control Panel

On the operator's computer:
```
http://localhost:8096/display-switcher?fop=A&mode=control
```

## Usage

### Display Mode (Default)

```
/display-switcher?fop=A
/display-switcher?fop=A&mode=display
```

Opens a fullscreen display that:
- Shows OWLCMS scoreboard via proxied iframe
- Automatically switches to videos on lift decisions
- Shows replay videos after lift videos
- Returns to scoreboard when timer starts

**Tip:** Use F11 to go fullscreen in the browser.

### Control Mode

```
/display-switcher?fop=A&mode=control
```

Operator interface with:
- **Pause/Resume automation** - Stop automatic switching for manual control
- **Manual iframe** - Show any OWLCMS page (e.g., medals ceremony)
- **Manual video** - Play any video URL
- **Configuration** - Set video URLs and durations
- **Status display** - See current state and connection status

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `scoreboardPage` | `/display/scoreboard` | OWLCMS scoreboard page path |
| `replayUrl` | (empty) | URL of replay video server |
| `goodLiftVideo` | (empty) | Video URL for good lifts |
| `badLiftVideo` | (empty) | Video URL for bad lifts |
| `goodLiftDuration` | 5 | Seconds to show good lift video |
| `badLiftDuration` | 5 | Seconds to show bad lift video |
| `replayDuration` | 10 | Seconds to show replay |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OWLCMS_URL` | `http://localhost:8080` | OWLCMS server URL for proxy |

## Common Scenarios

### Basic Setup (Scoreboard Only)

Just open the display URL - it will show the OWLCMS scoreboard:
```
/display-switcher?fop=A
```

### With Lift Celebration Videos

1. Open control panel: `/display-switcher?fop=A&mode=control`
2. Set "Good Lift Video" to your celebration video URL
3. Set "Bad Lift Video" to your encouragement video URL
4. Click "Save Configuration"

### With Replay Server

1. Open control panel
2. Set "Replay URL" to your replay server (e.g., `http://192.168.1.50:8080/replay`)
3. Save configuration

Flow: Decision → Lift video → Replay → Scoreboard

### Manual Medal Ceremony

1. Open control panel
2. Click "Pause Automation"
3. Enter `/proxy/display/medals?fop=A` in iframe URL
4. Click "Show"
5. After ceremony, click "Resume Automation"

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation including:
- Component overview and data flow
- State machine transitions
- SSE communication protocol
- API endpoints
- Proxy configuration

## Troubleshooting

### Display shows "Waiting for content..."

- Check OWLCMS WebSocket URL configuration
- Verify tracker is receiving data (check terminal output)
- Try refreshing the page

### Videos don't play

- Check video URLs are accessible from the display browser
- Ensure video format is supported (MP4 H.264 recommended)
- Check browser console for errors

### Iframe shows blank or error

- Check OWLCMS is running and accessible
- Verify `OWLCMS_URL` environment variable is correct
- Check proxy is working: try `/proxy/` directly

### Control panel not updating

- Check SSE connection (status should show "Connected")
- Try clicking "Refresh State"
- Check browser console for errors
```
