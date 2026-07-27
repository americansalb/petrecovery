/**
 * MatchCard gating - security-critical fail-closed invariant.
 *
 * A wrong-payload accidental Confirm-&-Connect CTA would connect an anonymous
 * finder to a distraught owner, so the CTA must NEVER fire on missing/garbage
 * input. This locks that invariant as a CI regression (per dev-challenger msg 506)
 * - testing the pure decision directly, no DOM needed.
 */
import { matchIsActionable, bandLabel } from '../../components/case/matchGating';

describe('matchIsActionable - fail-closed CTA gating', () => {
  test('actionable ONLY when band==="actionable" AND canConnect===true', () => {
    expect(matchIsActionable({ band: 'actionable', canConnect: true })).toBe(true);
  });

  test('microchip (verified owner) is always actionable', () => {
    expect(matchIsActionable({ matchSource: 'microchip', band: 'suppress', canConnect: false })).toBe(true);
  });

  // The fail-open cases dev-challenger flagged - each must DENY.
  test('missing band → no CTA even if canConnect is true', () => {
    expect(matchIsActionable({ canConnect: true })).toBe(false);
    expect(matchIsActionable({ band: undefined, canConnect: true })).toBe(false);
  });

  test('feed/suppress band → no CTA', () => {
    expect(matchIsActionable({ band: 'feed', canConnect: true })).toBe(false);
    expect(matchIsActionable({ band: 'suppress', canConnect: false })).toBe(false);
  });

  test('band actionable but canConnect falsy/missing → no CTA', () => {
    expect(matchIsActionable({ band: 'actionable', canConnect: false })).toBe(false);
    expect(matchIsActionable({ band: 'actionable' })).toBe(false);
  });

  test('garbage/empty input → no CTA (never throws)', () => {
    expect(matchIsActionable(null)).toBe(false);
    expect(matchIsActionable(undefined)).toBe(false);
    expect(matchIsActionable({})).toBe(false);
    expect(matchIsActionable({ band: 'ACTIONABLE', canConnect: 'true' })).toBe(false); // wrong case / wrong type
  });
});

describe('bandLabel - label derived from the same band that gates the CTA', () => {
  test('actionable → Strong match', () => {
    expect(bandLabel('actionable')).toEqual({ text: 'Strong match', tone: 'text-flash-700' });
  });
  test('feed → hedged label (no CTA will show)', () => {
    expect(bandLabel('feed').text).toBe('Possible match · under review');
  });
  test('suppress / missing → no label (honest status carries it)', () => {
    expect(bandLabel('suppress')).toBeNull();
    expect(bandLabel(undefined)).toBeNull();
  });
});
