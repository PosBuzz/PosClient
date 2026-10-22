import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';
import {
  CreateDeliveryPartnerDto,
  UpdateDeliveryPartnerDto,
} from '../dto/delivery-partner.dto';
import {
  CreateAdjustmentDto,
  CreateSettlementDto,
  PartnerOrdersQueryDto,
  VoidSettlementDto,
} from '../dto/settlement.dto';
import { fromCents, LedgerType, toCents } from '../ledger/partner-ledger';

const ORDER_TYPES = [
  LedgerType.COD_COLLECTED,
  LedgerType.DELIVERY_CHARGE,
  LedgerType.COD_FEE,
  LedgerType.RETURN_CHARGE,
];
const SETTLED_STATUSES = ['DELIVERED', 'RETURNED'];

const num = (value: unknown) => fromCents(toCents(value));
/** Sign flip that never yields -0 (it would print as "-0" in JSON consumers) */
const neg = (value: number) => (value === 0 ? 0 : -value);

const paging = (query?: { page?: number; limit?: number }, max = 100) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(max, Math.max(1, Number(query?.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

/** Orders of a partner that are finished (delivered or returned), carry ledger rows and are not in a payout yet. */
export const unsettledOrderWhere = (
  consumerId: number,
  partnerId?: number,
): Prisma.SaleWhereInput => ({
  consumer_id: consumerId,
  sale_type: 'sale',
  is_online_order: true,
  deleted_at: null,
  online_order_status: { in: SETTLED_STATUSES },
  partner_settlement_id: null,
  ...(partnerId
    ? {
        delivery_partner_id: partnerId,
        partner_transactions: { some: { partner_id: partnerId } },
      }
    : {
        delivery_partner_id: { not: null },
        partner_transactions: { some: {} },
      }),
});

@Injectable()
export class DeliveryPartnersService {
  private readonly logger = new Logger(DeliveryPartnersService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async guard<T>(what: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(`Error: ${what}`, errorStack(error));
      throw new HttpException(
        `Failed to ${what}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async assertNameFree(
    consumerId: number,
    name: string,
    exceptId?: number,
  ) {
    const clash = await this.prisma.deliveryPartner.findFirst({
      where: {
        consumer_id: consumerId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException(
        `A delivery partner named "${name}" already exists`,
      );
    }
  }

  /** Every partner of the shop with what is owed and what is waiting for a payout. */
  findAll(consumerId: number) {
    return this.guard('load delivery partners', async () => {
      const [partners, balances, unsettledOrders, unsettledNet] =
        await Promise.all([
          this.prisma.deliveryPartner.findMany({
            where: { consumer_id: consumerId },
            orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
          }),
          this.prisma.deliveryPartnerTransaction.groupBy({
            by: ['partner_id'],
            where: { consumer_id: consumerId },
            _sum: { amount: true },
          }),
          this.prisma.sale.groupBy({
            by: ['delivery_partner_id'],
            where: unsettledOrderWhere(consumerId),
            _count: true,
          }),
          this.prisma.deliveryPartnerTransaction.groupBy({
            by: ['partner_id'],
            where: {
              consumer_id: consumerId,
              type: { in: ORDER_TYPES },
              sale: unsettledOrderWhere(consumerId),
            },
            _sum: { amount: true },
          }),
        ]);
      const balance = new Map(
        balances.map((b) => [b.partner_id, num(b._sum.amount)]),
      );
      const count = new Map(
        unsettledOrders.map((u) => [u.delivery_partner_id, u._count]),
      );
      const net = new Map(
        unsettledNet.map((u) => [u.partner_id, num(u._sum.amount)]),
      );
      return partners.map((partner) => ({
        ...this.shape(partner),
        balance: balance.get(partner.id) ?? 0,
        unsettled_orders: count.get(partner.id) ?? 0,
        unsettled_net: net.get(partner.id) ?? 0,
      }));
    });
  }

  private shape<
    T extends {
      default_delivery_charge: Prisma.Decimal;
      default_cod_fee_percent: Prisma.Decimal;
    },
  >(partner: T) {
    return {
      ...partner,
      default_delivery_charge: num(partner.default_delivery_charge),
      default_cod_fee_percent: num(partner.default_cod_fee_percent),
    };
  }

  private async own(id: number, consumerId: number) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id, consumer_id: consumerId },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return partner;
  }

  findOne(id: number, consumerId: number) {
    return this.guard('load delivery partner', async () =>
      this.shape(await this.own(id, consumerId)),
    );
  }

  create(dto: CreateDeliveryPartnerDto, consumerId: number) {
    return this.guard('create delivery partner', async () => {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Partner name is required');
      await this.assertNameFree(consumerId, name);
      const partner = await this.prisma.deliveryPartner.create({
        data: {
          consumer_id: consumerId,
          name,
          contact: dto.contact?.trim() || null,
          phone: dto.phone?.trim() || null,
          notes: dto.notes?.trim() || null,
          default_delivery_charge: dto.default_delivery_charge ?? 0,
          default_cod_fee_percent: dto.default_cod_fee_percent ?? 0,
          is_active: dto.is_active ?? true,
        },
      });
      return this.shape(partner);
    });
  }

  update(id: number, dto: UpdateDeliveryPartnerDto, consumerId: number) {
    return this.guard('update delivery partner', async () => {
      const current = await this.own(id, consumerId);
      const name = dto.name === undefined ? undefined : dto.name.trim();
      if (name !== undefined && !name) {
        throw new BadRequestException('Partner name is required');
      }
      if (name && name !== current.name) {
        await this.assertNameFree(consumerId, name, id);
      }
      const partner = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.deliveryPartner.update({
          where: { id },
          data: {
            name,
            contact:
              dto.contact === undefined
                ? undefined
                : dto.contact.trim() || null,
            phone:
              dto.phone === undefined ? undefined : dto.phone.trim() || null,
            notes:
              dto.notes === undefined ? undefined : dto.notes.trim() || null,
            default_delivery_charge: dto.default_delivery_charge,
            default_cod_fee_percent: dto.default_cod_fee_percent,
            is_active: dto.is_active,
          },
        });
        // Orders show the partner's name; keep it in step with a rename
        if (name && name !== current.name) {
          await tx.sale.updateMany({
            where: { consumer_id: consumerId, delivery_partner_id: id },
            data: { delivery_partner: name },
          });
        }
        return updated;
      });
      return this.shape(partner);
    });
  }

  remove(id: number, consumerId: number) {
    return this.guard('delete delivery partner', async () => {
      await this.own(id, consumerId);
      const [orders, entries] = await Promise.all([
        this.prisma.sale.count({ where: { delivery_partner_id: id } }),
        this.prisma.deliveryPartnerTransaction.count({
          where: { partner_id: id },
        }),
      ]);
      if (orders || entries) {
        throw new BadRequestException(
          `This partner has ${orders} order(s) and ${entries} ledger row(s). Deactivate it instead so its history is kept.`,
        );
      }
      await this.prisma.deliveryPartner.delete({ where: { id } });
      return { success: true };
    });
  }

  /** Balance, what it is made of, and what still waits for a payout. */
  getSummary(id: number, consumerId: number) {
    return this.guard('load delivery partner summary', async () => {
      const partner = await this.own(id, consumerId);
      const [byType, unsettledCount, unsettledNet, lastSettlement] =
        await Promise.all([
          this.prisma.deliveryPartnerTransaction.groupBy({
            by: ['type'],
            where: { partner_id: id },
            _sum: { amount: true },
          }),
          this.prisma.sale.count({
            where: unsettledOrderWhere(consumerId, id),
          }),
          this.prisma.deliveryPartnerTransaction.aggregate({
            where: {
              partner_id: id,
              type: { in: ORDER_TYPES },
              sale: unsettledOrderWhere(consumerId, id),
            },
            _sum: { amount: true },
          }),
          this.prisma.deliveryPartnerSettlement.findFirst({
            where: { partner_id: id, voided_at: null },
            orderBy: [{ settlement_date: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              direction: true,
              amount: true,
              settlement_date: true,
            },
          }),
        ]);
      const total = (type: string) =>
        num(byType.find((row) => row.type === type)?._sum.amount);
      const totals = {
        cod_collected: total(LedgerType.COD_COLLECTED),
        delivery_charges: neg(total(LedgerType.DELIVERY_CHARGE)),
        cod_fees: neg(total(LedgerType.COD_FEE)),
        return_charges: neg(total(LedgerType.RETURN_CHARGE)),
        // Voided payouts are netted out of the payout totals
        payouts_received: neg(total(LedgerType.PAYOUT_RECEIVED)),
        payments_made: total(LedgerType.PAYMENT_MADE),
        adjustments: total(LedgerType.ADJUSTMENT),
        voided: total(LedgerType.PAYOUT_VOIDED),
      };
      const balance = fromCents(
        byType.reduce((sum, row) => sum + toCents(row._sum.amount), 0),
      );
      return {
        partner: this.shape(partner),
        balance,
        totals,
        unsettled: {
          orders: unsettledCount,
          net: num(unsettledNet._sum.amount),
        },
        last_settlement: lastSettlement
          ? { ...lastSettlement, amount: num(lastSettlement.amount) }
          : null,
      };
    });
  }

  /** Ledger rows, newest first, each with the balance right after it. */
  getLedger(
    id: number,
    consumerId: number,
    query?: { page?: number; limit?: number },
  ) {
    return this.guard('load delivery partner ledger', async () => {
      await this.own(id, consumerId);
      const { page, limit, skip } = paging(query, 200);
      const [rows, total, overall] = await Promise.all([
        this.prisma.deliveryPartnerTransaction.findMany({
          where: { partner_id: id },
          orderBy: { id: 'desc' },
          skip,
          take: limit,
          include: {
            sale: { select: { id: true, sale_number: true } },
            settlement: {
              select: { id: true, direction: true, voided_at: true },
            },
          },
        }),
        this.prisma.deliveryPartnerTransaction.count({
          where: { partner_id: id },
        }),
        this.prisma.deliveryPartnerTransaction.aggregate({
          where: { partner_id: id },
          _sum: { amount: true },
        }),
      ]);
      let after = toCents(overall._sum.amount);
      if (rows.length) {
        const newer = await this.prisma.deliveryPartnerTransaction.aggregate({
          where: { partner_id: id, id: { gt: rows[0].id } },
          _sum: { amount: true },
        });
        after -= toCents(newer._sum.amount);
      }
      const data = rows.map((row) => {
        const entry = {
          ...row,
          amount: num(row.amount),
          balance_after: fromCents(after),
        };
        after -= toCents(row.amount);
        return entry;
      });
      return {
        data,
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      };
    });
  }

  /** The partner's online orders with what each one adds to the balance. */
  getOrders(id: number, consumerId: number, query: PartnerOrdersQueryDto = {}) {
    return this.guard('load delivery partner orders', async () => {
      await this.own(id, consumerId);
      const { page, limit, skip } = paging(query, 1000);
      const settlement = query.settlement ?? 'unsettled';
      const where: Prisma.SaleWhereInput =
        settlement === 'unsettled'
          ? unsettledOrderWhere(consumerId, id)
          : {
              consumer_id: consumerId,
              sale_type: 'sale',
              is_online_order: true,
              deleted_at: null,
              delivery_partner_id: id,
              ...(settlement === 'settled'
                ? { partner_settlement_id: { not: null } }
                : {}),
            };
      const [orders, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          orderBy: [{ sale_date: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
          select: {
            id: true,
            sale_number: true,
            sale_date: true,
            customer_name: true,
            customer_phone: true,
            total_amount: true,
            payment_status: true,
            online_order_status: true,
            cod_amount: true,
            delivery_charge: true,
            cod_fee: true,
            partner_settlement_id: true,
            branch: { select: { id: true, name: true } },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);
      const nets = orders.length
        ? await this.prisma.deliveryPartnerTransaction.groupBy({
            by: ['sale_id'],
            where: {
              partner_id: id,
              type: { in: ORDER_TYPES },
              sale_id: { in: orders.map((o) => o.id) },
            },
            _sum: { amount: true },
          })
        : [];
      const netOf = new Map(nets.map((n) => [n.sale_id, num(n._sum.amount)]));
      return {
        data: orders.map((order) => ({
          ...order,
          total_amount: num(order.total_amount),
          cod_amount: num(order.cod_amount),
          delivery_charge: num(order.delivery_charge),
          cod_fee: num(order.cod_fee),
          // > 0: the partner owes the shop this much for the order
          net: netOf.get(order.id) ?? 0,
        })),
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      };
    });
  }

  getSettlements(
    id: number,
    consumerId: number,
    query?: { page?: number; limit?: number },
  ) {
    return this.guard('load delivery partner payouts', async () => {
      await this.own(id, consumerId);
      const { page, limit, skip } = paging(query);
      const where = { partner_id: id };
      const [rows, total] = await Promise.all([
        this.prisma.deliveryPartnerSettlement.findMany({
          where,
          orderBy: [{ settlement_date: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
          include: { _count: { select: { sales: true } } },
        }),
        this.prisma.deliveryPartnerSettlement.count({ where }),
      ]);
      return {
        data: rows.map(({ _count, ...row }) => ({
          ...row,
          amount: num(row.amount),
          orders: _count.sales,
        })),
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
      };
    });
  }

  /**
   * Records a payout from the partner (or a payment to it), marks the chosen orders
   * settled and, when asked, writes off the gap between those orders and the amount.
   */
  createSettlement(
    id: number,
    consumerId: number,
    userId: number,
    dto: CreateSettlementDto,
  ) {
    return this.guard('record payout', async () => {
      await this.own(id, consumerId);
      const saleIds = [...new Set(dto.sale_ids ?? [])];
      if (dto.adjust_difference && !saleIds.length) {
        throw new BadRequestException(
          'Choose the orders this payout covers to write off a difference',
        );
      }
      const settlement = await this.prisma.$transaction(async (tx) => {
        // One payout at a time per partner, and the chosen orders cannot move meanwhile
        await tx.$queryRaw`SELECT "id" FROM "delivery_partners" WHERE "id" = ${id} FOR UPDATE`;
        if (saleIds.length) {
          await tx.$queryRaw`SELECT "id" FROM "sales" WHERE "id" IN (${Prisma.join(saleIds)}) ORDER BY "id" FOR UPDATE`;
          const eligible = await tx.sale.findMany({
            where: {
              id: { in: saleIds },
              ...unsettledOrderWhere(consumerId, id),
            },
            select: { id: true },
          });
          if (eligible.length !== saleIds.length) {
            throw new BadRequestException(
              'Some chosen orders are not unsettled delivered or returned orders of this partner. Refresh and choose again.',
            );
          }
        }
        const created = await tx.deliveryPartnerSettlement.create({
          data: {
            consumer_id: consumerId,
            partner_id: id,
            direction: dto.direction,
            amount: dto.amount,
            payment_method: dto.payment_method,
            reference: dto.reference?.trim() || null,
            note: dto.note?.trim() || null,
            settlement_date: dto.settlement_date
              ? new Date(dto.settlement_date)
              : new Date(),
            created_by_id: userId,
          },
        });
        const signedCents =
          dto.direction === 'RECEIVED'
            ? -toCents(dto.amount)
            : toCents(dto.amount);
        const label = dto.direction === 'RECEIVED' ? 'Payout' : 'Payment';
        const entries: Prisma.DeliveryPartnerTransactionCreateManyInput[] = [
          {
            consumer_id: consumerId,
            partner_id: id,
            settlement_id: created.id,
            type:
              dto.direction === 'RECEIVED'
                ? LedgerType.PAYOUT_RECEIVED
                : LedgerType.PAYMENT_MADE,
            amount: fromCents(signedCents),
            note:
              `${label} #${created.id}` +
              (saleIds.length ? ` for ${saleIds.length} order(s)` : '') +
              (created.reference ? ` (ref ${created.reference})` : ''),
            created_by_id: userId,
          },
        ];
        if (saleIds.length) {
          await tx.sale.updateMany({
            where: { id: { in: saleIds } },
            data: { partner_settlement_id: created.id },
          });
          if (dto.adjust_difference) {
            const expected = await tx.deliveryPartnerTransaction.aggregate({
              where: {
                partner_id: id,
                sale_id: { in: saleIds },
                type: { in: ORDER_TYPES },
              },
              _sum: { amount: true },
            });
            const gapCents = -(toCents(expected._sum.amount) + signedCents);
            if (gapCents !== 0) {
              entries.push({
                consumer_id: consumerId,
                partner_id: id,
                settlement_id: created.id,
                type: LedgerType.ADJUSTMENT,
                amount: fromCents(gapCents),
                note: `Difference written off on ${label.toLowerCase()} #${created.id}`,
                created_by_id: userId,
              });
            }
          }
        }
        await tx.deliveryPartnerTransaction.createMany({ data: entries });
        return created;
      });
      return { ...settlement, amount: num(settlement.amount) };
    });
  }

  /** Cancels a payout: reverses its ledger rows and puts its orders back to unsettled. */
  voidSettlement(
    id: number,
    settlementId: number,
    consumerId: number,
    userId: number,
    dto: VoidSettlementDto,
  ) {
    return this.guard('void payout', async () => {
      await this.own(id, consumerId);
      await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ voided_at: Date | null }[]>`
          SELECT "voided_at" FROM "delivery_partner_settlements"
          WHERE "id" = ${settlementId} AND "partner_id" = ${id} AND "consumer_id" = ${consumerId}
          FOR UPDATE`;
        if (!locked.length) throw new NotFoundException('Payout not found');
        if (locked[0].voided_at) {
          throw new BadRequestException('This payout is already voided');
        }
        const rows = await tx.deliveryPartnerTransaction.groupBy({
          by: ['settlement_id'],
          where: { settlement_id: settlementId },
          _sum: { amount: true },
        });
        const cents = toCents(rows[0]?._sum.amount);
        const reason = dto.reason.trim();
        if (cents !== 0) {
          await tx.deliveryPartnerTransaction.create({
            data: {
              consumer_id: consumerId,
              partner_id: id,
              settlement_id: settlementId,
              type: LedgerType.PAYOUT_VOIDED,
              amount: fromCents(-cents),
              note: `Payout #${settlementId} voided: ${reason}`,
              created_by_id: userId,
            },
          });
        }
        await tx.sale.updateMany({
          where: { partner_settlement_id: settlementId },
          data: { partner_settlement_id: null },
        });
        await tx.deliveryPartnerSettlement.update({
          where: { id: settlementId },
          data: {
            voided_at: new Date(),
            voided_by_id: userId,
            void_reason: reason,
          },
        });
      });
      return { success: true };
    });
  }

  createAdjustment(
    id: number,
    consumerId: number,
    userId: number,
    dto: CreateAdjustmentDto,
  ) {
    return this.guard('record adjustment', async () => {
      await this.own(id, consumerId);
      const note = dto.note.trim();
      if (!note) throw new BadRequestException('Say why the balance changes');
      const entry = await this.prisma.deliveryPartnerTransaction.create({
        data: {
          consumer_id: consumerId,
          partner_id: id,
          type: LedgerType.ADJUSTMENT,
          amount: dto.amount,
          note,
          created_by_id: userId,
        },
      });
      return { ...entry, amount: num(entry.amount) };
    });
  }
}
