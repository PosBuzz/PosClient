import { readFileSync } from 'fs';
import { join } from 'path';

import { SCOPE } from './consumer-purge.service';

/**
 * The purge refuses to run when a tenant-owned table cannot be scoped to a
 * consumer, which is safe but only surfaces in the admin panel at the moment
 * someone tries to delete a tenant. This checks the same invariant against
 * schema.prisma, so adding a table without a `consumer_id` fails here first.
 *
 * Reads the schema file rather than a database: no connection, runs in CI.
 */

interface Model {
  name: string;
  table: string;
  hasConsumerId: boolean;
  /** Models this one points at through a foreign key (its parents). */
  parents: string[];
}

const parseModels = (): Model[] => {
  const schema = readFileSync(
    join(__dirname, '../../../../prisma/schema.prisma'),
    'utf8',
  );

  const models: Model[] = [];
  const modelBlock = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  let match: RegExpExecArray | null;
  while ((match = modelBlock.exec(schema))) {
    const [, name, body] = match;
    const lines = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));

    const mapped = body.match(/@@map\("([^"]+)"\)/);
    const parents: string[] = [];

    for (const line of lines) {
      // A relation that declares `fields:` owns the foreign key, which makes
      // this model the child and the referenced type its parent.
      if (!line.includes('@relation') || !line.includes('fields:')) continue;

      const target = line.split(/\s+/)[1];
      if (target) parents.push(target.replace(/[?[\]]/g, ''));
    }

    models.push({
      name,
      table: mapped ? mapped[1] : name,
      hasConsumerId: lines.some((line) => /^consumer_id\s/.test(line)),
      parents,
    });
  }

  return models;
};

/** Every model reachable from Consumer by following foreign keys downwards. */
const reachableFromConsumer = (models: Model[]): Model[] => {
  const children = new Map<string, string[]>();
  for (const model of models) {
    for (const parent of model.parents) {
      children.set(parent, [...(children.get(parent) ?? []), model.name]);
    }
  }

  const seen = new Set<string>();
  const queue = [...(children.get('Consumer') ?? [])];

  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(children.get(current) ?? []));
  }

  return models.filter((model) => seen.has(model.name));
};

describe('consumer purge SCOPE', () => {
  const models = parseModels();
  const reachable = reachableFromConsumer(models);

  it('parses the schema', () => {
    expect(models.length).toBeGreaterThan(50);
    expect(reachable.length).toBeGreaterThan(50);
    expect(reachable.map((m) => m.table)).toContain('support_ticket_messages');
  });

  it('scopes every tenant-owned table that has no consumer_id', () => {
    const unmapped = reachable
      .filter((model) => !model.hasConsumerId && !SCOPE[model.table])
      .map((model) => model.table);

    expect(unmapped).toEqual([]);
  });

  it('has no SCOPE entries for tables that are already scoped or gone', () => {
    const needsScope = new Set(
      reachable.filter((m) => !m.hasConsumerId).map((m) => m.table),
    );

    const stale = Object.keys(SCOPE).filter((table) => !needsScope.has(table));

    expect(stale).toEqual([]);
  });
});
