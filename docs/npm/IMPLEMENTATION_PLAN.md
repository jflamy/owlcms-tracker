## Overview

This document outlines the high-level intent and acceptance criteria for extracting the hub into a **separate repository** (`tracker-core`) and consuming it from **owlcms-tracker**.

**Canonical execution plan:** [REPO_MIGRATION.md](./REPO_MIGRATION.md)

**Architecture decision:** Separate repositories (not a monorepo workspace)

**Source-of-truth documents:**

- [REPO_MIGRATION.md](./REPO_MIGRATION.md) — repo creation + branching plan
- [CORE_MIGRATION.md](./CORE_MIGRATION.md) — source extraction steps into tracker-core
- [TRACKER_MIGRATION.md](./TRACKER_MIGRATION.md) — tracker changes on the migration branch
- [API_REFERENCE.md](./API_REFERENCE.md) — public API contract for `@owlcms/tracker-core`
- [DEVELOPER_USAGE.md](./DEVELOPER_USAGE.md) — developer workflows (preferred: repo checkout + `npm link`)

---

## Execution order (required)

Repo migration happens before any code extraction or tracker rewiring.

1. [REPO_MIGRATION.md](./REPO_MIGRATION.md) — create `tracker-core` repo and tracker migration branch.
2. [CORE_MIGRATION.md](./CORE_MIGRATION.md) — extract/refactor core implementation inside the new repo.
3. [TRACKER_MIGRATION.md](./TRACKER_MIGRATION.md) — switch tracker migration branch to package-backed core.

---

## Scope

Included in `@owlcms/tracker-core`:

- Hub/state store (`competitionHub`)
- WebSocket ingestion utilities with both modes:
  - standalone server
  - attach/inject into an existing HTTP/Express server (**required**)
- Protocol parsing + binary handlers + embedded database helpers
- Shared utilities and scoring helpers documented in [API_REFERENCE.md](./API_REFERENCE.md)

Not included:

- Tracker UI (SvelteKit), routes, plugin registry, scoreboard plugins
- Any UI/client logic

---

## Non-negotiable decisions

- Separate repositories
- Prefer repo checkout + `npm link` for development (avoid GitHub Packages auth during local dev)
- Attach/inject WebSocket integration is required

---

## Cutover gate (must be true before merging the tracker migration branch)

- Tracker runs using a **package-backed** hub (direct imports or consistent shims)
- No “double singleton” issues (tracker never mixes embedded hub + package hub)
- WebSocket attach/inject mode works end-to-end
- A representative scoreboard plugin renders using `competitionHub.getFopUpdate()`
- Resource preconditions flow works end-to-end (flags/logos/translations)
- Docs stay consistent:
  - [API_REFERENCE.md](./API_REFERENCE.md) matches implementation
  - migration prompts match current code paths

---

## Publishing note

Publishing to GitHub Packages is a CI/production concern and is not required to complete the source migration.

When publishing, ensure `package.json` exports match [API_REFERENCE.md](./API_REFERENCE.md).
