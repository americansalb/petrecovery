/**
 * The play page's flow as a reducer: rounds advance, a streak ends at the
 * first miss, Apple rounds wait for a candidate, and the summary carries
 * what the share card needs.
 */

const { reducer, createInitialState, isFinished, totalScore, streakLength, buildSummary, maxScore } = require('@/app/geo/lib/gameState');
const { normalizeConfig } = require('@/app/lib/geo/modes');
const { encodeShare, decodeShare, summaryHeadline, shareText, scoreGlyph } = require('@/app/lib/geo/share');

const google = { provider: 'google', panoId: 'p1', heading: 90, token: 'g1.abc', roundIndex: 0 };
const result = (score, extra = {}) => ({ kind: 'pin', score, distanceKm: 100, answer: { lat: 1, lng: 2, country: { code: 'FR', name: 'France', flag: '🇫🇷' } }, guess: { lat: 1, lng: 3 }, ...extra });

describe('game reducer', () => {
  test('a three-round pin game runs to the summary', () => {
    let s = createInitialState(normalizeConfig({ mode: 'world', rounds: 3, seed: 'x' }));
    for (let i = 0; i < 3; i++) {
      s = reducer(s, { type: 'load_start' });
      expect(s.status).toBe('loading');
      s = reducer(s, { type: 'load_success', round: { ...google, roundIndex: i }, now: 1000 });
      expect(s.status).toBe('playing');
      expect(s.roundStartedAt).toBe(1000);
      s = reducer(s, { type: 'pin', pin: { lat: 1, lng: 3 } });
      s = reducer(s, { type: 'submit_start' });
      expect(s.status).toBe('submitting');
      s = reducer(s, { type: 'submit_success', result: result(4000 - i * 1000) });
      expect(s.status).toBe('result');
      s = reducer(s, { type: 'next' });
    }
    expect(s.status).toBe('summary');
    expect(s.rounds).toHaveLength(3);
    expect(totalScore(s)).toBe(9000);
    expect(maxScore(s)).toBe(15000);
  });

  test('a second next in a row does not skip a round', () => {
    let s = createInitialState(normalizeConfig({ rounds: 3 }));
    s = reducer(s, { type: 'load_success', round: google });
    s = reducer(s, { type: 'submit_success', result: result(1000) });
    s = reducer(s, { type: 'next' });
    expect(s).toMatchObject({ status: 'idle', roundIndex: 1 });
    s = reducer(s, { type: 'next' });
    expect(s).toMatchObject({ status: 'idle', roundIndex: 1 });
  });

  test('pins only count while playing', () => {
    let s = createInitialState(normalizeConfig({ rounds: 3 }));
    s = reducer(s, { type: 'pin', pin: { lat: 0, lng: 0 } });
    expect(s.pin).toBeNull();
  });

  test('a streak ends at the first miss and never at a count', () => {
    let s = createInitialState(normalizeConfig({ mode: 'streak', seed: 'x' }));
    for (let i = 0; i < 7; i++) {
      s = reducer(s, { type: 'load_success', round: google });
      s = reducer(s, { type: 'submit_success', result: { kind: 'streak', correct: true, answer: { country: { code: 'FR' } } } });
      s = reducer(s, { type: 'next' });
      expect(s.status).toBe('idle');
    }
    s = reducer(s, { type: 'load_success', round: google });
    s = reducer(s, { type: 'submit_success', result: { kind: 'streak', correct: false, answer: { country: { code: 'FR' } } } });
    expect(isFinished(s)).toBe(true);
    s = reducer(s, { type: 'next' });
    expect(s.status).toBe('summary');
    expect(streakLength(s)).toBe(7);
  });

  test('Apple rounds wait for a candidate to load', () => {
    let s = createInitialState(normalizeConfig({ provider: 'apple', mode: 'cities', rounds: 3 }));
    const round = { provider: 'apple', roundIndex: 0, candidates: [{ lat: 1, lng: 1, token: 'g1.a' }, { lat: 2, lng: 2, token: 'g1.b' }] };
    s = reducer(s, { type: 'load_success', round });
    expect(s.status).toBe('locating');
    s = reducer(s, { type: 'located', index: 1, now: 5 });
    expect(s.status).toBe('playing');
    expect(s.current.token).toBe('g1.b');
    expect(s.current.candidateIndex).toBe(1);
  });

  test('errors retry with a new attempt number', () => {
    let s = createInitialState(normalizeConfig({ rounds: 3 }));
    s = reducer(s, { type: 'load_error', error: { message: 'no imagery' } });
    expect(s.status).toBe('error');
    s = reducer(s, { type: 'retry' });
    expect(s).toMatchObject({ status: 'idle', attempt: 1, error: null });
  });
});

describe('summary and share code', () => {
  test('round-trips through the share code', () => {
    let s = createInitialState(normalizeConfig({ mode: 'country', region: 'JP', rounds: 3, time: 60, move: false, seed: 'abc' }));
    s = reducer(s, { type: 'load_success', round: google });
    s = reducer(s, { type: 'submit_success', result: result(4800, { distanceKm: 12.34 }) });
    s = reducer(s, { type: 'next' });
    s = reducer(s, { type: 'load_success', round: google });
    s = reducer(s, { type: 'submit_success', result: result(0, { distanceKm: null, timedOut: true, guess: null }) });
    const summary = buildSummary(s, { date: new Date('2026-09-07T10:00:00Z') });
    expect(summary.total).toBe(4800);
    expect(summary.date).toBe('2026-09-07');
    const code = encodeShare(summary);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeShare(code);
    expect(back.config).toEqual(summary.config);
    expect(back.total).toBe(4800);
    expect(back.rounds[0]).toMatchObject({ score: 4800, distanceKm: 12.3, countryCode: 'FR' });
    expect(back.rounds[1]).toMatchObject({ score: 0, distanceKm: null });
    expect(summaryHeadline(back)).toBe('4,800 of 10,000');
    const text = shareText(back, 'https://example.org/geo/share?s=x', { regionLabel: 'Japan' });
    expect(text).toContain('4,800 of 10,000');
    expect(text).toContain('Country: Japan');
    expect(text).toContain('https://example.org/geo/share?s=x');
    expect(text).toContain(scoreGlyph(4800) + scoreGlyph(0));
  });

  test('rejects codes that are not ours', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('not-base64-json')).toBeNull();
    expect(decodeShare(Buffer.from('{"v":2}').toString('base64url'))).toBeNull();
    expect(decodeShare(Buffer.from('{"v":1,"r":"x"}').toString('base64url'))).toBeNull();
  });

  test('streak summaries headline the streak', () => {
    const summary = { config: normalizeConfig({ mode: 'streak' }), rounds: [{ correct: true }, { correct: true }, { correct: false }], total: 0, streak: 2, date: '2026-09-07' };
    const back = decodeShare(encodeShare(summary));
    expect(back.streak).toBe(2);
    expect(summaryHeadline(back)).toBe('Streak of 2');
  });
});
