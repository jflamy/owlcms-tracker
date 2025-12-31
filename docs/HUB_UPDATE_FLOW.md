# How scoreboard helpers become aware of new information

This document explains how scoreboard helper modules (plugin `helpers.data.js`) become aware of new OWLCMS information in the current owlcms-tracker architecture.

## Key point

Scoreboard helpers are **not push-notified directly**.

They become aware of new information because:

1. OWLCMS updates are ingested into the in-memory hub.
2. Browsers are notified via SSE.
3. Browsers then fetch fresh scoreboard data from the API.
4. That API request executes the helper, which reads the hub’s current state.

In other words: helpers learn about new information because they are **re-executed on demand** after an SSE-triggered refresh.

---

## End-to-end flow (OWLCMS → helper)

### 1) OWLCMS sends WebSocket message

OWLCMS sends one of:

- `type=update`
- `type=timer`
- `type=decision`
- `type=database`

Entry point: [src/lib/server/websocket-server.js](../src/lib/server/websocket-server.js)

### 2) WebSocket server routes message into the hub

The WebSocket server validates/authenticates the frame and routes it:

- `update/timer/decision` → hub `handleOwlcmsMessage(payload, messageType)`
- `database` → hub `handleFullCompetitionData(payload)`

Hub implementation: [src/lib/server/competition-hub.js](../src/lib/server/competition-hub.js)

### 3) Hub updates its in-memory state

The hub merges the new message into its state stores:

- `fopUpdates[fopName]` (for per-FOP “update/timer/decision” merged state)
- `databaseState` (full competition database)
- translations/resources readiness state

Hub implementation: [src/lib/server/competition-hub.js](../src/lib/server/competition-hub.js)

### 4) Hub broadcasts an event to subscribers

The hub maintains an in-process subscriber set:

- `subscribe(callback)` adds an SSE client callback
- `broadcast(message)` sends messages to those callbacks (with per-(fop,eventType) debouncing)

Hub implementation: [src/lib/server/competition-hub.js](../src/lib/server/competition-hub.js)

### 5) Browser receives SSE notification

Browsers connect to the SSE endpoint, which subscribes to the hub and forwards messages as SSE `data:` frames.

SSE endpoint: [src/routes/api/client-stream/+server.js](../src/routes/api/client-stream/+server.js)

### 6) Browser fetches the scoreboard API

On receiving an SSE notification, the browser fetches updated scoreboard data from:

- `GET /api/scoreboard?type=...&fop=...&...options`

API implementation: [src/routes/api/scoreboard/+server.js](../src/routes/api/scoreboard/+server.js)

### 7) The API invokes the helper module

The API uses the scoreboard registry to locate the plugin helper and execute it.

Registry: [src/lib/server/scoreboard-registry.js](../src/lib/server/scoreboard-registry.js)

At this moment, the helper reads fresh hub state using APIs like:

- `competitionHub.getFopUpdate(fopName)`
- `competitionHub.getDatabaseState()`
- `competitionHub.getStartOrderEntries(fopName, ...)`

Example helper that reads hub directly:

- [src/plugins/team-scoreboard/helpers.data.js](../src/plugins/team-scoreboard/helpers.data.js)

---

## Related mechanism: on-demand resources (flags/logos/pictures)

Some plugins require binary resources (flags/logos/pictures/styles). The current system requests these resources on demand when a scoreboard is requested:

1. The scoreboard API reads the plugin’s required resources (`config.requires`).
2. It asks the hub which are missing.
3. If anything is missing, the hub triggers a WebSocket request back to OWLCMS (a 428-style “missing resources” response).

Scoreboard API side: [src/routes/api/scoreboard/+server.js](../src/routes/api/scoreboard/+server.js)

Hub side: [src/lib/server/competition-hub.js](../src/lib/server/competition-hub.js)

This mechanism is still **request-driven** (it happens when a scoreboard API request occurs), not “helpers subscribing to updates”.
