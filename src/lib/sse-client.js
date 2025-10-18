/**
 * Global SSE client - shared across all scoreboard tabs in the same browser
 * Prevents hitting the 6-connection-per-host browser limit
 */

let eventSource = null;
let subscribers = new Set();
let connectionId = Math.random().toString(36).substr(2, 9);
let language = 'en';
let clientCount = 0;

/**
 * Connect to SSE stream (called once, reused by all pages)
 * @param {string} lang - Language code (default: 'en')
 */
export function connectSSE(lang = 'en') {
	language = lang;
	
	// If already connected and language matches, reuse
	if (eventSource && eventSource.readyState === EventSource.OPEN) {
		return eventSource;
	}
	
	// Close old connection if language changed
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
	
	eventSource = new EventSource(`/api/client-stream?lang=${lang}`);
	
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
	console.log(`[SSE] Client connected (${clientCount} active, lang=${language})`);
	
	// Ensure connection is open
	if (!eventSource || eventSource.readyState !== EventSource.OPEN) {
		connectSSE(language);
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
