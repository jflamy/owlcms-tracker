import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_VITEST = process.env.VITEST === 'true';

// Scan plugins for additionalDependencies to mark as external
function collectAdditionalDependencies() {
	const deps = new Set();
	const pluginDirs = ['src/plugins', 'extensions'];
	
	function scanDir(dir) {
		if (!fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const configPath = path.join(dir, entry.name, 'config.js');
			if (fs.existsSync(configPath)) {
				try {
					const content = fs.readFileSync(configPath, 'utf8');
					const match = content.match(/additionalDependencies\s*:\s*\[([^\]]*)\]/);
					if (match) {
						match[1].split(',')
							.map(s => s.trim().replace(/['"]/g, ''))
							.filter(s => s.length > 0)
							.forEach(dep => deps.add(dep));
					}
				} catch (e) { /* ignore */ }
			}
			// Recurse into subdirectories (nested plugin structure)
			scanDir(path.join(dir, entry.name));
		}
	}
	
	pluginDirs.forEach(d => scanDir(path.join(__dirname, d)));
	return Array.from(deps);
}

const externalDeps = collectAdditionalDependencies();
// Optional dependencies that may not be installed
const optionalDeps = ['puppeteer-core'];

// Combine with plugin additional dependencies
const allExternalDeps = [...externalDeps, ...optionalDeps];
if (allExternalDeps.length > 0) {
	console.log(`[Vite] External dependencies: ${allExternalDeps.join(', ')}`);
}

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
					
					// Add OWLCMS reverse proxy for Vaadin pages
					import('./src/lib/server/owlcms-proxy.js').then(({ attachProxyToViteServer }) => {
						attachProxyToViteServer(server);
					}).catch(err => {
						console.warn('[OWLCMS Proxy] Failed to attach:', err.message);
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
					
					// Serve pagedjs from node_modules (pinned to 0.4.3)
					server.middlewares.use('/node_modules/pagedjs', (req, res, next) => {
						const filePath = path.join(__dirname, 'node_modules', 'pagedjs', req.url);
						
						// Security: prevent directory traversal
						if (!filePath.startsWith(path.join(__dirname, 'node_modules', 'pagedjs'))) {
							res.statusCode = 403;
							res.end('Forbidden');
							return;
						}
						
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
	ssr: {
		// Don't bundle plugin additionalDependencies - loaded dynamically at runtime
		external: allExternalDeps,
		noExternal: []
	},
	build: {
		rollupOptions: {
			// Don't bundle plugin additionalDependencies - loaded dynamically at runtime
			external: allExternalDeps
		}
	},
	test: {
		environment: 'node',
		include: [
			'tests/**/*.{test,spec}.{js,ts}',
			'src/plugins/**/*.{test,spec}.{js,ts}',
			'extensions/**/*.{test,spec}.{js,ts}'
		]
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