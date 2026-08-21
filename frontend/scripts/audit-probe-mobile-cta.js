/**
 * Targeted probe: on a phone viewport, is the case page's sticky sighting CTA
 * occluded by the global bottom tab bar? Both are `fixed bottom-0`.
 * Also captures the scrolled state so the overlap is visible.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CASE = process.argv[2] || 'AUS-2026-0001';
const OUT = path.resolve(__dirname, '../../screenshots/audit-2026-08/state');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true,
  });
  if (process.env.HTTPS_PROXY) {
    await ctx.route(/^https:\/\//, async (route) => {
      try {
        const resp = await ctx.request.fetch(route.request(), { ignoreHTTPSErrors: true, timeout: 20000, maxRedirects: 5 });
        await route.fulfill({ response: resp });
      } catch { await route.abort().catch(() => {}); }
    });
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}/cases/${CASE}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3500);

  // Where is the primary CTA before any scroll?
  const preScroll = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a')].find((e) => /I've Seen|Ive Seen|Report a sighting/i.test(e.textContent));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { top: Math.round(r.top), viewportH: window.innerHeight, aboveFold: r.top < window.innerHeight };
  });

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/30-mobile-case-scrolled-cta.png` });

  const overlap = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
    const tab = document.querySelector('nav.fixed.bottom-0');
    // the sticky CTA is the other fixed bottom-0 container
    // Any fixed element anchored near the bottom - not just bottom:0, since the
    // sighting CTA deliberately sits one tab-bar height up.
    const fixedBottoms = [...document.querySelectorAll('div,nav')].filter((e) => {
      const cs = getComputedStyle(e);
      if (cs.position !== 'fixed') return false;
      const r = e.getBoundingClientRect();
      return r.height > 20 && r.bottom > window.innerHeight - 200;
    });
    const info = fixedBottoms.map((e) => ({
      tag: e.tagName.toLowerCase(),
      cls: (e.className || '').toString().slice(0, 70),
      z: getComputedStyle(e).zIndex,
      bg: getComputedStyle(e).backgroundColor,
      ...box(e),
      text: e.textContent.trim().slice(0, 60),
    }));
    // what is actually painted at the centre of the CTA band?
    const cta = fixedBottoms.find((e) => /I've Seen|sighting/i.test(e.textContent));
    let hitTest = null;
    if (cta) {
      const r = cta.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      hitTest = { topElement: el ? el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 50) : null,
                  ctaContainsHit: cta.contains(el) };
    }
    return { fixedBottoms: info, tabBarZ: tab ? getComputedStyle(tab).zIndex : null, hitTest };
  });

  console.log(JSON.stringify({ preScroll, overlap }, null, 2));
  await browser.close();
})();
