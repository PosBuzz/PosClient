import { HttpStatus } from '@nestjs/common';
import { BillingHistoryService } from './billing-history.service';

describe('BillingHistoryService', () => {
  const prisma = {
    billingHistory: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: BillingHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingHistoryService(prisma as any);
  });

  const dto = {
    consumer_id: 7,
    plan_id: 2,
    amount: 100,
    reference: 'INV-7',
    billing_date: '2026-09-01T00:00:00.000Z',
    billing_from: '2026-09-01T00:00:00.000Z',
    billing_till: '2026-09-30T23:59:59.999Z',
  };

  it('stores the explicit billing coverage period', async () => {
    prisma.billingHistory.findFirst.mockResolvedValue(null);
    prisma.billingHistory.create.mockResolvedValue({ id: 1 });

    await service.create(dto);

    expect(prisma.billingHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consumer_id: 7,
        billing_from: new Date(dto.billing_from),
        billing_till: new Date(dto.billing_till),
      }),
    });
  });

  it('rejects an overlapping billing period', async () => {
    prisma.billingHistory.findFirst.mockResolvedValue({ id: 99 });

    await expect(service.create(dto)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.billingHistory.create).not.toHaveBeenCalled();
  });

  it('rejects a period whose till date precedes its from date', async () => {
    await expect(
      service.create({
        ...dto,
        billing_from: '2026-10-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(prisma.billingHistory.findFirst).not.toHaveBeenCalled();
  });
});
