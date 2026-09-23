/**
 * A short place name for a last-seen address: "Orlando, FL".
 *
 * Addresses arrive in whatever shape the geocoder that answered gave
 * back. Nominatim's are long and end in a postcode and the country
 * ("13107, Southeast 169th Avenue, Happy Valley, Clackamas County,
 * Oregon, 97086, United States"); Apple's and typed ones are short
 * ("Walmart, 3838 South Semoran Boulevard, Orlando, Florida"). The public
 * case list used to take the last two comma parts as the city and the
 * first two letters of the state, which printed "97086, UN" and
 * "Philadelphia, PE" on nearly every real report, in page titles and in
 * every link preview.
 *
 * So this reads an address from the right: drop the country and the
 * postcode, find the state, then walk left past the county and township
 * to the town. Anything it cannot place returns null, and callers show
 * PIN_ONLY_LABEL or nothing rather than a guess.
 */

import { STATE_ABBR } from '@/app/lib/usStates';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';

const US_COUNTRY = /^(united states( of america)?|usa|u\.?s\.?a?\.?)$/i;
const POSTCODE = /^\d{3,6}(-\d{4})?$/;
const STATE_THEN_ZIP = /^([a-z .]+?)\s+\d{5}(-\d{4})?$/i;
const ADMIN_AREA = /\b(county|township|parish|parroquia|borough|census area|municipality|municipio|district|region|province|lga)\b/i;
const STREET_WORD = /\b(street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|highway|hwy|parkway|pkwy|circle|cir|trail|trl|terrace|ter|route|calle|rue|via|avenida)\b\.?$/i;

const ABBRS = new Set(Object.values(STATE_ABBR));

/** "Florida" or "FL" -> "FL"; anything else -> null. */
function stateOf(part) {
  const lower = part.toLowerCase().replace(/\.$/, '');
  if (STATE_ABBR[lower]) return STATE_ABBR[lower];
  // Two capitals only: "IN" is Indiana, "In" is not a state.
  if (/^[A-Z]{2}$/.test(part) && ABBRS.has(part)) return part;
  return null;
}

/** A house number, a road, a county: not the name of a town. */
function isTownName(part) {
  return !/\d/.test(part) && !ADMIN_AREA.test(part) && !STREET_WORD.test(part);
}

/**
 * @param {string} address
 * @returns {{ city: string, state: string, country: string, label: string } | null}
 */
export function parsePlace(address) {
  if (typeof address !== 'string' || !address.trim() || looksLikeCoordinates(address)) return null;

  let parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  let country = '';
  if (parts.length > 1 && US_COUNTRY.test(parts[parts.length - 1])) {
    country = 'US';
    parts = parts.slice(0, -1);
  }

  // "Austin, TX 78701": split the state off its ZIP, then drop bare postcodes.
  parts = parts
    .map((p) => {
      const m = p.match(STATE_THEN_ZIP);
      return m && stateOf(m[1].trim()) ? m[1].trim() : p;
    })
    .filter((p) => !POSTCODE.test(p));

  let stateIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (stateOf(parts[i])) {
      stateIndex = i;
      break;
    }
  }

  if (stateIndex >= 0) {
    const state = stateOf(parts[stateIndex]);
    const before = parts.slice(0, stateIndex).reverse();
    const city = before.find(isTownName)
      || before.find((p) => ADMIN_AREA.test(p) && !/\d/.test(p))
      || '';
    return {
      city,
      state,
      country: 'US',
      label: city ? `${city}, ${state}` : parts[stateIndex],
    };
  }

  if (country === 'US' || parts.length === 0) return null;

  // Outside the US: the last part is the country, the one before it the
  // region. The town is the nearest plain name left of the region.
  if (parts.length === 1) return isTownName(parts[0]) ? { city: parts[0], state: '', country: '', label: parts[0] } : null;
  const foreign = parts[parts.length - 1];
  const rest = parts.slice(0, -1);
  const candidates = (rest.length > 1 ? rest.slice(0, -1) : rest).reverse();
  const city = candidates.find(isTownName) || '';
  return city ? { city, state: '', country: foreign, label: `${city}, ${foreign}` } : null;
}

/** Just the label, or null. */
export function placeLabel(address) {
  return parsePlace(address)?.label || null;
}
