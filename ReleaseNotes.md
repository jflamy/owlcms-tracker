# OWLCMS Tracker Release Notes

## New in Release 2.4
- 2.4.1: fix flags and pictures handling
- Internal change: Now built using the tracker-core module

## New in Release 2.3.3
- Team Points support in iwf-results plugin
- Database is always sent in compressed format. Learning mode uncompresses the samples.
- Fixed Raspberry Pi build to use 64-bit version of Node.js
- Removed old behavior related to clicking on the header of the team scoreboard.

## New in Release 2.2.0

- Requires owlcms pre-release version 64.0.0-rc04 or newer
- Initial handshake improved so owlcms-tracker can process plugins that don't require a running session
- IWF-style result book available when running from source (protocol updated to 2.2.0)

## New in Release 2.1.0

- The team scoreboard now supports Sinclair, SMHF, Q-Points, Q-Masters, GAMX, GAMX-M, GAMX-A and GAMX-U
- There is now an attempt-board screen emulating the OWLCMS one.
- The local packaging (zip distributions) will open the default browser when started.
- Responsive versions of the scoreboards.  The standard scoreboards also work in portrait mode.

## Installing Locally

Extract the ZIP file appropriate for your operating system:

- **Windows**: `owlcms-tracker-windows_*.zip` - Double-click `tracker.bat` to run
- **macOS (M-series/Apple Silicon)**: `owlcms-tracker-macos-arm64_*.zip` - Run `./tracker.sh`
- **macOS (Intel)**: `owlcms-tracker-macos-x64_*.zip` - Run `./tracker.sh`
- **Raspberry Pi**: `owlcms-tracker-rpi_*.zip` - Run `./tracker-rpi.sh`

All distributions include Node.js, so no additional installation is needed.
You may also use [Docker](#docker-installation) to run the tracker with the standard plugins.
The ZIP and Docker distributions contain the standard widely-used plugins for individual and team scoreboards.

To access experimental or additional example plugins, see [Installing from Source](#installing-from-source).

## OWLCMS Configuration

**Before using this tracker**, you must configure OWLCMS to send data via WebSocket:

**In OWLCMS:** Prepare Competition → Language and System Settings → Connections → URL for Video Data

Set to: `ws://localhost:8096/ws` (or `wss://your-tracker-host:8096/ws` for secure connections)

**That's it!** No code changes to OWLCMS needed - just this URL setting.

## Docker Installation

Alternatively, run the tracker in Docker:

```bash
docker run -d \
  --name owlcms-tracker \
  -p 8096:8096 \
  docker.io/owlcms/tracker:latest
```

Then access the tracker at: `http://localhost:8096`

**Note:** Use `latest` for the newest release. You can also use a specific release number such as `2.0.0-beta01` if needed.

## Installing from Source

To run the tracker from source code (for development or to access experimental plugins):

1. **Clone the repository:**
   ```bash
   git clone https://github.com/owlcms/owlcms-tracker.git
   cd owlcms-tracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
   *Note: This project uses `@owlcms/tracker-core`. If you need to install it manually:*
   ```bash
   npm install github:owlcms/tracker-core
   ```

3. **Run the tracker:**
   ```bash
   npm run dev
   ```

The tracker will be available at: `http://localhost:8096`

## Support

For issues and questions, visit: https://github.com/jflamy/owlcms-tracker/issues
