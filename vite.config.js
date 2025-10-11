import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

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