#!/usr/bin/env node

/**
 * Startup script to show readiness message
 */

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

// After Vite is ready, this message will appear via the hooks
process.on('message', (msg) => {
  if (msg === 'vite:ready') {
    console.log('');
    console.log('✅ SERVER READY TO RECEIVE OWLCMS MESSAGES');
    console.log('');
    console.log('📡 OWLCMS WebSocket: ws://localhost:8096/ws');
    console.log('   Messages: /database, /update, /timer, /decision');
    console.log('');
    console.log('🌐 Web interface: http://localhost:8096');
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }
});
