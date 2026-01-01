/**
 * WebSocket upgrade handler for OWLCMS connections
 * 
 * SvelteKit's adapter-node requires WebSocket handling in a special way.
 * This endpoint cannot use standard HTTP methods because the WebSocket
 * connection is handled at the HTTP server level (not SvelteKit level).
 * 
 * Instead, the WebSocket server must be attached to the Node.js HTTP server
 * in the hooks or startup script. This file serves as documentation of the
 * expected URL path only.
 * 
 * See: src/hooks.server.js for server initialization
 * See: src/lib/server/websocket-server.js for WebSocket implementation
 */

// This route is not directly callable - WebSocket upgrade happens at HTTP level
// If you see a 404 for /ws, the WebSocket server was not properly attached to the HTTP server

export async function GET({ request }) {
  return new Response(
    JSON.stringify({
      error: 'WebSocket endpoint not accessible via HTTP GET',
      message: 'Use WebSocket protocol: ws://localhost:8096/ws',
      docs: 'See src/hooks.server.js for WebSocket server initialization'
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export async function POST({ request }) {
  return new Response(
    JSON.stringify({
      error: 'WebSocket endpoint not accessible via HTTP POST',
      message: 'Use WebSocket protocol: ws://localhost:8096/ws',
      docs: 'See src/hooks.server.js for WebSocket server initialization'
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
