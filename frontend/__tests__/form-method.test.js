/**
 * Every form must declare method="post".
 *
 * A <form> with an onSubmit handler and no method attribute defaults to
 * method="get". React only intercepts the submit once the page has
 * hydrated. Submit before that - slow connection, a JS chunk that 404s,
 * someone hitting Enter the moment the fields paint - and the browser
 * does its own GET, serialising every field into the query string.
 *
 * On /login that means the URL becomes
 *
 *   /login?email=victim@example.com&password=SuperSecret123
 *
 * which lands in browser history, in the server access log, and in the
 * Referer header of the next outbound request. Reproduced with a real
 * browser (JS blocked) before this test was written.
 *
 * method="post" costs nothing: React still handles the submit normally
 * once hydrated, and a pre-hydration submit POSTs to the same route
 * instead, so the fields stay in the request body. Next.js renders the
 * page for a POST to a page route, so the visitor just sees the form
 * again rather than a leaked URL.
 *
 * Static source check, same shape as link-previews.test.js.
 */

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'app');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Returns the opening tag text for every <form ...> in the source, so a
 * form whose attributes span several lines is still checked as one unit.
 */
function formOpenTags(source) {
  const tags = [];
  const re = /<form(\s|>)/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const end = source.indexOf('>', match.index);
    tags.push(source.slice(match.index, end === -1 ? source.length : end + 1));
  }
  return tags;
}

describe('forms declare method="post"', () => {
  const files = walk(APP_DIR);

  it('finds forms to check (guards against the walk silently breaking)', () => {
    const total = files.reduce((n, f) => n + formOpenTags(fs.readFileSync(f, 'utf8')).length, 0);
    expect(total).toBeGreaterThan(20);
  });

  it('has no form that would GET its fields into the URL', () => {
    const offenders = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of formOpenTags(source)) {
        if (/\bmethod\s*=/.test(tag)) continue;
        const line = source.slice(0, source.indexOf(tag)).split('\n').length;
        offenders.push(`${path.relative(APP_DIR, file)}:${line}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
