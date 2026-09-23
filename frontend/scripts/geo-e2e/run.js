#!/usr/bin/env node
/**
 * End-to-end run of the geo game in a real browser, with MapKit JS
 * replaced by fake-mapkit.js. Every round is Apple Look Around, because
 * that is the only imagery the game has (docs/GEO.md, "Apple only").
 *
 * Exercises: a three-round pin game with keyboard shortcuts, the summary
 * and its share page, seeded replay, a country streak, a timed NMPZ
 * round that runs out, the mobile map sheet, a two-browser room (lobby,
 * rounds, reveal, reactions, standings with ratings, rematch,
 * leaderboard), the daily and the ranked boards, the profile and its
 * shop, a five-round script game where the answer is a linguistic region
 * rather than a point, and that same round with the MapKit token
 * refused, which is what a clone sees.
 *
 * The rooms, daily, ranked, profile and admin scenarios write to the
 * database, so they need a DATABASE_URL (see docs/GEO.md).
 *
 * Setup (from frontend/):
 *   DATABASE_URL=postgresql://... GEO_TOKEN_SECRET=anything-long-enough npm run dev &
 *   npm i --no-save playwright-core        # not a project dependency
 *   node scripts/geo-e2e/run.js            # BASE_URL, CHROME_PATH, GEO_E2E_OUT optional
 *   GEO_E2E_ONLY=pinGame node scripts/geo-e2e/run.js   # one scenario (coldOpen, admin, menuOffline, pinGame, streak, timer, backgrounded, regionPill, formats, keyboard, mobile, rooms, duel, appleSolo, appleRoom, appleRefused, firstRun, daily, ranked, profile, script, scriptFallback)
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

const FAKE_MAPKIT = fs.readFileSync(path.join(__dirname, 'fake-mapkit.js'), 'utf8');
// The only names the script map is allowed to write on itself.
const COUNTRY_NAMES = new Set(
  require('../../app/lib/geo/data/country-labels.json').labels.map((row) => row.n)
);
// What a duel starts everyone on. Read out of the source rather than
// typed here, because a harness that carries its own copy of a game
// constant stops testing the game the day the constant changes.
// rooms.js is ESM and this runner is CommonJS, hence the regex.
const DUEL_START_HP = Number(
  fs.readFileSync(path.join(__dirname, '../../app/lib/geo/rooms.js'), 'utf8').match(/DUEL_START_HP\s*=\s*(\d+)/)[1]
);
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.GEO_E2E_OUT || os.tmpdir();
const log = (...args) => console.log(...args);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `geo-e2e-${name}.png`) });

async function newPage(browser, viewport, options = {}) {
  const page = await browser.newPage({ viewport });
  // The fake MapKit answers about the token the way the real one does,
  // on the namespace and a tick late. 'failed' plays the origin-locked
  // token: the script round has a keyless map to fall back to.
  if (options.mapkitAuth) {
    await page.addInitScript((state) => {
      window.__fakeMapKitAuth = state;
    }, options.mapkitAuth);
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  if (process.env.GEO_E2E_TRACE) {
    page.on('response', (r) => {
      if (r.status() >= 400) {
        const body = r.request().postData() || '';
        r.text().then((t) => console.log(`  [http ${r.status()}] ${r.request().method()} ${r.url()} sent=${body} got=${t.slice(0, 200)}`)).catch(() => {});
      }
    });
  }
  page.on('console', (m) => {
    // CDN blocks in sandboxes, and requests that lose a race with a
    // navigation, are noise; anything else on the console fails the run.
    //
    // The RSC one: the game's subtab row is six links, so Next prefetches
    // six route payloads as soon as a page paints. Navigate before one
    // lands and the browser aborts it, which surfaces as "Failed to fetch
    // RSC payload ... Falling back to browser navigation". The fallback is
    // the point: the click still works. Same class as next-auth's session
    // poll below, which this list already forgave.
    //
    // "Failed to load resource: net::ERR_*" is the third one, and it is
    // the awkward one: the console line carries the error code and not
    // the URL, so a blocked font CDN and a broken page asset read the
    // same. Those are caught by the requestfailed listener below
    // instead, which knows the URL and only fails the run for our own.
    const ignore = /b-cdn|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|Failed to fetch RSC payload|\[next-auth\]\[error\]\[CLIENT_FETCH_ERROR\]|Failed to load resource/;
    if (m.type() === 'error' && !ignore.test(m.text())) errors.push('console: ' + m.text());
  });
  // A request this deployment serves failing is a bug; a request to
  // somebody else's CDN failing is this sandbox's network policy.
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!url.startsWith(BASE)) return;
    // A prefetch the browser abandons because you navigated is not a
    // failure: the click it lost the race to is what the player did.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    // A request the scenario refused on purpose, to see what the page
    // does without it. Those are the point of the run, not a bug in it.
    if ((options.refuses || []).some((part) => url.includes(part))) return;
    errors.push(`request: ${request.failure()?.errorText} ${url}`);
  });
  // requestfailed is transport only: a 404 for a chunk or a stylesheet
  // is a perfectly successful response as far as the browser is
  // concerned, and would otherwise slip past with the console line this
  // run ignores. Our own assets are never allowed to 404.
  page.on('response', (response) => {
    const url = response.url();
    if (!url.startsWith(BASE) || response.status() < 400) return;
    const kind = response.request().resourceType();
    // The API's own error responses are the game talking: a room that
    // is full, a meter that says no, a round the scenario expects to
    // fail. Scenarios assert on those; assets have no such excuse.
    if (!['document', 'script', 'stylesheet', 'font', 'image'].includes(kind)) return;
    errors.push(`asset: ${response.status()} ${kind} ${url}`);
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('https://cdn.apple-mapkit.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: FAKE_MAPKIT }));
  page.errors = errors;
  return page;
}

const waitForPano = (page, timeout = 60000) =>
  page.waitForFunction(() => { const el = document.querySelector('[data-fake-pano]'); return el && el.getAttribute('data-fake-pano'); }, null, { timeout });
/** The round is up and the guess button exists, pin or no pin. */
const waitPlayable = (page) => page.waitForSelector('[data-geo-guess]', { timeout: 60000 });
const waitGuessable = (page) => page.waitForSelector('[data-geo-guess]:not([disabled])');

/** Apple rounds: Look Around has opened, and the MapKit guess map is up. */
const waitForLookAround = (page, timeout = 60000) => page.waitForFunction(() => Boolean(document.querySelector('[data-fake-lookaround]')), null, { timeout });
/** A tap in the middle of the MapKit guess map, which the fake turns into a coordinate. */
async function pinApple(page) {
  await page.waitForSelector('[data-fake-mapkit]', { timeout: 20000 });
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-fake-mapkit]').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.click(box.x, box.y);
  await waitGuessable(page);
}

/** The result map must really have a box on screen, not just exist. */
async function expectMapVisible(page, where) {
  const box = await page.evaluate(() => {
    const host = document.querySelector('[data-fake-mapkit]')?.parentElement;
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
  });
  log(`${where} map box:`, box);
  if (!box || box.height < 150 || box.width < 300) throw new Error(`${where} map is not visibly sized: ${JSON.stringify(box)}`);
}

/**
 * A three-round pin game, keyboard and all: the guess button is dead
 * until a pin is down, Space does not skip a round when it triggers
 * both the button and the window handler, the one map and the one
 * panorama are reused for the whole game, the result and summary maps
 * are really on screen, the game lands in local history once, the
 * share link opens, and the same seed replays the same place.
 */
