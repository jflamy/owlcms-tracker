/**
 * WebSocket server for receiving OWLCMS events
 * Handles wrapped messages with {type, payload, version} structure
 */

import { WebSocketServer } from 'ws';
import { competitionHub } from './competition-hub.js';
import { captureMessage, LEARNING_MODE } from './learning-mode.js';
import { extractEmbeddedDatabase } from './embedded-database.js';
import { handleBinaryMessage } from './binary-handler.js';
import { extractAndValidateVersion } from './protocol-config.js';

let wss = null;
let activeConnection = null; // Track active WebSocket connection for sending messages

/**
 * Request resources from OWLCMS
 * Called by plugins when they need resources that aren't loaded yet
 * @param {string[]} resources - Array of resource types to request (e.g., ['flags_zip', 'logos_zip'])
 */
export function requestResources(resources) {
	if (!activeConnection || activeConnection.readyState !== 1) {
		console.log('[WebSocket] Cannot request resources - no active OWLCMS connection');
		return;
	}
	
	if (!resources || resources.length === 0) {
		return;
	}
	
	console.log(`[WebSocket] 📦 Requesting resources from OWLCMS: ${resources.join(', ')}`);
	activeConnection.send(JSON.stringify({
		status: 428,
		message: 'Precondition Required: Plugin needs resources',
		reason: 'plugin_preconditions',
		missing: resources
	}));
}

/**
 * Initialize WebSocket server
 * Called by Vite plugin during server startup
 */
