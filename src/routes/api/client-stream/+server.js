import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Server-Sent Events endpoint for browser clients
 * One-way push from server to browsers
 * 
 * Sends raw competition state - individual plugins process this data
 * using their own helpers when needed.
 */
export async function GET({ request }) {
  const connectionId = Math.random().toString(36).substr(2, 9);
  console.log(`[SSE] New client connection: ${connectionId}`);
  
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      let unsubscribe = null;
      
      const send = (data) => {
        if (isClosed) {
          console.log(`[SSE] ${connectionId}: Attempted to send to closed connection`);
          return;
        }
        
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error(`[SSE] ${connectionId}: Error sending message:`, error.message);
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return; // Already cleaned up
        
        console.log(`[SSE] ${connectionId}: Cleaning up connection`);
        isClosed = true;
        
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        
        try {
          controller.close();
        } catch (error) {
          // Controller might already be closed - ignore
        }
      };

      // Send initial state if available
      const currentState = competitionHub.getState();
      if (currentState) {
        send({
          type: 'state_update',
          data: currentState,
          timestamp: Date.now()
        });
      } else {
        send({
          type: 'waiting',
          message: 'No competition data available yet',
          timestamp: Date.now()
        });
      }

      // Subscribe to hub updates
      unsubscribe = competitionHub.subscribe((data) => {
        if (!isClosed) {
          send(data);
        }
      });

      // NO KEEPALIVE - this might be causing the issues
      // We'll rely on the browser's natural connection management
      
      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}