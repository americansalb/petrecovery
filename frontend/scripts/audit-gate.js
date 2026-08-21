#!/usr/bin/env node
/**
 * npm audit as an actual gate.
 *
 * The CI step used to be:
 *
 *   npm audit --audit-level=high || echo "Vulnerabilities found - review required"
 *
 * which cannot fail. It reported green through 19 production
 * vulnerabilities, 3 of them critical and in the auth chain, for however
 * long they had been there. Nobody reviewed anything, because nothing ever
 * asked them to.
 *
 * This fails the build on any high or critical advisory in PRODUCTION
 * dependencies that is not listed in audit-allowlist.json with a reason.
 * Dev-only advisories are excluded deliberately: they ship to nobody, and
 * mixing them in is what made the old output long enough to wave through.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOCKING = new Set(['high', 'critical']);

function readAudit() {
  try {
    // npm audit exits non-zero when it finds anything, so the JSON comes
    // back on the error object rather than as a clean return.
    const out = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (err) {
    if (err.stdout) return JSON.parse(err.stdout);
    throw err;
  }
}

function main() {
  const allowlist = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'audit-allowlist.json'), 'utf8')
  );
  const allowed = allowlist.allowed || {};

  const report = readAudit();
  const vulns = report.vulnerabilities || {};

  const unexpected = [];
  const known = [];

  for (const [name, detail] of Object.entries(vulns)) {
    if (!BLOCKING.has(detail.severity)) continue;
    (allowed[name] ? known : unexpected).push({ name, severity: detail.severity, detail });
  }

  if (known.length) {
    console.log(`Known advisories, allowlisted with a reason (review by ${allowlist.reviewBy}):`);
    for (const { name, severity } of known) console.log(`  ${severity.padEnd(9)} ${name}`);
    console.log('');
  }

  // An allowlist entry for something that no longer appears is stale, and a
  // stale allowlist is how a real advisory gets waved through later.
  const stale = Object.keys(allowed).filter(
    (name) => !vulns[name] || !BLOCKING.has(vulns[name].severity)
  );
  if (stale.length) {
    console.log('Allowlist entries no longer needed - delete them from audit-allowlist.json:');
    for (const name of stale) console.log(`  ${name}`);
    console.log('');
  }

  if (unexpected.length) {
    console.error('New high or critical advisories in production dependencies:');
    for (const { name, severity, detail } of unexpected) {
      const title = detail.via?.find?.((v) => v && v.title)?.title || '';
      console.error(`  ${severity.padEnd(9)} ${name} ${title}`);
      console.error(`            fix: ${JSON.stringify(detail.fixAvailable)}`);
    }
    console.error('');
    console.error('Upgrade it, or add it to audit-allowlist.json with a reason for shipping anyway.');
    process.exit(1);
  }

  console.log('No unreviewed high or critical advisories in production dependencies.');
}

main();
