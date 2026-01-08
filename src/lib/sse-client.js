/**
 * Global SSE client - shared across all scoreboard tabs in the same browser
 * Prevents hitting the 6-connection-per-host browser limit
 */

let eventSource = null;
let subscribers = new Set();
let connectionId = Math.random().toString(36).substr(2, 9);
let language = 'en';
let currentFop = null;
let clientCount = 0;

/**
 * Connect to SSE stream (called once, reused by all pages)
 * @param {string} lang - Language code (default: 'en')
 * @param {string|null} fop - FOP name to filter events (null = global events only)
 */
export function connectSSE(lang = 'en', fop = null) {
	language = lang;
	
	// If already connected and language+FOP match, reuse
	if (eventSource && eventSource.readyState === EventSource.OPEN && currentFop === fop) {
		return eventSource;
	}
	
	// Close old connection if language or FOP changed
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
	
	currentFop = fop;
	const fopParam = fop ? `&fop=${encodeURIComponent(fop)}` : '';
	eventSource = new EventSource(`/api/client-stream?lang=${lang}${fopParam}`);
	
	eventSource.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data);
			// Broadcast to all subscribers
			subscribers.forEach(callback => {
				try {
					callback(message);
				} catch (err) {
					console.error('[SSE] Subscriber error:', err);
				}
			});
		} catch (err) {
			console.error('[SSE] Message parse error:', err);
		}
	};
	
	eventSource.onerror = (error) => {
		console.error('[SSE] Connection error:', error);
		if (eventSource.readyState === EventSource.CLOSED) {
			eventSource = null;
		}
	};
	
	return eventSource;
}

/**
 * Subscribe to SSE messages
 * @param {Function} callback - Called with each message
 * @returns {Function} Unsubscribe function
 */
export function subscribeSSE(callback) {
	subscribers.add(callback);
	clientCount++;
	console.log(`[SSE] Client connected (${clientCount} active, lang=${language}, fop=${currentFop || 'global'})`);
	
	// Ensure connection is open
	if (!eventSource || eventSource.readyState !== EventSource.OPEN) {
		connectSSE(language, currentFop);
	}
	
	// Return unsubscribe function
	return () => {
		subscribers.delete(callback);
		clientCount--;
		console.log(`[SSE] Client disconnected (lang=${language}). ${clientCount} active`);
		
		// Close connection if no more subscribers
		if (subscribers.size === 0 && eventSource) {
			eventSource.close();
			eventSource = null;
		}
	};
}

/**
 * Get current language
 */
export function getLanguage() {
	return language;
}

/**
 * Get subscriber count (for debugging)
 */
export function getSubscriberCount() {
	return subscribers.size;
}
