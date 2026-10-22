import { BadRequestException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../../test/helpers/error-wrapping';
import { setupSales } from '../../../../../test/helpers/sales-service-setup';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SalesService.getSalesStats (unit)', () => {
  const arrange = () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 6, 10)); // Wednesday
    const ctx = setupSales();
    ctx.prisma.sale.aggregate
      .mockResolvedValueOnce({ _count: 2, _sum: { total_amount: '100' } })
      .mockResolvedValueOnce({ _count: 5, _sum: { total_amount: '400.5' } })
      .mockResolvedValueOnce({ _count: 9, _sum: { total_amount: '900' } });
    ctx.prisma.saleItem.groupBy.mockResolvedValue([
      { variant_id: 20, _sum: { quantity: 7, line_total: '70' } },
      { variant_id: 21, _sum: { quantity: null, line_total: null } },
    ]);
    ctx.prisma.productVariant.findUnique.mockImplementation(
      async ({ where }: any) =>
        where.id === 20 ? { name: 'Small', product: { name: 'Shirt' } } : null,
    );
    ctx.prisma.return.aggregate
      .mockResolvedValueOnce({ _sum: { total_refund: '10' } })
      .mockResolvedValueOnce({ _sum: { total_refund: '25' } })
      .mockResolvedValueOnce({ _sum: { total_refund: null } });
    return ctx;
  };

  it('[BE-MUT-820] today, week (from Sunday) and month are counted from live non-cancelled sales, with refunds netted per period', async () => {
    const { prisma, service } = arrange();
    const result = await service.getSalesStats(5, 9);
    const base = {
      consumer_id: 5,
      sale_type: 'sale',
      payment_status: { not: 'cancelled' },
      deleted_at: null,
      branch_id: 9,
    };
    const today = new Date(2026, 4, 6);
    const week = new Date(2026, 4, 3);
    const month = new Date(2026, 4, 1);
    for (const [index, from] of [today, week, month].entries()) {
      expect(prisma.sale.aggregate.mock.calls[index][0]).toEqual({
        where: { ...base, sale_date: { gte: from } },
        _count: true,
        _sum: { total_amount: true },
      });
    }
    expect(prisma.return.aggregate.mock.calls.map(([a]: any) => a)).toEqual(
      [today, week, month].map((from) => ({
        where: { consumer_id: 5, branch_id: 9, return_date: { gte: from } },
        _sum: { total_refund: true },
      })),
    );
    expect(result).toMatchObject({
      today_sales: 2,
      today_amount: 100,
      today_refund: 10,
      today_net_amount: 90,
      week_sales: 5,
      week_amount: 400.5,
      week_refund: 25,
      week_net_amount: 375.5,
      month_sales: 9,
      month_amount: 900,
      month_refund: 0,
      month_net_amount: 900,
    });
  });

  it('[BE-MUT-821] the top ten products of the month come with names, unknown ones labelled and missing sums as zero', async () => {
    const { prisma, service } = arrange();
    const result = await service.getSalesStats(5);
    expect(prisma.saleItem.groupBy).toHaveBeenCalledWith({
      by: ['variant_id'],
      where: {
        sale: {
          consumer_id: 5,
          sale_type: 'sale',
          payment_status: { not: 'cancelled' },
          deleted_at: null,
          sale_date: { gte: new Date(2026, 4, 1) },
        },
      },
      _sum: { quantity: true, line_total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });
    expect(prisma.productVariant.findUnique).toHaveBeenCalledWith({
      where: { id: 20 },
      include: { product: true },
    });
    expect(result.top_products).toEqual([
      {
        variant_id: 20,
        variant_name: 'Small',
        product_name: 'Shirt',
        total_quantity: 7,
        total_amount: '70',
      },
      {
        variant_id: 21,
        variant_name: 'Unknown',
        product_name: 'Unknown',
        total_quantity: 0,
        total_amount: 0,
      },
    ]);
    expect('branch_id' in prisma.sale.aggregate.mock.calls[0][0].where).toBe(
      false,
    );
    expect('branch_id' in prisma.return.aggregate.mock.calls[0][0].where).toBe(
      false,
    );
  });

  it('[BE-MUT-822] zero counts when nothing was sold; failures are hidden behind a generic 500', async () => {
    const { prisma, service } = arrange();
    prisma.sale.aggregate.mockReset();
    prisma.sale.aggregate.mockResolvedValue({ _count: 0, _sum: {} });
    prisma.return.aggregate.mockReset();
    prisma.return.aggregate.mockResolvedValue({ _sum: {} });
    prisma.saleItem.groupBy.mockResolvedValue([]);
    await expect(service.getSalesStats(5)).resolves.toMatchObject({
      today_sales: 0,
      today_amount: 0,
      week_amount: 0,
      month_net_amount: 0,
      top_products: [],
    });
    await expectGenericWrapping({
      run: (f) => {
        const ctx = arrange();
        ctx.prisma.sale.aggregate.mockReset();
        ctx.prisma.sale.aggregate.mockRejectedValue(f);
        return ctx.service.getSalesStats(5, 9);
      },
      message: 'Error fetching sales stats',
      logged: ['Error fetching sales stats for consumer 5 and branch 9'],
    });
  });
});

