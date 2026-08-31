#!/usr/bin/env node
/**
 * Regenerates app/rasuwa/congress-directory.json from the public-domain
 * unitedstates/congress-legislators dataset, for the /rasuwa letter tool.
 *
 *   node scripts/build-congress-directory.js
 *   node scripts/build-congress-directory.js --skip-probe   # dataset only
 *
 * Run it when membership changes (elections, resignations, new contact
 * forms), review the diff, and commit the refreshed JSON. The tool
 * bundles this file so the page needs no lookup service at runtime.
 * Validation below fails loudly rather than shipping a short directory.
 *
 * The probe step: the upstream dataset carries contact_form for most
 * senators but almost no House members (435 of 437 were empty), which
 * left step 5 of the tool pointing at member homepages. House sites are
 * near-uniform about serving the constituent form at /contact, so for
 * members without one the script probes {url}/contact and records it
 * when the response looks like a real contact page (HTTP 200 and the
 * final URL still on a contact path, so soft-404 redirects to the
 * homepage do not count). It is a heuristic: review the diff before
 * committing, and spot-check a few links.
 */

const fs = require('fs');
const path = require('path');

const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const OFFICES_URL = 'https://unitedstates.github.io/congress-legislators/legislators-district-offices.json';
const OUT_PATH = path.join(__dirname, '..', 'app', 'rasuwa', 'congress-directory.json');

const PARTY = { Democrat: 'D', Republican: 'R', Independent: 'I' };

// The upstream dataset carries occasional hand-typed URLs ("hhttps://").
// Normalize the fixable, drop the rest; a missing link degrades to the
// member's official site in the UI.
function cleanUrl(value) {
  if (!value) return null;
  const fixed = value.replace(/^h+ttps:\/\//, 'https://');
  return fixed.startsWith('https://') ? fixed : null;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

/**
 * True when {siteUrl}/contact answers like a real contact page: HTTP 200
 * with the final URL (after redirects) still on a contact-ish path. A
 * soft 404 that redirects to the homepage fails the path check.
 */
async function probeContactPage(siteUrl) {
  const base = siteUrl.replace(/\/+$/, '');
  const candidate = `${base}/contact`;
  try {
    const res = await fetch(candidate, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'reunitepets-rasuwa-directory-build (contact page check)' },
    });
    if (!res.ok) return null;
    const finalPath = new URL(res.url || candidate).pathname.toLowerCase();
    return finalPath.includes('contact') ? candidate : null;
  } catch {
    return null;
  }
}

/** Fill missing contactForm links by probing {url}/contact, a few at a time. */
async function probeMissingContactForms(members) {
  const targets = members.filter((m) => !m.contactForm && m.url);
  let found = 0;
  let done = 0;
  const CONCURRENCY = 8;
  const queue = [...targets];
  async function worker() {
    for (;;) {
      const m = queue.shift();
      if (!m) return;
      const hit = await probeContactPage(m.url);
      if (hit) {
        m.contactForm = hit;
        found++;
      }
      done++;
      if (done % 50 === 0) console.log(`  probed ${done}/${targets.length} (${found} found)`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Contact-page probe: ${found} of ${targets.length} members without a dataset link now have one.`);
}

async function main() {
  const [legislators, officesRaw] = await Promise.all([getJson(LEGISLATORS_URL), getJson(OFFICES_URL)]);

  const officesByBioguide = new Map(officesRaw.map((o) => [o.id.bioguide, o.offices || []]));

  const members = legislators.map((m) => {
    const t = m.terms[m.terms.length - 1];
    const bioguide = m.id.bioguide;
    const offices = (officesByBioguide.get(bioguide) || [])
      .filter((o) => o.phone)
      .slice(0, 4)
      .map((o) => {
        const office = { city: o.city, phone: o.phone };
        if (o.fax) office.fax = o.fax;
        return office;
      });
    return {
      bioguide,
      name: m.name.official_full || `${m.name.first} ${m.name.last}`,
      chamber: t.type, // 'sen' | 'rep'
      state: t.state,
      district: t.type === 'rep' ? t.district : null,
      party: PARTY[t.party] || (t.party || '?')[0],
      phone: t.phone || '',
      url: cleanUrl(t.url) || '',
      contactForm: cleanUrl(t.contact_form),
      offices,
    };
  });

  if (!process.argv.includes('--skip-probe')) {
    await probeMissingContactForms(members);
  }

  members.sort((a, b) =>
    a.state.localeCompare(b.state) ||
    a.chamber.localeCompare(b.chamber) ||
    (a.district ?? -1) - (b.district ?? -1) ||
    a.name.localeCompare(b.name)
  );

  const sens = members.filter((m) => m.chamber === 'sen');
  const reps = members.filter((m) => m.chamber === 'rep');
  const senStates = new Map();
  for (const s of sens) senStates.set(s.state, (senStates.get(s.state) || 0) + 1);

  const problems = [];
  if (sens.length !== 100) problems.push(`expected 100 senators, got ${sens.length}`);
  if (senStates.size !== 50 || [...senStates.values()].some((v) => v !== 2)) {
    problems.push('senator count per state is off');
  }
  if (reps.length < 435) problems.push(`expected at least 435 House members, got ${reps.length}`);
  for (const m of members) {
    if (!/^\d{3}-\d{3}-\d{4}$/.test(m.phone)) problems.push(`bad phone for ${m.name}: ${m.phone}`);
    if (m.url && !m.url.startsWith('https://')) problems.push(`bad url for ${m.name}: ${m.url}`);
  }
  if (problems.length) {
    console.error('Refusing to write congress-directory.json:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const out = {
    congress: 119,
    updated: new Date().toISOString().slice(0, 10),
    source: 'https://github.com/unitedstates/congress-legislators (public domain)',
    members,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(`Wrote ${OUT_PATH}: ${sens.length} senators, ${reps.length} House members.`);
  console.log('If the sitting congress has changed, update the hardcoded congress number here.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
