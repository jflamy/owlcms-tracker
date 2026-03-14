const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/plugins/OBS/streaming/templates/Streaming.json');
const json = JSON.parse(fs.readFileSync(file, 'utf8'));

const overlayNames = new Set([
  'JuryDeliberationSource',
  'ChallengeSource',
  'TechnicalBreakSource'
]);

const liveScenes = new Set([
  'Platform', 'Diagonal', 'Waiting', 'Rankings', 'Background'
]);

let changed = 0;
for (const entry of json) {
  if (entry.id === 'scene' && liveScenes.has(entry.name)) {
    const items = entry.settings.items;
    const before = items.length;
    entry.settings.items = items.filter(item => !overlayNames.has(item.name));
    const removed = before - entry.settings.items.length;
    if (removed > 0) {
      console.log(`${entry.name}: removed ${removed} legacy overlay(s), kept ${entry.settings.items.length} items`);
      changed += removed;
    }
  }
}

fs.writeFileSync(file, JSON.stringify(json, null, 4) + '\n', 'utf8');
console.log(`\nTotal: stripped ${changed} legacy overlay items from ${liveScenes.size} scenes`);
