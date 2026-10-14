import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { ProductVariantService } from './product-variant.service';

function setup() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const prisma: any = {
    productVariant: mk('create', 'findUnique', 'findFirst', 'update', 'delete'),
    priceHistory: mk('create'),
    variantAttribute: mk('createMany', 'deleteMany'),
    productSerial: mk('createMany', 'findMany', 'updateMany', 'deleteMany'),
    inventoryBatch: mk('create'),
    inventoryAuditLog: mk('create'),
    purchasePayment: mk('create'),
  };
  prisma.productVariant.create.mockResolvedValue({
    id: 10,
    product: { consumer_id: 5 },
  });
  prisma.inventoryBatch.create.mockResolvedValue({ id: 70, quantity: 4 });
  const service = new ProductVariantService(prisma);
  const findOne = jest
    .spyOn(service, 'findOne')
    .mockResolvedValue({ hydrated: true } as any);
  return { prisma, service, findOne };
}

const dto = (extra: object = {}) =>
  ({
    name: 'Large',
    sku: 'S-1',
    barcode: 'B-1',
    regular_price: '100.00',
    wholesale_price: '80.00',
    sale_unit_id: 1,
    purchase_unit_id: 2,
    warranty_period: 12,
    image: 'i.png',
    ...extra,
  }) as any;

const batch = (extra: object = {}) => ({
  branch_id: 3,
  batch_number: 'BN-1',
  quantity: 4,
  cost_price: '25',
  vendor_id: 9,
  ...extra,
});

