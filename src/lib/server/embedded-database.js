export function extractEmbeddedDatabase(envelope = {}) {
	if (!envelope || typeof envelope !== 'object') {
		return { hasDatabase: false };
	}

	if (!Object.prototype.hasOwnProperty.call(envelope, 'database')) {
		return { hasDatabase: false };
	}

	const parsedDatabase = envelope.database;

	if (!parsedDatabase || typeof parsedDatabase !== 'object') {
		console.error('[EmbeddedDatabase] Database field must be a nested object, got:', typeof parsedDatabase);
		return { hasDatabase: false };
	}

	const checksum = envelope.databaseChecksum || envelope.checksum || parsedDatabase.databaseChecksum || null;
	const payload = { ...parsedDatabase };

	if (checksum && !payload.databaseChecksum) {
		payload.databaseChecksum = checksum;
	}

	// Remove the heavy database payload from the original envelope to avoid reprocessing
	delete envelope.database;

	return {
		hasDatabase: true,
		payload,
		checksum
	};
}
