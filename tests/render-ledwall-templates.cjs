/**
 * Render LEDWall.json and RoomTV.json templates with Mustache substitution
 * using the default values from ledwall/config.js,
 * and write the results to tests/
 */
const Mustache = require('mustache');
const fs = require('fs');
const path = require('path');

Mustache.escape = (value) => value;

// Values from ledwall/config.js defaults
const vars = {
  owlcmsHost: '192.168.1.174:8080',
  replayHost: 'owlcms-replays.local:8091',
  platform: 'A',
  remoteResourcePath: '/home/owlcms/git/owlcms-streaming/media',
  streamServer: '',
  streamKey: '',
  videoFlag: 'false'   // ledwall => false
};

const templates = ['LEDWall.json', 'RoomTV.json'];

for (const name of templates) {
  const templatePath = path.resolve(__dirname, '../src/plugins/OBS/ledwall/templates', name);
  if (!fs.existsSync(templatePath)) {
    console.log(`Skipping ${name} — file not found`);
    continue;
  }

  const outputName = name.replace('.json', '-rendered.json');
  const outputPath = path.resolve(__dirname, outputName);

  const raw = fs.readFileSync(templatePath, 'utf-8');
  const rendered = Mustache.render(raw, vars);

  let parsed;
  try {
    parsed = JSON.parse(rendered);
  } catch (err) {
    console.error(`ERROR: ${name} rendered output is NOT valid JSON!`);
    console.error(err.message);
    fs.writeFileSync(outputPath, rendered, 'utf-8');
    console.log(`Raw (invalid) output written to ${outputPath}`);
    continue;
  }

  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 4), 'utf-8');
  console.log(`\n=== ${name} ===`);
  console.log(`Rendered to ${outputPath}`);
  console.log('JSON valid: YES');
  console.log('Scene count:', (parsed.scene_order || []).length);
  console.log('Source count:', (parsed.sources || []).length);

  const leftover = rendered.match(/\{\{[^}]+\}\}/g);
  if (leftover) {
    console.warn('WARNING: Unsubstituted placeholders:', [...new Set(leftover)]);
  } else {
    console.log('Placeholders: all substituted');
  }
}
