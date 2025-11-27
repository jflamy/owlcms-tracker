# Test Scripts

This directory contains test scripts and utilities for the OWLCMS Tracker application.

## Test Files

### WebSocket Connection Tests

- **`check-websocket.js`** - Verifies WebSocket connection to the tracker
- **`test-428-response.js`** - Tests HTTP 428 Precondition Required response with missing preconditions array
- **`test-session-status.js`** - Tests session status tracking (GroupDone detection and reopening)

### Sample Data Tests

- **`test-load-sample.js`** - Loads sample data files and sends them to the tracker
- **`test-sample-data.sh`** - Shell script to send sample OWLCMS data to the tracker
- **`send-test-update.js`** - Sends test update messages to the tracker

### Athlete Getter Tests

- **`test-athlete-getters.js`** - Tests getCurrentAthlete(), getNextAthlete(), getPreviousAthlete() methods with V1/V2 format support

## Running Tests

### From Root Directory

All test scripts can be run from the project root directory:

```bash
# Test WebSocket connection
node tests/check-websocket.js

# Test 428 response with missing preconditions
node tests/test-428-response.js

# Load sample data
node tests/test-load-sample.js

# Send sample data (shell script)
./tests/test-sample-data.sh

# Test athlete getter methods
node tests/test-athlete-getters.js
```

### From Tests Directory

Or navigate to the tests directory first:

```bash
cd tests

# Run any test
node test-428-response.js
node check-websocket.js
./test-sample-data.sh
```

## Prerequisites

- Tracker must be running on `ws://localhost:8096/ws`
- Use VS Code "OWLCMS Tracker - Learning Mode" or "OWLCMS Tracker - Production Mode" launch configuration
- Or run manually: `npm run dev` or `npm run dev:learning`

## Sample Data

Sample OWLCMS data files are stored in the `samples/` directory at the project root. Test scripts reference these files when sending data to the tracker.
