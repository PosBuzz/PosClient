import { NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';

afterEach(() => jest.restoreAllMocks());

const promoSelect = {
  id: true,
  name: true,
  scope: true,
  discount_type: true,
  discount_value: true,
};

describe('SalesService.findBySaleNumber (unit)', () => {
  const baseSale = (extra: object = {}): any => ({
    id: 1,
    sale_number: 'SAL-1',
    total_amount: '200',
    shipping_cost: '10',
    items: [
      { id: 10, quantity: 4, line_total: '100', applied_promotion_id: 7 },
      { id: 11, quantity: 1, line_total: '90', applied_promotion_id: null },
    ],
    ...extra,
  });
  const arrange = (sale: any = baseSale(), returns: any[] = []) => {
    const ctx = setupSales();
    ctx.prisma.sale.findFirst.mockResolvedValue(sale);
    ctx.prisma.returnItem.aggregate.mockImplementation(
      async ({ where }: any) => ({
        _sum: { quantity: where.sale_item_id === 10 ? 3 : null },
      }),
    );
    ctx.prisma.return.findMany.mockResolvedValue(returns);
    ctx.prisma.promotion.findMany.mockResolvedValue([{ id: 7, name: 'Promo' }]);
    return ctx;
  };

  it('[BE-MUT-760] a live sale is found by number for this shop with the pinned includes; a miss is a 404', async () => {
    const { prisma, service } = arrange();
    await service.findBySaleNumber('SAL-1', 5);
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: {
        sale_number: 'SAL-1',
        consumer_id: 5,
        sale_type: 'sale',
        deleted_at: null,
      },
      include: {
        customer: { include: { rewards_points: true } },
        branch: true,
        user: { select: { id: true, name: true } },
        served_by: { select: { id: true, name: true } },
        promotion: { select: promoSelect },
        payments: true,
        items: {
          include: {
            variant: { include: { product: true, sale_unit: true } },
            batch: true,
          },
        },
      },
    });
    const missing = arrange(null);
    await expect(missing.service.findBySaleNumber('X', 5)).rejects.toThrow(
      new NotFoundException('Sale not found with that sale number'),
    );
  });

  it('[BE-MUT-761] each item shows how many units can still be returned (never negative) and the applied promotion', async () => {
    const { prisma, service } = arrange();
    const result: any = await service.findBySaleNumber('SAL-1', 5);
    expect(result.items.map((i: any) => i.available_for_return)).toEqual([
      1, 1,
    ]);
    expect(prisma.returnItem.aggregate).toHaveBeenCalledWith({
      where: { sale_item_id: 10 },
      _sum: { quantity: true },
    });
    expect(result.items[0].applied_promotion).toEqual({ id: 7, name: 'Promo' });
    prisma.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 9 } });
    const over: any = await service.findBySaleNumber('SAL-1', 5);
    expect(over.items[0].available_for_return).toBe(0);
  });

  it('[BE-MUT-762] the return summary totals refunds and exchanges, what is still returnable and the shipping already refunded', async () => {
    const returns = [
      {
        id: 3,
        return_number: 'R-3',
        return_date: new Date('2026-05-01'),
        total_refund: '55',
        total_exchange: '5',
        reason: 'broken',
        items: [{ sale_item_id: 10, quantity: 2 }],
      },
      {
        id: 4,
        return_number: 'R-4',
        return_date: new Date('2026-05-02'),
        total_refund: '10',
        total_exchange: '0',
        reason: null,
        items: [
          { sale_item_id: 999, quantity: 1 },
          { sale_item_id: 11, quantity: 0 },
        ],
      },
    ];
    const { prisma, service } = arrange(baseSale(), returns);
    const result: any = await service.findBySaleNumber('SAL-1', 5);
    expect(prisma.return.findMany).toHaveBeenCalledWith({
      where: { original_sale_id: 1 },
      include: { payments: true, exchanges: true, items: true },
    });
    expect(result.return_summary).toEqual({
      total_returned: 2,
      total_refunded: 65,
      total_exchanged: 5,
      total_already_returned: 70,
      available_amount: 130,
      shipping_refunded: 20,
      available_shipping_refund: 0,
      returns: [
        {
          id: 3,
          return_number: 'R-3',
          return_date: new Date('2026-05-01'),
          total_refund: 55,
          total_exchange: 5,
          reason: 'broken',
        },
        {
          id: 4,
          return_number: 'R-4',
          return_date: new Date('2026-05-02'),
          total_refund: 10,
          total_exchange: 0,
          reason: null,
        },
      ],
    });
  });

  it('[BE-MUT-763] shipping is refundable until refunds beyond the item values eat into it; amounts never go below zero', async () => {
    const part = arrange(baseSale(), [
      {
        id: 3,
        return_number: 'R',
        return_date: new Date(),
        total_refund: '54',
        total_exchange: '0',
        reason: null,
        items: [{ sale_item_id: 10, quantity: 2 }],
      },
    ]);
    const r: any = await part.service.findBySaleNumber('SAL-1', 5);
    expect(r.return_summary).toMatchObject({
      shipping_refunded: 4,
      available_shipping_refund: 6,
      available_amount: 146,
    });
    const over = arrange(baseSale({ total_amount: '50' }), [
      {
        id: 3,
        return_number: 'R',
        return_date: new Date(),
        total_refund: '80',
        total_exchange: '0',
        reason: null,
        items: [],
      },
    ]);
    const o: any = await over.service.findBySaleNumber('SAL-1', 5);
    expect(o.return_summary.available_amount).toBe(0);
    const none: any = await arrange(
      baseSale({ shipping_cost: null }),
    ).service.findBySaleNumber('SAL-1', 5);
    expect(none.return_summary).toMatchObject({
      total_returned: 0,
      total_refunded: 0,
      available_amount: 200,
      shipping_refunded: 0,
      available_shipping_refund: 0,
    });
  });

  it('[BE-MUT-764] lookup failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.sale.findFirst.mockRejectedValue(f);
        return ctx.service.findBySaleNumber('SAL-1', 5);
      },
      message: 'Error fetching sale',
      logged: ['Error fetching sale by sale number SAL-1 for consumer 5'],
      notFoundPassesThrough: true,
    });
  });
});

