import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UpdateOnlineOrderStatusDto } from '../../sales/dto/update-online-order-status.dto';
import {
  desiredPartnerPaymentCents,
  fromCents,
  orderLedgerWouldChange,
  PARTNER_PAYMENT_METHOD,
  syncPartnerOrder,
  toCents,
} from './partner-ledger';

type Tx = Prisma.TransactionClient;

/**
 * Applies an edit from the online-orders screen: status, partner and the partner's
 * amounts, then brings the partner ledger and the customer's payment in line.
 * Runs inside the caller's transaction with the order row locked.
 */
export async function applyOnlineOrderUpdate(
  tx: Tx,
  saleId: number,
  consumerId: number,
  userId: number | null,
  dto: UpdateOnlineOrderStatusDto,
) {
  const locked = await tx.$queryRaw<{ id: number }[]>`
    SELECT "id" FROM "sales"
    WHERE "id" = ${saleId} AND "consumer_id" = ${consumerId}
      AND "is_online_order" = true AND "deleted_at" IS NULL
    FOR UPDATE`;
  if (!locked.length) {
    throw new NotFoundException('Online order not found');
  }

  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: {
      id: true,
      sale_type: true,
      is_online_order: true,
      deleted_at: true,
      online_order_status: true,
      delivery_partner: true,
      delivery_partner_id: true,
      cod_amount: true,
      delivery_charge: true,
      cod_fee: true,
      total_amount: true,
      partner_settlement_id: true,
      payments: { select: { amount: true, payment_method: true } },
      _count: { select: { returns_as_original: true } },
    },
  });

  // Which partner the order ends up with
  let partnerId = sale.delivery_partner_id;
  let partnerName = sale.delivery_partner;
  let partner: {
    id: number;
    name: string;
    default_delivery_charge: Prisma.Decimal;
    default_cod_fee_percent: Prisma.Decimal;
  } | null = null;
  const findPartner = (where: Prisma.DeliveryPartnerWhereInput) =>
    tx.deliveryPartner.findFirst({
      where: { consumer_id: consumerId, ...where },
      select: {
        id: true,
        name: true,
        is_active: true,
        default_delivery_charge: true,
        default_cod_fee_percent: true,
      },
    });

  if (dto.delivery_partner_id !== undefined) {
    if (dto.delivery_partner_id === null) {
      partnerId = null;
      partnerName = null;
    } else {
      const found = await findPartner({ id: dto.delivery_partner_id });
      if (!found) throw new NotFoundException('Delivery partner not found');
      if (!found.is_active && found.id !== sale.delivery_partner_id) {
        throw new BadRequestException(
          `${found.name} is inactive. Activate the partner first.`,
        );
      }
      partner = found;
      partnerId = found.id;
      partnerName = found.name;
    }
  } else if (dto.delivery_partner !== undefined) {
    // Older app versions send only a name: link it when it names a partner
    const name = dto.delivery_partner?.trim() || null;
    const found = name
      ? await findPartner({ name: { equals: name, mode: 'insensitive' } })
      : null;
    partner = found;
    partnerId = found?.id ?? null;
    partnerName = found?.name ?? name;
  }
  const partnerChanged = partnerId !== sale.delivery_partner_id;

  // Amounts. With no partner there is nothing to collect or pay.
  const otherPaidCents = sale.payments
    .filter((p) => p.payment_method !== PARTNER_PAYMENT_METHOD)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  const owedCents = Math.max(0, toCents(sale.total_amount) - otherPaidCents);

  let codCents = 0;
  let chargeCents = 0;
  let feeCents = 0;
  if (partnerId !== null) {
    const assignedNow = partnerChanged && partner;
    codCents =
      dto.cod_amount !== undefined
        ? toCents(dto.cod_amount)
        : assignedNow
          ? owedCents
          : toCents(sale.cod_amount);
    chargeCents =
      dto.delivery_charge !== undefined
        ? toCents(dto.delivery_charge)
        : assignedNow
          ? toCents(partner!.default_delivery_charge)
          : toCents(sale.delivery_charge);
    feeCents =
      dto.cod_fee !== undefined
        ? toCents(dto.cod_fee)
        : assignedNow
          ? Math.round(
              (codCents * Number(partner!.default_cod_fee_percent)) / 100,
            )
          : toCents(sale.cod_fee);
    if (codCents > owedCents) {
      throw new BadRequestException(
        `Cash to collect (${fromCents(codCents)}) is more than the customer still owes (${fromCents(owedCents)})`,
      );
    }
  }

  const next = {
    ...sale,
    online_order_status: dto.status,
    delivery_partner_id: partnerId,
    cod_amount: fromCents(codCents),
    delivery_charge: fromCents(chargeCents),
    cod_fee: fromCents(feeCents),
  };

  const currentPartnerPaid = sale.payments
    .filter((p) => p.payment_method === PARTNER_PAYMENT_METHOD)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  const paymentChanges =
    desiredPartnerPaymentCents(next) !== currentPartnerPaid;

  if (paymentChanges && sale._count.returns_as_original > 0) {
    throw new BadRequestException(
      'This order has returns against it, so the cash the partner collected can no longer change',
    );
  }
  if (
    sale.partner_settlement_id !== null &&
    (paymentChanges || (await orderLedgerWouldChange(tx, saleId, next)))
  ) {
    throw new BadRequestException(
      `This order is settled in payout #${sale.partner_settlement_id}. Void that payout first to change it.`,
    );
  }

  await tx.sale.update({
    where: { id: saleId },
    data: {
      online_order_status: dto.status,
      delivery_partner: partnerName,
      delivery_partner_id: partnerId,
      cod_amount: next.cod_amount,
      delivery_charge: next.delivery_charge,
      cod_fee: next.cod_fee,
    },
  });
  await syncPartnerOrder(tx, saleId, userId);
}
