import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';
import { assertSaleLineMatchesCatalog } from '../../utils/sale-pricing.util';

jest.mock('../../utils/sale-pricing.util', () => ({
  assertSaleLineMatchesCatalog: jest.fn(),
}));

beforeEach(() => (assertSaleLineMatchesCatalog as jest.Mock).mockReset());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const batch = (
  id: number,
  quantity: number,
  reserved = 0,
  at = '2026-01-01',
) => ({
  id,
  quantity,
  reserved_quantity: reserved,
  created_at: new Date(at),
});

const item = (extra: object = {}): any => ({
  variant_id: 20,
  quantity: 2,
  unit_price: 10,
  line_total: 18,
  average_discount_amount: 1,
  special_discount_amount: 1,
  tax_amount: 2,
  ...extra,
});

const dto = (extra: object = {}): any => ({
  branch_id: 2,
  items: [item()],
  shipping_cost: 3,
  payments: [{ payment_method: 'CASH', amount: 21 }],
  ...extra,
});

function arrange(batches: any[] = [batch(30, 10)]) {
  jest.useFakeTimers().setSystemTime(new Date(2026, 4, 5, 10));
  const ctx = setupSales();
  ctx.prisma.branch.findFirst.mockResolvedValue({ id: 2 });
  ctx.prisma.customer.findFirst.mockResolvedValue({ id: 4 });
  ctx.prisma.user.findFirst.mockResolvedValue({ id: 3 });
  ctx.prisma.productVariant.findFirst.mockResolvedValue({
    id: 20,
    inventory_items: batches,
    product: { tax: 0, tax_method: 'EXCLUSIVE' },
  });
  ctx.prisma.sale.findFirst.mockResolvedValue(null);
  ctx.tx.sale.findFirst.mockResolvedValue(null);
  ctx.tx.sale.create.mockResolvedValue({
    id: 99,
    customer_id: null,
    payment_status: 'paid',
    sale_type: 'sale',
    total_amount: 21,
  });
  ctx.tx.sale.updateMany.mockResolvedValue({ count: 1 });
  ctx.tx.saleItem.create.mockResolvedValue({ id: 500 });
  ctx.tx.$queryRaw.mockResolvedValue([{ quantity: 8, reserved_quantity: 0 }]);
  jest
    .spyOn(ctx.service, 'findOne')
    .mockResolvedValue({ id: 99, loaded: 'sale' } as any);
  jest
    .spyOn(ctx.service, 'findOneQuotation')
    .mockResolvedValue({ id: 99, loaded: 'quotation' } as any);
  jest
    .spyOn(ctx.service as any, 'assertItemPromotionDiscounts')
    .mockResolvedValue(undefined);
  return ctx;
}