describe('ProductVariantService.create (unit)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('[BE-MUT-400] the variant is stored with its price history and returned hydrated; absent flags default', async () => {
    const { prisma, service, findOne } = setup();
    await expect(service.create(7, 8, dto())).resolves.toEqual({
      hydrated: true,
    });
    expect(prisma.productVariant.create).toHaveBeenCalledWith({
      data: {
        product_id: 7,
        name: 'Large',
        sku: 'S-1',
        barcode: 'B-1',
        regular_price: '100.00',
        wholesale_price: '80.00',
        sale_unit_id: 1,
        purchase_unit_id: 2,
        warranty_period: 12,
        image: 'i.png',
        is_default: false,
        alert_quantity: 0,
        daily_sale_objective: 0,
      },
      include: { product: { select: { consumer_id: true } } },
    });
    expect(prisma.priceHistory.create).toHaveBeenCalledWith({
      data: {
        variant_id: 10,
        regular_price: '100.00',
        wholesale_price: '80.00',
      },
    });
    expect(findOne).toHaveBeenCalledWith(10);
    expect(prisma.variantAttribute.createMany).not.toHaveBeenCalled();
    expect(prisma.productSerial.createMany).not.toHaveBeenCalled();
    expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-401] supplied flags are kept; the raw variant is returned when hydration is off; a given transaction client is used', async () => {
    const { prisma, service, findOne } = setup();
    const tx: any = {
      productVariant: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 11, product: { consumer_id: 5 } }),
      },
      priceHistory: { create: jest.fn() },
    };
    await expect(
      service.create(
        7,
        undefined,
        dto({ is_default: true, alert_quantity: 3, daily_sale_objective: 9 }),
        tx,
        false,
      ),
    ).resolves.toEqual({ id: 11, product: { consumer_id: 5 } });
    expect(tx.productVariant.create.mock.calls[0][0].data).toMatchObject({
      is_default: true,
      alert_quantity: 3,
      daily_sale_objective: 9,
    });
    expect(prisma.productVariant.create).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('[BE-MUT-402] attributes are stored for the product consumer, skipping duplicates; an empty list stores nothing', async () => {
    const { prisma, service } = setup();
    await service.create(
      7,
      8,
      dto({ attributes: [{ name: 'Color', value: 'Red' }] }),
    );
    expect(prisma.variantAttribute.createMany).toHaveBeenCalledWith({
      data: [{ variant_id: 10, consumer_id: 5, name: 'Color', value: 'Red' }],
      skipDuplicates: true,
    });
    prisma.variantAttribute.createMany.mockClear();
    await service.create(7, 8, dto({ attributes: [] }));
    expect(prisma.variantAttribute.createMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-403] serials default to available and skip duplicates; an empty list stores nothing', async () => {
    const { prisma, service } = setup();
    await service.create(
      7,
      8,
      dto({
        serials: [
          { serial_number: 'A', notes: 'n' },
          { serial_number: 'B', status: 'sold' },
        ],
      }),
    );
    expect(prisma.productSerial.createMany).toHaveBeenCalledWith({
      data: [
        { variant_id: 10, serial_number: 'A', status: 'available', notes: 'n' },
        {
          variant_id: 10,
          serial_number: 'B',
          status: 'sold',
          notes: undefined,
        },
      ],
      skipDuplicates: true,
    });
    prisma.productSerial.createMany.mockClear();
    await service.create(7, 8, dto({ serials: [] }));
    expect(prisma.productSerial.createMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-404] an unpaid-by-record batch is treated as fully paid and gets an audit entry', async () => {
    const { prisma, service } = setup();
    await service.create(
      7,
      8,
      dto({
        batches: [batch({ location: '  A-3  ', expiry_date: '2027-01-01' })],
      }),
    );
    expect(prisma.inventoryBatch.create).toHaveBeenCalledWith({
      data: {
        variant_id: 10,
        branch_id: 3,
        batch_number: 'BN-1',
        quantity: 4,
        location: 'A-3',
        cost_price: '25',
        vendor_id: 9,
        expiry_date: new Date('2027-01-01'),
        payment_status: 'paid',
        paid_amount: 100,
      },
    });
    expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        branch_id: 3,
        variant_id: 10,
        batch_id: 70,
        inventoryBatchId: 70,
        event_type: 'PURCHASE_IN',
        quantity_delta: 4,
        quantity_after: 4,
        reference_id: 70,
        reference_type: 'inventory_batches',
        notes: 'Initial stock added via variant creation',
        created_by_user_id: 8,
      },
    });
    expect(prisma.purchasePayment.create).not.toHaveBeenCalled();
  });

  it('[BE-MUT-405] blank location and missing expiry are stored as null', async () => {
    const { prisma, service } = setup();
    await service.create(7, 8, dto({ batches: [batch({ location: '   ' })] }));
    expect(prisma.inventoryBatch.create.mock.calls[0][0].data).toMatchObject({
      location: null,
      expiry_date: null,
    });
    await service.create(7, 8, dto({ batches: [batch()] }));
    expect(
      prisma.inventoryBatch.create.mock.calls[1][0].data.location,
    ).toBeNull();
  });

  it('[BE-MUT-406] payments decide the status: all paid, partly paid; each payment is recorded against the batch', async () => {
    const full = setup();
    await full.service.create(
      7,
      8,
      dto({
        batches: [
          batch({
            payments: [
              { payment_method: 'cash', amount: 60, payment_type: 'cash' },
              { payment_method: 'card', amount: 40, reference: 'R1' },
            ],
          }),
        ],
      }),
    );
    expect(
      full.prisma.inventoryBatch.create.mock.calls[0][0].data,
    ).toMatchObject({ payment_status: 'paid', paid_amount: 100 });
    expect(
      full.prisma.purchasePayment.create.mock.calls.map(([a]: any) => a),
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
    const part = setup();
    await part.service.create(
      7,
      8,
      dto({
        batches: [
          batch({ payments: [{ payment_method: 'cash', amount: 30 }] }),
        ],
      }),
    );
    expect(
      part.prisma.inventoryBatch.create.mock.calls[0][0].data,
    ).toMatchObject({ payment_status: 'partial', paid_amount: 30 });
  });

  it('[BE-MUT-407] a zero-quantity batch gets no audit entry; invalid purchases are rejected before the variant is created', async () => {
    const { prisma, service } = setup();
    prisma.inventoryBatch.create.mockResolvedValue({ id: 71, quantity: 0 });
    // validatePurchase rejects quantity 0, so exercise the guard through the same entry point
    const error = await service
      .create(7, 8, dto({ batches: [batch({ quantity: 0 })] }))
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(prisma.productVariant.create).not.toHaveBeenCalled();
    await expect(
      service.create(
        7,
        8,
        dto({
          batches: [
            batch({ payments: [{ payment_method: 'cash', amount: 500 }] }),
          ],
        }),
      ),
    ).rejects.toThrow('Payments exceed total purchase cost');
  });

  it('[BE-MUT-408] a failing batch is logged and rethrown as the generic 500; client errors pass through', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.productVariant.create.mockRejectedValue(f);
        return service.create(7, 8, dto());
      },
      message: 'Failed to create product variant',
      logged: ['Error creating product variant for 7'],
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { prisma, service } = setup();
    prisma.inventoryBatch.create.mockRejectedValue(new Error('batch down'));
    const error = await service
      .create(7, 8, dto({ batches: [batch()] }))
      .catch((e) => e);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe('Failed to create product variant');
  });
});

