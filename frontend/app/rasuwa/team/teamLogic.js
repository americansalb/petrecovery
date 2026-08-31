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
    listedKeys.add(key);
    const letters = letterByKey.get(key) || 0;
    const claimants = claimsByKey.get(key) || [];
    return {
      num: p?.num ?? null,
      name: text(p?.name),
      country: text(p?.country),
      home: text(p?.home),
      key,
      letters,
      claimants,
      needsSomeone: letters === 0 && claimants.length === 0,
    };
  });

  const others = [];
  for (const row of letterCounts) {
    const key = normalizePersonKey(row?.personName);
    if (!key || listedKeys.has(key)) continue;
    others.push({ personName: text(row?.personName), records: Number(row?.records) || 0 });
  }

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
