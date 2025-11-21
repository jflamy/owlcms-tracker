/**
 * WebSocket server for receiving OWLCMS events
 * Handles wrapped messages with {type, payload} structure
 */

import { WebSocketServer } from 'ws';
import { competitionHub } from './competition-hub.js';
import { captureMessage, LEARNING_MODE } from './learning-mode.js';
import { extractEmbeddedDatabase } from './embedded-database.js';
import { handleBinaryMessage } from './binary-handler.js';

let wss = null;

/**
 * Initialize WebSocket server
 * Called by Vite plugin during server startup
 */
export function initWebSocketServer(httpServer) {
	if (wss) return; // Already initialized
	
	wss = new WebSocketServer({ noServer: true });
	
	wss.on('connection', (ws) => {
		console.log('[WebSocket] Client connected');
		
		// Use raw message event which provides both data and a flag for isBinary
		ws.on('message', async (data, isBinary) => {
			// Strictly follow OWLCMS spec:
			// - If isBinary is true, frame is binary with [4-byte length][type][payload]
			// - If isBinary is false, frame is JSON text
			
			if (isBinary) {
				// Binary frame: [4-byte big-endian typeLength][type UTF-8][binary payload]
				try {
					console.log('[WebSocket] Binary frame received, routing to binary handler');
					await handleBinaryMessage(data);
					return;
				} catch (binaryError) {
					console.error('[WebSocket] ERROR: Unable to process binary message:', binaryError.message);
					ws.send(JSON.stringify({ error: `Unable to process binary message: ${binaryError.message}` }));
					return;
				}
			}

			// Text frame: JSON with {"type":"...","payload":{...}}
			try {
				const message = JSON.parse(data.toString());
				const messageType = message.type ? message.type.toUpperCase() : 'OTHER';
				console.log(`[WebSocket] Text frame received, message type: ${messageType}`);
				
				// Capture message in learning mode using explicit WebSocket type
				if (LEARNING_MODE) {
					const explicitType = getCaptureLabel(messageType, message.payload);
					captureMessage(message.payload || message, data.toString(), 'WEBSOCKET', explicitType);
				}
				
				if (!message.type || !message.payload) {
					ws.send(JSON.stringify({ error: 'Invalid message format. Expected {type, payload}' }));
					return;
				}
				
				const hasBundledDatabase = Object.prototype.hasOwnProperty.call(message.payload, 'database');
				if (hasBundledDatabase) {
					await handleDatabaseEnvelope(message.payload);
				}

				// Route based on message type
				let result;
				switch (message.type) {
					case 'database':
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
		});
	});
	
	// Handle upgrade requests
	httpServer.on('upgrade', (request, socket, head) => {
		const { pathname } = new URL(request.url, `http://${request.headers.host}`);

		if (pathname !== '/ws') {
			return; // Allow other upgrade listeners (e.g., Vite HMR) to handle
		}

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
	// The payload is the actual competition database object
	// { athletes: [...], groups: [...], competition: {...}, etc. }
	const result = competitionHub.handleFullCompetitionData(payload);
	
	if (result.accepted) {
		console.log('[WebSocket] ✅ Full competition data accepted and loaded');
		
		// Run sanity check after successful database load
		verifySanityAfterDatabase();
		
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

	const result = competitionHub.handleOwlcmsMessage(payload);
	const missing = competitionHub.getMissingPreconditions();

	if (isDatabaseComing) {
		console.log(`[WebSocket] ${uiEvent} update received${hasBundledDatabase ? ' with embedded database' : ' without embedded database'}`);

		if (missing.includes('translations')) {
			console.log(`[WebSocket] ${uiEvent} processed but translations missing - requesting translations`);
			return {
				status: 428,
				message: 'Precondition Required: Missing required data',
				reason: 'missing_translations',
				missing: missing
			};
		}

		if (!hasBundledDatabase && !competitionHub.getDatabaseState()) {
			console.log(`[WebSocket] ${uiEvent} processed but database missing - requesting database`);
			return {
				status: 428,
				message: 'Precondition Required: Missing required data',
				reason: 'no_database_state',
				missing: missing
			};
		}

		return mapHubResultToResponse(result, 'update');
	}

	if (!competitionHub.getDatabaseState() && !isDatabaseComing && !hasBundledDatabase) {
		console.log(`[WebSocket] Update received (${uiEvent}) but no database - requesting database`);
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: result?.reason || 'no_database_state',
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
	// If we still have no database, request it from OWLCMS
	if (!competitionHub.getDatabaseState() && !hasBundledDatabase) {
		console.log('[WebSocket] Timer received but no database - requesting database');
		const interimResult = competitionHub.handleOwlcmsMessage(payload);
		const missing = competitionHub.getMissingPreconditions();
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: interimResult?.reason || 'no_database_state',
			missing: missing
		};
	}

	const result = competitionHub.handleOwlcmsMessage(payload);
	return mapHubResultToResponse(result, 'timer');
}

/**
 * Handle decision message - same payload as POST /decision
 */
async function handleDecisionMessage(payload, hasBundledDatabase = false) {
	if (!competitionHub.getDatabaseState() && !hasBundledDatabase) {
		console.log('[WebSocket] Decision received but no database - requesting database');
		const interimResult = competitionHub.handleOwlcmsMessage(payload);
		const missing = competitionHub.getMissingPreconditions();
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: interimResult?.reason || 'no_database_state',
			missing: missing
		};
	}

	const result = competitionHub.handleOwlcmsMessage(payload);
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
		const interimResult = competitionHub.handleOwlcmsMessage(payload);
		const missing = competitionHub.getMissingPreconditions();
		return {
			status: 428,
			message: 'Precondition Required: Missing required data',
			reason: interimResult?.reason || 'no_database_state',
			missing: missing
		};
	}

	const result = competitionHub.handleOwlcmsMessage(payload);
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
