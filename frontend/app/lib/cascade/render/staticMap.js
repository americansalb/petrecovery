/**
 * Static map builder for flyers: stitches raster basemap tiles around the
 * last-seen point into a spec the PDF renderer can composite (tile images +
 * pin + half-mile ring), so the poster literally shows WHERE the pet was
 * lost. Node runtime, network best-effort: any failure returns null and the
 * flyer renders without a map rather than failing.
 *
 * Tiles are fetched @2x and drawn at half size (≈144dpi in print). One spec
 * is built at the largest size a variant needs; smaller variants render a
 * centered crop, so the network cost is paid once per case.
 */

const TILE_PT = 128; // one 256px @2x tile drawn at 128pt
const MAX_TILES = 24;
const FETCH_TIMEOUT_MS = 4000;

/** Species-aware zoom: a lost cat's world is a few houses; a dog's is a mile. */
export function zoomForSpecies(species) {
  if (species === 'CAT' || species === 'RABBIT') return 17;
  if (species === 'DOG') return 15;
  return 16;
}

const TILE_STYLES = {
  light: [
    (z, x, y) => `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
    (z, x, y) => `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
    (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  ],
  // Warm-toned basemap the poster design system uses (Leaflet voyager).
  voyager: [
    (z, x, y) => `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
    (z, x, y) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
    (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  ],
};

async function fetchTileDataUrl(z, x, y, style = 'light') {
  for (const makeUrl of TILE_STYLES[style] || TILE_STYLES.light) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(makeUrl(z, x, y), {
        signal: controller.signal,
        headers: { 'User-Agent': 'ReunitePets-flyer/1.0 (+https://www.reunitepets.org)' },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) continue;
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      /* try the next source */
    }
  }
  return null;
}

/**
 * @param {number} lat last-seen latitude
 * @param {number} lng last-seen longitude
 * @param {{width?:number, height?:number, zoom?:number}} opts box in pt
 * @returns {Promise<null | {width,height,tiles:[{src,left,top}],pin:{x,y},ring:{r,label}|null,attribution:string}>}
 */
export async function buildFlyerMapSpec(lat, lng, { width = 680, height = 210, zoom = 16, style = 'light' } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85) return null;

  const worldPt = 2 ** zoom * TILE_PT;
  const latRad = (lat * Math.PI) / 180;
  const cx = ((lng + 180) / 360) * worldPt;
  const cy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldPt;
  const left = cx - width / 2;
  const top = cy - height / 2;

  const maxTile = 2 ** zoom;
  const x0 = Math.floor(left / TILE_PT);
  const y0 = Math.floor(top / TILE_PT);
  const x1 = Math.floor((left + width) / TILE_PT);
  const y1 = Math.floor((top + height) / TILE_PT);

  const jobs = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= maxTile) continue;
    for (let tx = x0; tx <= x1; tx++) {
      jobs.push({ tx, ty, leftPt: tx * TILE_PT - left, topPt: ty * TILE_PT - top });
    }
  }
  if (!jobs.length || jobs.length > MAX_TILES) return null;

  const tiles = [];
  let failed = 0;
  await Promise.all(
    jobs.map(async (j) => {
      const xWrapped = ((j.tx % maxTile) + maxTile) % maxTile;
      const src = await fetchTileDataUrl(zoom, xWrapped, j.ty, style);
      if (src) tiles.push({ src, left: j.leftPt, top: j.topPt });
      else failed += 1;
    })
  );
  // A map with holes is worse than no map.
  if (!tiles.length || failed > 0) return null;

  // Distance ring for scale: the largest of 1/10, 1/4, 1/2, or 1 mile that
  // fits the box. metersPerPt: a 128pt tile covers the same ground as the
  // classic 256px tile, so resolution doubles.
  const metersPerPt = (2 * 156543.03392 * Math.cos(latRad)) / 2 ** zoom;
  const maxR = (Math.min(width, height) / 2) * 0.86;
  let ring = null;
  for (const miles of [1, 0.5, 0.25, 0.1]) {
    const r = (miles * 1609.34) / metersPerPt;
    if (r <= maxR) {
      ring = { r, label: miles === 0.1 ? '500 FT' : miles === 1 ? '1 MILE' : `${miles === 0.5 ? '1/2' : '1/4'} MILE` };
      break;
    }
  }

  // 180m halo circle (the poster design's Leaflet treatment: soft accent
  // fill + a white-stroked center dot rather than a teardrop pin).
  const haloR = 180 / metersPerPt;

  return {
    width,
    height,
    tiles,
    pin: { x: width / 2, y: height / 2 },
    ring,
    halo: { r: haloR },
    attribution: '© OpenStreetMap contributors · © CARTO',
  };
}
