# OWLCMS Tracker Release Notes

> #### ⚠ To use Tracker, you need to use version 64 of OWLCMS (see Installing Locally below)

## New in Release 2.6
- 2.6.2: Scoreboards and attempt boards now track the break and ceremony status same as OWLCMS
- Now uses a shared component for all attempt bars in all scoreboards
- When runnning locally, should be launched from control panel version 3.0 or later (see below)
- Node.js not included in packaging

## New in Release 2.5
- 2.5.5: Display protocol version mismatch between owlcms and tracker-core
- 2.5.3: Network usage for the remote scoreboars radically reduced, general performance
  - removed unneeded fields
  - activated gzip compression
  - removed callbacks to API when data was sent by SSE and not language sensitive
  - fixed caching key to remove unneeded calls to tracker-core hub
- When installed from source, demo applications for printing documents

## Installing Locally

- Install the latest version 3.0 of the (OWLCMS control-panel)[https://github.com/owlcms/owlcms-controlpanel/releases]
  - There will be a Tracker tab where you can click to install Tracker
  - This installs the normal plugins to support people watching remotely
    - To access experimental or additional example plugins, see [Installing from Source](#installing-from-source).

  - Also install the latest version 64 of OWLCMS (you may need to select it as a prerelease)


## OWLCMS Configuration

**Before using this tracker**, you must configure OWLCMS to send data via WebSocket:

- If you installed from the control panel, there is an option on the OWLCMS page to send the data to tracker, in the Options dropdown

- Alternatively, you can configure in your database

  - **In OWLCMS:** Prepare Competition → Language and System Settings → Connections → URL for Video Data

  - Set to: `ws://localhost:8096/ws` (or `wss://your-tracker-host:8096/ws` for secure connections)


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
