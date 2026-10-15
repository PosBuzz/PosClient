import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAudit } from './check-production-audit.mjs';
const path = 'node_modules/react-router';
const id = 'GHSA-qwww-vcr4-c8h2';
const fixture = () => ({
  app: 'consumer', status: 1, today: '2026-10-13', source: 'BrowserRouter',
  lock: { lockfileVersion: 3, packages: { [path]: { version: '7.18.1' } } },
  exceptions: [{ app: 'consumer', advisory: id, package: 'react-router', path, version: '7.18.1', justification: 'SECURITY-NOTES.md', owner: 'Istiak-A-Tashrif', expires: '2027-01-13' }],
  report: { auditReportVersion: 2, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } }, vulnerabilities: { 'react-router': { severity: 'high', nodes: [path], via: [{ severity: 'high', url: `https://github.com/advisories/${id}` }] } } },
});
test('[X-DEP-002] exception matching stays scoped; production config has no active exceptions', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../.github/audit-exceptions.json', import.meta.url), 'utf8')), []);
  const f = fixture(); assert.ok(evaluateAudit({ ...f, exceptions: [] }).problems.length);
  assert.equal(evaluateAudit(f).problems.length, 0);
  f.report.vulnerabilities['react-router'].via.push({ severity: 'critical', url: 'https://github.com/advisories/GHSA-abcd-1234-5678' });
  assert.equal(evaluateAudit(f).problems.length, 1);
});
for (const [name, change] of [
  ['changed version', f => { f.lock.packages[path].version = '7.19.0'; }],
  ['expired exception', f => { f.today = '2027-01-14'; }],
  ['server routing', f => { f.source = 'createBrowserRouter([])'; }],
  ['different app', f => { f.app = 'backend'; }],
]) test(`[X-DEP-002] rejects ${name}`, () => { const f = fixture(); change(f); assert.ok(evaluateAudit(f).problems.length); });
test('[X-DEP-001] follows transitive findings', () => {
  const f = fixture(); f.lock.packages['node_modules/react-router-dom'] = { version: '7.18.1' };
  f.report.metadata.vulnerabilities.high = 2; f.report.metadata.vulnerabilities.total = 2;
  f.report.vulnerabilities['react-router-dom'] = { severity: 'high', nodes: ['node_modules/react-router-dom'], via: ['react-router'] };
  f.exceptions = []; assert.ok(evaluateAudit(f).problems.length);
});
for (const [name, change] of [
  ['network error', f => { f.status = 2; }],
  ['registry error', f => { f.report.error = { code: 'E500' }; }],
  ['invalid counts', f => { f.report.metadata.vulnerabilities = {}; }],
  ['missing report', f => { f.report = null; }],
  ['unsupported schema', f => { f.report.auditReportVersion = 3; }],
  ['missing package', f => { f.lock.packages = {}; }],
  ['unresolved transitive advisory', f => { f.report.vulnerabilities['react-router'].via = ['missing']; }],
  ['unexplained high severity', f => { f.report.vulnerabilities['react-router'].via = []; }],
]) test(`[X-DEP-001] fails closed on ${name}`, () => { const f = fixture(); change(f); assert.throws(() => evaluateAudit(f)); });
test('[X-DEP-003] PR review tolerates unchanged findings but blocks new vulnerable versions', () => {
  const f = fixture(); f.baseLock = structuredClone(f.lock); f.deltaOnly = true;
  assert.equal(evaluateAudit(f).problems.length, 0);
  f.lock.packages[path].version = '7.19.0'; assert.ok(evaluateAudit(f).problems.length);
});
test('[X-DEP-003] a newly introduced vulnerable parent is blocked', () => {
  const f = fixture(); f.baseLock = structuredClone(f.lock); f.deltaOnly = true;
  f.lock.packages['node_modules/react-router-dom'] = { version: '7.18.1' };
  f.report.metadata.vulnerabilities.high = 2; f.report.metadata.vulnerabilities.total = 2;
  f.report.vulnerabilities['react-router-dom'] = { severity: 'high', nodes: ['node_modules/react-router-dom'], via: ['react-router'] };
  assert.ok(evaluateAudit(f).problems.length);
});
