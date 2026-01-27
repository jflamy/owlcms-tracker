# OWLCMS Tracker Release Notes

> #### ⚠ To use Tracker, you need to use version 64 of OWLCMS (see Installing Locally below)

##### New in Release 2.8
- Various bug fixes
- Support for extensions to the team scoreboard for additional scoring formulas

##### New in Release 2.7
- Improved contrast and additional visual cues for bad lifts on scoreboards
- Scoreboard translations come from owlcms (no fallbacks)
- Plugins reorganized in subfolders to facilitate connecting submodules with additional plugins (e.g. IWF Books)
  - Plugins are still shown on entry page based on the category in config.js

## Installing Locally

- Install the latest version 3.0 of the [OWLCMS control-panel](https://github.com/owlcms/owlcms-controlpanel/releases)
  - There will be a Tracker tab where you can click to install Tracker
  - This installs the normal plugins to support people watching remotely
    - To access experimental or additional example plugins, see [Installing from Source](#installing-from-source).

  - Also install the latest version 64 of OWLCMS (you may need to select it as a prerelease)


## OWLCMS Configuration

**Before using this tracker**, you must configure OWLCMS to send data via WebSocket:

- If you installed from the control panel, there is an option on the OWLCMS page to send the data to tracker, in the Options dropdown.  Use the "Enable" option -- after enabling, the dropdown will show "Disable", which means it's enabled...
  
<img width="688" height="269" alt="image" src="https://github.com/user-attachments/assets/df02b305-2bdc-49b0-b542-4779f773df2c" />

- Alternatively, you can configure in your database

  - **In OWLCMS:** Prepare Competition → Language and System Settings → Connections → URL for Video Data

  - Set to: `ws://localhost:8096/ws` (or `wss://your-tracker-host:8096/ws` for secure connections)

## Other Installation Methods

#### Docker Installation

Alternatively, run the tracker in Docker:

```bash
docker run -d \
  --name owlcms-tracker \
  -p 8096:8096 \
  docker.io/owlcms/tracker:latest
```

Then access the tracker at: `http://localhost:8096`

**Note:** Use `latest` for the newest release. You can also use a specific release number such as `2.0.0-beta01` if needed.

#### Installing from Source

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