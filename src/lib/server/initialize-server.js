/**
 * Server Initialization Helper
 * 
 * Attaches the WebSocket server to the HTTP server for both dev and production modes.
 * Called from:
 * - vite.config.js (Vite dev server)
 * - build/index.js (Production server)
 * - start-with-ws.js (Custom production startup)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { competitionHub } from './competition-hub.js';
import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Initialize WebSocket server on the given HTTP server
 */
export async function initializeWebSocketServer(httpServer) {
  try {
    attachWebSocketToServer({
      server: httpServer,
      path: '/ws',
      hub: competitionHub,
      localFilesDir: path.join(process.cwd(), 'local'),
      localUrlPrefix: '/local',
      onConnect: () => console.log('[WebSocket] OWLCMS connected'),
      onDisconnect: () => console.log('[WebSocket] OWLCMS disconnected'),
      onError: (error) => console.error('[WebSocket] Error:', error.message)
    });
    
    console.log('[WebSocket] Server initialized on /ws');
    return true;
  } catch (error) {
    console.error('[WebSocket] Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Get the HTTP server from a SvelteKit/adapter-node server
 * Different adapters expose the HTTP server differently
 */
export function getHttpServer(svelteKitServer) {
  // Try different possible locations of the HTTP server
  if (svelteKitServer?.server?.server) {
    return svelteKitServer.server.server; // Polka adapter
  }
  if (svelteKitServer?.server) {
    return svelteKitServer.server; // Direct HTTP server
  }
  if (svelteKitServer?.httpServer) {
    return svelteKitServer.httpServer; // Vite dev server
  }
  return null;
}

export { competitionHub };
