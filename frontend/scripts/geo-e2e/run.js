#!/usr/bin/env node
/**
 * End-to-end run of the geo game in a real browser, with the Google Maps
 * JavaScript API replaced by fake-maps.js and the Street View metadata
 * endpoint replaced by mock-metadata.js. Exercises: a three-round pin
 * game with keyboard shortcuts, the summary and its share page, seeded
 * replay, a country streak, a timed NMPZ round that runs out, and the
 * mobile map sheet, and a two-browser room: lobby, rounds, reveal,
 * reactions, standings with ratings, rematch, leaderboard (needs the
 * database, see docs/GEO.md).
 *
 * Setup (from frontend/):
 *   node scripts/geo-e2e/mock-metadata.js &
 *   GOOGLE_STREET_VIEW_API_KEY=x GOOGLE_MAPS_BROWSER_KEY=x GEO_FREE_GOOGLE_ROUNDS=1000 \
 *   GEO_STREET_VIEW_METADATA_URL=http://localhost:3999/metadata npm run dev &
 *   (the play meter would otherwise stop one address at 25 Google rounds a day)
 *   npm i --no-save playwright-core        # not a project dependency
 *   node scripts/geo-e2e/run.js            # BASE_URL, CHROME_PATH, GEO_E2E_OUT optional
 *   GEO_E2E_ONLY=rooms node scripts/geo-e2e/run.js   # one scenario (pinGame, streak, timer, mobile, rooms, daily, profile)
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
    // CDN blocks in sandboxes and next-auth's session poll losing a race
    // with navigation are noise; anything else on the console fails the run.
    if (m.type() === 'error' && !/b-cdn|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|\[next-auth\]\[error\]\[CLIENT_FETCH_ERROR\]/.test(m.text())) errors.push('console: ' + m.text());
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

/** The result map must really have a box on screen, not just exist. */
async function expectMapVisible(page, where) {
  const box = await page.evaluate(() => {
    const host = document.querySelector('[data-fake-map]')?.parentElement;
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
  });
  log(`${where} map box:`, box);
  if (!box || box.height < 150 || box.width < 300) throw new Error(`${where} map is not visibly sized: ${JSON.stringify(box)}`);
}

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
  await expectMapVisible(page, 'result');
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
  await expectMapVisible(page, 'summary');
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

