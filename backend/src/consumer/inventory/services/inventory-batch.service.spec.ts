import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { InventoryBatchService } from './inventory-batch.service';

const batchInclude = {
  variant: { include: { product: { select: { id: true, name: true } } } },
  branch: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true } },
};
const detailInclude = {
  ...batchInclude,
  purchasePayments: { orderBy: { created_at: 'desc' } },
};

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const tx: any = {
    productVariant: mk('update'),
    priceHistory: mk('create'),
    inventoryBatch: mk('create'),
    inventoryAuditLog: mk('create'),
    purchasePayment: mk('create'),
  };
  const prisma: any = {
    productVariant: mk('findFirst', 'findUniqueOrThrow', 'update'),
    branch: mk('findFirst'),
    vendor: mk('findFirst'),
    inventoryBatch: mk('findFirst', 'findMany', 'count', 'update', 'delete'),
    priceHistory: mk('create'),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
  return { prisma, tx, service: new InventoryBatchService(prisma) };
}

const Decimal = (v: string) => new Prisma.Decimal(v);

describe('InventoryBatchService.create (unit)', () => {
  const dto = (extra: object = {}) =>
    ({
      variant_id: 11,
      branch_id: 3,
      batch_number: 'BN-1',
      quantity: 4,
      cost_price: '25',
      vendor_id: 9,
      ...extra,
    }) as any;

  const arrange = () => {
    const ctx = setup();
    ctx.prisma.productVariant.findFirst.mockResolvedValue({
      id: 11,
      regular_price: Decimal('100'),
      wholesale_price: Decimal('80'),
    });
    ctx.prisma.branch.findFirst.mockResolvedValue({ id: 3 });
    ctx.prisma.vendor.findFirst.mockResolvedValue({ id: 9 });
    ctx.prisma.inventoryBatch.findFirst.mockResolvedValue(null);
    ctx.tx.inventoryBatch.create.mockResolvedValue({ id: 70, quantity: 4 });
    return ctx;
  };

  it('[BE-MUT-460] the variant, branch and vendor are verified for this tenant before anything is written', async () => {
    const { prisma, tx, service } = arrange();
    await expect(service.create(5, 8, dto())).resolves.toEqual({
      id: 70,
      quantity: 4,
    });
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 11, product: { consumer_id: 5 } },
    });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 3, consumer_id: 5 },
    });
    expect(prisma.vendor.findFirst).toHaveBeenCalledWith({
      where: { id: 9, consumer_id: 5 },
      select: { id: true },
    });
    expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
      where: { batch_number: 'BN-1', variant_id: 11 },
    });
    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-461] a foreign variant, branch or vendor is a 404 and no batch is created', async () => {
    const variant = arrange();
    variant.prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(variant.service.create(5, 8, dto())).rejects.toThrow(
      new NotFoundException('Product variant not found'),
    );
    const branch = arrange();
    branch.prisma.branch.findFirst.mockResolvedValue(null);
    await expect(branch.service.create(5, 8, dto())).rejects.toThrow(
      new NotFoundException('Branch not found'),
    );
    const vendor = arrange();
    vendor.prisma.vendor.findFirst.mockResolvedValue(null);
    await expect(vendor.service.create(5, 8, dto())).rejects.toThrow(
      new NotFoundException('Vendor not found'),
    );
    for (const ctx of [variant, branch, vendor]) {
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-462] without a branch or vendor those checks are skipped; invalid purchases are rejected first', async () => {
    const ctx = arrange();
    await ctx.service.create(
      5,
      8,
      dto({ branch_id: undefined, vendor_id: null }),
    );
    expect(ctx.prisma.branch.findFirst).not.toHaveBeenCalled();
    expect(ctx.prisma.vendor.findFirst).not.toHaveBeenCalled();
    const bad = arrange();
    await expect(
      bad.service.create(5, 8, dto({ quantity: 0 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bad.prisma.productVariant.findFirst).not.toHaveBeenCalled();
  });

  it('[BE-MUT-463] a duplicate batch number is a 400 whose text says whether the expiry date matches', async () => {
    const same = arrange();
    same.prisma.inventoryBatch.findFirst.mockResolvedValue({
      expiry_date: new Date('2027-01-01T05:00:00Z'),
    });
    await expect(
      same.service.create(5, 8, dto({ expiry_date: '2027-01-01' })),
    ).rejects.toThrow(
      'Batch number "BN-1" already exists for this variant with the same expiry date.',
    );
    const differs = arrange();
    differs.prisma.inventoryBatch.findFirst.mockResolvedValue({
      expiry_date: new Date('2027-01-01T00:00:00Z'),
    });
    await expect(
      differs.service.create(5, 8, dto({ expiry_date: '2027-02-01' })),
    ).rejects.toThrow(
      'Batch number "BN-1" already exists for this variant, but the expiry date does not match the existing record.',
    );
    const noExpiry = arrange();
    noExpiry.prisma.inventoryBatch.findFirst.mockResolvedValue({
      expiry_date: null,
    });
    await expect(noExpiry.service.create(5, 8, dto())).rejects.toThrow(
      'with the same expiry date.',
    );
    const addedExpiry = arrange();
    addedExpiry.prisma.inventoryBatch.findFirst.mockResolvedValue({
      expiry_date: null,
    });
    await expect(
      addedExpiry.service.create(5, 8, dto({ expiry_date: '2027-01-01' })),
    ).rejects.toThrow('does not match');
    expect(same.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[BE-MUT-464] a batch with no payments is fully paid, stores the trimmed location and expiry, and is written with its relations', async () => {
    const { tx, service } = arrange();
    await service.create(
      5,
      8,
      dto({ location: '  A-3 ', expiry_date: '2027-01-01' }),
    );
    expect(tx.inventoryBatch.create).toHaveBeenCalledWith({
      data: {
        variant_id: 11,
        branch_id: 3,
        batch_number: 'BN-1',
        quantity: 4,
        cost_price: '25',
        vendor_id: 9,
        location: 'A-3',
        expiry_date: new Date('2027-01-01'),
        payment_status: 'paid',
        paid_amount: 100,
      },
      include: batchInclude,
    });
    await service.create(5, 8, dto({ location: '  ' }));
    expect(tx.inventoryBatch.create.mock.calls[1][0].data).toMatchObject({
      location: null,
      expiry_date: null,
    });
    await service.create(5, 8, dto());
    expect(tx.inventoryBatch.create.mock.calls[2][0].data.location).toBeNull();
  });

  it('[BE-MUT-465] payments decide the status: paid in full, partial, and each payment is recorded', async () => {
    const full = arrange();
    await full.service.create(
      5,
      8,
      dto({
        payments: [
          { payment_method: 'cash', amount: 60, payment_type: 'cash' },
          { payment_method: 'card', amount: 40, reference: 'R1' },
        ],
      }),
    );
    expect(full.tx.inventoryBatch.create.mock.calls[0][0].data).toMatchObject({
      payment_status: 'paid',
      paid_amount: 100,
    });
    expect(
      full.tx.purchasePayment.create.mock.calls.map(([a]: any) => a),
    ).toEqual([
      {
        data: {
          batch_id: 70,
          payment_method: 'cash',
          payment_type: 'cash',
          amount: 60,
          reference: null,
        },
      },
      {
        data: {
          batch_id: 70,
          payment_method: 'card',
          payment_type: null,
          amount: 40,
          reference: 'R1',
        },
      },
    ]);
    const part = arrange();
    await part.service.create(
      5,
      8,
      dto({ payments: [{ payment_method: 'cash', amount: 30 }] }),
    );
    expect(part.tx.inventoryBatch.create.mock.calls[0][0].data).toMatchObject({
      payment_status: 'partial',
      paid_amount: 30,
    });
  });

  it('[BE-MUT-466] the audit entry records the purchase with its quantity and author', async () => {
    const { tx, service } = arrange();
    await service.create(5, 8, dto());
    expect(tx.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        branch_id: 3,
        variant_id: 11,
        batch_id: 70,
        inventoryBatchId: 70,
        event_type: 'PURCHASE_IN',
        quantity_delta: 4,
        quantity_after: 4,
        reference_id: 70,
        reference_type: 'inventory_batches',
        notes: 'Purchase batch BN-1 - Qty: 4',
        created_by_user_id: 8,
      },
    });
    expect(tx.purchasePayment.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-467] supplying prices updates the variant and appends price history only when a price really changed', async () => {
    const unchanged = arrange();
    await unchanged.service.create(
      5,
      8,
      dto({ regular_price: '100.00', wholesale_price: '80.00' }),
    );
    expect(unchanged.tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { regular_price: '100.00', wholesale_price: '80.00' },
    });
    expect(unchanged.tx.priceHistory.create).not.toHaveBeenCalled();
    const regular = arrange();
    await regular.service.create(5, 8, dto({ regular_price: '120' }));
    expect(regular.tx.priceHistory.create).toHaveBeenCalledWith({
      data: { variant_id: 11, regular_price: '120', wholesale_price: '80' },
    });
    const wholesale = arrange();
    await wholesale.service.create(5, 8, dto({ wholesale_price: '70' }));
    expect(wholesale.tx.priceHistory.create).toHaveBeenCalledWith({
      data: { variant_id: 11, regular_price: '100', wholesale_price: '70' },
    });
  });

  it('[BE-MUT-468] unexpected failures are logged with the consumer and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.$transaction.mockRejectedValue(f);
        return ctx.service.create(5, 8, dto());
      },
      message: 'Failed to create inventory batch',
      logged: ['Error creating inventory batch for consumer 5'],
    });
  });
});

