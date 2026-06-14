# Deploying the Tracker to Fly.io

This document describes how to deploy the tracker app to a Fly.io app.
There are three approaches, depending on your situation:

- **[Deploy from source](#a-deploy-from-source)** — Fly builds the Docker image
  directly from the repo, pinning a specific `tracker-core` version. Use this
  when you are actively developing or need a custom build.
- **[Deploy from an image built from source](#b-deploy-from-an-image-built-from-source)** —
  Reuses the Fly-built image from a previous source deploy to spin up a second
  app without rebuilding.
- **[Deploy from a standard release](#c-deploy-from-a-standard-release)** —
  Simplest option; no source checkout needed. Uses the official Docker Hub image
  published by the CI build.

---

## Authentication

You need to authenticate the Fly CLI before deploying. Two approaches:

### Option A — Interactive login (personal account)

```bash
fly auth login
```

This opens a browser and stores the token in `~/.fly/config.yml`.

### Option B — Machine token (org or CI account)

Source a script that exports `FLY_API_TOKEN`:

```bash
source /path/to/token.sh     # exports FLY_API_TOKEN
```

The token takes priority over the stored login. To go back to your personal
account afterwards, unset it:

```bash
unset FLY_API_TOKEN
```

Verify which account is active at any time:

```bash
fly auth whoami
```

---

## First-time app creation

If the Fly app does not exist yet, create it before deploying:

```bash
source /path/to/token.sh     # if using an org token
fly apps create <app-name>
npm run deploy:fly -- -- --app <app-name>
```

---

## A. Deploy from source

Fly builds the Docker image from the repo source. The `fly.toml` `[build]`
section must reference the Dockerfile (this is the default):

```toml
[build]
  dockerfile = "Dockerfile"
```

### Deploy to your app

Pass the app name as a fly passthrough argument (after the second `--`):

```bash
npm run deploy:fly -- -- --app <app-name>
```

### Deploy with a specific version of tracker-core

By default the latest release version of `tracker-core` is used. To pin a
specific version:

```bash
npm run deploy:fly -- 1.5.8
```

Or override both the version and the app:

```bash
npm run deploy:fly -- 1.5.8 -- --app <app-name>
```

### Dry run (show what would be deployed, no changes)

```bash
npm run deploy:fly -- --dry-run
```

### What the deploy script does

1. Fetches the latest `tracker-core` tag from GitHub (or uses the version you specify).
2. Updates `package.json` and `package-lock.json` to pin that tag.
3. Runs `fly deploy --ha=false` (single machine — required; the hub is in-memory).
4. Runs `fly scale count 1 --yes` to enforce exactly one machine.
5. Restores the local `npm link` to `../tracker-core` so local development keeps working.

### Releasing a new version of tracker-core

When tracker-core has changes that need to be published:

```bash
cd ../tracker-core
npm run release -- <new-version>   # e.g. npm run release -- 1.5.9
cd ../tracker
npm run deploy:fly                  # picks up the new tag automatically
```

---

## B. Deploy from an image built from source

If you have already deployed with `npm run deploy:fly` and want a second Fly app
to run **the exact same image** without rebuilding from source, point `fly.toml`
directly at the image that was produced.

### 1. Get the image reference of the running app

```bash
fly image show -a <source-app> --json | jq -r '.[0] | "\(.Registry)/\(.Repository):\(.Tag)"'
```

This prints something like:

```
registry.fly.io/fhq-tracker:deployment-01KV1PJ5Y10CJEWYMV0ADP63ZW
```

### 2. Replace the `[build]` section in `fly.toml`

Change:

```toml
[build]
  dockerfile = "Dockerfile"
```

to:

```toml
[build]
  image = "registry.fly.io/fhq-tracker:deployment-01KV1PJ5Y10CJEWYMV0ADP63ZW"
```

### 3. Deploy the second app

```bash
fly deploy --ha=false --app <new-app-name>
```

> **Note:** The image lives in the source app's registry namespace. If the
> target app belongs to a different Fly org, the pull will be denied. In that
> case you must either rebuild from source or use option C below.

### 4. Restore `fly.toml` for development

Revert the `[build]` section back to `dockerfile = "Dockerfile"` so that
`npm run deploy:fly` continues to work.

---

## C. Deploy from a standard release

Official tracker releases are published to Docker Hub as
`owlcms/tracker:<version>` and `owlcms/tracker:latest` by the CI build when a
release tag is pushed. No local source checkout or npm install is needed.

### 1. Edit `fly.toml`

Replace the `[build]` section with a direct image reference:

```toml
[build]
  image = "owlcms/tracker:latest"
```

Or pin to a specific version:

```toml
[build]
  image = "owlcms/tracker:2.18.10"
```

### 2. Deploy

Authenticate first (see [Authentication](#authentication) above), then:

```bash
fly deploy --ha=false --app <app-name>
```

### 3. Restore `fly.toml` for development

Revert the `[build]` section back to `dockerfile = "Dockerfile"` so that
`npm run deploy:fly` continues to work.

The release script in tracker-core bumps `package.json`, runs tests, commits,
tags, and pushes to GitHub. The deploy script then resolves that tag from
GitHub and builds the Docker image with it.
