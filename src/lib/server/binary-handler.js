/**
 * Binary WebSocket frame handler for OWLCMS flags and pictures
 * 
 * Handles binary frames from OWLCMS containing ZIP archives with flags/pictures
 * 
 * Frame format (Version 2.0.0+):
 *   [version_length:4 bytes BE] [version_string:UTF-8] [type_length:4 bytes BE] [type_string:UTF-8] [ZIP payload]
 * 
 * Example: 6-byte "2.0.0" + 5-byte "flags" frame:
 *   [0x00,0x00,0x00,0x05] [2,.,0,.,0] [0x00,0x00,0x00,0x05] [f,l,a,g,s] [ZIP...]
 * 
 * Legacy format (before Version 2.0.0):
 *   [type_length:4 bytes BE] [type_string:UTF-8] [ZIP payload]
 */

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { isVersionAcceptable, parseVersion } from './protocol-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sanity check after flags extraction
 * Verifies flags directory and file count
 * NOTE: Flags directory is cleared on server startup, count is since server startup
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

		if (process.env.SANITY_DEBUG === 'true') {
			console.log(`[Sanity] ✅ Flags: ${flagCount} total files in /local/flags (since server startup)`);
		}
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
async function verifySanityAfterTranslations() {
	try {
		// Lazy import to access competition hub
		const { competitionHub } = await import('./competition-hub.js');
		
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
export async function handleBinaryMessage(buffer) {
	const startTime = Date.now();
	const operationId = Math.random().toString(36).substr(2, 9);
	
	if (process.env.BINARY_DEBUG === 'true') {
		console.log(`[BINARY] Starting operation ${operationId}`);
	}
	
	try {
		// Validate minimum frame size
		if (buffer.length < 4) {
			console.error('[BINARY] ERROR: Frame too short (< 4 bytes)');
			return;
		}

		// Read first 4-byte integer
		const firstLength = buffer.readUInt32BE(0);

		if (process.env.BINARY_DEBUG === 'true') {
			const preview = buffer.slice(0, Math.min(20, buffer.length)).toString('hex');
			console.log(`[BINARY] Frame start (hex): ${preview}`);
			console.log(`[BINARY] First 4-byte value: ${firstLength} (0x${firstLength.toString(16)}), total frame: ${buffer.length} bytes`);
		}

		let offset = 0;
		let protocolVersion = null;
		let messageType = null;
		let payload = null;

		// Detect frame format by checking if first value looks like a version length (typically 5-7)
		// vs a type length (typically 5-17 for "translations_zip", "flags", etc)
		// 
		// If firstLength is 5-7 and buffer contains valid UTF-8 that looks like a version (e.g., "2.0.0"),
		// treat it as version 2.0.0+ format. Otherwise, treat as legacy format.

		if (firstLength <= 20 && firstLength > 0 && buffer.length >= 4 + firstLength + 4) {
			// Try to parse as version string
			try {
				const potentialVersion = buffer.slice(4, 4 + firstLength).toString('utf8');
				const parsedVer = parseVersion(potentialVersion);
				
				if (parsedVer) {
					// Looks like a valid version string (e.g., "2.0.0")
				if (process.env.BINARY_DEBUG === 'true') {
					console.log(`[BINARY] ✅ Detected version 2.0.0+ format with protocol version: ${potentialVersion}`);
				}
					const versionCheck = isVersionAcceptable(potentialVersion);
					if (!versionCheck.valid) {
						console.error(`[BINARY] ❌ Protocol version validation failed: ${versionCheck.error}`);
						return;
					}
					
					protocolVersion = potentialVersion;
					offset = 4 + firstLength;
					
					// Now read the message type
					if (buffer.length < offset + 4) {
						console.error(`[BINARY] ERROR: Frame too short for type length at offset ${offset}`);
						return;
					}
					
					const typeLength = buffer.readUInt32BE(offset);
					offset += 4;
					
					if (buffer.length < offset + typeLength) {
						console.error(
							`[BINARY] ERROR: Frame too short for type (need ${offset + typeLength}, got ${buffer.length})`
						);
						return;
					}
					
					messageType = buffer.slice(offset, offset + typeLength).toString('utf8');
					offset += typeLength;
					payload = buffer.slice(offset);
					
				} else {
					// Not a version string, treat as legacy format
				if (process.env.BINARY_DEBUG === 'true') {
					console.log(`[BINARY] Detected legacy format (no version header)`);
				}
					messageType = buffer.slice(4, 4 + firstLength).toString('utf8');
					payload = buffer.slice(4 + firstLength);
				}
			} catch (e) {
				// Failed to parse as version, treat as legacy format
				console.log(`[BINARY] Treating as legacy format: ${e.message}`);
				messageType = buffer.slice(4, 4 + firstLength).toString('utf8');
				payload = buffer.slice(4 + firstLength);
			}
		} else {
			// Sanity check: if firstLength is unreasonably large (> 10MB), it's probably malformed
			if (firstLength > 10 * 1024 * 1024) {
				// Try to detect if this is a ZIP file (starts with 504B0304)
				if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
					console.log('[BINARY] ℹ️  Detected ZIP file without type prefix - treating as flags_zip');
					handleFlagsMessage(buffer);
					return;
				}
				console.error(
					`[BINARY] ERROR: firstLength appears malformed (${firstLength} bytes, 0x${firstLength.toString(16)}), but buffer is only ${buffer.length} bytes total`
				);
				return;
			}

			// Legacy format: firstLength is the type length
			console.log(`[BINARY] Treating as legacy format: firstLength=${firstLength} appears to be type length`);
			
			if (buffer.length < 4 + firstLength) {
				console.error(
					`[BINARY] ERROR: Frame too short for type (need ${4 + firstLength}, got ${buffer.length})`
				);
				return;
			}

			messageType = buffer.slice(4, 4 + firstLength).toString('utf8');
			payload = buffer.slice(4 + firstLength);
		}

		// Route to handler based on message type
		if (messageType === 'database_zip' || messageType === 'database') {
			await handleDatabaseZipMessage(payload);
		} else if (messageType === 'flags_zip') {
			await handleFlagsMessage(payload);
		} else if (messageType === 'flags') {
			// Legacy support for old 'flags' message type
			await handleFlagsMessage(payload);
		} else if (messageType === 'pictures_zip') {
			await handlePicturesMessage(payload);
		} else if (messageType === 'pictures') {
			// Legacy support for old 'pictures' message type
			await handlePicturesMessage(payload);
		} else if (messageType === 'styles') {
			handleStylesMessage(payload);
		} else if (messageType === 'translations_zip') {
			await handleTranslationsZipMessage(payload);
		} else if (messageType === 'logos_zip') {
			await handleLogosMessage(payload);
		}

		const elapsed = Date.now() - startTime;
		if (process.env.BINARY_DEBUG === 'true') {
			console.log(`[BINARY] ✅ Operation ${operationId} completed in ${elapsed}ms (type: ${messageType})`);
		}
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
async function handleFlagsMessage(zipBuffer) {
	const startTime = Date.now();
	console.log(`[FLAGS] Starting extraction of ${zipBuffer.length} bytes`);
	
	try {
		const { competitionHub } = await import('./competition-hub.js');
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
		console.log(`[FLAGS] ✅ Extracted ${extractedCount} flag files in ${elapsed}ms`);
		if (process.env.SANITY_DEBUG === 'true') {
			// Log first 10 flags from this extraction
			if (flagFileNames.length > 0) {
				console.log(`[FLAGS] First ${Math.min(10, extractedCount)} flags from this message:`);
				flagFileNames.forEach((name, index) => {
					console.log(`  ${index + 1}. ${name}`);
				});
			}
		}
		
		// Run sanity check after successful extraction (shows cumulative count)
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
async function handlePicturesMessage(zipBuffer) {
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

		// Mark pictures as loaded in hub
		const hub = (await import('./competition-hub.js')).competitionHub;
		hub.picturesLoaded = true;
		console.log(`[PICTURES] ✓ Extracted ${extractedCount} picture files`);
		console.log(`[Hub] ✅ Pictures ZIP processed and cached`);
	} catch (error) {
		console.error('[PICTURES] ERROR:', error.message);
	}
}

/**
 * Extract logos ZIP archive to ./local/logos
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
async function handleLogosMessage(zipBuffer) {
	const startTime = Date.now();
	console.log(`[LOGOS] Starting extraction of ${zipBuffer.length} bytes`);
	
	try {
		const { competitionHub } = await import('./competition-hub.js');
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		const logosDir = path.join(process.cwd(), 'local', 'logos');

		// Ensure target directory exists
		if (!fs.existsSync(logosDir)) {
			fs.mkdirSync(logosDir, { recursive: true });
		}

		// Extract all files from ZIP
		let extractedCount = 0;
		const logoFileNames = [];
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(logosDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				// Write file
				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;
				
				// Track first 10 logo file names
				if (logoFileNames.length < 10) {
					logoFileNames.push(entry.entryName);
				}
			}
		});

		const elapsed = Date.now() - startTime;
		console.log(`[LOGOS] ✓ Extracted ${extractedCount} logo files in ${elapsed}ms (this message)`);
		
		// Log first 10 logos from this extraction
		if (logoFileNames.length > 0) {
			console.log(`[LOGOS] First ${Math.min(10, extractedCount)} logos from this message:`);
			logoFileNames.forEach((name, index) => {
				console.log(`  ${index + 1}. ${name}`);
			});
		}
		
		// Run sanity check after successful extraction (shows cumulative count)
		verifySanityAfterLogos();
		competitionHub.markLogosLoaded();
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error(`[LOGOS] ❌ ERROR after ${elapsed}ms:`, error.message);
		console.error('[LOGOS] Stack trace:', error.stack);
	}
}

/**
 * Sanity check after logos extraction
 * Verifies logos directory and file count
 * NOTE: Logos directory is cleared on server startup, count is since server startup
 */
function verifySanityAfterLogos() {
	try {
		const logosDir = path.join(process.cwd(), 'local', 'logos');
		if (!fs.existsSync(logosDir)) {
			console.warn('[Sanity] ⚠️  Logos directory does not exist');
			return 0;
		}

		const files = fs.readdirSync(logosDir);
		const logoCount = files.length;
		if (logoCount === 0) {
			console.warn('[Sanity] ⚠️  Logos directory is empty');
			return 0;
		}

		console.log(`[Sanity] ✅ Logos: ${logoCount} total files in /local/logos (since server startup)`);
		return logoCount;
	} catch (error) {
		console.error(`[Sanity] ❌ Logos verification failed:`, error.message);
		return 0;
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
async function handleTranslationsZipMessage(zipBuffer) {
	const startTime = Date.now();
	
	try {
		if (process.env.TRANSLATIONS_DEBUG === 'true') {
			console.log(`[TRANSLATIONS_ZIP] 📦 Received ZIP: ${zipBuffer.length} bytes`);
		}
		
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
		if (process.env.TRANSLATIONS_DEBUG === 'true') {
			console.log(`[TRANSLATIONS_ZIP] 📄 Extracted translations.json: ${jsonData.length} bytes`);
		}
		
		const payload = JSON.parse(jsonData);
		
		// Lazy import to avoid circular dependency at module load time
		// This will be called at runtime when message arrives
		const { competitionHub } = await import('./competition-hub.js');
		
		// Check checksum to determine if content changed
		const checksum = payload.translationsChecksum;
		const checksumMatches = checksum && checksum === competitionHub.lastTranslationsChecksum;
		if (checksumMatches) {
			console.log(`[TRANSLATIONS_ZIP] 🔄 Checksum ${checksum.substring(0, 8)}... matches previous, but processing anyway (forced refresh)`);
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
		let skippedLocales = [];
		if (process.env.TRANSLATIONS_DEBUG === 'true') {
			console.log(`[TRANSLATIONS_ZIP] 🔄 Caching locales...`);
		}
		
		// Pattern for valid locale codes: must start with letter, can contain letters, numbers, underscores, hyphens
		// Rejects: empty, numeric-only, contains spaces, starts with number
		const validLocalePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
		
		for (const [locale, translationMap] of Object.entries(translationsData)) {
			// Skip metadata fields and only process translation maps
			// Also skip invalid locale codes (empty, numeric, containing spaces, etc.)
			if (translationMap && typeof translationMap === 'object' && locale !== 'translationsChecksum') {
				// Extra validation: skip empty strings, whitespace-only, or anything not matching pattern
				const trimmedLocale = (locale || '').trim();
				if (!trimmedLocale || !validLocalePattern.test(trimmedLocale)) {
					skippedLocales.push(locale || '(empty)');
					continue;
				}
				competitionHub.setTranslations(trimmedLocale, translationMap);
				localesCount++;
				totalKeys += Object.keys(translationMap).length;
			}
		}
		
		if (skippedLocales.length > 0) {
			if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
				console.log(`[TRANSLATIONS_ZIP] ⚠️  Skipped ${skippedLocales.length} invalid locale keys: ${skippedLocales.slice(0, 5).map(l => JSON.stringify(l)).join(', ')}${skippedLocales.length > 5 ? '...' : ''}`);
			}
		}
		
		// Store checksum after successful processing
		if (checksum) {
			competitionHub.lastTranslationsChecksum = checksum;
			if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
				console.log(`[TRANSLATIONS_ZIP] ✅ Checksum stored: ${checksum.substring(0, 8)}...`);
			}
		}
		
		const elapsed = Date.now() - startTime;
		if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
			console.log(`[TRANSLATIONS_ZIP] ✅ Complete: ${localesCount} locales processed, ${totalKeys} source keys (${elapsed}ms)`);
		}
		
		// Log when translations are initialized vs updated
		const hadTranslations = Object.keys(competitionHub.translations).length > localesCount;
		
		if (!hadTranslations) {
			if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
				console.log(`[TRANSLATIONS_ZIP] ✅ TRANSLATIONS INITIALIZED (${localesCount} locales, ${totalKeys} keys)`);
			}
		} else {
			if (process.env.HUB_LOG_TRANSLATIONS === 'true') {
				console.log(`[TRANSLATIONS_ZIP] ✅ TRANSLATIONS UPDATED (${localesCount} locales, ${totalKeys} keys)`);
			}
		}
		
		// Mark translations as complete (triggers hub-ready check)
		competitionHub.markTranslationsComplete(localesCount);
		
		// Run sanity check after successful translations load
		await verifySanityAfterTranslations();
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error(`[TRANSLATIONS_ZIP] ❌ ERROR after ${elapsed}ms:`, error.message);
		console.error('[TRANSLATIONS_ZIP] Stack trace:', error.stack);
	}
}

/**
 * Extract and process database from ZIP archive
 * Handles Option C: compressed database with binary transmission
 * @param {Buffer} zipBuffer - ZIP file containing competition.json
 */
async function handleDatabaseZipMessage(zipBuffer) {
        const startTime = Date.now();
        const operationId = Math.random().toString(36).substr(2, 9);

        console.log(`[DATABASE_ZIP] Starting operation ${operationId}: extracting ${zipBuffer.length} bytes`);

        try {
                const { competitionHub } = await import('./competition-hub.js');

                // Parse ZIP from buffer
                const zip = new AdmZip(zipBuffer);
                const entries = zip.getEntries();

                // Find competition.json in the ZIP
                const competitionJsonEntry = entries.find(entry =>
                        entry.entryName === 'competition.json' || entry.entryName.endsWith('.json')
                );

                if (!competitionJsonEntry) {
                        console.error('[DATABASE_ZIP] ERROR: No competition.json found in ZIP');
                        throw new Error('Missing competition.json in database ZIP');
                }

                // Extract and parse JSON
                const jsonString = competitionJsonEntry.getData().toString('utf8');
                const payload = JSON.parse(jsonString);

				// Also save the raw competition.json to the samples directory for debugging/learning mode
				// Use DATABASE_ZIP as the message type suffix to distinguish from HTTP text database messages
				try {
					// Lazy import to get LEARNING_MODE and captureMessage
					const { captureMessage, LEARNING_MODE } = await import('./learning-mode.js');
					if (LEARNING_MODE) {
						// Call captureMessage with overrideType='DATABASE_ZIP' to produce filenames like:
						// 2025-12-20T13-39-43-219-DATABASE_ZIP.json
						captureMessage(payload, jsonString, '', 'DATABASE_ZIP');
					}
				} catch (err) {
					console.error('[DATABASE_ZIP] ERROR capturing message in learning mode:', err.message);
				}

                console.log(`[DATABASE_ZIP] ✅ Extracted competition.json (${jsonString.length} bytes uncompressed)`);
                console.log(`[DATABASE_ZIP] Processing database with ${payload.athletes?.length || 0} athletes`);

                // Process through competition hub (same path as JSON database)
                const result = competitionHub.handleFullCompetitionData(payload);

                const elapsed = Date.now() - startTime;
                const ratio = ((1 - zipBuffer.length / jsonString.length) * 100).toFixed(1);
                console.log(`[DATABASE_ZIP] ✅ Operation ${operationId} complete (${zipBuffer.length} → ${jsonString.length} bytes, ${ratio}% reduction, ${elapsed}ms)`);

                if (!result.accepted) {
                        console.error(`[DATABASE_ZIP] ⚠️  Database processing result: ${result.reason}`);
                }

                return result;

        } catch (error) {
                const elapsed = Date.now() - startTime;
                console.error(`[DATABASE_ZIP] ❌ Operation ${operationId} FAILED after ${elapsed}ms:`, error.message);
                console.error('[DATABASE_ZIP] Stack trace:', error.stack);
                throw error;
        }
}
