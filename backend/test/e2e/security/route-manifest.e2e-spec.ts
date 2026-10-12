import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestApp } from '../../helpers/app';
import { buildManifest, routeKey } from './manifest';

const FILE = resolve(__dirname, '../../../../contracts/routes.json');

describe('route manifest', () => {
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    context = await createTestApp();
  });
  afterAll(async () => {
    await context.app.close();
  });

  it('[BE-ROUTE-001] the extractor sees every controller', () => {
    const manifest = buildManifest(context.app);
    expect(manifest.length).toBeGreaterThanOrEqual(260);
  });

  it('[BE-ROUTE-002] no two handlers share a method and path', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const entry of buildManifest(context.app)) {
      const key = routeKey(entry);
      if (seen.has(key)) {
        duplicates.push(
          `${key}: ${seen.get(key)} and ${entry.controller}.${entry.handler}`,
        );
      }
      seen.set(key, `${entry.controller}.${entry.handler}`);
    }
    expect(duplicates).toEqual([]);
  });

  it('[BE-ROUTE-003] the live manifest equals contracts/routes.json', () => {
    const manifest = buildManifest(context.app);
    if (process.env.UPDATE_CONTRACTS === '1') {
      mkdirSync(resolve(FILE, '..'), { recursive: true });
      writeFileSync(FILE, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    expect(existsSync(FILE)).toBe(true);
    const committed = JSON.parse(readFileSync(FILE, 'utf8'));
    if (JSON.stringify(committed) !== JSON.stringify(manifest)) {
      throw new Error(
        'Route manifest changed. Review, then run UPDATE_CONTRACTS=1 npm run test:e2e and commit contracts/routes.json',
      );
    }
  });
});
