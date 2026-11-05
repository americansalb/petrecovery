/**
 * The short link to a case, the one printed on the flyers:
 * reunitepets.org/p/HF27J2.
 *
 * A stranger on the street has to type it, so it is the site's domain and
 * the case number's suffix: the six characters caseNumber.js draws from an
 * alphabet with no 0/O, 1/I/L or U. The QR code beside it carries the
 * canonical case URL (cascade/render/qr.js); this is the line for people.
 *
 * GET /p/:code (app/p/[code]/route.js) looks the suffix up and sends the
 * visitor to /cases/:caseNumber. The suffix is unique in practice (thirty
 * to the sixth per city and year) but not by schema, so the route prefers
 * the open case when two ever share one.
 */

import { SITE_DOMAIN } from './brand';
import { getBaseUrl } from './config';

export const SHORT_PATH = '/p';

/** "MUN-2026-HF27J2" -> "HF27J2"; "AUS-2026-0001" -> "0001"; no hyphen: the whole number. */
export function caseShortCode(caseNumber) {
  const s = String(caseNumber || '').trim();
  const i = s.lastIndexOf('-');
  return (i >= 0 ? s.slice(i + 1) : s).toUpperCase();
}

/** A code someone typed: letters and digits, three to twelve of them. */
export function isShortCode(code) {
  return /^[A-Z0-9]{3,12}$/i.test(String(code || ''));
}

/** The absolute short link, for anything that needs a URL. */
export function caseShortUrl(caseNumber) {
  return `${getBaseUrl()}${SHORT_PATH}/${caseShortCode(caseNumber)}`;
}

/** The line printed on paper: "reunitepets.org/p/HF27J2". */
export function caseShortLabel(caseNumber) {
  return `${SITE_DOMAIN}${SHORT_PATH}/${caseShortCode(caseNumber)}`;
}
