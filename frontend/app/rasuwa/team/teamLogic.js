/**
 * Pure logic for the family task force board, shared by the API routes
 * and the client so validation and the claim rules cannot drift apart.
 * No imports, no storage: everything here is testable with plain data.
 */

/** What a post or need may hold; the routes clip, never reject, length. */
export const TEAM_CAPS = {
  name: 80,
  postBody: 2000,
  needTitle: 160,
  needDetail: 1000,
};

export const POST_KINDS = ['message', 'update'];
export const NEED_STATUSES = ['OPEN', 'CLAIMED', 'DONE'];
export const NEED_ACTIONS = ['claim', 'release', 'done', 'reopen'];

const text = (v) => (typeof v === 'string' ? v : '');
const clip = (v, max) => text(v).replace(/\s+/g, ' ').trim().slice(0, max);
const clipBlock = (v, max) => text(v).replace(/\r\n/g, '\n').trim().slice(0, max);

/** The name a person typed for themselves, folded and capped. */
export function cleanTeamName(name) {
  return clip(name, TEAM_CAPS.name);
}

/** A postable post, or null when there is nothing to post. */
export function cleanTeamPost({ author, body, kind } = {}) {
  const cleanKind = POST_KINDS.includes(kind) ? kind : 'message';
  const cleanAuthor = clip(author, TEAM_CAPS.name);
  const cleanBody = clipBlock(body, TEAM_CAPS.postBody);
  if (!cleanAuthor || !cleanBody) return null;
  return { author: cleanAuthor, body: cleanBody, kind: cleanKind };
}

/** A creatable need, or null when there is nothing to create. */
export function cleanTeamNeed({ author, title, detail } = {}) {
  const createdBy = clip(author, TEAM_CAPS.name);
  const cleanTitle = clip(title, TEAM_CAPS.needTitle);
  const cleanDetail = clipBlock(detail, TEAM_CAPS.needDetail);
  if (!createdBy || !cleanTitle) return null;
  return { createdBy, title: cleanTitle, detail: cleanDetail };
}

/**
 * How one need looks to one named person: which of OPEN, mine, held by
 * someone else, done it is, and which actions make sense from there.
 * The server enforces the same transitions atomically; this drives the
 * buttons.
 */
export function needView(need, myName) {
  const status = NEED_STATUSES.includes(need?.status) ? need.status : 'OPEN';
  const me = clip(myName, TEAM_CAPS.name);
  const holder = text(need?.claimedBy);
  const mine = status === 'CLAIMED' && holder !== '' && holder === me;
  return {
    status,
    holder,
    mine,
    open: status === 'OPEN',
    held: status === 'CLAIMED' && !mine,
    done: status === 'DONE',
    actions:
      status === 'OPEN' ? ['claim', 'done']
      : status === 'CLAIMED' ? (mine ? ['done', 'release'] : ['done'])
      : ['reopen'],
  };
}

/**
 * One stable key per missing person, tolerant of the ways the same name
 * gets typed: case, extra spaces, and combining diacritics all fold
 * away, so a letter recorded for "Śrestha" matches the list's
 * "Srestha".
 */
