/**
 * WebSocket Protocol Configuration
 * 
 * Central location for protocol versioning and compatibility checks.
 * 
 * Version Format: "MAJOR.MINOR.PATCH" (semantic versioning)
 * - MAJOR: Breaking changes to message format or message types
 * - MINOR: New message types or new fields added (backward compatible)
 * - PATCH: Bug fixes, internal improvements (backward compatible)
 * 
 * Example compatibility rules:
 * - 2.0.0 client ↔ 2.0.1 server: ✅ Compatible (patch level differs)
 * - 2.1.0 client ↔ 2.0.0 server: ❌ Incompatible (client expects features server doesn't have)
 * - 3.0.0 client ↔ 2.1.0 server: ❌ Incompatible (major version differs)
 */

/**
 * Current protocol version supported by this tracker
 * Matches PROTOCOL_VERSION in Java backend WebSocketEventSender.java
 */
export const PROTOCOL_VERSION = '2.3.0';

/**
 * Minimum protocol version accepted from OWLCMS
 * 
 * Version 2.2.0 provides all core functionality. Later versions add additional features:
 * - 2.3.0: Team points settings (IWF defaults will be used for older versions)
 */
export const MINIMUM_PROTOCOL_VERSION = '2.2.0';

/**
 * Parse semantic version string into components
 * @param {string} version - Version string like "2.0.0"
 * @returns {object|null} - {major, minor, patch} or null if invalid
 */
export function parseVersion(version) {
	if (typeof version !== 'string') {
		return null;
	}

	const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
	if (!match) {
		return null;
	}

	return {
		major: parseInt(match[1], 10),
		minor: parseInt(match[2], 10),
		patch: parseInt(match[3], 10),
		original: version
	};
}

/**
 * Compare two semantic versions
 * @param {string} v1 - First version (e.g., "2.0.0")
 * @param {string} v2 - Second version (e.g., "2.1.0")
 * @returns {number} - Negative if v1 < v2, 0 if equal, positive if v1 > v2
 */
export function compareVersions(v1, v2) {
	const parsed1 = parseVersion(v1);
	const parsed2 = parseVersion(v2);

	if (!parsed1 || !parsed2) {
		throw new Error(`Invalid version format: ${!parsed1 ? v1 : v2}`);
	}

	// Compare major.minor.patch in order
	if (parsed1.major !== parsed2.major) {
		return parsed1.major - parsed2.major;
	}
	if (parsed1.minor !== parsed2.minor) {
		return parsed1.minor - parsed2.minor;
	}
	return parsed1.patch - parsed2.patch;
}

/**
 * Check if a version meets minimum requirements
 * @param {string} version - Version to check (from OWLCMS)
 * @param {string} minimum - Minimum acceptable version
 * @returns {object} - {valid: boolean, reason: string, version: string}
 */
export function isVersionAcceptable(version, minimum = MINIMUM_PROTOCOL_VERSION) {
	// Parse versions
	const parsed = parseVersion(version);
	const parsedMin = parseVersion(minimum);

	if (!parsed) {
		return {
			valid: false,
			reason: `Invalid version format from OWLCMS: "${version}" (expected "MAJOR.MINOR.PATCH")`,
			version: version
		};
	}

	if (!parsedMin) {
		return {
			valid: false,
			reason: `Invalid minimum version configured: "${minimum}"`,
			version: version
		};
	}

	// Check if version >= minimum
	const comparison = compareVersions(version, minimum);
	if (comparison < 0) {
		return {
			valid: false,
			reason: `OWLCMS protocol version ${version} is below required minimum ${minimum}. Please upgrade OWLCMS.`,
			version: version,
			minimum: minimum
		};
	}

	return {
		valid: true,
		reason: `Protocol version ${version} accepted (>= minimum ${minimum})`,
		version: version,
		minimum: minimum
	};
}

/**
 * Extract and validate protocol version from WebSocket message
 * @param {object} message - Parsed WebSocket JSON message
 * @returns {object} - {valid: boolean, version: string, error: string}
 */
export function extractAndValidateVersion(message) {
	if (!message || typeof message !== 'object') {
		return {
			valid: false,
			version: null,
			error: 'Message is not a valid object'
		};
	}

	const version = message.version;

	if (!version) {
		return {
			valid: false,
			version: null,
			error: 'Message missing "version" field. Expected format: {"version":"2.0.0","type":"...","payload":{...}}'
		};
	}

	const versionCheck = isVersionAcceptable(version);
	return {
		valid: versionCheck.valid,
		version: version,
		error: versionCheck.valid ? null : versionCheck.reason
	};
}
