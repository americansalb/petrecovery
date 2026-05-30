// Accessibility audit via axe-core (loaded from CDN, no install). Runs against
// key public pages and reports serious/critical WCAG violations with the exact
// element + fix hint. Usage: node scripts/audit-a11y.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const BASE = process.env.BASE_URL || 'http://localhost:5757';
const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const ROUTES = ['/', '/login', '/register', '/report/new', '/report/found', '/contact', '/database'];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const summary = [];
for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setBypassCSP(true); // audit-only: lets us inject axe-core past the app CSP
  await page.setViewport({ width: 1366, height: 900 });
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 50000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.addScriptTag({ url: AXE });
    const results = await page.evaluate(async () => {
      // Only WCAG A/AA, only serious+critical to cut noise.
      const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
      return r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') || '', html: (v.nodes[0]?.html || '').slice(0, 100) }));
    });
    summary.push({ route, count: results.length, results });
    console.log(`\n=== ${route} — ${results.length} serious/critical ===`);
    for (const v of results) {
      console.log(`  [${v.impact}] ${v.id} (x${v.n}): ${v.help}`);
      console.log(`     e.g. ${v.sample}  ${v.html}`);
    }
  } catch (e) {
    console.log(`\n=== ${route} — ERROR ${e.message.slice(0, 70)} ===`);
  }
  await page.close();
}
console.log('\n----- TOTALS -----');
for (const s of summary) console.log(`${s.count.toString().padStart(3)}  ${s.route}`);
await browser.close();
