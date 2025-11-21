import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Server-Sent Events endpoint for browser clients
 * One-way push from server to browsers
 * 
 * Sends raw competition state - individual plugins process this data
 * using their own helpers when needed.
 */
export async function GET({ request, url }) {
  const connectionId = Math.random().toString(36).substr(2, 9);
  
  // Get language preference from query parameter (default: 'en')
  const language = url.searchParams.get('lang') || 'en';
  console.log(`[SSE] New client connection: ${connectionId} (language: ${language})`);
  
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
      // Ensure we listen for client aborts as early as possible to avoid races
      // where the request was aborted before the listener was registered.
      request.signal.addEventListener('abort', cleanup);
      if (request.signal.aborted) {
        // Client already disconnected - clean up immediately
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

      // Send translations for the requested language only
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

      // Subscribe to hub updates (future broadcasts)
      unsubscribe = competitionHub.subscribe((data) => {
        if (!isClosed) {
          send(data);
        }
      });

      // NO KEEPALIVE - rely on browser's connection management for now
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