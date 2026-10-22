import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { SalesService } from '../../src/consumer/sales/services/sales.service';
import { PaymentsService } from '../../src/consumer/payments/services/payments.service';
import { DeliveryPartnersService } from '../../src/consumer/delivery-partners/services/delivery-partners.service';
import { SettlementPaymentMethod } from '../../src/consumer/delivery-partners/dto/settlement.dto';

process.env.TZ = 'UTC';

describe('delivery partners: dues, payouts and the online-order ledger', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let sales: SalesService;
  let partners: DeliveryPartnersService;
  let payments: PaymentsService;

  beforeAll(async () => {
    boot = await bootDomain();
    sales = boot.get(SalesService);
    partners = boot.get(DeliveryPartnersService);
    payments = boot.get(PaymentsService);
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());

  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const fails = async (
    promise: Promise<unknown>,
    type: typeof BadRequestException | typeof NotFoundException,
    message: RegExp,
  ) => {
    const error: any = await promise.then(
      () => null,
      (e) => e,
    );
    expect(error).toBeInstanceOf(type);
    expect(error.message).toMatch(message);
  };
  const partner = (name = 'Pathao', over: object = {}) =>
    partners.create(
      {
        name,
        default_delivery_charge: 60,
        default_cod_fee_percent: 1,
        ...over,
      },
      cid(),
    );
  /** An unpaid online order of 500 (or partly paid by cash). */
  const order = async (paid: number | null = null) => {
    const v = await w.stock({ price: 500, batches: [{ qty: 10, cost: 100 }] });
    return w.sell([{ variant: v, qty: 1 }], { is_online_order: true }, paid);
  };
  const edit = (saleId: number, dto: object, consumerId = cid()) =>
    sales.updateOnlineOrderStatus(saleId, dto as any, consumerId, uid());
  const ledgerOf = (saleId: number) =>
    db.deliveryPartnerTransaction.findMany({
      where: { sale_id: saleId },
      orderBy: { id: 'asc' },
      select: { partner_id: true, type: true, amount: true },
    });
  const saleOf = (id: number) => db.sale.findUniqueOrThrow({ where: { id } });
  const balance = async (partnerId: number) =>
    (await partners.getSummary(partnerId, cid())).balance;

  describe('partners', () => {
    it('[BE-DP-020] {DeliveryPartnersService.create} {DeliveryPartnersService.findOne} (happy-path) a partner is saved trimmed with its defaults', async () => {
      const created = await partners.create(
        {
          name: '  Steadfast ',
          phone: ' 017 ',
          contact: '',
          default_delivery_charge: 70,
          default_cod_fee_percent: 1.5,
        },
        cid(),
      );
      expect(created).toMatchObject({
        name: 'Steadfast',
        phone: '017',
        contact: null,
        default_delivery_charge: 70,
        default_cod_fee_percent: 1.5,
        is_active: true,
      });
      expect(await partners.findOne(created.id, cid())).toMatchObject({
        id: created.id,
        default_delivery_charge: 70,
      });
    });

    it('[BE-DP-021] {DeliveryPartnersService.create} (failure) a name already used, in any case, or a blank name is refused', async () => {
      await partner('Pathao');
      await fails(partner('  pathao '), BadRequestException, /already exists/);
      await fails(partner('   '), BadRequestException, /name is required/);
      expect(
        await db.deliveryPartner.count({ where: { consumer_id: cid() } }),
      ).toBe(1);
    });

    it("[BE-DP-022] {DeliveryPartnersService.findOne} {DeliveryPartnersService.getSummary} (cross-tenant) (failure) another shop's partner is not found", async () => {
      const theirs = await partners.create(
        { name: 'Theirs' },
        w.bystander.consumer.id,
      );
      await w.rebaseBystander();
      await fails(
        partners.findOne(theirs.id, cid()),
        NotFoundException,
        /Delivery partner not found/,
      );
      await fails(
        partners.getSummary(theirs.id, cid()),
        NotFoundException,
        /not found/,
      );
      expect((await partners.findAll(cid())).map((p) => p.name)).not.toContain(
        'Theirs',
      );
    });

    it('[BE-DP-023] {DeliveryPartnersService.update} (happy-path) a rename follows onto its orders; defaults and active flag change', async () => {
      const p = await partner();
      const sale = await order();
      await edit(sale.id, { status: 'CONFIRMED', delivery_partner_id: p.id });
      const updated = await partners.update(
        p.id,
        {
          name: 'Pathao Courier',
          is_active: false,
          default_delivery_charge: 80,
        },
        cid(),
      );
      expect(updated).toMatchObject({
        name: 'Pathao Courier',
        is_active: false,
        default_delivery_charge: 80,
      });
      expect((await saleOf(sale.id)).delivery_partner).toBe('Pathao Courier');
    });

    it('[BE-DP-024] {DeliveryPartnersService.update} (failure) renaming onto another partner or to blank is refused; (cross-tenant) other shops cannot edit', async () => {
      const p = await partner('Pathao');
      await partner('RedX');
      await fails(
        partners.update(p.id, { name: 'redx' }, cid()),
        BadRequestException,
        /already exists/,
      );
      await fails(
        partners.update(p.id, { name: ' ' }, cid()),
        BadRequestException,
        /name is required/,
      );
      await fails(
        partners.update(p.id, { name: 'X' }, w.bystander.consumer.id),
        NotFoundException,
        /not found/,
      );
      // Same name in another case is the partner itself, not a clash
      expect(
        (await partners.update(p.id, { name: 'Pathao' }, cid())).name,
      ).toBe('Pathao');
    });

    it('[BE-DP-025] {DeliveryPartnersService.remove} (happy-path) an unused partner is deleted; (failure) one with orders must be deactivated instead', async () => {
      const unused = await partner('Unused');
      expect(await partners.remove(unused.id, cid())).toEqual({
        success: true,
      });
      const used = await partner('Used');
      const sale = await order();
      await edit(sale.id, { status: 'READY', delivery_partner_id: used.id });
      await fails(
        partners.remove(used.id, cid()),
        BadRequestException,
        /1 order\(s\) and 0 ledger row\(s\)\. Deactivate it instead/,
      );
      await fails(
        partners.remove(used.id, w.bystander.consumer.id),
        NotFoundException,
        /not found/,
      );
    });
  });

  describe('orders', () => {
    it('[BE-DP-030] {SalesService.updateOnlineOrderStatus} (happy-path) choosing a partner prefills cash to collect, its charge and COD fee; delivering books them and pays the customer', async () => {
      const p = await partner();
      const sale = await order();
      await edit(sale.id, {
        status: 'OUT_FOR_DELIVERY',
        delivery_partner_id: p.id,
      });
      expect(await saleOf(sale.id)).toMatchObject({
        delivery_partner: 'Pathao',
        delivery_partner_id: p.id,
      });
      const assigned = await saleOf(sale.id);
      expect(Number(assigned.cod_amount)).toBe(500);
      expect(Number(assigned.delivery_charge)).toBe(60);
      expect(Number(assigned.cod_fee)).toBe(5);
      expect(await ledgerOf(sale.id)).toEqual([]);
      expect(assigned.payment_status).toBe('due');

      await edit(sale.id, { status: 'DELIVERED' });
      const delivered = await saleOf(sale.id);
      expect(delivered.payment_status).toBe('paid');
      expect(Number(delivered.received_amount)).toBe(500);
      const pay = await db.salePayment.findMany({
        where: { sale_id: sale.id },
      });
      expect(pay).toHaveLength(1);
      expect(pay[0]).toMatchObject({
        payment_method: 'DELIVERY_PARTNER',
        reference: 'Collected by Pathao',
      });
      expect(
        (await ledgerOf(sale.id)).map((r) => [r.type, Number(r.amount)]),
      ).toEqual([
        ['COD_COLLECTED', 500],
        ['COD_FEE', -5],
        ['DELIVERY_CHARGE', -60],
      ]);
      expect(await balance(p.id)).toBe(435);
    });

    it('[BE-DP-031] {SalesService.updateOnlineOrderStatus} (happy-path) undoing a delivery reverses the rows and the customer payment; a return keeps only the return charge', async () => {
      const p = await partner();
      const sale = await order();
      await edit(sale.id, { status: 'DELIVERED', delivery_partner_id: p.id });
      await edit(sale.id, { status: 'OUT_FOR_DELIVERY' });
      expect(await balance(p.id)).toBe(0);
      const back = await saleOf(sale.id);
      expect(back.payment_status).toBe('due');
      expect(Number(back.received_amount)).toBe(0);
      expect(await db.salePayment.count({ where: { sale_id: sale.id } })).toBe(
        0,
      );
      await edit(sale.id, { status: 'RETURNED', delivery_charge: 40 });
      expect(await balance(p.id)).toBe(-40);
      const notes = await db.deliveryPartnerTransaction.findMany({
        where: { sale_id: sale.id },
        orderBy: { id: 'asc' },
        select: { note: true },
      });
      expect(notes.at(-1)!.note).toBe(
        `Return charge for order #${sale.sale_number}`,
      );
      expect(notes[3].note).toMatch(/corrected, order is out for delivery/);
    });

    it('[BE-DP-032] {SalesService.updateOnlineOrderStatus} (happy-path) a partly prepaid order collects only the rest; moving the order moves its rows to the new partner', async () => {
      const a = await partner('A', { default_cod_fee_percent: 0 });
      const b = await partner('B', { default_delivery_charge: 50 });
      const sale = await order(200);
      await edit(sale.id, { status: 'DELIVERED', delivery_partner_id: a.id });
      expect(Number((await saleOf(sale.id)).cod_amount)).toBe(300);
      expect(await balance(a.id)).toBe(240);
      await edit(sale.id, {
        status: 'DELIVERED',
        delivery_partner_id: b.id,
        cod_fee: 0,
      });
      expect(await balance(a.id)).toBe(0);
      expect(await balance(b.id)).toBe(250);
      const moved = await saleOf(sale.id);
      expect(moved.payment_status).toBe('paid');
      expect(
        (
          await db.salePayment.findFirstOrThrow({
            where: { sale_id: sale.id, payment_method: 'DELIVERY_PARTNER' },
          })
        ).reference,
      ).toBe('Collected by B');
    });

    it('[BE-DP-033] {SalesService.updateOnlineOrderStatus} (failure) collecting more than is owed, an inactive partner and another shop’s partner are refused (cross-tenant)', async () => {
      const p = await partner();
      const off = await partner('Off', { is_active: false });
      const theirs = await partners.create(
        { name: 'Theirs' },
        w.bystander.consumer.id,
      );
      await w.rebaseBystander();
      const sale = await order(100);
      await fails(
        edit(sale.id, {
          status: 'DELIVERED',
          delivery_partner_id: p.id,
          cod_amount: 450,
        }),
        BadRequestException,
        /Cash to collect \(450\) is more than the customer still owes \(400\)/,
      );
      await fails(
        edit(sale.id, { status: 'READY', delivery_partner_id: off.id }),
        BadRequestException,
        /Off is inactive/,
      );
      await fails(
        edit(sale.id, { status: 'READY', delivery_partner_id: theirs.id }),
        NotFoundException,
        /Delivery partner not found/,
      );
      await fails(
        edit(sale.id, { status: 'READY' }, w.bystander.consumer.id),
        NotFoundException,
        /Online order not found/,
      );
      expect((await saleOf(sale.id)).delivery_partner_id).toBeNull();
      expect(await ledgerOf(sale.id)).toEqual([]);
    });

    it('[BE-DP-034] {SalesService.updateOnlineOrderStatus} (happy-path) older app versions that send a name link a matching partner, keep free text otherwise, and blank clears it', async () => {
      const p = await partner('Pathao');
      const sale = await order();
      await edit(sale.id, { status: 'READY', delivery_partner: ' pathao ' });
      expect(await saleOf(sale.id)).toMatchObject({
        delivery_partner: 'Pathao',
        delivery_partner_id: p.id,
      });
      await edit(sale.id, { status: 'READY', delivery_partner: ' Shop van ' });
      expect(await saleOf(sale.id)).toMatchObject({
        delivery_partner: 'Shop van',
        delivery_partner_id: null,
      });
      await edit(sale.id, { status: 'READY' });
      expect((await saleOf(sale.id)).delivery_partner).toBe('Shop van');
      await edit(sale.id, { status: 'READY', delivery_partner: '   ' });
      expect((await saleOf(sale.id)).delivery_partner).toBeNull();
      await edit(sale.id, { status: 'READY', delivery_partner_id: p.id });
      await edit(sale.id, { status: 'READY', delivery_partner_id: null });
      expect(await saleOf(sale.id)).toMatchObject({
        delivery_partner: null,
        delivery_partner_id: null,
      });
      expect(Number((await saleOf(sale.id)).cod_amount)).toBe(0);
    });

    it('[BE-DP-035] {SalesService.updateOnlineOrderStatus} (failure) once the customer returned goods, the collected cash can no longer change', async () => {
      const p = await partner();
      const sale = await order();
      await edit(sale.id, { status: 'DELIVERED', delivery_partner_id: p.id });
      await db.return.create({
        data: {
          return_number: 'R-1',
          consumer_id: cid(),
          branch_id: sale.branch_id,
          original_sale_id: sale.id,
          total_refund: 0,
        } as any,
      });
      await fails(
        edit(sale.id, { status: 'RETURNED' }),
        BadRequestException,
        /returns against it/,
      );
      // Changes that leave the collected cash alone still go through
      await edit(sale.id, { status: 'DELIVERED', delivery_charge: 70 });
      expect(await balance(p.id)).toBe(425);
    });

    it('[BE-DP-036] {SalesService.softDelete} {SalesService.restore} (happy-path) deleting an order takes it out of the balance and restoring puts it back', async () => {
      const p = await partner();
      const sale = await order();
      await edit(sale.id, { status: 'RETURNED', delivery_partner_id: p.id });
      expect(await balance(p.id)).toBe(-60);
      await sales.softDelete(sale.id, cid(), uid(), { reason: 'test' });
      expect(await balance(p.id)).toBe(0);
      expect((await ledgerOf(sale.id)).at(-1)!.type).toBe('RETURN_CHARGE');
      await sales.restore(sale.id, cid(), uid());
      expect(await balance(p.id)).toBe(-60);
    });

    it('[BE-DP-037] {PaymentsService.makePayment} (happy-path) when the partner collected part, the customer can still pay the rest in the shop', async () => {
      const p = await partner();
      const sale = await order();
      await edit(sale.id, {
        status: 'DELIVERED',
        delivery_partner_id: p.id,
        cod_amount: 300,
      });
      expect((await saleOf(sale.id)).payment_status).toBe('partial');
      await payments.makePayment(
        {
          sale_id: sale.id,
          payments: [{ payment_method: 'CASH' as any, amount: 200 }],
        },
        cid(),
      );
      expect((await saleOf(sale.id)).payment_status).toBe('paid');
      // Now nothing is owed any more, so the partner cannot collect more
      await fails(
        edit(sale.id, { status: 'DELIVERED', cod_amount: 400 }),
        BadRequestException,
        /more than the customer still owes \(300\)/,
      );
    });
  });

  describe('payouts', () => {
    const deliveredOrder = async (partnerId: number) => {
      const sale = await order();
      await edit(sale.id, {
        status: 'DELIVERED',
        delivery_partner_id: partnerId,
      });
      return sale;
    };
    const payout = (partnerId: number, over: object = {}) =>
      partners.createSettlement(partnerId, cid(), uid(), {
        direction: 'RECEIVED',
        amount: 435,
        payment_method: SettlementPaymentMethod.BANK_TRANSFER,
        ...over,
      } as any);

    it('[BE-DP-040] {DeliveryPartnersService.createSettlement} {DeliveryPartnersService.getOrders} {DeliveryPartnersService.findAll} (happy-path) a payout settles the chosen orders and lowers the balance', async () => {
      const p = await partner();
      const one = await deliveredOrder(p.id);
      const two = await deliveredOrder(p.id);
      let listed = (await partners.findAll(cid()))[0];
      expect(listed).toMatchObject({
        balance: 870,
        unsettled_orders: 2,
        unsettled_net: 870,
      });
      const unsettled = await partners.getOrders(p.id, cid(), {});
      expect(unsettled.data.map((o) => [o.id, o.net])).toEqual([
        [two.id, 435],
        [one.id, 435],
      ]);
      const created = await payout(p.id, {
        sale_ids: [one.id],
        reference: ' TRX-1 ',
      });
      expect(created).toMatchObject({ amount: 435, reference: 'TRX-1' });
      expect((await saleOf(one.id)).partner_settlement_id).toBe(created.id);
      listed = (await partners.findAll(cid()))[0];
      expect(listed).toMatchObject({
        balance: 435,
        unsettled_orders: 1,
        unsettled_net: 435,
      });
      const settled = await partners.getOrders(p.id, cid(), {
        settlement: 'settled',
      });
      expect(settled.data.map((o) => o.id)).toEqual([one.id]);
      expect(
        (await partners.getOrders(p.id, cid(), { settlement: 'all' })).meta
          .total,
      ).toBe(2);
      // The online-orders screen filters the same way
      const filtered: any = await sales.findAllOnlineOrders(
        { delivery_partner_id: String(p.id), settlement: 'unsettled' },
        cid(),
      );
      expect(filtered.data.map((o: any) => o.id)).toEqual([two.id]);
      const settledList: any = await sales.findAllOnlineOrders(
        { settlement: 'settled' },
        cid(),
      );
      expect(settledList.data.map((o: any) => o.id)).toEqual([one.id]);
    });

    it('[BE-DP-041] {DeliveryPartnersService.createSettlement} (happy-path) a short payout can write the gap off; a payment to the partner raises the balance', async () => {
      const p = await partner();
      const sale = await deliveredOrder(p.id);
      await payout(p.id, {
        sale_ids: [sale.id],
        amount: 430,
        adjust_difference: true,
      });
      expect(await balance(p.id)).toBe(0);
      const rows = await db.deliveryPartnerTransaction.findMany({
        where: { partner_id: p.id, type: 'ADJUSTMENT' },
      });
      expect(rows.map((r) => Number(r.amount))).toEqual([-5]);
      expect(rows[0].note).toMatch(/Difference written off on payout #/);
      await payout(p.id, { direction: 'PAID', amount: 100 });
      expect(await balance(p.id)).toBe(100);
    });

    it('[BE-DP-042] {DeliveryPartnersService.createSettlement} (failure) orders that are not this partner’s unsettled orders, and a write-off without orders, are refused', async () => {
      const p = await partner();
      const other = await partner('Other');
      const sale = await deliveredOrder(p.id);
      const pending = await order();
      await edit(pending.id, { status: 'READY', delivery_partner_id: p.id });
      for (const ids of [[pending.id], [sale.id, 999999]]) {
        await fails(
          payout(p.id, { sale_ids: ids }),
          BadRequestException,
          /not unsettled delivered or returned orders of this partner/,
        );
      }
      await fails(
        payout(other.id, { sale_ids: [sale.id] }),
        BadRequestException,
        /not unsettled/,
      );
      await fails(
        payout(p.id, { adjust_difference: true }),
        BadRequestException,
        /Choose the orders/,
      );
      await fails(
        partners.createSettlement(p.id, w.bystander.consumer.id, uid(), {
          direction: 'RECEIVED',
          amount: 1,
          payment_method: SettlementPaymentMethod.CASH,
        }),
        NotFoundException,
        /not found/,
      );
      await payout(p.id, { sale_ids: [sale.id] });
      await fails(
        payout(p.id, { sale_ids: [sale.id] }),
        BadRequestException,
        /not unsettled/,
      );
      expect(
        await db.deliveryPartnerSettlement.count({
          where: { partner_id: p.id },
        }),
      ).toBe(1);
    });

    it('[BE-DP-043] {SalesService.updateOnlineOrderStatus} {SalesService.softDelete} (failure) a settled order is locked until its payout is voided', async () => {
      const p = await partner();
      const sale = await deliveredOrder(p.id);
      const settled = await payout(p.id, { sale_ids: [sale.id] });
      await fails(
        edit(sale.id, { status: 'RETURNED' }),
        BadRequestException,
        new RegExp(
          `settled in payout #${settled.id}\\. Void that payout first`,
        ),
      );
      await fails(
        edit(sale.id, { status: 'DELIVERED', delivery_charge: 1 }),
        BadRequestException,
        /settled in payout/,
      );
      await fails(
        sales.softDelete(sale.id, cid(), uid(), {}),
        BadRequestException,
        /payout #\d+\. Void that payout first/,
      );
      // An edit that changes nothing for the partner is still fine
      await edit(sale.id, { status: 'DELIVERED' });
    });

    it('[BE-DP-044] {DeliveryPartnersService.voidSettlement} (happy-path) voiding reverses the payout and its write-off and frees its orders', async () => {
      const p = await partner();
      const sale = await deliveredOrder(p.id);
      const settled = await payout(p.id, {
        sale_ids: [sale.id],
        amount: 400,
        adjust_difference: true,
      });
      expect(await balance(p.id)).toBe(0);
      expect(
        await partners.voidSettlement(p.id, settled.id, cid(), uid(), {
          reason: ' wrong amount ',
        }),
      ).toEqual({ success: true });
      expect(await balance(p.id)).toBe(435);
      expect((await saleOf(sale.id)).partner_settlement_id).toBeNull();
      const row = await db.deliveryPartnerSettlement.findUniqueOrThrow({
        where: { id: settled.id },
      });
      expect(row.voided_at).not.toBeNull();
      expect(row.void_reason).toBe('wrong amount');
      const history = await partners.getSettlements(p.id, cid());
      expect(history.data[0]).toMatchObject({ id: settled.id, orders: 0 });
      await edit(sale.id, { status: 'RETURNED' });
    });

    it('[BE-DP-045] {DeliveryPartnersService.voidSettlement} (failure) a voided, unknown or other-shop payout cannot be voided (cross-tenant)', async () => {
      const p = await partner();
      const settled = await payout(p.id, { amount: 10 });
      await partners.voidSettlement(p.id, settled.id, cid(), uid(), {
        reason: 'x',
      });
      await fails(
        partners.voidSettlement(p.id, settled.id, cid(), uid(), {
          reason: 'x',
        }),
        BadRequestException,
        /already voided/,
      );
      await fails(
        partners.voidSettlement(p.id, 999999, cid(), uid(), { reason: 'x' }),
        NotFoundException,
        /Payout not found/,
      );
      const other = await partner('Other');
      await fails(
        partners.voidSettlement(other.id, settled.id, cid(), uid(), {
          reason: 'x',
        }),
        NotFoundException,
        /Payout not found/,
      );
      await fails(
        partners.voidSettlement(
          p.id,
          settled.id,
          w.bystander.consumer.id,
          uid(),
          { reason: 'x' },
        ),
        NotFoundException,
        /Delivery partner not found/,
      );
    });

    it('[BE-DP-046] {DeliveryPartnersService.createAdjustment} {DeliveryPartnersService.getLedger} {DeliveryPartnersService.getSummary} (happy-path) the ledger shows each row with the balance after it, and the summary breaks the balance down', async () => {
      const p = await partner();
      const sale = await deliveredOrder(p.id);
      await payout(p.id, { sale_ids: [sale.id], amount: 400 });
      const adj = await partners.createAdjustment(p.id, cid(), uid(), {
        amount: -15,
        note: ' damaged parcel claim ',
      });
      expect(adj).toMatchObject({ amount: -15, note: 'damaged parcel claim' });
      const ledger = await partners.getLedger(p.id, cid(), { limit: 2 });
      expect(ledger.meta).toEqual({
        total: 5,
        page: 1,
        limit: 2,
        total_pages: 3,
      });
      expect(
        ledger.data.map((r) => [r.type, r.amount, r.balance_after]),
      ).toEqual([
        ['ADJUSTMENT', -15, 20],
        ['PAYOUT_RECEIVED', -400, 35],
      ]);
      const page3 = await partners.getLedger(p.id, cid(), {
        page: 3,
        limit: 2,
      });
      expect(page3.data.map((r) => [r.type, r.balance_after])).toEqual([
        ['COD_COLLECTED', 500],
      ]);
      expect(page3.data[0].sale).toEqual({
        id: sale.id,
        sale_number: sale.sale_number,
      });
      const summary = await partners.getSummary(p.id, cid());
      expect(summary).toMatchObject({
        balance: 20,
        totals: {
          cod_collected: 500,
          delivery_charges: 60,
          cod_fees: 5,
          return_charges: 0,
          payouts_received: 400,
          payments_made: 0,
          adjustments: -15,
          voided: 0,
        },
        unsettled: { orders: 0, net: 0 },
        last_settlement: { direction: 'RECEIVED', amount: 400 },
      });
    });

    it('[BE-DP-047] {DeliveryPartnersService.createAdjustment} {DeliveryPartnersService.getLedger} {DeliveryPartnersService.getOrders} {DeliveryPartnersService.getSettlements} (failure) a blank reason is refused; (cross-tenant) other shops see nothing', async () => {
      const p = await partner();
      await fails(
        partners.createAdjustment(p.id, cid(), uid(), {
          amount: 5,
          note: '   ',
        }),
        BadRequestException,
        /Say why/,
      );
      const other = w.bystander.consumer.id;
      for (const call of [
        () => partners.getLedger(p.id, other),
        () => partners.getOrders(p.id, other),
        () => partners.getSettlements(p.id, other),
        () =>
          partners.createAdjustment(p.id, other, uid(), {
            amount: 5,
            note: 'x',
          }),
      ]) {
        await fails(call(), NotFoundException, /Delivery partner not found/);
      }
      expect(await partners.getLedger(p.id, cid())).toMatchObject({
        data: [],
        meta: { total: 0 },
      });
    });
  });

  it('[BE-DP-050] {SalesService.getEODReport} (happy-path) cash a partner collected is counted as collected, but not as cash or digital money', async () => {
    const p = await partner();
    const sale = await order(100);
    await edit(sale.id, { status: 'DELIVERED', delivery_partner_id: p.id });
    const report: any = await sales.getEODReport(cid(), {
      date: new Date().toISOString().slice(0, 10),
    });
    expect(report.summary).toMatchObject({
      delivery_partner_collected: 400,
      cash_sales: 100,
      digital_sales: 0,
      real_money_collected: 100,
      total_collected: 500,
    });
    expect(
      report.payment_method_breakdown.find(
        (m: any) => m.payment_method === 'DELIVERY_PARTNER',
      ),
    ).toMatchObject({ total_amount: 400, transaction_count: 1 });
  });
});