describe('SalesService.create validation (unit)', () => {
  it('[BE-MUT-850] a sale needs at least one item', async () => {
    const { service } = arrange();
    for (const items of [undefined, []]) {
      await expect(service.create(dto({ items }), 5, 8)).rejects.toThrow(
        new BadRequestException('A sale must contain at least one item'),
      );
    }
  });

  it('[BE-MUT-851] a quotation being converted must exist for this shop and not be converted already', async () => {
    const { prisma, service } = arrange();
    await expect(
      service.create(dto({ quotation_id: 6 }), 5, 8),
    ).rejects.toThrow(new NotFoundException('Quotation not found'));
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: { id: 6, consumer_id: 5, sale_type: 'quotation' },
    });
    prisma.sale.findFirst.mockResolvedValue({ converted_to_sale_id: 12 });
    await expect(
      service.create(dto({ quotation_id: 6 }), 5, 8),
    ).rejects.toThrow('Quotation has already been converted to sale #12');
  });

  it('[BE-MUT-852] CREDIT payments need a customer and a valid points balance, checked per payment', async () => {
    const { rewards, service } = arrange();
    const credit = dto({
      payments: [
        { payment_method: 'CREDIT', amount: 10 },
        { payment_method: 'CASH', amount: 11 },
      ],
    });
    await expect(service.create(credit, 5, 8)).rejects.toThrow(
      'CREDIT payments require a customer account',
    );
    rewards.validateCreditPayment.mockResolvedValue({
      isValid: false,
      reason: 'Insufficient points',
    });
    await expect(
      service.create({ ...credit, customer_id: 4 }, 5, 8),
    ).rejects.toThrow('Credit payment validation failed: Insufficient points');
    expect(rewards.validateCreditPayment).toHaveBeenCalledWith(5, 4, 10);
    rewards.validateCreditPayment.mockResolvedValue({ isValid: true });
    await expect(
      service.create({ ...credit, customer_id: 4 }, 5, 8),
    ).resolves.toBeDefined();
    expect(rewards.validateCreditPayment).toHaveBeenCalledTimes(2);
  });

  it('[BE-MUT-853] the branch, customer and served-by user must belong to the shop', async () => {
    const { prisma, service } = arrange();
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(service.create(dto(), 5, 8)).rejects.toThrow(
      'Branch not found or not accessible',
    );
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 2, consumer_id: 5 },
    });
    prisma.branch.findFirst.mockResolvedValue({ id: 2 });
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(service.create(dto({ customer_id: 4 }), 5, 8)).rejects.toThrow(
      'Customer not found or not accessible',
    );
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 4, consumer_id: 5 },
    });
    prisma.customer.findFirst.mockResolvedValue({ id: 4 });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.create(dto({ served_by_id: 3 }), 5, 8),
    ).rejects.toThrow('Served by user not found or not accessible');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 3, consumer_id: 5 },
    });
    prisma.customer.findFirst.mockClear();
    await service.create(dto(), 5, 8);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('[BE-MUT-854] each item must be a variant of this shop whose price matches the catalog, wholesale when the sale is wholesale', async () => {
    const { prisma, service } = arrange();
    await service.create(dto({ price_type: 'wholesale' }), 5, 8);
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 20, product: { consumer_id: 5 } },
      include: {
        inventory_items: { where: { branch_id: 2 } },
        product: { select: { tax: true, tax_method: true } },
      },
    });
    expect((assertSaleLineMatchesCatalog as jest.Mock).mock.calls[0][2]).toBe(
      true,
    );
    await service.create(dto(), 5, 8);
    expect((assertSaleLineMatchesCatalog as jest.Mock).mock.calls[1][2]).toBe(
      false,
    );
    prisma.productVariant.findFirst.mockResolvedValue(null);
    await expect(service.create(dto(), 5, 8)).rejects.toThrow(
      'Product variant 20 not found',
    );
  });

  it('[BE-MUT-855] stock: a named batch must belong to the variant and hold enough; otherwise the oldest batch with stock is used (FIFO)', async () => {
    const named = arrange([batch(30, 3, 2), batch(31, 10)]);
    await expect(
      named.service.create(dto({ items: [item({ batch_id: 99 })] }), 5, 8),
    ).rejects.toThrow('Batch 99 not found for variant 20');
    await expect(
      named.service.create(dto({ items: [item({ batch_id: 30 })] }), 5, 8),
    ).rejects.toThrow(
      'Insufficient stock for variant 20. Available: 1, Requested: 2',
    );
    await named.service.create(dto({ items: [item({ batch_id: 31 })] }), 5, 8);
    expect(named.tx.saleItem.create.mock.calls[0][0].data.batch_id).toBe(31);
    const fifo = arrange([
      batch(31, 10, 0, '2026-03-01'),
      batch(30, 10, 0, '2026-01-01'),
      batch(29, 5, 5, '2025-01-01'),
    ]);
    await fifo.service.create(dto(), 5, 8);
    expect(fifo.tx.saleItem.create.mock.calls[0][0].data.batch_id).toBe(30);
    const none = arrange([batch(29, 5, 5)]);
    await expect(none.service.create(dto(), 5, 8)).rejects.toThrow(
      'Insufficient stock for variant 20. Available: 0, Requested: 2',
    );
    const exact = arrange([batch(29, 3, 1)]);
    await expect(exact.service.create(dto(), 5, 8)).resolves.toBeDefined();
    const tooFew = arrange([batch(29, 2, 1)]);
    await expect(tooFew.service.create(dto(), 5, 8)).rejects.toThrow(
      'Insufficient stock for variant 20. Available: 1, Requested: 2',
    );
  });
});

