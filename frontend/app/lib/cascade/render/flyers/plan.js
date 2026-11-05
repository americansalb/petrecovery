/**
 * The flyer's layout rules, pure, in PDF points (72 per inch; the design
 * canvas "Lost Pet Flyers, second design" is drawn at 96 px per inch, so
 * 1 px = 0.75 pt).
 *
 * The flyer is a sticker on a yellow sheet. The pet's photo is cut into a
 * circle with a cream ring and a hard navy shadow, as big as the sheet
 * allows. Under it, centred: LOST in a wide face, the name, where and
 * when, two lines of what to look for, and the phone number inside a navy
 * pill. The reward is a cream tag on the sticker; the QR code sits in a
 * cream tile beside the pill; tear tabs run along the foot on a cream
 * strip. Every block under the sticker has a set height; the sticker
 * takes what is left.
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

/**
 * Unbounded in react-pdf: the baseline sits at the font's ascent (0.995
 * em) from the top of a line box, so caps run from 0.245 em to 0.995 em
 * and a tight line is drawn with those margins (Flyer.jsx, TightLine).
 * The block it takes on the sheet is the cap height.
 */
export const UNBOUNDED = { cap: 0.75, top: 0.245 };

/** The sticker's ring and shadow, as shares of its diameter. */
export const STICKER = { ring: 0.027, shadow: 0.028 };

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only.
 */
export function blocks(k = 1) {
  return {
    side: 30 * k, // 40 px of sheet at the sides
    top: 36 * k, // above the sticker
    gap: 19.5 * k, // between the sticker and the word
    wordMax: 88 * k, // LOST at its largest (118 px)
    name: 30 * k, // "Milo, a tabby"
    nameGap: 7.5 * k,
    lastSeen: 15 * k,
    lastSeenGap: 7.5 * k,
    facts: 36 * k, // two lines
    factsGap: 4.5 * k,
    pillGap: 15 * k,
    pill: 84 * k, // the eyebrow and the phone on navy
    tabsGap: 12,
    tabs: 54,
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
  const wordSize = fitUnbounded(stamp, contentW, b.wordMax, 40 * k);
  const word = wordSize * UNBOUNDED.cap;
  const below = b.gap + word + b.nameGap + b.name + b.lastSeenGap + b.lastSeen + b.factsGap + b.facts + b.pillGap + b.pill + tabsH + bottom;
  const room = page.h - b.top - below;
  const sticker = Math.floor(Math.min(contentW - 2 * STICKER.shadow * contentW, room));
  // A sticker held back by the width (the poster) leaves slack; it goes above and below.
  const slack = (room - sticker) / 2;
  return {
    k,
    page,
    contentW,
    side: b.side,
    top: b.top + slack,
    sticker,
    gap: b.gap,
    wordSize,
    word,
    name: b.name,
    nameGap: b.nameGap,
    lastSeen: b.lastSeen,
    lastSeenGap: b.lastSeenGap,
    facts: b.facts,
    factsGap: b.factsGap,
    pillGap: b.pillGap,
    pill: b.pill,
    tabs: tabs ? b.tabs : 0,
    tabsGap: tabs ? b.tabsGap : 0,
    bottom: bottom + slack,
    hasPhoto: Boolean(aspect),
    focalAt: 0.5,
    frame: { w: sticker, h: sticker },
    frameAspect: aspect ? 1 : null,
  };
}

/** Two half sheets on one Letter page: the sticker beside the words. */
export function planHalf(page = PAGES.LETTER, photo, { stamp = 'LOST' } = {}) {
  const halfH = page.h / 2;
  const pad = 15; // 20 px
  const aspect = photo?.aspect && photo.aspect > 0 ? photo.aspect : null;
  const sticker = 300; // 400 px
  const colX = pad + sticker + sticker * STICKER.shadow + pad;
  const detailsW = page.w - colX - pad;
  return {
    halfH,
    pad,
    sticker,
    stickerTop: pad + (halfH - pad * 2 - 3 - sticker) / 2,
    colX,
    detailsW,
    wordSize: fitUnbounded(stamp, detailsW, 72, 36),
    frame: { w: sticker, h: sticker },
    frameAspect: aspect ? 1 : null,
    hasPhoto: Boolean(aspect),
    focalAt: 0.5,
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

/** The share images' stickers (px): a square cut, drawn as a circle, this big. */
export const SOCIAL_FRAMES = {
  og: { w: 500, h: 500, focalAt: 0.5 },
  square: { w: 560, h: 560, focalAt: 0.5 },
  story: { w: 820, h: 820, focalAt: 0.5 },
};
