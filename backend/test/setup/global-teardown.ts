import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HarnessGlobal } from './global-setup';

export default async function teardown(): Promise<void> {
  try {
    await (globalThis as HarnessGlobal).__PG__?.stop();
  } finally {
    rmSync(resolve(__dirname, '../.tmp/env.json'), { force: true });
  }
}