export function initWebSocketServer(httpServer) {
	if (wss) return; // Already initialized
	
	wss = new WebSocketServer({ noServer: true });
	
		// Track if this is the first connection since server start
		let firstConnectionHandled = false;

		wss.on('connection', (ws) => {
			console.log('[WebSocket] Client connected');
			activeConnection = ws; // Store active connection for sending resource requests

			// Track authentication status for this connection
			let clientAuthenticated = !process.env.OWLCMS_UPDATEKEY;

			// Per-connection state: track if we've received a database for this connection
			let hasReceivedDatabase = false;

			// Helper to flush caches and reset state only on the first connection after server start
			async function flushAndResetOnce() {
				if (!firstConnectionHandled) {
					try {
						// Try to flush scoreboard caches (may fail during HMR, that's OK)
						try {
							const { scoreboardRegistry } = await import('./scoreboard-registry.js');
							scoreboardRegistry.flushCaches();
						} catch (e) {
							// Silently ignore - scoreboard caches will be invalidated by hub state version anyway
						}
						// Reset the database and translations in the hub
						competitionHub.databaseState = null;
						competitionHub.lastDatabaseChecksum = null;
						competitionHub.translations = {};
						competitionHub.lastTranslationsChecksum = null;
					// Clear flags, logos, and pictures (they will be reloaded via 428)
					competitionHub.flagsLoaded = false;
					competitionHub.logosLoaded = false;
						if (competitionHub.picturesLoaded !== undefined) competitionHub.picturesLoaded = false;
						if (competitionHub.stylesLoaded !== undefined) competitionHub.stylesLoaded = false;
						// Optionally clear any other relevant state here
						console.log('[WebSocket] First connection: caches flushed, database and translations reset, flags/pictures cleared');
					} catch (err) {
						console.error('[WebSocket] Error during first connection reset:', err.message);
					}
					firstConnectionHandled = true;
				}
			}

			// Use raw message event which provides both data and a flag for isBinary
			ws.on('message', async (data, isBinary) => {
			// Strictly follow OWLCMS spec:
			// - If isBinary is true, frame is binary with [4-byte length][type][payload]
			// - If isBinary is false, frame is JSON text
			
			// Check authentication for ALL frames (text and binary)
			// If OWLCMS_UPDATEKEY is configured, only accept frames from authenticated clients
			if (process.env.OWLCMS_UPDATEKEY && !clientAuthenticated) {
				// For text frames, we'll check the key below
				// For binary frames, reject because we can't verify the key
				if (isBinary) {
					console.warn('[WebSocket] ⚠️ Binary frame rejected - client not authenticated (missing updateKey from previous text frame)');
					ws.send(JSON.stringify({ status: 401, message: 'Not authenticated. Send text frame with valid updateKey first' }));
					ws.close(1008, 'Unauthorized: binary frame requires prior authentication');
					return;
				}
			}
			
			if (isBinary) {
				// Binary frame: [4-byte big-endian typeLength][type UTF-8][binary payload]
				try {
					if (process.env.BINARY_DEBUG === 'true') {
						console.log('[WebSocket] Binary frame received, routing to binary handler');
					}
					// Detect if this is a database_zip or database binary and flush/reset only on first connection
					let typeString = null;
					try {
						if (data.length >= 8) {
							const firstLength = data.readUInt32BE(0);
							let offset = 4 + firstLength;
							if (data.length >= offset + 4) {
								const typeLength = data.readUInt32BE(offset);
								offset += 4;
								if (data.length >= offset + typeLength) {
									typeString = data.slice(offset, offset + typeLength).toString('utf8');
								}
							}
						}
						if (!typeString && data.length >= 4) {
							const typeLength = data.readUInt32BE(0);
							if (data.length >= 4 + typeLength) {
								typeString = data.slice(4, 4 + typeLength).toString('utf8');
							}
						}
					} catch (peekErr) {}
					if (typeString && (typeString === 'database_zip' || typeString === 'database')) {
						await flushAndResetOnce();
					}
					await handleBinaryMessage(data);
					return;
				} catch (binaryError) {
					console.error('[WebSocket] ERROR: Unable to process binary message:', binaryError.message);
					ws.send(JSON.stringify({ error: `Unable to process binary message: ${binaryError.message}` }));
					return;
				}
			}

			// Text frame: JSON with {"version":"2.0.0","type":"...","payload":{...}}
			try {
				const message = JSON.parse(data.toString());
				const messageType = message.type ? message.type.toUpperCase() : 'OTHER';
				console.log(`[WebSocket] Text frame received, message type: ${messageType}`);
				
				// Validate protocol version
				const versionCheck = extractAndValidateVersion(message);
				if (!versionCheck.valid) {
					console.error(`[WebSocket] ❌ Version validation failed: ${versionCheck.error}`);
					ws.send(JSON.stringify({
						status: 400,
						error: 'Protocol version check failed',
						reason: versionCheck.error,
						details: {
							received: versionCheck.version,
							info: 'Please ensure OWLCMS is configured with the correct tracker WebSocket URL and is up to date'
						}
					}));
					return;
				}
				console.log(`[WebSocket] ✅ Protocol version validated: ${versionCheck.version}`);
				
				// Capture message in learning mode using explicit WebSocket type
				if (LEARNING_MODE) {
					const explicitType = getCaptureLabel(messageType, message.payload);
					// Do not include a redundant 'WEBSOCKET' token in sample filenames
					captureMessage(message.payload || message, data.toString(), '', explicitType);
				}
				
				if (!message.type || !message.payload) {
					ws.send(JSON.stringify({ error: 'Invalid message format. Expected {version, type, payload}' }));
					return;
				}

				// If a shared secret is configured, enforce it here. OWLCMS may send
				// an `updateKey` in the payload; if it does not match the configured
				// `OWLCMS_UPDATEKEY` environment variable, reject with 401 (unauthorized).
				const expectedKey = process.env.OWLCMS_UPDATEKEY;
				if (expectedKey) {
					const incomingKey = message.payload?.updateKey || message.payload?.update_key || message.payload?.updatekey;
					if (!incomingKey || String(incomingKey) !== String(expectedKey)) {
						console.warn('[WebSocket] ⚠️ Unauthorized update attempt - missing/invalid OWLCMS_UPDATEKEY');
						ws.send(JSON.stringify({ status: 401, message: 'Access not authorized' }));
						ws.close(1008, 'Unauthorized: invalid updateKey');
						return;
					}
					// Authentication successful - mark this client as authenticated for binary frames
					clientAuthenticated = true;
				}
				
				const hasBundledDatabase = Object.prototype.hasOwnProperty.call(message.payload, 'database');
				if (hasBundledDatabase) {
					await handleDatabaseEnvelope(message.payload);
				}

				// Route based on message type
				let result;
				switch (message.type) {
					case 'database':
						await flushAndResetOnce();
						result = await handleDatabaseMessage(message.payload);
						break;
					case 'update':
						result = await handleUpdateMessage(message.payload, hasBundledDatabase);
						break;
					case 'timer':
						result = await handleTimerMessage(message.payload, hasBundledDatabase);
						break;
					case 'decision':
						result = await handleDecisionMessage(message.payload, hasBundledDatabase);
						break;
					default:
						result = await handleGenericMessage(message.payload, hasBundledDatabase, message.type);
				}

				ws.send(JSON.stringify(result));
			} catch (error) {
				console.error('[WebSocket] ERROR: Unable to parse JSON text frame:', error.message);
				ws.send(JSON.stringify({ error: `Unable to parse JSON: ${error.message}` }));
			}
		});

		ws.on('close', () => {
			console.log('[WebSocket] Client disconnected');
			if (activeConnection === ws) {
				activeConnection = null;
			}
		});

		ws.on('error', (error) => {
			console.error('[WebSocket] Connection error:', error.message);
			console.error('[WebSocket] Error details:', error.stack);
		});

		// Detect disconnection (normal) vs crash (abnormal)
		ws.on('close', (code, reason) => {
			if (code >= 4000) {
				console.error(`[WebSocket] Abnormal close: code=${code}, reason="${reason}"`);
			} else {
				console.log(`[WebSocket] Client disconnected normally: code=${code}, reason="${reason}"`);
			}

			try {
				// When the OWLCMS connection closes, force the hub into a waiting state
				// so browsers show 'Waiting for Competition Data'. This avoids stale UI
				// when the authoritative source disconnects.
				console.log('[WebSocket] OWLCMS connection closed - forcing hub refresh (entering waiting state)');
				competitionHub.refresh();
			} catch (err) {
				console.error('[WebSocket] Error while refreshing hub state after WS close:', err?.message || err);
			}
		});
	});
	
	// Handle upgrade requests
	httpServer.on('upgrade', (request, socket, head) => {
		// Skip if already handled by proxy
		if (request._proxyHandled) return;
		
		const { pathname } = new URL(request.url, `http://${request.headers.host}`);
		
		if (pathname !== '/ws') {
			// Don't log proxy paths - they're handled elsewhere
			if (!pathname.startsWith('/proxy')) {
				console.log(`[WebSocket] Ignoring upgrade for ${pathname} (not /ws)`);
			}
			return; // Allow other upgrade listeners (e.g., Vite HMR) to handle
		}

		const localPort = request.socket.localPort;
		console.log(`[WebSocket] Upgrade request received for: ${pathname} from ${request.socket.remoteAddress} on local port ${localPort}`);
		console.log('[WebSocket] Handling upgrade for /ws');
		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit('connection', ws, request);
		});
	});
	
	console.log('[WebSocket] Server initialized on /ws endpoint');
}

