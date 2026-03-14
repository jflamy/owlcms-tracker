/**
 * Remove all hidden EventOverlay items from scenes in Streaming.json.
 * Keep only the VISIBLE one (in Background scene).
 */
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/plugins/OBS/streaming/templates/Streaming.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

let removed = 0;
const kept = [];

for (const source of data.sources) {
  if (source.id !== 'scene') continue;
  const items = source.settings?.items;
  if (!items) continue;

  const before = items.length;
  source.settings.items = items.filter(item => {
    if (item.name === 'EventOverlay' && item.visible === false) {
      removed++;
      return false;
    }
    return true;
  });

  if (items.length !== source.settings.items.length) {
    // nothing — already counted
  }

  // Check if we kept a visible one
  const keptEO = source.settings.items.find(i => i.name === 'EventOverlay');
  if (keptEO) kept.push(source.name);
}

fs.writeFileSync(file, JSON.stringify(data, null, 4) + '\n', 'utf-8');
console.log(`Removed ${removed} hidden EventOverlay items`);
console.log(`Kept visible EventOverlay in: ${kept.join(', ') || '(none)'}`);
