/**
 * Contrast sweep for the game's screens.
 *
 * Reads every text node's computed colour and composites each translucent
 * layer down to the first opaque one before measuring, because the game is
 * built from `text-white/70` on `bg-white/5` on `bg-ocean-900` and a checker
 * that stops at the first background it finds reports fine text as a
 * failure and unreadable text as fine.
 *
 *   BASE=http://127.0.0.1:3111 CHROME_PATH=/opt/pw-browsers/chromium \
 *   node scripts/geo-contrast.js
 *
 * Exit code is the number of items below WCAG AA, so it can gate a commit.
 */

const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:3111';
const ROUTES = (process.env.ROUTES || [
  '/geo',
  '/geo/rooms',
  '/geo/leaderboard',
  '/geo/me',
  '/geo/script',
  '/geo/share',
  '/geo/signin',
  '/geo/admin',
].join(',')).split(',');

const MEASURE = `(() => {
  const parse = (value) => {
    const n = String(value).match(/[\\d.]+/g);
    if (!n) return null;
    return { r: +n[0], g: +n[1], b: +n[2], a: n.length > 3 ? +n[3] : 1 };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const ratio = (a, b) => {
    const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Every painted layer from the element up to the root, composited.
  const backdrop = (el) => {
    const stack = [];
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      const bg = parse(s.backgroundColor);
      if (bg && bg.a > 0) stack.push(bg);
      if (bg && bg.a === 1) break;
    }
    stack.push({ r: 255, g: 255, b: 255, a: 1 });
    let base = stack.pop();
    while (stack.length) base = over(stack.pop(), base);
    return base;
  };

  const seen = new Set();
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;

    const fg = parse(s.color);
    if (!fg) continue;
    const bg = backdrop(el);
    // The text's own alpha sits on that backdrop too.
    const painted = fg.a < 1 ? over(fg, bg) : fg;
    const size = parseFloat(s.fontSize);
    const weight = +s.fontWeight || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const value = ratio(painted, bg);

    const key = [s.color, s.backgroundColor, size, weight, text.slice(0, 24)].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    if (value >= need) continue;
    out.push({
      text: text.slice(0, 48),
      ratio: Math.round(value * 100) / 100,
      need,
      size,
      weight,
      color: s.color,
      on: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')',
      where: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\\s+/).slice(0, 4).join('.') : ''),
    });
  }
  return out;
})()`;

/** The in-play screens are reached by playing, so the harness borrows this. */
module.exports = { MEASURE };

if (require.main === module) main();

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
  let total = 0;
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1200);
      const rows = await page.evaluate(MEASURE);
      total += rows.length;
      console.log(`\n${route}  ${rows.length ? `${rows.length} below AA` : 'clean'}`);
      for (const row of rows) {
        console.log(`   ${String(row.ratio).padStart(5)} (needs ${row.need})  ${row.size}px/${row.weight}  ${row.color} on ${row.on}`);
        console.log(`         "${row.text}"  ${row.where}`);
      }
    } catch (error) {
      console.log(`\n${route}  COULD NOT LOAD: ${error.message.slice(0, 120)}`);
      total += 1;
    }
    await page.close();
  }
  console.log(`\nTOTAL below AA: ${total}`);
  await browser.close();
  process.exit(total ? 1 : 0);
}
