/**
 * Canadian MP lookup for the /rasuwa letter wizard: postal code in, the
 * Member of Parliament out, via the Represent API (Open North;
 * represent.opennorth.ca, the standard open civic-data endpoint for
 * Canadian postal-code-to-representative lookups).
 *
 * Pure logic lives here so the parsing is unit-testable without the
 * network; the thin proxy in app/api/rasuwa/mp calls these. If Represent
 * is down or its shape drifts, the wizard's enter-my-MP-by-hand path
 * still produces a complete letter, so the failure mode is a slower
 * flow, never a dead end.
 */

/**
 * "k1a 0a6" -> "K1A0A6"; null when it is not a Canadian postal code.
 * Canada Post never uses D, F, I, O, Q, or U in any letter position,
 * and W and Z never lead, so structurally impossible codes fail here
 * instead of making a pointless upstream call.
 */
export function normalizePostalCode(raw) {
  const compact = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact) ? compact : null;
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * A Represent postcode response into the MP, or null. Representatives
 * arrive in representatives_centroid (and sometimes
 * representatives_concordance); the MP is the entry whose
 * elected_office is "MP".
 */
export function parseMpResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const pools = [data.representatives_centroid, data.representatives_concordance];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    const rep = pool.find((r) => r && typeof r === 'object' && /^mp$/i.test(text(r.elected_office)));
    if (!rep) continue;
    const name = text(rep.name);
    if (!name) continue;
    const offices = Array.isArray(rep.offices)
      ? rep.offices
          .filter((o) => o && text(o.tel))
          .slice(0, 3)
          .map((o) => ({ type: text(o.type), phone: text(o.tel) }))
      : [];
    return {
      name,
      party: text(rep.party_name),
      riding: text(rep.district_name),
      email: text(rep.email),
      url: text(rep.url),
      offices,
    };
  }
  return null;
}