/** Two browsers, one room: lobby, three rounds on the shared clock, reveal, standings, ratings, rematch. */
async function rooms(browser) {
  const host = await newPage(browser, { width: 1280, height: 800 });
  await host.goto(`${BASE}/geo/rooms`, { waitUntil: 'domcontentloaded' });
  await host.waitForSelector('form[data-ready="1"]', { timeout: 60000 }); // typed before hydration would be reset
  await host.fill('input[placeholder="What the others will see"]', 'Ada');
  await host.selectOption('label:has-text("Rounds") select', '3');
  await host.selectOption('label:has-text("Time per round") select', '60');
  await host.click('button:has-text("Open the room")');
  await host.waitForURL(/\/geo\/room\/[A-Z0-9]{6}/, { timeout: 60000 });
  const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
  await host.waitForSelector('text=Join code', { timeout: 60000 });
  log('room opened', code);

  const guest = await newPage(browser, { width: 1280, height: 800 });
  await guest.goto(`${BASE}/geo/rooms`, { waitUntil: 'domcontentloaded' });
  await guest.waitForSelector(`a[href*="/geo/room/${code}"]`, { timeout: 20000 });
  log('room is listed publicly');
  await guest.goto(`${BASE}/geo/room/${code}`, { waitUntil: 'domcontentloaded' });
  await guest.fill('input[aria-label="Your name"]', 'Grace');
  await guest.click('button:has-text("Join")');
  await guest.waitForSelector('text=Waiting for Ada to start', { timeout: 20000 });
  await host.waitForSelector('text=Grace', { timeout: 20000 });
  log('guest joined; host sees them');

  await host.click('button:has-text("Start the game")');
  const stamp = () => new Date().toISOString().slice(11, 23);
  const playRound = async (n) => {
    for (const p of [host, guest]) {
      await p.waitForSelector(`text=Round ${n} of 3`, { timeout: 60000 });
      await waitForPano(p);
    }
    log(stamp(), `round ${n}: both pages show it`);
    await host.evaluate(() => window.__fakeClick(48.8566, 2.3522));
    await waitGuessable(host);
    await host.click('button:has-text("Guess")');
    log(stamp(), `round ${n}: host clicked guess`);
    await host.waitForSelector('text=Guess locked in', { timeout: 20000 });
    log(stamp(), `round ${n}: host locked in`);
    await guest.evaluate(() => window.__fakeClick(-33.8688, 151.2093));
    await waitGuessable(guest);
    await guest.click('button:has-text("Guess")');
    log(stamp(), `round ${n}: guest clicked guess`);
    for (const p of [host, guest]) await p.waitForSelector('text=/(Next round|Results) in \\d+s/', { timeout: 20000 });
    log(stamp(), `round ${n}: both guessed, reveal on both screens`);
  };

  await playRound(1);
  await expectMapVisible(host, 'room reveal');
  const drawn = await host.evaluate(() => ({ markers: window.__fakeMarkers.filter((m) => m.opts.map).length, lines: window.__fakeLines.filter((l) => l.opts.map).length }));
  log('reveal map:', drawn);
  if (drawn.markers !== 3 || drawn.lines !== 2) throw new Error('reveal should draw two guesses, two lines and one answer');
  await guest.click('button[aria-label="React 🔥"]', { timeout: 5000 });
  await host.waitForFunction(() => document.body.innerText.includes('Grace') && document.body.innerText.includes('🔥'), null, { timeout: 10000 });
  log(stamp(), 'reaction reached the host');
  // The reveal moves on by itself after 12 s; the host's "Now" only shortens it.
  const skipReveal = async (label) => {
    const now = host.locator('button:has-text("Now")');
    if (await now.isVisible().catch(() => false)) await now.click({ timeout: 5000 }).catch(() => {});
    log(stamp(), label);
  };
  await skipReveal('host skipped reveal 1');
  await playRound(2);
  await skipReveal('host skipped reveal 2');
  await playRound(3);
  await skipReveal('host skipped the final reveal');
  for (const p of [host, guest]) await p.waitForSelector('text=Final standings', { timeout: 30000 });
  await host.waitForSelector('text=/[+-]\\d+ rating/', { timeout: 10000 });
  await shot(host, 'room-standings');
  const standings = await host.evaluate(() => document.body.innerText);
  if (!/wins/.test(standings)) throw new Error('standings should name a winner');
  log('standings show the winner and rating changes');

  await host.click('button:has-text("Play again, same settings")');
  await host.waitForURL((url) => /\/geo\/room\/[A-Z0-9]{6}/.test(url.href) && !url.href.includes(code), { timeout: 60000 });
  await host.waitForSelector('text=Join code', { timeout: 60000 });
  await guest.waitForSelector('a:has-text("Join the rematch")', { timeout: 20000 });
  log('rematch room opened and offered to the guest');

  await host.goto(`${BASE}/geo/leaderboard`, { waitUntil: 'domcontentloaded' });
  await host.waitForSelector('text=/You, Ada/', { timeout: 20000 });
  await shot(host, 'leaderboard');
  for (const p of [host, guest]) if (p.errors.length) throw new Error('page errors: ' + p.errors.join(' | '));
  await host.close();
  await guest.close();
}

/**
 * The daily challenge as the front door: today's five, scored on the
 * server; the summary and the lobby show your place on the day's board;
 * the result page hides the places from a browser that has not played
 * that day, and shows them to one that has.
 */