describe('SalesService.getEODReport (unit)', () => {
  const local = (h: number, m = 0) => new Date(2026, 4, 5, h, m);
  const variantOf = (name: string, sku: string | null, product: string) => ({
    name,
    sku,
    product: { name: product },
  });
  const payment = (
    id: number,
    method: string,
    amount: number,
    saleId: number,
    created = local(11),
  ) => ({
    id,
    payment_method: method,
    amount,
    sale_id: saleId,
    created_at: created,
  });
  const world = () => {
    jest.useFakeTimers().setSystemTime(local(18));
    const ctx = setupSales();
    const s1: any = {
      id: 1,
      sale_number: 'S1',
      sale_date: local(10, 15),
      total_amount: '100',
      subtotal: '90',
      discount_amount: '5',
      tax_amount: '10',
      shipping_cost: '5',
      payment_status: 'paid',
      items: [
        {
          variant_id: 20,
          quantity: 2,
          line_total: '60',
          variant: variantOf('Small', 'S', 'Shirt'),
        },
        {
          variant_id: 21,
          quantity: 1,
          line_total: '40',
          variant: variantOf('Big', null, 'Pants'),
        },
      ],
      payments: [
        payment(1, 'CASH', 60, 1),
        payment(2, 'CARD', 40, 1),
        payment(6, 'CARD', 999, 1, new Date(2026, 4, 4, 11)),
      ],
    };
    const s2: any = {
      id: 2,
      sale_number: 'S2',
      sale_date: local(15),
      total_amount: '50',
      subtotal: '50',
      payment_status: 'due',
      items: [
        {
          variant_id: 20,
          quantity: 1,
          line_total: '50',
          variant: variantOf('Small', 'S', 'Shirt'),
        },
      ],
      payments: [],
    };
    const s3: any = {
      id: 3,
      sale_number: 'S3',
      sale_date: local(15, 30),
      total_amount: '80',
      subtotal: '80',
      payment_status: 'partial',
      items: [
        {
          variant_id: 22,
          quantity: 4,
          line_total: '80',
          variant: variantOf('Hat', 'H', 'Hats'),
        },
      ],
      payments: [payment(3, 'CREDIT', 20, 3)],
    };
    ctx.prisma.sale.findMany.mockResolvedValue([s1, s2, s3]);
    ctx.prisma.salePayment.findMany.mockResolvedValue([
      { ...payment(1, 'CASH', 60, 1), sale: { id: 1 } },
      { ...payment(4, 'CASH', 30, 99), sale: { id: 99 } },
      { ...payment(5, 'EXCHANGE', 15, 3), sale: { id: 3 } },
    ]);
    ctx.prisma.return.findMany.mockResolvedValue([
      {
        total_refund: '25',
        total_exchange: '10',
        exchange_sale_id: 2,
        payments: [{ payment_method: 'CASH', amount: 25 }],
        items: [
          {
            variant_id: 20,
            quantity: 1,
            sale_item: { id: 10, quantity: 2, line_total: '60' },
            variant: variantOf('Small', 'S', 'Shirt'),
          },
        ],
      },
      {
        total_refund: '5',
        total_exchange: '7',
        exchange_sale_id: null,
        payments: [{ payment_method: 'CARD', amount: 5 }],
        items: [
          {
            variant_id: 23,
            quantity: 2,
            sale_item: { id: 11, quantity: 4, line_total: '100' },
            variant: variantOf('Cap', null, 'Caps'),
          },
        ],
      },
    ]);
    ctx.prisma.operationalCost.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Rent',
        amount: '40',
        incurred_on: new Date('2026-05-05T12:00:00Z'),
        branch: { name: 'Main' },
      },
      {
        id: 2,
        name: 'Tea',
        amount: '10',
        incurred_on: new Date('2026-05-05T12:00:00Z'),
        branch: null,
      },
    ]);
    ctx.prisma.branch.findUnique.mockResolvedValue({ name: 'Main' });
    return ctx;
  };

  it('[BE-MUT-823] the daily report summarises invoiced sales, collections, dues, refunds, costs and the nets', async () => {
    const { service } = world();
    const report = await service.getEODReport(5, { date: '2026-05-05' });
    expect(report.summary).toEqual({
      total_sales: 3,
      total_amount: 230,
      gross_subtotal: 220,
      total_discount: 5,
      total_tax: 10,
      total_shipping: 5,
      total_transactions: 3,
      total_collected: 165,
      real_money_collected: 130,
      period_sales_collected: 135,
      due_collected: 30,
      total_due: 110,
      due_sales_count: 2,
      cash_sales: 90,
      digital_sales: 40,
      reward_point_sales: 20,
      exchange_sales: 15,
      delivery_partner_collected: 0,
      total_exchange_return: 17,
      unique_exchanges: 22,
      non_cash_sales: 140,
      average_transaction_value: 230 / 3,
      total_items_sold: 8,
      unique_products_sold: 3,
      operational_costs: 50,
      total_returns: 2,
      total_refund: 30,
      total_items_returned: 3,
      net_sale_amount: 200,
      cash_refunds: 25,
      digital_refunds: 5,
      net_cash_sales: 65,
      net_money_collected: 100,
      net_operating_result: 150,
      net_operating_cash_flow: 50,
    });
    expect(report).toMatchObject({
      date: '2026-05-05',
      period: 'day',
      period_start: '2026-05-05',
      period_end: '2026-05-05',
    });
    expect(report.branch_name).toBeUndefined();
  });

  it('[BE-MUT-824] payments are deduplicated by id across both sources, grouped by method in first-seen order, and refunds by refund method', async () => {
    const { service } = world();
    const report = await service.getEODReport(5, { date: '2026-05-05' });
    expect(report.payment_method_breakdown).toEqual([
      { payment_method: 'CASH', total_amount: 90, transaction_count: 2 },
      { payment_method: 'EXCHANGE', total_amount: 15, transaction_count: 1 },
      { payment_method: 'CARD', total_amount: 40, transaction_count: 1 },
      { payment_method: 'CREDIT', total_amount: 20, transaction_count: 1 },
    ]);
    expect(report.return_payment_breakdown).toEqual([
      { payment_method: 'CASH', total_amount: 25, transaction_count: 1 },
      { payment_method: 'CARD', total_amount: 5, transaction_count: 1 },
    ]);
  });

  it('[BE-MUT-825] product rows are ranked by revenue, include returns of products not sold today, and net out refunds', async () => {
    const { service } = world();
    const report = await service.getEODReport(5, { date: '2026-05-05' });
    expect(report.product_sales).toEqual([
      {
        variant_id: 20,
        variant_name: 'Small',
        product_name: 'Shirt',
        sku: 'S',
        quantity_sold: 3,
        total_amount: 110,
        average_unit_price: 110 / 3,
        quantity_returned: 1,
        refund_amount: 30,
        net_amount: 80,
      },
      {
        variant_id: 22,
        variant_name: 'Hat',
        product_name: 'Hats',
        sku: 'H',
        quantity_sold: 4,
        total_amount: 80,
        average_unit_price: 20,
        quantity_returned: 0,
        refund_amount: 0,
        net_amount: 80,
      },
      {
        variant_id: 21,
        variant_name: 'Big',
        product_name: 'Pants',
        sku: undefined,
        quantity_sold: 1,
        total_amount: 40,
        average_unit_price: 40,
        quantity_returned: 0,
        refund_amount: 0,
        net_amount: 40,
      },
      {
        variant_id: 23,
        variant_name: 'Cap',
        product_name: 'Caps',
        sku: undefined,
        quantity_sold: 0,
        total_amount: 0,
        average_unit_price: 25,
        quantity_returned: 2,
        refund_amount: 50,
        net_amount: -50,
      },
    ]);
  });

  it('[BE-MUT-826] hourly sales cover all 24 hours, payment statuses are grouped, and costs are listed with their branch', async () => {
    const { service } = world();
    const report = await service.getEODReport(5, { date: '2026-05-05' });
    expect(report.hourly_sales).toHaveLength(24);
    expect(report.hourly_sales.map((h) => h.hour)).toEqual([
      ...Array(24).keys(),
    ]);
    expect(report.hourly_sales[10]).toEqual({
      hour: 10,
      sales_count: 1,
      total_amount: 100,
    });
    expect(report.hourly_sales[15]).toEqual({
      hour: 15,
      sales_count: 2,
      total_amount: 130,
    });
    expect(report.hourly_sales[0]).toEqual({
      hour: 0,
      sales_count: 0,
      total_amount: 0,
    });
    expect(report.payment_status_breakdown).toEqual([
      { status: 'paid', count: 1, total_amount: 100 },
      { status: 'due', count: 1, total_amount: 50 },
      { status: 'partial', count: 1, total_amount: 80 },
    ]);
    expect(report.operational_costs).toEqual([
      {
        id: 1,
        name: 'Rent',
        amount: 40,
        incurred_on: '2026-05-05',
        branch_name: 'Main',
      },
      {
        id: 2,
        name: 'Tea',
        amount: 10,
        incurred_on: '2026-05-05',
        branch_name: undefined,
      },
    ]);
  });

  it('[BE-MUT-827] the queries are scoped to the shop, the period and the branch, and the branch name is resolved', async () => {
    const { prisma, service } = world();
    const report = await service.getEODReport(5, {
      date: '2026-05-05',
      branch_id: 2,
    });
    const start = new Date(2026, 4, 5, 0, 0, 0, 0);
    const end = new Date(2026, 4, 5, 23, 59, 59, 999);
    expect(report.branch_name).toBe('Main');
    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { name: true },
    });
    expect(prisma.sale.findMany).toHaveBeenCalledWith({
      where: {
        sale_type: 'sale',
        consumer_id: 5,
        deleted_at: null,
        sale_date: { gte: start, lte: end },
        branch_id: 2,
      },
      include: {
        payments: true,
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    expect(prisma.return.findMany).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        return_date: { gte: start, lte: end },
        branch_id: 2,
      },
      include: {
        payments: true,
        items: {
          include: {
            sale_item: {
              select: { id: true, quantity: true, line_total: true },
            },
            variant: { include: { product: { select: { name: true } } } },
          },
        },
      },
    });
    expect(prisma.operationalCost.findMany).toHaveBeenCalledWith({
      where: {
        consumer_id: 5,
        incurred_on: { gte: start, lte: end },
        branch_id: 2,
      },
      include: { branch: { select: { name: true } } },
      orderBy: { incurred_on: 'desc' },
    });
    expect(prisma.salePayment.findMany).toHaveBeenCalledWith({
      where: {
        created_at: { gte: start, lte: end },
        sale: {
          consumer_id: 5,
          deleted_at: null,
          sale_type: 'sale',
          branch_id: 2,
        },
      },
      include: {
        sale: {
          select: {
            id: true,
            sale_number: true,
            sale_date: true,
            total_amount: true,
          },
        },
      },
    });
    await service.getEODReport(5, { date: '2026-05-05' });
    expect('branch_id' in prisma.sale.findMany.mock.calls[1][0].where).toBe(
      false,
    );
    expect('branch_id' in prisma.return.findMany.mock.calls[1][0].where).toBe(
      false,
    );
    expect(
      'branch_id' in prisma.operationalCost.findMany.mock.calls[1][0].where,
    ).toBe(false);
  });

  it('[BE-MUT-828] month and all-time reports widen the window; the default is today', async () => {
    const { prisma, service } = world();
    const month = await service.getEODReport(5, {
      date: '2026-05-17',
      period: 'month',
    } as any);
    expect(prisma.sale.findMany.mock.calls[0][0].where.sale_date).toEqual({
      gte: new Date(2026, 4, 1, 0, 0, 0, 0),
      lte: new Date(2026, 4, 31, 23, 59, 59, 999),
    });
    expect(month).toMatchObject({
      period: 'month',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
    });
    await service.getEODReport(5, { date: '2026-05-17', period: 'all' } as any);
    expect(prisma.sale.findMany.mock.calls[1][0].where.sale_date).toEqual({
      gte: new Date(0),
      lte: new Date(2026, 4, 17, 23, 59, 59, 999),
    });
    const today = await service.getEODReport(5, {});
    expect(today.date).toBe('2026-05-05');
    expect(prisma.sale.findMany.mock.calls[2][0].where.sale_date.gte).toEqual(
      new Date(2026, 4, 5, 0, 0, 0, 0),
    );
    const noDay = await service.getEODReport(5, { date: '2026-05' });
    expect(noDay.date).toBe('2026-05-01');
  });

  it('[BE-MUT-829] an empty day reports zeros and no division by zero', async () => {
    const ctx = world();
    for (const model of [
      ctx.prisma.sale,
      ctx.prisma.return,
      ctx.prisma.operationalCost,
      ctx.prisma.salePayment,
    ]) {
      model.findMany.mockResolvedValue([]);
    }
    const report = await ctx.service.getEODReport(5, {
      date: '2026-05-05',
    });
    expect(report.summary).toMatchObject({
      total_sales: 0,
      total_amount: 0,
      average_transaction_value: 0,
      total_due: 0,
      due_sales_count: 0,
      net_operating_result: 0,
    });
    expect(report.product_sales).toEqual([]);
    expect(report.payment_method_breakdown).toEqual([]);
  });

  it('[BE-MUT-830] a sale paid beyond its total or settled by the period end is not due; small remainders are', async () => {
    const ctx = world();
    ctx.prisma.salePayment.findMany.mockResolvedValue([]);
    ctx.prisma.return.findMany.mockResolvedValue([]);
    const sale = (
      id: number,
      total: string,
      status: string,
      paid: number,
      created = local(11),
    ): any => ({
      id,
      sale_number: `S${id}`,
      sale_date: local(9),
      total_amount: total,
      payment_status: status,
      items: [],
      payments: paid ? [payment(id * 10, 'CASH', paid, id, created)] : [],
    });
    ctx.prisma.sale.findMany.mockResolvedValue([
      sale(1, '100', 'paid', 150),
      sale(2, '100', 'paid', 99.99),
      sale(3, '100', 'paid', 100),
      sale(4, '100', 'paid', 100, local(23, 59)),
      sale(5, '100', 'partial', 100),
    ]);
    const report = await ctx.service.getEODReport(5, {
      date: '2026-05-05',
    });
    expect(report.summary.due_sales_count).toBe(2);
    expect(report.summary.total_due).toBeCloseTo(0.01 + 0, 2);
  });

  it('[BE-MUT-831] failures are logged and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const ctx = world();
        ctx.prisma.sale.findMany.mockRejectedValue(f);
        return ctx.service.getEODReport(5, {
          date: '2026-05-05',
          branch_id: 2,
        });
      },
      message: 'Error generating EOD report',
      logged: [
        'Error generating EOD report for consumer 5 and branch 2 and date 2026-05-05',
      ],
    });
  });
});

