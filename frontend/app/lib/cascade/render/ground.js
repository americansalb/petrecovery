/**
 * The ground under every flyer and share image: the brand's yellow, lit
 * from behind the photo, sun rays fanning out from the same point, and a
 * caution-stripe band along the edge. Not a fill: a sheet that moves.
 *
 * Pure geometry, drawn twice from the same shapes: as vector polygons in
 * the PDFs (flyers/Flyer.jsx, SheetGround), crisp at any print size, and
 * as one small PNG overlay in the share images (social/Card.jsx), which
 * `groundOverlayDataUrl` rasterizes with sharp from `groundSvg`. The lit
 * gradient itself is each renderer's own (an SVG RadialGradient on paper,
 * CSS in satori); `GROUND` holds its colours.
 */
import { getSharp } from './photo';

export const GROUND = {
  lemon: '#ffe566', // the lit centre, behind the photo
  yellow: '#facc15', // the brand's yellow
  amber: '#e4a30c', // the far corners
  ink: '#4a2512', // the mascot's brown, deep: the ink, the panel, the stripes, the shadows. Not the site's slate, which prints as black on yellow.
  soft: '#7a4a2e', // the quieter brown: the address, "comes to", the tabs' second line
  rayOpacity: 0.075,
  rayCount: 24, // wedges around the centre; every other one is drawn
};

/** The stops of the lit gradient, as [offset 0..1, colour]. */
export const LIGHT = [
  [0, GROUND.lemon],
  [0.42, GROUND.yellow],
  [1, GROUND.amber],
];

function clipEdge(poly, inside, cut) {
  const out = [];
  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci) {
      if (!pi) out.push(cut(prev, cur));
      out.push(cur);
    } else if (pi) out.push(cut(prev, cur));
  }
  return out;
}

/** Sutherland-Hodgman: the polygon ([x, y] pairs) cut to the rectangle. */
export function clipToRect(poly, { x = 0, y = 0, w, h }) {
  const x2 = x + w;
  const y2 = y + h;
  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let p = poly;
  p = clipEdge(p, (q) => q[0] >= x, (a, b) => at(a, b, (x - a[0]) / (b[0] - a[0])));
  p = clipEdge(p, (q) => q[0] <= x2, (a, b) => at(a, b, (x2 - a[0]) / (b[0] - a[0])));
  p = clipEdge(p, (q) => q[1] >= y, (a, b) => at(a, b, (y - a[1]) / (b[1] - a[1])));
  p = clipEdge(p, (q) => q[1] <= y2, (a, b) => at(a, b, (y2 - a[1]) / (b[1] - a[1])));
  return p;
}

/**
 * The rays: every other wedge of `count` around (cx, cy), cut to the
 * sheet `w` by `h` placed at `top`. Each is a polygon of [x, y] pairs in
 * the sheet's own coordinates (the page's, when `top` is given).
 */
export function rayPolygons({ w, h, top = 0, cx, cy, count = GROUND.rayCount }) {
  const R = 2 * (w + h);
  const step = (Math.PI * 2) / count;
  const out = [];
  for (let i = 0; i < count; i += 2) {
    const a0 = step * (i + 0.5);
    const a1 = a0 + step;
    const tri = [
      [cx, cy],
      [cx + R * Math.cos(a0), cy + R * Math.sin(a0)],
      [cx + R * Math.cos(a1), cy + R * Math.sin(a1)],
    ];
    const cut = clipToRect(tri, { x: 0, y: top, w, h });
    if (cut.length >= 3) out.push(cut);
  }
  return out;
}

/** Caution stripes across a band `s` tall at `y`: the dark stripes, leaning right, cut to the band. */
export function stripePolygons({ w, y, s }) {
  const out = [];
  for (let x = -2 * s; x < w + s; x += 2 * s) {
    const quad = [
      [x + s, y],
      [x + 2 * s, y],
      [x + s, y + s],
      [x, y + s],
    ];
    const cut = clipToRect(quad, { x: 0, y, w, h: s });
    if (cut.length >= 3) out.push(cut);
  }
  return out;
}

/** The bands of a sheet `h` tall at `top`: one at the head, and one at the foot unless `foot` is false. */
export function bands({ h, top = 0, s, foot = true }) {
  const out = [{ y: top, s }];
  if (foot) out.push({ y: top + h - s, s });
  return out;
}

const r2 = (n) => Math.round(n * 100) / 100;
const pointsOf = (poly) => poly.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');

/** The rays and the bands as an SVG document (px), transparent between them. */
export function groundSvg({ w, h, cx, cy, band, foot = true }) {
  const rays = rayPolygons({ w, h, cx, cy })
    .map((p) => `<polygon points="${pointsOf(p)}"/>`)
    .join('');
  const tape = bands({ h, s: band, foot })
    .map(({ y, s }) => {
      const stripes = stripePolygons({ w, y, s })
        .map((p) => `<polygon points="${pointsOf(p)}"/>`)
        .join('');
      return `<rect x="0" y="${r2(y)}" width="${w}" height="${s}" fill="${GROUND.yellow}"/><g fill="${GROUND.ink}">${stripes}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g fill="${GROUND.ink}" fill-opacity="${GROUND.rayOpacity}">${rays}</g>${tape}</svg>`;
}

const overlays = new Map();

/**
 * The ground's rays and bands as a PNG data URL for `spec` ({w, h, cx,
 * cy, band, foot}), drawn once per size and kept. Null when sharp is not
 * there or cannot draw it; the sheet is then the lit yellow and grain.
 */
export function groundOverlayDataUrl(spec) {
  const key = [spec.w, spec.h, spec.cx, spec.cy, spec.band, spec.foot !== false].join('/');
  if (!overlays.has(key)) {
    overlays.set(
      key,
      (async () => {
        const sharp = await getSharp();
        if (!sharp) return null;
        try {
          const png = await sharp(Buffer.from(groundSvg(spec))).png({ palette: true, colours: 64, compressionLevel: 9 }).toBuffer();
          return `data:image/png;base64,${png.toString('base64')}`;
        } catch {
          return null;
        }
      })(),
    );
  }
  return overlays.get(key);
}
