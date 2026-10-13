import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { claimedTags, serviceInventory } from './service-inventory';

const dir = __dirname;
const read = <T>(name: string, fallback: T): T =>
  existsSync(join(dir, name))
    ? (JSON.parse(readFileSync(join(dir, name), 'utf8')) as T)
    : fallback;
const write = (name: string, value: unknown) =>
  writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`);

const inventory = serviceInventory();
const keys = inventory.map((item) => `${item.service}.${item.method}`);
const claims = claimedTags();
const UPDATE = process.env.UPDATE_COVERAGE === '1';

if (UPDATE) {
  write('service-methods.json', inventory);
  const gaps = keys.filter((key) => !claims.has(key));
  if (gaps.length) write('known-gaps.json', gaps);
  else rmSync(join(dir, 'known-gaps.json'), { force: true });
}

describe('every public service method is claimed by a test (B8)', () => {
  it('[BE-COV-001] the live inventory equals the committed service-methods.json', () => {
    const committed = read<typeof inventory>('service-methods.json', []);
    expect(inventory).toEqual(committed);
    expect(inventory.length).toBeGreaterThan(250);
  });

  it('[BE-COV-010] every method is claimed by a {Service.method} test title or listed in known-gaps.json', () => {
    const gaps = new Set(read<string[]>('known-gaps.json', []));
    const unclaimed = keys.filter((key) => !claims.has(key) && !gaps.has(key));
    expect(unclaimed).toEqual([]);
  });

  it('[BE-COV-010] known-gaps.json only lists methods that exist and are still unclaimed', () => {
    const gaps = read<string[]>('known-gaps.json', []);
    const stale = gaps.filter((key) => !keys.includes(key) || claims.has(key));
    expect(stale).toEqual([]);
  });

  it('[BE-COV-011] every tag used in a test names a real method', () => {
    const unknown = [...claims.keys()].filter((tag) => !keys.includes(tag));
    expect(unknown).toEqual([]);
  });

  it('[BE-COV-013] exemptions stay few, each with a reason, and still exist', () => {
    const exemptions = read<Record<string, string>>('exemptions.json', {});
    expect(Object.keys(exemptions).length).toBeLessThanOrEqual(10);
    for (const [key, reason] of Object.entries(exemptions)) {
      expect(keys).toContain(key);
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});