describe('SalesService.assertItemPromotionDiscounts (unit)', () => {
  const check = (service: any, dto: any) =>
    service.assertItemPromotionDiscounts(dto, 5);
  const dto = (items: object[], extra: object = {}) => ({
    branch_id: 2,
    customer_id: 4,
    items,
    ...extra,
  });

  it('[BE-MUT-832] without promotion discounts nothing is evaluated', async () => {
    const { promotions, service } = setupSales();
    await check(
      service,
      dto([
        { variant_id: 1, quantity: 1, unit_price: 10 },
        {
          variant_id: 2,
          quantity: 1,
          unit_price: 5,
          promotion_discount_amount: 0,
        },
      ]),
    );
    expect(promotions.assertAndCalculateDiscount).not.toHaveBeenCalled();
  });

  it('[BE-MUT-833] a promotion discount must name its promotion (on the line or the sale)', async () => {
    const { promotions, service } = setupSales();
    promotions.assertAndCalculateDiscount.mockResolvedValue({
      discount_amount: 100,
    });
    await expect(
      check(
        service,
        dto([
          {
            variant_id: 1,
            quantity: 1,
            unit_price: 10,
            promotion_discount_amount: 2,
          },
        ]),
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Promotion discount on variant 1 has no promotion',
      ),
    );
    await expect(
      check(
        service,
        dto(
          [
            {
              variant_id: 1,
              quantity: 1,
              unit_price: 10,
              promotion_discount_amount: 2,
            },
          ],
          { applied_promotion_id: 7 },
        ),
      ),
    ).resolves.toBeUndefined();
    expect(promotions.assertAndCalculateDiscount).toHaveBeenCalledTimes(1);
  });

  it('[BE-MUT-834] claimed discounts are summed per promotion and checked against what the promotion allows, on the undiscounted cart', async () => {
    const { promotions, service } = setupSales();
    promotions.assertAndCalculateDiscount.mockImplementation(
      async (id: number) => ({
        discount_amount: id === 7 ? 5 : 1,
      }),
    );
    await check(
      service,
      dto([
        {
          variant_id: 1,
          quantity: 2,
          unit_price: 10,
          promotion_discount_amount: 3,
          applied_promotion_id: 7,
        },
        {
          variant_id: 2,
          quantity: 3,
          unit_price: 4,
          promotion_discount_amount: '2',
          applied_promotion_id: 7,
        },
        {
          variant_id: 3,
          quantity: 1,
          unit_price: 9,
          promotion_discount_amount: 1,
          applied_promotion_id: 8,
        },
        { variant_id: 4, quantity: 1, unit_price: 9 },
      ]),
    );
    expect(promotions.assertAndCalculateDiscount).toHaveBeenCalledTimes(2);
    expect(promotions.assertAndCalculateDiscount).toHaveBeenNthCalledWith(
      1,
      7,
      5,
      2,
      4,
      [
        { variant_id: 1, quantity: 2, unit_price: 10, line_total: 20 },
        { variant_id: 2, quantity: 3, unit_price: 4, line_total: 12 },
        { variant_id: 3, quantity: 1, unit_price: 9, line_total: 9 },
        { variant_id: 4, quantity: 1, unit_price: 9, line_total: 9 },
      ],
    );
  });

  it('[BE-MUT-835] a claim beyond the allowed discount (plus two cents of rounding) is refused with both amounts', async () => {
    const { promotions, service } = setupSales();
    promotions.assertAndCalculateDiscount.mockResolvedValue({
      discount_amount: 5,
    });
    const claim = (amount: number) =>
      check(
        service,
        dto([
          {
            variant_id: 1,
            quantity: 1,
            unit_price: 10,
            promotion_discount_amount: amount,
            applied_promotion_id: 7,
          },
        ]),
      );
    await expect(claim(5.02)).resolves.toBeUndefined();
    await expect(claim(5.03)).rejects.toThrow(
      'Promotion discount (5.03) exceeds what the promotion allows (5.00)',
    );
    promotions.assertAndCalculateDiscount.mockResolvedValue({});
    await expect(claim(0.02)).resolves.toBeUndefined();
    await expect(claim(0.03)).rejects.toThrow(
      '(0.03) exceeds what the promotion allows (0.00)',
    );
  });
});
