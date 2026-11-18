import { describe, expect, it } from 'vitest';
import { evaluateAudit, EXCEPTION } from '../../scripts/audit-policy.mjs';

const now = Date.parse('2026-11-18T00:00:00Z');
const known = { name: 'picomatch', url: EXCEPTION.advisory, severity: 'high' };
function fixture() {
  return {
    report: { auditReportVersion: 2, vulnerabilities: {
      picomatch: { severity: 'high', via: [known], nodes: ['node_modules/picomatch'] },
      tinyglobby: { severity: 'high', via: ['picomatch'], nodes: ['node_modules/tinyglobby'] },
    } },
    lock: { packages: {
      'node_modules/picomatch': { dev: true, version: '4.0.7' },
      'node_modules/tinyglobby': { dev: true, version: '0.2.17' },
    } },
  };
}

describe('time-limited dependency audit exception', () => {
  it('permits only the reviewed development advisory and its inherited entries', () => {
    const { report, lock } = fixture();
    expect(evaluateAudit(report, lock, 'all', now)).toEqual({ blocked: [], accepted: ['picomatch', 'tinyglobby'] });
  });
  it('never permits production advisories, including this exact advisory', () => {
    const { report, lock } = fixture();
    expect(evaluateAudit(report, lock, 'production', now).blocked).toEqual(['picomatch', 'tinyglobby']);
    lock.packages['node_modules/picomatch'].dev = false;
    expect(evaluateAudit(report, lock, 'all', now).blocked).toEqual(['picomatch', 'tinyglobby']);
  });
  it('expires at the deadline without blocking clean future audits', () => {
    const { report, lock } = fixture();
    expect(evaluateAudit(report, lock, 'all', Date.parse(EXCEPTION.expiresAt)).blocked).toEqual(['picomatch', 'tinyglobby']);
    expect(evaluateAudit({ auditReportVersion: 2, vulnerabilities: {} }, lock, 'all', Date.parse(EXCEPTION.expiresAt)).blocked).toEqual([]);
  });
  it('blocks any new advisory alongside the allowed one', () => {
    const { report, lock } = fixture();
    report.vulnerabilities.picomatch.via.push({ ...known, url: 'https://github.com/advisories/GHSA-another-issue' });
    expect(evaluateAudit(report, lock, 'all', now).blocked).toEqual(['picomatch', 'tinyglobby']);
  });
  it('requires the reviewed version and known development paths', () => {
    const { report, lock } = fixture();
    lock.packages['node_modules/picomatch'].version = '4.0.6';
    expect(evaluateAudit(report, lock, 'all', now).blocked).toContain('picomatch');
    delete lock.packages['node_modules/picomatch'];
    expect(evaluateAudit(report, lock, 'all', now).blocked).toContain('tinyglobby');
  });
  it('fails closed for malformed reports and circular or missing dependency causes', () => {
    const { report, lock } = fixture();
    expect(() => evaluateAudit({ error: 'Registry unavailable' }, lock, 'all', now)).toThrow();
    report.vulnerabilities.picomatch.via = ['tinyglobby'];
    expect(evaluateAudit(report, lock, 'all', now).blocked).toEqual(['picomatch', 'tinyglobby']);
    report.vulnerabilities.picomatch.via = ['unknown'];
    expect(evaluateAudit(report, lock, 'all', now).blocked).toEqual(['picomatch', 'tinyglobby']);
  });
});
