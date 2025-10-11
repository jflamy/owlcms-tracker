import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LEARNING_MODE = process.env.LEARNING_MODE === 'true';
const SAMPLES_DIR = 'samples';

// Ensure samples directory exists
if (LEARNING_MODE) {
	try {
		mkdirSync(SAMPLES_DIR, { recursive: true });
		console.log('🔬 LEARNING MODE ENABLED - Capturing messages to samples/ directory');
	} catch (err) {
		console.error('Failed to create samples directory:', err);
	}
}

/**
 * Detect message type from OWLCMS form data
 * @param {Object} formData - The parsed form data from OWLCMS
 * @returns {string} - Message type identifier
 */
function detectMessageType(formData) {
	// Check for common OWLCMS event types
	if (formData.uiEvent) {
		const event = formData.uiEvent.toLowerCase();
		
		// Timer events
		if (event.includes('timer_start') || event.includes('start_timer')) return 'TIMER_START';
		if (event.includes('timer_stop') || event.includes('stop_timer')) return 'TIMER_STOP';
		if (event.includes('timer')) return 'TIMER';
		
		// Decision events
		if (event.includes('decision') || event.includes('lift_result')) return 'DECISION';
		if (event.includes('good') || event.includes('no_lift')) return 'DECISION';
		
		// Update events
		if (event.includes('lifting_order') || event.includes('order')) return 'LIFTING_ORDER';
		if (event.includes('ranking') || event.includes('rank')) return 'RANKING';
		if (event.includes('athlete_update')) return 'ATHLETE_UPDATE';
		if (event.includes('full_state') || event.includes('competition_state')) return 'FULL_STATE';
		
		// Return the actual event if we can't categorize it
		return event.toUpperCase();
	}
	
	// Check for other identifying fields
	if (formData.decision || formData.liftResult) return 'DECISION';
	if (formData.timeRemaining || formData.timerDuration) return 'TIMER';
	if (formData.liftingOrder || formData.nextLifter) return 'LIFTING_ORDER';
	if (formData.rankings || formData.rank) return 'RANKING';
	if (formData.athletes && Array.isArray(formData.athletes)) return 'FULL_STATE';
	
	// Fallback to generic update
	return 'UPDATE';
}

/**
 * Capture incoming OWLCMS message with ISO8601 timestamp
 * @param {Object} formData - The parsed form data from OWLCMS
 * @param {string} rawBody - The raw request body
 * @param {string} endpoint - The endpoint that received the message (optional)
 * @param {string} overrideType - Optional explicit message type label
 */
export function captureMessage(formData, rawBody, endpoint = '', overrideType = '') {
	if (!LEARNING_MODE) return;

	try {
		// Create local timestamp in ISO8601 format (not UTC/Zulu)
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const ms = String(now.getMilliseconds()).padStart(3, '0');
		const timestamp = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${ms}`;
		
		const messageType = overrideType || detectMessageType(formData);
		const endpointPrefix = endpoint ? `${endpoint.toUpperCase()}-` : '';
		const filename = `${timestamp}-${endpointPrefix}${messageType}.json`;
		const filepath = join(SAMPLES_DIR, filename);

		// Check for malformed data (entire JSON as field name due to incorrect form encoding)
		const malformedKeys = Object.keys(formData).filter(k => k.length > 100 || k.includes('\r\n') || k.includes('{"'));
		if (malformedKeys.length > 0) {
			console.log('');
			console.log('⚠️  ================================ WARNING ================================');
			console.log('⚠️  MALFORMED DATA RECEIVED FROM BACKEND!');
			console.log('⚠️  The entire JSON payload is being sent as a field NAME, not field VALUE.');
			console.log('⚠️  This indicates the Java backend is incorrectly encoding the POST data.');
			console.log(`⚠️  Malformed field names detected: ${malformedKeys.length}`);
			console.log(`⚠️  Example (truncated): ${malformedKeys[0].substring(0, 80)}...`);
			console.log('⚠️  ========================================================================');
			console.log('');
		}

		// Save only the parsed form data - pure OWLCMS payload
		writeFileSync(filepath, JSON.stringify(formData, null, 2));
		
		console.log(`📝 Captured ${endpointPrefix}${messageType}: ${filename} (${rawBody.length} bytes)`);
		
		// Enhanced logging with message type (but not the actual data content)
		console.log(`📊 Message type: ${endpointPrefix}${messageType}`);
		// Only show field names, never the content (especially for huge database dumps)
		// Filter out malformed field names to prevent logging massive JSON strings
		const fieldNames = Object.keys(formData)
			.filter(k => k !== 'fullCompetitionData')
			.filter(k => k.length < 100 && !k.includes('\r\n') && !k.includes('{"'))
			.slice(0, 15);
		if (fieldNames.length > 0) {
			console.log(`📊 Message fields: ${fieldNames.join(', ')}${Object.keys(formData).length > 15 ? '...' : ''}`);
		}
		if (formData.fop) console.log(`🏋️  FOP: ${formData.fop}`);
		if (formData.uiEvent) console.log(`🎯 UI Event: ${formData.uiEvent}`);
		// Skip updateKey logging since we're ignoring auth for now
		
	} catch (err) {
		console.error('❌ Failed to capture message:', err);
	}
}

/**
 * Log learning mode status on startup
 */
export function logLearningModeStatus() {
	if (LEARNING_MODE) {
		console.log('');
		console.log('🔬 Learning mode: capturing requests to samples/ (ISO8601 filenames)');
	} else {
		console.log('🚀 Production mode - No message capturing');
		console.log('💡 To enable learning mode: LEARNING_MODE=true npm run dev');
	}
}

export { LEARNING_MODE };