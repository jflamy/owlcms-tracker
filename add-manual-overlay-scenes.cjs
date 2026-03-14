const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/plugins/OBS/streaming/templates/Streaming.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Map: source scene name -> new ManualOverlays scene name
const PAIRS = [
  { base: 'Platform',  cameraSource: 'PlatformSource',  cameraUuid: 'a0000001-0001-0001-0001-000000000002' },
  { base: 'Diagonal',  cameraSource: 'DiagonalSource',  cameraUuid: 'a0000001-0001-0001-0001-000000000003' },
  { base: 'Waiting',   cameraSource: 'WaitingSource',   cameraUuid: 'a0000001-0001-0001-0001-000000000004' },
];

// UUID base for new scenes (unique prefix)
const uuidBase = 'c0000002-0001-0001-0001-00000000';

function makeItem(name, sourceUuid, visible, id) {
  return {
    name,
    source_uuid: sourceUuid,
    visible,
    locked: false,
    rot: 0,
    align: 5,
    bounds_type: 0,
    bounds_align: 0,
    bounds_crop: false,
    crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0,
    id,
    group_item_backup: false,
    pos: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    bounds: { x: 1920, y: 1080 },
    scale_filter: 'disable',
    blend_method: 'default',
    blend_type: 'normal',
    show_transition: { duration: 0 },
    hide_transition: { duration: 0 },
    private_settings: {}
  };
}

function makeMinimalItem(name, visible) {
  return {
    name,
    visible,
    rot: 0,
    align: 5,
    bounds_type: 0,
    bounds_align: 0,
    crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0,
    pos: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    bounds: { x: 1920, y: 1080 }
  };
}

PAIRS.forEach(({ base, cameraSource, cameraUuid }, idx) => {
  const sceneName = `${base}ManualOverlays`;
  const sceneUuid = `${uuidBase}${String(idx + 1).padStart(4, '0')}`;

  // Check if already exists
  if (data.sources.find(s => s.name === sceneName)) {
    console.log(`${sceneName}: already exists, skipping`);
    return;
  }

  // Build items: camera (visible) + overlays (all hidden) + audio + EventOverlay
  const items = [
    makeItem(cameraSource, cameraUuid, true, 1),
    makeItem('JuryDeliberationSource', 'a0000001-0001-0001-0001-000000000010', false, 2),
    makeItem('ChallengeSource', 'a0000001-0001-0001-0001-000000000011', false, 3),
    makeItem('TechnicalBreakSource', 'a0000001-0001-0001-0001-000000000012', false, 4),
    makeItem('LiftInfoOverlay', 'a0000001-0001-0001-0001-000000000013', false, 5),
    makeItem('AnnouncerAudio', '0614efc6-55b4-457a-91fa-59eee8f30e5d', true, 6),
    makeMinimalItem('EventOverlay', false),
  ];

  const scene = {
    prev_ver: 536870914,
    name: sceneName,
    uuid: sceneUuid,
    id: 'scene',
    versioned_id: 'scene',
    settings: {
      custom_size: false,
      id_counter: 7,
      items
    },
    mixers: 0,
    sync: 0,
    flags: 0,
    volume: 1,
    balance: 0.5,
    enabled: true,
    muted: false,
    'push-to-mute': false,
    'push-to-mute-delay': 0,
    'push-to-talk': false,
    'push-to-talk-delay': 0,
    hotkeys: { 'OBSBasic.SelectScene': [] },
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    canvas_uuid: '6c69626f-6273-4c00-9d88-c5136d61696e',
    private_settings: {}
  };

  // Add to sources array (after corresponding base scene)
  const baseIdx = data.sources.findIndex(s => s.name === base && s.id === 'scene');
  if (baseIdx !== -1) {
    data.sources.splice(baseIdx + 1, 0, scene);
  } else {
    data.sources.push(scene);
  }

  // Add to scene_order (after corresponding base scene)
  const orderIdx = data.scene_order.findIndex(s => s.name === base);
  if (orderIdx !== -1) {
    data.scene_order.splice(orderIdx + 1, 0, { name: sceneName });
  } else {
    data.scene_order.push({ name: sceneName });
  }

  console.log(`${sceneName}: added (after ${base})`);
});

fs.writeFileSync(file, JSON.stringify(data, null, 4) + '\n');
console.log('Done.');
