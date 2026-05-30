// Sweep public footer-linked pages to find brand drift. Forces opacity:0 visible.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const BASE = process.env.BASE_URL || 'http://localhost:5757';
const DIR = 'C:/Users/18479/Desktop/LOCAL APP TESTING/ReunitePets Local/docs/analysis/sweep';
fs.mkdirSync(DIR, { recursive: true });
const ROUTES = ['/shelters', '/patrol/signup', '/about-sarama', '/contact', '/advice'];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
for (const route of ROUTES) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
  let status = '?';
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });
    status = resp ? resp.status() : '?';
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate(() => document.querySelectorAll('*').forEach((el) => {
      if (getComputedStyle(el).opacity === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
    }));
    const name = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
    console.log(`${route} -> ${status} | ${name}.png`);
  } catch (e) {
    console.log(`${route} -> ERROR ${e.message.slice(0, 80)}`);
  }
}
await browser.close();
