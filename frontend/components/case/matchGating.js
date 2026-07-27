// Pure, React-free gating logic for MatchCard - extracted so the security-critical
// fail-closed invariant can be unit-tested without a DOM/jsdom (per dev-challenger
// msg 506). The card's CTA decision lives here and nowhere else.

/**
 * Should the actionable Confirm-&-Connect CTA (+ owner-push state) show?
 *
 * FAIL-CLOSED: true ONLY on the positive condition - the server says
 * band==='actionable' AND canConnect===true - or it's a microchip (verified-owner)
 * match. A missing/unknown band or a falsy canConnect yields false. Absence of the
 * trusted field DENIES, never allows: a wrong-payload accidental CTA would connect
 * a stranger to a distraught owner, so it must never fire on garbage input.
 */
export function matchIsActionable(match) {
  const { matchSource, band, canConnect } = match || {};
  if (matchSource === 'microchip') return true;
  return band === 'actionable' && canConnect === true;
}

/**
 * Display label derived from the SAME band that gates the CTA, so the label and
 * the actionability can never tell different stories. Returns null when no
 * match-quality label should show (suppress / missing band → honest status).
 */
export function bandLabel(band) {
  if (band === 'actionable') return { text: 'Strong match', tone: 'text-flash-700' };
  if (band === 'feed') return { text: 'Possible match · under review', tone: 'text-midnight-500' };
  return null;
}
