/**
 * Authed passes of the launch-audit sweep (the earlier run crashed at login
 * because the login form submits natively before React hydrates - see
 * scripts/audit-sweep-2026-08.js). Waits for hydration, then captures:
 *   fold/*  1440x900 admin      mob/*  390x844 admin      state/*  empty states
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../../screenshots/audit-2026-08');
const EMAIL = process.env.LOGIN_EMAIL || 'admin@localdev.test';
const PASSWORD = process.env.LOGIN_PASSWORD || 'LocalDevScreenshots1!';
const MEMBER = 'sarah@localdev.test';

const raw = fs.readFileSync(process.argv[2], 'utf8');
const ID = JSON.parse(raw.slice(raw.indexOf('{')));

for (const d of ['fold', 'mob', 'state']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const report = [];
const SLOW = [/mission-control/, /^\/dashboard/, /shelter/, /admin/, /pets/];
const wait = (r) => (SLOW.some((re) => re.test(r)) ? 4000 : 1800);

const settle = async (p, ms) => {
  await p.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await p.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await p.waitForTimeout(ms);
};

async function shot(page, dir, name, full = false) {
  await page.screenshot({ path: `${OUT}/${dir}/${name}.png`, fullPage: full })
    .catch(() => page.screenshot({ path: `${OUT}/${dir}/${name}.png` }).catch(() => {}));
  console.log(`  ${dir}/${name}.png`);
}

async function visit(page, dir, name, route, full = false) {
  const errors = [];
  const onErr = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
  const onPage = (e) => errors.push('pageerror: ' + e.message.split('\n')[0]);
  page.on('console', onErr); page.on('pageerror', onPage);
  try { await page.goto(BASE + route, { timeout: 90000, waitUntil: 'domcontentloaded' }); }
  catch (e) { errors.push('goto: ' + e.message.split('\n')[0]); }
  await settle(page, wait(route));
  await shot(page, dir, name, full);
  page.off('console', onErr); page.off('pageerror', onPage);
  report.push({ shot: `${dir}/${name}`, route, finalUrl: page.url().replace(BASE, '') || '/', viewport: page.viewportSize(), consoleErrors: errors });
}

// The login form has no action/method - a click before hydration does a native
// GET and puts the password in the query string. Wait for React, then submit.
async function login(page, email = EMAIL, password = PASSWORD) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(page, 3500);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.waitForTimeout(1200);
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 45000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(2500);
    if (!page.url().includes('/login')) { console.log('  login ok ->', page.url().replace(BASE, '')); return true; }
    console.log(`  login attempt ${attempt} failed (${page.url().replace(BASE, '')}), retrying`);
    await page.waitForTimeout(8000); // auth endpoints are IP rate-limited
  }
  throw new Error('login failed after 3 attempts');
}

const AUTH = [
  ['50-dashboard', '/dashboard'],
  ['51-pets', '/pets'],
  ['52-pet-detail', `/pets/${ID.petMaxId}`],
  ['53-pet-today', `/pets/${ID.petMaxId}/today`],
  ['54-pet-health', `/pets/${ID.petMaxId}/health`],
  ['55-pet-share', `/pets/${ID.petMaxId}/share`],
  ['56-mission-control', `/mission-control?mission=${ID.maxCaseNumber}`],
  ['57-messages', '/messages'],
  ['58-notifications', '/notifications'],
  ['59-my-alerts', '/my-alerts'],
  ['60-settings', '/settings'],
  ['61-profile', '/profile'],
  ['62-shelter-dashboard', '/shelter/dashboard'],
  ['63-admin', '/admin'],
  ['64-alerts', '/alerts'],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  });
  const routeExternal = async (ctx) => {
    if (!process.env.HTTPS_PROXY) return;
    await ctx.route(/^https:\/\//, async (route) => {
      try {
        const resp = await ctx.request.fetch(route.request(), { ignoreHTTPSErrors: true, timeout: 20000, maxRedirects: 5 });
        await route.fulfill({ response: resp });
      } catch { await route.abort().catch(() => {}); }
    });
  };
  const PHONE = {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true,
  };

  // ---- authed desktop ----
  console.log('\n== authed desktop (admin) ==');
  const aCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(aCtx);
  const a = await aCtx.newPage();
  await login(a);
  for (const [n, r] of AUTH) await visit(a, 'fold', n, r);
  await a.goto(BASE + '/pets', { waitUntil: 'domcontentloaded' });
  await settle(a, 2500);
  await a.evaluate(() => {
    const el = document.querySelector('[data-dropdown="user"]');
    const btn = el && (el.querySelector('button') || el.closest('button') || el);
    if (btn) btn.click();
  }).catch(() => {});
  await a.waitForTimeout(1200);
  await shot(a, 'state', '20-account-menu-open');
  await aCtx.close();

  // ---- authed mobile ----
  console.log('\n== authed mobile ==');
  const mCtx = await browser.newContext(PHONE);
  await routeExternal(mCtx);
  const m = await mCtx.newPage();
  await login(m);
  for (const [n, r] of AUTH) { await visit(m, 'mob', n + '-fold', r); await shot(m, 'mob', n + '-full', true); }
  await mCtx.close();

  // ---- fresh member: empty states + non-admin 403 ----
  console.log('\n== empty states (regular member) ==');
  const fCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(fCtx);
  const f = await fCtx.newPage();
  try {
    await login(f, MEMBER, PASSWORD);
    for (const [n, r] of [
      ['30-member-dashboard', '/dashboard'],
      ['31-member-pets', '/pets'],
      ['32-member-messages', '/messages'],
      ['33-member-notifications', '/notifications'],
      ['34-member-my-alerts', '/my-alerts'],
      ['35-member-admin-403', '/admin'],
      ['36-member-shelter-dashboard', '/shelter/dashboard'],
      ['37-member-alerts', '/alerts'],
    ]) await visit(f, 'state', n, r, true);
  } catch (e) { console.log('member pass failed: ' + e.message.split('\n')[0]); }
  await fCtx.close();

  await browser.close();
  const prev = fs.existsSync(`${OUT}/report.json`) ? JSON.parse(fs.readFileSync(`${OUT}/report.json`, 'utf8')) : [];
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(prev.concat(report), null, 2));
  console.log(`\nDONE. ${report.length} navigations captured.`);
})();
