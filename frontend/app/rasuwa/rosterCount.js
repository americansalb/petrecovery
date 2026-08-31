/**
 * The live signer count for the /rasuwa landing pages.
 *
 * The joint letter was sent on August 29 with SIGNERS_AUG29 signatures,
 * and the roster has kept growing since; a landing page frozen at the
 * sent number undersells the movement. The count comes from the
 * organizers' roster (see ROSTER_COUNT_URL in letterData.js) through
 * /api/rasuwa/roster-count; when the live source is missing or answers
 * nonsense, the pages say "More than 1,189", which stays true.
 *
 * Pure logic lives here so it is testable and shared by the API route
 * and the SignerCount client component.
 */

import { SIGNERS_AUG29 } from './letterData';

// A live count below the sent letter's signatures or absurdly high is
// a misconfigured source, not news; the floor stays truthful.
const MAX_BELIEVABLE = 5000000;

/**
 * Raw response text from the count source into a usable number, or
 * null. Accepts a bare integer ("2345") or JSON with a numeric count
 * field ({"count": 2345} / {"count": "2345"}).
 */
export function parseRosterCount(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let value = null;
  if (/^\d{1,9}$/.test(text)) {
    value = Number(text);
  } else {
    try {
      const parsed = JSON.parse(text);
      const c = parsed && typeof parsed === 'object' ? parsed.count : null;
      if (typeof c === 'number') value = c;
      else if (typeof c === 'string' && /^\d{1,9}$/.test(c.trim())) value = Number(c.trim());
    } catch {
      return null;
    }
  }
  if (value === null || !Number.isInteger(value)) return null;
  if (value < SIGNERS_AUG29 || value > MAX_BELIEVABLE) return null;
  return value;
}

/**
 * The lead sentence on the landing pages. It fronts the living campaign,
 * not the delivery date: the roster keeps growing and the pages must
 * read that way. live=false means the number is the August 29 floor, so
 * it reads "More than".
 */
export function signerCountSentence({ count, live }) {
  const n = (live && count ? count : SIGNERS_AUG29).toLocaleString('en-US');
  const who = `family members and friends of the people missing in the Rasuwa flood have signed the families' letter to the U.S. Secretary of State.`;
  return live && count ? `${n} ${who}` : `More than ${n} ${who}`;
}
