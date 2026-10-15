import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const high = (severity) => ['high', 'critical'].includes(severity);
const severities = ['info', 'low', 'moderate', 'high', 'critical'];

export function evaluateAudit({ report, status, app, lock, exceptions = [], source = '', today = new Date().toISOString().slice(0, 10), baseLock, deltaOnly = false }) {
  if (!['backend', 'consumer', 'admin'].includes(app)) throw new Error('Unknown application');
  if (![0, 1].includes(status) || !object(report) || report.error || report.auditReportVersion !== 2 || !object(report.vulnerabilities) || !object(report.metadata?.vulnerabilities)) {
    throw new Error('Audit failed or returned an unsupported/malformed report');
  }
  const counts = report.metadata.vulnerabilities;
  if (![...severities, 'total'].every((key) => Number.isInteger(counts[key]) && counts[key] >= 0) || severities.reduce((sum, key) => sum + counts[key], 0) !== counts.total || counts.total !== Object.keys(report.vulnerabilities).length) {
    throw new Error('Invalid audit vulnerability counts');
  }
  if (lock?.lockfileVersion !== 3 || !object(lock.packages) || (baseLock && !object(baseLock.packages))) throw new Error('Invalid lockfile');
  if (deltaOnly && !baseLock) throw new Error('PR review requires a base lockfile');
  if (!Array.isArray(exceptions)) throw new Error('Invalid exception list');
  const problems = new Set();
  const accepted = new Set();
  const vulnerabilities = report.vulnerabilities;
  const leaves = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`Cyclic advisory reference: ${name}`);
    const entry = vulnerabilities[name];
    if (!object(entry) || !severities.includes(entry.severity) || !Array.isArray(entry.via) || !Array.isArray(entry.nodes) || !entry.nodes.length) throw new Error(`Malformed vulnerability: ${name}`);
    for (const path of entry.nodes) if (typeof lock.packages[path]?.version !== 'string') throw new Error(`Unresolved dependency: ${path}`);
    return entry.via.flatMap((via) => {
      if (typeof via === 'string') return leaves(via, new Set([...seen, name]));
      if (!object(via) || !severities.includes(via.severity) || typeof via.url !== 'string') throw new Error(`Malformed advisory: ${name}`);
      return [{ advisory: via, packageName: name, nodes: entry.nodes }];
    });
  };
  const unchanged = (paths) => paths.every((path) => baseLock?.packages[path]?.version === lock.packages[path].version);
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    const findings = leaves(name);
    const severe = findings.filter(({ advisory }) => high(advisory.severity));
    if (high(entry.severity) && !severe.length) throw new Error(`High-severity finding has no explainable advisory: ${name}`);
    for (const finding of severe) {
      if (deltaOnly && unchanged(entry.nodes) && unchanged(finding.nodes)) continue;
      const id = finding.advisory.url.match(/^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9-]+)$/)?.[1];
      if (!id) throw new Error(`Unrecognized advisory identifier: ${name}`);
      for (const path of finding.nodes) {
        const version = lock.packages[path].version;
        const exception = exceptions.find((item) => item.app === app && item.advisory === id && item.package === finding.packageName && item.path === path && item.version === version);
        const allowed = !deltaOnly && exception && id === 'GHSA-qwww-vcr4-c8h2' && ['consumer', 'admin'].includes(app) && finding.packageName === 'react-router' && exception.justification === 'SECURITY-NOTES.md' && exception.owner === 'Istiak-A-Tashrif' && /^\d{4}-\d{2}-\d{2}$/.test(exception.expires) && exception.expires >= today && !/createBrowserRouter|createHashRouter|@react-router\/serve|['"]use server['"]|\b(?:loader|action)\s*:/.test(source) && (!baseLock || unchanged([path]));
        if (allowed) accepted.add(`${id} ${path}@${version}`);
        else problems.add(`${app}: ${id} ${finding.packageName}@${version} (${path})`);
      }
    }
  }
  if (status === 1 && !Object.keys(vulnerabilities).length) throw new Error('Audit failed without findings');
  return { problems: [...problems], accepted: [...accepted], counts: report.metadata.vulnerabilities };
}

function sourceTree(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceTree(path) : /\.[jt]sx?$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  }).join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [reportFile, rawStatus, app, baseFile, mode] = process.argv.slice(2);
    if (!['0', '1'].includes(rawStatus)) throw new Error('Audit command failed');
    const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
    const result = evaluateAudit({ report: load(reportFile), status: Number(rawStatus), app, lock: load(join(root, app, 'package-lock.json')), exceptions: load(join(root, '.github', 'audit-exceptions.json')), source: sourceTree(join(root, app, 'src')) + readFileSync(join(root, app, 'package.json'), 'utf8'), baseLock: baseFile ? load(baseFile) : undefined, deltaOnly: mode === 'delta' });
    console.log(`${app}: ${JSON.stringify(result.counts)}`);
    for (const item of result.accepted) console.log(`Documented exception: ${item}`);
    for (const item of result.problems) console.error(item);
    if (result.problems.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Dependency audit rejected: ${error.message}`);
    process.exitCode = 1;
  }
}
