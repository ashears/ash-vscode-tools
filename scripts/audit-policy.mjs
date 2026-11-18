/** One owner-approved, development-only exception. No production exceptions. */
export const EXCEPTION = Object.freeze({
  advisory: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  package: 'picomatch',
  version: '4.0.7',
  // December 1, 2026 at midnight in America/Los_Angeles.
  expiresAt: '2026-12-01T08:00:00.000Z',
});

const levels = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

/** Fail closed on unknown reports, dependency paths, cycles, or advisory IDs. */
export function evaluateAudit(report, lock, scope, now = Date.now()) {
  if (!['production', 'all'].includes(scope) || !Number.isFinite(now) || report?.error ||
    report?.auditReportVersion !== 2 || !report.vulnerabilities || typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities) || !lock?.packages) {
    throw new Error('Invalid npm audit report, lockfile, or audit scope.');
  }
  const vulnerabilities = report.vulnerabilities;
  const active = scope === 'all' && now < Date.parse(EXCEPTION.expiresAt);
  const developmentOnly = value => Array.isArray(value.nodes) && value.nodes.length > 0 &&
    value.nodes.every(node => lock.packages[node]?.dev === true);

  const excepted = (name, seen = new Set()) => {
    const value = vulnerabilities[name];
    if (!active || !value || seen.has(name) || !developmentOnly(value) || !Array.isArray(value.via) || !value.via.length) return false;
    const visited = new Set([...seen, name]);
    return value.via.every(via => {
      if (typeof via === 'string') return excepted(via, visited);
      return name === EXCEPTION.package && via?.name === EXCEPTION.package && via.url === EXCEPTION.advisory &&
        via.severity === 'high' && value.nodes.every(node => lock.packages[node].version === EXCEPTION.version);
    });
  };

  const blocked = [], accepted = [];
  for (const [name, value] of Object.entries(vulnerabilities)) {
    if (!value || !(value.severity in levels)) throw new Error(`Invalid advisory severity for ${name}.`);
    if (levels[value.severity] < levels.moderate) continue;
    if (excepted(name)) accepted.push(name);
    else blocked.push(name);
  }
  return { blocked, accepted };
}
