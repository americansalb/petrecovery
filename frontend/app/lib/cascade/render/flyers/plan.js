/**
 * The flyer's layout rules, pure, in PDF points (72 per inch; the design
 * canvas "Lost Pet Flyers, second design" is drawn at 96 px per inch, so
 * 1 px = 0.75 pt).
 *
 * The sheet says three things from across a street: the word (LOST DOG,
 * in Anton, across the full width), the face (the photo, the full width,
 * as tall as the sheet allows) and the phone number. Every other block has
 * a set height; the photo takes what is left. It is cut to that frame's
 * shape around the pet before it is drawn (render/photo.js with
 * `cropRect`), so the frame is always full and the pet is always in it.
 *
 * `planSheet` sizes one page (Letter with tear tabs, or the poster, which
 * is the Letter sheet scaled by its width); `planHalf` sizes the half
 * sheet, where the photo is a column beside the words. `antonEm` measures
 * Anton so the word and the number are set as large as their line allows
 * and never wrap. All tested in __tests__/lib/flyer-layout.test.js.
 */

export const PX = 0.75;

export const PAGES = {
  LETTER: { w: 612, h: 792 },
  TABLOID: { w: 792, h: 1224 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Anton's advance widths in ems, measured from the file with fontkit. */
const ANTON_W = {
  A: 0.49, B: 0.48, C: 0.47, D: 0.49, E: 0.41, F: 0.4, G: 0.48, H: 0.5, I: 0.23, J: 0.47, K: 0.47, L: 0.4, M: 0.75,
  N: 0.5, O: 0.49, P: 0.47, Q: 0.49, R: 0.48, S: 0.46, T: 0.4, U: 0.47, V: 0.47, W: 0.71, X: 0.48, Y: 0.45, Z: 0.41,
  1: 0.33, '(': 0.29, ')': 0.29, '-': 0.31, ' ': 0.23, '.': 0.23, ',': 0.23, $: 0.46, '@': 0.7, '/': 0.33, ':': 0.23,
};

/** The width of `text` set in Anton, in ems, padded 3% so a fitted line never wraps. */
export function antonEm(text) {
  let em = 0;
  for (const ch of String(text || '')) {
    if (ANTON_W[ch] != null) em += ANTON_W[ch];
    else if (ch >= '0' && ch <= '9') em += 0.49;
    else if (ch >= 'a' && ch <= 'z') em += 0.42;
    else if (ch >= 'A' && ch <= 'Z') em += 0.48;
    else em += 0.42;
  }
  return em * 1.03;
}

/** The largest Anton size, up to `base`, at which `text` fits in `maxW`. */
export function fitAnton(text, maxW, base, min) {
  return Math.max(min, Math.min(base, maxW / (antonEm(text) || 1)));
}

/** Anton's line box, as a share of the size, when the word is set tight (satori). */
export const ANTON_LINE = 0.9;

/**
 * Anton in react-pdf: the baseline sits at the font's ascent (1.176 em)
 * from the top of a line box, so caps run from 0.317 em to 1.176 em and a
 * tight word is drawn with those margins (Flyer.jsx, AntonLine). The
 * block it takes on the sheet is the cap height.
 */
export const ANTON_CAP = 0.859;
export const ANTON_TOP = 0.317;

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only.
 */
export function blocks(k = 1) {
  return {
    margin: 30 * k, // 40 px clear inside every edge
    headMax: 160 * k, // the word's largest size; it shrinks to fit the width
    gap: 10.5 * k, // 14 px above and below the photo
    info: 76 * k, // the name, what to look for, last seen; the QR code
    contactGap: 9 * k,
    contact: 77 * k, // the rule, the eyebrow, the phone
    tabsGap: 9,
    tabs: 60,
    bottom: 0,
  };
}

/**
 * @param {{w:number,h:number}} page
 * @param {{aspect:number}|null} photo width over height, or null for no photo
 * @param {{k?:number, tabs?:boolean, headline?:string}} opts
 */
export function planSheet(page, photo, { k = 1, tabs = true, headline = 'LOST DOG' } = {}) {
  const b = blocks(k);
  const contentW = page.w - b.margin * 2;
  const tabsH = tabs ? b.tabsGap + b.tabs : 0;
  const bottom = tabs ? b.bottom : b.margin;
  const aspect = photo?.aspect && Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : null;
  const headSize = fitAnton(headline, contentW, b.headMax, 60 * k);
  const head = headSize * ANTON_CAP;
  const fixed = b.margin + head + b.gap * 2 + b.info + b.contactGap + b.contact + tabsH + bottom;
  const frameH = page.h - fixed;
  return {
    k,
    page,
    contentW,
    margin: b.margin,
    headSize,
    head,
    gap: b.gap,
    info: b.info,
    contactGap: b.contactGap,
    contact: b.contact,
    tabs: tabs ? b.tabs : 0,
    tabsGap: tabs ? b.tabsGap : 0,
    bottom,
    hasPhoto: Boolean(aspect),
    frame: { w: contentW, h: frameH },
    frameAspect: aspect ? contentW / frameH : null,
  };
}

/** Two half sheets on one Letter page: the photo is a column beside the words. */
export function planHalf(page = PAGES.LETTER, photo) {
  const halfH = page.h / 2;
  const pad = 21; // 28 px
  const aspect = photo?.aspect && photo.aspect > 0 ? photo.aspect : null;
  const photoW = 264; // 352 px
  const frameH = halfH - pad * 2 - 3; // minus the cut line
  return {
    halfH,
    pad,
    photoW,
    frame: { w: photoW, h: frameH },
    frameAspect: aspect ? photoW / frameH : null,
    detailsW: page.w - pad * 2 - photoW - pad,
    hasPhoto: Boolean(aspect),
  };
}

/**
 * The rectangle a frame of `aspect` (w/h) cuts from a photo of w by h,
 * centered on the focal point (0..1 of each side) and kept inside the
 * photo. Returns null when the photo already has that shape (within 2%).
 */
export function cropRect(w, h, focal, aspect) {
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
  const top = Math.round(clamp(fy * h - ch / 2, 0, h - ch));
  return { left: 0, top, width: w, height: ch };
}

/** The share images' photo frames (px), per size, as the boards draw them. */
export const SOCIAL_FRAMES = {
  og: { w: 560, h: 630 },
  square: { w: 1080, h: 640 },
  story: { w: 1080, h: 1010 },
};
