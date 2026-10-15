import { BadRequestException } from '@nestjs/common';
import { ProductAuditService } from '../../src/product-audit/services/product-audit.service';
import { ProductAuditPdfService } from '../../src/product-audit/services/product-audit-pdf.service';
import { createBatch } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { pdfText } from '../helpers/pdf';

describe('product audit detail', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let service: ProductAuditService;
  beforeAll(async () => {
    boot = await bootDomain();
    service = boot.get(ProductAuditService);
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 2 });
  });
  afterEach(async () => {
    // No w.check(): these specs seed deliberately unbalanced audit rows (and a foreign-tenant row).
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;
  const at = (s: string) => new Date(s);

  async function scenario() {
    const b0 = w.tenant.branches[0].id;
    const b1 = w.tenant.branches[1].id;
    const variant = await w.stock({ price: 100, batches: [] });
    const other = await w.stock({ price: 10, batches: [] });
    const batchA = await createBatch(db, w.tenant, {
      variant_id: variant.id,
      branch_id: b0,
      quantity: 7,
      created_at: at('2026-03-10T12:00:00Z'),
    });
    const batchB = await createBatch(db, w.tenant, {
      variant_id: variant.id,
      branch_id: b1,
      quantity: 5,
      created_at: at('2026-03-12T12:00:00Z'),
    });
    // different variant: must never leak into the totals
    await createBatch(db, w.tenant, {
      variant_id: other.id,
      branch_id: b0,
      quantity: 99,
      created_at: at('2026-03-11T12:00:00Z'),
    });
    const log = (
      data: Partial<Parameters<typeof db.inventoryAuditLog.create>[0]['data']>,
    ) =>
      db.inventoryAuditLog.create({
        data: {
          consumer_id: cid(),
          branch_id: b0,
          variant_id: variant.id,
          event_type: 'ADJUSTMENT',
          quantity_delta: 0,
          quantity_after: 0,
          ...data,
        } as any,
      });
    await log({
      batch_id: batchA.id,
      inventoryBatchId: batchA.id,
      event_type: 'SALE_OUT',
      quantity_delta: -3,
      created_at: at('2026-03-11T09:00:00Z'),
      created_by_user_id: w.tenant.adminUser.id,
    });
    await log({
      batch_id: 999999,
      quantity_delta: 2,
      created_at: at('2026-03-11T10:00:00Z'),
    });
    await log({
      batch_id: null,
      branch_id: b1,
      quantity_delta: 4,
      created_at: at('2026-03-11T11:00:00Z'),
    });
    // boundaries: start-of-day and end-of-day inclusive
    await log({
      batch_id: batchA.id,
      inventoryBatchId: batchA.id,
      quantity_delta: 1,
      created_at: at('2026-03-10T00:00:00.000Z'),
    });
    await log({
      batch_id: batchA.id,
      inventoryBatchId: batchA.id,
      quantity_delta: 1,
      created_at: at('2026-03-12T23:59:59.999Z'),
    });
    // just outside the period
    await log({
      batch_id: batchA.id,
      inventoryBatchId: batchA.id,
      quantity_delta: 100,
      created_at: at('2026-03-09T23:59:59.999Z'),
    });
    await log({
      batch_id: batchA.id,
      inventoryBatchId: batchA.id,
      quantity_delta: 1000,
      created_at: at('2026-03-13T00:00:00.000Z'),
    });
    // another tenant's log row for the same variant id
    await log({
      consumer_id: w.bystander.consumer.id,
      branch_id: w.bystander.branches[0].id,
      quantity_delta: 5000,
      created_at: at('2026-03-11T08:00:00Z'),
    });
    return { variant, batchA, batchB, b0, b1 };
  }
  const query = (variant_id: number, extra: object = {}) => ({
    variant_id,
    start_date: '2026-03-10',
    end_date: '2026-03-12',
    ...extra,
  });

  it('[BE-AUD-100] {ProductAuditService.getAuditData} summary, per-branch and per-batch figures over the inclusive period', async () => {
    const { variant, batchA, batchB, b0, b1 } = await scenario();
    const data = await service.getAuditData(cid(), query(variant.id));

    expect(data.meta.consumer!.id).toBe(cid());
    expect(data.meta.variant.id).toBe(variant.id);
    expect(data.meta.variant.product).toHaveProperty('category');
    expect(data.meta.variant.product).toHaveProperty('brand');
    expect(data.meta.variant).toHaveProperty('sale_unit');
    expect(Array.isArray(data.meta.variant.VariantAttribute)).toBe(true);
    expect(data.meta.period).toEqual({
      start_date: '2026-03-10',
      end_date: '2026-03-12',
    });
    expect(data.meta.branch_id).toBeUndefined();
    expect(data.meta.generated_at).toBeInstanceOf(Date);

    expect(data.summary).toMatchObject({
      current_stock: 12,
      net_change: 17,
      opening_stock: -5,
      total_events: 7,
    });
    expect(data.summary.by_branch).toHaveLength(2);
    const br0 = data.summary.by_branch.find((r) => r.branch_id === b0)!;
    const br1 = data.summary.by_branch.find((r) => r.branch_id === b1)!;
    expect(br0).toEqual({
      branch_id: b0,
      branch_name: w.tenant.branches[0].name,
      opening_stock: -1,
      current_stock: 7,
      net_change: 8,
      total_events: 5,
    });
    expect(br1).toEqual({
      branch_id: b1,
      branch_name: w.tenant.branches[1].name,
      opening_stock: -4,
      current_stock: 5,
      net_change: 9,
      total_events: 2,
    });

    // sorted by first event (batch A at start of day, orphan, then B)
    expect(data.batches.map((g: any) => g.batchInfo.id)).toEqual([
      batchA.id,
      999999,
      batchB.id,
    ]);
    const [ga, gh, gb] = data.batches;
    expect(ga.events.map((e: any) => e.quantity_delta)).toEqual([1, 7, -3, 1]);
    expect(ga.periodStartQty).toBe(1);
    expect(ga.batchInfo.quantity).toBe(7);
    expect(gh.batchInfo).toMatchObject({
      id: 999999,
      batch_number: 'Historical',
    });
    expect(gh.batchInfo.branch.id).toBe(b0);
    expect(gh.events.map((e: any) => e.quantity_delta)).toEqual([2]);
    expect(gh.periodStartQty).toBe(-2);
    expect(gb.events.map((e: any) => e.quantity_delta)).toEqual([5]);
    expect(gb.periodStartQty).toBe(0);
    // events carry creator and branch relations
    const sale = ga.events.find((e: any) => e.event_type === 'SALE_OUT');
    expect(sale.created_by).toEqual({
      id: w.tenant.adminUser.id,
      name: w.tenant.adminUser.name,
    });
    expect(sale.branch.id).toBe(b0);
  });

  it('[BE-AUD-101] {ProductAuditService.getAuditData} the branch filter limits batches, logs and totals to that branch', async () => {
    const { variant, batchB, b1 } = await scenario();
    const data = await service.getAuditData(
      cid(),
      query(variant.id, { branch_id: b1 }),
    );
    expect(data.meta.branch_id).toBe(b1);
    expect(data.summary).toMatchObject({
      current_stock: 5,
      net_change: 9,
      opening_stock: -4,
      total_events: 2,
    });
    expect(data.summary.by_branch.map((r) => r.branch_id)).toEqual([b1]);
    expect(data.batches.map((g: any) => g.batchInfo.id)).toEqual([batchB.id]);
  });

  it('[BE-AUD-102] {ProductAuditService.getAuditData} a quiet period reports opening equal to current stock and keeps idle batches', async () => {
    const { variant, batchA, batchB } = await scenario();
    const data = await service.getAuditData(cid(), {
      variant_id: variant.id,
      start_date: '2026-06-01',
      end_date: '2026-06-02',
    });
    expect(data.summary).toMatchObject({
      current_stock: 12,
      net_change: 0,
      opening_stock: 12,
      total_events: 0,
    });
    expect(
      data.summary.by_branch.map((r) => [r.current_stock, r.opening_stock]),
    ).toEqual(
      expect.arrayContaining([
        [7, 7],
        [5, 5],
      ]),
    );
    // batches sorted by their own creation date when there are no events
    expect(data.batches.map((g: any) => g.batchInfo.id)).toEqual([
      batchA.id,
      batchB.id,
    ]);
    expect(data.batches.map((g) => g.periodStartQty)).toEqual([7, 5]);
  });

  it('[BE-AUD-103] {ProductAuditService.getAuditData} {ProductAuditService.generateAuditReport} unknown or foreign variants are rejected with Variant not found', async () => {
    const { variant } = await scenario();
    for (const [consumer, id] of [
      [cid(), 987654],
      [w.bystander.consumer.id, variant.id],
    ]) {
      for (const action of [
        () => service.getAuditData(consumer, query(id)),
        () => service.generateAuditReport(consumer, query(id)),
      ]) {
        const error = await action().catch((e) => e);
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Variant not found');
      }
    }
  });

  it('[BE-AUD-104] {ProductAuditService.generateAuditReport} hands the built data to the PDF service and returns its buffer', async () => {
    const { variant } = await scenario();
    const pdf = boot.get(ProductAuditPdfService);
    const sentinel = Buffer.from('pdf-bytes');
    const spy = jest.spyOn(pdf, 'generatePdf').mockResolvedValue(sentinel);
    const result = await service.generateAuditReport(cid(), query(variant.id));
    expect(result).toBe(sentinel);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.summary).toMatchObject({ current_stock: 12, net_change: 17 });
    expect(arg.meta.variant.id).toBe(variant.id);
    spy.mockRestore();
    const real = await service.generateAuditReport(cid(), query(variant.id));
    expect(pdfText(real)).toContain(variant.product.name);
  });
});
