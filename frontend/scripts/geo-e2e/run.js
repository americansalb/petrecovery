#!/usr/bin/env node
/**
 * End-to-end run of the geo game in a real browser, with the Google Maps
 * JavaScript API replaced by fake-maps.js and the Street View metadata
 * endpoint replaced by mock-metadata.js. Exercises: a three-round pin
 * game with keyboard shortcuts, the summary and its share page, seeded
 * replay, a country streak, a timed NMPZ round that runs out, and the
 * mobile map sheet.
 *
 * Setup (from frontend/):
 *   node scripts/geo-e2e/mock-metadata.js &
 *   GOOGLE_STREET_VIEW_API_KEY=x GOOGLE_MAPS_BROWSER_KEY=x \
 *   GEO_STREET_VIEW_METADATA_URL=http://localhost:3999/metadata npm run dev &
 *   npm i --no-save playwright-core        # not a project dependency
 *   node scripts/geo-e2e/run.js            # BASE_URL, CHROME_PATH, GEO_E2E_OUT optional
 *
 * Screenshots land in GEO_E2E_OUT (default: the OS temp dir).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const FAKE = fs.readFileSync(path.join(__dirname, 'fake-maps.js'), 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.GEO_E2E_OUT || os.tmpdir();
const log = (...args) => console.log(...args);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `geo-e2e-${name}.png`) });

async function newPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/b-cdn|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED/.test(m.text())) errors.push('console: ' + m.text());
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('https://maps.googleapis.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: FAKE }));
  page.errors = errors;
  return page;
}

const waitForPano = (page, timeout = 60000) =>
  page.waitForFunction(() => { const el = document.querySelector('[data-fake-pano]'); return el && el.getAttribute('data-fake-pano'); }, null, { timeout });
const waitPlayable = (page) => page.waitForSelector('button:has-text("Place your pin on the map")', { timeout: 60000 });
const waitGuessable = (page) => page.waitForSelector('button:has-text("Guess"):not([disabled])');

async function pinGame(browser) {
  const url = `${BASE}/geo/play?provider=google&mode=balanced&rounds=3&seed=e2e-pin-1&time=0`;
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitPlayable(page);
  await waitForPano(page);
  const pano1 = await page.getAttribute('[data-fake-pano]', 'data-fake-pano');
  log('round 1 pano', pano1);
  log('notice:', await page.textContent('text=/Tried \\d+ random point/').catch(() => '(none)'));
  await shot(page, 'playing');
  if (!(await page.locator('button:has-text("Place your pin on the map")').isDisabled())) throw new Error('guess must be disabled without a pin');
  await page.evaluate(() => window.__fakeClick(48.8566, 2.3522));
  await waitGuessable(page);
  await page.evaluate(() => window.__fakeHeading(135));
  await shot(page, 'pinned');
  await page.click('button:has-text("Guess")');
  await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
  log('round 1 result:', await page.textContent('text=/away\\.|Time ran out/').catch(() => '(no distance line)'));
  await shot(page, 'result');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space'); // a second press must not skip a round
  await waitPlayable(page);
  await page.waitForSelector('text=Round 2 of 3');
  await page.waitForFunction((prev) => { const el = document.querySelector('[data-fake-pano]'); return el && el.getAttribute('data-fake-pano') !== prev; }, pano1, { timeout: 30000 });
  await page.evaluate(() => window.__fakeClick(-33.8688, 151.2093));
  await waitGuessable(page);
  await page.click('button:has-text("Guess")');
  await page.waitForSelector('text=/of 5,000/');
  await page.click('button:has-text("Round 3 of 3")');
  await waitPlayable(page);
  await page.keyboard.press('r');
  await page.keyboard.press('m');
  await page.evaluate(() => window.__fakeClick(35.6762, 139.6503));
  await waitGuessable(page);
  await page.keyboard.press('Enter');
  await page.waitForSelector('button:has-text("See results")');
  await page.click('button:has-text("See results")');
  await page.waitForSelector('text=/of 15,000/', { timeout: 20000 });
  await shot(page, 'summary');
  const shareHref = await page.getAttribute('a[href*="/geo/share?s="]', 'href');
  const counts = await page.evaluate(() => ({
    markers: window.__fakeMarkers.filter((m) => m.opts.map).length,
    lines: window.__fakeLines.filter((l) => l.opts.map).length,
    maps: window.__fakeMaps.length,
    panos: window.__fakePanos.length,
    history: JSON.parse(localStorage.getItem('geo:history:v1') || '[]').length,
  }));
  log('summary:', counts);
  if (counts.maps !== 1 || counts.panos !== 1) throw new Error('expected one map and one panorama instance for the whole game');
  if (counts.markers !== 6 || counts.lines !== 3) throw new Error('summary map should show 3 guess/answer pairs');
  if (counts.history !== 1) throw new Error('the game should be in local history once');
  await page.goto(shareHref, { waitUntil: 'domcontentloaded' });
  log('share page title:', await page.title());
  await shot(page, 'share');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForPano(page);
  const replay = await page.getAttribute('[data-fake-pano]', 'data-fake-pano');
  if (replay !== pano1) throw new Error(`seeded replay produced ${replay}, expected ${pano1}`);
  log('seeded replay: same panorama');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function streak(browser) {
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo/play?provider=google&mode=streak&seed=e2e-streak-1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Streak 0', { timeout: 60000 });
  await waitForPano(page);
  await page.fill('input[aria-label="Country"]', 'Fra');
  await page.keyboard.press('Enter');
  await page.waitForSelector('button:has-text("Guess 🇫🇷 France")');
  await shot(page, 'streak');
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=/Right\\. Streak|Not 🇫🇷 France/', { timeout: 20000 });
  log('streak verdict:', await page.textContent('text=/Right\\. Streak|Not 🇫🇷 France/'));
  await shot(page, 'streak-result');
  await page.click('button:has-text("Next country"), button:has-text("See results")');
  await page.waitForSelector('text=/Streak of \\d+|Streak 1/', { timeout: 60000 });
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function timer(browser) {
  const page = await newPage(browser, { width: 900, height: 700 });
  await page.goto(`${BASE}/geo/play?provider=google&mode=world&rounds=3&seed=e2e-timer&time=30&move=0&pan=0&zoom=0`, { waitUntil: 'domcontentloaded' });
  await waitForPano(page);
  await page.waitForSelector('text=/^(2[0-9]|30)$/');
  if (!(await page.$('[title="Panning is off for this game"]'))) throw new Error('NMPZ overlay missing');
  await shot(page, 'timer');
  await page.waitForSelector('text=Time ran out before a guess', { timeout: 45000 });
  log('timer expiry scored the round with no guess');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function mobile(browser) {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.goto(`${BASE}/geo/play?provider=google&mode=cities&rounds=3&seed=e2e-mobile`, { waitUntil: 'domcontentloaded' });
  await waitForPano(page);
  await page.click('button:has-text("Map")');
  await page.evaluate(() => window.__fakeClick(40.7, -74));
  await waitGuessable(page);
  await shot(page, 'mobile');
  await page.click('button:has-text("Guess")');
  await page.waitForSelector('text=/of 5,000/');
  await shot(page, 'mobile-result');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

(async () => {
  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await chromium.launch(launch);
  try {
    for (const step of [pinGame, streak, timer, mobile]) {
      try {
        await step(browser);
      } catch (error) {
        const pages = browser.contexts().flatMap((c) => c.pages());
        const page = pages[pages.length - 1];
        if (page) {
          await shot(page, 'failure').catch(() => {});
          console.log('FAILURE PAGE TEXT:\n' + (await page.evaluate(() => document.body.innerText.slice(0, 800)).catch(() => '')));
          console.log('FAILURE PAGE ERRORS:', page.errors);
        }
        throw error;
      }
    }
    log(`E2E OK (screenshots in ${OUT})`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error('E2E FAILED:', error.message);
  process.exit(1);
});
