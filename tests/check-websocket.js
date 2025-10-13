/**
 * WebSocket Connection Test
 * Tests if ws://localhost:8096/ws is reachable
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8096/ws';
const TIMEOUT = 5000; // 5 seconds

console.log(`\n🔌 Testing WebSocket connection to: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);
let timeoutId;

// Set timeout for connection
timeoutId = setTimeout(() => {
	console.error('❌ Connection timeout - server not responding');
	ws.close();
	process.exit(1);
}, TIMEOUT);

ws.on('open', () => {
	clearTimeout(timeoutId);
	console.log('✅ WebSocket connection established successfully!');
	console.log('✅ Endpoint is reachable: ' + WS_URL);
	
	// Send a test ping
	console.log('\n📤 Sending test message...');
	ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
	
	// Close after a short delay
	setTimeout(() => {
		console.log('\n✅ Test completed successfully');
		ws.close();
	}, 1000);
});

ws.on('message', (data) => {
	console.log('📥 Received message from server:');
	try {
		const parsed = JSON.parse(data.toString());
		console.log(JSON.stringify(parsed, null, 2));
	} catch (e) {
		console.log(data.toString());
	}
});

ws.on('error', (error) => {
	clearTimeout(timeoutId);
	console.error('❌ WebSocket error:', error.message);
	if (error.code === 'ECONNREFUSED') {
		console.error('\n💡 Tip: Make sure the server is running on port 8096');
		console.error('   Run: npm run dev');
	}
	process.exit(1);
});

ws.on('close', (code, reason) => {
	clearTimeout(timeoutId);
	if (code === 1000) {
		console.log('\n🔌 Connection closed normally');
		process.exit(0);
	} else {
		console.log(`\n🔌 Connection closed with code: ${code}, reason: ${reason || 'none'}`);
		process.exit(0);
	}
});
