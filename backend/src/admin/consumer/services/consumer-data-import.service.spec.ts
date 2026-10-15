import { BadRequestException } from '@nestjs/common';
import {
  ConsumerImportDuplicateStrategy,
  ConsumerImportSection,
} from '../dto/consumer-data-import.dto';
import { ConsumerDataImportService } from './consumer-data-import.service';

describe('ConsumerDataImportService', () => {
  const activeSource = {
    id: 1,
    company_name: 'Source',
    subdomain: 'source',
  };
  const activeTarget = {
    id: 2,
    company_name: 'Target',
    subdomain: 'target',
    max_branch: 5,
    plan: { name: 'Pro', max_products: null },
  };

  const makePrisma = () => ({
    consumer: { findFirst: jest.fn() },
    consumerDataImport: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  it('{ConsumerDataImportService.preview} rejects importing an account into itself', async () => {
    const prisma = makePrisma();
    const service = new ConsumerDataImportService(prisma as any);

    await expect(
      service.preview({
        source_consumer_id: 1,
        target_consumer_id: 1,
        sections: [ConsumerImportSection.PRODUCTS],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.consumer.findFirst).not.toHaveBeenCalled();
  });

  it('{ConsumerDataImportService.run} requires the destination subdomain before creating an audit job', async () => {
    const prisma = makePrisma();
    prisma.consumer.findFirst
      .mockResolvedValueOnce(activeSource)
      .mockResolvedValueOnce(activeTarget);
    const service = new ConsumerDataImportService(prisma as any);

    await expect(
      service.run({
        source_consumer_id: 1,
        target_consumer_id: 2,
        sections: [ConsumerImportSection.CUSTOMERS],
        duplicate_strategy: ConsumerImportDuplicateStrategy.SKIP,
        confirm_target_subdomain: 'wrong-account',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.consumerDataImport.create).not.toHaveBeenCalled();
  });

  it('{ConsumerDataImportService.run} records a failed all-or-nothing transaction in import history', async () => {
    const prisma = makePrisma();
    prisma.consumer.findFirst
      .mockResolvedValueOnce(activeSource)
      .mockResolvedValueOnce(activeTarget);
    prisma.consumerDataImport.create.mockResolvedValue({ id: 44 });
    prisma.$transaction.mockRejectedValue(new Error('relationship failure'));
    prisma.consumerDataImport.update.mockResolvedValue({ id: 44 });
    const service = new ConsumerDataImportService(prisma as any);
    jest.spyOn((service as any).logger, 'error').mockImplementation();

    await expect(
      service.run({
        source_consumer_id: 1,
        target_consumer_id: 2,
        sections: [ConsumerImportSection.CUSTOMERS],
        duplicate_strategy: ConsumerImportDuplicateStrategy.SKIP,
        confirm_target_subdomain: 'target',
      }),
    ).rejects.toThrow('without changing destination data');

    expect(prisma.consumerDataImport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 44 },
        data: expect.objectContaining({
          status: 'FAILED',
          error_message: 'relationship failure',
        }),
      }),
    );
  });

  it('updates a matched customer and saves its repeat-import mapping', async () => {
    const sourceCustomer = {
      id: 10,
      consumer_id: 1,
      name: 'Ada',
      email: 'ada@example.com',
      phone: '01700000000',
      address: 'Dhaka',
      birthday: null,
      customer_type: 'individual',
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    };
    const targetCustomer = { ...sourceCustomer, id: 20, consumer_id: 2 };
    const tx = {
      $executeRaw: jest.fn(),
      consumerImportMapping: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      customer: {
        findMany: jest.fn().mockResolvedValue([sourceCustomer]),
        findUnique: jest.fn().mockResolvedValue(targetCustomer),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(targetCustomer),
        create: jest.fn(),
      },
    };
    const service = new ConsumerDataImportService({} as any);

    const summary = await (service as any).importWithinTransaction(tx, {
      source_consumer_id: 1,
      target_consumer_id: 2,
      sections: [ConsumerImportSection.CUSTOMERS],
      duplicate_strategy: ConsumerImportDuplicateStrategy.UPDATE,
    });

    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 20 } }),
    );
    expect(tx.consumerImportMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          entity_type: 'customer',
          source_record_id: 10,
          target_record_id: 20,
        }),
      }),
    );
    expect(summary.customers).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
      conflicts: 0,
    });
  });
});
