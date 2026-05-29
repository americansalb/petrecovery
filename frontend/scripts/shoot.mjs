// UI Architect screenshot harness — drives installed Chrome via puppeteer-core.
// Usage:
//   node scripts/shoot.mjs                       # default route list
//   node scripts/shoot.mjs /report/new /dashboard
//   LOGIN_EMAIL=x@y.z LOGIN_PASSWORD=pw node scripts/shoot.mjs /dashboard   # authed
//
// Output: docs/analysis/screenshots/<slug>__<viewport>.png
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

// This project's next dev runs on :5757 (not the default :3000). Override with BASE_URL.
const BASE = process.env.BASE_URL || 'http://localhost:5757';
const OUT = path.resolve(process.cwd(), '../docs/analysis/screenshots');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    .find((p) => fs.existsSync(p));

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

const DEFAULT_ROUTES = [
  '/', '/login', '/register', '/report/new', '/report/found',
  '/dashboard', '/hub', '/about', '/advice', '/dev/match-card-preview',
];

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;

function slug(route) {
  return route.replace(/^\//, '').replace(/[\/?#:]+/g, '_') || 'home';
}

async function maybeLogin(browser) {
  const email = process.env.LOGIN_EMAIL;
  const password = process.env.LOGIN_PASSWORD;
  if (!email || !password) return null;
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  // Best-effort fill — selectors are tolerant to common patterns.
  const emailSel = 'input[type="email"], input[name="email"], input#email';
  const pwSel = 'input[type="password"], input[name="password"], input#password';
  await page.waitForSelector(emailSel, { timeout: 15000 });
  await page.type(emailSel, email);
  await page.type(pwSel, password);
  await page.click('button[type="submit"]');
  // signIn uses redirect:false → no navigation; poll for the session cookie instead.
  let authed = false;
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const cookies = await page.cookies();
    if (cookies.some((c) => /next-auth.session-token|authjs.*session/i.test(c.name))) { authed = true; break; }
  }
  console.log(`  [auth] ${authed ? 'session established' : 'LOGIN FAILED'} for ${email}`);
  await page.close();
  return authed;
}

(async () => {
  if (!CHROME) { console.error('No Chrome/Edge found. Set CHROME_PATH.'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  console.log('Chrome:', CHROME);
  console.log('Output:', OUT);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });

  // Grant geolocation so GPS-dependent flows (report wizard) reach their real UI
  // instead of hanging on a "Loading…" spinner. Default: San Francisco.
  const GEO = { latitude: 37.7749, longitude: -122.4194, accuracy: 50 };
  try {
    const ctx = browser.defaultBrowserContext();
    await ctx.overridePermissions(BASE, ['geolocation']);
  } catch {}

  await maybeLogin(browser);

  for (const route of routes) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.mobile, hasTouch: vp.mobile });
      try { await page.setGeolocation(GEO); } catch {}
      const url = `${BASE}${route}`;
      const file = path.join(OUT, `${slug(route)}__${vp.name}.png`);
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const settle = Number(process.env.SETTLE_MS || 1500);
        await new Promise((r) => setTimeout(r, settle)); // settle animations / async load
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ✓ ${route} [${vp.name}] HTTP ${resp ? resp.status() : '??'} → ${path.basename(file)}`);
      } catch (e) {
        console.log(`  ✗ ${route} [${vp.name}] ${e.message.split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log('Done.');
})();
