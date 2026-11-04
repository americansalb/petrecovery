/**
 * The flyer's layout rules, pure, in PDF points (72 per inch; the design
 * canvas "Lost Pet Flyers" is drawn at 96 px per inch, so 1 px = 0.75 pt).
 *
 * Rule 1: every block on the sheet has a set height except the photo. The
 * photo takes what is left, so there is never a void under a short photo
 * and never a mat around a wide one.
 *
 * Rule 2: the frame follows the photo's shape. A wide photo (width over
 * height of 1.2 or more) gets the full-width frame; a tall or square photo
 * gets a column beside the facts, as wide as the body is tall times the
 * photo's own ratio, kept between 300 and 460 px, and the map moves into
 * the facts column where it takes the slack. Inside
 * the frame the photo covers it, cropped around the pet (the focal point
 * sharp's attention crop finds), never the center by default.
 *
 * `planSheet` decides all of that for one page; `cropRect` is the crop a
 * frame needs from the photo. Both are tested in __tests__/lib/flyer-layout.test.js.
 */

export const PX = 0.75;

export const PAGES = {
  LETTER: { w: 612, h: 792 },
  TABLOID: { w: 792, h: 1224 },
};

/** A photo is "wide" from this ratio up; below it the column layout. */
export const WIDE_FROM = 1.2;

export const COLUMN_MIN = 225; // pt: the photo column of the tall layout, 300 px
export const COLUMN_MAX = 345; // 460 px

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only.
 */
export function blocks(k = 1) {
  return {
    margin: 27 * k, // 36 px: clear inside every edge
    band: 105 * k, // LOST DOG on navy
    gap: 9 * k,
    topGap: 10.5 * k,
    name: 52 * k, // HAVE YOU SEEN + the name + the facts line
    facts: 68 * k, // LOOK FOR + IF YOU SEE cells, three lines each
    row: 112.5 * k, // last seen + map, phone, QR
    footer: 14 * k,
    tabsGap: 7.5,
    tabs: 69,
    bottom: 18 * k,
  };
}

/**
 * @param {{w:number,h:number}} page
 * @param {{aspect:number}|null} photo width over height, or null for no photo
 * @param {{k?:number, tabs?:boolean}} opts
 */
export function planSheet(page, photo, { k = 1, tabs = true } = {}) {
  const b = blocks(k);
  const contentW = page.w - b.margin * 2;
  const tabsH = tabs ? b.tabsGap + b.tabs : 0;
  const aspect = photo?.aspect && Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : null;
  const mode = !aspect ? 'none' : aspect >= WIDE_FROM ? 'wide' : 'column';

  if (mode !== 'column') {
    // Wide (or no photo): a full-width frame takes what the fixed blocks leave.
    const fixed = b.band + b.topGap + b.name + b.facts + b.row + b.footer + b.gap * 4 + tabsH + b.bottom;
    const remainder = page.h - fixed;
    let frameH = remainder;
    let rowH = b.row;
    let gap = b.gap;
    if (aspect) {
      // Never taller than the photo's own shape: the slack goes to the map
      // row (a bigger map is worth having) and then to the gaps, evenly.
      const natural = contentW / aspect;
      if (natural < remainder) {
        frameH = Math.max(natural, remainder * 0.6);
        let slack = remainder - frameH;
        const toRow = Math.min(slack, 60 * k);
        rowH += toRow;
        slack -= toRow;
        gap += slack / 4;
      }
    }
    return {
      mode,
      k,
      page,
      contentW,
      margin: b.margin,
      band: b.band,
      topGap: b.topGap,
      gap,
      name: b.name,
      facts: b.facts,
      row: rowH,
      footer: b.footer,
      tabs: tabs ? b.tabs : 0,
      tabsGap: tabs ? b.tabsGap : 0,
      bottom: b.bottom,
      frame: { w: contentW, h: frameH },
      frameAspect: aspect ? contentW / frameH : null,
    };
  }

  // Column: the photo stands beside the facts at the body's full height; the
  // map sits in the facts column and takes whatever those leave.
  const bodyH = page.h - b.band - b.topGap - b.gap - b.footer - tabsH - b.bottom;
  const colW = clamp(bodyH * aspect, COLUMN_MIN * k, COLUMN_MAX * k);
  // The facts column: name block, two cells, the phone, the QR row, five
  // gaps and the map's heading are set; the map takes the rest.
  const mapH = Math.max(80 * k, bodyH - (80 + 82 + 82 + 84 + 60 + 7.5 * 5 + 26) * k);
  return {
    mode,
    k,
    page,
    contentW,
    margin: b.margin,
    band: b.band,
    topGap: b.topGap,
    gap: b.gap,
    footer: b.footer,
    tabs: tabs ? b.tabs : 0,
    tabsGap: tabs ? b.tabsGap : 0,
    bottom: b.bottom,
    bodyH,
    colW,
    mapH,
    frame: { w: colW, h: bodyH },
    frameAspect: colW / bodyH,
    detailsW: contentW - colW - 12 * k,
  };
}

/** Two half sheets on one Letter page: each half is its own small plan. */
export function planHalf(page = PAGES.LETTER, photo) {
  const halfH = page.h / 2;
  const pad = 21; // 28 px
  const aspect = photo?.aspect && photo.aspect > 0 ? photo.aspect : null;
  const photoW = aspect && aspect >= WIDE_FROM ? 300 : 225; // a wide photo gets a wider column
  const colH = halfH - pad * 2 - 4; // minus the cut line
  const qrH = 63; // 84 px
  const frameH = colH - qrH - 7.5;
  return {
    halfH,
    pad,
    photoW,
    frame: { w: photoW, h: frameH },
    frameAspect: aspect ? photoW / frameH : null,
    detailsW: page.w - pad * 2 - photoW - 12,
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

/** The share images' photo frames (px), per size. */
export const SOCIAL_FRAMES = {
  square: { w: 596, h: 680 },
  story: { w: 968, h: 906 },
  og: { w: 560, h: 630 },
};
