#!/usr/bin/env node

/**
 * Test WebSocket connection to OWLCMS Tracker
 * Verifies that /ws endpoint is accessible
 */

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:8096/ws';

console.log('Testing WebSocket connection...');
console.log(`URL: ${WS_URL}`);
console.log('');

try {
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection OPEN');
    console.log('   Server is accepting WebSocket connections on /ws');
    
    // Send a test message (OWLCMS format)
    const testMessage = JSON.stringify({
      type: 'update',
      payload: {
        message: 'test'
      }
    });
    
    console.log('');
    console.log('Sending test message...');
    ws.send(testMessage);
  });
  
  ws.on('message', (data) => {
    console.log('📨 Received message:', data);
    ws.close();
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('');
    console.log('✅ WebSocket connection closed successfully');
    console.log('');
    console.log('WebSocket server is working correctly!');
    process.exit(0);
  });
  
  // Timeout after 5 seconds
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    } else if (ws.readyState === WebSocket.CONNECTING) {
      console.error('❌ WebSocket connection timeout');
      process.exit(1);
    }
  }, 5000);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
