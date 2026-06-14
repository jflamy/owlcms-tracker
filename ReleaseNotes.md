# OWLCMS Tracker Release Notes
<!-- markdownlint-disable -->

> #### ⚠ To use Tracker, you need to use version 64 or newer of OWLCMS (see Installing Locally below)

##### Release log

- 2.18.10: logging cleanup to allow at-a-glance status of a simulation feeding tracker

- 2.18.9: Standard scoreboards were not behaving correctly on large sessions (or on smaller devices like phones); also portrait mode fixes

- 2.18.9: Scoreboards in the default bundle were hiding the down signal too early

- 2.18.8: Cosmetic: Use the more general label "Open" for opening a plugin from the Options page.

- 2.18.7: Removed an unfinished partial implementation of plugins that would run on server startup. To be redone with better use cases.

- 2.18.6: Plugin option defaults can now be saved from the options modal via a built-in "Save as Defaults" button. Overrides are persisted as `config-override.json5` (JSON5 with comments and trailing commas). The legacy `config-override.js` format is no longer loaded; re-save defaults from the modal to migrate. 

- 2.18.6: Fixes a bug where comma-separated string defaults (e.g. `'S,J,U,V'`) were truncated when handling defaults

- 2.18.5: moved plugin-specific unit tests down to their plugin or submodule.

- 2.18.4: Stale provisional records that do not match the current event are no longer included in the results book

- 2.18.3: Flag files for countries and North America provinces/states/territories now are mapped from full name to 2-letter juridiction or 3-letter IOC Code (Ontario can be found under ON.svg and Australia under AUS.svg). 

- 2.18.2: Packaged plugins can now provide editable `config-override.js` files for runtime option defaults.
  - Custom zip packaging copies hand-authored override files and generates missing ones for selected plugins with options.
  - OBS packages include override files for install-specific host, path, platform, and scene defaults.

- 2.18.1: Add timestamps to packaged zips since the version number shown is that of tracker and not of the included plugins

- 2.18.0: Include a marker file that indicates that a non-standard build was created using npm run zip.
  - the file includes the plugins included, to provide correct warnings or errors when updating/importing
- 2.18.0: reviewed the "npm run zip" command options for packaging a custom tracker

  - Cleaner options

    `--standard` includes only the built-in plugins from the default checkout.
    `--include` adds plugins or extensions by display name.
    `--include-category` and `--include-categories` add plugins or extensions by the declared category in config.js
    `--submodule` and -`-submodules` add whole submodules.

  - Use commas to separate listed items.
  - Selection is additive.
  - Extensions must be selected explicitly with --include or --include-type
  - Selecting an extension automatically pulls in its base plugin.
  - Zip filenames created with `npm run zip` include timestamp metadata by default, for example `owlcms-tracker_2.18.0+2026-05-12.14h37.zip`; release builds use `--no-timestamp` to create the stable asset name `owlcms-tracker_<version>.zip`.
  - `--name <metadata>` appends control-panel-preserved package metadata before the timestamp, for example `owlcms-tracker_2.18.0+documents.2026-05-12.14h37.zip`.

- 2.17.2: improvements to the jury plugin to better display the recording/trimming status. Requires replays 2.3.4

- 2.17.1: Adding plugins requires restarting the server to avoid running initialize() too often

- 2.17.0: Tracker now receives the mapping between country names and IOC country codes

- 2.17.0: If a team name is a country name, and the flag is not there under that name, the flag will be looked up using the IOC code

- 2.16.0: Jury Replays user interface plugin added.  Requires replays module version 2.2.2

- 2.16.0: Category ordering can now be overridden and extended.  See the top-level README.md

- 2.15.0: Changed the user interface for the entry page cards to have a tabbed look and responsive 1 or 2 columns

- 2.15.0: Team scoreboards now allow overriding the SMHF Sinclair and Age Factor options

- 2.15.0: Tracker will now use Sinclair 2028 if that is selected in OWLMCMS (but SMHF has its own specific options)

- 2.15.0: The tracker title on the entry page switches to the competition name as soon as it is available

- 2.14.2: team scoreboard toggle between fixed team order and ranking order now working

- 2.14.1: team scoreboards result exports now include membership and body weight

- 2.14.0: Remove hard-coded timer values, obey directives from owlcms

- 2.13.2: Fix for the on-demand database refresh issue

- 2.13.2: Checked that usage of the Champioship entities works

- 2.13.1: On Linux, a race condition was preventing the entry page cards from showing the full language list

- 2.13.0: the referee assignment document plugin now requests a database refresh so it matches the master database changes.

- 2.12.0: fixes to support packaging of combined plugins with shared content 

- 2.9.0: Clean-up of large unnecessary dependencies that were specific to some plugins -- puppeteer is no longer included by default

- 2.9.0: Plugins and extensions can specify additional dependencies that are not part of the base build

- 2.9.0: Additional dependencies listed in the plugins and extensions are included in zip distributions

- 2.8.3: extensions now inherit the default values of the base scoreboard

- 2.8.3: refactored the team-scoreboard extension mechanism

- 2.8.2: Share attempt bar presentation and backend for unified translations on all scoreboards

- 2.8.2: Thin border on scoreboard flags for when there is black on the flags

- 2.8.1: Fixed flags for teams scoreboard and standard scoreboards

- 2.8.0: Support for extensions to the team scoreboard for additional scoring formulas

- 2.7: Improved contrast and additional visual cues for bad lifts on scoreboards

- 2.7: Scoreboard translations come from owlcms (no fallbacks)

- 2.7: Plugins reorganized in subfolders to facilitate connecting submodules with additional plugins (e.g. IWF Books)
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