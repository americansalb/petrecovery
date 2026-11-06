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

/**
 * The lines `text` takes set in Inter at `size` across `width`: a greedy
 * word wrap on interEm's padded widths, so never fewer than the real
 * count. The sheet is planned on this, so no box is too small for its
 * words and no box is left mostly empty.
 */
export function interLines(text, size, width) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || !(width > 0) || !(size > 0)) return 0;
  const space = 0.27 * 1.06 * size;
  let lines = 1;
  let line = 0;
  for (const w of words) {
    const ww = interEm(w) * size;
    if (line > 0 && line + space + ww > width) {
      lines += 1;
      line = ww;
    } else line += (line > 0 ? space : 0) + ww;
  }
  return lines;
}

/** What to look for with the facts after it: the column's body, built the same way everywhere. */
export function lookForLine(data) {
  const facts = data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : '';
  return `${data.lookFor || ''}${facts}`.trim() || data.description || '';
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
 * The facts column's type at scale 1 (pt): the eyebrow, the date, the
 * address, the body (what to look for) and the "comes to" line as a share
 * of the body; the gaps; and the tile's bounds. The tile is the last-seen
 * map or, without one, the QR card for the map and updates at the link.
 */
export const COLUMN = {
  eyebrow: 8.25,
  date: 14,
  address: 10.5,
  body: 10.75,
  bodyMax: 12.5, // the body grows this far while the tile keeps its share
  bodyMaxNoMap: 14.5, // and this far when the tile is the QR card
  comes: 0.93,
  lineHeight: 1.35,
  gap: 8,
  tileMin: 90, // the tile is never shorter: the body loses lines first
  tileShare: 0.45, // the tile keeps at least this much of the column while the body grows
  mapMaxOfW: 1.6, // the map never grows taller than this times the column's width
  qrMaxOfW: 1.2, // nor the QR card than this
};

/** "If you see Max" on its card at scale 1 (pt): the eyebrow, the body, the card's padding and edge, and how many lines each text may take. */
export const ADVICE = { eyebrow: 8.25, body: 10.5, padX: 10, padY: 6, edge: 2, healthMax: 2, linesMax: 5 };

/**
 * "If you see Max" on its card, `w` wide, at `size` (already scaled): the
 * height its words take and the lines each text gets. `linesMax` caps the
 * instruction where the room is short (the half sheet).
 */
export function planAdvice({ w, k = 1, words, size, linesMax = ADVICE.linesMax }) {
  const a = ADVICE;
  const s = size ?? a.body * k;
  const innerW = w - 2 * (a.padX + a.edge) * k;
  const healthLines = words.health ? Math.min(a.healthMax, interLines(words.health, s, innerW)) : 0;
  const lines = Math.max(1, Math.min(linesMax, interLines(words.ifYouSee, s, innerW)));
  const h = 2 * (a.padY + a.edge) * k + a.eyebrow * k * 1.3 + (healthLines ? healthLines * s * 1.3 + 2 * k : 0) + lines * s * 1.3 + 2 * k;
  return { size: s, h: Math.ceil(h), healthLines, lines };
}

/**
 * The facts column beside the print, `w` wide, to fill `h`: where and
 * when; the tile (the last-seen map, or without one the QR card for the
 * map and updates at the link); what to look for; what the pet comes to.
 * The words are measured (interLines). The body grows a little while the
 * tile keeps its share, then the tile takes what the words leave, never
 * less than tileMin (the body loses lines first) nor taller than its cap.
 * `short` is what the column still cannot fill; the renderers spread it
 * between the blocks, so it never pools at the foot.
 */
export function planColumn({ w, h, k = 1, words, hasMap }) {
  const c = COLUMN;
  const eyebrow = c.eyebrow * k * 1.3;
  const date = words.lastSeenWhen ? c.date * k * 1.2 + 2 * k : 0;
  const addressLines = Math.min(2, interLines(words.lastSeenArea, c.address * k, w));
  const address = addressLines * c.address * k * 1.3;
  const gap = c.gap * k;
  const body = lookForLine(words);
  const linesAt = (size) => interLines(body, size, w);
  const comesAt = (size) => (words.comesTo ? Math.min(2, interLines(words.comesTo, size * c.comes, w)) : 0);
  const comesH = (size) => (comesAt(size) ? comesAt(size) * size * c.comes * 1.3 + 4 * k : 0);
  const textH = (size, lines) => eyebrow + date + address + gap + gap + lines * size * c.lineHeight + comesH(size);
  const tileMax = (hasMap ? c.mapMaxOfW : c.qrMaxOfW) * w;
  const bodyMax = (hasMap ? c.bodyMax : c.bodyMaxNoMap) * k;
  const tileAt = (size) => h - textH(size, linesAt(size));
  const step = 0.25 * k;
  let size = c.body * k;
  while (size + step <= bodyMax + 1e-6 && tileAt(size + step) >= c.tileShare * h) size += step;
  let lines = linesAt(size);
  let tile = tileAt(size);
  if (tile < c.tileMin * k) {
    tile = c.tileMin * k;
    lines = Math.max(2, Math.floor((h - tile - textH(size, 0)) / (size * c.lineHeight)));
  }
  tile = Math.floor(Math.min(tile, tileMax));
  const used = textH(size, lines) + tile;
  return { size, bodyLines: lines, comesLines: comesAt(size), addressLines, tileH: tile, mapH: tile, gap, used: Math.min(h, used), short: Math.max(0, h - used) };
}

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only. The photo row, the
 * print beside the facts, takes what is left; the slack after that goes
 * to the card's type, the contact panel and the gaps, never to one void.
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
    wordGrow: 1.15, // the band grows this much when there is room
    rowToAdvice: 10 * k,
    adviceSize: 10.5 * k, // "If you see Max" on its note card, the full width, as tall as its words
    adviceMax: 13.5 * k, // its type grows this far when there is room
    contactGap: 9 * k,
    contact: 84 * k, // the navy panel: the phone and the email, the QR code and the short link
    contactMax: 1.35, // it grows this much when there is room
    gapMax: 22 * k, // each gap grows this far before the margins take the rest
    tabsGap: 10,
    tabs: 48,
    bottom: 10.5,
  };
}

