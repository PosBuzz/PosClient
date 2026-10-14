import { HttpStatus } from '@nestjs/common';
import { expectGenericWrapping } from '../../../test/helpers/error-wrapping';
import { BillingHistoryService } from './billing-history.service';

describe('BillingHistoryService', () => {
  const prisma = {
    billingHistory: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

  it('{BillingHistoryService.create} stores the explicit billing coverage period', async () => {
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

  it('{BillingHistoryService.create} rejects an overlapping billing period', async () => {
    prisma.billingHistory.findFirst.mockResolvedValue({ id: 99 });

    await expect(service.create(dto)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.billingHistory.create).not.toHaveBeenCalled();
  });

  it('{BillingHistoryService.create} rejects a period whose till date precedes its from date', async () => {
    await expect(
      service.create({
        ...dto,
        billing_from: '2026-10-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(prisma.billingHistory.findFirst).not.toHaveBeenCalled();
  });

  describe('findAll', () => {
    it('[BE-MUT-350] no filters lists every bill with its consumer, oldest first', async () => {
      prisma.billingHistory.findMany.mockResolvedValue([{ id: 1 }]);
      await expect(service.findAll({})).resolves.toEqual([{ id: 1 }]);
      expect(prisma.billingHistory.findMany).toHaveBeenCalledWith({
        where: {},
        include: { consumer: true },
        orderBy: { id: 'asc' },
      });
      await service.findAll({ consumerIds: [] });
      expect(prisma.billingHistory.findMany.mock.lastCall![0].where).toEqual(
        {},
      );
    });

    it('[BE-MUT-351] consumer ids filter with IN and the reference is a case-insensitive contains', async () => {
      prisma.billingHistory.findMany.mockResolvedValue([]);
      await service.findAll({ consumerIds: [3, 4], reference: 'inv' });
      expect(prisma.billingHistory.findMany.mock.lastCall![0].where).toEqual({
        consumer_id: { in: [3, 4] },
        reference: { contains: 'inv', mode: 'insensitive' },
      });
      await service.findAll({ reference: 'only' });
      expect(prisma.billingHistory.findMany.mock.lastCall![0].where).toEqual({
        reference: { contains: 'only', mode: 'insensitive' },
      });
    });
  });

  describe('period rules', () => {
    it('[BE-MUT-352] a one-instant period (from equals till) is valid; the error text names the rule', async () => {
      prisma.billingHistory.findFirst.mockResolvedValue(null);
      prisma.billingHistory.create.mockResolvedValue({ id: 1 });
      await service.create({
        ...dto,
        billing_from: dto.billing_date,
        billing_till: dto.billing_date,
      });
      expect(prisma.billingHistory.create).toHaveBeenCalledTimes(1);
      const error = await service
        .create({ ...dto, billing_from: '2026-10-01T00:00:00.000Z' })
        .catch((e) => e);
      expect(error.message).toBe(
        'Billing till date must be on or after the billing from date',
      );
    });

    it('[BE-MUT-353] the overlap probe is tenant scoped, inclusive at both ends, and the conflict names the cause', async () => {
      prisma.billingHistory.findFirst.mockResolvedValue({ id: 99 });
      const error = await service.create(dto).catch((e) => e);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(error.message).toBe(
        'This billing period overlaps an existing bill for the consumer',
      );
      expect(prisma.billingHistory.findFirst).toHaveBeenCalledWith({
        where: {
          consumer_id: 7,
          billing_from: { lte: new Date(dto.billing_till) },
          billing_till: { gte: new Date(dto.billing_from) },
        },
        select: { id: true },
      });
    });
  });

  describe('create', () => {
    it('[BE-MUT-354] every field is stored; a missing reference becomes null and the billing date is parsed', async () => {
      prisma.billingHistory.findFirst.mockResolvedValue(null);
      prisma.billingHistory.create.mockResolvedValue({ id: 5 });
      await expect(service.create(dto)).resolves.toEqual({ id: 5 });
      expect(prisma.billingHistory.create).toHaveBeenCalledWith({
        data: {
          consumer_id: 7,
          plan_id: 2,
          amount: 100,
          reference: 'INV-7',
          billing_date: new Date(dto.billing_date),
          billing_from: new Date(dto.billing_from),
          billing_till: new Date(dto.billing_till),
        },
      });
      await service.create({ ...dto, reference: undefined });
      expect(
        prisma.billingHistory.create.mock.lastCall![0].data.reference,
      ).toBeNull();
    });

    it('[BE-MUT-355] unexpected create failures are logged and hidden behind a generic 500; client errors pass through', async () => {
      await expectGenericWrapping({
        run: (f) => {
          prisma.billingHistory.findFirst.mockResolvedValue(null);
          prisma.billingHistory.create.mockRejectedValue(f);
          return service.create(dto);
        },
        message: 'Failed to create billing record',
        logged: ['Creating billing record failed'],
      });
    });

    it('[BE-MUT-356] a failing list is logged and hidden behind a generic 500', async () => {
      await expectGenericWrapping({
        run: (f) => {
          prisma.billingHistory.findMany.mockRejectedValue(f);
          return service.findAll({});
        },
        message: 'Failed to fetch billing history',
        logged: ['Fetching billing history failed'],
      });
    });
  });

  describe('update', () => {
    const existing = {
      id: 3,
      consumer_id: 7,
      billing_from: new Date('2026-09-01T00:00:00.000Z'),
      billing_till: new Date('2026-09-30T00:00:00.000Z'),
    };

    it('[BE-MUT-357] a missing record is a 404 and nothing is checked or written', async () => {
      prisma.billingHistory.findUnique.mockResolvedValue(null);
      const error = await service
        .update(3, { amount: 5 } as any)
        .catch((e) => e);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.message).toBe('Billing record not found');
      expect(prisma.billingHistory.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
      });
      expect(prisma.billingHistory.findFirst).not.toHaveBeenCalled();
      expect(prisma.billingHistory.update).not.toHaveBeenCalled();
    });

    it('[BE-MUT-358] only the supplied fields are written, and the overlap check excludes this bill and uses the stored period', async () => {
      prisma.billingHistory.findUnique.mockResolvedValue(existing);
      prisma.billingHistory.findFirst.mockResolvedValue(null);
      prisma.billingHistory.update.mockResolvedValue({ id: 3 });
      await expect(service.update(3, { amount: 0 } as any)).resolves.toEqual({
        id: 3,
      });
      expect(prisma.billingHistory.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { amount: 0 },
      });
      expect(prisma.billingHistory.findFirst).toHaveBeenCalledWith({
        where: {
          consumer_id: 7,
          id: { not: 3 },
          billing_from: { lte: existing.billing_till },
          billing_till: { gte: existing.billing_from },
        },
        select: { id: true },
      });
    });

    it('[BE-MUT-359] every field maps to its own column; null reference clears it; dates are parsed', async () => {
      prisma.billingHistory.findUnique.mockResolvedValue(existing);
      prisma.billingHistory.findFirst.mockResolvedValue(null);
      prisma.billingHistory.update.mockResolvedValue({ id: 3 });
      await service.update(3, {
        consumer_id: 9,
        plan_id: 4,
        amount: 55,
        reference: null,
        billing_date: '2026-10-01T00:00:00.000Z',
        billing_from: '2026-10-01T00:00:00.000Z',
        billing_till: '2026-10-31T00:00:00.000Z',
      });
      expect(prisma.billingHistory.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: {
          consumer_id: 9,
          plan_id: 4,
          amount: 55,
          reference: null,
          billing_date: new Date('2026-10-01T00:00:00.000Z'),
          billing_from: new Date('2026-10-01T00:00:00.000Z'),
          billing_till: new Date('2026-10-31T00:00:00.000Z'),
        },
      });
      expect(
        prisma.billingHistory.findFirst.mock.lastCall![0].where.consumer_id,
      ).toBe(9);
      await service.update(3, { reference: 'R' });
      expect(prisma.billingHistory.update.mock.lastCall![0].data).toEqual({
        reference: 'R',
      });
    });

    it('[BE-MUT-360] moving only one end of the period is validated against the stored other end', async () => {
      prisma.billingHistory.findUnique.mockResolvedValue(existing);
      const error = await service
        .update(3, { billing_from: '2026-10-15T00:00:00.000Z' } as any)
        .catch((e) => e);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(prisma.billingHistory.update).not.toHaveBeenCalled();
      prisma.billingHistory.findFirst.mockResolvedValue({ id: 50 });
      const conflict = await service
        .update(3, { billing_till: '2026-12-31T00:00:00.000Z' } as any)
        .catch((e) => e);
      expect(conflict.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(prisma.billingHistory.update).not.toHaveBeenCalled();
    });

    it('[BE-MUT-361] unexpected update failures are logged with the bill id and hidden behind a generic 500', async () => {
      await expectGenericWrapping({
        run: (f) => {
          prisma.billingHistory.findUnique.mockResolvedValue(existing);
          prisma.billingHistory.findFirst.mockResolvedValue(null);
          prisma.billingHistory.update.mockRejectedValue(f);
          return service.update(3, { amount: 1 });
        },
        message: 'Failed to update billing record',
        logged: ['Updating billing record 3 failed'],
      });
    });
  });

  describe('remove', () => {
    it('[BE-MUT-362] remove deletes only that bill; unexpected failures are logged and hidden', async () => {
      prisma.billingHistory.delete.mockResolvedValue({});
      await expect(service.remove(3)).resolves.toEqual({ success: true });
      expect(prisma.billingHistory.delete).toHaveBeenCalledWith({
        where: { id: 3 },
      });
      await expectGenericWrapping({
        run: (f) => {
          prisma.billingHistory.delete.mockRejectedValue(f);
          return service.remove(3);
        },
        message: 'Failed to delete billing record',
        logged: ['Deleting billing record 3 failed'],
      });
    });
  });
});
