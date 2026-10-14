import { ProductAuditService } from '../../src/product-audit/services/product-audit.service';
import { ProductAuditPdfService } from '../../src/product-audit/services/product-audit-pdf.service';
import { createBatch, createVendor } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('product audit extra (mutation hardening)', () => {
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
  afterEach(() => {
    // No w.check(): these specs seed deliberately unbalanced audit rows.
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;
  const at = (s: string) => new Date(s);
  const q = (variant_id: number, extra: object = {}) => ({
    variant_id,
    start_date: '2026-03-10',
    end_date: '2026-03-12',
    ...extra,
  });
  const log = (
    variantId: number,
    branchId: number,
    delta: number,
    when: string,
    extra: object = {},
  ) =>
    db.inventoryAuditLog.create({
      data: {
        consumer_id: cid(),
        branch_id: branchId,
        variant_id: variantId,
        event_type: 'ADJUSTMENT',
        quantity_delta: delta,
        quantity_after: 0,
        created_at: at(when),
        ...extra,
      } as any,
    });
  const mkVariant = () => w.stock({ price: 10, batches: [] });

  it('[BE-AUD-200] {ProductAuditService.getAuditData} a branch that only has log movement is reported after the stocked branches with its name from the log', async () => {
    const b0 = w.tenant.branches[0].id;
    const b1 = w.tenant.branches[1].id;
    const v = await mkVariant();
    const other = await mkVariant();
    const x = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 4,
      created_at: at('2026-03-11T08:00:00Z'),
    });
    await log(v.id, b1, -2, '2026-03-11T09:00:00Z');
    await log(other.id, b1, 50, '2026-03-11T09:30:00Z');
    const d = await service.getAuditData(cid(), q(v.id));
    expect(d.summary).toMatchObject({
      current_stock: 4,
      net_change: 2,
      opening_stock: 2,
      total_events: 2,
    });
    expect(d.summary.by_branch).toEqual([
      {
        branch_id: b0,
        branch_name: w.tenant.branches[0].name,
        opening_stock: 0,
        current_stock: 4,
        net_change: 4,
        total_events: 1,
      },
      {
        branch_id: b1,
        branch_name: w.tenant.branches[1].name,
        opening_stock: 2,
        current_stock: 0,
        net_change: -2,
        total_events: 1,
      },
    ]);
    expect(d.batches.map((g: any) => g.batchInfo.id)).toEqual([x.id]);
  });

  it('[BE-AUD-201] {ProductAuditService.getAuditData} filtering by branch keeps foreign-branch batches that logged in this branch as historical groups with their real batch info', async () => {
    const b0 = w.tenant.branches[0].id;
    const b1 = w.tenant.branches[1].id;
    const v = await mkVariant();
    const idle = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 0,
      created_at: at('2026-03-01T00:00:00Z'),
    });
    const moved = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b1,
      quantity: 5,
      batch_number: 'MOVED-1',
      created_at: at('2026-02-01T00:00:00Z'),
    });
    await log(v.id, b0, 2, '2026-03-11T10:00:00Z', {
      batch_id: moved.id,
      inventoryBatchId: moved.id,
    });
    const d = await service.getAuditData(cid(), q(v.id, { branch_id: b0 }));
    expect(d.meta.branch_id).toBe(b0);
    expect(d.summary).toMatchObject({
      current_stock: 0,
      net_change: 2,
      opening_stock: -2,
      total_events: 1,
    });
    expect(d.summary.by_branch).toEqual([
      {
        branch_id: b0,
        branch_name: w.tenant.branches[0].name,
        opening_stock: -2,
        current_stock: 0,
        net_change: 2,
        total_events: 1,
      },
    ]);
    expect(d.batches.map((g: any) => g.batchInfo.id)).toEqual([
      idle.id,
      moved.id,
    ]);
    const [gi, gm] = d.batches;
    expect(gi.events).toEqual([]);
    expect(gi.periodStartQty).toBe(0);
    expect(gm.batchInfo).toMatchObject({
      id: moved.id,
      batch_number: 'MOVED-1',
      quantity: 5,
    });
    expect(gm.batchInfo.branch.id).toBe(b1);
    expect(gm.batchInfo).toHaveProperty('vendor');
    expect(gm.periodStartQty).toBe(3);
    expect(gm.events).toHaveLength(1);
  });

  it('[BE-AUD-202] {ProductAuditService.getAuditData} batches order by their first in-period event, falling back to their own creation date', async () => {
    const b0 = w.tenant.branches[0].id;
    const v = await mkVariant();
    const x = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 3,
      created_at: at('2026-03-01T00:00:00Z'),
    });
    const y = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 2,
      created_at: at('2026-03-05T00:00:00Z'),
    });
    const z = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 1,
      created_at: at('2026-03-11T11:00:00Z'),
    });
    await log(v.id, b0, -1, '2026-03-11T10:00:00Z', {
      batch_id: x.id,
      inventoryBatchId: x.id,
    });
    const d = await service.getAuditData(cid(), q(v.id));
    expect(d.batches.map((g: any) => g.batchInfo.id)).toEqual([
      y.id,
      x.id,
      z.id,
    ]);
    expect(d.batches.map((g: any) => g.periodStartQty)).toEqual([2, 4, 0]);
    expect(d.batches.map((g: any) => g.events.length)).toEqual([0, 1, 1]);
    expect(d.summary).toMatchObject({ current_stock: 6, net_change: 0 });
  });

  it('[BE-AUD-203] {ProductAuditService.getAuditData} a single-day period includes its first and last millisecond and nothing either side', async () => {
    const b0 = w.tenant.branches[0].id;
    const v = await mkVariant();
    await log(v.id, b0, 1, '2026-03-10T00:00:00.000Z');
    await log(v.id, b0, 2, '2026-03-10T23:59:59.999Z');
    await log(v.id, b0, 100, '2026-03-09T23:59:59.999Z');
    await log(v.id, b0, 1000, '2026-03-11T00:00:00.000Z');
    const d = await service.getAuditData(
      cid(),
      q(v.id, { end_date: '2026-03-10' }),
    );
    expect(d.summary).toMatchObject({
      current_stock: 0,
      net_change: 3,
      opening_stock: -3,
      total_events: 2,
    });
    expect(d.summary.by_branch).toHaveLength(1);
    expect(d.summary.by_branch[0]).toMatchObject({
      total_events: 2,
      net_change: 3,
    });
    expect(d.batches).toEqual([]);
  });

  it('[BE-AUD-204] {ProductAuditService.getAuditData} idle batches carry their branch and vendor relations and an unchanged opening quantity', async () => {
    const b0 = w.tenant.branches[0].id;
    const vendor = await createVendor(db, { consumer_id: cid() });
    const v = await mkVariant();
    const withVendor = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 6,
      vendor_id: vendor.id,
      created_at: at('2026-01-01T00:00:00Z'),
    });
    const bare = await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 2,
      created_at: at('2026-01-02T00:00:00Z'),
    });
    const d = await service.getAuditData(cid(), q(v.id));
    expect(d.batches.map((g: any) => g.batchInfo.id)).toEqual([
      withVendor.id,
      bare.id,
    ]);
    expect(d.batches[0].batchInfo.vendor.id).toBe(vendor.id);
    expect(d.batches[0].batchInfo.branch.id).toBe(b0);
    expect(d.batches[1].batchInfo.vendor).toBeNull();
    expect(d.batches.map((g: any) => g.periodStartQty)).toEqual([6, 2]);
    expect(d.batches.map((g: any) => g.events)).toEqual([[], []]);
    expect(d.summary).toMatchObject({
      current_stock: 8,
      opening_stock: 8,
      net_change: 0,
      total_events: 0,
    });
  });

  it('[BE-AUD-205] {ProductAuditService.getAuditData} meta echoes the query, the tenant consumer and a fresh timestamp', async () => {
    const b0 = w.tenant.branches[0].id;
    const v = await mkVariant();
    const before = Date.now();
    const d = await service.getAuditData(cid(), q(v.id, { branch_id: b0 }));
    const after = Date.now();
    expect(d.meta.branch_id).toBe(b0);
    expect(d.meta.period).toEqual({
      start_date: '2026-03-10',
      end_date: '2026-03-12',
    });
    expect(d.meta.consumer!.id).toBe(cid());
    expect(d.meta.consumer!.company_name).toBe(w.tenant.consumer.company_name);
    expect(d.meta.variant.id).toBe(v.id);
    expect(d.meta.variant.product_id).toBe(v.product_id);
    expect(d.meta.generated_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.meta.generated_at.getTime()).toBeLessThanOrEqual(after);
    expect(Object.keys(d).sort()).toEqual(['batches', 'meta', 'summary']);
    expect(Object.keys(d.summary).sort()).toEqual(
      [
        'by_branch',
        'current_stock',
        'net_change',
        'opening_stock',
        'total_events',
      ].sort(),
    );
    expect(Object.keys(d.meta).sort()).toEqual(
      ['branch_id', 'consumer', 'generated_at', 'period', 'variant'].sort(),
    );
  });

  it('[BE-AUD-206] {ProductAuditService.getAuditData} another tenant stock and logs on the same variant id never count', async () => {
    const b0 = w.tenant.branches[0].id;
    const v = await mkVariant();
    await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 3,
      created_at: at('2026-03-11T08:00:00Z'),
    });
    await log(v.id, b0, 11, '2026-03-11T09:00:00Z', {
      consumer_id: w.bystander.consumer.id,
      branch_id: w.bystander.branches[0].id,
    });
    const d = await service.getAuditData(cid(), q(v.id));
    expect(d.summary).toMatchObject({
      current_stock: 3,
      net_change: 3,
      total_events: 1,
    });
    expect(d.summary.by_branch.map((r) => r.branch_id)).toEqual([b0]);
  });

  it('[BE-AUD-207] {ProductAuditService.generateAuditReport} the PDF is built from exactly the data getAuditData returns', async () => {
    const b0 = w.tenant.branches[0].id;
    const v = await mkVariant();
    await createBatch(db, w.tenant, {
      variant_id: v.id,
      branch_id: b0,
      quantity: 3,
      created_at: at('2026-03-11T08:00:00Z'),
    });
    const spy = jest
      .spyOn(boot.get(ProductAuditPdfService), 'generatePdf')
      .mockResolvedValue(Buffer.from('x'));
    await service.generateAuditReport(cid(), q(v.id));
    const sent: any = spy.mock.calls[0][0];
    const direct: any = await service.getAuditData(cid(), q(v.id));
    delete sent.meta.generated_at;
    delete direct.meta.generated_at;
    expect(sent).toEqual(direct);
    expect(sent.batches).toHaveLength(1);
    expect(sent.summary.total_events).toBe(1);
  });
});
