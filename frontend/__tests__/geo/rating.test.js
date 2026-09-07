/**
 * The rating maths: Glicko on free-for-all rooms.
 *
 * Pinned: equal players expect a draw, a win moves you up and the
 * loser down by the same order of magnitude, a newcomer moves more
 * than a veteran, uncertainty shrinks with play and grows with
 * absence, a rout counts more than a squeaker, and quitting is a loss.
 */

const {
  expectedScore,
  glickoUpdate,
  inflateRd,
  gradedOutcome,
  rateGame,
  placementsFrom,
  tierFor,
  displayRating,
  isProvisional,
  RD_MAX,
  RD_MIN,
} = require('@/app/lib/geo/rating');

describe('expected score', () => {
  test('equal ratings expect a draw; 400 points apart expects about 91 percent', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
    expect(expectedScore(1900, 1500)).toBeCloseTo(0.909, 2);
    expect(expectedScore(1500, 1900)).toBeCloseTo(0.091, 2);
  });

  test('an uncertain opponent tells you less', () => {
    expect(expectedScore(1900, 1500, 350)).toBeLessThan(expectedScore(1900, 1500, 30));
    expect(expectedScore(1900, 1500, 350)).toBeGreaterThan(0.5);
  });
});

describe('one update', () => {
  test('a win goes up, a loss goes down, RD shrinks either way', () => {
    const win = glickoUpdate({ rating: 1500, rd: 200 }, [{ rating: 1500, rd: 200, outcome: 1 }]);
    const loss = glickoUpdate({ rating: 1500, rd: 200 }, [{ rating: 1500, rd: 200, outcome: 0 }]);
    expect(win.rating).toBeGreaterThan(1500);
    expect(loss.rating).toBeLessThan(1500);
    expect(win.rating - 1500).toBeCloseTo(1500 - loss.rating, 6);
    expect(win.rd).toBeLessThan(200);
    expect(win.rd).toBeGreaterThanOrEqual(RD_MIN);
  });

  test('a newcomer moves far more than a veteran on the same result', () => {
    const rookie = glickoUpdate({ rating: 1500, rd: 350 }, [{ rating: 1500, rd: 60, outcome: 1 }]);
    const veteran = glickoUpdate({ rating: 1500, rd: 60 }, [{ rating: 1500, rd: 60, outcome: 1 }]);
    expect(rookie.rating - 1500).toBeGreaterThan(3 * (veteran.rating - 1500));
  });

  test('beating a much stronger player pays more than beating a weaker one', () => {
    const upset = glickoUpdate({ rating: 1500, rd: 100 }, [{ rating: 1900, rd: 60, outcome: 1 }]);
    const expected = glickoUpdate({ rating: 1500, rd: 100 }, [{ rating: 1100, rd: 60, outcome: 1 }]);
    expect(upset.rating - 1500).toBeGreaterThan(4 * (expected.rating - 1500));
  });

  test('deviation grows with absence, capped at the newcomer level', () => {
    expect(inflateRd(50, 0)).toBe(50);
    expect(inflateRd(50, 30)).toBeGreaterThan(150);
    expect(inflateRd(50, 30)).toBeLessThan(350);
    expect(inflateRd(50, 400)).toBe(RD_MAX);
  });
});

describe('graded outcomes', () => {
  test('a tie is half, a thin win three quarters, a rout a full win', () => {
    expect(gradedOutcome(0, 1000)).toBe(0.5);
    expect(gradedOutcome(1, 1000)).toBeCloseTo(0.75, 2);
    expect(gradedOutcome(500, 1000)).toBeCloseTo(0.875, 3);
    expect(gradedOutcome(1000, 1000)).toBe(1);
    expect(gradedOutcome(-1000, 1000)).toBe(0);
    expect(gradedOutcome(-1, 1000)).toBeCloseTo(0.25, 2);
  });
});

describe('a whole game', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');

  test('four players: order of finish decides who goes up, and margins matter', () => {
    const entries = [
      { id: 'a', rating: 1500, rd: 200, placement: 1, measure: 20000 },
      { id: 'b', rating: 1500, rd: 200, placement: 2, measure: 19900 },
      { id: 'c', rating: 1500, rd: 200, placement: 3, measure: 9000 },
      { id: 'd', rating: 1500, rd: 200, placement: 4, measure: 1000 },
    ];
    const results = rateGame(entries, { scale: 5000, now });
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId.a.delta).toBeGreaterThan(0);
    expect(byId.b.delta).toBeGreaterThan(0);
    expect(byId.c.delta).toBeLessThan(0);
    expect(byId.d.delta).toBeLessThan(byId.c.delta);
    // b lost to a by a hair but beat c and d soundly, so b nearly keeps pace with a
    expect(byId.a.delta - byId.b.delta).toBeLessThan(byId.b.delta);
    expect(results.every((r) => r.rdAfter < 200)).toBe(true);
  });

  test('quitting is a loss to everyone who stayed', () => {
    const results = rateGame(
      [
        { id: 'stayed', rating: 1500, rd: 150, placement: 1, measure: 3000 },
        { id: 'quit', rating: 1500, rd: 150, placement: 2, measure: 8000, left: true },
      ],
      { scale: 5000, now }
    );
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId.stayed.delta).toBeGreaterThan(0);
    expect(byId.quit.delta).toBeLessThan(0);
  });

  test('a long absence makes the next result count more', () => {
    const fresh = rateGame(
      [
        { id: 'x', rating: 1500, rd: 60, placement: 1, measure: 5000, lastPlayedAt: now - 1000 },
        { id: 'y', rating: 1500, rd: 60, placement: 2, measure: 0 },
      ],
      { scale: 1000, now }
    );
    const rusty = rateGame(
      [
        { id: 'x', rating: 1500, rd: 60, placement: 1, measure: 5000, lastPlayedAt: now - 120 * 24 * 3600 * 1000 },
        { id: 'y', rating: 1500, rd: 60, placement: 2, measure: 0 },
      ],
      { scale: 1000, now }
    );
    expect(rusty[0].delta).toBeGreaterThan(fresh[0].delta);
  });

  test('a lone player is untouched', () => {
    const [only] = rateGame([{ id: 'solo', rating: 1600, rd: 90, placement: 1, measure: 1 }], { scale: 1, now });
    expect(only).toMatchObject({ delta: 0, after: 1600 });
  });

  test('placements share on ties', () => {
    expect(placementsFrom([{ s: 10 }, { s: 10 }, { s: 3 }], (e) => e.s)).toEqual([1, 1, 3]);
  });

  test('tiers, display and provisional flags read sensibly', () => {
    expect(tierFor(1500)).toBe('Silver');
    expect(tierFor(1200)).toBe('Bronze');
    expect(tierFor(2250)).toBe('Grandmaster');
    expect(displayRating(1512.4, 100)).toEqual({ value: 1512, low: 1312, high: 1712 });
    expect(isProvisional(2)).toBe(true);
    expect(isProvisional(5)).toBe(false);
  });
});