describe('SalesService.create totals and promotions (unit)', () => {
  it('[BE-MUT-856] subtotal, discounts, tax and shipping combine into a cent-rounded total stored with the sale', async () => {
    const { tx, service } = arrange();
    await service.create(
      dto({
        customer_id: 4,
        served_by_id: 3,
        customer_name: 'Ann',
        customer_phone: '1',
        customer_email: 'a@x.io',
        notes: 'n',
        price_type: 'wholesale',
      }),
      5,
      8,
    );
    expect(tx.sale.create).toHaveBeenCalledWith({
      data: {
        sale_number: 'SAL-20260505-0001',
        consumer_id: 5,
        customer_id: 4,
        customer_name: 'Ann',
        customer_phone: '1',
        customer_email: 'a@x.io',
        promotion_id: null,
        branch_id: 2,
        user_id: 8,
        served_by_id: 3,
        sale_type: 'sale',
        price_type: 'wholesale',
        subtotal: 18,
        discount_amount: 2,
        promotion_discount: 0,
        shipping_cost: 3,
        tax_amount: 2,
        total_amount: 21,
        payment_status: 'paid',
        received_amount: 21,
        notes: 'n',
        is_online_order: false,
        online_order_status: null,
        is_delivery_later: false,
        delivery_status: null,
      },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('[BE-MUT-857] payment status: nothing paid is due, less than the total is partial, the full total is paid', async () => {
    for (const [payments, status, received] of [
      [undefined, 'due', 0],
      [[], 'due', 0],
      [[{ payment_method: 'CASH', amount: 5 }], 'partial', 5],
      [
        [
          { payment_method: 'CASH', amount: 10 },
          { payment_method: 'CARD', amount: 11 },
        ],
        'paid',
        21,
      ],
      [[{ payment_method: 'CASH', amount: 25 }], 'paid', 25],
    ] as const) {
      const { tx, service } = arrange();
      await service.create(dto({ payments }), 5, 8);
      expect(tx.sale.create.mock.calls[0][0].data).toMatchObject({
        payment_status: status,
        received_amount: received,
      });
    }
  });

  it('[BE-MUT-858] defaults: shipping 0, regular price type, sale type, shipping given as text counts as a number', async () => {
    const { tx, service } = arrange();
    await service.create(dto({ shipping_cost: undefined, payments: [] }), 5, 8);
    expect(tx.sale.create.mock.calls[0][0].data).toMatchObject({
      shipping_cost: 0,
      price_type: 'regular',
      sale_type: 'sale',
      total_amount: 18,
      served_by_id: null,
    });
    await service.create(dto({ shipping_cost: '4.5', payments: [] }), 5, 8);
    expect(tx.sale.create.mock.calls[1][0].data.total_amount).toBe(22.5);
  });

  it('[BE-MUT-859] item promotion discounts are checked first and reduce the total; the sale-level promotion is evaluated on the cart and closed afterwards', async () => {
    const ctx = arrange();
    ctx.promotions.assertAndCalculateDiscount.mockResolvedValue({
      discount_amount: 4,
    });
    const withPromotion = dto({
      applied_promotion_id: 7,
      customer_id: 4,
      items: [
        item({
          promotion_discount_amount: 3,
          line_total: 15,
          applied_promotion_id: 7,
        }),
      ],
      payments: [],
    });
    await ctx.service.create(withPromotion, 5, 8);
    expect(
      (ctx.service as any).assertItemPromotionDiscounts,
    ).toHaveBeenCalledWith(withPromotion, 5);
    expect(ctx.promotions.assertAndCalculateDiscount).toHaveBeenCalledWith(
      7,
      5,
      2,
      4,
      [{ variant_id: 20, quantity: 2, unit_price: 10, line_total: 15 }],
    );
    expect(ctx.tx.sale.create.mock.calls[0][0].data).toMatchObject({
      promotion_id: 7,
      promotion_discount: 3,
      discount_amount: 5,
      subtotal: 18,
    });
    expect(ctx.promotions.closePromotionIfExhausted).toHaveBeenCalledWith(7, 5);
    const evaluated = arrange();
    evaluated.promotions.assertAndCalculateDiscount.mockResolvedValue({
      discount_amount: '4',
    });
    await evaluated.service.create(
      dto({ applied_promotion_id: 7, payments: [] }),
      5,
      8,
    );
    expect(evaluated.tx.sale.create.mock.calls[0][0].data).toMatchObject({
      promotion_discount: 4,
      discount_amount: 6,
    });
    const itemOnly = arrange();
    await itemOnly.service.create(
      dto({
        items: [item({ promotion_discount_amount: 2, line_total: 16 })],
        payments: [],
      }),
      5,
      8,
    );
    expect(itemOnly.tx.sale.create.mock.calls[0][0].data).toMatchObject({
      promotion_id: null,
      promotion_discount: 2,
    });
    expect(
      itemOnly.promotions.assertAndCalculateDiscount,
    ).not.toHaveBeenCalled();
    expect(
      itemOnly.promotions.closePromotionIfExhausted,
    ).not.toHaveBeenCalled();
  });
});

describe('SalesService.create writes (unit)', () => {
  it('[BE-MUT-860] the sale item, payments and SALE_OUT audit row are written; stock is taken from the chosen batch', async () => {
    const { tx, service } = arrange();
    const body = dto({
      payments: [
        {
          payment_method: 'CASH',
          payment_type: 'cash',
          amount: 21,
          reference: 'R',
        },
      ],
      items: [
        item({
          sold_unit_price: 9,
          promotion_discount_amount: 0,
          applied_promotion_id: 0,
        }),
      ],
    });
    await expect(service.create(body, 5, 8)).resolves.toEqual({
      id: 99,
      loaded: 'sale',
    });
    expect(tx.salePayment.create).toHaveBeenCalledWith({
      data: {
        sale_id: 99,
        payment_method: 'CASH',
        payment_type: 'cash',
        amount: 21,
        reference: 'R',
      },
    });
    expect(tx.saleItem.create).toHaveBeenCalledWith({
      data: {
        sale_id: 99,
        variant_id: 20,
        batch_id: 30,
        quantity: 2,
        unit_price: 10,
        sold_unit_price: 9,
        average_discount_amount: 1,
        special_discount_amount: 1,
        promotion_discount_amount: 0,
        applied_promotion_id: null,
        tax_amount: 2,
        line_total: 18,
      },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.inventoryAuditLog.create).toHaveBeenCalledWith({
      data: {
        consumer_id: 5,
        branch_id: 2,
        variant_id: 20,
        batch_id: 30,
        inventoryBatchId: 30,
        event_type: 'SALE_OUT',
        quantity_delta: -2,
        quantity_after: 8,
        reference_id: 500,
        reference_type: 'sale_items',
        notes: 'Sale #SAL-20260505-0001 - Qty: 2',
        created_by_user_id: 8,
      },
    });
    expect((service as any).findOne).toHaveBeenCalledWith(99, 5);
  });

  it('[BE-MUT-861] optional line amounts default to zero or null', async () => {
    const { tx, service } = arrange();
    await service.create(
      dto({
        items: [
          { variant_id: 20, quantity: 1, unit_price: 10, line_total: 10 },
        ],
        payments: [],
      }),
      5,
      8,
    );
    expect(tx.saleItem.create.mock.calls[0][0].data).toMatchObject({
      sold_unit_price: null,
      average_discount_amount: 0,
      special_discount_amount: 0,
      promotion_discount_amount: 0,
      applied_promotion_id: null,
      tax_amount: 0,
    });
  });

  it('[BE-MUT-862] a delivery-later sale reserves stock without an audit row and starts as a pending delivery; an online order records its status', async () => {
    const later = arrange();
    await later.service.create(dto({ is_delivery_later: true }), 5, 8);
    expect(later.tx.sale.create.mock.calls[0][0].data).toMatchObject({
      is_delivery_later: true,
      delivery_status: 'PENDING',
    });
    expect(later.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(later.tx.inventoryAuditLog.create).not.toHaveBeenCalled();
    const online = arrange();
    await online.service.create(dto({ is_online_order: true }), 5, 8);
    expect(online.tx.sale.create.mock.calls[0][0].data).toMatchObject({
      is_online_order: true,
      online_order_status: 'PENDING',
    });
    await online.service.create(
      dto({ is_online_order: true, online_order_status: 'READY' }),
      5,
      8,
    );
    expect(
      online.tx.sale.create.mock.calls[1][0].data.online_order_status,
    ).toBe('READY');
  });

  it('[BE-MUT-863] a quotation skips stock checks and stock movement, gets a QUO number and is returned as a quotation', async () => {
    const { prisma, tx, service } = arrange([]);
    const result = await service.create(
      dto({ sale_type: 'quotation', payments: [] }),
      5,
      8,
    );
    expect(result).toEqual({ id: 99, loaded: 'quotation' });
    expect(tx.sale.create.mock.calls[0][0].data).toMatchObject({
      sale_number: 'QUO-20260505-0001',
      sale_type: 'quotation',
    });
    expect(tx.saleItem.create.mock.calls[0][0].data.batch_id).toBeNull();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.inventoryAuditLog.create).not.toHaveBeenCalled();
    expect(prisma.productVariant.findFirst).toHaveBeenCalledTimes(1);
  });

  it('[BE-MUT-864] converting a quotation marks it converted exactly once', async () => {
    const { prisma, tx, service } = arrange();
    prisma.sale.findFirst.mockResolvedValue({
      id: 6,
      converted_to_sale_id: null,
    });
    await service.create(dto({ quotation_id: 6 }), 5, 8);
    expect(tx.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 6, converted_to_sale_id: null },
      data: {
        converted_to_sale_id: 99,
        converted_at: new Date(2026, 4, 5, 10),
      },
    });
    tx.sale.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.create(dto({ quotation_id: 6 }), 5, 8),
    ).rejects.toThrow('Quotation has already been converted to a sale');
  });

  it('[BE-MUT-865] CREDIT payments are redeemed inside the same transaction for each credit payment', async () => {
    const { tx, rewards, service } = arrange();
    rewards.validateCreditPayment.mockResolvedValue({ isValid: true });
    await service.create(
      dto({
        customer_id: 4,
        payments: [
          { payment_method: 'CREDIT', amount: 10, reference: 'CR' },
          { payment_method: 'CASH', amount: 11 },
        ],
      }),
      5,
      8,
    );
    expect(rewards.processCreditPayment).toHaveBeenCalledTimes(1);
    expect(rewards.processCreditPayment).toHaveBeenCalledWith(
      5,
      4,
      10,
      99,
      'CR',
      tx,
    );
  });

  it('[BE-MUT-866] stock that changed during the sale aborts it with a retry message', async () => {
    const { tx, service } = arrange();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.create(dto(), 5, 8)).rejects.toThrow(
      'Insufficient stock for variant 20. Stock changed while the sale was being saved; please try again.',
    );
  });
});

describe('SalesService.create rewards and errors (unit)', () => {
  const paidSale = (extra: object = {}) => ({
    id: 99,
    customer_id: 4,
    payment_status: 'paid',
    sale_type: 'sale',
    total_amount: '21',
    ...extra,
  });

  it('[BE-MUT-867] a paid sale of a registered customer earns points on the amount paid with money, not with points', async () => {
    const { tx, rewards, service } = arrange();
    tx.sale.create.mockResolvedValue(paidSale({ total_amount: '30' }));
    rewards.validateCreditPayment.mockResolvedValue({ isValid: true });
    await service.create(
      dto({
        customer_id: 4,
        payments: [
          { payment_method: 'CREDIT', amount: 10 },
          { payment_method: 'CASH', amount: 20 },
        ],
      }),
      5,
      8,
    );
    expect(rewards.earnPoints).toHaveBeenCalledWith(5, 4, 99, 20);
    const full = arrange();
    full.tx.sale.create.mockResolvedValue(paidSale());
    await full.service.create(dto({ customer_id: 4 }), 5, 8);
    expect(full.rewards.earnPoints).toHaveBeenCalledWith(5, 4, 99, 21);
  });

  it('[BE-MUT-868] no points for guest, unpaid or quotation sales, or when points paid for everything', async () => {
    const cases: Array<[object, object]> = [
      [{ customer_id: null }, {}],
      [{ payment_status: 'partial' }, {}],
      [{ sale_type: 'quotation' }, { sale_type: 'quotation' }],
      [
        { total_amount: '10' },
        {
          payments: [{ payment_method: 'CREDIT', amount: 10 }],
          customer_id: 4,
        },
      ],
    ];
    for (const [saleRow, body] of cases) {
      const { tx, rewards, service } = arrange();
      tx.sale.create.mockResolvedValue(paidSale(saleRow));
      rewards.validateCreditPayment.mockResolvedValue({ isValid: true });
      await service.create(dto(body), 5, 8);
      expect(rewards.earnPoints).not.toHaveBeenCalled();
    }
  });

  it('[BE-MUT-869] a points failure is logged but never fails the sale', async () => {
    const { tx, rewards, service } = arrange();
    const err = jest.spyOn(console, 'error').mockImplementation();
    tx.sale.create.mockResolvedValue(paidSale());
    rewards.earnPoints.mockRejectedValue(new Error('rewards down'));
    await expect(
      service.create(dto({ customer_id: 4 }), 5, 8),
    ).resolves.toBeDefined();
    expect(err).toHaveBeenCalledWith(
      'Failed to award rewards points:',
      expect.any(Error),
    );
  });

  it('[BE-MUT-870] unexpected failures are logged with the user and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.$transaction.mockRejectedValue(f);
        return ctx.service.create(dto(), 5, 8);
      },
      message: 'Failed to create sale',
      logged: ['Error creating sale for consumer 5 and user 8'],
    });
  });
});