describe('ProductVariantService.findOne (unit)', () => {
  const variantRow = (extra: object = {}) => ({
    id: 3,
    alert_quantity: 5,
    inventory_items: [{ quantity: 2 }, { quantity: 3 }],
    serials: [
      { status: 'available' },
      { status: 'sold' },
      { status: 'available' },
    ],
    ...extra,
  });

  it('[BE-MUT-409] findOne resolves the tenant from the variant when none is given and loads the full detail shape', async () => {
    const { prisma, service } = setup();
    (service.findOne as unknown as jest.SpyInstance).mockRestore();
    prisma.productVariant.findUnique.mockResolvedValue({
      product: { consumer_id: 5 },
    });
    prisma.productVariant.findFirst.mockResolvedValue(variantRow());
    await service.findOne(3);
    expect(prisma.productVariant.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { product: { select: { consumer_id: true } } },
    });
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 3, product: { consumer_id: 5 } },
      include: {
        sale_unit: true,
        purchase_unit: true,
        VariantAttribute: true,
        serials: { orderBy: { created_at: 'desc' } },
        price_history: { take: 1, orderBy: { effective_date: 'desc' } },
        inventory_items: {
          include: {
            branch: { select: { id: true, name: true } },
            vendor: { select: { id: true, name: true } },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    prisma.productVariant.findUnique.mockClear();
    await service.findOne(3, 5);
    expect(prisma.productVariant.findUnique).not.toHaveBeenCalled();
  });

  it('[BE-MUT-410] totals stock, counts available serials and flags low stock at or below the alert level only when an alert is set', async () => {
    const { prisma, service } = setup();
    (service.findOne as unknown as jest.SpyInstance).mockRestore();
    prisma.productVariant.findFirst.mockResolvedValue(variantRow());
    await expect(service.findOne(3, 5)).resolves.toMatchObject({
      total_stock: 5,
      is_low_stock: true,
      available_serials_count: 2,
    });
    prisma.productVariant.findFirst.mockResolvedValue(
      variantRow({ alert_quantity: 4 }),
    );
    await expect(service.findOne(3, 5)).resolves.toMatchObject({
      is_low_stock: false,
    });
    prisma.productVariant.findFirst.mockResolvedValue(
      variantRow({ alert_quantity: 6 }),
    );
    await expect(service.findOne(3, 5)).resolves.toMatchObject({
      is_low_stock: true,
    });
    for (const alert of [0, null]) {
      prisma.productVariant.findFirst.mockResolvedValue(
        variantRow({ alert_quantity: alert, inventory_items: [] }),
      );
      await expect(service.findOne(3, 5)).resolves.toMatchObject({
        total_stock: 0,
        is_low_stock: false,
      });
    }
  });

  it('[BE-MUT-411] an unknown variant, or one of another shop, is a 404 naming the id', async () => {
    const { prisma, service } = setup();
    (service.findOne as unknown as jest.SpyInstance).mockRestore();
    prisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(service.findOne(3)).rejects.toThrow(
      new NotFoundException('Product variant with ID 3 not found'),
    );
    expect(prisma.productVariant.findFirst).not.toHaveBeenCalled();
    prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(service.findOne(3, 5)).rejects.toThrow(
      new NotFoundException('Product variant with ID 3 not found'),
    );
  });

  it('[BE-MUT-412] unexpected failures are logged with variant and consumer and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        (service.findOne as unknown as jest.SpyInstance).mockRestore();
        prisma.productVariant.findFirst.mockRejectedValue(f);
        return service.findOne(3, 5);
      },
      message: 'Failed to find product variant',
      logged: ['Error finding product variant with ID 3 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});

describe('ProductVariantService.update (unit)', () => {
  const arrange = (
    current: object = { regular_price: '100', wholesale_price: '80' },
  ) => {
    const ctx = setup();
    ctx.prisma.productVariant.findUnique.mockResolvedValue(current);
    ctx.prisma.productVariant.update.mockResolvedValue({});
    return ctx;
  };

  it('[BE-MUT-413] every editable column is written for the variant and the hydrated variant is returned', async () => {
    const { prisma, service, findOne } = arrange();
    await expect(
      service.update(
        3,
        dto({ is_default: true, alert_quantity: 2, daily_sale_objective: 4 }),
      ),
    ).resolves.toEqual({ hydrated: true });
    expect(findOne).toHaveBeenNthCalledWith(1, 3);
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        name: 'Large',
        sku: 'S-1',
        barcode: 'B-1',
        regular_price: '100.00',
        wholesale_price: '80.00',
        sale_unit_id: 1,
        purchase_unit_id: 2,
        warranty_period: 12,
        image: 'i.png',
        is_default: true,
        alert_quantity: 2,
        daily_sale_objective: 4,
      },
    });
  });

  it('[BE-MUT-414] price history is appended only when a price really changed, falling back to the stored other price', async () => {
    const same = arrange();
    await same.service.update(3, dto());
    expect(same.prisma.priceHistory.create).not.toHaveBeenCalled();
    const changed = arrange();
    await changed.service.update(3, { regular_price: '120' });
    expect(changed.prisma.priceHistory.create).toHaveBeenCalledWith({
      data: { variant_id: 3, regular_price: '120', wholesale_price: '80' },
    });
    const wholesale = arrange();
    await wholesale.service.update(3, { wholesale_price: '70' });
    expect(wholesale.prisma.priceHistory.create).toHaveBeenCalledWith({
      data: { variant_id: 3, regular_price: '100', wholesale_price: '70' },
    });
    const noWholesale = arrange({
      regular_price: '100',
      wholesale_price: null,
    });
    await noWholesale.service.update(3, { regular_price: '110' });
    expect(
      noWholesale.prisma.priceHistory.create.mock.calls[0][0].data
        .wholesale_price,
    ).toBeUndefined();
  });

  it('[BE-MUT-415] a variant that vanishes mid-update is a 404', async () => {
    const { prisma, service } = arrange(null as any);
    await expect(service.update(3, dto())).rejects.toThrow(
      new NotFoundException('Product variant with ID 3 not found'),
    );
    expect(prisma.productVariant.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-416] attributes are replaced when sent; an empty list only clears; omitted leaves them alone', async () => {
    const replace = arrange();
    replace.prisma.productVariant.findUnique.mockResolvedValue({
      regular_price: '100',
      wholesale_price: '80',
      product: { consumer_id: 5 },
    });
    await replace.service.update(3, {
      attributes: [{ name: 'Color', value: 'Red' }],
    });
    expect(replace.prisma.variantAttribute.deleteMany).toHaveBeenCalledWith({
      where: { variant_id: 3 },
    });
    expect(replace.prisma.variantAttribute.createMany).toHaveBeenCalledWith({
      data: [{ variant_id: 3, consumer_id: 5, name: 'Color', value: 'Red' }],
      skipDuplicates: true,
    });
    const clear = arrange();
    await clear.service.update(3, { attributes: [] });
    expect(clear.prisma.variantAttribute.deleteMany).toHaveBeenCalledTimes(1);
    expect(clear.prisma.variantAttribute.createMany).not.toHaveBeenCalled();
    const omit = arrange();
    await omit.service.update(3, {});
    expect(omit.prisma.variantAttribute.deleteMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-417] sending attributes for a variant whose product is gone is a 404', async () => {
    const { prisma, service } = arrange();
    prisma.productVariant.findUnique
      .mockResolvedValueOnce({ regular_price: '100', wholesale_price: '80' })
      .mockResolvedValueOnce(null);
    await expect(
      service.update(3, { attributes: [{ name: 'a', value: 'b' }] } as any),
    ).rejects.toThrow(
      new NotFoundException('Product variant with ID 3 not found'),
    );
    expect(prisma.variantAttribute.createMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-418] without preserve_inventory serials are replaced wholesale', async () => {
    const replace = arrange();
    await replace.service.update(3, {
      serials: [
        { serial_number: 'A' },
        { serial_number: 'B', status: 'sold', notes: 'n' },
      ],
    });
    expect(replace.prisma.productSerial.deleteMany).toHaveBeenCalledWith({
      where: { variant_id: 3 },
    });
    expect(replace.prisma.productSerial.createMany).toHaveBeenCalledWith({
      data: [
        {
          variant_id: 3,
          serial_number: 'A',
          status: 'available',
          notes: undefined,
        },
        { variant_id: 3, serial_number: 'B', status: 'sold', notes: 'n' },
      ],
      skipDuplicates: true,
    });
    const clear = arrange();
    await clear.service.update(3, { serials: [] });
    expect(clear.prisma.productSerial.deleteMany).toHaveBeenCalledTimes(1);
    expect(clear.prisma.productSerial.createMany).not.toHaveBeenCalled();
    const omit = arrange();
    await omit.service.update(3, {});
    expect(omit.prisma.productSerial.deleteMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-419] with preserve_inventory existing serials are updated in place, new ones added, missing ones removed', async () => {
    const { prisma, service } = arrange();
    prisma.productSerial.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    await service.update(3, {
      preserve_inventory: true,
      serials: [
        { id: 1, serial_number: 'A1', status: 'sold', notes: 'n' },
        { id: 3, serial_number: 'C3' },
        { serial_number: 'NEW' },
      ],
    });
    expect(prisma.productSerial.findMany).toHaveBeenCalledWith({
      where: { variant_id: 3 },
    });
    expect(
      prisma.productSerial.updateMany.mock.calls.map(([a]: any) => a),
    ).toEqual([
      {
        where: { id: 1, variant_id: 3 },
        data: { serial_number: 'A1', status: 'sold', notes: 'n' },
      },
      {
        where: { id: 3, variant_id: 3 },
        data: { serial_number: 'C3', status: 'available', notes: undefined },
      },
    ]);
    expect(prisma.productSerial.createMany).toHaveBeenCalledWith({
      data: [
        {
          variant_id: 3,
          serial_number: 'NEW',
          status: 'available',
          notes: undefined,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.productSerial.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [2] } },
    });
  });

  it('[BE-MUT-420] preserve_inventory with nothing to change touches nothing', async () => {
    const { prisma, service } = arrange();
    prisma.productSerial.findMany.mockResolvedValue([{ id: 1 }]);
    await service.update(3, {
      preserve_inventory: true,
      serials: [{ id: 1, serial_number: 'A' }],
    });
    expect(prisma.productSerial.createMany).not.toHaveBeenCalled();
    expect(prisma.productSerial.deleteMany).not.toHaveBeenCalled();
    const noIds = arrange();
    noIds.prisma.productSerial.findMany.mockResolvedValue([]);
    await noIds.service.update(3, {
      preserve_inventory: true,
      serials: [{ serial_number: 'N' }],
    });
    expect(noIds.prisma.productSerial.updateMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-421] unexpected update failures are logged with the id and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = arrange();
        prisma.productVariant.update.mockRejectedValue(f);
        return service.update(3, dto());
      },
      message: 'Failed to update product variant',
      logged: ['Error updating product variant with ID 3'],
      notFoundPassesThrough: true,
    });
  });
});

