/**
 * US state names and USPS abbreviations. Shared by server code that keys
 * caches by area (share targets) and client forms that need a validated
 * state picker, so "Illinois" and "IL" always normalize to the same token.
 */

export const STATE_ABBR = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR',
};

export const US_STATES = [...new Set(Object.values(STATE_ABBR))].sort();

/** "Illinois" -> "IL", " il " -> "IL"; anything unrecognized passes through
 *  trimmed (uppercased when it already looks like a 2-letter code). */
export function normalizeState(state) {
  const raw = String(state || '').trim();
  if (!raw) return '';
  const abbr = STATE_ABBR[raw.toLowerCase()];
  if (abbr) return abbr;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return raw;
}
