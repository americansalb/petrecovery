#!/usr/bin/env node
/**
 * Ask Apple which hosts this site's MapKit token actually works on.
 *
 * Every other check in this repository can be answered from the source.
 * This one cannot: a MapKit token carries one origin, Apple matches it
 * exactly, and a refused token does not throw, log, or fail to load. It
 * loads, the map is built, and no tile ever arrives. So the only honest
 * check is to hand the token to Apple with an Origin header and read
 * the status code.
 *
 * That is not hypothetical. On 2026-09-14 every Apple surface on the
 * live site was blank: the token was minted for reunitepets.org, the
 * apex redirects to www.reunitepets.org, and Apple answered 401 to
 * every request a real player made. The apex answered 200 the whole
 * time, which is why it survived every test anyone ran.
 *
 * Usage, from frontend/:
 *
 *   node scripts/check-mapkit-token.js
 *   node scripts/check-mapkit-token.js www.example.org example.org
 *   NEXT_PUBLIC_APPLE_MAPKIT_TOKEN='tokenA tokenB' node scripts/check-mapkit-token.js
 *
 * Exits non-zero if any host is refused, so it can gate a deploy.
 */

const fs = require('node:fs');
const path = require('node:path');

const BOOTSTRAP = 'https://cdn.apple-mapkit.com/ma/bootstrap?apiVersion=2&mkjsVersion=5.79.0&poi=1';
const SOURCE = path.join(__dirname, '..', 'app', 'geo', 'lib', 'appleMapKit.js');

/** The tokens the browser would be given: the env list, or the literal. */
function tokens() {
  const fromEnv = (process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN || '').split(/[\s,]+/).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const src = fs.readFileSync(SOURCE, 'utf8');
  const literal = src.match(/const FALLBACK_TOKEN =\s*'([^']+)'/);
  if (!literal) throw new Error(`No token found in ${SOURCE} and none in NEXT_PUBLIC_APPLE_MAPKIT_TOKEN`);
  return [literal[1]];
}

function originOf(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).origin || '';
  } catch {
    return '';
  }
}

/**
 * The hosts worth asking about: whatever was named on the command line,
 * or the hosts the site answers on plus whatever the tokens claim. The
 * canonical host is the one that matters, because it is where the
 * redirects land every player.
 */
function hosts(list, minted) {
  if (list.length) return list;
  const canonical = (process.env.NEXT_PUBLIC_GEO_HOME_URL || 'https://www.reunitepets.org').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const domains = (process.env.GEO_DOMAINS || '').split(',').map((d) => d.trim()).filter(Boolean);
  return [...new Set([canonical, ...domains, ...minted])];
}

async function check(token, host) {
  const response = await fetch(BOOTSTRAP, {
    headers: { Authorization: `Bearer ${token}`, Origin: `https://${host}`, Referer: `https://${host}/` },
  });
  return response.status;
}

(async () => {
  const list = tokens();
  const minted = list.map(originOf).filter(Boolean);
  process.stdout.write(`${list.length} token(s), minted for: ${minted.join(', ') || '(any origin)'}\n\n`);

  let refused = 0;
  for (const host of hosts(process.argv.slice(2), minted)) {
    // The same rule the browser uses: the token whose origin matches,
    // then one minted for no origin, then the first (app/geo/lib/appleMapKit.js).
    const token = list.find((t) => originOf(t) === host) || list.find((t) => !originOf(t)) || list[0];
    let status;
    try {
      status = await check(token, host);
    } catch (error) {
      process.stdout.write(`  ${host.padEnd(28)} could not reach Apple: ${error.message}\n`);
      continue;
    }
    const ok = status === 200;
    if (!ok) refused += 1;
    process.stdout.write(`  ${host.padEnd(28)} ${status} ${ok ? 'authorized' : 'REFUSED'}\n`);
  }

  if (refused) {
    process.stdout.write(
      '\nApple refuses at least one host this site serves, so Look Around, the Apple guess map\n' +
        'and Apple rooms draw nothing there. Mint a token for that exact host in the Apple\n' +
        'developer portal and add it to NEXT_PUBLIC_APPLE_MAPKIT_TOKEN, which takes a list;\n' +
        'or stop redirecting to a host no token covers.\n'
    );
    process.exit(1);
  }
  process.stdout.write('\nEvery host is authorized.\n');
})();