describe('SalesService POS product lookups (unit)', () => {
  const variant = (extra: object = {}): any => ({
    id: 20,
    name: 'Small',
    sku: 'S',
    barcode: 'B',
    regular_price: 10,
    wholesale_price: 8,
    image: 'i.png',
    product: {
      id: 3,
      name: 'Shirt',
      code: 'SH',
      brand_id: 2,
      category_id: 4,
      category: { name: 'Tops' },
      tax: 5,
      tax_method: 'INCLUSIVE',
    },
    sale_unit: { name: 'Piece' },
    inventory_items: [
      { id: 1, location: 'A-1', quantity: 3, expiry_date: null },
      { id: 2, location: 'B-2', quantity: 2, expiry_date: null },
    ],
    ...extra,
  });

  it('[BE-MUT-765] the POS product list is stock-scoped to the branch, limited to 50, FIFO and shaped for the till', async () => {
    const { prisma, service } = setupSales();
    prisma.productVariant.findMany.mockResolvedValue([variant()]);
    const result = await service.getProductsForSale(5, 2);
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
      where: {
        product: { consumer_id: 5 },
        inventory_items: { some: { branch_id: 2, quantity: { gt: 0 } } },
      },
      include: {
        product: { include: { category: true } },
        sale_unit: true,
        inventory_items: {
          where: { branch_id: 2, quantity: { gt: 0 } },
          orderBy: { created_at: 'asc' },
        },
      },
      take: 50,
    });
    expect(result[0]).toMatchObject({
      id: 20,
      name: 'Small',
      sku: 'S',
      barcode: 'B',
      brand_id: 2,
      category_id: 4,
      category_name: 'Tops',
      regular_price: 10,
      wholesale_price: 8,
      image: 'i.png',
      product_name: 'Shirt',
      product_code: 'SH',
      unit_name: 'Piece',
      tax_percentage: 5,
      tax_method: 'INCLUSIVE',
    });
    expect(result[0].locations).toEqual(['A-1', 'B-2']);
  });

  it('[BE-MUT-766] search matches variant and product fields; missing tax data falls back to 0 and exclusive', async () => {
    const { prisma, service } = setupSales();
    prisma.productVariant.findMany.mockResolvedValue([
      variant({
        product: {
          id: 3,
          name: 'Shirt',
          code: null,
          brand_id: null,
          category_id: null,
          category: null,
          tax: null,
          tax_method: null,
        },
      }),
    ]);
    const result = await service.getProductsForSale(5, 2, 'abc');
    const contains = { contains: 'abc', mode: 'insensitive' };
    expect(prisma.productVariant.findMany.mock.calls[0][0].where.OR).toEqual([
      { name: contains },
      { sku: contains },
      { barcode: contains },
      { product: { name: contains } },
      { product: { code: contains } },
    ]);
    expect(result[0]).toMatchObject({
      tax_percentage: 0,
      tax_method: 'exclusive',
      category_name: undefined,
    });
    await service.getProductsForSale(5, 2);
    expect(
      prisma.productVariant.findMany.mock.calls[1][0].where.OR,
    ).toBeUndefined();
  });

  it('[BE-MUT-767] barcode lookup finds the in-stock variant of this branch or returns null', async () => {
    const { prisma, service } = setupSales();
    prisma.productVariant.findFirst.mockResolvedValue(variant());
    const result: any = await service.getProductByBarcode(5, 2, 'B');
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: {
        barcode: 'B',
        product: { consumer_id: 5 },
        inventory_items: { some: { branch_id: 2, quantity: { gt: 0 } } },
      },
      include: {
        product: true,
        sale_unit: true,
        inventory_items: {
          where: { branch_id: 2, quantity: { gt: 0 } },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    expect(result).toMatchObject({
      id: 20,
      brand_id: 2,
      product_name: 'Shirt',
      product_code: 'SH',
      unit_name: 'Piece',
      tax_percentage: 5,
      tax_method: 'INCLUSIVE',
      regular_price: 10,
      wholesale_price: 8,
      image: 'i.png',
    });
    prisma.productVariant.findFirst.mockResolvedValue(
      variant({
        product: {
          brand_id: null,
          name: 'Shirt',
          code: null,
          tax: null,
          tax_method: null,
        },
      }),
    );
    expect(await service.getProductByBarcode(5, 2, 'B')).toMatchObject({
      tax_percentage: 0,
      tax_method: 'exclusive',
    });
    prisma.productVariant.findFirst.mockResolvedValue(null);
    expect(await service.getProductByBarcode(5, 2, 'B')).toBeNull();
  });

  it('[BE-MUT-768] lookup failures are logged and hidden behind generic 500s', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setupSales();
        prisma.productVariant.findMany.mockRejectedValue(f);
        return service.getProductsForSale(5, 2);
      },
      message: 'Error fetching products',
      logged: ['Error fetching products for sale for consumer 5 and branch 2'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { prisma, service } = setupSales();
        prisma.productVariant.findFirst.mockRejectedValue(f);
        return service.getProductByBarcode(5, 2, 'B');
      },
      message: 'Error fetching product',
      logged: [
        'Error fetching product by barcode for consumer 5 and branch 2 and barcode B',
      ],
    });
  });
});