async function pinGame(browser) {
  const url = `${BASE}/geo/play?provider=apple&mode=balanced&rounds=3&seed=e2e-pin-1&time=0`;
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitPlayable(page);
  await waitForLookAround(page);
  const pano1 = await page.getAttribute('[data-fake-pano]', 'data-fake-pano');
  log('round 1 pano', pano1);
  await shot(page, 'playing');
  if (!(await page.locator('[data-geo-guess]').isDisabled())) throw new Error('guess must be disabled without a pin');
  await pinApple(page);
  await shot(page, 'pinned');
  await page.click('[data-geo-guess]');
  await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
  log('round 1 result:', await page.textContent('text=/km away|m away|Out of time/').catch(() => '(no distance line)'));
  await shot(page, 'result');
  await expectMapVisible(page, 'result');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space'); // a second press must not skip a round
  await waitPlayable(page);
  await page.waitForSelector('text=Round 2 of 3');
  await page.waitForFunction((prev) => { const el = document.querySelector('[data-fake-pano]'); return el && el.getAttribute('data-fake-pano') !== prev; }, pano1, { timeout: 30000 });
  await pinApple(page);
  await page.click('[data-geo-guess]');
  await page.waitForSelector('text=/of 5,000/');
  await page.click('button:has-text("Round 3 of 3")');
  await waitPlayable(page);
  await waitForLookAround(page);
  await page.keyboard.press('r');
  await page.keyboard.press('m');
  await pinApple(page);
  await page.keyboard.press('Enter');
  await page.waitForSelector('button:has-text("See results")');
  await page.click('button:has-text("See results")');
  await page.waitForSelector('text=/of 15,000/', { timeout: 20000 });
  await shot(page, 'summary');
  await expectMapVisible(page, 'summary');
  const shareHref = await page.getAttribute('a[href*="/geo/share?s="]', 'href');
  const counts = await page.evaluate(() => ({
    // Maps on screen, not maps ever constructed: React's strict mode
    // mounts every component twice in development, so the constructor
    // count says nothing about what the player has.
    maps: document.querySelectorAll('[data-fake-mapkit]').length,
    built: window.__fakeMaps.length,
    // Three guesses, three answers, three lines between them, drawn on
    // the one map as annotations and overlays.
    annotations: Number(document.querySelector('[data-fake-mapkit]')?.parentElement?.getAttribute('data-fake-annotations') || 0),
    overlays: Number(document.querySelector('[data-fake-mapkit]')?.parentElement?.getAttribute('data-fake-overlays') || 0),
    history: JSON.parse(localStorage.getItem('geo:history:v1') || '[]').length,
  }));
  log('summary:', counts);
  if (counts.maps !== 1) throw new Error(`expected one map on screen for the whole game, saw ${counts.maps}`);
  if (counts.annotations < 6) throw new Error(`summary map should show 3 guess/answer pairs, saw ${counts.annotations} annotations`);
  if (counts.history !== 1) throw new Error('the game should be in local history once');
  await page.goto(shareHref, { waitUntil: 'domcontentloaded' });
  log('share page title:', await page.title());
  await shot(page, 'share');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForLookAround(page);
  const replay = await page.getAttribute('[data-fake-pano]', 'data-fake-pano');
  if (replay !== pano1) throw new Error(`seeded replay produced ${replay}, expected ${pano1}`);
  log('seeded replay: same panorama');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function streak(browser) {
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=streak&seed=e2e-streak-1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Streak 0', { timeout: 60000 });
  await waitForLookAround(page);
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
  await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=3&seed=e2e-timer&time=30&move=0&pan=0&zoom=0`, { waitUntil: 'domcontentloaded' });
  await waitForLookAround(page);
  await page.waitForSelector('text=/^(2[0-9]|30)$/');
  if (!(await page.$('[title="Panning is off for this game"]'))) throw new Error('NMPZ overlay missing');
  await shot(page, 'timer');
  await page.waitForSelector('text=Out of time.', { timeout: 45000 });
  log('timer expiry scored the round with no guess');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function mobile(browser) {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=3&seed=e2e-mobile`, { waitUntil: 'domcontentloaded' });
  await waitForLookAround(page);
  await page.click('button:has-text("Map")');
  await pinApple(page);
  await shot(page, 'mobile');
  await page.click('[data-geo-guess]');
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
      await waitForLookAround(p);
    }
    log(stamp(), `round ${n}: both pages show it`);
    await pinApple(host);
    await waitGuessable(host);
    await host.click('[data-geo-guess]');
    log(stamp(), `round ${n}: host clicked guess`);
    await host.waitForSelector('text=Guess locked in', { timeout: 20000 });
    log(stamp(), `round ${n}: host locked in`);
    await pinApple(guest);
    await waitGuessable(guest);
    await guest.click('[data-geo-guess]');
    log(stamp(), `round ${n}: guest clicked guess`);
    for (const p of [host, guest]) await p.waitForSelector('text=/(Next round|Results) in \\d+s/', { timeout: 20000 });
    log(stamp(), `round ${n}: both guessed, reveal on both screens`);
  };

  await playRound(1);
  await expectMapVisible(host, 'room reveal');
  const drawn = await host.evaluate(() => {
    const map = document.querySelector('[data-fake-mapkit]')?.parentElement;
    return { markers: Number(map?.getAttribute('data-fake-annotations') || 0), lines: Number(map?.getAttribute('data-fake-overlays') || 0) };
  });
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
/**
 * The default game: a solo balanced game on Apple Look Around. Three
 * rounds, each a list of city-street places the browser tries in order,
 * a pin on the MapKit map, a score, and a summary with a share link.
 */
