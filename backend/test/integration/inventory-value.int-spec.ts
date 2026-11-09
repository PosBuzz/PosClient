import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';
import { createBatch } from '../factories';
import { InventoryService } from '../../src/consumer/inventory/services/inventory.service';
import { ExportService } from '../../src/consumer/export/services/export.service';
import * as ExcelJS from 'exceljs';

describe('inventory value at batch cost', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  beforeAll(async () => {
    boot = await bootDomain();
  });
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  beforeEach(async () => {
    w = await newWorld(db, boot, { branches: 3 });
  });
  afterEach(() => w.check());

  it('[BE-INV-VAL-001] {InventoryService.getInventorySummary} totals include reserved physical stock, reconcile by branch and exclude other shops', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 3, cost: 10.25 }],
    });
    await createBatch(db, w.tenant, {
      variant_id: variant.id,
      branch_id: w.tenant.branches[1].id,
      quantity: 4,
      cost_price: 20,
    });
    await w.sell([{ variant, qty: 1 }], { is_delivery_later: true }, 0);
    const service = boot.get(InventoryService);
    const all: any = await service.getInventorySummary(w.tenant.consumer.id);
    expect(all).toMatchObject({
      total_inventory_value: 110.75,
      physical_quantity: 7,
      reserved_quantity: 1,
      total_quantity: 6,
    });
    expect(
      all.branch_values.map(
        (b: { inventory_value: number }) => b.inventory_value,
      ),
    ).toEqual([30.75, 80, 0]);
    expect(
      all.branch_values.reduce(
        (sum: number, b: { inventory_value: number }) =>
          sum + b.inventory_value,
        0,
      ),
    ).toBe(all.total_inventory_value);
    const branch: any = await service.getInventorySummary(
      w.tenant.consumer.id,
      w.tenant.branches[1].id,
    );
    expect(branch.total_inventory_value).toBe(80);
    expect(branch.branch_values).toHaveLength(1);
    const foreign: any = await service.getInventorySummary(
      w.tenant.consumer.id,
      w.bystander.branches[0].id,
    );
    expect(foreign.total_inventory_value).toBe(0);
    expect(foreign.branch_values).toEqual([]);
  });

  it('[BE-INV-VAL-002] {ExportService.export} exported row values and branch summaries equal the inventory summary', async () => {
    const variant = await w.stock({
      price: 100,
      batches: [{ qty: 3, cost: 10.25 }],
    });
    await createBatch(db, w.tenant, {
      variant_id: variant.id,
      branch_id: w.tenant.branches[1].id,
      quantity: 4,
      cost_price: 20,
    });
    const file = await boot
      .get(ExportService)
      .export('inventory', w.tenant.consumer.id, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.getWorksheet('Inventory')!;
    expect(
      Number(sheet.getRow(2).getCell(8).value) +
        Number(sheet.getRow(3).getCell(8).value),
    ).toBe(110.75);
    const summary = workbook.getWorksheet('Inventory Value')!;
    expect(summary.getRow(2).getCell(2).value).toBe(110.75);
    expect(summary.getRow(3).getCell(2).value).toBe(30.75);
    expect(summary.getRow(4).getCell(2).value).toBe(80);
  });
});
