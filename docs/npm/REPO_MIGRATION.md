# Repository Migration Plan (tracker-core extraction) — LLM Action Prompt

Use this prompt to run the **two-repository migration** while keeping the main tracker repo stable.

**Target end state:**

- A new repository exists: `owlcms/tracker-core`
- The tracker repo (`owlcms/owlcms-tracker`) has a long-lived migration branch (recommended name: `tracker-core`) that depends on `@owlcms/tracker-core` (via local link during dev; via published package for CI/prod)
- The migration branch is merged only when the tracker is fully package-backed and validated

**Authoritative references (this plan must stay consistent with these):**

- [API_REFERENCE.md](./API_REFERENCE.md) — the public contract for `@owlcms/tracker-core` (APIs, integration modes, required options like `localFilesDir`).
- [CORE_MIGRATION.md](./CORE_MIGRATION.md) — what code/docs must be extracted into the new `tracker-core` repo.
- [TRACKER_MIGRATION.md](./TRACKER_MIGRATION.md) — how `owlcms-tracker` must consume `tracker-core` (including attach/inject wiring and shims).

If anything in this repo-migration plan conflicts with those references, treat it as a doc bug: update the plan so it matches the contract (and update the contract first if the intended behavior changed).

---

## Role

You are a release/migration engineer coordinating changes across two git repositories.

---

## Goals (must achieve all)

1. Create the new `tracker-core` repo with the extracted core code and docs.
2. Create a migration branch in `owlcms-tracker` (named `tracker-core`) where all tracker-side changes land until migration is complete.
3. Ensure the tracker migration branch can run against:
   - a local checkout of `tracker-core` via `npm link` (preferred for team work)
   - a published `@owlcms/tracker-core` package in CI/production (optional during development)
4. Avoid breaking the `main` branch of `owlcms-tracker` until cutover.

---

## Constraints (follow strictly)

- Preferred development workflow is **repo checkout + npm link** (avoid GitHub Packages auth for developers).
- GitHub Packages is for **published installs** (CI/production) and should not be required to develop.
- The attach/inject WebSocket mode is a hard requirement for core (see [API_REFERENCE.md](./API_REFERENCE.md)).
- Avoid “two hub singletons” problems: the tracker must use either all package imports or consistent re-export shims.
- The core API must allow configuring where OWLCMS-delivered ZIP resources are written (see `localFilesDir` in [API_REFERENCE.md](./API_REFERENCE.md)).

---

## Work plan (execute in order)

### Phase 0 — Pre-flight (decision + safety)

1. Decide the temporary directory layout for local linked dev:

- Place both repos side-by-side (recommended):
  - `.../tracker-core/`
  - `.../owlcms-tracker/`

2. Choose branch naming:

- In `owlcms-tracker`: create branch `tracker-core`
- In `tracker-core`: use `main` (or your standard default) and feature branches as needed

3. Declare the “cutover rule”:

- `owlcms-tracker/main` stays unchanged except critical fixes
- all migration work goes to `owlcms-tracker/tracker-core` until the final merge

---

### Phase 1 — Create the new tracker-core repository

1. Create a new git repository:

- Repo name: `owlcms/tracker-core`
- Default branch: `main`

2. Seed repository structure:

- Add `package.json` (`name: @owlcms/tracker-core`, `type: module`)
- Add `src/` with the extracted implementation
- Add `docs/npm/` containing the canonical docs copied from tracker:
  - `API_REFERENCE.md`
  - `CORE_MIGRATION.md`
  - `TRACKER_MIGRATION.md`
  - `DEVELOPER_USAGE.md`
  - `IMPLEMENTATION_PLAN.md`

3. Perform the extraction refactor in the new repo:

- Follow [CORE_MIGRATION.md](./CORE_MIGRATION.md) exactly
- Ensure all public entrypoints exist and match [API_REFERENCE.md](./API_REFERENCE.md)

4. Add minimal smoke checks (recommended):

- A tiny Node script (or test) that imports the four public entrypoints:
  - `@owlcms/tracker-core`
  - `@owlcms/tracker-core/websocket`
  - `@owlcms/tracker-core/utils`
  - `@owlcms/tracker-core/scoring`

---

### Phase 2 — Prepare owlcms-tracker migration branch

1. In `owlcms-tracker`, create branch `tracker-core` from `main`.

2. Update tracker to consume core behind shims (recommended to minimize churn):

- Follow [TRACKER_MIGRATION.md](./TRACKER_MIGRATION.md) exactly
- Keep tracker-local shim modules that re-export the package so plugins/routes don’t need to change immediately

3. Ensure WebSocket integration uses core’s attach/inject path:

- Tracker startup uses:
  - `import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket'`
- Keep tracker-only behavior in tracker callbacks (do not push into core)

4. Decommission embedded core source usage:

- Stop importing embedded implementations as sources of truth
- Keep old files only if they are now shims/wrappers

---

### Phase 3 — Local linked development workflow (preferred)

Goal: tracker developers should be able to work without GitHub Packages auth.

1. In `tracker-core` repo:

- `npm install`
- `npm link`

2. In `owlcms-tracker` repo (on branch `tracker-core`):

- `npm install`
- `npm link @owlcms/tracker-core`

3. Confirm the tracker resolves the linked dependency:

- Inspect that `node_modules/@owlcms/tracker-core` is a symlink to your local `tracker-core`

---

### Phase 4 — CI/production path (optional during migration)

If you want CI to run against published packages during the migration:

1. Add a GitHub Actions workflow in `tracker-core` to publish to GitHub Packages (see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)).

2. In `owlcms-tracker` branch `tracker-core`, depend on a published semver range.

3. Document CI authentication using GitHub Packages tokens (do not require local devs to do this).

---

### Phase 5 — Stabilization loop (iterate until green)

Repeat until tracker migration branch is fully functional:

1. Fix API mismatches by updating `tracker-core` (not tracker) if the core contract isn’t met.
2. Fix tracker wiring mismatches by updating `owlcms-tracker` (migration branch).
3. Keep docs accurate:

- If behavior changes, update `API_REFERENCE.md` first
- Then update the migration prompts

---

### Phase 6 — Cutover and merge

Cutover criteria (all must be true):

- Tracker migration branch uses only package-backed hub (direct or shimmed)
- WebSocket attach/inject works
- At least one representative scoreboard plugin renders using `competitionHub.getFopUpdate()`
- Resource preconditions flow works (flags/logos/translations)
- Local ZIP resources can be written to a configured output directory (not only `process.cwd()/local`)
- Local assets URL prefix is configurable (`localUrlPrefix`, default `/local`) and tracker serves files under `<localUrlPrefix>/*`
- No “double singleton” issues observed

When ready:

1. Merge `owlcms-tracker/tracker-core` into `owlcms-tracker/main`.
2. Tag a tracker release.
3. Keep `tracker-core` releases versioned independently.

---

## Deliverables checklist

- New repo `owlcms/tracker-core` exists and builds/exports the documented API
- `owlcms-tracker` has branch `tracker-core` with migration changes only
- Linked dev workflow works without GitHub Packages auth
- Optional: CI installs from GitHub Packages successfully
