import { SalesService } from './sales.service';

describe('online order delivery partner', () => {
  const prisma = { sale: { findFirst: jest.fn(), update: jest.fn() } };
  const service = new SalesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sale.findFirst.mockResolvedValue({ id: 1 });
    prisma.sale.update.mockResolvedValue({ id: 1 });
  });
  it('saves a partner on an existing tenant-owned online order', async () => {
    await service.updateOnlineOrderStatus(1, 'READY', 7, ' Courier ');
    expect(prisma.sale.findFirst).toHaveBeenCalledWith({
      where: { id: 1, consumer_id: 7, is_online_order: true, deleted_at: null },
    });
    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { online_order_status: 'READY', delivery_partner: 'Courier' },
      }),
    );
  });
  it('allows clearing a partner', async () => {
    await service.updateOnlineOrderStatus(1, 'READY', 7, null);
    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { online_order_status: 'READY', delivery_partner: null },
      }),
    );
  });
  it('keeps the partner when only changing status', async () => {
    await service.updateOnlineOrderStatus(1, 'READY', 7);
    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { online_order_status: 'READY', delivery_partner: undefined },
      }),
    );
  });
  it('does not update an order outside the consumer scope', async () => {
    prisma.sale.findFirst.mockResolvedValue(null);
    await expect(
      service.updateOnlineOrderStatus(1, 'READY', 7, 'Courier'),
    ).rejects.toThrow('Online order not found');
    expect(prisma.sale.update).not.toHaveBeenCalled();
  });
});
