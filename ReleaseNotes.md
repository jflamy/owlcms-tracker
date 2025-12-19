# OWLCMS Tracker Release Notes

## What's New

- Release Candidate
- The team scoreboard now supports Sinclair, SMHF, Q-Points, Q-Masters, GAMX, GAMX-M, GAMX-A and GAMX-U
- There is now an attempt-board screen emulating the OWLCMS one.
- The zip distributions will open the default browser on the screen running tracker.

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

Configure OWLCMS to send data to the tracker:

**In OWLCMS:** Prepare Competition → Language and System Settings → Connections → URL for Video Data

Set to: `ws://localhost:8096/ws` (or your tracker host)

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

3. **Run the tracker:**
   ```bash
   npm run dev
   ```

The tracker will be available at: `http://localhost:8096`

## Support

For issues and questions, visit: https://github.com/owlcms/owlcms-tracker
