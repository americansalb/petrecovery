// Full-page landing capture. Forces any opacity:0 (Framer-Motion entrance state
// that doesn't fire in headless) to visible so we see the REAL composed page.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const BASE = process.env.BASE_URL || 'http://localhost:5757';
const OUT = process.env.OUT || 'C:/Users/18479/Desktop/LOCAL APP TESTING/ReunitePets Local/docs/analysis/ux-gallery/home-FULL.png';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 140)));
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
// Force every element stuck at opacity:0 (framer initial state) to visible.
await page.evaluate(() => {
  document.querySelectorAll('*').forEach((el) => {
    const o = getComputedStyle(el).opacity;
    if (o === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
  });
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: OUT, fullPage: true });
console.log('FULL home captured ->', OUT, '| errors:', errs.length ? errs.slice(0, 5) : 'none');
await browser.close();
