/**
 * The family task force board's pure logic (teamLogic.js) and door
 * (teamAuth.js): what gets posted, how claims read to each person, how
 * the coverage wall joins the letter record to the list of the
 * missing, and how the shared code turns into a cookie that cannot be
 * minted without it.
 */

const {
  TEAM_CAPS,
  aggregateRecipientCounts,
  buildCoverage,
  personKeySets,
  coverageForPublic,
  cleanTeamName,
  cleanTeamNeed,
  cleanTeamPost,
  needView,
  normalizePersonKey,
  timeAgo,
} = require('@/app/rasuwa/team/teamLogic');

const {
  TEAM_COOKIE,
  codeMatches,
  configuredTeamCode,
  hasTeamCookie,
  normalizeTeamCode,
  teamCookieValue,
} = require('@/app/rasuwa/team/teamAuth');

describe('cleanTeamPost', () => {
  test('keeps a real post, folds whitespace, defaults kind to message', () => {
    const post = cleanTeamPost({ author: '  Asha  Rao ', body: 'Embassy called back.\r\nCase list updated.', kind: 'junk' });
    expect(post).toEqual({ author: 'Asha Rao', body: 'Embassy called back.\nCase list updated.', kind: 'message' });
    expect(cleanTeamPost({ author: 'A', body: 'B', kind: 'update' }).kind).toBe('update');
  });

  test('rejects a post missing a name or a body, and non-objects', () => {
    expect(cleanTeamPost({ author: '', body: 'hello' })).toBeNull();
    expect(cleanTeamPost({ author: 'Asha', body: '   ' })).toBeNull();
    expect(cleanTeamPost()).toBeNull();
  });

  test('clips instead of rejecting length', () => {
    const post = cleanTeamPost({ author: 'A'.repeat(999), body: 'B'.repeat(99999) });
    expect(post.author).toHaveLength(TEAM_CAPS.name);
    expect(post.body).toHaveLength(TEAM_CAPS.postBody);
  });
});

describe('cleanTeamNeed', () => {
  test('keeps a real need and clips its fields', () => {
    const need = cleanTeamNeed({ author: 'Ravi', title: '  Call the consulate list  ', detail: 'D'.repeat(99999) });
    expect(need.createdBy).toBe('Ravi');
    expect(need.title).toBe('Call the consulate list');
    expect(need.detail).toHaveLength(TEAM_CAPS.needDetail);
  });

  test('rejects a need without a name or a title', () => {
    expect(cleanTeamNeed({ author: '', title: 'T' })).toBeNull();
    expect(cleanTeamNeed({ author: 'A', title: '' })).toBeNull();
  });
});

describe('needView (the claim state machine as one person sees it)', () => {
  const open = { status: 'OPEN', claimedBy: '' };
  const mine = { status: 'CLAIMED', claimedBy: 'Asha Rao' };
  const held = { status: 'CLAIMED', claimedBy: 'Ravi' };
  const done = { status: 'DONE', claimedBy: 'Ravi' };

  test('open offers claim and done to everyone', () => {
    expect(needView(open, 'Asha Rao')).toMatchObject({ open: true, actions: ['claim', 'done'] });
  });

  test('the holder may finish or hand back; others may only mark done', () => {
    expect(needView(mine, 'Asha Rao')).toMatchObject({ mine: true, actions: ['done', 'release'] });
    expect(needView(held, 'Asha Rao')).toMatchObject({ held: true, mine: false, actions: ['done'] });
  });

  test('done offers reopen; junk status reads as open; blank names never own', () => {
    expect(needView(done, 'Asha Rao')).toMatchObject({ done: true, actions: ['reopen'] });
    expect(needView({ status: '???', claimedBy: '' }, 'X').open).toBe(true);
    expect(needView({ status: 'CLAIMED', claimedBy: '' }, '').mine).toBe(false);
  });
});

describe('normalizePersonKey', () => {
  test('folds case, spacing, and diacritics to one key', () => {
    expect(normalizePersonKey('  Poonam   Thakkar ')).toBe('poonam thakkar');
    expect(normalizePersonKey('Śrestha')).toBe(normalizePersonKey('Srestha'));
    expect(normalizePersonKey(null)).toBe('');
  });
});

