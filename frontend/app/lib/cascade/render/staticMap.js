/**
 * Static map builder for flyers: stitches raster basemap tiles around the
 * last-seen point into a spec the PDF renderer can composite (tile images +
 * pin + half-mile ring), so the poster literally shows WHERE the pet was
 * lost. Node runtime, network best-effort: any failure returns null and the
 * flyer renders without a map rather than failing.
 *
 * Each 256px tile is drawn at TILE_PT (≈144dpi in print). One spec
 * is built at the largest size a variant needs; smaller variants render a
 * centered crop, so the network cost is paid once per case.
 */

import { tileUrl, TILE_ATTRIBUTION_TEXT } from '@/app/lib/maps/tiles';

const TILE_PT = 128; // one 256px @2x tile drawn at 128pt
const MAX_TILES = 36;
const FETCH_TIMEOUT_MS = 6000;
// OpenStreetMap's tile policy allows two download threads and refuses bulk
// use; a redraw of every open case is bulk use if it fires 35 requests at
// once per case. So: two at a time, a short wait between, and a retry with
// a pause when a tile is refused.
const CONCURRENCY = 2;
const ATTEMPTS = 3;
const RETRY_MS = [600, 1800];
// A map with a hole at the edge beats no map; a hole over the pin does not.
const MAX_MISSING_SHARE = 0.25;

/** Species-aware zoom: a lost cat's world is a few houses; a dog's is a mile. */
export function zoomForSpecies(species) {
  if (species === 'CAT' || species === 'RABBIT') return 17;
  if (species === 'DOG') return 15;
  return 16;
}

// Both styles draw OpenStreetMap's standard tiles (app/lib/maps/tiles.js).
// They used to try CARTO first and fall back to OpenStreetMap, but CARTO
// now answers keyless requests with a tile stamped "API KEY REQUIRED" and a
// 200, so the fallback never ran and every flyer printed the stamp.
// OpenStreetMap serves 256px tiles only, drawn at TILE_PT each.
const TILE_STYLES = {
  light: [tileUrl],
  voyager: [tileUrl],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTileOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ReunitePets-flyer/1.0 (+https://www.reunitepets.org)' },
    });
    if (!res.ok) return { status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { buf } : { status: 0 };
  } catch (err) {
    return { status: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTileDataUrl(z, x, y, style = 'light') {
  let last = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_MS[attempt - 1] || 2000);
    for (const makeUrl of TILE_STYLES[style] || TILE_STYLES.light) {
      const r = await fetchTileOnce(makeUrl(z, x, y));
      if (r.buf) return `data:image/png;base64,${r.buf.toString('base64')}`;
      last = r.status;
      // Not found is final; anything else (429, 5xx, a timeout) gets the retry.
      if (r.status === 404) return null;
    }
  }
  console.warn(`[map] tile ${[z, x, y].join('/')} failed after ${ATTEMPTS} attempts: ${last}`);
  return null;
}

/** Run `jobs` through `fn`, `limit` at a time, with a breath between starts. */
async function pooled(jobs, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      await fn(job);
      await sleep(40);
    }
  });
  await Promise.all(workers);
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
  let pinTileMissing = false;
  const pinTx = Math.floor(cx / TILE_PT);
  const pinTy = Math.floor(cy / TILE_PT);
  await pooled(jobs, CONCURRENCY, async (j) => {
    const xWrapped = ((j.tx % maxTile) + maxTile) % maxTile;
    const src = await fetchTileDataUrl(zoom, xWrapped, j.ty, style);
    if (src) tiles.push({ src, left: j.leftPt, top: j.topPt });
    else {
      failed += 1;
      if (j.tx === pinTx && j.ty === pinTy) pinTileMissing = true;
    }
  });
  // A hole at the edge shows the ground colour; a hole over the pin, or
  // many holes, is no map.
  if (!tiles.length || pinTileMissing || failed / jobs.length > MAX_MISSING_SHARE) {
    console.warn(`[map] no map for ${lat.toFixed(4)},${lng.toFixed(4)} z${zoom}: ${failed} of ${jobs.length} tiles missing${pinTileMissing ? ', the pin tile among them' : ''}`);
    return null;
  }

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
    attribution: TILE_ATTRIBUTION_TEXT,
  };
}
