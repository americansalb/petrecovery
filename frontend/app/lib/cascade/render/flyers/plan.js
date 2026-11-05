/**
 * The flyer's layout rules, pure, in PDF points (72 per inch; the design
 * canvas "Lost Pet Flyers, second design" is drawn at 96 px per inch, so
 * 1 px = 0.75 pt).
 *
 * The flyer is a cover. The photo bleeds off the top and the sides of the
 * sheet, cut around the pet, with nothing on it: it is the evidence. Under
 * it, on the paper, one line: LOST in red and "Milo, a tabby cat" in the
 * italic, set as large as the width allows. Then the facts, the phone
 * number in the same face, and the tear tabs. Every block under the photo
 * has a set height; the photo takes what is left.
 *
 * `planSheet` sizes one page (Letter with tear tabs, or the poster, the
 * Letter sheet scaled by its width); `planHalf` sizes the half sheet,
 * where the photo is a column beside the words. `frauncesEm` measures the
 * display face so the word, the line and the number never wrap. All
 * tested in __tests__/lib/flyer-layout.test.js.
 */

export const PX = 0.75;

export const PAGES = {
  LETTER: { w: 612, h: 792 },
  TABLOID: { w: 792, h: 1224 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Fraunces 900's advance widths in ems, measured from the file with fontkit. */
const FRAUNCES_W = {
  A: 0.79, B: 0.77, C: 0.72, D: 0.83, E: 0.69, F: 0.65, G: 0.78, H: 0.9, I: 0.46, J: 0.6, K: 0.86, L: 0.67, M: 0.98,
  N: 0.77, O: 0.8, P: 0.77, Q: 0.8, R: 0.83, S: 0.65, T: 0.74, U: 0.77, V: 0.76, W: 1.12, X: 0.75, Y: 0.71, Z: 0.66,
  a: 0.6, b: 0.65, c: 0.56, d: 0.66, e: 0.56, f: 0.45, g: 0.62, h: 0.68, i: 0.35, j: 0.35, k: 0.66, l: 0.35, m: 1.01,
  n: 0.68, o: 0.62, p: 0.66, q: 0.65, r: 0.53, s: 0.53, t: 0.44, u: 0.67, v: 0.58, w: 0.89, x: 0.6, y: 0.6, z: 0.53,
  0: 0.73, 1: 0.51, 2: 0.67, 3: 0.62, 4: 0.7, 5: 0.63, 6: 0.67, 7: 0.57, 8: 0.69, 9: 0.67,
  '(': 0.4, ')': 0.4, '-': 0.4, '.': 0.33, ' ': 0.2, ',': 0.34, $: 0.63, '@': 0.99, '/': 0.51, ':': 0.33, '?': 0.61,
};

/** Fraunces Italic 600's, the same way. */
const FRAUNCES_I_W = {
  A: 0.66, B: 0.69, C: 0.66, D: 0.77, E: 0.65, F: 0.62, G: 0.72, H: 0.81, I: 0.4, J: 0.39, K: 0.74, L: 0.58, M: 0.88,
  N: 0.72, O: 0.77, P: 0.68, Q: 0.77, R: 0.71, S: 0.59, T: 0.61, U: 0.72, V: 0.66, W: 0.99, X: 0.67, Y: 0.61, Z: 0.63,
  a: 0.58, b: 0.57, c: 0.48, d: 0.59, e: 0.51, f: 0.34, g: 0.54, h: 0.6, i: 0.33, j: 0.32, k: 0.58, l: 0.33, m: 0.89,
  n: 0.61, o: 0.55, p: 0.57, q: 0.56, r: 0.5, s: 0.46, t: 0.39, u: 0.61, v: 0.52, w: 0.79, x: 0.61, y: 0.54, z: 0.53,
  0: 0.67, 1: 0.45, 2: 0.61, 3: 0.56, 4: 0.59, 5: 0.57, 6: 0.61, 7: 0.54, 8: 0.59, 9: 0.61,
  '(': 0.37, ')': 0.37, '-': 0.38, '.': 0.26, ' ': 0.2, ',': 0.27, $: 0.59, '@': 0.92, '/': 0.46, ':': 0.32, '?': 0.52,
};

const emOf = (table, text) => {
  let em = 0;
  for (const ch of String(text || '')) em += table[ch] ?? 0.65;
  return em * 1.03;
};

/** The width of `text` set in Fraunces 900, in ems, padded 3% so a fitted line never wraps. */
export const frauncesEm = (text) => emOf(FRAUNCES_W, text);
/** The same for the italic. */
export const frauncesItalicEm = (text) => emOf(FRAUNCES_I_W, text);

/** The largest Fraunces size, up to `base`, at which `text` fits in `maxW`. */
export function fitFraunces(text, maxW, base, min) {
  return Math.max(min, Math.min(base, maxW / (frauncesEm(text) || 1)));
}

/**
 * Fraunces in react-pdf: the baseline sits at the font's ascent (0.978 em)
 * from the top of a line box, so caps run from 0.278 em to 0.978 em and a
 * tight line is drawn with those margins (Flyer.jsx, TightLine). The block
 * it takes on the sheet is the cap height. satori sets the same face at
 * LINE of its size.
 */
export const FRAUNCES = { cap: 0.7, top: 0.278, line: 0.95 };

/** Where the pet's face sits in a frame: just above the middle. */
export const FOCAL_AT = 0.45;

/**
 * The word line under the photo: LOST at `wordMax`, and the cover line
 * ("Milo, a tabby cat") in the italic beside it at `lineMax`, shrinking
 * down to `lineMin`; past that the line goes under the word instead.
 */
export function planWord({ stamp, coverLine, width, wordMax, lineMax, lineMin, gap }) {
  const wordSize = fitFraunces(stamp, width * 0.72, wordMax, wordMax * 0.5);
  const wordW = frauncesEm(stamp) * wordSize;
  const room = width - wordW - gap;
  const lineSize = Math.min(lineMax, room / (frauncesItalicEm(coverLine) || 1));
  if (lineSize >= lineMin) return { wordSize, lineSize, stacked: false };
  // Under the word, the line no longer shares the width: the word takes it all.
  return { wordSize: fitFraunces(stamp, width, wordMax, wordMax * 0.5), lineSize: lineMax, stacked: true };
}

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only.
 */
export function blocks(k = 1) {
  return {
    side: 30 * k, // 40 px of paper at the sides of the panel
    panelTop: 19.5 * k, // 26 px between the photo and the word
    wordMax: 124 * k, // LOST at its largest (165 px)
    lineMax: 24 * k, // "Milo, a tabby cat" at its largest (32 px)
    lineMin: 15 * k, // below this it goes under the word
    wordGap: 12 * k,
    gapA: 12 * k,
    lastSeen: 15 * k,
    gapB: 4.5 * k,
    facts: 36 * k, // two lines
    gapC: 13.5 * k,
    contact: 72 * k, // the rule, the eyebrow, the phone; the QR code at the right
    tabsGap: 12,
    tabs: 54,
    bottom: 9,
  };
}

/**
 * @param {{w:number,h:number}} page
 * @param {{aspect:number}|null} photo width over height, or null for no photo
 * @param {{k?:number, tabs?:boolean, stamp?:string, coverLine?:string}} opts
 */
export function planSheet(page, photo, { k = 1, tabs = true, stamp = 'LOST', coverLine = '' } = {}) {
  const b = blocks(k);
  const contentW = page.w - b.side * 2;
  const tabsH = tabs ? b.tabsGap + b.tabs : 0;
  const bottom = tabs ? b.bottom : b.side;
  const aspect = photo?.aspect && Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : null;
  const word = planWord({ stamp, coverLine, width: contentW, wordMax: b.wordMax, lineMax: b.lineMax, lineMin: b.lineMin, gap: b.wordGap });
  const wordH = word.wordSize * FRAUNCES.cap + (word.stacked ? b.gapB + word.lineSize * 1.1 : 0);
  const fixed = b.panelTop + wordH + b.gapA + b.lastSeen + b.gapB + b.facts + b.gapC + b.contact + tabsH + bottom;
  const frameH = page.h - fixed;
  return {
    k,
    page,
    contentW,
    side: b.side,
    panelTop: b.panelTop,
    word,
    wordH,
    gapA: b.gapA,
    lastSeen: b.lastSeen,
    gapB: b.gapB,
    facts: b.facts,
    gapC: b.gapC,
    contact: b.contact,
    tabs: tabs ? b.tabs : 0,
    tabsGap: tabs ? b.tabsGap : 0,
    bottom,
    hasPhoto: Boolean(aspect),
    focalAt: FOCAL_AT,
    frame: { w: page.w, h: frameH },
    frameAspect: aspect ? page.w / frameH : null,
  };
}

/** Two half sheets on one Letter page: the photo is a column beside the words. */
export function planHalf(page = PAGES.LETTER, photo, { stamp = 'LOST', coverLine = '' } = {}) {
  const halfH = page.h / 2;
  const pad = 15; // 20 px
  const aspect = photo?.aspect && photo.aspect > 0 ? photo.aspect : null;
  const photoW = 300; // 400 px
  const frameH = halfH - pad * 2 - 3; // minus the cut line
  const detailsW = page.w - pad * 3 - photoW;
  return {
    halfH,
    pad,
    photoW,
    frame: { w: photoW, h: frameH },
    frameAspect: aspect ? photoW / frameH : null,
    detailsW,
    word: planWord({ stamp, coverLine, width: detailsW, wordMax: 76, lineMax: 20, lineMin: 12, gap: 9 }),
    hasPhoto: Boolean(aspect),
    focalAt: FOCAL_AT,
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

/** The share images' photo frames (px): the photo bleeds, the words sit on paper beside or below it. */
export const SOCIAL_FRAMES = {
  og: { w: 690, h: 630, focalAt: FOCAL_AT },
  square: { w: 1080, h: 640, focalAt: FOCAL_AT },
  story: { w: 1080, h: 1150, focalAt: FOCAL_AT },
};
