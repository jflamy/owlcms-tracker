/**
 * Binary WebSocket frame handler for OWLCMS flags and pictures
 * 
 * Handles binary frames from OWLCMS containing ZIP archives with flags/pictures
 * Frame format: [type_length:4 bytes] [type_string] [ZIP payload]
 */

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sanity check after flags extraction
 * Verifies flags directory and file count
 */
function verifySanityAfterFlags() {
	try {
		const flagsDir = path.join(process.cwd(), 'local', 'flags');
		if (!fs.existsSync(flagsDir)) {
			console.warn('[Sanity] ⚠️  Flags directory does not exist');
			return 0;
		}

		const files = fs.readdirSync(flagsDir);
		const flagCount = files.length;
		if (flagCount === 0) {
			console.warn('[Sanity] ⚠️  Flags directory is empty');
			return 0;
		}

		console.log(`[Sanity] ✅ Flags: ${flagCount} files extracted to /local/flags`);
		return flagCount;
	} catch (error) {
		console.error(`[Sanity] ❌ Flags verification failed:`, error.message);
		return 0;
	}
}

/**
 * Sanity check after translations load
 * Verifies locale count and key coverage
 */
function verifySanityAfterTranslations() {
	try {
		// Lazy import to access competition hub
		const { competitionHub } = require('./competition-hub.js');
		
		// Get all available locales (not just one)
		const availableLocales = competitionHub.getAvailableLocales();
		const localeCount = availableLocales.length;
		
		if (localeCount === 0) {
			console.warn('[Sanity] ⚠️  No translations cached');
			return 0;
		}

		// Count total keys across all locales
		let totalKeys = 0;
		for (const locale of availableLocales) {
			const translationMap = competitionHub.getTranslations(locale);
			if (translationMap && typeof translationMap === 'object') {
				totalKeys += Object.keys(translationMap).length;
			}
		}

		console.log(`[Sanity] ✅ Translations: ${localeCount} locales, ${totalKeys} total translation keys cached in single hub instance`);
		return localeCount;
	} catch (error) {
		console.error(`[Sanity] ❌ Translations verification failed:`, error.message);
		return 0;
	}
}

/**
 * Parse and route binary message from OWLCMS
 * @param {Buffer} buffer - Binary frame data
 */
export function handleBinaryMessage(buffer) {
	const startTime = Date.now();
	const operationId = Math.random().toString(36).substr(2, 9);
	
	console.log(`[BINARY] Starting operation ${operationId}`);
	
	try {
		// Validate minimum frame size
		if (buffer.length < 4) {
			console.error('[BINARY] ERROR: Frame too short (< 4 bytes)');
			return;
		}

		// Read type length as little-endian 32-bit integer (OWLCMS sends little-endian)
		const typeLength = buffer.readUInt32LE(0);

		// Log first 20 bytes for debugging
		const preview = buffer.slice(0, Math.min(20, buffer.length)).toString('hex');
		console.log(`[BINARY] Frame start (hex): ${preview}`);
		console.log(`[BINARY] Parsed typeLength: ${typeLength} (0x${typeLength.toString(16)}), total frame: ${buffer.length} bytes`);

		// Sanity check: if typeLength is unreasonably large (> 10MB), it's probably malformed
		if (typeLength > 10 * 1024 * 1024) {
			// Try to detect if this is a ZIP file (starts with 504B0304)
			if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
				console.log('[BINARY] ℹ️  Detected ZIP file without type prefix - treating as flags_zip');
				handleFlagsMessage(buffer);
				return;
			}
			console.error(
				`[BINARY] ERROR: typeLength appears malformed (${typeLength} bytes, 0x${typeLength.toString(16)}), but buffer is only ${buffer.length} bytes total`
			);
			return;
		}

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
		if (messageType === 'flags_zip') {
			handleFlagsMessage(payload);
		} else if (messageType === 'flags') {
			// Legacy support for old 'flags' message type
			handleFlagsMessage(payload);
		} else if (messageType === 'pictures') {
			handlePicturesMessage(payload);
		} else if (messageType === 'styles') {
			handleStylesMessage(payload);
		} else if (messageType === 'translations_zip') {
			handleTranslationsZipMessage(payload);
		} else {
			console.warn(`[BINARY] WARNING: Unknown binary message type "${messageType}"`);
		}
		
		const elapsed = Date.now() - startTime;
		console.log(`[BINARY] ✅ Operation ${operationId} completed in ${elapsed}ms (type: ${messageType})`);
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error(`[BINARY] ❌ Operation ${operationId} FAILED after ${elapsed}ms:`, error.message);
		console.error('[BINARY] Stack trace:', error.stack);
	}
}