async function daily(browser) {
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo/play?mode=daily`, { waitUntil: 'domcontentloaded' });
  const spots = [[48.8566, 2.3522], [-33.8688, 151.2093], [35.6762, 139.6503], [40.7128, -74.006], [51.5072, -0.1276]];
  for (let i = 0; i < spots.length; i++) {
    await waitPlayable(page);
    await waitForPano(page);
    await page.evaluate(([lat, lng]) => window.__fakeClick(lat, lng), spots[i]);
    await waitGuessable(page);
    await page.click('button:has-text("Guess")');
    await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
    log(`daily round ${i + 1} scored`);
    if (i < spots.length - 1) await page.keyboard.press('Space');
  }
  await page.click('button:has-text("See results")');
  await page.waitForSelector('text=/of 25,000/', { timeout: 20000 });
  const rankLine = 'text=/You are \\d+(st|nd|rd|th) of \\d+ who finished/';
  await page.waitForSelector(rankLine, { timeout: 20000 });
  log('daily summary:', await page.textContent(rankLine));
  await shot(page, 'daily-summary');
  const shareHref = await page.getAttribute('a[href*="/geo/share?s="]', 'href');

  await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-daily-board]', { timeout: 20000 });
  const board = (await page.textContent('[data-daily-board]')).replace(/\s+/g, ' ');
  log('lobby daily board:', board.slice(0, 160));
  if (!/You are \d+(st|nd|rd|th) of \d+/.test(board)) throw new Error('the lobby board should show your rank');
  await page.waitForSelector('[data-cup-board]:has-text("Ends")', { timeout: 20000 });
  const cupText = (await page.textContent('[data-cup-board]')).replace(/\s+/g, ' ');
  if (!/Ends in/.test(cupText)) throw new Error('the cup card should say when the week ends');
  log('lobby cup card:', cupText.slice(0, 120));

  // This browser played today: the result page shows the places.
  await page.goto(shareHref, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=/You have played this one/', { timeout: 20000 });
  if ((await page.locator('li:has-text("Hidden")').count()) !== 0) throw new Error('places should show to a browser that played');

  // A browser that has not: hidden until "Show them anyway".
  const fresh = await newPage(browser, { width: 1280, height: 800 });
  await fresh.goto(shareHref, { waitUntil: 'domcontentloaded' });
  await fresh.waitForSelector('text=/hidden until you have played/', { timeout: 20000 });
  if ((await fresh.locator('li:has-text("Hidden")').count()) !== 5) throw new Error('a fresh browser should see five hidden places');
  await shot(fresh, 'daily-share-hidden');
  await fresh.click('button:has-text("Show them anyway")');
  await fresh.waitForFunction(() => ![...document.querySelectorAll('li')].some((li) => li.textContent.trim() === 'Hidden'), null, { timeout: 10000 });
  log('daily share: hidden for a fresh browser, shown on request');
  for (const p of [page, fresh]) if (p.errors.length) throw new Error('page errors: ' + p.errors.join(' | '));
  await page.close();
  await fresh.close();
}

/**
 * Points and the profile page: a game earns points that show on the
 * result and the summary; /geo/me shows the balance, the shop with its
 * pins, and the name can be changed.
 */
async function profile(browser) {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.goto(`${BASE}/geo/play?provider=google&mode=balanced&rounds=3&seed=e2e-points-1&time=0`, { waitUntil: 'domcontentloaded' });
  await waitPlayable(page);
  await waitForPano(page);
  await page.evaluate(() => window.__fakeClick(48.8566, 2.3522));
  await waitGuessable(page);
  await page.click('button:has-text("Guess")');
  await page.waitForSelector('text=/\\+\\d+ points/', { timeout: 20000 });
  log('round points line:', await page.textContent('text=/\\+\\d+ points/'));
  await page.goto(`${BASE}/geo/me`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-shop] li', { timeout: 30000 });
  const pins = await page.locator('[data-shop] li').count();
  if (pins < 6) throw new Error(`expected the pins in the shop, saw ${pins}`);
  const headerText = (await page.textContent('header')).replace(/\s+/g, ' ');
  log('profile header:', headerText.slice(0, 120));
  if (!/\d+\s*points/.test(headerText)) throw new Error('the profile header should show the points balance');
  await page.fill('input[aria-label="Your name"]', 'Harness Ada');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('button:has-text("Saved")', { timeout: 10000 });
  await page.waitForSelector('h1:has-text("Harness Ada")', { timeout: 10000 });
  await page.click('button[role="tab"]:has-text("Title")');
  await page.waitForSelector('[data-shop] li:has-text("Wanderer")', { timeout: 10000 });
  await shot(page, 'profile');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

(async () => {
  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await chromium.launch(launch);
  try {
    const all = { pinGame, streak, timer, mobile, rooms, daily, profile };
    const only = (process.env.GEO_E2E_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
    const steps = only.length ? only.map((name) => all[name]).filter(Boolean) : Object.values(all);
    for (const step of steps) {
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
