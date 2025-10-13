#!/usr/bin/env node

import fs from 'fs';
import http from 'http';

// Read the sample UPDATE file
const sampleFile = process.argv[2] || 'samples/2025-10-08T10-36-02-594-UPDATE-LIFTING_ORDER.json';
const data = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));

// Determine endpoint based on filename or data content
let endpoint = '/update';
let isDatabase = false;
if (sampleFile.includes('DATABASE') || data.fullCompetitionData) {
  endpoint = '/database';
  isDatabase = true;
} else if (sampleFile.includes('TIMER')) {
  endpoint = '/timer';
} else if (sampleFile.includes('DECISION')) {
  endpoint = '/decision';
}

// Prepare request body and headers
let requestBody;
let contentType;

if (isDatabase) {
  // DATABASE endpoint gets JSON directly
  requestBody = JSON.stringify(data);
  contentType = 'application/json';
} else {
  // Other endpoints get form-encoded data
  requestBody = Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  contentType = 'application/x-www-form-urlencoded';
}

// Send POST request
const options = {
  hostname: 'localhost',
  port: 8096,
  path: endpoint,
  method: 'POST',
  headers: {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(requestBody);
req.end();

console.log(`Sending to http://localhost:8096${endpoint}`);
console.log(`Content-Type: ${contentType}`);
console.log(`File: ${sampleFile}`);
