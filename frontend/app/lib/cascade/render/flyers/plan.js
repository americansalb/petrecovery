/**
 * The flyer's layout rules, pure, in PDF points (72 per inch; the design
 * canvas "Lost Pet Flyers, second design" is drawn at 96 px per inch, so
 * 1 px = 0.75 pt).
 *
 * One rule: every block on the sheet has a set height except the photo,
 * which takes what is left, the full width of the page. The photo is cut
 * to that frame's shape around the pet before it is drawn (render/photo.js
 * with `cropRect`), so the frame is always full and the pet is always in
 * it. There is no mat, no void and no second layout to reason about.
 *
 * `planSheet` sizes one page (Letter with tear tabs, or the poster, which
 * is the Letter sheet scaled by its width); `planHalf` sizes the half
 * sheet, where the photo is a column beside the words. Both are tested in
 * __tests__/lib/flyer-layout.test.js.
 */

export const PX = 0.75;

export const PAGES = {
  LETTER: { w: 612, h: 792 },
  TABLOID: { w: 792, h: 1224 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * The fixed heights of the Letter sheet at scale 1 (pt). The poster scales
 * them by k = 792 / 612. Tear tabs are Letter only.
 */
export function blocks(k = 1) {
  return {
    margin: 36 * k, // 48 px clear inside every edge
    head: 100 * k, // "Please help us find" + LOST DOG
    gap: 16.5 * k, // 22 px above and below the photo
    info: 106 * k, // the name, what to look for, last seen; the QR code
    contactGap: 13.5 * k,
    contact: 60 * k, // the rule, the eyebrow, the phone
    tabsGap: 13.5,
    tabs: 66,
    bottom: 0,
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
  const bottom = tabs ? b.bottom : b.margin;
  const aspect = photo?.aspect && Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : null;
  const fixed = b.margin + b.head + b.gap * 2 + b.info + b.contactGap + b.contact + tabsH + bottom;
  const frameH = page.h - fixed;
  return {
    k,
    page,
    contentW,
    margin: b.margin,
    head: b.head,
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
  square: { w: 1080, h: 612 },
  story: { w: 1080, h: 980 },
};
