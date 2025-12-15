# Local Docker Testing for owlcms-tracker

This guide explains how to build and test the owlcms-tracker Docker image locally before deploying to Fly.io.

**Note:** The application runs in development mode (Vite dev server) to support the dynamic plugin architecture that auto-discovers scoreboards in `src/plugins/*/`.

## Prerequisites

- Docker installed ([Docker Desktop](https://www.docker.com/products/docker-desktop) on Windows/Mac)
- owlcms-tracker source code
- (Optional) Docker Compose for advanced scenarios

## Building the Docker Image

### Build for Local Testing

```bash
# Navigate to owlcms-tracker root directory
cd owlcms-tracker

# Build the image
docker build -t owlcms-tracker:local .

# Or with a specific tag
docker build -t owlcms-tracker:1.0.0 .
```

### Build Arguments (Optional)

```bash
# Build with specific Node version
docker build --build-arg NODE_VERSION=22 -t owlcms-tracker:local .
```

## Running the Container Locally

### Basic Run

```bash
# Run the container
docker run -p 8096:8096 owlcms-tracker:local

# Container will start on http://localhost:8096
```

### With Environment Variables

```bash
# Enable learning mode (captures OWLCMS messages)
docker run -p 8096:8096 \
  -e LEARNING_MODE=true \
  -e LOG_LEVEL=debug \
  owlcms-tracker:local
```

### With Volume Mounts (Persist Data)

```bash
# Mount local directory to capture samples
docker run -p 8096:8096 \
  -v $(pwd)/samples:/app/samples \
  -v $(pwd)/local:/app/local \
  owlcms-tracker:local

# On Windows (PowerShell):
docker run -p 8096:8096 `
  -v ${PWD}/samples:/app/samples `
  -v ${PWD}/local:/app/local `
  owlcms-tracker:local
```

### Running in Detached Mode

```bash
# Run in background
docker run -d \
  --name tracker \
  -p 8096:8096 \
  owlcms-tracker:local

# View logs
docker logs -f tracker

# Stop the container
docker stop tracker

# Restart the container
docker restart tracker

# Remove the container
docker rm tracker
```

## Testing WebSocket Connection

### Check if Service is Running

```bash
# Test HTTP endpoint
curl -i http://localhost:8096/

# Expected response: 200 OK
```

### Test WebSocket Connection

```bash
# Using websocat (install: brew install websocat or cargo install websocat)
websocat ws://localhost:8096/ws

# Using node ws CLI (install: npm install -g ws)
wscat -c ws://localhost:8096/ws
```

### Test with OWLCMS

1. Start the tracker container (see above)
2. Configure OWLCMS:
   - **Prepare Competition → Language and System Settings → Connections**
   - **URL for Video Data**: `ws://localhost:8096/ws`
   - (Use `ws://` not `wss://` for local testing)
3. Send sample data or start a competition
4. Check tracker logs: `docker logs -f tracker`

## Debugging Inside Container

### Shell Access

```bash
# Open shell in running container
docker exec -it tracker sh

# Inside container:
# - Check files: ls -la
# - View logs: cat /app/build/index.js
# - Test connectivity: wget http://localhost:8096/
```

### View Detailed Logs

```bash
# Stream logs in real-time
docker logs -f tracker

# Show last 50 lines
docker logs --tail 50 tracker

# Show logs with timestamps
docker logs -f --timestamps tracker
```

## Comparing Images (Development Mode Only)

### Why Dev Mode Only?

The owlcms-tracker uses a **dynamic plugin discovery system**:

- Plugins are stored in `src/plugins/*/` directories
- At startup, the registry automatically discovers all plugins
- New plugins can be added without rebuilding
- Scoreboard functionality is fully flexible

**A production build would:**
- Only include `build/` directory (compiled output)
- Lose access to `src/plugins/` source
- Require container rebuild to add new scoreboards

**Therefore:** Dev mode with Vite is required, not optional.

### Image Size

```bash
# Dev mode image
docker images owlcms-tracker
# Expected: ~400-500MB (includes Node.js, npm, Vite, source code)

# This is larger than a production build, but necessary for:
# - Plugin discovery
# - Hot module reload during development
# - Access to scoreboard source code
```

docker-compose down
docker-compose logs -f tracker
## Docker Compose (Optional)

For local testing with an OWLCMS instance you can use Docker Compose. The container is intended to be standalone — plugins are packaged into the image and should not be mounted at runtime. To change plugins, rebuild the image and restart the container.

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  tracker:
    build: .
    ports:
      - "8096:8096"
    environment:
      LEARNING_MODE: "true"
      LOG_LEVEL: "debug"
      NODE_ENV: "development"
    # Do NOT mount src/plugins in CI or on Fly.io — plugin code is bundled in the image.
    # Persist sample data if you want to inspect captured messages locally:
    volumes:
      - ./samples:/app/samples
      - ./local:/app/local

  owlcms:
    image: owlcms/owlcms4:latest
    ports:
      - "8080:8080"
    environment:
      SERVER_PORT: 8080
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  tracker_data:
```

Run with Docker Compose:

```bash
# Build and start services
docker-compose up --build

# Preferred workflow to change plugins:
# 1) Edit plugin source locally in the repo
# 2) Rebuild the image and restart the tracker service:
#    docker-compose build tracker && docker-compose up -d tracker

# Stop services
docker-compose down

# View logs
docker-compose logs -f tracker
```

Note: mounting `src/plugins` into the running container is possible for rapid local experimentation, but it's not supported for CI/Fly.io deployments. If you temporarily mount plugins for local dev, remember to revert and rebuild the image for production.

## Performance Testing

### Monitor Resource Usage

```bash
# Watch container stats
docker stats tracker

# Expected resource usage (development mode):
# - Memory: 150-300MB (Vite + SvelteKit + Node.js)
# - CPU: <5% idle, <20% under load with Vite compilation
```

### Load Testing

```bash
# Using Apache Bench (install: apt-get install apache2-utils)
ab -n 100 -c 10 http://localhost:8096/

# Using wrk (install: brew install wrk)
wrk -t4 -c100 -d30s http://localhost:8096/
```

## Cleanup

```bash
# Remove container
docker rm tracker

# Remove image
docker rmi owlcms-tracker:local

# Remove all dangling images
docker image prune

# Full cleanup
docker system prune -a
```

## Troubleshooting

### Container Exits Immediately

```bash
# Check logs
docker logs tracker

# Run with interactive terminal to see errors
docker run -it owlcms-tracker:local

# Common issues:
# - Node.js crashes: Check for missing dependencies
# - Port already in use: Change port: docker run -p 9000:8096
# - Build errors: Check Dockerfile syntax
```

### WebSocket Connection Fails

```bash
# Check if port is exposed
docker ps

# Check container network
docker inspect tracker | grep -A 10 NetworkSettings

# Test internal connectivity
docker exec tracker wget http://localhost:8096/
```

### Memory Issues

```bash
# Limit memory usage
docker run -m 512m -p 8096:8096 owlcms-tracker:local

# Monitor memory
docker stats tracker

# If out of memory: increase limits or reduce scoreboards
```

## Next Steps

1. Build image locally: `docker build -t owlcms-tracker:local .`
2. Test locally: `docker run -p 8096:8096 owlcms-tracker:local`
3. Test with OWLCMS: Configure WebSocket URL to `ws://localhost:8096/ws`
4. Push to registry: `docker tag owlcms-tracker:local owlcms/tracker:latest && docker push owlcms/tracker:latest`
5. Deploy to Fly.io: `flyctl deploy`

## References

- [Docker CLI Reference](https://docs.docker.com/engine/reference/commandline/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Docker Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [SvelteKit Adapter Node](https://kit.svelte.dev/docs/adapters)
