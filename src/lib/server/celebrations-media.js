import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const mediaDirectories = globalThis.__celebrationsMediaDirectories ?? new Map();
globalThis.__celebrationsMediaDirectories = mediaDirectories;

function normalizeDirectory(directory) {
	const candidate = String(directory || '').trim();
	if (!candidate) return null;

	const resolved = resolve(candidate);
	try {
		if (!statSync(resolved).isDirectory()) return null;
	} catch {
		return null;
	}

	return resolved;
}

export function registerCelebrationsMediaDirectory(directory) {
	const resolved = normalizeDirectory(directory);
	if (!resolved) return null;

	for (const [source, registeredDirectory] of mediaDirectories) {
		if (registeredDirectory === resolved) return source;
	}

	const source = randomUUID();
	mediaDirectories.set(source, resolved);
	return source;
}

export function getCelebrationsMediaDirectory(source) {
	return mediaDirectories.get(source) ?? null;
}