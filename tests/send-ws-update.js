#!/usr/bin/env node

import fs from 'fs';
import WebSocket from 'ws';

const sampleFile = process.argv[2] || 'samples/2025-11-29T12-53-08-098-WEBSOCKET-UPDATE-LIFTINGORDERUPDATED.json';
const raw = fs.readFileSync(sampleFile, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse sample JSON:', e);
  process.exit(1);
}

const url = process.env.WS_URL || 'ws://localhost:8096/ws';
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('WS open, sending update to', url);
  const message = JSON.stringify({ type: 'update', payload: data });
  ws.send(message, (err) => {
    if (err) console.error('Send error:', err);
    else console.log('Message sent');
    // Wait a short moment for server to process then close
    setTimeout(() => ws.close(), 250);
  });
});

ws.on('message', (msg) => {
  console.log('Received from server:', msg.toString());
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message || err);
});

ws.on('close', (code, reason) => {
  console.log('WS closed', code, reason && reason.toString());
});