async function appleSolo(browser) {
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=3&seed=e2e-apple-solo&time=0`, { waitUntil: 'domcontentloaded' });
  for (let i = 1; i <= 3; i++) {
    await page.waitForSelector(`text=Round ${i} of 3`, { timeout: 60000 });
    await waitPlayable(page);
    await waitForLookAround(page);
    if (i === 1) {
      log('apple solo: Look Around opened at', await page.getAttribute('[data-fake-pano]', 'data-fake-pano'));
      await shot(page, 'apple-solo-playing');
    }
    await pinApple(page);
    await page.click('[data-geo-guess]');
    await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
    const line = await page.textContent('text=/away\\.|Time ran out/').catch(() => '');
    if (/Time ran out/.test(line)) throw new Error('an Apple round with a pin was recorded as timed out');
    log(`apple solo round ${i}:`, line || '(scored)');
    if (i < 3) await page.keyboard.press('Space');
  }
  await page.click('button:has-text("See results")');
  await page.waitForSelector('text=/of 15,000/', { timeout: 20000 });
  await page.waitForSelector('[data-fake-mapkit]', { timeout: 10000 });
  if (!(await page.getAttribute('a[href*="/geo/share?s="]', 'href'))) throw new Error('no share link on the Apple summary');
  // The account ask, at the one moment there is something worth keeping
  // (founder: never force it, always offer it). A guest must see it.
  await page.waitForSelector('[data-keep-this]', { timeout: 15000 });
  const keep = await page.textContent('[data-keep-this]');
  log('account ask on the summary:', /Keep this game/.test(keep || ''));
  // "free", not "costs nothing" (founder, 2026-09-17: "WHY NOT SAY
  // FREE"). The house rule allows the price in the present tense.
  if (!/\bfree\b/i.test(keep || '')) throw new Error('the account ask does not say it is free');
  await shot(page, 'apple-solo-summary');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

/**
 * A room on Apple Look Around, which is the one thing the deep audit
 * found unplayable: the shared map block was gated on the Google Maps
 * handle, which an Apple room never sets, so every player saw the
 * panorama and the countdown with no map to pin and no button to press,
 * and every round timed out at zero for everyone.
 *
 * So this scenario is mostly one assertion made three ways: the guess
 * map is on screen, the Guess button exists, and a pin scores.
 */
async function appleRoom(browser) {
  const host = await newPage(browser, { width: 1280, height: 800 });
  await host.goto(`${BASE}/geo/rooms`, { waitUntil: 'domcontentloaded' });
  await host.waitForSelector('form[data-ready="1"]', { timeout: 60000 });
  await host.fill('input[placeholder="What the others will see"]', 'Ada');
  await host.selectOption('label:has-text("Rounds") select', '3');
  await host.selectOption('label:has-text("Time per round") select', '60');
  await host.click('button:has-text("Open the room")');
  await host.waitForURL(/\/geo\/room\/[A-Z0-9]{6}/, { timeout: 60000 });
  const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
  await host.waitForSelector('text=Join code', { timeout: 60000 });
  log('apple room opened', code);

  const guest = await newPage(browser, { width: 1280, height: 800 });
  await guest.goto(`${BASE}/geo/room/${code}`, { waitUntil: 'domcontentloaded' });
  await guest.fill('input[aria-label="Your name"]', 'Grace');
  await guest.click('button:has-text("Join")');
  await guest.waitForSelector('text=Waiting for Ada to start', { timeout: 20000 });
  await host.click('button:has-text("Start the game")');

  for (const p of [host, guest]) {
    await p.waitForSelector('text=Round 1 of 3', { timeout: 60000 });
    // The Look Around pane really opened, for both of them, at the
    // place the first browser found.
    await p.waitForFunction(() => Boolean(document.querySelector('[data-fake-lookaround]')), null, { timeout: 60000 });
  }
  log('both browsers opened Look Around at the round s place');

  // The fix. Before it, neither of these existed in an Apple room.
  for (const [p, who] of [[host, 'host'], [guest, 'guest']]) {
    const map = await p.evaluate(() => {
      const el = document.querySelector('[data-fake-mapkit]')?.closest('div[class]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height) };
    });
    if (!map || map.height < 120 || map.width < 200) throw new Error(`${who} has no guess map in an Apple room: ${JSON.stringify(map)}`);
    log(`${who} guess map:`, map);
    await p.waitForSelector('[data-geo-guess]', { timeout: 20000 });
  }

  const pin = async (p) => {
    const box = await p.evaluate(() => {
      const el = document.querySelector('[data-fake-mapkit]');
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await p.mouse.click(box.x, box.y);
    await waitGuessable(p);
    await p.click('[data-geo-guess]');
  };

  await pin(host);
  await host.waitForSelector('text=Guess locked in', { timeout: 20000 });
  await pin(guest);
  for (const p of [host, guest]) await p.waitForSelector('text=/(Next round|Results) in \\d+s/', { timeout: 30000 });
  log('both guessed on Apple imagery, reveal on both screens');

  // Scored, not timed out: the whole symptom of the bug was 0-0.
  const scored = await host.evaluate(() => /\d/.test(document.body.innerText.match(/away/) ? '1' : '') || !document.body.innerText.includes('no guess'));
  if (!scored) throw new Error('an Apple room round was recorded as no guess');
  await shot(host, 'apple-room-reveal');
  for (const p of [host, guest]) if (p.errors.length) throw new Error('page errors: ' + p.errors.join(' | '));
  await host.close();
  await guest.close();
}

/**
 * A ranked solo set, played to the end, and the rating it moves.
 *
 * Solo play used to be unrated: one person on their own had points and
 * a daily board and nothing to climb. A ranked set is the same five
 * places for everyone playing that hour, on a clock, and finishing one
 * compares your total against theirs.
 *
 * Two browsers, because the interesting number is the second one's: the
 * first player of an hour is rated against par, and the second is rated
 * against a real field.
 */
async function ranked(browser) {
  log('\n== ranked ==');
  const playSet = async (page, label) => {
    // Through the Rankings page, the way a player arrives. Going
    // straight to the play URL races the profile this browser is about
    // to be given, and a ranked round is refused to anyone but the
    // profile that opened it.
    await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-menu-ranked]', { timeout: 60000 });
    await page.click('[data-menu-ranked]');
    for (let i = 0; i < 5; i++) {
      await waitPlayable(page);
      await waitForLookAround(page);
      await pinApple(page);
      await page.click('[data-geo-guess]');
      await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
      if (i < 4) await page.keyboard.press('Space');
    }
    await page.click('button:has-text("See results")');
    await page.waitForSelector('[data-ranked-result]', { timeout: 20000 });
    const text = (await page.textContent('[data-ranked-result]')).replace(/\s+/g, ' ');
    log(`${label}: ${text.slice(0, 150)}`);
    return text;
  };

  const first = await newPage(browser, { width: 1280, height: 800 });
  const alone = await playSet(first, 'first browser');
  if (!/[+-]?\d+ rating/.test(alone)) throw new Error('a finished ranked set showed no rating change');
  // Whether this browser is the first of the hour depends on what is
  // already in the database, which a re-run changes. Both answers are
  // correct; saying neither is not.
  if (!/set against par|average of \d+ other/.test(alone)) throw new Error('the reveal did not say what the score was set against');
  if (!/to be placed/.test(alone)) throw new Error('a provisional rating should say how many placement games are left');

  const second = await newPage(browser, { width: 1280, height: 800 });
  const against = await playSet(second, 'second browser');
  // This one is never first: the browser above just finished the hour.
  if (!/average of \d+ other/.test(against)) throw new Error('a player with a field ahead of them should be rated against it, not against par');

  // The menu carries the standing, and the ladder has a tab of its own
  // on Rankings.
  await second.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  // The card carries no status at all until the board answers (a claim
  // made from a request still in flight is a false one), so this waits
  // for the standing itself rather than for the absence of "0 of",
  // which an empty card satisfies the moment it paints.
  await second.waitForSelector('[data-menu-ranked]:has-text("placement games played")', { timeout: 30000 });
  const standing = (await second.textContent('[data-menu-ranked]')).replace(/\s+/g, ' ');
  log('ranked standing:', standing);
  if (!/placement games played/.test(standing)) throw new Error('the lobby should show placement progress');

  await second.goto(`${BASE}/geo/leaderboard`, { waitUntil: 'domcontentloaded' });
  await second.waitForSelector('button[role="tab"]:has-text("Ranked solo")', { timeout: 20000 });
  await second.click('button[role="tab"]:has-text("Ranked solo")');
  await second.waitForSelector('[data-season]', { timeout: 20000 });
  log('solo ladder tab opens');

  await shot(second, 'ranked-summary');
  for (const page of [first, second]) {
    if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
    await page.close();
  }
}

/**
 * The lobby a first-time player sees.
 *
 * A page full of choices and nothing saying what a round is, which is
 * how somebody leaves without playing. It has to be there on a fresh
 * browser and gone once there is a game behind them, because an
 * explanation that never leaves is worse than none.
 */
/**
 * The front door (docs/PROBABLY_EARTH_UI.md).
 *
 * The thing worth asserting is the thing that was wrong before: a
 * stranger arriving here should find exactly one way to start, and
 * pressing it should put them in a round without asking them anything.
 */
async function coldOpen(browser) {
  log('\n== coldOpen ==');
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-cold-open-play]', { timeout: 30000 });

  // One button that starts the default game, not eight. The menu has
  // links to the rest of the product and two region pickers under "More
  // ways to play", which is the catalogue that used to be buried in the
  // standings page; what it must not have is a second thing competing
  // to be the game.
  const starts = await page.locator('button:visible').count();
  log('buttons on the menu:', starts);
  if (starts !== 1) throw new Error(`the menu should have one button, found ${starts}`);

  // The quick start asks for nothing: no field sits above it, so a
  // stranger presses Play without having decided anything first.
  const asksFirst = await page.evaluate(() => {
    const play = document.querySelector('[data-cold-open-play]');
    if (!play) return -1;
    const top = play.getBoundingClientRect().top + window.scrollY;
    return [...document.querySelectorAll('select, input, [role="radio"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.top + window.scrollY < top;
    }).length;
  });
  if (asksFirst !== 0) throw new Error(`the quick start should ask for nothing first, found ${asksFirst} fields above Play`);

  await shot(page, 'cold-open');
  await page.click('[data-cold-open-play]');
  await page.waitForSelector('text=Round 1 of 5', { timeout: 45000 });
  await waitPlayable(page);
  log('the front door button lands in a round');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function firstRun(browser) {
  log('\n== firstRun ==');
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-cold-open-play]', { timeout: 30000 });
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  log('front door:', text.slice(0, 140));
  // What the game is, and how to reach the rest of it, in the words a
  // stranger meets first.
  // What the menu has to show a stranger: what the game is, both game
  // families, and the way to play with somebody.
  // Case-insensitive: the card headings are uppercased in CSS, and
  // innerText returns what is rendered.
  const lower = text.toLowerCase();
  for (const wanted of ['Put a pin where you think you are', 'Street', 'Script', 'Friends', 'Rankings']) {
    if (!lower.includes(wanted.toLowerCase())) throw new Error(`the game menu should show ${wanted}`);
  }

  // Play one game, and it should not be there afterwards.
  await page.goto(`${BASE}/geo/play?mode=daily`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 5; i++) {
    await waitPlayable(page);
    await waitForLookAround(page);
    await pinApple(page);
    await page.click('[data-geo-guess]');
    await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
    if (i < 4) await page.keyboard.press('Space');
  }
  await page.click('button:has-text("See results")');
  await page.waitForSelector('text=/of 25,000/', { timeout: 20000 });

  // The account ask lives here and nowhere earlier: a guest who has
  // just finished a game is the only person with something to keep.
  await page.waitForSelector('[data-keep-this]', { timeout: 20000 });
  const keep = (await page.textContent('[data-keep-this]')).replace(/\s+/g, ' ');
  log('account ask:', keep.slice(0, 90));
  if (!/Keep this game/.test(keep)) throw new Error('the summary should offer to keep the game');

  await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  // The card is on the page before its status is: it renders at once
  // and fills in when /api/geo/daily answers. Waiting on the shape of
  // the sentence rather than on the element is what makes this about
  // the standing and not about which of the two got there first.
  await page.waitForSelector('[data-menu-daily]:has-text("You are")', { timeout: 20000 });
  const played = (await page.textContent('[data-menu-daily]')).replace(/\s+/g, ' ');
  log('daily board after a game:', played.slice(0, 120));
  if (!/You are \d+(st|nd|rd|th) of \d+/.test(played)) {
    throw new Error("the daily board should show where the game just played came: " + played.slice(0, 160));
  }
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

async function daily(browser) {
  const page = await newPage(browser, { width: 1280, height: 800 });
  // The daily is played on the primary imagery, Apple: the round is a
  // list of places the browser tries until Look Around opens one.
  await page.goto(`${BASE}/geo/play?mode=daily`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 5; i++) {
    await waitPlayable(page);
    await waitForLookAround(page);
    await pinApple(page);
    await page.click('[data-geo-guess]');
    await page.waitForSelector('text=/of 5,000/', { timeout: 20000 });
    log(`daily round ${i + 1} scored`);
    if (i < 4) await page.keyboard.press('Space');
  }
  await page.click('button:has-text("See results")');
  await page.waitForSelector('text=/of 25,000/', { timeout: 20000 });
  const rankLine = 'text=/You are \\d+(st|nd|rd|th) of \\d+ who finished/';
  await page.waitForSelector(rankLine, { timeout: 20000 });
  log('daily summary:', await page.textContent(rankLine));
  await shot(page, 'daily-summary');
  const shareHref = await page.getAttribute('a[href*="/geo/share?s="]', 'href');

  await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-menu-daily]:has-text("You are")', { timeout: 20000 });
  const board = (await page.textContent('[data-menu-daily]')).replace(/\s+/g, ' ');
  log('daily board:', board.slice(0, 160));
  if (!/You are \d+(st|nd|rd|th) of \d+/.test(board)) throw new Error('the board should show your rank');
  await page.waitForSelector('[data-menu-cup]:has-text("Ends")', { timeout: 20000 });
  const cupText = (await page.textContent('[data-menu-cup]')).replace(/\s+/g, ' ');
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
/**
 * The admin backend (app/lib/geo/server/admin.js).
 *
 * The thing worth proving in a browser rather than in a unit test is
 * the refusal: a player who types /geo/admin should be told no and see
 * nothing, and the screen should not render a single figure before the
 * server has agreed. Needs the database, like the leaderboard scenario.
 *
 * It signs in the way a person does, by following a link, because a
 * session minted any other way would not be testing the path that
 * matters.
 */
async function admin(browser) {
  log('\n== admin ==');
  const { PrismaClient } = require('@prisma/client');
  const { createHash, randomUUID } = require('node:crypto');
  const prisma = new PrismaClient();
  const hash = (token) => createHash('sha256').update(`reunitepets-geo-login:${token}`).digest('hex');
  const email = `harness-admin-${Date.now()}@localdev.test`;
  const player = `harness-player-${Date.now()}@localdev.test`;

  const link = async (address) => {
    const token = randomUUID().replace(/-/g, '');
    await prisma.geoLoginToken.create({ data: { tokenHash: hash(token), email: address, expiresAt: new Date(Date.now() + 600000) } });
    return `${BASE}/api/geo/auth/verify?token=${token}`;
  };

  try {
    await prisma.geoAccount.create({ data: { email, role: 'admin' } });
    // A supporter, so the profile's plan card has something to say
    // beyond the default.
    await prisma.geoAccount.create({ data: { email: player, tier: 'supporter' } });

    // An ordinary player is refused, and the page says so rather than
    // rendering an empty dashboard.
    const theirs = await newPage(browser, { width: 1280, height: 900 });
    await theirs.goto(await link(player), { waitUntil: 'domcontentloaded' });
    await theirs.goto(`${BASE}/geo/admin`, { waitUntil: 'domcontentloaded' });
    await theirs.waitForSelector('text=This account is not an admin', { timeout: 20000 });
    if (await theirs.locator('table').count()) throw new Error('a refused player should see no table');
    log('a player is refused and shown why');

    // The same account's profile must not claim a role it does not
    // have. There is no plan card any more: the game is free and has no
    // tiers to name (app/geo/components/AccountRole.js).
    await theirs.goto(`${BASE}/geo/me`, { waitUntil: 'domcontentloaded' });
    await theirs.waitForSelector('[data-badges]', { timeout: 20000 });
    const profileText = (await theirs.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    if (await theirs.locator('[data-account-role]').count()) throw new Error('an ordinary player should be shown no role');
    for (const word of ['Supporter', 'Your plan', 'Street View']) {
      if (profileText.includes(word)) throw new Error(`the profile still says "${word}"`);
    }
    log('an ordinary player sees no plan and no role');
    await theirs.close();

    // The admin gets the real screen.
    const page = await newPage(browser, { width: 1280, height: 900 });
    await page.goto(await link(email), { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/geo/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Accounts', { timeout: 20000 });
    await page.waitForSelector('table', { timeout: 20000 });
    const rows = await page.locator('table tbody tr').count();
    log('admin sees', rows, 'rows');
    if (!rows) throw new Error('the admin screen should list the accounts that exist');
    await shot(page, 'admin');
    if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
    await page.close();
  } finally {
    await prisma.geoLoginToken.deleteMany({ where: { email: { endsWith: '@localdev.test' } } });
    await prisma.geoProfile.deleteMany({ where: { account: { email: { endsWith: '@localdev.test' } } } });
    await prisma.geoAccount.deleteMany({ where: { email: { endsWith: '@localdev.test' } } });
    await prisma.$disconnect();
  }
}

async function profile(browser) {
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=3&seed=e2e-points-1&time=0`, { waitUntil: 'domcontentloaded' });
  await waitPlayable(page);
  await waitForLookAround(page);
  await pinApple(page);
  await page.click('[data-geo-guess]');
  await page.waitForSelector('text=/\\+\\d+ points/', { timeout: 20000 });
  const pointsLine = (await page.evaluate(() => {
    const node = [...document.querySelectorAll('p')].find((el) => /^\+\d+ points/.test(el.innerText.trim()));
    return node ? node.innerText.replace(/\s+/g, ' ').trim() : '';
  }));
  log('round points line:', pointsLine);
  // The line has exactly one of two shapes, and anything else fails.
  // Gating the arithmetic on "if there are parentheses" was the whole
  // weakness of the first version of this check: the rendering it
  // exists to reject - "+12 points +2 round, +10 first of the day" -
  // has no parentheses, so it skipped every assertion and passed.
  //
  //   +12 points                              one award
  //   +12 points (2 round + 10 first of day)  several, and they sum
  const shape = /^\+(\d+) points(?: \(([^)]*)\))?$/.exec(pointsLine);
  if (!shape) throw new Error(`the points line is neither a total nor a total with a breakdown: "${pointsLine}"`);
  const total = Number(shape[1]);
  const breakdown = shape[2] || '';
  // A fresh profile's first scored round earns the round award and the
  // first-of-the-day award, so this one must carry a breakdown. Without
  // this the old rendering would simply fail the shape above and, if
  // somebody dropped the breakdown entirely, pass it.
  if (!breakdown) throw new Error(`the first round of the day earns two awards, so the line should itemise them: "${pointsLine}"`);
  const parts = [...breakdown.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  if (parts.length < 2) throw new Error(`the breakdown should name every award: "${pointsLine}"`);
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum !== total) throw new Error(`the breakdown should sum to the total it breaks down: "${pointsLine}"`);
  // No part carries its own plus: inside the parentheses a '+' is the
  // addition sign between parts, never a fourth award.
  // \s* would have matched the separator itself (" + 10"), so this is
  // a plus glued to a digit, which is what "+2 round" looks like.
  if (/\+\d/.test(breakdown)) throw new Error(`a part inside the breakdown should not carry its own plus: "${pointsLine}"`);
  await page.goto(`${BASE}/geo/me`, { waitUntil: 'domcontentloaded' });
  // The page opens on the record: rating, last games, badges, today.
  // The shop is a tab, because a price list is not what a profile is.
  // Every ladder, with its placement state: the point of the tab is
  // that a player sees where they stand before anything is for sale.
  await page.waitForSelector('[data-ratings] >> text=Ranked solo', { timeout: 30000 });
  const record = (await page.evaluate(() => document.querySelector('[data-ratings]').innerText)).replace(/\s+/g, ' ');
  log('record tab:', record.slice(0, 160));
  // innerText gives back what CSS painted, and the labels are
  // uppercased by a class, so this reads case-insensitively.
  for (const ladder of ['Classic', 'Duel', 'Ranked solo']) {
    if (!new RegExp(ladder, 'i').test(record)) throw new Error(`the record tab should name every ladder, missing ${ladder}`);
  }
  // Badge progress counts countries against countries. This browser
  // has no badges, so all it can check is the shape when there are
  // none.
  const badges = await page.evaluate(() => document.querySelector('[data-badges]')?.innerText.replace(/\s+/g, ' ') || '');
  if (!badges) throw new Error('the record tab should carry the badges card');
  const progress = badges.match(/(\d+) of (\d+) countries/i);
  if (progress) {
    if (Number(progress[1]) > Number(progress[2])) throw new Error(`badge progress cannot exceed its denominator: ${progress[0]}`);
  } else if (!/None yet/i.test(badges)) {
    throw new Error(`a badges card with no progress line should say there are none: ${badges.slice(0, 120)}`);
  }
  log('badges:', badges.slice(0, 80));
  await page.click('[data-profile-tab="shop"]');
  await page.waitForSelector('[data-shop] li', { timeout: 30000 });
  const pins = await page.locator('[data-shop] li').count();
  if (pins < 6) throw new Error(`expected the pins in the shop, saw ${pins}`);
  // Not `header`: the game carries its own bar on every page now, so
  // the first header on this one is the navigation rather than the
  // profile's own. The balance is what this is about, so read the page.
  const headerText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  log('profile page:', headerText.slice(0, 120));
  if (!/\d+\s*points/.test(headerText)) throw new Error('the profile page should show the points balance');
  await page.click('button[role="tab"]:has-text("Title")');
  await page.waitForSelector('[data-shop] li:has-text("Wanderer")', { timeout: 10000 });
  await page.click('[data-profile-tab="settings"]');
  await page.fill('input[aria-label="Your name"]', 'Harness Ada');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('button:has-text("Saved")', { timeout: 10000 });
  await page.waitForSelector('h1:has-text("Harness Ada")', { timeout: 10000 });
  await page.click('[data-profile-tab="record"]');
  await page.waitForSelector('[data-recent]', { timeout: 10000 });
  await shot(page, 'profile');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

