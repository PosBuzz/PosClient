import { HttpException, Logger } from '@nestjs/common';
import { ConsumerPurgeService, consumerScope } from './consumer-purge.service';

type Table = { name: string; has_consumer_id: boolean };
type Edge = { child: string; parent: string };

function setup(
  tables: Table[],
  edges: Edge[],
  counts: Record<string, number> = {},
) {
  const executed: Array<{ sql: string; arg: unknown }> = [];
  const tx = {
    $queryRawUnsafe: jest
      .fn()
      .mockResolvedValueOnce(tables)
      .mockResolvedValueOnce(edges),
    $executeRawUnsafe: jest.fn(async (sql: string, arg: unknown) => {
      executed.push({ sql, arg });
      const table = /DELETE FROM "(\w+)"/.exec(sql)![1];
      return counts[table] ?? 0;
    }),
  };
  const prisma: any = {
    consumer: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (t: unknown) => unknown, opts: unknown) => {
      prisma.lastOptions = opts;
      return fn(tx);
    }),
  };
  prisma.consumer.findUnique.mockResolvedValue({
    id: 7,
    subdomain: 'acme',
    company_name: 'Acme',
  });
  return { prisma, tx, executed, service: new ConsumerPurgeService(prisma) };
}

describe('ConsumerPurgeService (unit)', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('[BE-MUT-300] the scope table is pinned: every tenant-less table reaches the consumer through its owning parent', () => {
    expect(consumerScope()).toEqual({
      product_variants: `product_id IN (SELECT id FROM products WHERE consumer_id = $1)`,
      price_history: `variant_id IN (SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.consumer_id = $1)`,
      product_serials: `variant_id IN (SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.consumer_id = $1)`,
      tag_on_products: `product_id IN (SELECT id FROM products WHERE consumer_id = $1)`,
      promotion_products: `promotion_id IN (SELECT id FROM promotions WHERE consumer_id = $1)`,
      promotion_branches: `promotion_id IN (SELECT id FROM promotions WHERE consumer_id = $1)`,
      role_permissions: `role_id IN (SELECT id FROM roles WHERE consumer_id = $1)`,
      user_branches: `user_id IN (SELECT id FROM users WHERE consumer_id = $1)`,
      inventory_batches: `branch_id IN (SELECT id FROM branches WHERE consumer_id = $1)`,
      inventory_adjustments: `branch_id IN (SELECT id FROM branches WHERE consumer_id = $1)`,
      inventory_transfers: `source_branch_id IN (SELECT id FROM branches WHERE consumer_id = $1)`,
      inventory_transfer_items: `transfer_id IN (SELECT t.id FROM inventory_transfers t JOIN branches b ON b.id = t.source_branch_id WHERE b.consumer_id = $1)`,
      purchase_payments: `batch_id IN (SELECT ib.id FROM inventory_batches ib JOIN branches b ON b.id = ib.branch_id WHERE b.consumer_id = $1)`,
      sale_items: `sale_id IN (SELECT id FROM sales WHERE consumer_id = $1)`,
      sale_payments: `sale_id IN (SELECT id FROM sales WHERE consumer_id = $1)`,
      return_items: `return_id IN (SELECT id FROM returns WHERE consumer_id = $1)`,
      return_exchanges: `return_id IN (SELECT id FROM returns WHERE consumer_id = $1)`,
      return_payments: `return_id IN (SELECT id FROM returns WHERE consumer_id = $1)`,
      advance_payments: `advance_id IN (SELECT id FROM advances WHERE consumer_id = $1)`,
      deduction_payments: `deduction_id IN (SELECT id FROM deductions WHERE consumer_id = $1)`,
      expense_payments: `expense_id IN (SELECT id FROM "Expense" WHERE consumer_id = $1)`,
      overtime_payments: `overtime_id IN (SELECT id FROM overtimes WHERE consumer_id = $1)`,
      support_ticket_messages: `ticket_id IN (SELECT id FROM support_tickets WHERE consumer_id = $1)`,
      consumer_data_imports: `source_consumer_id = $1 OR target_consumer_id = $1`,
      consumer_import_mappings: `source_consumer_id = $1 OR target_consumer_id = $1`,
    });
  });

  it('[BE-MUT-301] an unknown consumer is a 404 and a wrong confirmation is a 400 naming the expected subdomain; nothing is deleted', async () => {
    const { prisma, service } = setup([], []);
    prisma.consumer.findUnique.mockResolvedValueOnce(null);
    const missing = await service.purge(7, 'acme').catch((e) => e);
    expect(missing).toBeInstanceOf(HttpException);
    expect(missing.getStatus()).toBe(404);
    expect(missing.message).toBe('Consumer not found');
    expect(prisma.consumer.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { id: true, subdomain: true, company_name: true },
    });
    const wrong = await service.purge(7, 'other').catch((e) => e);
    expect(wrong.getStatus()).toBe(400);
    expect(wrong.message).toBe(
      "Confirmation failed: expected the subdomain 'acme'",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('[BE-MUT-302] children are deleted before parents, the consumer row last, each scoped to the consumer id', async () => {
    const { service, executed, prisma } = setup(
      [
        { name: 'roles', has_consumer_id: true },
        { name: 'role_permissions', has_consumer_id: false },
        { name: 'users', has_consumer_id: true },
      ],
      [
        { child: 'role_permissions', parent: 'roles' },
        { child: 'users', parent: 'roles' },
        { child: 'role_permissions', parent: 'roles' },
        { child: 'outside', parent: 'roles' },
      ],
    );
    await service.purge(7, 'acme');
    const tables = executed.map((e) => /"(\w+)"/.exec(e.sql)![1]);
    expect(tables.at(-1)).toBe('consumers');
    expect(tables.indexOf('roles')).toBeGreaterThan(
      tables.indexOf('role_permissions'),
    );
    expect(tables.indexOf('roles')).toBeGreaterThan(tables.indexOf('users'));
    expect(tables).toHaveLength(4);
    const sqlFor = (t: string) =>
      executed.find((e) => e.sql.includes(`"${t}"`))!;
    expect(sqlFor('roles')).toEqual({
      sql: 'DELETE FROM "roles" WHERE consumer_id = $1',
      arg: 7,
    });
    expect(sqlFor('users').sql).toBe(
      'DELETE FROM "users" WHERE consumer_id = $1',
    );
    expect(sqlFor('role_permissions')).toEqual({
      sql: `DELETE FROM "role_permissions" WHERE ${consumerScope().role_permissions}`,
      arg: 7,
    });
    expect(sqlFor('consumers')).toEqual({
      sql: 'DELETE FROM "consumers" WHERE id = $1',
      arg: 7,
    });
    expect(prisma.lastOptions).toEqual({ timeout: 120_000 });
  });

  it('[BE-MUT-303] the report counts only tables that lost rows and the log totals every deleted row', async () => {
    const { service } = setup(
      [
        { name: 'roles', has_consumer_id: true },
        { name: 'users', has_consumer_id: true },
        { name: 'branches', has_consumer_id: true },
      ],
      [],
      { roles: 2, users: 3 },
    );
    await expect(service.purge(7, 'acme')).resolves.toEqual({
      success: true,
      purged: true,
      consumer: { id: 7, subdomain: 'acme' },
      deleted_rows: { roles: 2, users: 3 },
    });
    expect(warn).toHaveBeenNthCalledWith(
      1,
      'PURGE starting for consumer 7 (acme)',
    );
    expect(warn).toHaveBeenNthCalledWith(
      2,
      'PURGE complete for consumer 7 (acme): 5 rows',
    );
  });

  it('[BE-MUT-304] the reachable-table and edge queries read pg_constraint, ignoring self references', async () => {
    const { service, tx } = setup([], []);
    await service.purge(7, 'acme');
    const [reachable, edges] = tx.$queryRawUnsafe.mock.calls.map(
      ([sql]: [string]) => sql,
    );
    expect(reachable).toContain("c.confrelid = 'consumers'::regclass");
    expect(reachable).toContain("col.column_name = 'consumer_id'");
    expect(reachable).toContain("col.table_schema = 'public'");
    expect(reachable).toContain('c.conrelid <> d.tbl');
    expect(edges).toContain("c.contype = 'f' AND c.conrelid <> c.confrelid");
  });

  it('[BE-MUT-305] a reachable table with no consumer scope aborts before any delete and lists every culprit', async () => {
    const { service, executed } = setup(
      [
        { name: 'roles', has_consumer_id: true },
        { name: 'mystery_a', has_consumer_id: false },
        { name: 'mystery_b', has_consumer_id: false },
        { name: 'role_permissions', has_consumer_id: false },
      ],
      [],
    );
    const error = await service.purge(7, 'acme').catch((e) => e);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe(
      'Cannot purge safely: no consumer scope defined for mystery_a, mystery_b. Add them to SCOPE in consumer-purge.service.ts.',
    );
    expect(executed).toEqual([]);
  });

  it('[BE-MUT-306] a foreign key cycle aborts before any delete and names the stuck tables', async () => {
    const { service, executed } = setup(
      [
        { name: 'a', has_consumer_id: true },
        { name: 'b', has_consumer_id: true },
        { name: 'c', has_consumer_id: true },
      ],
      [
        { child: 'a', parent: 'b' },
        { child: 'b', parent: 'a' },
      ],
    );
    const error = await service.purge(7, 'acme').catch((e) => e);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe(
      'Cannot purge: foreign key cycle involving a, b',
    );
    expect(executed).toEqual([]);
  });
});
