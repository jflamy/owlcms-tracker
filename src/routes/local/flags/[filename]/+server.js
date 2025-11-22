/**
 * Static file handler for flag images
 * Allows serving files with spaces and special characters in filenames
 */

import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.gif': 'image/gif',
	'.webp': 'image/webp'
};

export async function GET({ params }) {
	try {
		const filename = params.filename;
		console.log(`[Flag Route] Requested: ${filename}`);
		
		// Security: prevent directory traversal
		if (filename.includes('..') || filename.includes('/')) {
			console.log(`[Flag Route] ✗ Security check failed: ${filename}`);
			return new Response('Not Found', { status: 404 });
		}

		const flagsDir = path.join(process.cwd(), 'local', 'flags');
		const filePath = path.join(flagsDir, filename);

		// Verify the resolved path is within flags directory
		const resolvedPath = path.resolve(filePath);
		const resolvedDir = path.resolve(flagsDir);
		if (!resolvedPath.startsWith(resolvedDir)) {
			console.log(`[Flag Route] ✗ Path traversal blocked: ${resolvedPath}`);
			return new Response('Not Found', { status: 404 });
		}

		// Check if file exists
		if (!fs.existsSync(filePath)) {
			console.log(`[Flag Route] ✗ File not found: ${filePath}`);
			return new Response('Not Found', { status: 404 });
		}

		// Read file
		const fileBuffer = fs.readFileSync(filePath);
		
		// Determine MIME type
		const ext = path.extname(filename).toLowerCase();
		const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

		console.log(`[Flag Route] ✓ Serving ${filename} (${fileBuffer.length} bytes, ${mimeType})`);

		// Return file with proper headers
		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': mimeType,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		console.error('[Flag Route] Error serving flag:', error.message);
		return new Response('Server Error', { status: 500 });
	}
}
