/**
 * The flyer's layout rules, pure, in PDF points (72 per inch; the design
 * canvas "Lost Pet Flyers, second design" is drawn at 96 px per inch, so
 * 1 px = 0.75 pt).
 *
 * The flyer is a photo print on a lit yellow sheet (render/ground.js).
 * At the head: LOST in a wide face, cream on a red band set a touch
 * askew, with the name beside it and, under the name, the reward and
 * "Needs medication" as pills. Nothing is ever drawn over the photo.
 * Then the print beside the facts: the photo as tall as the sheet allows,
 * its width from the photo's own shape (a portrait phone photo keeps its
 * shape; a wide one is cut to a tall print around the pet), in a cream
 * mat with a hard navy shadow; beside it, where and when, the last-seen
 * map, and what to look for. Then "If you see Max" on a cream note card,
 * the full width, never cut; then the contact panel on navy: the phone
 * number with the email under it, the QR code and the short link. Tear
 * tabs run along the foot. Every block but the photo row has a set
 * height; the row takes what is left.
 *
 * `planSheet` sizes one page (Letter with tear tabs, or the poster, the
 * Letter sheet scaled by its width); `planHalf` sizes the half sheet,
 * where the sticker is beside the words. `unboundedEm` measures the
 * display face so the word and the number never wrap. All tested in
 * __tests__/lib/flyer-layout.test.js.
 */

export const PX = 0.75;

export const PAGES = {
  LETTER: { w: 612, h: 792 },
  TABLOID: { w: 792, h: 1224 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Unbounded 900's advance widths in ems, measured from the file with fontkit. */
const UNBOUNDED_W = {
  A: 1.0, B: 0.91, C: 0.95, D: 0.95, E: 0.81, F: 0.79, G: 0.98, H: 0.96, I: 0.38, J: 0.82, K: 0.9, L: 0.78, M: 1.27,
  N: 0.99, O: 0.98, P: 0.84, Q: 0.98, R: 0.88, S: 0.87, T: 0.84, U: 0.89, V: 0.97, W: 1.39, X: 0.92, Y: 0.96, Z: 0.83,
  a: 0.85, b: 0.83, c: 0.79, d: 0.85, e: 0.75, f: 0.62, g: 0.84, h: 0.81, i: 0.35, j: 0.35, k: 0.78, l: 0.35, m: 1.24,
  n: 0.82, o: 0.81, p: 0.83, q: 0.83, r: 0.58, s: 0.79, t: 0.64, u: 0.81, v: 0.81, w: 1.17, x: 0.77, y: 0.82, z: 0.72,
  0: 0.95, 1: 0.55, 2: 0.86, 3: 0.86, 4: 0.9, 5: 0.83, 6: 0.88, 7: 0.79, 8: 0.92, 9: 0.88,
  '(': 0.43, ')': 0.43, '-': 0.38, '.': 0.33, ' ': 0.24, ',': 0.33, $: 0.84, '@': 1.07, '/': 0.48, ':': 0.35, '?': 0.74,
};

/** The width of `text` set in Unbounded 900, in ems, padded 3% so a fitted line never wraps. */
export function unboundedEm(text) {
  let em = 0;
  for (const ch of String(text || '')) em += UNBOUNDED_W[ch] ?? 0.85;
  return em * 1.03;
}

/** The largest Unbounded size, up to `base`, at which `text` fits in `maxW`. */
export function fitUnbounded(text, maxW, base, min) {
  return Math.max(min, Math.min(base, maxW / (unboundedEm(text) || 1)));
}

/** Width estimate (ems) for Inter, padded so fitted lines never wrap. */
export function interEm(text) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.3;
    else if ('mwMW@'.includes(ch)) em += 0.9;
    else if (ch === ' ') em += 0.27;
    else if (ch >= 'a' && ch <= 'z') em += 0.55;
    else if (ch >= 'A' && ch <= 'Z') em += 0.66;
    else if (ch >= '0' && ch <= '9') em += 0.6;
    else em += 0.58;
  }
  return em * 1.06;
}

/** The largest Inter size, up to `base`, at which `text` fits in `maxW`. */
export function fitInter(text, maxW, base, min) {
  return Math.max(min, Math.min(base, maxW / (interEm(text) || 1)));
}