export function normalizePersonKey(name) {
  return text(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every key that means one listed person: the canonical name key plus
 * any earlier printed names (`aka`), looked up by any of them. Claim
 * and release must act on the whole set, or a claim stored under an
 * old name becomes unreleasable after a rename (review finding on
 * PR #228).
 */
export function personKeySets(people) {
  const byAnyKey = new Map();
  for (const p of people || []) {
    const canonical = normalizePersonKey(p?.name);
    if (!canonical) continue;
    const keys = [canonical];
    for (const alias of Array.isArray(p?.aka) ? p.aka : []) {
      const k = normalizePersonKey(alias);
      if (k && !keys.includes(k)) keys.push(k);
    }
    for (const k of keys) byAnyKey.set(k, { canonical, keys });
  }
  return byAnyKey;
}

/**
 * The coverage wall: every person on the list of the missing, with how
 * many letters the record holds for them and who on the board has said
 * "I'll write for them". Letters recorded under names not on the list
 * are kept visible in `others` rather than silently dropped.
 *
 * people:       missing-people.json's people array
 * letterCounts: [{ personName, records }] from the letter record
 * claims:       [{ personKey, claimedBy }]
 */
export function buildCoverage({ people = [], letterCounts = [], claims = [] } = {}) {
  const letterByKey = new Map();
  for (const row of letterCounts) {
    const key = normalizePersonKey(row?.personName);
    if (!key) continue;
    letterByKey.set(key, (letterByKey.get(key) || 0) + (Number(row?.records) || 0));
  }
  const claimsByKey = new Map();
  for (const claim of claims) {
    const key = normalizePersonKey(claim?.personKey);
    const by = clip(claim?.claimedBy, TEAM_CAPS.name);
    if (!key || !by) continue;
    if (!claimsByKey.has(key)) claimsByKey.set(key, []);
    if (!claimsByKey.get(key).includes(by)) claimsByKey.get(key).push(by);
  }

  const listedKeys = new Set();
  const covered = people.map((p) => {
    const key = normalizePersonKey(p?.name);
    // The live letter renames people as families correct entries
    // ("Poonam Thakkar" became "Poonam Dilipkumar Thakkar"), so a
    // person may carry `aka`: earlier printed names whose recorded
    // letters and claims still belong to them.
    const akaKeys = (Array.isArray(p?.aka) ? p.aka : [])
      .map(normalizePersonKey)
      .filter((k) => k && k !== key);
    const keys = [key, ...akaKeys];
    let letters = 0;
    const claimants = [];
    for (const k of keys) {
      listedKeys.add(k);
      letters += letterByKey.get(k) || 0;
      for (const by of claimsByKey.get(k) || []) {
        if (!claimants.includes(by)) claimants.push(by);
      }
    }
    return {
      num: p?.num ?? null,
      name: text(p?.name),
      country: text(p?.country),
      home: text(p?.home),
      key,
      keys,
      letters,
      claimants,
      needsSomeone: letters === 0 && claimants.length === 0,
    };
  });

  // One flat alphabetical wall: no nationality grouping, nobody first
  // (founder rule, 2026-08-31).
  covered.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const others = [];
  for (const row of letterCounts) {
    const key = normalizePersonKey(row?.personName);
    if (!key || listedKeys.has(key)) continue;
    others.push({ personName: text(row?.personName), records: Number(row?.records) || 0 });
  }
  others.sort((a, b) => a.personName.localeCompare(b.personName, 'en', { sensitivity: 'base' }));

  return {
    people: covered,
    others,
    totals: {
      people: covered.length,
      withLetters: covered.filter((p) => p.letters > 0).length,
      needSomeone: covered.filter((p) => p.needsSomeone).length,
    },
  };
}

/**
 * Per-office tallies from the letter record's recipients strings
 * ("sen Richard J. Durbin; rep Jonathan L. Jackson"): which offices
 * have letters for each person, each counted separately. Chamber codes
 * become the titles people know; junk rows fall away.
 */
const CHAMBER_TITLES = { sen: 'Senator', rep: 'Representative', mp: 'MP' };

/**
 * One readable office label per letter in a record's recipients
 * string. Case-insensitive with an optional period so stored variants
 * of the same office ("sen X", "Sen. X") fold into one count; a full
 * word like "Senator X" is left as written.
 */
function recipientLabels(recipients) {
  const labels = [];
  for (const entry of text(recipients).split(';')) {
    const raw = entry.trim();
    if (!raw) continue;
    const m = raw.match(/^(sen|rep|mp)\.?\s+(.+)$/i);
    labels.push(m ? `${CHAMBER_TITLES[m[1].toLowerCase()]} ${m[2]}` : raw);
  }
  return labels;
}

export function aggregateRecipientCounts(rows) {
  const letterCounts = new Map();
  const offices = new Map();
  for (const row of rows || []) {
    const personName = text(row?.personName);
    const key = normalizePersonKey(personName);
    if (!key) continue;
    if (!letterCounts.has(key)) letterCounts.set(key, { personName, records: 0 });
    letterCounts.get(key).records += 1;
    if (!offices.has(key)) offices.set(key, new Map());
    const perOffice = offices.get(key);
    for (const label of recipientLabels(row?.recipients)) {
      perOffice.set(label, (perOffice.get(label) || 0) + 1);
    }
  }
  const officesByKey = {};
  for (const [key, perOffice] of offices) {
    officesByKey[key] = [...perOffice.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }
  return { letterCounts: [...letterCounts.values()], officesByKey };
}

/**
 * The campaign's collective numbers for the public chart. Every
 * recipient entry in a record is one letter to one office. Letters
 * recorded under a generic label (international letters addressed to
 * "parliament or consular officer") count as letters and count once
 * among offices, but stay out of the most-written list, which only
 * names offices a caller could actually ring. Distinct-office counts
 * are therefore a floor, never an overclaim.
 */
const GENERIC_RECIPIENTS = new Set(['parliament or consular officer', 'recipient']);
const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizeRecords(rows, now = Date.now()) {
  const officeCounts = new Map();
  let records = 0;
  let letters = 0;
  let last24h = 0;
  for (const row of rows || []) {
    records += 1;
    const labels = recipientLabels(row?.recipients);
    letters += labels.length;
    const at = new Date(row?.createdAt ?? 0).getTime();
    if (Number.isFinite(at) && now - at <= DAY_MS) last24h += labels.length;
    for (const label of labels) {
      officeCounts.set(label, (officeCounts.get(label) || 0) + 1);
    }
  }
  const named = [];
  for (const [name, count] of officeCounts) {
    if (!GENERIC_RECIPIENTS.has(name)) named.push({ name, count });
  }
  named.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    records,
    letters,
    offices: officeCounts.size,
    last24h,
    topOffices: named.slice(0, 6),
  };
}

/**
 * The public face of the coverage wall (/rasuwa/progress): the same
 * per-person letter counts, but claimant names reduced to a count.
 * Team members' names stay inside the code-gated board.
 */
export function coverageForPublic(coverage, officesByKey = {}) {
  const src = coverage && typeof coverage === 'object' ? coverage : {};
  return {
    people: (src.people || []).map((p) => {
      // Offices recorded under any of the person's names (see `aka`
      // in buildCoverage) merge into one per-office tally.
      const merged = new Map();
      for (const k of Array.isArray(p.keys) ? p.keys : [p.key]) {
        for (const o of Array.isArray(officesByKey[k]) ? officesByKey[k] : []) {
          merged.set(o.name, (merged.get(o.name) || 0) + (Number(o.count) || 0));
        }
      }
      const offices = [...merged.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      return {
        num: p.num ?? null,
        name: text(p.name),
        country: text(p.country),
        letters: Number(p.letters) || 0,
        writing: Array.isArray(p.claimants) ? p.claimants.length : 0,
        needsSomeone: Boolean(p.needsSomeone),
        offices,
      };
    }),
    totals: src.totals || { people: 0, withLetters: 0, needSomeone: 0 },
  };
}

/** "just now", "4 min ago", "2 h ago", "Aug 30" for board timestamps. */
export function timeAgo(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