describe('buildCoverage', () => {
  const people = [
    { num: 1, name: 'Poonam Thakkar', country: 'United States', home: 'Bartlett, Illinois' },
    { num: 2, name: 'Anil Grover', country: 'Canada', home: 'Markham, Ontario' },
    { num: 3, name: 'Vyshnavy Culan', country: 'France', home: 'Paris' },
  ];

  test('joins letters and claims to the list and counts who has nobody', () => {
    const coverage = buildCoverage({
      people,
      letterCounts: [
        { personName: 'POONAM  THAKKAR', records: 2 },
        { personName: 'Someone Not Listed', records: 1 },
      ],
      claims: [{ personKey: 'anil grover', claimedBy: 'Samira' }],
    });
    expect(coverage.totals).toEqual({ people: 3, withLetters: 1, needSomeone: 1 });
    // One flat alphabetical wall: no nationality grouping, nobody first.
    expect(coverage.people.map((p) => p.name)).toEqual(['Anil Grover', 'Poonam Thakkar', 'Vyshnavy Culan']);
    const byName = (n) => coverage.people.find((p) => p.name === n);
    expect(byName('Poonam Thakkar')).toMatchObject({ letters: 2, claimants: [], needsSomeone: false });
    expect(byName('Anil Grover')).toMatchObject({ letters: 0, claimants: ['Samira'], needsSomeone: false });
    expect(byName('Vyshnavy Culan')).toMatchObject({ letters: 0, claimants: [], needsSomeone: true });
    expect(coverage.others).toEqual([{ personName: 'Someone Not Listed', records: 1 }]);
  });

  test('duplicate claims collapse and junk rows fall away', () => {
    const coverage = buildCoverage({
      people,
      letterCounts: [{ personName: '', records: 5 }, null],
      claims: [
        { personKey: 'anil grover', claimedBy: 'Samira' },
        { personKey: 'anil grover', claimedBy: 'Samira' },
        { personKey: '', claimedBy: 'X' },
        null,
      ],
    });
    expect(coverage.people.find((p) => p.name === 'Anil Grover').claimants).toEqual(['Samira']);
    expect(coverage.others).toEqual([]);
  });

  test('empty inputs still describe the whole list', () => {
    const coverage = buildCoverage({ people });
    expect(coverage.totals.needSomeone).toBe(3);
    expect(buildCoverage({}).totals.people).toBe(0);
  });

  test('any printed name resolves to the person and their whole key set', () => {
    const sets = personKeySets([
      { num: 1, name: 'Poonam Dilipkumar Thakkar', aka: ['Poonam Thakkar'] },
      { num: 2, name: 'Anil Grover' },
    ]);
    const expected = { canonical: 'poonam dilipkumar thakkar', keys: ['poonam dilipkumar thakkar', 'poonam thakkar'] };
    // Claim by either name, release clears both: the set is the unit.
    expect(sets.get('poonam dilipkumar thakkar')).toEqual(expected);
    expect(sets.get('poonam thakkar')).toEqual(expected);
    expect(sets.get('anil grover')).toEqual({ canonical: 'anil grover', keys: ['anil grover'] });
    expect(sets.get('nobody listed')).toBeUndefined();
    expect(personKeySets(null).size).toBe(0);
  });

  test('letters and claims recorded under an earlier printed name still count', () => {
    // The live letter renames people as families correct entries;
    // `aka` keeps the records they already earned attached.
    const renamed = [
      { num: 1, name: 'Poonam Dilipkumar Thakkar', country: 'United States', home: 'Bartlett, Illinois', aka: ['Poonam Thakkar'] },
    ];
    const coverage = buildCoverage({
      people: renamed,
      letterCounts: [
        { personName: 'Poonam Thakkar', records: 2 },
        { personName: 'Poonam Dilipkumar Thakkar', records: 1 },
      ],
      claims: [{ personKey: 'poonam thakkar', claimedBy: 'Samira' }],
    });
    const row = coverage.people[0];
    expect(row).toMatchObject({ letters: 3, claimants: ['Samira'], needsSomeone: false });
    expect(row.keys).toEqual(['poonam dilipkumar thakkar', 'poonam thakkar']);
    // the old name is a listed key now, not an unlisted stray
    expect(coverage.others).toEqual([]);
  });
});

describe('aggregateRecipientCounts (which offices, each separately)', () => {
  test('counts records per person and letters per office, with real titles', () => {
    const rows = [
      { personName: 'Poonam Thakkar', recipients: 'sen Richard J. Durbin; sen Tammy Duckworth; rep Raja Krishnamoorthi' },
      { personName: 'POONAM THAKKAR', recipients: 'sen Richard J. Durbin; rep Jonathan L. Jackson' },
      { personName: 'Anil Grover', recipients: 'mp Anita Vandenbeld' },
      { personName: 'Vyshnavy Culan', recipients: 'parliament or consular officer' },
      { personName: '', recipients: 'sen Nobody' },
      null,
    ];
    const { letterCounts, officesByKey } = aggregateRecipientCounts(rows);
    expect(letterCounts.find((c) => c.personName === 'Poonam Thakkar').records).toBe(2);
    expect(officesByKey['poonam thakkar']).toEqual([
      { name: 'Senator Richard J. Durbin', count: 2 },
      { name: 'Representative Jonathan L. Jackson', count: 1 },
      { name: 'Representative Raja Krishnamoorthi', count: 1 },
      { name: 'Senator Tammy Duckworth', count: 1 },
    ]);
    expect(officesByKey['anil grover']).toEqual([{ name: 'MP Anita Vandenbeld', count: 1 }]);
    expect(officesByKey['vyshnavy culan']).toEqual([{ name: 'parliament or consular officer', count: 1 }]);
    expect(aggregateRecipientCounts(null).letterCounts).toEqual([]);
  });
});

