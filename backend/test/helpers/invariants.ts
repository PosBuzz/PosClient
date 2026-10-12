import { PrismaClient } from '@prisma/client';

/**
 * The B3/B4 invariant net. Every check is plain SQL that never touches service code,
 * so a bug in a service cannot also hide itself here. Call `assertInvariants` in afterEach.
 */
export type Violation = { id: string; detail: string };

const q = <T>(db: PrismaClient, sql: string) => db.$queryRawUnsafe<T[]>(sql);
const cents = '0.011';

export async function findViolations(db: PrismaClient): Promise<Violation[]> {
  const out: Violation[] = [];
  const add = (id: string, rows: object[]) =>
    rows.forEach((row) => out.push({ id, detail: JSON.stringify(row) }));

  // INV-01 stock conservation: batch quantity equals the sum of its audit deltas
  add(
    'INV-01',
    await q(
      db,
      `SELECT b.id AS batch_id, b.quantity, COALESCE(SUM(a.quantity_delta),0)::int AS audited
       FROM inventory_batches b LEFT JOIN inventory_audit_logs a ON a.batch_id = b.id
       GROUP BY b.id HAVING b.quantity <> COALESCE(SUM(a.quantity_delta),0)`,
    ),
  );
  // INV-02 / INV-03
  add(
    'INV-02',
    await q(
      db,
      `SELECT id AS batch_id, quantity FROM inventory_batches WHERE quantity < 0`,
    ),
  );
  add(
    'INV-03',
    await q(
      db,
      `SELECT id AS batch_id, quantity, reserved_quantity FROM inventory_batches
       WHERE reserved_quantity < 0 OR reserved_quantity > quantity`,
    ),
  );
  // INV-04 the latest audit row of each batch reports the current quantity
  add(
    'INV-04',
    await q(
      db,
      `SELECT b.id AS batch_id, b.quantity, l.quantity_after
       FROM inventory_batches b
       JOIN LATERAL (SELECT quantity_after FROM inventory_audit_logs
                     WHERE batch_id = b.id ORDER BY id DESC LIMIT 1) l ON true
       WHERE l.quantity_after <> b.quantity`,
    ),
  );
  // INV-05 sale arithmetic (quotations are not money movements but must still add up)
  add(
    'INV-05',
    await q(
      db,
      `SELECT id AS sale_id, total_amount, subtotal, discount_amount, tax_amount, shipping_cost FROM sales
       WHERE ABS(total_amount - (subtotal - discount_amount + tax_amount + shipping_cost)) > ${cents}`,
    ),
  );
  // INV-06 sale discount equals its item discounts (sales that only carry a sale-level
  // promotion discount without per-item amounts are the legacy path and are exempt)
  add(
    'INV-06',
    await q(
      db,
      `SELECT s.id AS sale_id, s.discount_amount, i.items_discount
       FROM sales s JOIN (
         SELECT sale_id, SUM(average_discount_amount + special_discount_amount + promotion_discount_amount) AS items_discount,
                SUM(promotion_discount_amount) AS item_promo
         FROM sale_items GROUP BY sale_id) i ON i.sale_id = s.id
       WHERE ABS(s.discount_amount - i.items_discount) > ${cents}
         AND NOT (s.promotion_id IS NOT NULL AND i.item_promo = 0)`,
    ),
  );
  // INV-07 received amount equals recorded payments (sales, not quotations)
  add(
    'INV-07',
    await q(
      db,
      `SELECT s.id AS sale_id, s.received_amount, COALESCE(p.paid,0) AS payments
       FROM sales s LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM sale_payments GROUP BY sale_id) p ON p.sale_id = s.id
       WHERE s.sale_type <> 'quotation' AND ABS(s.received_amount - COALESCE(p.paid,0)) > ${cents}`,
    ),
  );
  // INV-08 payment status agrees with the amounts
  add(
    'INV-08',
    await q(
      db,
      `SELECT id AS sale_id, payment_status, received_amount, total_amount FROM sales
       WHERE sale_type <> 'quotation' AND payment_status <> 'cancelled' AND NOT (
         (received_amount = 0 AND payment_status = 'due') OR
         (received_amount > 0 AND received_amount < total_amount - 0.005 AND payment_status = 'partial') OR
         (received_amount >= total_amount - 0.005 AND received_amount > 0 AND payment_status = 'paid'))`,
    ),
  );
  // INV-09 refunds never exceed what the sale was worth
  add(
    'INV-09',
    await q(
      db,
      `SELECT r.original_sale_id AS sale_id, SUM(r.total_refund) AS refunded, s.total_amount
       FROM returns r JOIN sales s ON s.id = r.original_sale_id
       GROUP BY r.original_sale_id, s.total_amount HAVING SUM(r.total_refund) > s.total_amount + ${cents}`,
    ),
  );
  // INV-10 returned quantity never exceeds sold quantity
  add(
    'INV-10',
    await q(
      db,
      `SELECT si.id AS sale_item_id, si.quantity, SUM(ri.quantity)::int AS returned
       FROM sale_items si JOIN return_items ri ON ri.sale_item_id = si.id
       GROUP BY si.id, si.quantity HAVING SUM(ri.quantity) > si.quantity`,
    ),
  );
  // INV-11 rewards ledger
  add(
    'INV-11',
    await q(
      db,
      `SELECT c.customer_id, c.total_points, l.balance_after
       FROM customer_rewards_points c
       JOIN LATERAL (SELECT balance_after FROM rewards_point_transactions
                     WHERE customer_id = c.customer_id ORDER BY id DESC LIMIT 1) l ON true
       WHERE l.balance_after <> c.total_points`,
    ),
  );
  add(
    'INV-11',
    await q(
      db,
      `SELECT id AS transaction_id, type, points, balance_before, balance_after
       FROM rewards_point_transactions WHERE balance_after <> balance_before + points`,
    ),
  );
  add(
    'INV-11',
    await q(
      db,
      `SELECT customer_id, total_points FROM customer_rewards_points WHERE total_points < 0`,
    ),
  );
  // INV-12 tenant consistency
  add(
    'INV-12',
    await q(
      db,
      `SELECT si.id AS sale_item_id FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN product_variants v ON v.id = si.variant_id JOIN products p ON p.id = v.product_id
       WHERE p.consumer_id <> s.consumer_id`,
    ),
  );
  add(
    'INV-12',
    await q(
      db,
      `SELECT a.id AS audit_id FROM inventory_audit_logs a
       JOIN inventory_batches b ON b.id = a.batch_id
       JOIN product_variants v ON v.id = b.variant_id JOIN products p ON p.id = v.product_id
       WHERE p.consumer_id <> a.consumer_id`,
    ),
  );
  add(
    'INV-12',
    await q(
      db,
      `SELECT ri.id AS return_item_id FROM return_items ri
       JOIN returns r ON r.id = ri.return_id
       JOIN inventory_batches b ON b.id = ri.batch_id
       JOIN product_variants v ON v.id = b.variant_id JOIN products p ON p.id = v.product_id
       WHERE p.consumer_id <> r.consumer_id`,
    ),
  );
  return out;
}

