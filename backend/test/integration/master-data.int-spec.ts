import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createCustomer, createVendor } from '../factories';
import { CustomerService } from '../../src/consumer/customer/services/customer.service';
import { VendorService } from '../../src/consumer/vendor/services/vendor.service';
import { BranchService } from '../../src/consumer/branch/services/branch.service';
import { OperationalCostsService } from '../../src/consumer/operational-costs/services/operational-costs.service';
import { SupportService } from '../../src/consumer/support/services/support.service';
import { InventoryBatchService } from '../../src/consumer/inventory/services/inventory-batch.service';
import { ReturnService } from '../../src/consumer/returns/services/return.service';

describe('master data: customers, vendors, branches, costs, support', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let customers: CustomerService;
  let vendors: VendorService;
  let branches: BranchService;
  let costs: OperationalCostsService;
  let support: SupportService;

  beforeAll(async () => {
    boot = await bootDomain();
    customers = boot.get(CustomerService);
    vendors = boot.get(VendorService);
    branches = boot.get(BranchService);
    costs = boot.get(OperationalCostsService);
    support = boot.get(SupportService);
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
  const failure = async (promise: Promise<unknown> | (() => unknown)) =>
    Promise.resolve()
      .then(() => (typeof promise === 'function' ? promise() : promise))
      .then(
        () => null,
        (e: any) => e,
      );

  describe('customers', () => {
    const create = (name: string, extra: object = {}) =>
      customers.create(
        {
          name,
          phone: `01${Math.floor(Math.random() * 1e9)}`,
          customer_type: 'regular',
          ...extra,
        } as any,
        cid(),
      );

    it('[BE-CUST-001] create stores a tenant-owned customer; listings are tenant scoped, sorted and searchable', async () => {
      await create('Zoya Rahman', { email: 'zoya@example.test' });
      await create('Amir Khan');
      await createCustomer(db, {
        consumer_id: w.bystander.consumer.id,
        name: 'Amir Hidden',
      });
      await w.rebaseBystander();
      expect((await customers.findAll(cid())).map((c) => c.name)).toEqual([
        'Amir Khan',
        'Zoya Rahman',
      ]);
      const found: any = await customers.search('AMIR', cid());
      expect(found.data.map((c: any) => c.name)).toEqual(['Amir Khan']);
      expect(await customers.search('   ', cid())).toEqual([]);
      const page: any = await customers.findAllWithFilters(
        { search: 'zoya', limit: 500 },
        cid(),
      );
      expect(page.data).toHaveLength(1);
      expect(page.meta).toMatchObject({ total: 1, limit: 100, total_pages: 1 });
    });

    it("[BE-CUST-002] every read and write on another tenant's customer is NotFound", async () => {
      const foreign = await createCustomer(db, {
        consumer_id: w.bystander.consumer.id,
      });
      await w.rebaseBystander();
      const calls: Array<() => Promise<unknown>> = [
        () => customers.findOne(foreign.id, cid()),
        () => customers.getSummary(foreign.id, cid()),
        () => customers.getSalesHistory(foreign.id, cid()),
        () => customers.getReturnsHistory(foreign.id, cid()),
        () => customers.getRewardsHistory(foreign.id, cid()),
        () => customers.update(foreign.id, { name: 'x' }, cid()),
        () => customers.remove(foreign.id, cid()),
      ];
      for (const call of calls) {
        expect(await failure(call)).toBeInstanceOf(NotFoundException);
      }
      expect(
        (await db.customer.findUniqueOrThrow({ where: { id: foreign.id } }))
          .name,
      ).toBe(foreign.name);
    });

    it('[BE-CUST-003] the summary equals the raw sales, returns and rewards rows', async () => {
      const customer = await create('Summary Person');
      const v = await w.stock({ price: 100, batches: [{ qty: 20, cost: 10 }] });
      const paid = await w.sell([{ variant: v, qty: 2 }], {
        customer_id: customer.id,
      });
      await w.sell([{ variant: v, qty: 1 }], { customer_id: customer.id }, 40); // 60 outstanding
      const item = await db.saleItem.findFirstOrThrow({
        where: { sale_id: paid.id },
      });
      const batch = await db.inventoryBatch.findFirstOrThrow({
        where: { variant_id: v.id },
      });
      await boot.get(ReturnService).create(cid(), uid(), {
        original_sale_id: paid.id,
        branch_id: w.tenant.branches[0].id,
        items: [
          {
            sale_item_id: item.id,
            variant_id: v.id,
            batch_id: batch.id,
            quantity: 1,
          },
        ],
        payments: [{ payment_method: 'CASH', amount: 100 }],
      } as any);
      const summary: any = await customers.getSummary(customer.id, cid());
      expect(summary.sales).toMatchObject({
        count: 2,
        gross_amount: 300,
        paid_amount: 240,
        outstanding_amount: 60,
      });
      expect(summary.returns).toMatchObject({
        count: 1,
        refunded_amount: 100,
        exchanged_amount: 0,
      });
      expect(summary.recent_sales).toHaveLength(2);
      const history: any = await customers.getSalesHistory(
        customer.id,
        cid(),
        1,
        1,
      );
      expect(history.meta).toMatchObject({
        total: 2,
        limit: 1,
        total_pages: 2,
      });
      expect(
        (await customers.getReturnsHistory(customer.id, cid())).data,
      ).toHaveLength(1);
    });

    it('[BE-CUST-004] deleting a customer keeps their sales; an empty birthday clears the stored one', async () => {
      const customer = await create('To Delete', { birthday: '1990-05-17' });
      expect(
        (await db.customer.findUniqueOrThrow({ where: { id: customer.id } }))
          .birthday,
      ).not.toBeNull();
      await customers.update(customer.id, { birthday: '' }, cid());
      expect(
        (await db.customer.findUniqueOrThrow({ where: { id: customer.id } }))
          .birthday,
      ).toBeNull();
      const v = await w.stock({ price: 100, batches: [{ qty: 5, cost: 10 }] });
      const sale = await w.sell([{ variant: v, qty: 1 }], {
        customer_id: customer.id,
        customer_name: 'To Delete',
      });
      await customers.remove(customer.id, cid());
      const kept = await db.sale.findUniqueOrThrow({ where: { id: sale.id } });
      expect(kept).toMatchObject({
        customer_id: null,
        customer_name: 'To Delete',
      });
    });
  });

  describe('vendors', () => {
    it('[BE-VEND-001] create, list, update and delete a vendor', async () => {
      const created: any = await vendors.create(
        { name: 'Acme Supplies', phone: '0170' },
        cid(),
      );
      expect(created.consumer_id).toBe(cid());
      expect((await vendors.findAll(cid())).map((v) => v.name)).toEqual([
        'Acme Supplies',
      ]);
      expect(
        (await vendors.update(created.id, { name: 'Acme Ltd' } as any, cid()))
          .name,
      ).toBe('Acme Ltd');
      expect(await vendors.remove(created.id, cid())).toEqual({
        success: true,
      });
    });

    it("[BE-VEND-002] another tenant's vendor is NotFound for every call", async () => {
      const foreign = await createVendor(db, {
        consumer_id: w.bystander.consumer.id,
      });
      await w.rebaseBystander();
      for (const call of [
        () => vendors.findOne(foreign.id, cid()),
        () => vendors.update(foreign.id, { name: 'x' }, cid()),
        () => vendors.remove(foreign.id, cid()),
        () => vendors.findOneWithDetails(foreign.id, cid()),
      ]) {
        expect(await failure(call)).toBeInstanceOf(NotFoundException);
      }
    });

    it('[BE-VEND-003] a vendor with stock batches cannot be deleted, with a 400 that says why', async () => {
      const vendor = await createVendor(db, { consumer_id: cid() });
      const v = await w.stock({ price: 100, batches: [] });
      await boot.get(InventoryBatchService).create(cid(), uid(), {
        variant_id: v.id,
        branch_id: w.tenant.branches[0].id,
        batch_number: 'V-1',
        quantity: 5,
        cost_price: '10',
        vendor_id: vendor.id,
      });
      const error = await failure(vendors.remove(vendor.id, cid()));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toMatch(/1 associated batches/);
      expect(await db.vendor.count({ where: { id: vendor.id } })).toBe(1);
    });

    it('[BE-VEND-004] the vendor summary owes the purchased quantity even after the stock sold', async () => {
      const vendor = await createVendor(db, { consumer_id: cid() });
      const v = await w.stock({ price: 100, batches: [] });
      await boot.get(InventoryBatchService).create(cid(), uid(), {
        variant_id: v.id,
        branch_id: w.tenant.branches[0].id,
        batch_number: 'V-2',
        quantity: 10,
        cost_price: '40',
        vendor_id: vendor.id,
        payments: [{ payment_method: 'CASH', amount: 100 }],
      } as any);
      await w.sell([{ variant: v, qty: 10 }]);
      const details: any = await vendors.findOneWithDetails(vendor.id, cid());
      expect(details.summary).toMatchObject({
        totalCost: 400,
        totalPaid: 100,
        totalOwed: 300,
      });
      expect(details.batches[0]).toMatchObject({
        total_cost: 400,
        remaining_amount: 300,
      });
    });
  });

  describe('branches', () => {
    const add = (name: string, is_main = false) =>
      branches.create({ name, is_main }, cid()) as Promise<any>;
    const mainCount = () =>
      db.branch.count({ where: { consumer_id: cid(), is_main: true } });

    it('[BE-BRCH-001] a new main branch takes over; there is never more than one', async () => {
      await db.consumer.update({
        where: { id: cid() },
        data: { max_branch: 4 },
      });
      const second = await add('Second');
      expect(second.is_main).toBe(false);
      const third = await add('Third', true);
      expect(third.is_main).toBe(true);
      expect(await mainCount()).toBe(1);
      await branches.setMainBranch(second.id, cid());
      expect(await mainCount()).toBe(1);
      expect(
        (await db.branch.findUniqueOrThrow({ where: { id: second.id } }))
          .is_main,
      ).toBe(true);
      await branches.update(third.id, { is_main: true }, cid());
      expect(await mainCount()).toBe(1);
      expect(
        (await db.branch.findUniqueOrThrow({ where: { id: third.id } }))
          .is_main,
      ).toBe(true);
    });

    it("[BE-BRCH-002] the plan's branch limit is enforced", async () => {
      await db.consumer.update({
        where: { id: cid() },
        data: { max_branch: 1 },
      });
      const error = await failure(add('Over limit'));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toMatch(/Branch limit reached/);
    });

    it("[BE-BRCH-003] another tenant's branch is NotFound for every call", async () => {
      const foreign = w.bystander.branches[0];
      for (const call of [
        () => branches.findOne(foreign.id, cid()),
        () => branches.update(foreign.id, { name: 'x' }, cid()),
        () => branches.remove(foreign.id, cid()),
        () => branches.setMainBranch(foreign.id, cid()),
      ]) {
        expect(await failure(call)).toBeInstanceOf(NotFoundException);
      }
      expect(
        (await branches.findAll(cid())).every(
          (b: any) => b.consumer_id === cid(),
        ),
      ).toBe(true);
    });

    it('[BE-BRCH-004] the last and the main branch cannot be deleted, with a 400', async () => {
      const only = w.tenant.branches[0];
      const last = await failure(branches.remove(only.id, cid()));
      expect(last).toBeInstanceOf(BadRequestException);
      expect(last.message).toMatch(/last remaining branch/);
      await db.consumer.update({
        where: { id: cid() },
        data: { max_branch: 3 },
      });
      const extra = await add('Extra');
      const main = await failure(branches.remove(only.id, cid()));
      expect(main).toBeInstanceOf(BadRequestException);
      expect(main.message).toMatch(/main branch/);
      expect(await branches.remove(extra.id, cid())).toEqual({ success: true });
    });

    it('[BE-BRCH-005] a branch that holds stock cannot be deleted, with a readable error', async () => {
      await db.consumer.update({
        where: { id: cid() },
        data: { max_branch: 3 },
      });
      const extra = await add('Warehouse');
      const v = await w.stock({ price: 10, batches: [] });
      await boot.get(InventoryBatchService).create(cid(), uid(), {
        variant_id: v.id,
        branch_id: extra.id,
        batch_number: 'W-1',
        quantity: 3,
        cost_price: '5',
      });
      const error = await failure(branches.remove(extra.id, cid()));
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error.code).toBe('P2003');
    });
  });

  describe('operational costs', () => {
    const dto = (extra: object = {}) =>
      ({
        name: ' Rent ',
        amount: 500,
        incurred_on: '2026-03-10',
        ...extra,
      }) as any;

    it('[BE-OPC-001] create, filter, update and delete a cost', async () => {
      const a: any = await costs.create(
        cid(),
        uid(),
        dto({ branch_id: w.tenant.branches[0].id }),
      );
      expect(a).toMatchObject({
        name: 'Rent',
        consumer_id: cid(),
        created_by: uid(),
      });
      await costs.create(
        cid(),
        uid(),
        dto({ incurred_on: '2026-04-10', name: 'Power' }),
      );
      expect(
        (await costs.findAll(cid(), { from: '2026-04-01' } as any)).map(
          (c) => c.name,
        ),
      ).toEqual(['Power']);
      expect(
        (
          await costs.findAll(cid(), {
            branch_id: w.tenant.branches[0].id,
          } as any)
        ).map((c) => c.name),
      ).toEqual(['Rent']);
      const updated = await costs.update(
        a.id,
        cid(),
        dto({ name: 'Rent March', amount: 600 }),
      );
      expect(Number(updated.amount)).toBe(600);
      expect(updated.branch_id).toBeNull();
      expect(await costs.remove(a.id, cid())).toEqual({ success: true });
    });

    it("[BE-OPC-002] another tenant's branch or cost is NotFound", async () => {
      const foreignBranch = w.bystander.branches[0].id;
      expect(
        await failure(
          costs.create(cid(), uid(), dto({ branch_id: foreignBranch })),
        ),
      ).toBeInstanceOf(NotFoundException);
      const own: any = await costs.create(cid(), uid(), dto());
      expect(
        await failure(
          costs.update(own.id, cid(), dto({ branch_id: foreignBranch })),
        ),
      ).toBeInstanceOf(NotFoundException);
      const theirs = await db.operationalCost.create({
        data: {
          consumer_id: w.bystander.consumer.id,
          created_by: w.bystander.adminUser.id,
          name: 'Theirs',
          amount: 1,
          incurred_on: new Date('2026-03-01T00:00:00Z'),
        },
      });
      await w.rebaseBystander();
      expect(
        await failure(costs.update(theirs.id, cid(), dto())),
      ).toBeInstanceOf(NotFoundException);
      expect(await failure(costs.remove(theirs.id, cid()))).toBeInstanceOf(
        NotFoundException,
      );
      expect((await costs.findAll(cid(), {} as any)).map((c) => c.id)).toEqual([
        own.id,
      ]);
    });
  });

  describe('support tickets', () => {
    const open = () =>
      support.create(cid(), uid(), {
        subject: ' Printer ',
        category: 'TECHNICAL',
        message: ' It jams ',
      } as any) as Promise<any>;

    it('[BE-SUP-001] a ticket starts open with its first message; replies, close and reopen move the status', async () => {
      const ticket = await open();
      expect(ticket).toMatchObject({
        status: 'OPEN',
        priority: 'MEDIUM',
        subject: 'Printer',
      });
      expect(ticket.messages.map((m: any) => m.body)).toEqual(['It jams']);
      await db.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'IN_PROGRESS' },
      });
      const replied = await support.addMessage(ticket.id, cid(), uid(), {
        body: 'More info',
      });
      expect(replied.status).toBe('IN_PROGRESS');
      expect(replied.messages).toHaveLength(2);
      expect((await support.close(ticket.id, cid())).status).toBe('CLOSED');
      const afterReply = await support.addMessage(ticket.id, cid(), uid(), {
        body: 'Still broken',
      });
      expect(afterReply).toMatchObject({ status: 'OPEN', closed_at: null });
      await support.close(ticket.id, cid());
      expect((await support.reopen(ticket.id, cid())).status).toBe('OPEN');
    });

    it("[BE-SUP-002] listing filters by status and subject and never shows another tenant's tickets", async () => {
      const mine = await open();
      await support.create(cid(), uid(), {
        subject: 'Billing question',
        category: 'BILLING',
        message: 'Hi',
      } as any);
      await db.supportTicket.create({
        data: {
          consumer_id: w.bystander.consumer.id,
          created_by_id: w.bystander.adminUser.id,
          subject: 'Printer',
          category: 'TECHNICAL',
        },
      });
      await w.rebaseBystander();
      expect(
        (await support.findAll(cid(), { search: 'printer' } as any)).map(
          (t) => t.id,
        ),
      ).toEqual([mine.id]);
      await support.close(mine.id, cid());
      expect(
        (await support.findAll(cid(), { status: 'CLOSED' } as any)).map(
          (t) => t.id,
        ),
      ).toEqual([mine.id]);
      expect(
        await support.findAll(cid(), { status: 'RESOLVED' } as any),
      ).toEqual([]);
    });

    it("[BE-SUP-003] another tenant's ticket is NotFound for every call", async () => {
      const theirs = await db.supportTicket.create({
        data: {
          consumer_id: w.bystander.consumer.id,
          created_by_id: w.bystander.adminUser.id,
          subject: 'Theirs',
          category: 'OTHER',
        },
      });
      await w.rebaseBystander();
      for (const call of [
        () => support.findOne(theirs.id, cid()),
        () => support.addMessage(theirs.id, cid(), uid(), { body: 'x' }),
        () => support.close(theirs.id, cid()),
        () => support.reopen(theirs.id, cid()),
      ]) {
        expect(await failure(call)).toBeInstanceOf(NotFoundException);
      }
    });
  });
});
