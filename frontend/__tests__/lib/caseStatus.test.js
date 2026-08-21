/**
 * Case status labels must track the schema.
 *
 * /my-alerts switched on OPEN, ACTIVE_SEARCH and RESOLVED. None of those
 * are CaseStatus values and none ever were, so on that page:
 *   - the badge printed the raw enum ("IN_PROGRESS")
 *   - the Active and Found filter tabs matched nothing
 *   - "Mark as Found" never rendered, because the button was gated on a
 *     status that cannot occur
 *   - and had it rendered, it POSTed status: 'RESOLVED', which the API
 *     rejects as an invalid enum value
 *
 * The last two are the ones that matter: telling the site your pet came
 * home was unreachable, and broken behind that.
 *
 * This reads the enum out of schema.prisma so adding a status without
 * giving it a label fails here rather than in front of a user.
 */

const fs = require('fs');
const path = require('path');

const {
  CASE_STATUSES,
  caseStatusLabel,
  caseStatusColors,
  isCaseOpen,
} = require('@/app/lib/caseStatus');

function schemaStatuses() {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
    'utf8'
  );
  const block = schema.match(/enum CaseStatus \{([^}]*)\}/);
  if (!block) throw new Error('enum CaseStatus not found in schema.prisma');
  return block[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
}

describe('case status vocabulary', () => {
  it('covers exactly the statuses the schema defines', () => {
    expect([...CASE_STATUSES].sort()).toEqual([...schemaStatuses()].sort());
  });

  it('gives every status human wording, never the raw enum', () => {
    for (const status of schemaStatuses()) {
      const label = caseStatusLabel(status);
      expect(label).toBeTruthy();
      expect(label).not.toBe(status);
      expect(label).not.toMatch(/_/);
    }
  });

  it('gives every status a colour set', () => {
    for (const status of schemaStatuses()) {
      const colors = caseStatusColors(status);
      expect(colors).toEqual(
        expect.objectContaining({
          bg: expect.any(String),
          border: expect.any(String),
          text: expect.any(String),
        })
      );
    }
  });

  it('treats the searching statuses as open and the finished ones as not', () => {
    expect(isCaseOpen('ACTIVE')).toBe(true);
    expect(isCaseOpen('IN_PROGRESS')).toBe(true);
    expect(isCaseOpen('SIGHTING_REPORTED')).toBe(true);
    expect(isCaseOpen('REUNITED')).toBe(false);
    expect(isCaseOpen('CLOSED_OTHER')).toBe(false);
  });

  it('does not resurrect the statuses that never existed', () => {
    for (const invented of ['OPEN', 'ACTIVE_SEARCH', 'RESOLVED']) {
      expect(CASE_STATUSES).not.toContain(invented);
      expect(isCaseOpen(invented)).toBe(false);
    }
  });
});

describe('/my-alerts uses the real vocabulary', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app', 'my-alerts', 'page.js'),
    'utf8'
  );

  it('no longer references statuses that do not exist', () => {
    expect(source).not.toMatch(/'OPEN'|'ACTIVE_SEARCH'|'RESOLVED'/);
  });

  it('reads a location field the API actually returns', () => {
    // The list comes from /api/missions, whose response has
    // lastSeenAddress and no city, state or lastSeenLandmark. Reading
    // those rendered the literal string "undefined, undefined".
    expect(source).not.toMatch(/alert\.city|alert\.state|alert\.lastSeenLandmark/);
    expect(source).toMatch(/alert\.lastSeenAddress/);
  });
});
