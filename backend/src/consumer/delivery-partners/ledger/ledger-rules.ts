import { PaymentMethodEnum } from '@prisma/client';

/**
 * The delivery-partner ledger.
 *
 * Every row is a signed amount: > 0 means the partner owes the shop more, < 0 means
 * the partner owes less (or the shop owes the partner). A partner's balance is the
 * sum of its rows. Rows are never edited or deleted; a change posts a correcting row.
 *
 * The rows of an order are derived from the order itself (status, partner, amounts),
 * so `syncPartnerOrder` can be called after any change and posts only the difference.
 */
export const LedgerType = {
  COD_COLLECTED: 'COD_COLLECTED',
  DELIVERY_CHARGE: 'DELIVERY_CHARGE',
  COD_FEE: 'COD_FEE',
  RETURN_CHARGE: 'RETURN_CHARGE',
  PAYOUT_RECEIVED: 'PAYOUT_RECEIVED',
  PAYMENT_MADE: 'PAYMENT_MADE',
  ADJUSTMENT: 'ADJUSTMENT',
  PAYOUT_VOIDED: 'PAYOUT_VOIDED',
} as const;
export type LedgerType = (typeof LedgerType)[keyof typeof LedgerType];

/** The payment method the system records when a partner collected the customer's cash. */
export const PARTNER_PAYMENT_METHOD = PaymentMethodEnum.DELIVERY_PARTNER;

export const ORDER_TYPES: LedgerType[] = [
  LedgerType.COD_COLLECTED,
  LedgerType.DELIVERY_CHARGE,
  LedgerType.COD_FEE,
  LedgerType.RETURN_CHARGE,
];

export const toCents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
export const fromCents = (cents: number) => cents / 100;

export type OrderLedgerInput = {
  delivery_partner_id: number | null;
  online_order_status: string | null;
  is_online_order: boolean;
  sale_type: string;
  deleted_at: Date | null;
  cod_amount: unknown;
  delivery_charge: unknown;
  cod_fee: unknown;
};

export type EntryKey = { partner_id: number; type: string };
export type Entry = EntryKey & { cents: number };

/** True when the order takes part in the ledger at all. */
export function isLiveOnlineOrder(order: OrderLedgerInput) {
  return (
    order.is_online_order &&
    order.sale_type === 'sale' &&
    order.deleted_at === null &&
    order.delivery_partner_id !== null
  );
}

/**
 * What the ledger should hold for one order, in cents.
 * Delivered: the partner owes the collected cash, the shop owes the delivery charge and COD fee.
 * Returned: the shop owes the return charge (kept in delivery_charge). Anything else: nothing.
 */
export function desiredOrderEntries(order: OrderLedgerInput): Entry[] {
  if (!isLiveOnlineOrder(order)) return [];
  const partner_id = order.delivery_partner_id!;
  const status = order.online_order_status;
  const rows: Entry[] = [];
  if (status === 'DELIVERED') {
    rows.push(
      {
        partner_id,
        type: LedgerType.COD_COLLECTED,
        cents: toCents(order.cod_amount),
      },
      {
        partner_id,
        type: LedgerType.DELIVERY_CHARGE,
        cents: -toCents(order.delivery_charge),
      },
      { partner_id, type: LedgerType.COD_FEE, cents: -toCents(order.cod_fee) },
    );
  } else if (status === 'RETURNED') {
    rows.push({
      partner_id,
      type: LedgerType.RETURN_CHARGE,
      cents: -toCents(order.delivery_charge),
    });
  }
  return rows.filter((row) => row.cents !== 0);
}

/** What the partner collected from the customer for this order, in cents. */
export function desiredPartnerPaymentCents(order: OrderLedgerInput) {
  return isLiveOnlineOrder(order) && order.online_order_status === 'DELIVERED'
    ? toCents(order.cod_amount)
    : 0;
}

export const keyOf = (row: EntryKey) => `${row.partner_id}:${row.type}`;

/** The rows to post so that `existing` (summed per partner and type) becomes `desired`. */
export function diffEntries(existing: Entry[], desired: Entry[]): Entry[] {
  const totals = new Map<string, Entry>();
  for (const row of existing) {
    const prior = totals.get(keyOf(row));
    totals.set(keyOf(row), {
      ...row,
      cents: (prior?.cents ?? 0) - row.cents,
    });
  }
  for (const row of desired) {
    const prior = totals.get(keyOf(row));
    totals.set(keyOf(row), {
      ...row,
      cents: (prior?.cents ?? 0) + row.cents,
    });
  }
  return [...totals.values()]
    .filter((row) => row.cents !== 0)
    .sort(
      (a, b) => a.partner_id - b.partner_id || a.type.localeCompare(b.type),
    );
}

/** Payment status implied by the amounts, as the rest of the system computes it. */
export function paymentStatusFor(receivedCents: number, totalCents: number) {
  if (receivedCents >= totalCents && receivedCents > 0) return 'paid';
  if (receivedCents > 0) return 'partial';
  return 'due';
}

const STATUS_WORDS: Record<string, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  READY: 'ready',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

const TYPE_WORDS: Record<string, string> = {
  [LedgerType.COD_COLLECTED]: 'Cash collected',
  [LedgerType.DELIVERY_CHARGE]: 'Delivery charge',
  [LedgerType.COD_FEE]: 'COD fee',
  [LedgerType.RETURN_CHARGE]: 'Return charge',
};

/** Human note for an order row, so the ledger reads on its own. */
export function orderEntryNote(
  row: Entry,
  saleNumber: string,
  order: OrderLedgerInput,
  isFirst: boolean,
) {
  const what = `${TYPE_WORDS[row.type] ?? row.type} for order #${saleNumber}`;
  if (isFirst) return what;
  if (order.deleted_at) return `${what}: reversed, order deleted`;
  const status = order.online_order_status ?? 'PENDING';
  return `${what}: corrected, order is ${STATUS_WORDS[status] ?? status}`;
}
