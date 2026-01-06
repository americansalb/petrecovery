const fs = require('fs');
const path = require('path');

const SF = { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, radiusKm: 20 };

function buildQuery(lat, lng, radiusM) {
  return `[out:json][timeout:90];
(
  way["natural"="water"](around:${radiusM},${lat},${lng});
  relation["natural"="water"](around:${radiusM},${lat},${lng});
  way["waterway"~"river|stream|canal"](around:${radiusM},${lat},${lng});
  way["natural"="coastline"](around:${radiusM},${lat},${lng});
  way["highway"="motorway"](around:${radiusM},${lat},${lng});
  way["highway"="trunk"](around:${radiusM},${lat},${lng});
  way["highway"="primary"](around:${radiusM},${lat},${lng});
  way["railway"~"rail|light_rail"](around:${radiusM},${lat},${lng});
);
out body;
>;
out skel qt;`;
}

async function download() {
  console.log('Downloading terrain for San Francisco (20km radius)...');
  const radiusM = SF.radiusKm * 1000;
  const query = buildQuery(SF.lat, SF.lng, radiusM);

  // Try multiple Overpass API endpoints
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  let data;
  for (const endpoint of endpoints) {
    try {
      console.log(`  Trying ${endpoint}...`);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!resp.ok) {
        console.log(`    HTTP ${resp.status}, trying next...`);
        continue;
      }
      data = await resp.json();
      console.log(`  Success! Got ${data.elements?.length || 0} elements`);
      break;
    } catch (err) {
      console.log(`    Error: ${err.message}, trying next...`);
    }
  }

  if (!data) {
    throw new Error('All endpoints failed');
  }

  // Parse
  const nodes = new Map();
  const waterAreas = [];
  const coastlineSegments = [];
  const roads = [];

  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lng: el.lon });
  }

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const points = el.nodes.map(id => nodes.get(id)).filter(Boolean);
    if (points.length < 2) continue;
    const tags = el.tags || {};

    // Water
    if (tags.natural === 'water' || tags.waterway) {
      let s=Infinity,w=Infinity,n=-Infinity,e=-Infinity;
      for(const p of points){s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lng);e=Math.max(e,p.lng);}
      waterAreas.push({ type: 'water', points, bbox: {south:s,west:w,north:n,east:e} });
    }
    if (tags.natural === 'coastline') coastlineSegments.push(points);

    // Roads
    if (tags.highway === 'motorway') roads.push({ type: 'motorway', points, name: tags.name, crossingDifficulty: 0.05, dangerLevel: 0.95 });
    else if (tags.highway === 'trunk') roads.push({ type: 'trunk', points, name: tags.name, crossingDifficulty: 0.15, dangerLevel: 0.8 });
    else if (tags.highway === 'primary') roads.push({ type: 'primary', points, name: tags.name, crossingDifficulty: 0.4, dangerLevel: 0.5 });

    // Railways
    if (tags.railway && ['rail', 'light_rail'].includes(tags.railway)) {
      roads.push({ type: 'railway', points, name: tags.name, crossingDifficulty: 0.3, dangerLevel: 0.7 });
    }
  }

  const terrain = {
    bbox: { south: SF.lat - SF.radiusKm/111, north: SF.lat + SF.radiusKm/111,
            west: SF.lng - SF.radiusKm/70, east: SF.lng + SF.radiusKm/70 },
    waterAreas,
    coastlineSegments,
    isCoastal: coastlineSegments.length > 0,
    roads,
    hasHighways: roads.some(r => r.type === 'motorway' || r.type === 'trunk'),
    hasRailways: roads.some(r => r.type === 'railway'),
    metadata: { city: SF.name, state: SF.state, downloadedAt: new Date().toISOString(), radiusKm: SF.radiusKm, center: { lat: SF.lat, lng: SF.lng } }
  };

  const outDir = path.join(__dirname, '..', 'public', 'data', 'terrain');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'san-francisco-ca.json');
  fs.writeFileSync(outPath, JSON.stringify(terrain, null, 2));
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`\nSaved: san-francisco-ca.json (${sizeMB} MB)`);
  console.log(`  Water areas: ${waterAreas.length}`);
  console.log(`  Coastlines: ${coastlineSegments.length}`);
  console.log(`  Roads/Railways: ${roads.length}`);
}

download().catch(console.error);