/**
 * @param {{w:number,h:number}} page
 * @param {{aspect:number}|null} photo width over height, or null for no photo
 * @param {{k?:number, tabs?:boolean, stamp?:string, words?:object}} opts `words` is the flyer data (normalize.js): what the boxes must hold
 */
export function planSheet(page, photo, { k = 1, tabs = true, stamp = 'LOST', words = {} } = {}) {
  const b = blocks(k);
  const contentW = page.w - b.side * 2;
  const tabsH = tabs ? b.tabsGap + b.tabs : 0;
  const bottom0 = tabs ? b.bottom : b.side;
  const aspect = photo?.aspect && Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : null;
  const hasMap = Boolean(words.map);
  const headAt = (max) => {
    const wordSize = fitUnbounded(stamp, contentW * b.wordShare, max, 40 * k);
    const band = bandBox(wordSize, stamp);
    return { wordSize, band, head: band.h + band.off, nameW: contentW - band.w - band.off - b.headGap };
  };
  const adviceAt = (size) => planAdvice({ w: contentW, k, words, size });
  const head0 = headAt(b.wordMax);
  const advice0 = adviceAt(b.adviceSize);
  const fixed = b.top + head0.head + b.headToRow + b.rowToAdvice + advice0.h + b.contactGap + b.contact + tabsH + bottom0;
  const room = page.h - fixed;
  // The row: as tall as the sheet allows, but the print is never a narrow strip. The column fills it (planColumn).
  const row = Math.floor(Math.min(room, b.printMax / b.printAspectMin));
  const printW = aspect ? clamp(Math.round(row * aspect), b.printMin, b.printMax) : Math.round(300 * k);
  const off = Math.round(printW * PRINT.shadow);
  const colW = contentW - printW - off - b.colGap;
  const col = planColumn({ w: colW, h: row, k, words, hasMap });
  // The slack (the poster's, mostly): the band grows, then the card's type, then the contact panel, then the gaps, then the margins.
  let slack = room - row;
  let head = head0;
  for (let max = b.wordMax + k; max <= b.wordMax * b.wordGrow + 1e-6; max += k) {
    const h = headAt(max);
    if (h.head - head0.head > slack * 0.25) break;
    head = h;
  }
  slack -= head.head - head0.head;
  let advice = advice0;
  for (let size = b.adviceSize + 0.25 * k; size <= b.adviceMax + 1e-6; size += 0.25 * k) {
    const a = adviceAt(size);
    if (a.h - advice0.h > slack * 0.5) break;
    advice = a;
  }
  slack -= advice.h - advice0.h;
  const contactScale = Math.min(b.contactMax, 1 + (slack * 0.5) / b.contact);
  const contactH = Math.round(b.contact * contactScale);
  slack -= contactH - b.contact;
  const gapExtra = Math.max(0, Math.min(b.gapMax, slack / 3));
  slack = Math.max(0, slack - gapExtra * 3);
  const inner = printInner(printW, row, k);
  return {
    k,
    page,
    contentW,
    side: b.side,
    stripe: b.band,
    foot: !tabs,
    top: b.top + slack / 2,
    wordSize: head.wordSize,
    band: head.band,
    head: head.head,
    headGap: b.headGap,
    nameW: head.nameW,
    headToRow: b.headToRow + gapExtra,
    row,
    photo: { w: printW, h: row },
    colGap: b.colGap,
    colW,
    col,
    mapH: col.tileH,
    rowToAdvice: b.rowToAdvice + gapExtra,
    advice,
    contactGap: b.contactGap + gapExtra,
    contact: { h: contactH, scale: contactScale },
    tabs: tabs ? b.tabs : 0,
    tabsGap: tabs ? b.tabsGap : 0,
    bottom: bottom0 + slack / 2,
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
 * The share images (px). The square and the story are the sheet's plan
 * at their own sizes (`planCard`): the head, the print beside the facts,
 * the card, the contact panel, with the slack spread the same way. The
 * link preview (`planOg`) keeps the print at the left, the full height,
 * and plans its column. The print's width comes from the photo's shape
 * within bounds; its centre is where the ground's light and rays come
 * from (ground.js); `band` is the caution stripes' height.
 */
export const CARDS = {
  square: { W: 1080, H: 1080, side: 40, top: 44, bottom: 38, band: 84, nameMax: 36, tag: 13, headGap: 20, headToRow: 14, colGap: 20, printMin: 440, printMax: 620, body: 17, advice: 18, adviceMax: 23, contact: 1.42, contactMax: 1.8, rowToAdvice: 12, contactGap: 12, gapMax: 40, stripe: 18 },
  story: { W: 1080, H: 1920, side: 56, top: 140, bottom: 130, band: 130, nameMax: 44, tag: 18, headGap: 26, headToRow: 40, colGap: 24, printMin: 480, printMax: 600, body: 22, advice: 25, adviceMax: 32, contact: 968 / 516, contactMax: 2.4, rowToAdvice: 40, contactGap: 40, gapMax: 80, stripe: 22 },
};
export const OG = { W: 1200, H: 630, x: 56, y: 58, h: 514, printMin: 386, printMax: 560, colGap: 36, right: 50, top: 50, bottom: 44, band: 92, nameMax: 30, tag: 12, headGap: 16, where: 15.5, advice: 15.5, adviceMax: 18.5, mapW: 240, mapMin: 110, mapMax: 230, stripe: 16 };

export function planCard(size, aspect, words = {}) {
  const c = CARDS[size] || CARDS.square;
  const W = c.W - 2 * c.side;
  const a = aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : null;
  const stamp = words.stamp || 'LOST';
  const hasMap = Boolean(words.map);
  const ka = c.advice / ADVICE.body;
  const kc = c.body / COLUMN.body;
  const headAt = (bandSize) => {
    const band = bandBox(bandSize, stamp);
    return { bandSize, band, head: band.h + band.off };
  };
  const adviceAt = (s) => planAdvice({ w: W, k: ka, words, size: s });
  const head0 = headAt(c.band);
  const advice0 = adviceAt(c.advice);
  const contact0 = Math.round(84 * c.contact);
  const fixed = c.top + head0.head + c.headToRow + c.rowToAdvice + advice0.h + c.contactGap + contact0 + c.bottom;
  const room = c.H - fixed;
  const row = Math.floor(Math.min(room, c.printMax / 0.62));
  const w = a ? clamp(Math.round(row * a), c.printMin, c.printMax) : Math.round((c.printMin + c.printMax) / 2);
  const off = Math.round(w * PRINT.shadow);
  const colW = W - w - off - c.colGap;
  const col = planColumn({ w: colW, h: row, k: kc, words, hasMap });
  let slack = room - row;
  let head = head0;
  for (let b = c.band + 2; b <= c.band * 1.15 + 1e-6; b += 2) {
    const h = headAt(b);
    if (h.head - head0.head > slack * 0.25) break;
    head = h;
  }
  slack -= head.head - head0.head;
  let advice = advice0;
  for (let s = c.advice + 0.5; s <= c.adviceMax + 1e-6; s += 0.5) {
    const x = adviceAt(s);
    if (x.h - advice0.h > slack * 0.5) break;
    advice = x;
  }
  slack -= advice.h - advice0.h;
  const contactK = Math.min(c.contactMax, c.contact * (1 + (slack * 0.5) / contact0));
  const contactH = Math.round(84 * contactK);
  slack -= contactH - contact0;
  const gapExtra = Math.max(0, Math.min(c.gapMax, slack / 3));
  slack = Math.max(0, slack - gapExtra * 3);
  const top = c.top + slack / 2;
  const headToRow = c.headToRow + gapExtra;
  return {
    size,
    W,
    H: c.H,
    side: c.side,
    top,
    bandSize: head.bandSize,
    band: head.band,
    head: head.head,
    headGap: c.headGap,
    nameMax: c.nameMax,
    tag: c.tag,
    headToRow,
    frame: { x: c.side, y: top + head.head + headToRow, w, h: row, off, focalAt: 0.42, band: c.stripe },
    colGap: c.colGap,
    colW,
    col,
    kc,
    ka,
    rowToAdvice: c.rowToAdvice + gapExtra,
    advice,
    contactGap: c.contactGap + gapExtra,
    contact: { h: contactH, k: contactK },
    bottom: c.bottom + slack / 2,
    stripe: c.stripe,
  };
}

/** The link preview: the print at the left, the full height; at the right the head, the map beside where and when, the card, and the phone pill at the foot. */
export function planOg(aspect, words = {}) {
  const o = OG;
  const a = aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : null;
  const w = a ? clamp(Math.round(o.h * a), o.printMin, o.printMax) : Math.round((o.printMin + o.printMax) / 2);
  const off = Math.round(w * PRINT.shadow);
  const colX = o.x + w + off + o.colGap;
  const W = o.W - colX - o.right;
  const stamp = words.stamp || 'LOST';
  const bandSize = fitUnbounded(stamp, W * 0.62, o.band, 56);
  const band = bandBox(bandSize, stamp);
  const head = band.h + band.off;
  const hasMap = Boolean(words.map);
  const pill = Math.round(40 * 0.42) * 2 + 12 * 1.3 + 6 + 40; // the phone pill: its paddings, the eyebrow, the number
  const available = o.H - o.bottom - pill - 14 - o.top;
  const ka = o.advice / ADVICE.body;
  const adviceAt = (s) => planAdvice({ w: W, k: ka, words, size: s });
  let advice = adviceAt(o.advice);
  const gaps = 12 + 10;
  const factsAt = (adv) => available - head - gaps - adv.h;
  // The card's type grows while the facts row keeps a fair height; the row takes what is left, within its bounds.
  for (let s = o.advice + 0.5; s <= o.adviceMax + 1e-6; s += 0.5) {
    const x = adviceAt(s);
    if (factsAt(x) < 150) break;
    advice = x;
  }
  const facts = clamp(factsAt(advice), o.mapMin, o.mapMax);
  const extra = Math.max(0, factsAt(advice) - facts);
  const whereW = hasMap ? W - o.mapW - 14 : W;
  const ws = o.where;
  const whereFixed = ws * 0.72 * 1.3 + (words.lastSeenWhen ? ws * 1.15 * 1.2 + 2 : 0) + Math.min(2, interLines(words.lastSeenArea, ws * 0.92, whereW)) * ws * 0.92 * 1.3 + ws * 0.4;
  const whereLines = Math.max(2, Math.min(6, Math.floor((facts - whereFixed) / (ws * 0.95 * 1.35))));
  return {
    size: 'og',
    frame: { x: o.x, y: o.y, w, h: o.h, off, focalAt: 0.42, band: o.stripe },
    colX,
    W,
    top: o.top,
    bandSize,
    band,
    head,
    nameMax: o.nameMax,
    tag: o.tag,
    headGap: o.headGap,
    headToFacts: 12 + extra / 2,
    facts,
    mapW: o.mapW,
    whereW,
    where: ws,
    whereLines,
    factsToAdvice: 10 + extra / 2,
    advice,
    ka,
    pill,
    bottom: o.bottom,
    stripe: o.stripe,
  };
}

/** The plan of one share image: the link preview's, or the square's or the story's. */
export function planSocial(size, aspect, words = {}) {
  return size === 'og' ? planOg(aspect, words) : planCard(size, aspect, words);
}
