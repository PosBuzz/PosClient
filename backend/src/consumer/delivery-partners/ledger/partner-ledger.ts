import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  desiredOrderEntries,
  desiredPartnerPaymentCents,
  diffEntries,
  Entry,
  fromCents,
  keyOf,
  ORDER_TYPES,
  OrderLedgerInput,
  orderEntryNote,
  PARTNER_PAYMENT_METHOD,
  paymentStatusFor,
  toCents,
} from './ledger-rules';

export * from './ledger-rules';

type Tx = Prisma.TransactionClient;

/**
 * Brings the ledger rows and the partner-collected payment of one order in line with
 * the order as it is now. Call inside the transaction that changed the order, after
 * the change. Safe to call when nothing changed (it posts nothing).
 */
export async function syncPartnerOrder(
  tx: Tx,
  saleId: number,
  userId: number | null,
) {
  const order = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: {
      id: true,
      consumer_id: true,
      sale_number: true,
      delivery_partner_id: true,
      online_order_status: true,
      is_online_order: true,
      sale_type: true,
      deleted_at: true,
      cod_amount: true,
      delivery_charge: true,
      cod_fee: true,
      total_amount: true,
      received_amount: true,
      payment_status: true,
    },
  });

  const grouped = await tx.deliveryPartnerTransaction.groupBy({
    by: ['partner_id', 'type'],
    where: { sale_id: saleId, type: { in: ORDER_TYPES } },
    _sum: { amount: true },
  });
  const existing: Entry[] = grouped.map((row) => ({
    partner_id: row.partner_id,
    type: row.type,
    cents: toCents(row._sum.amount),
  }));
  const deltas = diffEntries(existing, desiredOrderEntries(order));
  if (deltas.length) {
    const seen = new Set(existing.filter((r) => r.cents !== 0).map(keyOf));
    await tx.deliveryPartnerTransaction.createMany({
      data: deltas.map((row) => ({
        consumer_id: order.consumer_id,
        partner_id: row.partner_id,
        sale_id: order.id,
        type: row.type,
        amount: fromCents(row.cents),
        note: orderEntryNote(
          row,
          order.sale_number,
          order,
          !seen.has(keyOf(row)),
        ),
        created_by_id: userId,
      })),
    });
  }

  // The customer's side: cash the partner collected counts as paid by the customer
  const partnerPayments = await tx.salePayment.findMany({
    where: { sale_id: saleId, payment_method: PARTNER_PAYMENT_METHOD },
    select: { amount: true, reference: true },
  });
  const currentCents = partnerPayments.reduce(
    (sum, p) => sum + toCents(p.amount),
    0,
  );
  const wantedCents = desiredPartnerPaymentCents(order);
  const reference =
    wantedCents > 0
      ? `Collected by ${
          (
            await tx.deliveryPartner.findUniqueOrThrow({
              where: { id: order.delivery_partner_id! },
              select: { name: true },
            })
          ).name
        }`
      : null;
  // Same amount from the same partner: nothing to redo
  if (
    currentCents === wantedCents &&
    partnerPayments.every((p) => p.reference === reference)
  ) {
    return { posted: deltas.length };
  }

  const receivedCents =
    toCents(order.received_amount) - currentCents + wantedCents;
  const totalCents = toCents(order.total_amount);
  if (receivedCents > totalCents) {
    throw new BadRequestException(
      'The amount the partner collects is more than the customer still owes on this order',
    );
  }
  await tx.salePayment.deleteMany({
    where: { sale_id: saleId, payment_method: PARTNER_PAYMENT_METHOD },
  });
  if (wantedCents > 0) {
    await tx.salePayment.create({
      data: {
        sale_id: saleId,
        payment_method: PARTNER_PAYMENT_METHOD,
        amount: fromCents(wantedCents),
        reference,
      },
    });
  }
  await tx.sale.update({
    where: { id: saleId },
    data: {
      received_amount: fromCents(receivedCents),
      ...(order.payment_status === 'cancelled'
        ? {}
        : { payment_status: paymentStatusFor(receivedCents, totalCents) }),
    },
  });
  return { posted: deltas.length };
}

/** The order's ledger rows would change: refused once the order is settled in a payout. */
export async function orderLedgerWouldChange(
  tx: Tx,
  saleId: number,
  next: OrderLedgerInput,
) {
  const grouped = await tx.deliveryPartnerTransaction.groupBy({
    by: ['partner_id', 'type'],
    where: { sale_id: saleId, type: { in: ORDER_TYPES } },
    _sum: { amount: true },
  });
  const existing = grouped.map((row) => ({
    partner_id: row.partner_id,
    type: row.type,
    cents: toCents(row._sum.amount),
  }));
  return diffEntries(existing, desiredOrderEntries(next)).length > 0;
}
