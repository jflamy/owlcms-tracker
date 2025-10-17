import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Show startup banner immediately (avoid duplicate learning-mode logs)
const LEARNING_MODE = process.env.LEARNING_MODE === 'true';
console.log('\n═══════════════════════════════════════════════════════');
console.log('   OWLCMS Competition Tracker - Starting Up');
console.log('═══════════════════════════════════════════════════════');
console.log(LEARNING_MODE ? '🔬 Learning mode active' : '🚀 Production mode');
console.log('⏳ Initializing server...\n');

export default defineConfig({
	plugins: [
		sveltekit(),
		{
			name: 'websocket-server',
			configureServer(server) {
				// Import and initialize WebSocket server
				import('./src/lib/server/websocket-server.js').then(({ initWebSocketServer }) => {
					initWebSocketServer(server.httpServer);
				});
				
				// Serve /local directory (flags, pictures, styles)
				server.middlewares.use('/local', (req, res, next) => {
					const filePath = path.join(__dirname, 'local', req.url);
					
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
		}
	],
	server: {
		port: 8096,
		host: true
	},
	preview: {
		port: 8096,
		host: true
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