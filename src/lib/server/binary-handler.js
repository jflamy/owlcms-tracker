/**
 * Binary WebSocket frame handler for OWLCMS flags and pictures
 * 
 * Handles binary frames from OWLCMS containing ZIP archives with flags/pictures
 * Frame format: [type_length:4 bytes] [type_string] [ZIP payload]
 */

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse and route binary message from OWLCMS
 * @param {Buffer} buffer - Binary frame data
 */
export function handleBinaryMessage(buffer) {
	try {
		// Validate minimum frame size
		if (buffer.length < 4) {
			console.error('[BINARY] ERROR: Frame too short (< 4 bytes)');
			return;
		}

		// Read type length as big-endian 32-bit integer
		const typeLength = buffer.readUInt32BE(0);

		// Validate frame contains complete type string
		if (buffer.length < 4 + typeLength) {
			console.error(
				`[BINARY] ERROR: Frame too short for type (need ${4 + typeLength}, got ${buffer.length})`
			);
			return;
		}

		// Extract message type (UTF-8 string)
		const messageType = buffer.slice(4, 4 + typeLength).toString('utf8');

		// Extract binary payload (everything after type)
		const payload = buffer.slice(4 + typeLength);

		// Route to handler based on message type
		if (messageType === 'flags') {
			handleFlagsMessage(payload);
		} else if (messageType === 'pictures') {
			handlePicturesMessage(payload);
		} else if (messageType === 'styles') {
			handleStylesMessage(payload);
		} else {
			console.warn(`[BINARY] WARNING: Unknown binary message type "${messageType}"`);
		}
	} catch (error) {
		console.error('[BINARY] ERROR processing binary message:', error.message);
	}
}

/**
 * Extract flags ZIP archive to ./local/flags
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
function handleFlagsMessage(zipBuffer) {
	try {
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		const flagsDir = path.join(process.cwd(), 'local', 'flags');

		// Ensure target directory exists
		if (!fs.existsSync(flagsDir)) {
			fs.mkdirSync(flagsDir, { recursive: true });
		}

		// Extract all files from ZIP
		let extractedCount = 0;
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(flagsDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				// Write file
				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;
			}
		});

		console.log(`[FLAGS] ✓ Extracted ${extractedCount} flag files`);
	} catch (error) {
		console.error('[FLAGS] ERROR:', error.message);
	}
}

/**
 * Extract pictures ZIP archive to ./local/pictures
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
function handlePicturesMessage(zipBuffer) {
	try {
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		const picturesDir = path.join(process.cwd(), 'local', 'pictures');

		// Ensure target directory exists
		if (!fs.existsSync(picturesDir)) {
			fs.mkdirSync(picturesDir, { recursive: true });
		}

		// Extract all files from ZIP
		let extractedCount = 0;
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(picturesDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				// Write file
				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;
			}
		});

		console.log(`[PICTURES] ✓ Extracted ${extractedCount} picture files`);
	} catch (error) {
		console.error('[PICTURES] ERROR:', error.message);
	}
}

/**
 * Extract styles ZIP archive to ./local/styles
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
function handleStylesMessage(zipBuffer) {
	try {
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		const stylesDir = path.join(process.cwd(), 'local', 'styles');

		// Ensure target directory exists
		if (!fs.existsSync(stylesDir)) {
			fs.mkdirSync(stylesDir, { recursive: true });
		}

		// Extract all files from ZIP
		let extractedCount = 0;
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(stylesDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				// Write file
				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;
			}
		});

		console.log(`[STYLES] ✓ Extracted ${extractedCount} style files`);
	} catch (error) {
		console.error('[STYLES] ERROR:', error.message);
	}
}
