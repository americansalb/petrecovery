/**
 * Button sweep: clicks every button on the Lost & Found and Rescue Forces
 * pages and checks that every link goes somewhere.
 *
 * Usage (dev server up, local DB seeded or copied from production):
 *   node scripts/button-sweep.js                 # default pages below
 *   node scripts/button-sweep.js /cases/AUS-2026-0001 /lost-pet/austin-tx
 *   BASE_URL=https://www.reunitepets.org node scripts/button-sweep.js
 *
 * For each page, on a phone (390px) and a desktop (1440px):
 *   - every visible button, tab, "#" link and map pin outside the global
 *     navbar, tab bar and footer is clicked. A click must change something:
 *     open a dialog, navigate, open a popup, change the DOM, or send a
 *     request. One that does nothing is reported DEAD; one that throws is
 *     reported ERROR.
 *   - every link on the page is checked once: internal links must answer
 *     below 400 and must not contain "undefined", "null" or "NaN"; tel:
 *     links need a real number; external links must be well-formed https.
 *
 * Exits 1 when anything is dead, broken or throws. This exists because the
 * city pages shipped cards that linked to /cases/undefined, and a static
 * href audit (scripts/audit-links.mjs) cannot see a link built at runtime.
 *
 * Browser: set CHROME_PATH to a Chromium binary if Playwright's own is not
 * installed. Behind an egress proxy, HTTPS_PROXY is used for external
 * requests (localhost is bypassed) and CHROMIUM_ARGS passes extra flags.
 */

const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900 },
];
const SETTLE_MS = 700;

const CONTROLS = 'button, [role="button"], [role="tab"], a[href="#"], .leaflet-marker-icon';

/**
 * Pages to sweep: the board in each state, a pet and two towns, then Rescue
 * Forces and the first force listed there.
 */