/** Hash of everything one tenant owns; INV-13 compares it before and after a test. */
export async function snapshotTenant(
  db: PrismaClient,
  consumerId: number,
): Promise<string> {
  const tables = await q<{ table_name: string }>(
    db,
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'consumer_id' ORDER BY table_name`,
  );
  const parts: string[] = [];
  for (const { table_name } of tables) {
    const rows = await q<{ h: string }>(
      db,
      `SELECT COALESCE(md5(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text)), '') AS h
       FROM "${table_name}" t WHERE t.consumer_id = ${Number(consumerId)}`,
    );
    parts.push(`${table_name}:${rows[0].h}`);
  }
  // Children that carry no consumer_id of their own
  const children: [string, string][] = [
    [
      'inventory_batches',
      `SELECT b.* FROM inventory_batches b JOIN branches br ON br.id = b.branch_id WHERE br.consumer_id = ${Number(consumerId)}`,
    ],
    [
      'sale_items',
      `SELECT i.* FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE s.consumer_id = ${Number(consumerId)}`,
    ],
    [
      'return_items',
      `SELECT i.* FROM return_items i JOIN returns r ON r.id = i.return_id WHERE r.consumer_id = ${Number(consumerId)}`,
    ],
  ];
  for (const [name, sql] of children) {
    const rows = await q<{ h: string }>(
      db,
      `SELECT COALESCE(md5(string_agg(row_to_json(t)::text, '|' ORDER BY row_to_json(t)::text)), '') AS h FROM (${sql}) t`,
    );
    parts.push(`${name}:${rows[0].h}`);
  }
  return parts.join('\n');
}

export async function assertInvariants(
  db: PrismaClient,
  bystander?: { consumerId: number; before: string },
): Promise<void> {
  const violations = await findViolations(db);
  if (bystander) {
    const after = await snapshotTenant(db, bystander.consumerId);
    if (after !== bystander.before) {
      violations.push({
        id: 'INV-13',
        detail: `bystander tenant ${bystander.consumerId} changed:\n${bystander.before}\n--- after ---\n${after}`,
      });
    }
  }
  if (violations.length) {
    throw new Error(
      `Invariant violations:\n${violations.map((v) => `  ${v.id} ${v.detail}`).join('\n')}`,
    );
  }
}
