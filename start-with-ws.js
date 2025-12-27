

#!/usr/bin/env node

/**
 * Start SvelteKit built server and attach the WebSocket upgrade handler
 * so the /ws endpoint accepts OWLCMS WebSocket connections in production.
 */

import { exec } from 'child_process';

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
    process.env.PORT = process.env.PORT || '8096';

    // Import built server (adapter-node output)
    const built = await import('./build/index.js');

    // Attempt to attach WebSocket server if available
    try {
      const { initWebSocketServer } = await import('./build/lib/server/websocket-server.js');
      // built.server is the Polka instance; its http server is at built.server.server
      if (built && built.server && built.server.server) {
        initWebSocketServer(built.server.server);
        console.log('[Startup] WebSocket server attached to HTTP server');
      } else {
        console.warn('[Startup] Unable to locate built.server.server - WebSocket not attached');
      }
    } catch (err) {
      console.warn('[Startup] Skipping WebSocket initialization:', err?.message || err);
    }

    // Open browser automatically (skip in Docker/headless environments)
    if (!process.env.DOCKER && !process.env.NO_BROWSER) {
      const url = `http://localhost:${process.env.PORT}`;
      const platform = process.platform;
      
      // Small delay to ensure server is ready
      setTimeout(() => {
        let cmd;
        if (platform === 'win32') {
          cmd = `start "" "${url}"`;
        } else if (platform === 'darwin') {
          cmd = `open "${url}"`;
        } else {
          // Linux - try xdg-open (common on desktop Linux)
          cmd = `xdg-open "${url}" 2>/dev/null || echo "Open browser to ${url}"`;
        }
        
        exec(cmd, (err) => {
          if (err && platform !== 'linux') {
            console.log(`[Startup] Could not open browser. Navigate to: ${url}`);
          }
        });
      }, 500);
    }

  } catch (err) {
    console.error('Failed to start built server:', err);
    process.exit(1);
  }
})();