async function defaultPages(page) {
  await page.goto(`${BASE}/lost-and-found`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await page.waitForSelector('a[href^="/cases/"]', { timeout: 30000 }).catch(() => {});
  const petHref = await page.evaluate(() => document.querySelector('a[href^="/cases/"]')?.getAttribute('href'));
  await page.goto(`${BASE}/rescue-forces`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  const forceHref = await page.evaluate(
    () => [...document.querySelectorAll('main a[href^="/rescue-forces/"]')].map((a) => a.getAttribute('href')).find((h) => !/\/create$/.test(h))
  );
  const pages = ['/lost-and-found', '/lost-and-found?view=map', '/lost-and-found?tab=found', '/lost-and-found?tab=reunited'];
  if (petHref) pages.push(petHref);
  pages.push('/lost-pet/austin-tx', '/lost-pet/orlando-fl', '/rescue-forces');
  if (forceHref) pages.push(forceHref);
  return pages;
}

function checkHrefShape(href) {
  if (/undefined|null|NaN|\[object/.test(href)) return 'contains undefined/null/NaN';
  if (href.startsWith('tel:')) return href.replace(/\D/g, '').length >= 7 ? null : 'tel: link without a real number';
  if (href.startsWith('mailto:') || href.startsWith('sms:')) return null;
  if (/^https?:\/\//.test(href) && !href.startsWith(BASE)) {
    try {
      const u = new URL(href);
      return u.protocol === 'https:' || u.hostname === 'localhost' ? null : 'external link is not https';
    } catch {
      return 'malformed URL';
    }
  }
  return null;
}

async function checkLinks(page, seen, problems, where) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h !== '#')
  );
  for (const href of hrefs) {
    if (seen.has(href)) continue;
    seen.add(href);
    const shape = checkHrefShape(href);
    if (shape) {
      problems.push(`BROKEN LINK  ${href}  (${shape}) on ${where}`);
      continue;
    }
    if (href.startsWith('#') || /^(tel|mailto|sms):/.test(href) || (/^https?:\/\//.test(href) && !href.startsWith(BASE))) continue;
    const url = href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;
    try {
      const res = await page.request.get(url, { maxRedirects: 5, timeout: 60000 });
      if (res.status() >= 400) problems.push(`BROKEN LINK  ${href}  (answers ${res.status()}) on ${where}`);
    } catch (err) {
      problems.push(`BROKEN LINK  ${href}  (${err.message.split('\n')[0]}) on ${where}`);
    }
  }
}

async function tagControls(page) {
  return page.evaluate((selector) => {
    const out = [];
    let i = 0;
    for (const el of document.querySelectorAll(selector)) {
      // The universal chrome is the same on every page; global-chrome.test.js owns it.
      if (el.closest('footer, nav.sticky, nav.fixed')) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      // Slid off the side of the screen (a closed drawer): not on the page.
      if (r.right <= 0 || r.left >= window.innerWidth) continue;
      const id = `c${i++}`;
      el.setAttribute('data-sweep', id);
      const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.className || el.tagName)
        .toString().replace(/\s+/g, ' ').trim().slice(0, 50);
      out.push({ id, label, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' });
    }
    return out;
  }, CONTROLS);
}

async function clickAndObserve(page, context, id) {
  const before = page.url();
  let requests = 0;
  let opened = null;
  const onRequest = () => { requests += 1; };
  const onPopup = (p) => { opened = p; };
  page.on('request', onRequest);
  context.on('page', onPopup);
  await page.evaluate(() => {
    window.__sweepMutations = 0;
    window.__sweepObserver?.disconnect();
    window.__sweepObserver = new MutationObserver((list) => { window.__sweepMutations += list.length; });
    window.__sweepObserver.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const target = page.locator(`[data-sweep="${id}"]`);
  await target.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await target.click({ timeout: 5000 });
  await page.waitForTimeout(SETTLE_MS);
  page.off('request', onRequest);
  context.off('page', onPopup);
  const mutations = await page.evaluate(() => window.__sweepMutations || 0).catch(() => 1);
  const dialog = await page.locator('[role="dialog"], .leaflet-popup').count().catch(() => 0);
  if (opened) await opened.close().catch(() => {});
  return { navigated: page.url() !== before, popup: Boolean(opened), dialog: dialog > 0, mutations, requests };
}

/**
 * Something else is on top of the control's centre after scrolling to it:
 * the phone tab bar over a map pin at the bottom edge, say. A person would
 * pan the map first; the sweep counts it as out of reach, not as broken.
 */
async function isCovered(page, id) {
  const target = page.locator(`[data-sweep="${id}"]`);
  await target.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !top || !(top === el || el.contains(top) || top.contains(el));
  }).catch(() => false);
}

/**
 * A submit button whose form has empty required fields: the browser answers
 * the click with its own "fill in this field" bubble, which changes nothing
 * in the page. That is a response, not a dead button.
 */
async function isBlockedByBrowserValidation(page, id) {
  return page.locator(`[data-sweep="${id}"]`).evaluate((el) => {
    const form = el.form || el.closest('form');
    const submits = el.tagName === 'BUTTON' ? (el.type || 'submit') === 'submit' : el.type === 'submit';
    return Boolean(form && submits && !form.noValidate && !form.checkValidity());
  }).catch(() => false);
}

/** Already the current choice (the selected tab, the active filter): clicking it changes nothing, by design. */
async function isCurrentChoice(page, id) {
  return page.locator(`[data-sweep="${id}"]`).evaluate((el) =>
    el.getAttribute('aria-selected') === 'true' ||
    el.getAttribute('aria-pressed') === 'true' ||
    ['page', 'true', 'step'].includes(el.getAttribute('aria-current'))
  ).catch(() => false);
}

async function sweepPage(browser, vp, path, seenLinks, problems) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await context.newPage();
  const where = `${path} (${vp.name})`;
  const home = new URL(`${BASE}${path}`).pathname;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  // DOM ready plus a pause, not 'load' or 'networkidle': photos and map
  // tiles can hold those back for most of the timeout.
  // A click before React hydrates does nothing, which read as a dead
  // button; a client page also shows a skeleton until its data arrives. So:
  // DOM ready, then a quiet network (capped, since tiles and live updates
  // may never go quiet), then a short pause.
  const load = async () => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
  };
  await load();
  await checkLinks(page, seenLinks, problems, where);

  const controls = await tagControls(page);
  let ok = 0;
  let current = 0;
  let covered = 0;
  for (const control of controls) {
    if (control.disabled) continue;
    // Left the page, or the control is gone: start from a fresh copy. Tags
    // follow DOM order, so the same id is the same control after a reload.
    if (new URL(page.url()).pathname !== home || !(await page.locator(`[data-sweep="${control.id}"]`).count())) {
      await load();
      await tagControls(page);
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (await isCurrentChoice(page, control.id)) {
      current += 1;
      continue;
    }
    if (await isCovered(page, control.id)) {
      covered += 1;
      continue;
    }
    const nativeValidation = await isBlockedByBrowserValidation(page, control.id);
    try {
      const r = await clickAndObserve(page, context, control.id);
      if (nativeValidation) {
        ok += 1;
        continue;
      }
      if (r.navigated || r.popup || r.dialog || r.mutations > 0 || r.requests > 0) {
        ok += 1;
        // A dialog or popup may hold links of its own.
        if (r.dialog) await checkLinks(page, seenLinks, problems, `${where}, after "${control.label}"`);
      } else {
        problems.push(`DEAD BUTTON  "${control.label}" on ${where}`);
      }
    } catch (err) {
      problems.push(`ERROR        "${control.label}" on ${where}: ${err.message.split('\n')[0]}`);
    }
  }
  for (const e of new Set(errors)) problems.push(`PAGE ERROR   ${e} on ${where}`);
  const clickable = controls.filter((c) => !c.disabled).length - current - covered;
  const notes = [current && `${current} already selected`, covered && `${covered} out of reach under other elements`].filter(Boolean);
  console.log(`  ${where}: ${ok} of ${clickable} controls respond${notes.length ? ` (skipped: ${notes.join(', ')})` : ''}`);
  await context.close();
}

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    proxy,
    args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean),
  });
  const probe = await browser.newPage();
  const pages = process.argv.slice(2).length ? process.argv.slice(2) : await defaultPages(probe);
  await probe.close();

  console.log(`Sweeping ${pages.length} pages on ${BASE}\n`);
  const problems = [];
  const seenLinks = new Set();
  for (const path of pages) {
    for (const vp of VIEWPORTS) await sweepPage(browser, vp, path, seenLinks, problems);
  }
  await browser.close();

  console.log(`\nChecked ${seenLinks.size} distinct links.`);
  if (problems.length) {
    console.log(`\n${problems.length} problems:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Every button responded and every link works.');
})();
