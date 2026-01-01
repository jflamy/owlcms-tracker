import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_VITEST = process.env.VITEST === 'true';

// Startup banner is shown by hooks.server.js instead to avoid duplication

export default defineConfig({
	plugins: [
		sveltekit(),
		...(!IS_VITEST
			? [{
				name: 'websocket-server',
				configureServer(server) {
					// Import and initialize WebSocket server using tracker-core
					Promise.all([
						import('@owlcms/tracker-core'),
						import('@owlcms/tracker-core/websocket')
					]).then(([{ competitionHub }, { attachWebSocketToServer }]) => {
						attachWebSocketToServer({
							server: server.httpServer,
							path: '/ws',
							hub: competitionHub,
							localFilesDir: path.join(__dirname, 'local'),
							localUrlPrefix: '/local',
							onConnect: () => console.log('[WebSocket] OWLCMS connected'),
							onDisconnect: () => console.log('[WebSocket] OWLCMS disconnected')
						});
					});
					
					// Serve /local directory (flags, pictures, styles)
					server.middlewares.use('/local', (req, res, next) => {
						// Decode URL-encoded paths (e.g., "AK%20Bj%C3%B8rgvin.png" → "AK Bjørgvin.png")
						const decodedUrl = decodeURIComponent(req.url);
						const filePath = path.join(__dirname, 'local', decodedUrl);
						
						// Security: prevent directory traversal
						if (!filePath.startsWith(path.join(__dirname, 'local'))) {
							res.statusCode = 403;
							res.end('Forbidden');
							return;
						}
						
						// Try to serve the file
						if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
							res.setHeader('Content-Type', getMimeType(filePath));
							res.end(fs.readFileSync(filePath));
						} else {
							res.statusCode = 404;
							res.end('Not found');
						}
					});
				}
			}]
			: [])
	],
	server: {
		port: 8096,
		host: true
	},
	preview: {
		port: 8096,
		host: true
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.{test,spec}.{js,ts}']
	}
});

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	const mimeTypes = {
		'.svg': 'image/svg+xml',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.css': 'text/css',
		'.js': 'application/javascript'
	};
	return mimeTypes[ext] || 'application/octet-stream';
}