# OWLCMS Tracker Release Notes

## What's New

- Initial release

### Bug Fixes
- alpha01: flatten the zip structure so the script is at top level

### Breaking Changes
- List any breaking changes (if applicable)

## Installing Locally

Extract the ZIP file appropriate for your operating system:

- **Windows**: `owlcms-tracker-windows_*.zip` - Double-click `tracker.bat` to run
- **macOS (M-series/Apple Silicon)**: `owlcms-tracker-macos-arm64_*.zip` - Run `./tracker.sh`
- **macOS (Intel)**: `owlcms-tracker-macos-x64_*.zip` - Run `./tracker.sh`
- **Raspberry Pi**: `owlcms-tracker-rpi_*.zip` - Run `./tracker-rpi.sh`

All distributions include Node.js, so no additional installation is needed.

### Docker Installation

Alternatively, run the tracker in Docker

```bash
docker run -d \
  --name owlcms-tracker \
  -p 8096:8096 \
  docker.io/owlcms/tracker:latest
```

Then access the tracker at: `http://localhost:8096`

**Note:** Use `latest` for the newest release. You can also use a specific release number such as `2.0.0-beta01` if needed.

## OWLCMS Configuration

Configure OWLCMS to send data to the tracker:

**In OWLCMS:** Prepare Competition → Language and System Settings → Connections → URL for Video Data

Set to: `ws://localhost:8096/ws` (or your tracker host)

## Support

For issues and questions, visit: https://github.com/owlcms/owlcms-tracker
