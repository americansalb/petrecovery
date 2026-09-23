/**
 * The region a MapKit map is set to so that a set of points is on
 * screen, with room for the pins drawn on them.
 *
 * Two things about MapKit decide the arithmetic here, both measured in
 * a browser rather than taken from its documentation:
 *
 * - It zooms out no further than a world `MAPKIT_WORLD_PX` pixels wide,
 *   so a map `width` pixels across shows at most 360 * width / 1024
 *   degrees of longitude: about 135 on a phone.
 *
 * - The map is Mercator, and a region is centred on its centre in
 *   degrees. A region from 12 to 43 degrees north is centred on 27.5,
 *   but on the map 43 lies further from 27.5 than 12 does, so the
 *   northern pin gets less of the padding than the southern one. On a
 *   reveal the answer at 43 north sat 40px from the top of the map, its
 *   pin (which stands on the point and rises about 40px above it) cut
 *   off, while the guess had 70px of room below it. So the padding is
 *   worked out in the projection, in pixels, and the region is centred
 *   where the projection's middle is. MapKit sizes a region's height
 *   as its span over the cosine of its centre latitude (checked against
 *   the heights it actually drew), which is what `latSpan` is solved
 *   for.
 */

/** How wide the world is, in pixels, with MapKit zoomed out as far as it goes. */
export const MAPKIT_WORLD_PX = 1024;

const RAD = Math.PI / 180;
const MAX_LAT = 85;

/** Web Mercator y of a latitude. */
export function mercatorY(lat) {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * RAD;
  return Math.log(Math.tan(Math.PI / 4 + clamped / 2));
}

/** The latitude of a Web Mercator y. */
export function latitudeOf(y) {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
}

const wrap = (value) => ((((value + 180) % 360) + 360) % 360) - 180;

/**
 * The region that shows every point, the short way round, with room
 * for the pins at its edges.
 *
 * MapKit's showItems measured a line through the points west to east
 * without wrapping: answers in Utah and Brisbane made a region 265
 * degrees wide, more than a half-screen map can show at its widest.
 * The smallest arc of longitude that holds every point is found from
 * the largest gap between neighbouring longitudes, and it can cross
 * the Pacific.
 *
 * `padding` is the room at the sides, in pixels. A pin stands on its
 * point and rises above it, while its title hangs below, so the room
 * above (`top`) is larger than the room below (`bottom`).
 *
 * When the points cannot all be shown (a narrow map, a world game),
 * the stretch holding the most of them is framed, each point weighed
 * by its `weight`: answers count double, being what the player came to
 * see. What is framed then is never tighter than `fallbackSpan`
 * degrees: an answer on its own was framed on its own streets, with
 * nothing to say which country it was in.
 */
export function regionAround(
  points,
  {
    width = 0,
    height = 0,
    padding = 56,
    top = padding + 8,
    bottom = padding - 12,
    minimumSpan = 0.6,
    fallbackSpan = 45,
    worldWidth = MAPKIT_WORLD_PX,
  } = {}
) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => wrap(p.lng)).sort((a, b) => a - b);
  let gap = lngs[0] + 360 - lngs[lngs.length - 1];
  let west = lngs[0];
  for (let i = 1; i < lngs.length; i += 1) {
    if (lngs[i] - lngs[i - 1] > gap) {
      gap = lngs[i] - lngs[i - 1];
      west = lngs[i];
    }
  }
  const lngSpan = 360 - gap;

  if (width > 0 && lngSpan > (360 * width) / worldWidth) {
    const room = (360 * Math.max(width - padding * 2, width / 2)) / worldWidth;
    let best = null;
    for (const start of points) {
      const from = wrap(start.lng);
      const inside = points.filter((p) => (wrap(p.lng) - from + 360) % 360 <= room);
      const score = inside.reduce((sum, p) => sum + (p.weight ?? 1), 0);
      if (!best || score > best.score) best = { score, inside };
    }
    if (best.inside.length < points.length) {
      return regionAround(best.inside, {
        width,
        height,
        padding,
        top,
        bottom,
        worldWidth,
        fallbackSpan,
        minimumSpan: Math.max(minimumSpan, Math.min(room, fallbackSpan)),
      });
    }
  }

  let lng = west + lngSpan / 2;
  if (lng > 180) lng -= 360;
  const grow = (size) => (size > padding * 3 ? size / (size - padding * 2) : 1.25);
  const lngOut = Math.min(360, Math.max(minimumSpan, lngSpan * grow(width)));

  // North and south, padded in the projection and in pixels: how much of
  // the projection a pixel is when the height is what limits the zoom.
  const yNorth = mercatorY(Math.max(...lats));
  const ySouth = mercatorY(Math.min(...lats));
  const inner = height - top - bottom;
  let yTop = yNorth;
  let yBottom = ySouth;
  if (yNorth > ySouth) {
    if (height > 0 && inner > height / 3) {
      const perPixel = (yNorth - ySouth) / inner;
      yTop += top * perPixel;
      yBottom -= bottom * perPixel;
    } else {
      const extra = (yNorth - ySouth) * 0.125;
      yTop += extra;
      yBottom -= extra;
    }
  }
  const lat = latitudeOf((yTop + yBottom) / 2);
  const latSpan = ((yTop - yBottom) * Math.cos(lat * RAD)) / RAD;
  return {
    lat,
    lng,
    latSpan: Math.min(170, Math.max(minimumSpan, latSpan)),
    lngSpan: lngOut,
  };
}
