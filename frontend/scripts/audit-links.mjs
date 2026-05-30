// Dead internal-link audit. Extracts every static href="/..." across app/**/*.js,
// then probes each against the running dev server. Reports only broken targets
// (404/500). 200/301/302/307/308 are healthy (307/308 = protected redirect).
// Usage: node scripts/audit-links.mjs   (dev server must be up; BASE_URL overrides)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5757';
const ROOT = 'app';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const hrefs = new Set();
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/href="(\/[a-zA-Z0-9/_-]*)"/g)) {
    const t = m[1];
    if (!t.startsWith('/api') && !t.includes('[')) hrefs.add(t);
  }
}
const targets = [...hrefs].sort();
console.log(`Probing ${targets.length} unique internal link targets against ${BASE}\n`);

let broken = 0;
for (const path of targets) {
  let code = 'ERR';
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    code = res.status;
  } catch { code = 'ERR'; }
  if (code === 404 || code === 500 || code === 'ERR') {
    console.log(`  ${code}  ${path}`);
    broken++;
  }
}
console.log(`\n${broken === 0 ? '✓ No dead links.' : `✗ ${broken} dead link(s) above.`}`);
process.exit(broken === 0 ? 0 : 1);