/**
 * Sanity check after database load
 * Verifies database structure and data integrity
 */
function verifySanityAfterDatabase() {
	try {
		const db = competitionHub.getDatabaseState();
		if (!db) {
			console.warn('[Sanity] ⚠️  Database state is null');
			return false;
		}

		// Verify required fields
		if (!Array.isArray(db.athletes) || db.athletes.length === 0) {
			console.warn('[Sanity] ⚠️  Database has no athletes');
			return false;
		}

		// Verify athlete IDs are unique
		const athleteIds = new Set();
		for (const athlete of db.athletes) {
			if (athlete.id && athleteIds.has(athlete.id)) {
				console.warn(`[Sanity] ⚠️  Duplicate athlete ID: ${athlete.id}`);
				return false;
			}
			if (athlete.id) athleteIds.add(athlete.id);
		}

		// Log sanity results
		const groupCount = Array.isArray(db.ageGroups) ? db.ageGroups.length : 0;
		console.log(`[Sanity] ✅ Database: ${db.athletes.length} athletes, ${groupCount} age groups, ${athleteIds.size} unique IDs`);
		return true;
	} catch (error) {
		console.error(`[Sanity] ❌ Database verification failed:`, error.message);
		return false;
	}
}

/**
 * Handle database message - same payload as POST /database
 */
async function handleDatabaseMessage(payload) {
        // Check if this is an empty database message (athletes array absent or empty)
        const hasAthletes = Array.isArray(payload.athletes) && payload.athletes.length > 0;

        if (!hasAthletes) {
                // Empty database - expecting binary to follow
                console.log('[WebSocket] Empty database message received - expecting database_zip binary message');
                console.log(`[WebSocket]   Competition: ${payload.competition?.name || 'unknown'}`);
                console.log(`[WebSocket]   Waiting up to 5 seconds for database_zip binary frame...`);

                // Store metadata and set pending state
                const result = competitionHub.handleFullCompetitionData(payload);

                return {
                        status: 202,
                        message: 'Empty database stored - expecting database_zip binary message',
                        pending: true,
                        reason: 'awaiting_binary_database',
                        timeout: 5000
                };
        }

        // Full database (has athletes)
	const result = competitionHub.handleFullCompetitionData(payload);
	
	if (result.accepted) {
		console.log('[WebSocket] ✅ Full competition data accepted and loaded');
		
		// Run sanity check after successful database load
		verifySanityAfterDatabase();
		
		// Flush plugin-level caches when OWLCMS sends a new database
		// This ensures scoreboards don't serve stale cached data from a previous session
		try {
			const { scoreboardRegistry } = await import('./scoreboard-registry.js');
			scoreboardRegistry.flushCaches();
		} catch (err) {
			console.error('[WebSocket] Error flushing scoreboard caches:', err.message);
		}
		
		// OWLCMS sends translations_zip and flags_zip at socket open via startup callback
		// Don't request them again after database is received - they will arrive independently
		return { status: 200, message: 'Full competition data loaded successfully' };
	} else {
		console.log('[WebSocket] ❌ Failed to process full competition data');
		return { status: 500, message: result.reason || 'Unable to process full competition data' };
	}
}

