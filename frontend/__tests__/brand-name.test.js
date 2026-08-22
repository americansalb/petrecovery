/**
 * The old name must not reach a person.
 *
 * This site was PetRecovery before it was ReunitePets, and the old name
 * was still going out: seven email footers, four SMS messages, the
 * STOP/START/HELP replies carriers require, the siteName in every search
 * result and social card, and the From name on any email sent over SMTP.
 * Someone who reported a lost dog on reunitepets.org got a text signed
 * "PetRecovery" and had no reason to trust it.
 *
 * Several base-URL fallbacks pointed at https://petrecovery.org too, so
 * with NEXT_PUBLIC_BASE_URL unset every OpenGraph URL, share link and
 * flyer QR code pointed at the wrong domain.
 *
 * Code comments and internal identifiers are not checked - renaming those
 * is churn, and nobody reads them but us. What is checked is anything
 * inside a string literal, which is what ends up in front of a person.
 */

const fs = require('fs');
const path = require('path');

const ROOTS = [
  path.join(__dirname, '..', 'app'),
  path.join(__dirname, '..', 'lib'),
];

// Deliberate survivors. Each is either invisible to people or would
// break something real if renamed.
const ALLOWED = [
  // Identifiers and data keys.
  'PetRecoveryAdvice',
  'listedOnPetRecoveryPlatform',

  // Browser storage keys. Renaming these silently discards whatever the
  // person had saved - their chosen mode, their device id - on their
  // next visit, for no benefit they would ever see.
  'petrecovery_mode',
  'petrecovery_device_id',
  'petrecovery_offline',

  // The seeded accounts blocked from signing in by SEC-18. These strings
  // are matched against real rows; changing them unblocks the accounts.
  'sarama@petrecovery.app',

  // Synthetic address for a guest volunteer, never delivered to.
  '@petrecovery.local',

  // Social handles. Left alone deliberately: the real accounts are the
  // founder's to name, and pointing structured data at profiles we may
  // not own is worse than the old name sitting in a sameAs array.
  'facebook.com/petrecovery',
  'twitter.com/petrecovery',
  'instagram.com/petrecovery',
  "'@petrecovery'",

  // Contact-of-record mailboxes. The SENDING domain is verified as
  // reunitepets.org, so From addresses moved there; these are addresses
  // people write TO, and a verified sending domain says nothing about
  // whether anyone reads mail arriving at it. They move when the founder
  // confirms the inboxes exist, not before - a support address that
  // bounces is worse than one on the old domain that forwards.
  'support@petrecovery.org',
  'data-requests@petrecovery.org',
  'notifications@petrecovery.org',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Lines that are wholly a comment are ignored; everything else is scanned
 * for the old name appearing inside a quoted string or a template literal.
 */
function offendingLines(source) {
  const hits = [];
  source.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    let scanned = line;
    for (const allowed of ALLOWED) scanned = scanned.split(allowed).join('');

    if (!/PetRecovery|petrecovery\.org/i.test(scanned)) return;
    // Only care when it sits inside a string of some kind.
    if (!/['"`]/.test(scanned)) return;

    // support@petrecovery.org is the contact of record and deliberately
    // unchanged: inventing a new mailbox would bounce real mail.
    const withoutSupportMailbox = scanned
      .replace(/[a-z]+@petrecovery\.org/gi, '')
      .replace(/mailto:[a-z]+@petrecovery\.org/gi, '');
    if (!/PetRecovery|petrecovery\.org/i.test(withoutSupportMailbox)) return;

    hits.push(`${i + 1}: ${trimmed.slice(0, 100)}`);
  });
  return hits;
}

describe('the old brand name does not reach people', () => {
  const files = ROOTS.flatMap((root) => walk(root));

  it('scans a sane number of files', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('has no user-facing PetRecovery string anywhere', () => {
    const offenders = [];
    for (const file of files) {
      const hits = offendingLines(fs.readFileSync(file, 'utf8'));
      if (hits.length) {
        offenders.push(`${path.relative(path.join(__dirname, '..'), file)}\n  ${hits.join('\n  ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
