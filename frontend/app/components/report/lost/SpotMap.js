'use client';

/**
 * SpotMap - a small picture of the map around one point, with the pin in
 * the middle: on the lost report's review screen, the spot the whole
 * search circle is drawn around, so the owner sees it once more before
 * posting. Plain tiles from app/lib/maps/tiles.js laid out around the
 * point; no map library, nothing to drag. Tapping it goes back to the
 * place screen.
 */

import { Pencil } from 'lucide-react';
import { tileUrl, TILE_ATTRIBUTION_TEXT } from '@/app/lib/maps/tiles';

const TILE = 256;
const REACH_X = 420; // px either side of the pin the tiles cover: wider than any phone column
const REACH_Y = 110;

/** The point's position in pixels on the world map at `zoom`. */
export function worldPixel(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** The tiles that cover the box around the point, each with its offset from the point. */
export function tilesAround(lat, lng, zoom) {
  const p = worldPixel(lat, lng, zoom);
  const count = 2 ** zoom;
  const out = [];
  for (let ty = Math.floor((p.y - REACH_Y) / TILE); ty <= Math.floor((p.y + REACH_Y) / TILE); ty += 1) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor((p.x - REACH_X) / TILE); tx <= Math.floor((p.x + REACH_X) / TILE); tx += 1) {
      const wrapped = ((tx % count) + count) % count;
      out.push({ key: `${tx}-${ty}`, src: tileUrl(zoom, wrapped, ty), left: Math.round(tx * TILE - p.x), top: Math.round(ty * TILE - p.y) });
    }
  }
  return out;
}

export default function SpotMap({ lat, lng, label, place, onEdit, zoom = 16, pinColor = '#dc2626' }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tiles = tilesAround(lat, lng, zoom);
  const Tag = onEdit ? 'button' : 'div';
  return (
    <Tag
      {...(onEdit ? { type: 'button', onClick: onEdit, 'aria-label': `Change where: ${place || 'the pinned spot'}` } : {})}
      className="block w-full max-w-[350px] overflow-hidden rounded-2xl border border-midnight-200 bg-white text-left"
    >
      <div className="relative h-[150px] overflow-hidden bg-midnight-100" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2">
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.key}
              src={t.src}
              alt=""
              width={TILE}
              height={TILE}
              draggable={false}
              // A tile that does not arrive leaves the grey ground, not a broken-image mark.
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden';
              }}
              className="absolute max-w-none select-none"
              style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
            />
          ))}
        </div>
        <span
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-lg"
          style={{ background: pinColor }}
        />
        <span className="absolute bottom-1 right-1.5 rounded bg-white/80 px-1 text-[11px] text-midnight-600">{TILE_ATTRIBUTION_TEXT}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {label && <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-midnight-500">{label}</p>}
          <p className="truncate text-[16px] font-semibold text-midnight-900">{place || 'The pinned spot'}</p>
        </div>
        {onEdit && <Pencil size={15} className="shrink-0 text-midnight-400" aria-hidden="true" />}
      </div>
    </Tag>
  );
}
