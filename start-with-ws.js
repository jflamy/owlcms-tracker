#!/usr/bin/env node

/**
 * Start SvelteKit built server and attach the WebSocket upgrade handler
 * so the /ws endpoint accepts OWLCMS WebSocket connections in production.
 */

import { createServer } from 'http';
import { handler } from './build/handler.js';

// Add global uncaught exception handler to prevent crashes from abrupt connection resets
process.on('uncaughtException', (err) => {
  // ECONNRESET is normal when OWLCMS disconnects abruptly - log but don't crash
  if (err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) {
    console.warn('[Error] Connection reset by OWLCMS (normal during disconnection)');
    return; // Don't crash
  }
  
  // Log other unexpected errors but try to continue
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  // For critical errors, you could still exit: process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Warning] Unhandled Rejection:', reason);
  // Don't exit - let the app continue running
});

(async () => {
  try {
    // Set port for adapter-node (default 5173, but we want 8096)
    const PORT = process.env.PORT || '8096';

    // Create HTTP server to serve SvelteKit app
    const httpServer = createServer(handler);

    // Attach WebSocket server for OWLCMS connections
    try {
      const { initializeWebSocketServer } = await import('./build/lib/server/initialize-server.js');
      await initializeWebSocketServer(httpServer);
      console.log('[Startup] WebSocket server attached to HTTP server');
    } catch (err) {
      console.warn('[Startup] WebSocket initialization warning:', err?.message || err);
      console.warn('[Startup] OWLCMS connections will not work without WebSocket');
    }

    // Start the server
    httpServer.listen(PORT, () => {
      console.log(`[Startup] Server running on http://localhost:${PORT}`);
    });

    // Store HTTP server reference for shutdown gracefully
    globalThis.__httpServer = httpServer;

  } catch (error) {
    console.error('❌ Startup error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
