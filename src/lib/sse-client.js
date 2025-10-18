/**
 * Global SSE client - shared across all scoreboard tabs in the same browser
 * Prevents hitting the 6-connection-per-host browser limit
 */

let eventSource = null;
let subscribers = new Set();
let connectionId = Math.random().toString(36).substr(2, 9);
let language = 'en';

/**
 * Connect to SSE stream (called once, reused by all pages)
 * @param {string} lang - Language code (default: 'en')
 */
export function connectSSE(lang = 'en') {
	language = lang;
	
	// If already connected and language matches, reuse
	if (eventSource && eventSource.readyState === EventSource.OPEN) {
		console.log(`[SSE Client] Reusing existing connection (${subscribers.size} subscribers)`);
		return eventSource;
	}
	
	// Close old connection if language changed
	if (eventSource) {
		console.log(`[SSE Client] Language changed (${lang}), reconnecting`);
		eventSource.close();
		eventSource = null;
	}
	
	console.log(`[SSE Client] Connecting to /api/client-stream?lang=${lang}`);
	
	eventSource = new EventSource(`/api/client-stream?lang=${lang}`);
	
	eventSource.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data);
			// Broadcast to all subscribers
			subscribers.forEach(callback => {
				try {
					callback(message);
				} catch (err) {
					console.error('[SSE Client] Subscriber error:', err);
				}
			});
		} catch (err) {
			console.error('[SSE Client] Message parse error:', err);
		}
	};
	
	eventSource.onerror = (error) => {
		console.error('[SSE Client] Connection error:', error);
		if (eventSource.readyState === EventSource.CLOSED) {
			console.log('[SSE Client] Connection closed, will reconnect on next subscribe');
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
	
	// Ensure connection is open
	if (!eventSource || eventSource.readyState !== EventSource.OPEN) {
		connectSSE(language);
	}
	
	console.log(`[SSE Client] Subscriber added (${subscribers.size} total)`);
	
	// Return unsubscribe function
	return () => {
		subscribers.delete(callback);
		console.log(`[SSE Client] Subscriber removed (${subscribers.size} remaining)`);
		
		// Close connection if no more subscribers
		if (subscribers.size === 0 && eventSource) {
			console.log('[SSE Client] No more subscribers, closing connection');
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
