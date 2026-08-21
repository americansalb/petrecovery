/**
 * Launch-audit sweep — the shots the gallery sweep does not take.
 *
 * Three passes the full-page desktop gallery misses:
 *   1. fold/*   — 1440x900 viewport-only (what a visitor actually sees first)
 *   2. mob/*    — 390x844 iPhone-class, full page AND fold
 *   3. state/*  — interaction states: wizard steps, validation errors,
 *                 empty states, open menus, 404, modals
 *
 * Usage:
 *   node scripts/audit-sweep-2026-08.js /tmp/seed-ids.json
 * Needs the dev server on :3000 and the seeded DB (see scripts/gallery-sweep.js).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../../screenshots/audit-2026-08');
const EMAIL = process.env.LOGIN_EMAIL || 'admin@localdev.test';
const PASSWORD = process.env.LOGIN_PASSWORD || 'LocalDevScreenshots1!';
const MEMBER_EMAIL = 'sarah@localdev.test';

const ID = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').slice(
  fs.readFileSync(process.argv[2], 'utf8').indexOf('{')
));

for (const d of ['fold', 'mob', 'state']) {
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

const report = [];
const SLOW = [/mission-control/, /lost-and-found/, /report/, /^\/cases\//, /lost-pet/, /simulate/, /^\/$/, /shelters/];
const wait = (r) => (SLOW.some((re) => re.test(r)) ? 4200 : 1500);

async function settle(page, ms) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page, dir, name, { full = false } = {}) {
  await page.screenshot({ path: `${OUT}/${dir}/${name}.png`, fullPage: full }).catch(async () => {
    await page.screenshot({ path: `${OUT}/${dir}/${name}.png` }).catch(() => {});
  });
  console.log(`  ${dir}/${name}.png`);
}

async function visit(page, dir, name, route, opts = {}) {
  const errors = [];
  const onErr = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
  const onPage = (e) => errors.push('pageerror: ' + e.message.split('\n')[0]);
  page.on('console', onErr);
  page.on('pageerror', onPage);
  try {
    await page.goto(BASE + route, { timeout: 90000, waitUntil: 'domcontentloaded' });
  } catch (e) {
    errors.push('goto: ' + e.message.split('\n')[0]);
  }
  await settle(page, wait(route));
  await shot(page, dir, name, opts);
  page.off('console', onErr);
  page.off('pageerror', onPage);
  const finalUrl = page.url().replace(BASE, '') || '/';
  report.push({ shot: `${dir}/${name}`, route, finalUrl, viewport: page.viewportSize(), consoleErrors: errors });
  return finalUrl;
}

async function login(page, email = EMAIL, password = PASSWORD) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 60000 });
  await settle(page, 2000);
}

// Routes worth judging above the fold and on a phone.
const KEY_PUBLIC = [
  ['01-home', '/'],
  ['02-lost-and-found', '/lost-and-found'],
  ['03-report-new', '/report/new'],
  ['04-report-found', '/report/found'],
  ['05-case', `/cases/${ID.maxCaseNumber}`],
  ['06-care', '/care'],
  ['07-care-start', '/care/start'],
  ['08-advice', '/advice'],
  ['09-shelters', '/shelters'],
  ['10-for-shelters', '/for-shelters'],
  ['11-about', '/about'],
  ['12-login', '/login'],
  ['13-register', '/register'],
  ['14-hub', '/hub'],
  ['15-rescue-forces-search', '/rescue-forces/search'],
  ['16-lost-pet-city', '/lost-pet/austin-tx'],
  ['17-legal-terms', '/legal/terms'],
  ['18-privacy', '/privacy'],
  ['19-contact', '/contact'],
  ['20-pet-public-view', `/pets/view/${ID.petMaxToken}`],
  ['21-shelter-start', '/shelter/start'],
  ['22-join-mission', `/join/${ID.maxCaseId}`],
  ['23-alerts-detail', `/alerts/${ID.maxCaseId}`],
  ['24-hub-thread', `/hub/thread/${ID.threadSlug}`],
  ['25-rescue-force', `/rescue-forces/${ID.forceId}`],
  ['26-404', '/this-route-does-not-exist'],
  ['27-simulate', '/simulate'],
  ['28-patrol-join', '/patrol/join'],
];

const KEY_AUTH = [
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

  // ============ PASS 1: desktop fold, anonymous ============
  console.log('\n== fold (1440x900 viewport, anonymous) ==');
  const foldCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(foldCtx);
  const fold = await foldCtx.newPage();
  for (const [name, route] of KEY_PUBLIC) await visit(fold, 'fold', name, route);
  await foldCtx.close();

  // ============ PASS 2: mobile, anonymous ============
  console.log('\n== mobile 390x844, anonymous ==');
  const mobCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true,
  });
  await routeExternal(mobCtx);
  const mob = await mobCtx.newPage();
  for (const [name, route] of KEY_PUBLIC) {
    await visit(mob, 'mob', name + '-fold', route);
    await shot(mob, 'mob', name + '-full', { full: true });
  }

  // mobile menu open on the homepage
  console.log('\n== mobile interaction states ==');
  await mob.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await settle(mob, 3000);
  await shot(mob, 'state', 'mob-01-home-tabbar');
  try {
    await mob.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /menu|more/i.test(x.getAttribute('aria-label') || x.textContent) && x.offsetParent !== null);
      if (b) b.click();
    });
    await mob.waitForTimeout(1200);
    await shot(mob, 'state', 'mob-02-menu-open');
  } catch (e) { console.log('  menu open failed: ' + e.message.split('\n')[0]); }
  await mobCtx.close();

  // ============ PASS 3: desktop interaction / error states, anonymous ============
  console.log('\n== desktop states, anonymous ==');
  const stCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(stCtx);
  const st = await stCtx.newPage();

  // login: wrong password
  await st.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await settle(st, 1500);
  await st.fill('#email', 'nobody@example.com');
  await st.fill('#password', 'wrongpassword123');
  await st.click('button[type="submit"]');
  await st.waitForTimeout(4000);
  await shot(st, 'state', '01-login-wrong-password');

  // register: submit empty
  await st.goto(BASE + '/register', { waitUntil: 'domcontentloaded' });
  await settle(st, 1500);
  await st.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && /continue|next|create|sign up|join/i.test(x.textContent));
    if (b) b.click();
  });
  await st.waitForTimeout(2500);
  await shot(st, 'state', '02-register-empty-submit');

  // report wizard: walk the steps by clicking the primary advance control
  await st.goto(BASE + '/report/new', { waitUntil: 'domcontentloaded' });
  await settle(st, 4500);
  await shot(st, 'state', '03-report-step1');
  for (let i = 2; i <= 6; i++) {
    const advanced = await st.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.offsetParent !== null && !x.disabled && /^(next|continue|start|lost|found)/i.test(x.textContent.trim())
      );
      if (b) { b.click(); return b.textContent.trim().slice(0, 30); }
      return null;
    });
    if (!advanced) break;
    await st.waitForTimeout(2500);
    await shot(st, 'state', `03-report-step${i}`);
  }

  // report wizard: try to advance with nothing filled (validation surface)
  await st.goto(BASE + '/report/new', { waitUntil: 'domcontentloaded' });
  await settle(st, 4500);
  for (let i = 0; i < 3; i++) {
    await st.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && /^(next|continue)/i.test(x.textContent.trim()));
      if (b) b.click();
    });
    await st.waitForTimeout(1500);
  }
  await shot(st, 'state', '04-report-empty-advance');

  // care/start wizard steps
  await st.goto(BASE + '/care/start', { waitUntil: 'domcontentloaded' });
  await settle(st, 3000);
  await shot(st, 'state', '05-care-start-step1');
  for (let i = 2; i <= 4; i++) {
    const ok = await st.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && !x.disabled && /^(next|continue|add|start)/i.test(x.textContent.trim()));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!ok) break;
    await st.waitForTimeout(2000);
    await shot(st, 'state', `05-care-start-step${i}`);
  }

  // lost-and-found: map view + a search that returns nothing
  await st.goto(BASE + '/lost-and-found', { waitUntil: 'domcontentloaded' });
  await settle(st, 4500);
  await st.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && /^map$/i.test(x.textContent.trim()));
    if (b) b.click();
  });
  await st.waitForTimeout(3500);
  await shot(st, 'state', '06-lost-and-found-map');
  await st.goto(BASE + '/lost-and-found?search=zzzzqqqnothing', { waitUntil: 'domcontentloaded' });
  await settle(st, 3500);
  await shot(st, 'state', '07-lost-and-found-no-results');

  // hub search with no results
  await visit(st, 'state', '08-hub-search-no-results', '/hub/search?q=zzzzqqqnothing');

  // protected route while logged out (what a shared link to a private page does)
  await visit(st, 'state', '09-logged-out-dashboard', '/dashboard');
  await visit(st, 'state', '10-logged-out-admin', '/admin');

  // token pages without tokens
  await visit(st, 'state', '11-reset-password-no-token', '/reset-password');
  await visit(st, 'state', '12-verify-email-no-token', '/verify-email');
  await visit(st, 'state', '13-bad-case-number', '/cases/XXX-9999-9999');
  await visit(st, 'state', '14-bad-share-token', '/pets/view/aaaaaaaaaaaaaaaaaaaaaaaa');

  await stCtx.close();

  // ============ PASS 4: authed desktop fold + authed states ============
  console.log('\n== authed (admin) ==');
  const aCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(aCtx);
  const a = await aCtx.newPage();
  await login(a);
  for (const [name, route] of KEY_AUTH) await visit(a, 'fold', name, route);

  // account dropdown + notification bell open
  await a.goto(BASE + '/pets', { waitUntil: 'domcontentloaded' });
  await settle(a, 2500);
  try {
    await a.evaluate(() => {
      const el = document.querySelector('[data-dropdown="user"]');
      const btn = el && (el.querySelector('button') || el.closest('button') || el);
      if (btn) btn.click();
    });
    await a.waitForTimeout(1200);
    await shot(a, 'state', '20-account-menu-open');
  } catch (e) { console.log('  account menu failed'); }
  await aCtx.close();

  // ============ PASS 5: authed mobile ============
  console.log('\n== authed mobile 390x844 ==');
  const amCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true,
  });
  await routeExternal(amCtx);
  const am = await amCtx.newPage();
  await login(am);
  for (const [name, route] of KEY_AUTH) {
    await visit(am, 'mob', name + '-fold', route);
    await shot(am, 'mob', name + '-full', { full: true });
  }
  await amCtx.close();

  // ============ PASS 6: a fresh member with no data (empty states) ============
  console.log('\n== empty states (fresh member) ==');
  const fCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await routeExternal(fCtx);
  const f = await fCtx.newPage();
  try {
    await login(f, MEMBER_EMAIL, PASSWORD);
    for (const [name, route] of [
      ['30-member-dashboard', '/dashboard'],
      ['31-member-pets', '/pets'],
      ['32-member-messages', '/messages'],
      ['33-member-notifications', '/notifications'],
      ['34-member-my-alerts', '/my-alerts'],
      ['35-member-admin-403', '/admin'],
      ['36-member-shelter-dashboard', '/shelter/dashboard'],
    ]) await visit(f, 'state', name, route, { full: true });
  } catch (e) {
    console.log('member login failed: ' + e.message.split('\n')[0]);
  }
  await fCtx.close();

  await browser.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  const errs = report.filter((r) => r.consoleErrors.length);
  console.log(`\nDONE. ${report.length} navigations, ${errs.length} with console errors.`);
  console.log(`report -> ${OUT}/report.json`);
})();
