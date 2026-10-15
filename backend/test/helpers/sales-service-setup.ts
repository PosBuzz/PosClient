import { SalesService } from '../../src/consumer/sales/services/sales.service';

/** Mock Prisma/transaction/collaborators shared by the SalesService unit specs. */
export function setupSales() {
  const mk = (...names: string[]) =>
    Object.fromEntries(names.map((n) => [n, jest.fn()]));
  const tx: any = {
    sale: mk(
      'create',
      'update',
      'updateMany',
      'findFirst',
      'findUnique',
      'count',
    ),
    saleItem: mk('create', 'createMany', 'update', 'findMany'),
    salePayment: mk('create', 'createMany', 'findMany', 'deleteMany'),
    inventoryBatch: mk('findFirst', 'findMany', 'update', 'findUnique'),
    inventoryAuditLog: mk('create', 'createMany'),
    inventoryAdjustment: mk('create'),
    productVariant: mk('findMany', 'findFirst'),
    customer: mk('findFirst', 'findUnique', 'update'),
    branch: mk('findFirst'),
    user: mk('findFirst'),
    promotion: mk('findFirst'),
    pendingDelivery: mk('create', 'update', 'findFirst'),
    return: mk('count', 'findMany'),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const prisma: any = {
    ...tx,
    sale: mk(
      'create',
      'update',
      'updateMany',
      'findFirst',
      'findUnique',
      'findMany',
      'count',
      'aggregate',
      'groupBy',
    ),
    saleItem: mk('findMany', 'groupBy', 'aggregate', 'update', 'count'),
    salePayment: mk('findMany', 'groupBy', 'aggregate'),
    return: mk('findMany', 'count', 'aggregate', 'groupBy'),
    returnItem: mk('groupBy', 'findMany', 'aggregate'),
    returnPayment: mk('groupBy', 'findMany', 'aggregate'),
    rewardsPointTransaction: mk('findMany'),
    promotion: mk('findMany', 'findFirst'),
    branch: mk('findFirst', 'findMany', 'findUnique'),
    user: mk('findMany', 'findFirst'),
    customer: mk('findFirst', 'findMany'),
    consumer: mk('findUnique'),
    productVariant: mk(
      'findMany',
      'findFirst',
      'findUnique',
      'groupBy',
      'count',
    ),
    inventoryBatch: mk('findMany', 'findFirst', 'aggregate'),
    operationalCost: mk('findMany', 'aggregate'),
    expense: mk('findMany'),
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const rewards: any = mk(
    'earnPoints',
    'adjustPoints',
    'processCreditPayment',
    'processCreditRefund',
    'validateCreditPayment',
  );
  const promotions: any = mk(
    'assertAndCalculateDiscount',
    'closePromotionIfExhausted',
  );
  const service = new SalesService(prisma, rewards, {} as any, promotions);
  return { prisma, tx, rewards, promotions, service };
}
