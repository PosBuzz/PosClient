import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Shared across Playwright's restarted repeat/retry workers; four attempts per 61-second window. */
export function reserveLoginSlot(path, key, now = Date.now()) {
  mkdirSync(dirname(path), {recursive: true});
  const lockPath = `${path}.lock`;
  let lock;
  try {lock = openSync(lockPath, 'wx');}
  catch (error) {if (error.code === 'EEXIST') return {reserved: false, wait: 25}; throw error;}
  try {
    const budget = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    const prior = budget[key] ?? [];
    if (!Array.isArray(prior) || prior.some(time => !Number.isFinite(time))) throw new Error('Invalid E2E login budget state');
    const recent = prior.filter(time => now - time < 61000).sort((a,b) => a-b);
    if (recent.length >= 4) return {reserved: false, wait: Math.max(1, 61000 - (now - recent[0]))};
    budget[key] = [...recent, now];
    const temporary = `${path}.${process.pid}.next`;
    writeFileSync(temporary, JSON.stringify(budget), {mode: 0o600});
    renameSync(temporary, path);
    return {reserved: true, wait: 0};
  } finally {closeSync(lock); unlinkSync(lockPath);}
}
