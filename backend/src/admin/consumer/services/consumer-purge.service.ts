import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Permanently erases a tenant and everything belonging to it.
 *
 * A plain `consumer.delete()` cannot do this: the cascade from `consumers`
 * reaches 55 tables, and 20 of the foreign keys along the way are declared
 * RESTRICT (for example `inventory_batches_branch_id_fkey`), which aborts the
 * delete. Those RESTRICTs are deliberate — they stop a branch delete from
 * silently erasing its stock ledger — so this service works around them by
 * deleting the tenant's rows bottom-up instead of relaxing the constraints.
 *
 * The delete order is derived from `pg_constraint` at runtime rather than
 * hard-coded, so adding a table to the schema does not silently break the
 * purge. Anything reachable that this service cannot scope to a consumer is a
 * hard error (see SCOPE below) rather than a row left behind.
 */

/**
 * Tables that have no `consumer_id` of their own. Each entry is the SQL
 * predicate that selects the rows belonging to consumer `$1`, reached through
 * the table's owning parent. A function, not a constant, so its predicates run
 * inside tests and mutation testing can see them.
 */
export const consumerScope = (): Record<string, string> => ({
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

interface TableInfo {
  name: string;
  hasConsumerId: boolean;
}

@Injectable()
export class ConsumerPurgeService {
  private readonly logger = new Logger(ConsumerPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Every table reachable from `consumers` by following foreign keys. */
  private async reachableTables(tx: any): Promise<TableInfo[]> {
    const rows: any[] = await tx.$queryRawUnsafe(`
      WITH RECURSIVE deps AS (
        SELECT c.conrelid AS tbl
        FROM pg_constraint c
        WHERE c.confrelid = 'consumers'::regclass AND c.contype = 'f'
        UNION
        SELECT c.conrelid
        FROM pg_constraint c
        JOIN deps d ON c.confrelid = d.tbl
        WHERE c.contype = 'f' AND c.conrelid <> d.tbl
      )
      SELECT DISTINCT t.relname AS name,
        EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_name = t.relname
            AND col.column_name = 'consumer_id'
            AND col.table_schema = 'public'
        ) AS has_consumer_id
      FROM deps d
      JOIN pg_class t ON t.oid = d.tbl
    `);

    return rows.map((r) => ({
      name: r.name,
      hasConsumerId: r.has_consumer_id,
    }));
  }

  /**
   * Orders tables so that every child is deleted before the parent it points
   * at, which is what keeps the RESTRICT constraints satisfied.
   */
  private async deleteOrder(tx: any, tables: TableInfo[]): Promise<string[]> {
    const names = new Set(tables.map((t) => t.name));

    const edges: any[] = await tx.$queryRawUnsafe(`
      SELECT ch.relname AS child, pa.relname AS parent
      FROM pg_constraint c
      JOIN pg_class ch ON ch.oid = c.conrelid
      JOIN pg_class pa ON pa.oid = c.confrelid
      WHERE c.contype = 'f' AND c.conrelid <> c.confrelid
    `);

    // dependents[parent] = children that must go first
    const dependents = new Map<string, Set<string>>();
    const pending = new Map<string, number>();
    for (const n of names) {
      dependents.set(n, new Set());
      pending.set(n, 0);
    }

    for (const e of edges) {
      if (!names.has(e.child) || !names.has(e.parent)) continue;
      const set = dependents.get(e.parent)!;
      if (set.has(e.child)) continue;
      set.add(e.child);
      pending.set(e.child, (pending.get(e.child) || 0) + 1);
    }

    // Kahn's algorithm: emit tables with no remaining un-deleted dependencies.
    const ready = [...names].filter((n) => (pending.get(n) || 0) === 0);
    const order: string[] = [];

    while (ready.length) {
      const table = ready.shift()!;
      order.push(table);
      for (const child of dependents.get(table) || []) {
        const left = (pending.get(child) || 0) - 1;
        pending.set(child, left);
        if (left === 0) ready.push(child);
      }
    }

    if (order.length !== names.size) {
      const stuck = [...names].filter((n) => !order.includes(n));
      throw new HttpException(
        `Cannot purge: foreign key cycle involving ${stuck.join(', ')}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // `order` currently lists parents before children; delete the reverse.
    return order.reverse();
  }

  /**
   * Permanently deletes a consumer and all of its data. Irreversible.
   *
   * @param confirmSubdomain must equal the consumer's subdomain, so a wrong id
   *   cannot destroy the wrong tenant.
   */
  async purge(id: number, confirmSubdomain: string) {
    const consumer = await this.prisma.consumer.findUnique({
      where: { id },
      select: { id: true, subdomain: true, company_name: true },
    });

    if (!consumer) {
      throw new HttpException('Consumer not found', HttpStatus.NOT_FOUND);
    }

    if (confirmSubdomain !== consumer.subdomain) {
      throw new HttpException(
        `Confirmation failed: expected the subdomain '${consumer.subdomain}'`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.warn(
      `PURGE starting for consumer ${id} (${consumer.subdomain})`,
    );

    const deleted: Record<string, number> = {};

    await this.prisma.$transaction(
      async (tx) => {
        const scope = consumerScope();
        const tables = await this.reachableTables(tx);
        const byName = new Map(tables.map((t) => [t.name, t]));

        // Fail before deleting anything if a reachable table cannot be scoped.
        const unmapped = tables
          .filter((t) => !t.hasConsumerId && !scope[t.name])
          .map((t) => t.name);

        if (unmapped.length) {
          throw new HttpException(
            `Cannot purge safely: no consumer scope defined for ${unmapped.join(', ')}. ` +
              `Add them to SCOPE in consumer-purge.service.ts.`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        for (const table of await this.deleteOrder(tx, tables)) {
          const info = byName.get(table)!;
          const where = info.hasConsumerId ? `consumer_id = $1` : scope[table];

          const count = await tx.$executeRawUnsafe(
            `DELETE FROM "${table}" WHERE ${where}`,
            id,
          );

          if (count > 0) deleted[table] = count;
        }

        await tx.$executeRawUnsafe(`DELETE FROM "consumers" WHERE id = $1`, id);
      },
      { timeout: 120_000 },
    );

    this.logger.warn(
      `PURGE complete for consumer ${id} (${consumer.subdomain}): ` +
        `${Object.values(deleted).reduce((a, b) => a + b, 0)} rows`,
    );

    return {
      success: true,
      purged: true,
      consumer: { id: consumer.id, subdomain: consumer.subdomain },
      deleted_rows: deleted,
    };
  }
}
