/**
 * The files the search screen (Mission Control) really loads: everything
 * reached by following imports from its page, inside app/mission-control.
 * The folder also keeps older pieces nothing imports, which are not on the
 * screen. Tests that hold the screen to a rule (no text under 13px, no
 * position read on a desk) walk this list, so a file added to the screen
 * is held to the rule without anyone remembering to add it to a test.
 */
const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(FRONTEND, rel), 'utf8');

function reachable(entry = 'app/mission-control/page.js') {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = read(file);
    for (const match of source.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      let target = null;
      if (spec.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      else if (spec.startsWith('@/app/mission-control/')) target = spec.slice(2);
      if (!target || !target.startsWith('app/mission-control/')) continue;
      const hit = [target, `${target}.js`, `${target}/index.js`].find((candidate) => fs.existsSync(path.join(FRONTEND, candidate)) && fs.statSync(path.join(FRONTEND, candidate)).isFile());
      if (hit) queue.push(hit);
    }
  }
  return [...seen].sort();
}

module.exports = { FRONTEND, read, reachable };