/** The width of an eyebrow (Inter 700, uppercase, tracked 0.14 em) set at `size`. */
export function eyebrowW(text, size) {
  const t = String(text || '').toUpperCase();
  return (interEm(t) + t.length * 0.14) * size;
}

/**
 * Unbounded in react-pdf: the baseline sits at the font's ascent (0.995
 * em) from the top of a line box, so caps run from 0.245 em to 0.995 em
 * and a tight line is drawn with those margins (Flyer.jsx, TightLine).
 * The block it takes on the sheet is the cap height.
 */
export const UNBOUNDED = { cap: 0.75, top: 0.245 };

/** The photo print: its hard navy shadow and corner radius as shares of its width, and the cream mat inside the navy edge. */
export const PRINT = { shadow: 0.014, radius: 0.03, mat: 0.008 };

/** The photo inside a print `w` by `h` at scale `k`: the navy edge, the cream mat, and what is left for the picture. */
export function printInner(w, h, k = 1) {
  const edge = 2 * k;
  const mat = Math.max(3, Math.round(w * PRINT.mat));
  return { edge, mat, w: w - 2 * (edge + mat), h: h - 2 * (edge + mat) };
}

/** The word's band: the air above and below the caps, the air at the ends, and its hard shadow, as shares of the size. */
export const BAND = { pad: 0.13, padX: 0.28, shadow: 0.05 };

/** The band around `text` set in Unbounded at `size`: its width and height, and the shadow's offset, which adds to the block. */
export function bandBox(size, text) {
  const w = (unboundedEm(text) / 1.03) * size + 2 * BAND.padX * size;
  const h = size * (UNBOUNDED.cap + 2 * BAND.pad);
  return { w, h, off: Math.max(2, Math.round(h * BAND.shadow)) };
}

/** Kept for the share images' old sticker maths while they move to the print; unused on paper. */
export const STICKER = { ring: 0.027, shadow: 0.028 };

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only. The photo row, the
 * print beside the facts, takes what is left.
 */
export function blocks(k = 1) {
  return {
    side: 30 * k, // 40 px of sheet at the sides
    band: 12 * k, // the caution stripes along the head (and the foot, without tabs)
    top: 26 * k, // above the head
    wordMax: 72 * k, // LOST at its largest
    wordShare: 0.58, // the band takes at most this much of the width, so the name has room beside it
    headGap: 14 * k, // between the band and the name
    headToRow: 10 * k,
    colGap: 14 * k, // between the print and the facts column
    printMin: 250 * k, // the print's width, from the photo's shape, within these
    printMax: 330 * k,
    printAspectMin: 0.62, // the print is never narrower than this, so the row never grows past printMax / 0.62
    rowToAdvice: 10 * k,
    advice: 82 * k, // "If you see Max" on its note card: the health line and what to do, the full width
    contactGap: 9 * k,
    contact: 84 * k, // the navy panel: the phone and the email, the QR code and the short link
    tabsGap: 10,
    tabs: 48,
    bottom: 10.5,
  };
}

/**
 * @param {{w:number,h:number}} page
 * @param {{aspect:number}|null} photo width over height, or null for no photo
 * @param {{k?:number, tabs?:boolean, stamp?:string}} opts
 */
export function planSheet(page, photo, { k = 1, tabs = true, stamp = 'LOST' } = {}) {
  const b = blocks(k);
  const contentW = page.w - b.side * 2;
  const tabsH = tabs ? b.tabsGap + b.tabs : 0;
  const bottom = tabs ? b.bottom : b.side;
  const aspect = photo?.aspect && Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : null;
  const wordSize = fitUnbounded(stamp, contentW * b.wordShare, b.wordMax, 40 * k);
  const band = bandBox(wordSize, stamp);
  const head = band.h + band.off;
  const nameW = contentW - band.w - band.off - b.headGap;
  const below = b.headToRow + b.rowToAdvice + b.advice + b.contactGap + b.contact + tabsH + bottom;
  const room = page.h - b.top - head - below;
  // The row: as tall as the sheet allows, but the print is never a narrow strip.
  const row = Math.floor(Math.min(room, b.printMax / b.printAspectMin));
  const slack = (room - row) / 2;
  const printW = aspect ? clamp(Math.round(row * aspect), b.printMin, b.printMax) : Math.round(300 * k);
  const off = Math.round(printW * PRINT.shadow);
  const colW = contentW - printW - off - b.colGap;
  const inner = printInner(printW, row, k);
  return {
    k,
    page,
    contentW,
    side: b.side,
    stripe: b.band,
    foot: !tabs,
    top: b.top + slack,
    wordSize,
    band,
    head,
    headGap: b.headGap,
    nameW,
    headToRow: b.headToRow,
    row,
    photo: { w: printW, h: row },
    colGap: b.colGap,
    colW,
    mapH: Math.round(row * 0.56), // the last-seen map across the facts column
    rowToAdvice: b.rowToAdvice,
    advice: b.advice,
    contactGap: b.contactGap,
    contact: b.contact,
    tabs: tabs ? b.tabs : 0,
    tabsGap: tabs ? b.tabsGap : 0,
    bottom: bottom + slack,
    hasPhoto: Boolean(aspect),
    focalAt: 0.42,
    frame: { w: printW, h: row },
    frameAspect: aspect ? inner.w / inner.h : null,
  };
}

