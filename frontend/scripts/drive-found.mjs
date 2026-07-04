// Drives the FOUND wizard and screenshots each step, so the multi-step UX can be
// observed (not just step 1). Best-effort: clicks by visible button text.
//
// New wizard sequence (app/report/found/page.js):
//   species → where (map, "Use my location" → "Confirm this spot") → when →
//   photo (skippable) → colors → tag details → contact → review.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5757'; // project dev runs on :5757
const OUT = path.resolve(process.cwd(), '../docs/analysis/screenshots');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));

async function clickByText(page, text) {
  const handle = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll('button, a, [role=button]')];
    return els.find((e) => e.innerText && e.innerText.trim().toLowerCase().includes(t.toLowerCase())) || null;
  }, text);
  const el = handle.asElement();
  if (el) { await el.click(); return true; }
  return false;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(BASE, ['geolocation']);
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
await page.setGeolocation({ latitude: 37.7749, longitude: -122.4194, accuracy: 50 });

async function shot(name) {
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, `found-flow-${name}.png`), fullPage: true });
  console.log('  shot', name);
}

await page.goto(`${BASE}/report/found`, { waitUntil: 'networkidle2', timeout: 60000 });
await shot('1-species');

if (await clickByText(page, 'Dog')) await shot('2-where');
if (await clickByText(page, 'Use my location')) await shot('3-pin');
if (await clickByText(page, 'Confirm this spot')) await shot('4-when');
if (await clickByText(page, 'Just now')) await shot('5-photo');
if (await clickByText(page, "I can't take a photo right now")) await shot('6-colors');
if (await clickByText(page, 'Black')) { /* pick a color chip */ }
if (await clickByText(page, 'Continue')) await shot('7-details');
if (await clickByText(page, 'Nothing to add')) await shot('8-contact');

await browser.close();
console.log('Done.');
