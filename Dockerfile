# Dockerfile for owlcms-tracker SvelteKit application
# Multi-stage production build using adapter-node
# Plugins are statically bundled via Vite import.meta.glob at build time

# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install dependencies (including dev deps for build)
RUN npm ci

# Copy source code (plugins included via static import.meta.glob)
COPY . .

# Explicitly copy only the required plugins to reduce bundle size
RUN rm -rf src/plugins/*
COPY src/plugins/attempt-board ./src/plugins/attempt-board
COPY src/plugins/lifting-order ./src/plugins/lifting-order
COPY src/plugins/rankings ./src/plugins/rankings
COPY src/plugins/start-order ./src/plugins/start-order
COPY src/plugins/team-scoreboard ./src/plugins/team-scoreboard

# Build the application (will only include remaining plugins)
# Increase Node.js heap size to prevent OOM during build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Remove pre-compressed static files (server-side only, not needed)
RUN find build/client -name '*.gz' -delete && find build/client -name '*.br' -delete

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Copy package files from builder
COPY --from=builder /build/package*.json ./

# Copy built application
COPY --from=builder /build/build ./build

# Copy source server modules for websocket-server (needed by start-with-ws.js at runtime)
COPY --from=builder /build/src/lib/server ./build/lib/server

# Copy startup script that attaches WebSocket server
COPY --from=builder /build/start-with-ws.js ./start-with-ws.js

# Install production dependencies only
RUN npm ci --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 \
  && chown -R nodejs:nodejs /app

USER nodejs

# Set port for Node.js adapter
ENV PORT=8096

# Disable browser auto-open in container
ENV DOCKER=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8096/ || exit 1

EXPOSE 8096

ENTRYPOINT ["dumb-init", "--"]

# Run the built Node.js server
CMD ["node", "start-with-ws.js"]
