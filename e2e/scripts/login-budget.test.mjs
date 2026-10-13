import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('[E2E-HARN-001] a restarted worker cannot forget the previous four login attempts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'posbuzz-login-budget-'));
  const path = join(directory, 'budget.json');
  const module = new URL('./login-budget.mjs', import.meta.url).href;
  const reserve = (key, now) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `import {reserveLoginSlot} from ${JSON.stringify(module)}; console.log(JSON.stringify(reserveLoginSlot(process.argv[1],process.argv[2],Number(process.argv[3]))));`, path, key, String(now)], {encoding: 'utf8'}));
  try {
    for (let attempt = 0; attempt < 4; attempt++) assert.deepEqual(reserve('consumer', 100000), {reserved: true, wait: 0});
    assert.deepEqual(reserve('consumer', 100001), {reserved: false, wait: 60999});
    assert.deepEqual(reserve('admin', 100001), {reserved: true, wait: 0});
    assert.deepEqual(reserve('consumer', 161001), {reserved: true, wait: 0});
  } finally {rmSync(directory, {recursive: true, force: true});}
});