/**
 * Handle update message - same payload as POST /update
 */
async function handleUpdateMessage(payload, hasBundledDatabase = false) {
	const uiEvent = payload.uiEvent || '';
	const isDatabaseComing = uiEvent === 'SwitchGroup' || uiEvent === 'GroupDone';

	const result = competitionHub.handleOwlcmsMessage(payload, 'update');
	const missing = competitionHub.getMissingPreconditions();

	// Always check for missing preconditions and request them
	if (missing.length > 0) {
		console.log(`[WebSocket] Update processed but missing preconditions: ${missing.join(', ')}`);
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: 'missing_preconditions',
			missing: missing
		};
	}

	if (isDatabaseComing) {
		if (hasBundledDatabase) {
			console.log(`[WebSocket] Update received (${uiEvent}) with embedded database payload`);
		} else {
			console.log(`[WebSocket] Update received (${uiEvent}) - database message expected to follow`);
		}
	}

	return mapHubResultToResponse(result, 'update');
}

/**
 * Handle timer message - same payload as POST /timer
 */
async function handleTimerMessage(payload, hasBundledDatabase = false) {
	const result = competitionHub.handleOwlcmsMessage(payload, 'timer');
	const missing = competitionHub.getMissingPreconditions();

	// Request missing preconditions (database and/or translations)
	if (missing.length > 0) {
		console.log(`[WebSocket] Timer received but missing: ${missing.join(', ')}`);
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: 'missing_preconditions',
			missing: missing
		};
	}

	return mapHubResultToResponse(result, 'timer');
}

/**
 * Handle decision message - same payload as POST /decision
 */
async function handleDecisionMessage(payload, hasBundledDatabase = false) {
	const result = competitionHub.handleOwlcmsMessage(payload, 'decision');
	const missing = competitionHub.getMissingPreconditions();

	// Request missing preconditions (database and/or translations)
	if (missing.length > 0) {
		console.log(`[WebSocket] Decision received but missing: ${missing.join(', ')}`);
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: 'missing_preconditions',
			missing: missing
		};
	}

	return mapHubResultToResponse(result, 'decision');
}

async function handleDatabaseEnvelope(envelopePayload) {
	if (!envelopePayload) return;
	const envelopeClone = typeof envelopePayload === 'object' && envelopePayload !== null ? envelopePayload : { database: envelopePayload };
	const embeddedDatabase = extractEmbeddedDatabase(envelopeClone);

	if (embeddedDatabase.error) {
		throw new Error('Invalid database payload format');
	}

	if (!embeddedDatabase.hasDatabase) {
		return;
	}

	const result = competitionHub.handleFullCompetitionData(embeddedDatabase.payload);
	if (!result?.accepted) {
		throw new Error(result?.reason || 'Failed to process bundled database payload');
	}

	if (embeddedDatabase.checksum) {
		console.log(`[WebSocket] Embedded database processed (checksum ${embeddedDatabase.checksum})`);
	}
}

function mapHubResultToResponse(result, messageType) {
	if (!result) {
		return { status: 500, message: `Unable to process ${messageType}` };
	}

	if (result.accepted) {
		return { status: 200, message: `${capitalize(messageType)} processed` };
	}

	if (result.retry) {
		return { status: 202, message: 'Database load in progress, please retry' };
	}

	if (result.needsData) {
		const missing = competitionHub.getMissingPreconditions();
		return { 
			status: 428, 
			message: 'Precondition Required: Missing required data',
			missing: missing
		};
	}

	return { status: 500, message: result.reason || `Unable to process ${messageType}` };
}

/**
 * Handle translations message - contains all locales (language or language-country format)
 */
function capitalize(value) {
	return typeof value === 'string' && value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

async function handleGenericMessage(payload, hasBundledDatabase, type) {
	if (!competitionHub.getDatabaseState() && !hasBundledDatabase) {
		console.log(`[WebSocket] ${type} message received but no database - requesting database`);
		const interimResult = competitionHub.handleOwlcmsMessage(payload, type || 'generic');
		const missing = competitionHub.getMissingPreconditions();
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: interimResult?.reason || 'no_database_state',
			missing: missing
		};
	}

	const result = competitionHub.handleOwlcmsMessage(payload, type || 'generic');
	return mapHubResultToResponse(result, type || 'message');
}

function getCaptureLabel(messageType, payload = {}) {
	if (messageType !== 'UPDATE') return messageType;
	const uiEvent = typeof payload.uiEvent === 'string' ? payload.uiEvent.trim() : '';
	if (!uiEvent) return messageType;
	return `${messageType}-${sanitizeLabel(uiEvent)}`;
}

function sanitizeLabel(value) {
	return value
		.toUpperCase()
		.replace(/\s+/g, '_')
		.replace(/[^A-Z0-9_-]/g, '');
}