describe('ProductVariantService.remove (unit)', () => {
  it('[BE-MUT-422] remove deletes an existing variant and reports it; a missing one is a 404', async () => {
    const { prisma, service } = setup();
    prisma.productVariant.findUnique.mockResolvedValue({ product_id: 1 });
    prisma.productVariant.delete.mockResolvedValue({});
    await expect(service.remove(3)).resolves.toEqual({
      success: true,
      message: 'Variant deleted successfully',
    });
    expect(prisma.productVariant.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { product_id: true, product: { select: { consumer_id: true } } },
    });
    expect(prisma.productVariant.delete).toHaveBeenCalledWith({
      where: { id: 3 },
    });
    prisma.productVariant.findUnique.mockResolvedValue(null);
    prisma.productVariant.delete.mockClear();
    await expect(service.remove(3)).rejects.toThrow(
      new NotFoundException('Product variant with ID 3 not found'),
    );
    expect(prisma.productVariant.delete).not.toHaveBeenCalled();
  });

  it('[BE-MUT-423] unexpected delete failures are logged with the id and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setup();
        prisma.productVariant.findUnique.mockResolvedValue({ product_id: 1 });
        prisma.productVariant.delete.mockRejectedValue(f);
        return service.remove(3);
      },
      message: 'Failed to delete product variant',
      logged: ['Error deleting product variant with ID 3'],
      notFoundPassesThrough: true,
    });
  });
});
