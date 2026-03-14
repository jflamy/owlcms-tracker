const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/plugins/OBS/streaming/templates/Streaming.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Scenes where LiftInfoOverlay should be REMOVED (not lift-related)
const REMOVE_SCENES = new Set([
  'Rankings', 'Scoreboard', 'Background',
  'AthletePresentation', 'OfficialPresentation', 'MedalCeremony'
]);

// Scenes where LiftInfoOverlay should be visible=true (camera + lift-related)
const ON_SCENES = new Set([
  'Platform', 'Diagonal', 'Waiting',
  'GoodLiftImmediate', 'NoLiftImmediate', 'NewRecordImmediate',
  'GoodLiftVisible', 'NoLiftVisible', 'NewRecordVisible',
  'JuryDeliberation', 'Challenge', 'TechnicalBreak',
  'JuryGoodLift', 'JuryNoLift'
]);

// Find scenes in the "sources" array (top-level scene definitions)
let changes = 0;
for (const source of data.sources) {
  if (source.id !== 'scene') continue;
  const sceneName = source.name;
  const items = source.settings && source.settings.items;
  if (!items) continue;

  const idx = items.findIndex(i => i.name === 'LiftInfoOverlay');
  if (idx === -1) continue; // Replay1, Replay2 - no item, correct

  if (REMOVE_SCENES.has(sceneName)) {
    items.splice(idx, 1);
    console.log(`${sceneName}: REMOVED LiftInfoOverlay`);
    changes++;
  } else if (ON_SCENES.has(sceneName)) {
    if (!items[idx].visible) {
      items[idx].visible = true;
      console.log(`${sceneName}: visible false -> true`);
      changes++;
    } else {
      console.log(`${sceneName}: already visible (OK)`);
    }
  } else {
    console.log(`${sceneName}: kept as-is (visible=${items[idx].visible})`);
  }
}

// Also update scene_order items if they have inline items
for (const scene of data.scene_order) {
  if (!scene.items) continue;
  const sceneName = scene.name;
  const idx = scene.items.findIndex(i => i.name === 'LiftInfoOverlay');
  if (idx === -1) continue;

  if (REMOVE_SCENES.has(sceneName)) {
    scene.items.splice(idx, 1);
    console.log(`scene_order/${sceneName}: REMOVED LiftInfoOverlay`);
    changes++;
  } else if (ON_SCENES.has(sceneName)) {
    if (!scene.items[idx].visible) {
      scene.items[idx].visible = true;
      console.log(`scene_order/${sceneName}: visible false -> true`);
      changes++;
    }
  }
}

fs.writeFileSync(file, JSON.stringify(data, null, 4) + '\n');
console.log(`\nDone. ${changes} changes applied.`);
