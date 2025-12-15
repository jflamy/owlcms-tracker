# Running owlcms-tracker on Fly.io with Docker

## Overview

This guide describes how to containerize owlcms-tracker for deployment on Fly.io. Unlike the Java-based owlcms system that uses Maven, owlcms-tracker is a Node.js/SvelteKit application that **runs in development mode** to support the dynamic plugin architecture.

**Important:** The application must run with `npm run dev` (Vite dev server) because scoreboards are discovered dynamically at runtime by scanning the `src/plugins/*/` directory. A production build would not support this plugin auto-discovery pattern.

## Docker Architecture

### Single Configuration: Development Mode

**Dockerfile for development:**
```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install all dependencies (dev + production)
RUN npm ci

# Copy source code (includes plugins)
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8096/ || exit 1

EXPOSE 8096

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]
```

**Pros:**
- Supports dynamic plugin discovery (plugins are bundled into the image at build time)
- Matches local development environment
- Hot module reload available when files are writable inside the container
- To change or add plugins, rebuild the image and redeploy (do not rely on host bind-mounts in production)

**Cons:**
- Larger image size (~400-500MB)
- Slightly higher memory usage
- Source code present in image

### Why Not Production Build?

The SvelteKit plugin architecture relies on **runtime discovery**:

1. At startup, `scoreboard-registry.js` scans `src/plugins/*/` directory
2. Each plugin folder must have `config.js` and `helpers.data.js`
3. Registry auto-discovers plugins that are present inside the container at startup
4. To modify plugins in a deployed container you must rebuild the image and redeploy; (optionally) during local development you may temporarily bind-mount `src/plugins/` for quick iteration, but this is not recommended for CI or remote deployments

A production build (with `npm run build`) would:
- Create a static `build/` directory
- Exclude source `src/plugins/` directory  
- Not support plugin discovery
- Require container rebuild for new scoreboards

Therefore, **dev mode is required** to maintain the architecture's flexibility.

## Fly.io Configuration

### Step 1: Create fly.toml

Create `fly.toml` in the owlcms-tracker root:

```toml
app = "owlcms-tracker"
primary_region = "yyz"  # Toronto (change to your region)

[build]
  # Use the local Dockerfile
  dockerfile = "Dockerfile"

[env]
  LEARNING_MODE = "false"  # Set to "true" for capture mode
  LOG_LEVEL = "info"

[http_service]
  internal_port = 8096
  force_https = false  # Set to true in production
  auto_stop_machines = true
  auto_start_machines = true

[[services]]
  protocol = "tcp"
  internal_port = 8096
  auto_stop_machines = true
  auto_start_machines = true
  
  [[services.ports]]
    port = 8096
    handlers = ["http"]
    force_https = false

[[vm]]
  memory = "1gb"
  cpus = 1
```

### Step 2: Configure WebSocket Connection from OWLCMS

In OWLCMS, set:
```
URL for Video Data: wss://owlcms-tracker.fly.dev/ws
```

(Use `wss://` for secure WebSocket over HTTPS)

### Step 3: Deploy to Fly.io

```bash
# Install Fly.io CLI if not already installed
# https://fly.io/docs/getting-started/installing-flyctl/

# Authenticate
flyctl auth login

# Create the app (first time only)
flyctl launch

# Deploy
flyctl deploy

# View logs
flyctl logs

# SSH into running machine (for debugging)
flyctl ssh console
```

## Comparing with owlcms Docker Setup

The owlcms system (Java/Maven) uses:
- **Multi-stage builds**: Compile Java in Maven container, then copy JAR to JRE container
- **Assembly descriptors**: Defines how dependencies are packaged
- **Fabric8 Docker Maven Plugin**: Automated Docker image creation from Maven
- **Two container images**: `owlcms` and `publicresults`

For owlcms-tracker (Node.js/SvelteKit), we use:
- **Single-stage Dockerfile**: Runs Vite dev server directly (plugins require dev mode)
- **Native Node.js build tools**: No need for Maven or assembly descriptors
- **Standard Dockerfile**: Single configuration file, no plugins needed
- **Single container image**: One tracker serves all scoreboards

## Environment Variables

Supported environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LEARNING_MODE` | `false` | Set to `true` to capture incoming WebSocket messages to `samples/` directory |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `OWLCMS_HOST` | `localhost` | (Internal) Hostname of OWLCMS server for WebSocket connections |
| `NODE_ENV` | `production` | Node.js environment (`development` or `production`) |

## Performance Considerations

### Memory
- **1GB** (current fly.toml): Suitable for 1-5 concurrent scoreboards
- **2GB**: Recommended for 6+ concurrent scoreboards or heavy usage
- **512MB**: Minimum, not recommended for production

### CPU
- **1 vCPU** (current): Sufficient for typical usage
- **2 vCPU**: For high concurrency or complex scoreboard processing

### WebSocket Scaling

The Vite dev server is single-threaded. For production with high concurrency:
- Build production app (`npm run build`)
- Use `Node.js` for native performance
- Consider load balancing multiple instances behind a reverse proxy

## Troubleshooting

### WebSocket Connection Issues

**Issue**: OWLCMS cannot connect to tracker
```
Solution:
1. Verify Fly.io domain is accessible: curl -i https://owlcms-tracker.fly.dev/ws
2. Check logs: flyctl logs
3. Ensure firewall allows WebSocket (port 443)
4. Try wss:// (secure WebSocket) instead of ws://
```

### High Memory Usage

**Issue**: Fly.io machine keeps restarting
```
Solution:
1. Check logs for errors: flyctl logs
2. Increase memory in fly.toml
3. Review LEARNING_MODE - disable if not needed
4. Check for memory leaks in scoreboards
```

### Slow Scoreboard Updates

**Issue**: SSE updates take >1 second
```
Solution:
1. Reduce number of concurrent scoreboards
2. Check network latency
3. Review scoreboards for inefficient processing
4. Monitor CPU usage
```

## Next Steps

1. **Create Dockerfile** in owlcms-tracker root
2. **Create fly.toml** configuration
3. **Test locally**: `docker build -t owlcms-tracker . && docker run -p 8096:8096 owlcms-tracker`
4. **Deploy**: `flyctl deploy`
5. **Configure OWLCMS** to send data to tracker
6. **Monitor**: `flyctl logs -f`

## References

- [Fly.io Getting Started](https://fly.io/docs/getting-started/)
- [Fly.io Node.js Guide](https://fly.io/docs/languages-and-frameworks/nodejs/)
- [SvelteKit Adapter Node](https://kit.svelte.dev/docs/adapters)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
