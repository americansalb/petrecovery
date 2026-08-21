/**
 * Case numbers must not collide.
 *
 * Both intake routes built one as `CASE-${year}-${String(Date.now()).slice(-6)}`.
 * That suffix repeats every 1000 seconds against a @unique column, so two
 * reports filed in the same ~16.7 minute window raced and the loser got a 500.
 * Eight concurrent reports against a local server reproduced it:
 * "Unique constraint failed on the fields: (`caseNumber`)", two reports lost.
 */

import {
  buildCaseNumber,
  cityPrefix,
  isCaseNumberCollision,
  withCaseNumberRetry,
} from '@/app/lib/caseNumber';

describe('cityPrefix', () => {
  it('uses an explicit city name', () => {
    expect(cityPrefix('Austin')).toBe('AUS');
  });

  it('reads the city out of a full address', () => {
    expect(cityPrefix(null, '123 Main St, Austin, TX 78704')).toBe('AUS');
  });

  it('prefers the explicit name over the address', () => {
    expect(cityPrefix('Chicago', '1 Main St, Austin, TX')).toBe('CHI');
  });

  it('falls back to CASE when there is no usable city', () => {
    expect(cityPrefix(null, null)).toBe('CASE');
    expect(cityPrefix('', '')).toBe('CASE');
    // Too short to be a meaningful prefix.
    expect(cityPrefix('LA')).toBe('CASE');
  });
});

describe('buildCaseNumber', () => {
  it('uses the documented CITY-YEAR-SUFFIX shape', () => {
    const n = buildCaseNumber({ cityName: 'Austin' });
    expect(n).toMatch(new RegExp(`^AUS-${new Date().getFullYear()}-[0-9A-Z]{6}$`));
  });

  it('keeps the FOUND prefix for found-pet intake', () => {
    expect(buildCaseNumber({ kind: 'FOUND', cityName: 'Austin' })).toMatch(/^FOUND-\d{4}-/);
  });

  it('omits characters that are ambiguous read aloud', () => {
    const suffixes = Array.from({ length: 400 }, () => buildCaseNumber().split('-')[2]).join('');
    expect(suffixes).not.toMatch(/[01OILU]/);
  });

  it('does not repeat across a burst, unlike the timestamp it replaced', () => {
    // The old generator produced ONE value for every call inside the same
    // millisecond window; this is the regression that matters.
    const seen = new Set(Array.from({ length: 2000 }, () => buildCaseNumber({ cityName: 'Austin' })));
    expect(seen.size).toBe(2000);
  });
});

describe('isCaseNumberCollision', () => {
  it('recognises a Prisma unique violation on caseNumber', () => {
    expect(isCaseNumberCollision({ code: 'P2002', meta: { target: ['caseNumber'] } })).toBe(true);
    expect(isCaseNumberCollision({ code: 'P2002', meta: { target: 'Case_caseNumber_key' } })).toBe(true);
  });

  it('ignores unique violations on other fields', () => {
    expect(isCaseNumberCollision({ code: 'P2002', meta: { target: ['email'] } })).toBe(false);
  });

  it('ignores non-unique errors and nullish input', () => {
    expect(isCaseNumberCollision({ code: 'P2025' })).toBe(false);
    expect(isCaseNumberCollision(null)).toBe(false);
  });
});

describe('withCaseNumberRetry', () => {
  it('passes a fresh case number to the attempt', async () => {
    const result = await withCaseNumberRetry(async (n) => n, { cityName: 'Austin' });
    expect(result).toMatch(/^AUS-\d{4}-[0-9A-Z]{6}$/);
  });

  it('retries with a different number after a collision', async () => {
    const tried = [];
    const attempt = jest.fn(async (n) => {
      tried.push(n);
      if (tried.length === 1) throw { code: 'P2002', meta: { target: ['caseNumber'] } };
      return n;
    });

    const result = await withCaseNumberRetry(attempt, { cityName: 'Austin' });

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(tried[0]).not.toBe(tried[1]);
    expect(result).toBe(tried[1]);
  });

  it('propagates any other error immediately without retrying', async () => {
    const attempt = jest.fn(async () => { throw new Error('database is on fire'); });

    await expect(withCaseNumberRetry(attempt)).rejects.toThrow('database is on fire');
    // A retry loop that swallows real errors is worse than the bug it replaces.
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('gives up after a bounded number of attempts', async () => {
    const attempt = jest.fn(async () => { throw { code: 'P2002', meta: { target: ['caseNumber'] } }; });

    await expect(withCaseNumberRetry(attempt, {}, 3)).rejects.toMatchObject({ code: 'P2002' });
    expect(attempt).toHaveBeenCalledTimes(3);
  });
});
