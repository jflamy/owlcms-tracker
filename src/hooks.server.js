/**
 * SvelteKit server hooks - runs on server startup
 */

import { competitionHub } from '$lib/server/competition-hub.js';

const LEARNING_MODE = process.env.LEARNING_MODE === 'true';

// Force competition hub initialization (this triggers the constructor and learning mode banner)
const _ = competitionHub;

// Show ready banner immediately on module load (server startup)
console.log('');
console.log('✅ ═══════════════════════════════════════════════════════');
console.log('✅ SERVER READY TO RECEIVE OWLCMS MESSAGES');
console.log('✅ ═══════════════════════════════════════════════════════');
console.log('');
console.log('📡 OWLCMS WebSocket: ws://localhost:8096/ws');
console.log('   Messages: /database, /update, /timer, /decision');
console.log('');
console.log('🌐 Web interface: http://localhost:8096');
console.log('');
if (LEARNING_MODE) {
  console.log('🔬 LEARNING MODE: Capturing all messages to samples/');
  console.log('');
}
console.log('═══════════════════════════════════════════════════════');
console.log('');

// Track if we've shown first request message
let hasShownFirstRequest = false;

export async function handle({ event, resolve }) {
  if (!hasShownFirstRequest) {
    hasShownFirstRequest = true;
    console.log('🌐 Web server processing HTTP requests');
    console.log('');
  }
  
  return resolve(event);
}