describe('coverageForPublic (the chart everyone can see)', () => {
  test('keeps counts, never team members\' names', () => {
    const coverage = buildCoverage({
      people: [{ num: 2, name: 'Anil Grover', country: 'Canada', home: 'Markham' }],
      letterCounts: [{ personName: 'Anil Grover', records: 3 }],
      claims: [
        { personKey: 'anil grover', claimedBy: 'Samira' },
        { personKey: 'anil grover', claimedBy: 'Ravi' },
      ],
    });
    const pub = coverageForPublic(coverage, { 'anil grover': [{ name: 'MP Anita Vandenbeld', count: 3 }] });
    expect(pub.people).toEqual([
      { num: 2, name: 'Anil Grover', country: 'Canada', letters: 3, writing: 2, needsSomeone: false, offices: [{ name: 'MP Anita Vandenbeld', count: 3 }] },
    ]);
    expect(JSON.stringify(pub)).not.toMatch(/Samira|Ravi|home|claimants/);
    expect(pub.totals.people).toBe(1);
    expect(coverageForPublic(null).people).toEqual([]);
  });

  test('office tallies recorded under an earlier printed name merge into the person', () => {
    const coverage = buildCoverage({
      people: [{ num: 1, name: 'Poonam Dilipkumar Thakkar', country: 'United States', aka: ['Poonam Thakkar'] }],
      letterCounts: [{ personName: 'Poonam Thakkar', records: 1 }],
    });
    const pub = coverageForPublic(coverage, {
      'poonam thakkar': [{ name: 'Senator Richard J. Durbin', count: 1 }],
      'poonam dilipkumar thakkar': [{ name: 'Senator Richard J. Durbin', count: 1 }, { name: 'Senator Tammy Duckworth', count: 1 }],
    });
    expect(pub.people[0].offices).toEqual([
      { name: 'Senator Richard J. Durbin', count: 2 },
      { name: 'Senator Tammy Duckworth', count: 1 },
    ]);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-08-31T12:00:00Z').getTime();
  test('reads like a person wrote it', () => {
    expect(timeAgo('2026-08-31T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-08-31T11:56:00Z', now)).toBe('4 min ago');
    expect(timeAgo('2026-08-31T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-08-29T09:00:00Z', now)).toMatch(/Aug/);
    expect(timeAgo('junk', now)).toBe('');
  });
});

describe('teamAuth', () => {
  const withEnv = (env, fn) => {
    const saved = {};
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };

  test('codes fold case and whitespace', () => {
    expect(normalizeTeamCode('  Bring Them  HOME ')).toBe('bring them home');
  });

  test('outside production a fixed development code applies', () => {
    withEnv({ RASUWA_TEAM_CODE: undefined }, () => {
      expect(configuredTeamCode()).toBe('timure');
      expect(codeMatches('  TIMURE ')).toBe(true);
      expect(codeMatches('wrong')).toBe(false);
    });
  });

  test('the configured code wins and mismatches stay out', () => {
    withEnv({ RASUWA_TEAM_CODE: 'Bring Them Home' }, () => {
      expect(codeMatches('bring them home')).toBe(true);
      expect(codeMatches('timure')).toBe(false);
      expect(codeMatches('')).toBe(false);
    });
  });

  test('cookie round trip: the real value passes, everything else fails', () => {
    withEnv({ RASUWA_TEAM_CODE: 'bring them home' }, () => {
      const value = teamCookieValue(configuredTeamCode());
      const requestWith = (v) => ({ cookies: { get: (name) => (name === TEAM_COOKIE && v !== undefined ? { value: v } : undefined) } });
      expect(hasTeamCookie(requestWith(value))).toBe(true);
      expect(hasTeamCookie(requestWith('deadbeef'))).toBe(false);
      expect(hasTeamCookie(requestWith('zz'.repeat(32)))).toBe(false);
      expect(hasTeamCookie(requestWith(undefined))).toBe(false);
      expect(hasTeamCookie({})).toBe(false);
    });
  });

  test('rotating the code invalidates old cookies', () => {
    const oldValue = withEnv({ RASUWA_TEAM_CODE: 'first code' }, () => teamCookieValue(configuredTeamCode()));
    withEnv({ RASUWA_TEAM_CODE: 'second code' }, () => {
      const request = { cookies: { get: () => ({ value: oldValue }) } };
      expect(hasTeamCookie(request)).toBe(false);
    });
  });
});

describe('cleanTeamName', () => {
  test('folds and caps like every other name on the board', () => {
    expect(cleanTeamName('  Asha   Rao  ')).toBe('Asha Rao');
    expect(cleanTeamName('X'.repeat(999))).toHaveLength(TEAM_CAPS.name);
    expect(cleanTeamName(42)).toBe('');
  });
});