// The writing systems the South Asia pool can serve. A round outside
// this set means the chosen pool never reached the game.
const SOUTH_ASIA_SCRIPTS = ['deva', 'beng', 'guru', 'gujr', 'orya', 'taml', 'telu', 'knda', 'mlym', 'sinh', 'arab'];

/**
 * The script game: read a sentence, pin where the language is spoken.
 * The point of the scenario is that the answer is an area, so it checks
 * the reveal really draws the language's heartlands, that the round is
 * played on Apple's map like the rest of the game, and that the map
 * names countries and nothing smaller. No imagery, no meter.
 */
async function script(browser) {
  log('\n== script ==');
  const page = await newPage(browser, { width: 1280, height: 800 });
  // domcontentloaded, not networkidle: the lobby previews a dozen
  // writing systems, and a webfont request that a sandbox blocks hangs
  // until it times out, so "idle" never arrives on a page that is
  // perfectly usable. The selector below is the real readiness signal.
  await page.goto(`${BASE}/geo/script`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1:has-text("Script")', { timeout: 30000 });

  // The lobby renders on the server, so a click can land before React
  // has hydrated and be swallowed. Press until the button says it took:
  // without this the run silently plays the default pool and passes
  // while testing nothing.
  const pool = page.locator('fieldset button:has-text("South Asia")');
  for (let attempt = 0; attempt < 20; attempt++) {
    await pool.click();
    if ((await pool.getAttribute('aria-pressed')) === 'true') break;
    await page.waitForTimeout(250);
  }
  if ((await pool.getAttribute('aria-pressed')) !== 'true') throw new Error('the pool buttons never became interactive');
  await page.click('button:has-text("Play 5 rounds")');
  await page.waitForURL(/\/geo\/script\/play/, { timeout: 30000 });
  if (!page.url().includes('ladder=india')) throw new Error('the chosen pool did not reach the game: ' + page.url());

  await page.waitForSelector('p[lang]', { timeout: 60000 });
  const sentence = await page.locator('p[lang]').first();
  const script = await sentence.getAttribute('lang');
  const drawn = await sentence.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  log('round 1 script:', script, '| sentence width:', drawn);
  // A sentence that rendered as nothing is a broken round, not a hard one.
  if (!drawn) throw new Error('the sample text did not render');
  if (await page.locator('text=no font for this writing system').count()) throw new Error('missing glyphs for ' + script);
  if (!SOUTH_ASIA_SCRIPTS.includes(script)) throw new Error(`the South Asia pool served ${script}`);

  // The round is played on Apple's map. The host div renders before
  // MapKit has built anything into it; a click that lands in between is
  // a click on an empty div, so wait for the map itself.
  await page.waitForSelector('[data-script-map="apple"] [data-fake-mapkit]', { timeout: 30000 });
  // The hint is copy, not a disabled button: a control that tells you
  // what to do should not look broken while it tells you.
  await page.waitForSelector('text=Tap the map where that language is used');

  // A world view carries no names at all. Western Europe cannot hold
  // five of them at that zoom, and naming whichever three happened to
  // win reads as the map choosing at random.
  const atWorldZoom = await page.locator('[data-script-map="apple"] .wg-country-label').count();
  log('country names at world zoom:', atWorldZoom);
  if (atWorldZoom) throw new Error(`the world view drew ${atWorldZoom} country names, and it should draw none`);

  // Zoomed in, they all appear. The map names countries and nothing
  // else: half the South Asia pool is named after the state it is
  // spoken in, so a map that writes "Tamil Nadu" on itself has answered
  // the round before the player has, which is why Apple's own labels
  // are off.
  await page.evaluate(() => window.__fakeZoom(40));
  await page.waitForTimeout(150);
  await page.waitForSelector('[data-script-map="apple"] .wg-country-label', { timeout: 15000 });
  const names = await page.$$eval('[data-script-map="apple"] .wg-country-label', (els) => els.map((el) => el.textContent));
  const appleLabels = await page.evaluate(() => window.__fakeMaps.map((m) => m.labels));
  log('country names drawn:', names.length, '| apple labels:', JSON.stringify(appleLabels));
  if (!names.length) throw new Error('the map wrote no country names');
  if (appleLabels.some((value) => value !== false)) throw new Error("Apple's own place names were left on");
  const foreign = names.filter((name) => !COUNTRY_NAMES.has(name));
  if (foreign.length) throw new Error('the map named something that is not a country: ' + foreign.join(', '));
  // Back out to the world before pinning. The tap conversion in the
  // fake is the plain world mapping, and the distance this click scores
  // is what the rest of the scenario reads.
  await page.evaluate(() => window.__fakeZoom(360));
  // Low on the map: the panels are above it, so a click up there is a
  // click on a panel.
  await page.click('[data-script-map="apple"]', { position: { x: 600, y: 450 } });
  await page.waitForSelector('[data-geo-guess]:not([disabled])', { timeout: 15000 });
  await page.click('[data-geo-guess]');

  await page.waitForSelector('button:has-text("Next round")', { timeout: 30000 });
  const reveal = await page.evaluate(() => document.body.innerText);
  // Every language in the corpus is drawn as the real places it is
  // spoken in, one polygon per piece of land, so counting the polygon
  // overlays counts the regions the reveal drew.
  const shapes = Number(await page.locator('[data-script-map="apple"]').getAttribute('data-fake-polygons'));
  // The reveal teaches, not just scores: the features in the sentence
  // that give the language away, marked in the sentence itself.
  const tells = await page.locator('mark.wg-tell').count();
  const notes = await page.locator('text=What gave it away').count();
  log('what gave it away:', notes, '| features marked in the sentence:', tells);
  if (!notes) throw new Error('the reveal did not say what gave the language away');
  if (!tells) throw new Error('the reveal marked nothing in the sentence');
  log('reveal names a language:', /million speakers/.test(reveal));
  log('regions drawn:', shapes);
  if (!shapes) throw new Error('the reveal drew no regions: the answer is an area, that is the mode');
  if (!/points/.test(reveal)) throw new Error('the reveal showed no score');
  await shot(page, 'script-reveal');

  await page.click('button:has-text("Next round")');
  await page.waitForSelector('p[lang]', { timeout: 30000 });
  const second = await page.locator('p[lang]').first().getAttribute('lang');
  log('round 2 script:', second);
  if (!SOUTH_ASIA_SCRIPTS.includes(second)) throw new Error(`the South Asia pool served ${second}`);

  // Straight to the end: four more rounds, guessing wherever.
  for (let i = 2; i <= 5; i++) {
    await page.waitForSelector('[data-script-map="apple"] [data-fake-mapkit]', { timeout: 30000 });
    await page.click('[data-script-map="apple"]', { position: { x: 400 + i * 20, y: 430 } });
    await page.click('[data-geo-guess]');
    await page.waitForSelector('button:has-text("Next round"), button:has-text("See the results")', { timeout: 30000 });
    await page.click('button:has-text("Next round"), button:has-text("See the results")');
  }
  // "Play again" for fresh content, "Replay this set" for the same one:
  // two different things, and the labels have to say which is which.
  await page.waitForSelector('a:has-text("Play again")', { timeout: 30000 });
  await page.waitForSelector('a:has-text("Replay this set")', { timeout: 10000 });
  const summary = await page.evaluate(() => document.body.innerText);
  log('summary reached:', /out of 25,000 across 5 rounds/.test(summary));
  log('summary lists every round:', await page.locator('ol > li').count());
  // The outcome and the way on come before the recap, at a desktop
  // height: five sentences used to push the next game off the screen.
  const order = await page.evaluate(() => {
    const again = document.querySelector('a[href*="/geo/script/play"]');
    const firstRecap = document.querySelector('ol > li');
    return { againTop: Math.round(again.getBoundingClientRect().top), recapTop: Math.round(firstRecap.getBoundingClientRect().top), viewport: window.innerHeight };
  });
  log('replay at', order.againTop + 'px, recap starts at', order.recapTop + 'px, viewport', order.viewport);
  if (order.againTop >= order.recapTop) throw new Error('the recap comes before the way on');
  if (order.againTop > order.viewport) throw new Error('the replay action is below the first viewport');
  await shot(page, 'script-summary');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

/**
 * The same round with Apple refusing outright, which is what a clone
 * with an empty environment looks like: the origin-locked token this
 * repository ships does not authorize there, and MapKit says so with an
 * error rather than by going quiet. The round has to stay answerable on
 * the game's own keyless map, because a script round with a dead map is
 * a round nobody can finish.
 */
async function scriptFallback(browser) {
  log('\n== scriptFallback ==');
  const page = await newPage(browser, { width: 1280, height: 800 }, { mapkitAuth: 'failed' });
  await page.goto(`${BASE}/geo/script/play?ladder=world&rounds=3&seed=e2e-script-fallback`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('p[lang]', { timeout: 60000 });

  // Leaflet's own class says the map is really there, not just its div.
  await page.waitForSelector('[data-script-map="leaflet"].leaflet-container', { timeout: 30000 });
  if (await page.locator('[data-script-map="apple"]').count()) throw new Error('a refused token still left the Apple map on screen');
  await page.click('[data-script-map="leaflet"]', { position: { x: 600, y: 450 } });
  await page.waitForSelector('[data-geo-guess]:not([disabled])', { timeout: 15000 });
  await page.click('[data-geo-guess]');

  await page.waitForSelector('button:has-text("Next round")', { timeout: 30000 });
  // Leaflet draws every region as an SVG path, so counting paths counts
  // the regions the reveal drew.
  const shapes = await page.locator('[data-script-map="leaflet"] path.leaflet-interactive').count();
  log('regions drawn on the keyless map:', shapes);
  if (!shapes) throw new Error('the fallback map drew no regions');
  const reveal = await page.evaluate(() => document.body.innerText);
  if (!/points/.test(reveal)) throw new Error('the reveal showed no score');
  await shot(page, 'script-fallback-reveal');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

/**
 * An Apple round with the token refused, which is what every player saw
 * on www.reunitepets.org while the apex worked: MapKit loads, the pane
 * is built, and nothing is ever drawn in it. The round has to say so.
 * A blank rectangle that never explains itself is the bug; the error
 * panel naming the host and the token's origin is the fix.
 */
async function appleRefused(browser) {
  log('\n== appleRefused ==');
  const page = await newPage(browser, { width: 1280, height: 800 }, { mapkitAuth: 'failed' });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=3&seed=e2e-apple-refused&time=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Apple Look Around did not load', { timeout: 60000 });
  const text = await page.evaluate(() => document.body.innerText);
  log('refusal shown:', /refused this site's MapKit token/.test(text));
  if (!/refused this site's MapKit token/.test(text)) throw new Error('the round did not say why Apple drew nothing');
  // The point of the message is that it names the fix, so it has to
  // name the host that was refused and the origin the token covers.
  // The host comes from BASE rather than being spelled "localhost":
  // the message names whatever the browser is actually on, so a run
  // against 127.0.0.1 used to fail on a perfectly correct message.
  const host = new URL(BASE).hostname;
  if (!text.includes(host) || !/reunitepets\.org/.test(text)) {
    throw new Error('the refusal named neither the host nor the token origin: ' + text.slice(0, 300));
  }
  await shot(page, 'apple-refused');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}


/**
 * A duel room, two browsers.
 *
 * Classic and duel are different games behind the same lobby - duel
 * starts everyone at 6,000 HP and the round's best guess deals the gap
 * as damage - and only classic had ever been played in a browser. What
 * this checks is the part classic cannot: that the panel counts HP
 * rather than points, that damage lands each round, that the standings
 * are read in HP, and that a finished duel moves the duel ladder.
 *
 * Elimination itself is not driven from here. Damage is the gap between
 * the round's best score and yours, so two browsers clicking blind on
 * the fake map produce a gap of tens of points against 6,000 HP and
 * nobody would ever be knocked out. That path is covered where it can
 * be driven honestly: __tests__/geo/rooms.test.js, "damage, elimination,
 * and the end at the last player standing".
 */
async function duel(browser) {
  const host = await newPage(browser, { width: 1280, height: 800 });
  await host.goto(`${BASE}/geo/rooms`, { waitUntil: 'domcontentloaded' });
  await host.waitForSelector('form[data-ready="1"]', { timeout: 60000 });
  await host.fill('input[placeholder="What the others will see"]', 'Duelist');
  await host.click('button[role="radio"]:has-text("Duel")');
  await host.selectOption('label:has-text("Rounds") select', '3');
  await host.selectOption('label:has-text("Time per round") select', '60');
  await host.click('button:has-text("Open the room")');
  await host.waitForURL(/\/geo\/room\/[A-Z0-9]{6}/, { timeout: 60000 });
  const code = host.url().match(/room\/([A-Z0-9]{6})/)[1];
  await host.waitForSelector('text=Join code', { timeout: 60000 });
  log('duel room opened', code);

  const guest = await newPage(browser, { width: 1280, height: 800 });
  await guest.goto(`${BASE}/geo/rooms`, { waitUntil: 'domcontentloaded' });
  await guest.waitForSelector(`a[href*="/geo/room/${code}"]`, { timeout: 20000 });
  const listed = await guest.evaluate((c) => {
    const row = document.querySelector(`a[href*="/geo/room/${c}"]`)?.closest('li, div');
    return row ? row.innerText.replace(/\s+/g, ' ') : '';
  }, code);
  log('listed as:', listed.slice(0, 100));
  if (!/duel/i.test(listed)) throw new Error('the browser should say a duel room is a duel: ' + listed);

  await guest.goto(`${BASE}/geo/room/${code}`, { waitUntil: 'domcontentloaded' });
  await guest.fill('input[aria-label="Your name"]', 'Second');
  await guest.click('button:has-text("Join")');
  await guest.waitForSelector('text=Waiting for Duelist to start', { timeout: 20000 });
  await host.waitForSelector('text=Second', { timeout: 20000 });

  // The lobby counts everyone in HP, and nobody who has never played a
  // duel is given a tier for turning up.
  const lobby = (await host.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  if (!/6000 HP[\s\S]*6000 HP/.test(lobby)) throw new Error('both duelists should start on 6000 HP: ' + lobby.slice(0, 200));
  if (/\(provisional\)/.test(lobby)) throw new Error('an unplaced player should read Unplaced, not a tier: ' + lobby.slice(0, 200));
  await host.click('button:has-text("Start the game")');

  // In the round the panel counts HP where a classic room counts points.
  for (const p of [host, guest]) await p.waitForSelector('text=Your HP', { timeout: 60000 });

  // Off-centre, so the two browsers do not send the identical pin the
  // fake map gives for the identical click: with no gap between the
  // scores nobody takes damage and the scenario would pass on a duel
  // that never happened.
  const pinAwayFromCentre = async (page) => {
    await page.waitForSelector('[data-fake-mapkit]', { timeout: 20000 });
    const at = await page.evaluate(() => {
      const r = document.querySelector('[data-fake-mapkit]').getBoundingClientRect();
      return { x: Math.round(r.left + r.width * 0.15), y: Math.round(r.top + r.height * 0.15) };
    });
    await page.mouse.click(at.x, at.y);
    await waitGuessable(page);
  };

  // The players panel carries HP through the reveal, where the round
  // HUD does not. Read off the row rather than the page text: the
  // reveal prints a distance in km beside it and a regex over the words
  // happily read 11,716 km as a health bar.
  const hpOf = (page, who) =>
    page.evaluate((name) => {
      const cell = document.querySelector(`[data-player="${name}"][data-player-hp]`);
      return cell ? Number(cell.getAttribute('data-player-hp')) : null;
    }, who);

  let damaged = false;
  for (let round = 1; round <= 3; round++) {
    for (const p of [host, guest]) {
      await p.waitForSelector(`text=Round ${round} of 3`, { timeout: 60000 });
      await waitForLookAround(p);
    }
    await pinApple(host);
    await host.click('[data-geo-guess]');
    await host.waitForSelector('text=Guess locked in', { timeout: 20000 });
    await pinAwayFromCentre(guest);
    await guest.click('[data-geo-guess]');
    for (const p of [host, guest]) await p.waitForSelector('text=/(Next round|Results) in \\d+s/', { timeout: 20000 });
    const hp = { host: await hpOf(host, 'Duelist'), guest: await hpOf(guest, 'Second') };
    log(`duel round ${round}: HP host ${hp.host}, guest ${hp.guest}`);
    for (const [who, value] of Object.entries(hp)) {
      if (!Number.isFinite(value)) throw new Error(`the ${who} panel should show HP, saw ${value}`);
      if (value > DUEL_START_HP) throw new Error(`HP should never go up, ${who} is on ${value}`);
      if (value < DUEL_START_HP) damaged = true;
    }
    const now = host.locator('button:has-text("Now")');
    if (await now.isVisible().catch(() => false)) await now.click({ timeout: 5000 }).catch(() => {});
  }
  // The round's best guess takes none, so exactly one of them being
  // untouched is the expected shape; both untouched means the damage
  // never ran.
  if (!damaged) throw new Error('three rounds of a duel and neither player took damage');

  for (const p of [host, guest]) await p.waitForSelector('text=Final standings', { timeout: 60000 });
  const standings = (await host.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  if (!/\d[\d,]*\s*HP/.test(standings)) throw new Error('duel standings should count HP, not points: ' + standings.slice(0, 200));
  if (!/wins/.test(standings)) throw new Error('duel standings should name a winner');
  log('duel standings:', (standings.match(/Final standings.{0,140}/i) || [''])[0]);
  await shot(host, 'duel-standings');
  await host.waitForSelector('text=/[+-]\\d+ rating/', { timeout: 20000 });
  log('the duel ladder moved');

  // And it is the duel ladder, not classic: the tab has to be the one
  // a duel rates.
  await host.goto(`${BASE}/geo/leaderboard`, { waitUntil: 'domcontentloaded' });
  await host.click('button[role="tab"]:has-text("Duel")');
  await host.waitForSelector('text=/You, Duelist/', { timeout: 20000 });
  log('the duel tab knows the host');
  for (const p of [host, guest]) if (p.errors.length) throw new Error('page errors: ' + p.errors.join(' | '));
  await host.close();
  await guest.close();
}


/**
 * The three formats, enforced rather than described.
 *
 * A format is move/pan/zoom, and the game applies it two ways: the
 * three switches on the Look Around view, and a sheet over the pane
 * for NMPZ so a wheel or a drag or a finger reaches nothing. Only the
 * sheet had ever been checked, and the sheet is the easy half - the
 * switches are what stops a keyboard, a trackpad pinch and MapKit's
 * own controls, and they were being set on a view the harness had not
 * given them to, so the assertion passed on a view nobody had told.
 *
 * Also checks the way out matches: "return to start" is drawn for a
 * format that can leave its start, and not for the one that cannot.
 */
/**
 * A region mode names its region.
 *
 * The pill top left is what you are playing, and its second line read
 * "City streets" for every mode including the two whose whole point is
 * a constraint - so Continent: Europe and Country: Japan were
 * indistinguishable from each other and from the world game.
 */
async function regionPill(browser) {
  for (const [url, want] of [
    ['/geo/play?mode=continent&region=europe&seed=e2e-region-eu', 'Europe'],
    ['/geo/play?mode=country&region=JP&seed=e2e-region-jp', 'Japan'],
  ]) {
    const page = await newPage(browser, { width: 1100, height: 760 });
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await waitPlayable(page);
    const pill = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    if (!pill.includes(want)) throw new Error(`a ${want} round should name it on screen: ${pill.slice(0, 160)}`);
    if (/CONTINENT City streets|COUNTRY City streets/i.test(pill)) {
      throw new Error(`a region mode should name its region, not "City streets": ${pill.slice(0, 160)}`);
    }
    log(`region pill: ${want} named`);
    if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
    await page.close();
  }
}

async function formats(browser) {
  // The view the container actually kept, not the last one built: the
  // pane races candidates and opens a second view for "return to
  // start", so the newest in the list is often one that was discarded.
  const rules = async (page) =>
    page.evaluate(() => {
      const view = document.querySelector('[data-fake-pano]')?.__fakeOwner;
      if (!view) return null;
      return {
        move: view.isNavigationEnabled,
        zoom: view.isZoomEnabled,
        pan: view.isScrollEnabled,
        roadLabels: view.showsRoadLabels,
        pointsOfInterest: view.showsPointsOfInterest,
      };
    });

  const cases = [
    { name: 'Moving', params: 'move=1&pan=1&zoom=1', want: { move: true, pan: true, zoom: true }, sheet: false, canReturn: true },
    { name: 'No Move', params: 'move=0&pan=1&zoom=1', want: { move: false, pan: true, zoom: true }, sheet: false, canReturn: true },
    { name: 'NMPZ', params: 'move=0&pan=0&zoom=0', want: { move: false, pan: false, zoom: false }, sheet: true, canReturn: false },
  ];

  for (const c of cases) {
    const page = await newPage(browser, { width: 1000, height: 760 });
    await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=1&time=0&seed=e2e-format-${c.name}&${c.params}`, { waitUntil: 'domcontentloaded' });
    await waitForLookAround(page);
    // The pane paints the container in the constructor and applies the
    // rules after the view's load event, so the marker is on screen a
    // beat before the format has been applied to anything. Road labels
    // go off for every format, which makes them the signal that the
    // rules have run.
    await page.waitForFunction(() => document.querySelector('[data-fake-pano]')?.__fakeOwner?.showsRoadLabels === false, null, { timeout: 30000 });
    const got = await rules(page);
    if (!got) throw new Error(`${c.name}: no Look Around view on the page to read the rules off`);
    for (const key of ['move', 'pan', 'zoom']) {
      if (got[key] !== c.want[key]) throw new Error(`${c.name}: ${key} should be ${c.want[key]} on the view, it is ${got[key]}`);
    }
    // Street signs and shop names are the answer written down.
    if (got.roadLabels || got.pointsOfInterest) throw new Error(`${c.name}: the imagery should not label the answer`);
    const sheet = Boolean(await page.$('[title="Panning is off for this game"]'));
    if (sheet !== c.sheet) throw new Error(`${c.name}: the blocking sheet should be ${c.sheet ? 'there' : 'absent'}`);
    const back = Boolean(await page.$('button[aria-label="Return to start"]'));
    if (back !== c.canReturn) throw new Error(`${c.name}: "return to start" should be ${c.canReturn ? 'offered' : 'absent'}`);
    log(`${c.name}: view move=${got.move} pan=${got.pan} zoom=${got.zoom}, sheet=${sheet}, return=${back}`);
    if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
    await page.close();
  }
}


/**
 * The menu when a status endpoint will not answer.
 *
 * Every card's status is a claim about the game, and a claim made from
 * a request that has not come back is a false one: the Daily card said
 * "Nobody has finished today." while /api/geo/daily was still in
 * flight or after it failed, and Ranked turned an unanswered board into
 * "0 of 5 placement games played". Neither is true; both look true.
 *
 * So with the two boards refused outright: no status on those cards,
 * and every way in beside them still works, which is the part that
 * matters.
 */
async function menuOffline(browser) {
  const page = await newPage(browser, { width: 1280, height: 900 }, { refuses: ['/api/geo/daily', 'ladder=solo'] });
  await page.route('**/api/geo/daily', (route) => route.abort());
  await page.route('**/api/geo/leaderboard?ladder=solo', (route) => route.abort());
  await page.goto(`${BASE}/geo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-menu-daily]', { timeout: 60000 });
  // Long enough that a status which was going to appear has appeared:
  // the cup and rooms requests beside these two answer in this window.
  await page.waitForSelector('[data-menu-cup]', { timeout: 30000 });
  await page.waitForTimeout(2500);

  for (const [marker, name] of [['data-menu-daily', 'Daily'], ['data-menu-ranked', 'Ranked']]) {
    const text = await page.evaluate((m) => document.querySelector(`[${m}]`).innerText.replace(/\s+/g, ' '), marker);
    for (const claim of ['Nobody has finished', 'finished today', 'placement games', 'rated']) {
      if (text.includes(claim)) throw new Error(`${name} invented "${claim}" from a request that never answered: ${text}`);
    }
    log(`${name} with its board refused: ${text}`);
  }

  // And the way in is still there and still goes somewhere.
  await page.click('[data-menu-daily]');
  await page.waitForURL(/mode=daily/, { timeout: 30000 });
  log('the Daily card still starts a game with its board down');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

/**
 * A timed round that runs out while the tab is in the background.
 *
 * The clock is drawn from an interval, and browsers throttle or suspend
 * intervals in a tab nobody is looking at - so a round whose remaining
 * time is counted down tick by tick quietly gains however long the
 * player was away, and a timed ladder stops being timed. This one is
 * computed from the wall clock each tick, which is the part worth
 * holding: the round is expected to be over when the tab comes back,
 * not to have paused politely.
 */
async function backgrounded(browser) {
  const page = await newPage(browser, { width: 900, height: 700 });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=balanced&rounds=2&seed=e2e-background&time=30`, { waitUntil: 'domcontentloaded' });
  await waitForLookAround(page);
  await waitPlayable(page);
  const clock = () => page.evaluate(() => Number(document.querySelector('[data-geo-clock]')?.getAttribute('data-geo-clock') ?? NaN));
  const started = await clock();
  if (!(started > 0 && started <= 30)) throw new Error(`the round should be counting down from 30, the clock reads ${started}`);
  log(`a 30 second round is on, clock reads ${started}`);

  // A second page takes the foreground, which is what puts the first
  // one under the throttle.
  const front = await browser.newPage();
  await front.goto('about:blank');
  await front.bringToFront();
  const away = Date.now();
  await front.waitForTimeout(40000);
  await front.close();
  await page.bringToFront();
  log(`came back after ${Math.round((Date.now() - away) / 1000)}s`);

  // The round is over: it was scored with no guess, and the game moved
  // on rather than sitting on a clock that owes the player time.
  await page.waitForSelector('text=Out of time.', { timeout: 15000 });
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  if (!/of 5,000/.test(text)) throw new Error('a backgrounded round should have been scored: ' + text.slice(0, 200));
  log('the round expired while the tab was away, and was scored on return');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

/**
 * A whole game from the keyboard, no pointer at all.
 *
 * Placing a pin on a map wants a pointer, so the keyboard-playable game
 * is the country streak: type the country, Enter to pick it, Enter to
 * guess, Enter to go on. This plays two rounds that way and never calls
 * mouse.click, so a regression that makes any step pointer-only fails
 * here rather than in somebody's hands.
 */
async function keyboard(browser) {
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(`${BASE}/geo/play?provider=apple&mode=streak&seed=e2e-keyboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Streak 0', { timeout: 60000 });
  await waitForLookAround(page);

  // Tab from the top of the document until the country field has focus:
  // reaching it at all is the thing being tested, so it is not focused
  // by selector.
  let tabs = 0;
  await page.evaluate(() => document.body.focus());
  while (tabs < 40) {
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '');
    if (label === 'Country') break;
    await page.keyboard.press('Tab');
    tabs += 1;
  }
  if (tabs >= 40) throw new Error('forty tabs and the country field never took focus');
  // The sixty options in the list used to be tabbable, which put the
  // field sixty presses from anywhere and the Guess button sixty past
  // that. The picker is a combobox now and the arrows do that work, so
  // a handful of stops is the budget.
  if (tabs > 10) throw new Error(`the country field should be a few tabs in, it is ${tabs}`);
  log(`the country field is ${tabs} tabs from the top of the round`);

  for (const round of [1, 2]) {
    await page.keyboard.type('Jap');
    await page.waitForSelector('[role="option"], li:has-text("Japan")', { timeout: 10000 }).catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForSelector('button:has-text("Guess 🇯🇵 Japan")', { timeout: 10000 });
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=/Right\\. Streak|Not 🇯🇵 Japan/', { timeout: 20000 });
    const verdict = await page.textContent('text=/Right\\. Streak|Not 🇯🇵 Japan/');
    log(`keyboard round ${round}: ${verdict}`);
    // Space or Enter continues, the same as the button beside it.
    await page.keyboard.press('Enter');
    const over = await page.waitForSelector('text=/Streak of \\d+|Which country is this/', { timeout: 60000 });
    if (/Streak of/.test(await over.textContent())) {
      log('the streak ended on a miss, which is the game');
      break;
    }
    await waitForLookAround(page);
    await page.focus('input[aria-label="Country"]');
  }

  // And out again without a pointer.
  await shot(page, 'keyboard');
  if (page.errors.length) throw new Error('page errors: ' + page.errors.join(' | '));
  await page.close();
}

(async () => {
  const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await chromium.launch(launch);
  try {
    const all = { coldOpen, admin, menuOffline, pinGame, streak, timer, backgrounded, regionPill, formats, keyboard, mobile, rooms, duel, appleSolo, appleRoom, appleRefused, firstRun, daily, ranked, profile, script, scriptFallback };
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