/** Two half sheets on one Letter page: the photo beside the words. */
export function planHalf(page = PAGES.LETTER, photo, { stamp = 'LOST' } = {}) {
  const halfH = page.h / 2;
  const pad = 15; // 20 px
  const aspect = photo?.aspect && photo.aspect > 0 ? photo.aspect : null;
  const photoW = 270;
  const photoH = halfH - pad * 2 - 3;
  const colX = pad + photoW + 6 + pad;
  const detailsW = page.w - colX - pad;
  const wordSize = fitUnbounded(stamp, detailsW, 44, 36);
  const inner = printInner(photoW, photoH, 0.8);
  return {
    halfH,
    pad,
    stripe: 7, // the caution stripes along the head and the foot of each half
    photo: { w: photoW, h: photoH },
    mapH: 50, // the last-seen map across the column
    colX,
    detailsW,
    wordSize,
    band: bandBox(wordSize, stamp),
    frame: { w: photoW, h: photoH },
    frameAspect: aspect ? inner.w / inner.h : null,
    hasPhoto: Boolean(aspect),
    focalAt: 0.42,
  };
}

/**
 * The rectangle a frame of `aspect` (w/h) cuts from a photo of w by h,
 * with the focal point (0..1 of each side) `focalAt` of the way down the
 * frame (0.5: centered) and the cut kept inside the photo. Returns null
 * when the photo already has that shape (within 2%).
 */
export function cropRect(w, h, focal, aspect, focalAt = 0.5) {
  if (!(w > 0 && h > 0 && aspect > 0)) return null;
  const have = w / h;
  if (Math.abs(have - aspect) / aspect < 0.02) return null;
  const fx = clamp(focal?.x ?? 0.5, 0, 1);
  const fy = clamp(focal?.y ?? 0.45, 0, 1);
  if (have > aspect) {
    const cw = Math.round(h * aspect);
    const left = Math.round(clamp(fx * w - cw / 2, 0, w - cw));
    return { left, top: 0, width: cw, height: h };
  }
  const ch = Math.round(w / aspect);
  const top = Math.round(clamp(fy * h - focalAt * ch, 0, h - ch));
  return { left: 0, top, width: w, height: ch };
}

/**
 * The share images' photo prints (px): where each size's print sits and
 * how tall it is; its width comes from the photo's shape, within `wMin`
 * and `wMax` (`socialFrame`). The print's centre is where the ground's
 * light and rays come from (ground.js); `band` is the caution stripes'
 * height.
 */
export const SOCIAL_FRAMES = {
  og: { x: 56, y: 58, h: 514, wMin: 386, wMax: 560, focalAt: 0.42, band: 16 },
  square: { x: 40, y: 147, h: 634, wMin: 440, wMax: 620, focalAt: 0.42, band: 18 },
  story: { x: 56, y: 368, h: 968, wMin: 480, wMax: 600, focalAt: 0.42, band: 22 },
};

/** The print one share image draws for a photo of `aspect` (width over height; null for no photo). */
export function socialFrame(size, aspect) {
  const f = SOCIAL_FRAMES[size] || SOCIAL_FRAMES.og;
  const a = aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : null;
  const w = a ? clamp(Math.round(f.h * a), f.wMin, f.wMax) : Math.round((f.wMin + f.wMax) / 2);
  return { ...f, w, off: Math.round(w * PRINT.shadow) };
}
