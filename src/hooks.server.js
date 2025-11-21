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

// Get list of supported message types
const jsonMessageTypes = ['database', 'update', 'timer', 'decision'];
const binaryMessageTypes = ['flags_zip', 'pictures', 'styles', 'translations_zip'];
const allMessageTypes = [...jsonMessageTypes, ...binaryMessageTypes];

console.log(`   JSON Messages: ${jsonMessageTypes.join(', ')}`);
console.log(`   Binary Frames: ${binaryMessageTypes.join(', ')}`);
console.log('');
console.log('🌐 Web interface: http://localhost:8096');
console.log('');
if (LEARNING_MODE) {
  console.log('🔬 LEARNING MODE: Capturing all messages to samples/');
  console.log('');
}
console.log('═══════════════════════════════════════════════════════');
console.log('');

// Crash detection and monitoring
console.log('[Monitor] Starting crash detection and health monitoring');

// Detect unhandled exceptions (crashes)
process.on('uncaughtException', (error) => {
  console.error('');
  console.error('❌ ═══════════════════════════════════════════════════════');
  console.error('❌ UNCAUGHT EXCEPTION - SERVER CRASHING');
  console.error('❌ ═══════════════════════════════════════════════════════');
  console.error('[Crash] Error:', error.message);
  console.error('[Crash] Stack:', error.stack);
  console.error('[Crash] Time:', new Date().toISOString());
  console.error('❌ ═══════════════════════════════════════════════════════');
  console.error('');
  // Process will exit after this
  process.exit(1);
});

// Detect unhandled promise rejections (potential deadlocks or async errors)
process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('⚠️  ═══════════════════════════════════════════════════════');
  console.error('⚠️  UNHANDLED PROMISE REJECTION');
  console.error('⚠️  ═══════════════════════════════════════════════════════');
  console.error('[Rejection] Reason:', reason);
  console.error('[Rejection] Promise:', promise);
  console.error('[Rejection] Time:', new Date().toISOString());
  console.error('⚠️  ═══════════════════════════════════════════════════════');
  console.error('');
  // Don't exit - this might be recoverable
});

// Detect process warnings (memory leaks, resource issues)
process.on('warning', (warning) => {
  console.warn('');
  console.warn('⚠️  PROCESS WARNING');
  console.warn('[Warning]', warning.name, ':', warning.message);
  if (warning.stack) console.warn('[Stack]', warning.stack);
  console.warn('');
});

// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssOMB = Math.round(memUsage.rss / 1024 / 1024);
  
  // Log if memory is high (>800MB RSS)
  if (rssOMB > 800) {
    console.warn(`[Memory] ⚠️  HIGH: RSS ${rssOMB}MB, Heap ${heapUsedMB}MB/${heapTotalMB}MB`);
  }
  // Log normally if memory is elevated (500-800MB RSS)
  else if (rssOMB > 500) {
    console.log(`[Memory] RSS ${rssOMB}MB, Heap ${heapUsedMB}MB/${heapTotalMB}MB`);
  }
}, 120000); // Every 120 seconds

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
