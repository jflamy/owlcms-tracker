/**
 * Render the Streaming.json template with Mustache substitution
 * using the default values from streaming/config.js,
 * and write the result to tests/Streaming-rendered.json
 */
const Mustache = require('mustache');
const fs = require('fs');
const path = require('path');

Mustache.escape = (value) => value; // no HTML escaping

const templatePath = path.resolve(__dirname, '../src/plugins/OBS/streaming/templates/Streaming.json');
const outputPath = path.resolve(__dirname, 'Streaming-rendered.json');

// Values from streaming/config.js defaults
const vars = {
  owlcmsHost: '192.168.1.174:8080',
  replayHost: 'owlcms-replays.local:8091',
  platform: 'A',
  remoteResourcePath: '/home/owlcms/git/owlcms-streaming/media',
  streamServer: '',
  streamKey: '',
  videoFlag: 'true'   // streaming => true
};

const raw = fs.readFileSync(templatePath, 'utf-8');
const rendered = Mustache.render(raw, vars);

// Validate it's legal JSON
let parsed;
try {
  parsed = JSON.parse(rendered);
} catch (err) {
  console.error('ERROR: Rendered output is NOT valid JSON!');
  console.error(err.message);
  // Write raw output for debugging
  fs.writeFileSync(outputPath, rendered, 'utf-8');
  console.log('Raw (invalid) output written to', outputPath);
  process.exit(1);
}

fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 4), 'utf-8');
console.log('Rendered to', outputPath);
console.log('JSON valid: YES');
console.log('Top-level keys:', Object.keys(parsed).join(', '));
console.log('Scene count:', (parsed.scene_order || []).length);
console.log('Source count:', (parsed.sources || []).length);

// Quick check: any leftover {{...}} placeholders?
const leftover = rendered.match(/\{\{[^}]+\}\}/g);
if (leftover) {
  console.warn('WARNING: Unsubstituted placeholders found:', [...new Set(leftover)]);
} else {
  console.log('Placeholders: all substituted');
}