/**
 * Extract flags ZIP archive to ./local/flags
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
function handleFlagsMessage(zipBuffer) {
	const startTime = Date.now();
	console.log(`[FLAGS] Starting extraction of ${zipBuffer.length} bytes`);
	
	try {
		const competitionHub = require('./competition-hub.js').competitionHub;
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		const flagsDir = path.join(process.cwd(), 'local', 'flags');

		// Ensure target directory exists
		if (!fs.existsSync(flagsDir)) {
			fs.mkdirSync(flagsDir, { recursive: true });
		}

		// Extract all files from ZIP
		let extractedCount = 0;
		const flagFileNames = [];
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
				
				// Track first 10 flag file names
				if (flagFileNames.length < 10) {
					flagFileNames.push(entry.entryName);
				}
			}
		});

		const elapsed = Date.now() - startTime;
		console.log(`[FLAGS] ✓ Extracted ${extractedCount} flag files in ${elapsed}ms`);
		
		// Log first 10 flags
		if (flagFileNames.length > 0) {
			console.log(`[FLAGS] First ${Math.min(10, extractedCount)} flags:`);
			flagFileNames.forEach((name, index) => {
				console.log(`  ${index + 1}. ${name}`);
			});
		}
		
		// Run sanity check after successful extraction
		verifySanityAfterFlags();
		competitionHub.markFlagsLoaded();
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error(`[FLAGS] ❌ ERROR after ${elapsed}ms:`, error.message);
		console.error('[FLAGS] Stack trace:', error.stack);
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

/**
 * Extract translations ZIP archive containing translations.json (~1MB uncompressed, 400KB compressed)
 * ZIP contains single file "translations.json" with all 26 locale translation maps
 * @param {Buffer} zipBuffer - ZIP file buffer with translations.json
 */
function handleTranslationsZipMessage(zipBuffer) {
	const startTime = Date.now();
	
	try {
		console.log(`[TRANSLATIONS_ZIP] 📦 Received ZIP: ${zipBuffer.length} bytes`);
		
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		
		// Look for translations.json in the ZIP
		const translationsEntry = zip.getEntries().find(entry => 
			entry.entryName === 'translations.json' && !entry.isDirectory
		);
		
		if (!translationsEntry) {
			console.error('[TRANSLATIONS_ZIP] ❌ ERROR: ZIP does not contain translations.json');
			return;
		}
		
		// Extract and parse translations.json
		const jsonData = translationsEntry.getData().toString('utf8');
		console.log(`[TRANSLATIONS_ZIP] 📄 Extracted translations.json: ${jsonData.length} bytes`);
		
		const payload = JSON.parse(jsonData);
		
		// Lazy import to avoid circular dependency at module load time
		// This will be called at runtime when message arrives
		const competitionHub = require('./competition-hub.js').competitionHub;
		
		// Check checksum first (skip if matches)
		const checksum = payload.translationsChecksum;
		if (checksum && checksum === competitionHub.lastTranslationsChecksum) {
			const elapsed = Date.now() - startTime;
			console.log(`[TRANSLATIONS_ZIP] ⏭️  Checksum ${checksum.substring(0, 8)}... matches, skipping reprocessing (${elapsed}ms)`);
			return;
		}
		
		// Handle wrapper structure: { "locales": { "en": {...}, "fr": {...} }, "translationsChecksum": "..." }
		// Or direct structure: { "en": {...}, "fr": {...} }
		let translationsData = payload.locales || payload;
		
		// Validate structure: should be object with locale keys
		if (!translationsData || typeof translationsData !== 'object') {
			console.error('[TRANSLATIONS_ZIP] ❌ ERROR: translations.json is not a valid object');
			return;
		}
		
		// Cache each locale
		let localesCount = 0;
		let totalKeys = 0;
		console.log(`[TRANSLATIONS_ZIP] 🔄 Caching locales...`);
		
		for (const [locale, translationMap] of Object.entries(translationsData)) {
			// Skip metadata fields and only process translation maps
			if (translationMap && typeof translationMap === 'object' && locale !== 'translationsChecksum') {
				competitionHub.setTranslations(locale, translationMap);
				localesCount++;
				totalKeys += Object.keys(translationMap).length;
			}
		}
		
		// Store checksum after successful processing
		if (checksum) {
			competitionHub.lastTranslationsChecksum = checksum;
			console.log(`[TRANSLATIONS_ZIP] ✅ Checksum stored: ${checksum.substring(0, 8)}...`);
		}
		
		const elapsed = Date.now() - startTime;
		console.log(`[TRANSLATIONS_ZIP] ✅ Complete: ${localesCount} locales processed, ${totalKeys} source keys (${elapsed}ms)`);
		
		// Log when translations are initialized vs updated
		const hadTranslations = Object.keys(competitionHub.translations).length > localesCount;
		
		if (!hadTranslations) {
			console.log(`[TRANSLATIONS_ZIP] ✅ TRANSLATIONS INITIALIZED (${localesCount} locales, ${totalKeys} keys)`);
		} else {
			console.log(`[TRANSLATIONS_ZIP] ✅ TRANSLATIONS UPDATED (${localesCount} locales, ${totalKeys} keys)`);
		}
		
		// Run sanity check after successful translations load
		verifySanityAfterTranslations();
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error(`[TRANSLATIONS_ZIP] ❌ ERROR after ${elapsed}ms:`, error.message);
		console.error('[TRANSLATIONS_ZIP] Stack trace:', error.stack);
	}
}

