#!/usr/bin/env node
/** Fail closed on high/critical production advisories or an unavailable audit.
 * No package-name exceptions: an old review must never approve a new advisory.
 */
const { execFileSync } = require('child_process');
const path = require('path');

function assessAudit(report) {
  if (!report || report.error || report.auditReportVersion !== 2
    || !report.vulnerabilities || Array.isArray(report.vulnerabilities)
    || typeof report.vulnerabilities !== 'object' || !report.metadata?.vulnerabilities) {
    throw new Error('Dependency audit unavailable or malformed; release verification failed.');
  }
  const blocking = [];
  for (const [name, detail] of Object.entries(report.vulnerabilities)) {
    if (!detail || !['info', 'low', 'moderate', 'high', 'critical'].includes(detail.severity)) {
      throw new Error(`Invalid audit entry: ${name}`);
    }
    if (['high', 'critical'].includes(detail.severity)) {
      blocking.push({ name, severity: detail.severity, advisories: detail.via, fix: detail.fixAvailable });
    }
  }
  const counts = report.metadata.vulnerabilities;
  for (const severity of ['high', 'critical']) {
    if (!Number.isInteger(counts[severity]) || counts[severity] < 0
      || counts[severity] !== blocking.filter((entry) => entry.severity === severity).length) {
      throw new Error('Inconsistent dependency audit totals; release verification failed.');
    }
  }
  return blocking;
}

function readAudit() {
  let output;
  try {
    output = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    // Only npm's advisory exit code can contain a usable audit.
    if (error.status !== 1 || !error.stdout) throw error;
    output = error.stdout;
  }
  return JSON.parse(output);
}

function main() {
  try {
    const blocking = assessAudit(readAudit());
    if (blocking.length) {
      console.error('Release blocked: high/critical production dependency advisories.');
      for (const entry of blocking) console.error(JSON.stringify(entry));
      process.exitCode = 1;
      return;
    }
    console.log('No high or critical advisories in production dependencies.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { assessAudit };
