/**
 * Gallery sweep — full-page screenshots of every route into ../../screenshots/.
 *
 * Usage:
 *   1. cd frontend && npx prisma db push && node prisma/seed-sample-data.js > /tmp/seed-ids.json
 *      (strip the progress lines so the file is just the final JSON object)
 *   2. npm run dev   (default :3000; override with BASE_URL)
 *   3. node scripts/gallery-sweep.js /tmp/seed-ids.json
 *
 * Needs `playwright` (npm i -D playwright) and a Chromium binary — set
 * CHROME_PATH if the bundled download is unavailable. Login uses the
 * seeded local admin from seed-sample-data.js.
 *
 * If HTTPS_PROXY is set (sandboxed environments), external requests are
 * re-issued through Playwright's Node-side fetch: headless Chromium's TLS
 * handshakes can be reset by egress proxies that curl/Node pass through,
 * which would strip the CDN logo, Leaflet CSS, and map tiles from shots.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../../screenshots');
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'admin@localdev.test';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'LocalDevScreenshots1!';

const idsFile = process.argv[2];
if (!idsFile) {
  console.error('Usage: node scripts/gallery-sweep.js <seed-ids.json>');
  process.exit(1);
}
const raw = fs.readFileSync(idsFile, 'utf8');
// Tolerate seed progress lines before the JSON object
const ID = JSON.parse(raw.slice(raw.indexOf('{')));

// Routes with heavy client rendering (Leaflet maps, charts) get extra settle time
const SLOW = [/mission-control/, /lost-and-found/, /report\/new/, /^\/cases\//, /lost-pet/, /coordinate/, /command-center/, /simulate/, /simulator/, /sightings/, /patrol\/join/, /^\/$/, /admin\/analytics/];

const PUB = [
  ['pub-01-home', '/'],
  ['pub-02-lost-and-found', '/lost-and-found'],
  ['pub-03-about', '/about'],
  ['pub-04-about-sarama', '/about-sarama'],
  ['pub-05-advice', '/advice'],
  ['pub-06-contact', '/contact'],
  ['pub-07-found', '/found'],
  ['pub-08-shelters', '/shelters'],
  ['pub-09-login', '/login'],
  ['pub-10-register', '/register'],
  ['pub-11-forgot-password', '/forgot-password'],
  ['pub-12-reset-password', '/reset-password'],
  ['pub-13-verify-email', '/verify-email'],
  ['pub-14-legal-terms', '/legal/terms'],
  ['pub-15-legal-consent', '/legal/consent'],
  ['pub-16-privacy', '/privacy'],
  ['pub-17-offline', '/offline'],
  ['pub-18-case-portal', `/cases/${ID.maxCaseNumber}`],
  ['pub-19-lost-pet-location', '/lost-pet/austin-tx'],
  ['pub-20-pet-public-view', `/pets/view/${ID.petMaxToken}`],
  ['pub-21-hub', '/hub'],
  ['pub-22-hub-search', '/hub/search?q=lost'],
  ['pub-23-hub-category', '/hub/c/lost-pet-help'],
  ['pub-24-hub-thread', `/hub/thread/${ID.threadSlug}`],
  ['pub-25-hub-user', `/hub/u/${ID.adminId}`],
  ['pub-26-report-public-mission', `/reports/${ID.maxCaseId}`],
  ['pub-27-alert-detail', `/alerts/${ID.maxCaseId}`],
  ['pub-28-join-mission', `/join/${ID.maxCaseId}`],
  ['pub-29-mission-detail', `/missions/${ID.maxCaseNumber}`],
  ['pub-30-rescue-forces', '/rescue-forces'],
  ['pub-31-rescue-forces-search', '/rescue-forces/search'],
  ['pub-32-rescue-force-detail', `/rescue-forces/${ID.forceId}`],
  ['pub-33-communities-legacy', `/communities/${ID.forceId}`],
  ['pub-34-care', '/care'],
];

const AUTH = [
  ['auth-33-dashboard', '/dashboard'],
  ['auth-34-pets', '/pets'],
  ['auth-35-pets-new', '/pets/new'],
  ['auth-36-pet-detail', `/pets/${ID.petMaxId}`],
  ['auth-37-pet-care', `/pets/${ID.petMaxId}/care`],
  ['auth-38-pet-edit', `/pets/${ID.petMaxId}/edit`],
  ['auth-39-pet-medications', `/pets/${ID.petMaxId}/medications`],
  ['auth-40-pet-medications-new', `/pets/${ID.petMaxId}/medications/new`],
  ['auth-41-pet-share', `/pets/${ID.petMaxId}/share`],
  ['auth-42-profile', '/profile'],
  ['auth-43-settings', '/settings'],
  ['auth-44-settings-accounts', '/settings/accounts'],
  ['auth-45-settings-integrations', '/settings/integrations'],
  ['auth-46-settings-notifications', '/settings/notifications'],
  ['auth-47-notifications', '/notifications'],
  ['auth-48-messages', '/messages'],
  ['auth-49-message-conversation', `/messages/${ID.conversationId}`],
  ['auth-50-alerts', '/alerts'],
  ['auth-51-my-alerts', '/my-alerts'],
  ['auth-52-report-new', '/report/new'],
  ['auth-53-report-found', '/report/found'],
  ['auth-54-sightings-report', `/sightings/report?alertId=${ID.maxCaseId}`],
  ['auth-55-missions-report', '/missions/report'],
  ['auth-56-mission-coordinate', `/missions/${ID.maxCaseNumber}/coordinate`],
  ['auth-57-mission-control', `/mission-control?mission=${ID.maxCaseNumber}`],
  ['auth-58-hub-new', '/hub/new'],
  ['auth-59-rescue-forces-create', '/rescue-forces/create'],
  ['auth-60-rf-command-center', `/rescue-forces/${ID.forceId}/command-center`],
  ['auth-61-rf-divisions', `/rescue-forces/${ID.forceId}/divisions`],
  ['auth-62-rf-division-detail', `/rescue-forces/${ID.forceId}/divisions/${ID.northDivisionId}`],
  ['auth-63-rf-mission-control', `/rescue-forces/${ID.forceId}/mission-control`],
  ['auth-64-rf-settings', `/rescue-forces/${ID.forceId}/settings`],
  ['auth-65-communities-my-requests', '/communities/my-requests'],
  ['auth-66-communities-request', '/communities/request'],
  ['auth-67-divisions-request', '/divisions/request'],
  ['auth-68-patrol-database', '/patrol/database'],
  ['auth-69-patrol-join', '/patrol/join'],
  ['auth-70-shelter-dashboard', '/shelter/dashboard'],
  ['auth-71-shelter-request', '/shelter/request'],
  ['auth-72-simulate', '/simulate'],
  ['auth-73-simulator', '/simulator'],
  ['auth-74-admin', '/admin'],
  ['auth-75-admin-analytics', '/admin/analytics'],
  ['auth-76-admin-auto-migrate', '/admin/auto-migrate'],
  ['auth-77-admin-check-config', '/admin/check-config'],
  ['auth-78-admin-communities', '/admin/communities'],
  ['auth-79-admin-communities-create', '/admin/communities/create'],
  ['auth-80-admin-divisions', '/admin/divisions'],
  ['auth-81-admin-divisions-create', '/admin/divisions/create'],
  ['auth-82-admin-divisions-requests', '/admin/divisions/requests'],
  ['auth-83-admin-health', '/admin/health'],
  ['auth-84-admin-missions', '/admin/missions'],
  ['auth-85-admin-missions-new', '/admin/missions/new'],
  ['auth-86-admin-mission-detail', `/admin/missions/${ID.maxCaseId}`],
  ['auth-87-admin-pets', '/admin/pets'],
  ['auth-88-admin-prisma', '/admin/prisma'],
  ['auth-89-admin-qa', '/admin/qa'],
  ['auth-90-admin-rescue-forces', '/admin/rescue-forces'],
  ['auth-91-admin-rescue-forces-create', '/admin/rescue-forces/create'],
  ['auth-92-admin-shelters', '/admin/shelters'],
  ['auth-93-admin-shelters-requests', '/admin/shelters/requests'],
  ['auth-94-admin-users', '/admin/users'],
  ['auth-95-admin-wipe-squads', '/admin/wipe-squads'],
  ['auth-96-legal-consent', '/legal/consent'],
  ['auth-97-care', '/care'],
  ['auth-98-pet-health', `/pets/${ID.petMaxId}/health`],
  ['auth-99-pet-today', `/pets/${ID.petMaxId}/today`],
  ['auth-100-admin-pet-detail', `/admin/pets/${ID.petMaxId}`],
  ['auth-101-admin-user-detail', `/admin/users/${ID.sarahId}`],
  ['auth-102-alert-detail-authed', `/alerts/${ID.maxCaseId}`],
  ['auth-103-mission-detail-authed', `/missions/${ID.maxCaseNumber}`],
  ['auth-104-missions-legacy', '/missions'],
  ['auth-105-database-legacy', '/database'],
];

// Expected redirects (next.config.js + in-page) — a changed finalUrl here is not a bounce bug
const EXPECTED_REDIRECT = new Set([
  '/found', '/missions', '/database', `/communities/${ID.forceId}`,
  '/communities/my-requests', '/communities/request', '/missions/report',
  '/patrol/database', '/rescue-forces',
  `/missions/${ID.maxCaseNumber}/coordinate`, `/missions/${ID.maxCaseNumber}`,
  `/rescue-forces/${ID.forceId}/command-center`, `/rescue-forces/${ID.forceId}/mission-control`,
]);

function extraWait(route) {
  return SLOW.some((re) => re.test(route)) ? 4500 : 1200;
}

async function settle(page, ms) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function rel(url) {
  return url.replace(BASE, '') || '/';
}

async function capture(page, name, route, report, { nav = true } = {}) {
  const errors = [];
  const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text()); };
  const onPageError = (e) => errors.push('pageerror: ' + e.message);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  if (nav) {
    try {
      await page.goto(BASE + route, { timeout: 90000, waitUntil: 'domcontentloaded' });
    } catch (e) {
      errors.push('goto failed: ' + e.message.split('\n')[0]);
    }
  }
  await settle(page, extraWait(route));
  const finalUrl = rel(page.url());
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  } catch {
    await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  }
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  report.push({ name, route, finalUrl, consoleErrors: errors });
  console.log(`${name}: ${route} -> ${finalUrl}${errors.length ? `  [${errors.length} console err]` : ''}`);
  return finalUrl;
}

// Client-side navigation via an in-app next/link — for admin pages whose
// guards fire during NextAuth 'loading' and bounce hard loads. Playwright's
// locator.click() times out on these (hidden mobile duplicates match first),
// so click the first VISIBLE element with a native DOM click; next/link's
// handler turns it into an SPA navigation that keeps the session warm.
async function domClick(page, selector) {
  const ok = await page.evaluate((sel) => {
    const vis = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null);
    if (!vis) return false;
    vis.click();
    return true;
  }, selector);
  if (!ok) throw new Error(`no visible element for ${selector}`);
}

async function softNav(page, href) {
  await domClick(page, `a[href="${href}"]`);
  await page.waitForURL(BASE + href, { timeout: 30000 });
}

// Open the desktop nav's Admin dropdown so its links join the DOM.
async function openAdminDropdown(page) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim().startsWith('Admin') && b.offsetParent !== null
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }
      : undefined,
  });
  const report = [];

  // See header comment — only needed behind an egress proxy.
  const routeExternal = async (ctx) => {
    if (!process.env.HTTPS_PROXY) return;
    await ctx.route(/^https:\/\//, async (route) => {
      try {
        const resp = await ctx.request.fetch(route.request(), { ignoreHTTPSErrors: true, timeout: 20000, maxRedirects: 5 });
        await route.fulfill({ response: resp });
      } catch {
        await route.abort().catch(() => {});
      }
    });
  };

  // ---- anonymous pass ----
  const anonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(anonCtx);
  const anon = await anonCtx.newPage();
  for (const [name, route] of PUB) await capture(anon, name, route, report);
  await anonCtx.close();

  // ---- admin pass ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.fill('#email', LOGIN_EMAIL);
  await page.fill('#password', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 60000 });
  console.log('LOGIN OK ->', rel(page.url()));

  const bounced = [];
  for (const [name, route] of AUTH) {
    const finalUrl = await capture(page, name, route, report);
    if (route.startsWith('/admin') && !finalUrl.startsWith(route) && !EXPECTED_REDIRECT.has(route)) {
      bounced.push([name, route]);
    }
  }

  // ---- warm-session retry for bounced admin pages ----
  for (const [name, route] of bounced) {
    try {
      // Re-warm: hard-load a page that survives, then soft-nav via links.
      // The nav Admin dropdown links to /admin; the /admin hub links to the rest.
      await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(page, 3000);
      await openAdminDropdown(page);
      await softNav(page, '/admin');
      await settle(page, 1500);
      if (route !== '/admin') {
        if (route.startsWith('/admin/users/cm')) {
          await softNav(page, '/admin/users');
          await settle(page, 1500);
          await domClick(page, `a[href="${route}"], a[href^="/admin/users/cm"]`);
          await page.waitForURL((u) => /\/admin\/users\/cm/.test(u.toString()), { timeout: 30000 });
        } else if (route.startsWith('/admin/pets/cm')) {
          await softNav(page, '/admin/pets');
          await settle(page, 1500);
          await domClick(page, `a[href="${route}"], a[href^="/admin/pets/cm"]`);
          await page.waitForURL((u) => /\/admin\/pets\/cm/.test(u.toString()), { timeout: 30000 });
        } else {
          await softNav(page, route);
        }
      }
      const idx = report.findIndex((r) => r.name === name);
      if (idx >= 0) report.splice(idx, 1);
      await capture(page, name, route, report, { nav: false });
      report[report.length - 1].warmNav = true;
    } catch (e) {
      console.log(`WARM RETRY FAILED ${name}: ${e.message.split('\n')[0]}`);
      const idx = report.findIndex((r) => r.name === name);
      if (idx >= 0) report[idx].warmNavFailed = e.message.split('\n')[0];
    }
  }

  await ctx.close();
  await browser.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`DONE: ${report.length} captures, report.json written`);
})();