describe('InventoryBatchService reads (unit)', () => {
  it('[BE-MUT-469] findAll is tenant scoped and unpaginated by default, newest first with relations and payments', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.inventoryBatch.count.mockResolvedValue(1);
    await expect(service.findAll(5)).resolves.toEqual({
      data: [{ id: 1 }],
      meta: { total: 1, page: 1, limit: 1, totalPages: 1 },
    });
    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith({
      where: { variant: { product: { consumer_id: 5 } } },
      include: detailInclude,
      skip: undefined,
      take: undefined,
      orderBy: { created_at: 'desc' },
    });
    expect(prisma.inventoryBatch.count).toHaveBeenCalledWith({
      where: { variant: { product: { consumer_id: 5 } } },
    });
  });

  it('[BE-MUT-470] pagination skips earlier pages and reports the page count', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.findMany.mockResolvedValue([]);
    prisma.inventoryBatch.count.mockResolvedValue(45);
    await expect(
      service.findAll(5, { page: 3, limit: 20 }),
    ).resolves.toMatchObject({
      meta: { total: 45, page: 3, limit: 20, totalPages: 3 },
    });
    expect(prisma.inventoryBatch.findMany.mock.calls[0][0]).toMatchObject({
      skip: 40,
      take: 20,
    });
  });

  it('[BE-MUT-471] every filter is added to the query: category, search across four fields, branch and variant', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.findMany.mockResolvedValue([]);
    prisma.inventoryBatch.count.mockResolvedValue(0);
    await service.findAll(5, {
      category_id: 2,
      search: 'abc',
      branch_id: 3,
      variant_id: 4,
    });
    expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where).toEqual({
      variant: { product: { consumer_id: 5, category_id: 2 } },
      OR: [
        { batch_number: { contains: 'abc', mode: 'insensitive' } },
        { location: { contains: 'abc', mode: 'insensitive' } },
        { variant: { name: { contains: 'abc', mode: 'insensitive' } } },
        {
          variant: {
            product: { name: { contains: 'abc', mode: 'insensitive' } },
          },
        },
      ],
      branch_id: 3,
      variant_id: 4,
    });
  });

  it('[BE-MUT-472] findOne is tenant scoped, includes payments newest first, and a miss is a 404 naming the id', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.findFirst.mockResolvedValue({ id: 7 });
    await expect(service.findOne(7, 5)).resolves.toEqual({ id: 7 });
    expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
      where: { id: 7, variant: { product: { consumer_id: 5 } } },
      include: detailInclude,
    });
    prisma.inventoryBatch.findFirst.mockResolvedValue(null);
    await expect(service.findOne(7, 5)).rejects.toThrow(
      new NotFoundException('Inventory batch with ID 7 not found'),
    );
  });

  it('[BE-MUT-473] unexpected read failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.inventoryBatch.findMany.mockRejectedValue(f);
        prisma.inventoryBatch.count.mockResolvedValue(0);
        return service.findAll(5);
      },
      message: 'Failed to find inventory batches',
      logged: ['Error finding all inventory batches for 5'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.inventoryBatch.findFirst.mockRejectedValue(f);
        return service.findOne(7, 5);
      },
      message: 'Failed to find inventory batch',
      logged: ['Error finding inventory batch 7 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});

describe('InventoryBatchService update/remove (unit)', () => {
  const arrange = () => {
    const ctx = setup();
    ctx.prisma.inventoryBatch.findFirst.mockResolvedValue({
      id: 7,
      variant_id: 11,
      quantity: 0,
    });
    ctx.prisma.inventoryBatch.update.mockResolvedValue({ id: 7 });
    ctx.prisma.branch.findFirst.mockResolvedValue({ id: 3 });
    ctx.prisma.vendor.findFirst.mockResolvedValue({ id: 9 });
    ctx.prisma.productVariant.findUniqueOrThrow.mockResolvedValue({
      regular_price: Decimal('100'),
      wholesale_price: Decimal('80'),
    });
    return ctx;
  };

  it('[BE-MUT-474] update verifies branch and vendor ownership, writes the editable columns and trims the location', async () => {
    const { prisma, service } = arrange();
    await expect(
      service.update(7, 5, {
        cost_price: '30',
        branch_id: 3,
        vendor_id: 9,
        location: ' B-1 ',
        expiry_date: '2027-03-03',
      } as any),
    ).resolves.toEqual({ id: 7 });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 3, consumer_id: 5 },
      select: { id: true },
    });
    expect(prisma.inventoryBatch.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        cost_price: '30',
        branch_id: 3,
        vendor_id: 9,
        location: 'B-1',
        expiry_date: new Date('2027-03-03'),
      },
    });
    expect(prisma.productVariant.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('[BE-MUT-475] an omitted location is left alone, a blank one clears it; a foreign branch is a 404 before any write', async () => {
    const { prisma, service } = arrange();
    await service.update(7, 5, { cost_price: '30' });
    expect(
      prisma.inventoryBatch.update.mock.calls[0][0].data.location,
    ).toBeUndefined();
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    await service.update(7, 5, { location: '   ' });
    expect(
      prisma.inventoryBatch.update.mock.calls[1][0].data.location,
    ).toBeNull();
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(service.update(7, 5, { branch_id: 3 } as any)).rejects.toThrow(
      new NotFoundException('Branch not found'),
    );
    expect(prisma.inventoryBatch.update).toHaveBeenCalledTimes(2);
  });

  it('[BE-MUT-476] new prices update the variant and add history only when a price changed, keeping the other stored price', async () => {
    const same = arrange();
    await same.service.update(7, 5, {
      regular_price: '100.00',
      wholesale_price: '80.00',
    });
    expect(same.prisma.productVariant.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 11 },
      select: { regular_price: true, wholesale_price: true },
    });
    expect(same.prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { regular_price: '100.00', wholesale_price: '80.00' },
    });
    expect(same.prisma.priceHistory.create).not.toHaveBeenCalled();
    const regular = arrange();
    await regular.service.update(7, 5, { regular_price: '120' });
    expect(regular.prisma.priceHistory.create).toHaveBeenCalledWith({
      data: { variant_id: 11, regular_price: '120', wholesale_price: '80' },
    });
    const wholesale = arrange();
    await wholesale.service.update(7, 5, { wholesale_price: '70' });
    expect(wholesale.prisma.priceHistory.create).toHaveBeenCalledWith({
      data: { variant_id: 11, regular_price: '100', wholesale_price: '70' },
    });
  });

  it('[BE-MUT-477] remove deletes an empty batch; a batch that still has stock is refused with the reason', async () => {
    const { prisma, service } = arrange();
    await expect(service.remove(7, 5)).resolves.toEqual({
      success: true,
      message: 'Inventory batch deleted successfully',
    });
    expect(prisma.inventoryBatch.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
    prisma.inventoryBatch.findFirst.mockResolvedValue({ id: 7, quantity: 2 });
    prisma.inventoryBatch.delete.mockClear();
    await expect(service.remove(7, 5)).rejects.toThrow(
      'Cannot delete a batch that still has stock. Reduce it to 0 with an inventory adjustment first; batches with history are kept for the audit trail.',
    );
    expect(prisma.inventoryBatch.delete).not.toHaveBeenCalled();
  });

  it('[BE-MUT-478] unexpected update and delete failures are logged with ids and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.inventoryBatch.update.mockRejectedValue(f);
        return ctx.service.update(7, 5, { cost_price: '1' });
      },
      message: 'Failed to update inventory batch',
      logged: ['Error updating inventory batch 7 for consumer 5'],
      notFoundPassesThrough: true,
    });
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.inventoryBatch.delete.mockRejectedValue(f);
        return ctx.service.remove(7, 5);
      },
      message: 'Failed to delete inventory batch',
      logged: ['Error deleting inventory batch 7 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});
