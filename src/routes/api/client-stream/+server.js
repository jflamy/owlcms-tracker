import { competitionHub } from '$lib/server/competition-hub.js';
import { sseBroker } from '$lib/server/sse-broker.js';

/**
 * Server-Sent Events endpoint for browser clients
 * One-way push from server to browsers
 * 
 * The SSE broker listens to hub events and broadcasts to all clients.
 * This endpoint registers clients with the broker and sends initial state.
 */
export async function GET({ request, url }) {
  const connectionId = Math.random().toString(36).substr(2, 9);
  
  // Get language preference from query parameter (default: 'en')
  const language = url.searchParams.get('lang') || 'en';
  // Get FOP filter (null = global events only, specific FOP = that FOP + global)
  const fopName = url.searchParams.get('fop') || null;
  console.log(`[SSE] New client connection: ${connectionId} (language: ${language}, FOP: ${fopName || 'global'})`);
  
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      
      const send = (dataOrBytes) => {
        if (isClosed) {
          return;
        }

        try {
          // Check if we received pre-encoded bytes or raw data
          if (dataOrBytes instanceof Uint8Array) {
            // Pre-encoded from broker - send directly
            controller.enqueue(dataOrBytes);
          } else {
            // Raw data (initial state, translations) - encode here
            const message = `data: ${JSON.stringify(dataOrBytes)}\n\n`;
            controller.enqueue(encoder.encode(message));
          }
        } catch (error) {
          console.error(`[SSE] ${connectionId}: Error sending message:`, error.message);
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        
        console.log(`[SSE] ${connectionId}: Cleaning up connection`);
        isClosed = true;
        
        // Unregister client from broker
        unregisterClient();
        
        try {
          controller.close();
        } catch (error) {
          // Controller might already be closed - ignore
        }
      };
      
      // Register client with broker - broker handles hub events and broadcasts
      // Pass fopName so broker can filter FOP-specific events
      const unregisterClient = sseBroker.registerClient(send, connectionId, fopName);
      
      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup);
      if (request.signal.aborted) {
        cleanup();
        return;
      }

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
      
      // If hub is already ready, explicitly send hub_ready so browser knows to fetch data
      if (competitionHub.isReady()) {
        send({
          type: 'hub_ready',
          message: 'Hub ready - reconnected with data available',
          timestamp: Date.now()
        });
      }

      // Send translations for the requested language
      const translations = competitionHub.getTranslations(language);
      if (translations && Object.keys(translations).length > 0) {
        send({
          type: 'translations',
          locale: language,
          data: translations,
          keyCount: Object.keys(translations).length,
          timestamp: Date.now()
        });
      } else if (language !== 'en') {
        // Fallback to English if requested language not available
        const enTranslations = competitionHub.getTranslations('en');
        if (enTranslations && Object.keys(enTranslations).length > 0) {
          console.log(`[SSE] ${connectionId}: Language '${language}' not available, falling back to 'en'`);
          send({
            type: 'translations',
            locale: 'en',
            data: enTranslations,
            keyCount: Object.keys(enTranslations).length,
            timestamp: Date.now()
          });
        }
      }
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