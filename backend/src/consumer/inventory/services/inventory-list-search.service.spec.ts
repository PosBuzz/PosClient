import { InventoryAdjustmentService } from './inventory-adjustment.service';
import { InventoryTransferService } from './inventory-transfer.service';

const mk = (...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, jest.fn()]));

describe('Inventory list search (unit)', () => {
  it('[BE-INV-266] transfers: the branch filter and the search narrow the tenant scope and never replace it', async () => {
    const prisma: any = {
      inventoryTransfer: mk('findMany', 'count'),
    };
    prisma.inventoryTransfer.findMany.mockResolvedValue([]);
    prisma.inventoryTransfer.count.mockResolvedValue(0);
    const service = new InventoryTransferService(prisma, {} as any);

    await service.findAll(5, {
      branch_id: 7,
      search: ' Rice ',
      status: 'pending',
    });
    const where = prisma.inventoryTransfer.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('pending');
    expect(where.AND).toHaveLength(3);
    expect(where.AND[0]).toEqual({
      OR: [
        { source_branch: { consumer_id: 5 } },
        { destination_branch: { consumer_id: 5 } },
      ],
    });
    expect(where.AND[1]).toEqual({
      OR: [{ source_branch_id: 7 }, { destination_branch_id: 7 }],
    });
    const searchTerms = JSON.stringify(where.AND[2]);
    expect(searchTerms).toContain('"contains":"Rice"');
    expect(searchTerms).toContain('"mode":"insensitive"');
  });

  it('[BE-INV-267] transfers: no search and no branch leaves only the tenant scope; a numeric search also matches the transfer number', async () => {
    const prisma: any = { inventoryTransfer: mk('findMany', 'count') };
    prisma.inventoryTransfer.findMany.mockResolvedValue([]);
    prisma.inventoryTransfer.count.mockResolvedValue(0);
    const service = new InventoryTransferService(prisma, {} as any);
    await service.findAll(5, {});
    expect(
      prisma.inventoryTransfer.findMany.mock.calls[0][0].where.AND,
    ).toHaveLength(1);
    await service.findAll(5, { search: '42' });
    const search =
      prisma.inventoryTransfer.findMany.mock.calls[1][0].where.AND[1];
    expect(search.OR[0]).toEqual({ id: 42 });
  });

  it('[BE-INV-268] adjustments: search matches reason, notes, branch, user, batch, variant, SKU and product, inside the tenant scope', async () => {
    const prisma: any = { inventoryAdjustment: mk('findMany', 'count') };
    prisma.inventoryAdjustment.findMany.mockResolvedValue([]);
    prisma.inventoryAdjustment.count.mockResolvedValue(0);
    const service = new InventoryAdjustmentService(prisma);
    await service.findAll(5, { search: ' damaged ' });
    const where = prisma.inventoryAdjustment.findMany.mock.calls[0][0].where;
    expect(where.batch.variant.product.consumer_id).toBe(5);
    expect(where.OR).toHaveLength(8);
    expect(JSON.stringify(where.OR)).toContain('"contains":"damaged"');
    await service.findAll(5, {});
    expect(
      prisma.inventoryAdjustment.findMany.mock.calls[1][0].where.OR,
    ).toBeUndefined();
  });
});
