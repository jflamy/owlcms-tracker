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
console.log('📡 Available endpoints:');
console.log('   • /timer     - Timer events (StartTime, StopTime, etc.)');
console.log('   • /decision  - Referee decisions');
console.log('   • /update    - UI events (LiftingOrderUpdated, etc.)');
console.log('   • /database  - Full competition data');
console.log('   • ws://...   - WebSocket connection (preferred method)');
console.log('');
console.log('🌐 Web interface: http://localhost:8096/scoreboard');
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
    console.log('🌐 First HTTP request received - server is processing traffic');
    console.log('');
  }
  
  return resolve(event);
}
