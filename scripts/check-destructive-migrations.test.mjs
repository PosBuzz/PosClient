import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addedMigrationFolders, evaluate, findDestructive } from './check-destructive-migrations.mjs';

test('[BE-SCHEMA-004] the statements that lose data are recognised, comments are not', () => {
  assert.deepEqual(findDestructive('DROP TABLE "x";'), ['DROP TABLE']);
  assert.deepEqual(findDestructive('alter table a drop   column b;'), ['DROP COLUMN']);
  assert.deepEqual(findDestructive('ALTER TABLE a ALTER COLUMN b TYPE integer;'), ['ALTER COLUMN ... TYPE']);
  assert.deepEqual(findDestructive('TRUNCATE TABLE a;'), ['TRUNCATE']);
  assert.deepEqual(findDestructive('-- we never DROP TABLE here\n/* DROP COLUMN */ ALTER INDEX a RENAME TO b;'), []);
  assert.deepEqual(findDestructive('CREATE TABLE a (id int); ALTER TABLE a ADD COLUMN b text;'), []);
});

test('[BE-SCHEMA-004] only migrations added on the branch are checked, once each', () => {
  const diff = [
    'backend/prisma/migrations/20261101000000_drop/migration.sql',
    'backend/prisma/migrations/20261101000000_drop/ALLOW_DESTRUCTIVE.md',
    'backend/prisma/schema.prisma',
    'backend/prisma/migrations/migration_lock.toml',
  ].join('\n');
  assert.deepEqual(addedMigrationFolders(diff), ['backend/prisma/migrations/20261101000000_drop']);
});

test('[BE-SCHEMA-004] a destructive migration needs its explanation file', () => {
  const folder = 'backend/prisma/migrations/20261101000000_drop';
  const read = () => 'ALTER TABLE "sales" DROP COLUMN "notes";';
  const without = evaluate([folder], read, () => false);
  assert.equal(without.length, 1);
  assert.match(without[0], /DROP COLUMN/);
  assert.deepEqual(evaluate([folder], read, () => true), []);
  assert.deepEqual(evaluate([folder], () => 'ALTER INDEX a RENAME TO b;', () => false), []);
});
