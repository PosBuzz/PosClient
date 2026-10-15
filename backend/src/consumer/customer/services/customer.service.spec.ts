import { CustomerService } from './customer.service';

describe('CustomerService history queries', () => {
  const prisma = {
    customer: {
      findFirst: jest.fn(),
    },
    sale: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    return: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    rewardsPointTransaction: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: CustomerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomerService(prisma as any);
  });

  it('{CustomerService.getSummary} returns tenant-scoped aggregates and only five shallow recent sales', async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: 12,
      name: 'Customer',
      rewards_points: null,
    });
    prisma.sale.aggregate
      .mockResolvedValueOnce({
        _count: { _all: 3 },
        _sum: { total_amount: 500, received_amount: 450 },
        _max: { sale_date: new Date('2026-08-31T10:00:00Z') },
      })
      .mockResolvedValueOnce({
        _sum: { total_amount: 100, received_amount: 50 },
      });
    prisma.return.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { total_refund: 20, total_exchange: 0 },
      _max: { return_date: new Date('2026-08-31T11:00:00Z') },
    });
    prisma.sale.findMany.mockResolvedValue([
      {
        id: 1,
        total_amount: 100,
        received_amount: 50,
        branch: { name: 'Main' },
      },
    ]);

    const result = await service.getSummary(12, 7);

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 12, consumer_id: 7 } }),
    );
    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consumer_id: 7, customer_id: 12 }),
        take: 5,
        select: expect.not.objectContaining({ items: expect.anything() }),
      }),
    );
    expect(prisma.return.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          consumer_id: 7,
          original_sale: { consumer_id: 7, customer_id: 12 },
        },
      }),
    );
    expect(result.sales).toMatchObject({
      count: 3,
      gross_amount: 500,
      outstanding_amount: 50,
    });
    expect(result.rewards.total_points).toBe(0);
  });

  it('{CustomerService.getSalesHistory} caps requested sales history pages at 50 rows', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 12 });
    prisma.sale.count.mockResolvedValue(80);
    prisma.sale.findMany.mockResolvedValue([]);

    const result = await service.getSalesHistory(12, 7, 2, 500);

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consumer_id: 7, customer_id: 12 }),
        skip: 50,
        take: 50,
      }),
    );
    expect(result.meta).toEqual({
      total: 80,
      page: 2,
      limit: 50,
      total_pages: 2,
    });
  });

  it('{CustomerService.getRewardsHistory} scopes reward history by both customer and tenant', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 12 });
    prisma.rewardsPointTransaction.count.mockResolvedValue(1);
    prisma.rewardsPointTransaction.findMany.mockResolvedValue([]);

    await service.getRewardsHistory(12, 7, 1, 20);

    expect(prisma.rewardsPointTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customer_id: 12, consumer_id: 7 },
        take: 20,
      }),
    );
  });
});
