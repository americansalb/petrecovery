import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5757';
const OUT = path.resolve(process.cwd(), '../docs/analysis/screenshots');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url().slice(0, 80) + ' — ' + (r.failure()?.errorText || '')));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

const probe = await page.evaluate(() => {
  const h1 = document.querySelector('h1');
  const img = document.querySelector('section img');
  const cs = h1 ? getComputedStyle(h1) : null;
  return {
    h1Text: h1 ? h1.innerText.slice(0, 80) : '(no h1)',
    h1Opacity: cs ? cs.opacity : null,
    h1Visibility: cs ? cs.visibility : null,
    h1Rect: h1 ? h1.getBoundingClientRect().toJSON() : null,
    heroImgSrc: img ? img.getAttribute('src')?.slice(0, 60) : '(no img)',
    heroImgComplete: img ? img.complete : null,
    heroImgNaturalW: img ? img.naturalWidth : null,
    bodyText: document.body.innerText.slice(0, 200),
  };
});

await page.screenshot({ path: path.join(OUT, 'home__viewport.png'), fullPage: false });
console.log(JSON.stringify({ probe, errors: errors.slice(0, 15) }, null, 2));
await browser.close();
