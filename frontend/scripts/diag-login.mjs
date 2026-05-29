import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const BASE = 'http://localhost:3000';
const EMAIL = process.env.LOGIN_EMAIL || 'contact@aalb.org';
const PW = process.env.LOGIN_PASSWORD || 'winner';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
page.on('response', (r) => { if (r.url().includes('/api/auth')) errs.push('AUTH ' + r.status() + ' ' + r.url().replace(BASE, '')); });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.type('input[type=email], input[name=email]', EMAIL);
await page.type('input[type=password], input[name=password]', PW);
await page.click('button[type=submit]');
await new Promise((r) => setTimeout(r, 4000));

const cookies = await page.cookies();
const sessionCookie = cookies.find((c) => /next-auth|session-token|authjs/i.test(c.name));
const onPage = await page.evaluate(() => ({
  url: location.pathname,
  errText: (document.body.innerText.match(/invalid|incorrect|error|failed|wrong/i) || [])[0] || null,
  bodyStart: document.body.innerText.slice(0, 120).replace(/\n/g, ' '),
}));
console.log(JSON.stringify({ onPage, sessionCookie: sessionCookie ? sessionCookie.name : '(none)', authEvents: errs.slice(0, 8) }, null, 2));
await browser.close();
