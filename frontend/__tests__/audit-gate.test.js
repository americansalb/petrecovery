const { assessAudit } = require('../scripts/audit-gate');

function report(vulnerabilities = {}) {
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: {
    high: Object.values(vulnerabilities).filter((v) => v.severity === 'high').length,
    critical: Object.values(vulnerabilities).filter((v) => v.severity === 'critical').length,
  } } };
}

test('accepts a clean report, but not missing or failed audit data', () => {
  expect(assessAudit(report())).toEqual([]);
  for (const invalid of [null, {}, { error: 'registry unavailable' }, { ...report(), error: {} },
    { ...report(), auditReportVersion: 1 }, { ...report(), vulnerabilities: [] }]) {
    expect(() => assessAudit(invalid)).toThrow();
  }
});

test('new advisories on historically exempt packages block release', () => {
  const result = assessAudit(report({ next: { severity: 'critical', via: [{ url: 'new-advisory' }] },
    nodemailer: { severity: 'high', via: ['transitive-package'] }, minor: { severity: 'moderate' } }));
  expect(result.map((entry) => entry.name)).toEqual(['next', 'nodemailer']);
});

test('malformed entries or inconsistent totals fail closed', () => {
  expect(() => assessAudit(report({ next: {} }))).toThrow();
  const truncated = report();
  truncated.metadata.vulnerabilities.critical = 1;
  expect(() => assessAudit(truncated)).toThrow();
  delete truncated.metadata.vulnerabilities.high;
  expect(() => assessAudit(truncated)).toThrow();
});
