import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Show startup banner immediately
const LEARNING_MODE = process.env.LEARNING_MODE === 'true';
console.log('\n');
console.log('═══════════════════════════════════════════════════════');
console.log('   OWLCMS Competition Tracker - Starting Up');
console.log('═══════════════════════════════════════════════════════');
console.log('');
if (LEARNING_MODE) {
  console.log('🔬 LEARNING MODE: Enabled');
  console.log('📁 Messages will be captured to: samples/');
  console.log('');
} else {
  console.log('🚀 Production Mode');
  console.log('');
}
console.log('⏳ Initializing server...');
console.log('');

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 8096,
		host: true
	},
	preview: {
		port: 8096,
		host: true
	}
});