import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminSupportService } from './support.service';

const messageSelect = {
  id: true,
  body: true,
  author_type: true,
  created_at: true,
  consumer_user: { select: { id: true, name: true } },
  super_admin: { select: { id: true, name: true } },
};

function setup() {
  const prisma: any = {
    supportTicket: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    supportTicketMessage: { create: jest.fn() },
    superAdmin: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.supportTicketMessage.create.mockReturnValue('create-op');
  prisma.supportTicket.update.mockReturnValue('update-op');
  prisma.$transaction.mockResolvedValue([]);
  return { prisma, service: new AdminSupportService(prisma) };
}

const NOW = new Date('2026-05-05T10:00:00.000Z');

describe('AdminSupportService (unit)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('[BE-MUT-250] findAll without filters lists everything newest reply first with the pinned includes', async () => {
    const { prisma, service } = setup();
    prisma.supportTicket.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.findAll({} as any)).resolves.toEqual([{ id: 1 }]);
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith({
      where: {},
      include: {
        consumer: { select: { id: true, company_name: true, subdomain: true } },
        created_by: { select: { id: true, name: true, email: true } },
        assigned_to: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ last_reply_at: 'desc' }, { id: 'desc' }],
    });
  });

  it('[BE-MUT-251] every findAll filter maps to its own column and search is a case-insensitive subject match', async () => {
    const { prisma, service } = setup();
    await service.findAll({
      status: 'OPEN',
      priority: 'HIGH',
      consumer_id: 4,
      assigned_to_id: 6,
      search: 'refund',
    } as any);
    expect(prisma.supportTicket.findMany.mock.calls[0][0].where).toEqual({
      status: 'OPEN',
      priority: 'HIGH',
      consumer_id: 4,
      assigned_to_id: 6,
      subject: { contains: 'refund', mode: 'insensitive' },
    });
    for (const [key, value] of [
      ['status', 'CLOSED'],
      ['priority', 'URGENT'],
      ['consumer_id', 9],
      ['assigned_to_id', 3],
    ] as const) {
      await service.findAll({ [key]: value });
      expect(prisma.supportTicket.findMany.mock.lastCall![0].where).toEqual({
        [key]: value,
      });
    }
    await service.findAll({ search: 'x' });
    expect(prisma.supportTicket.findMany.mock.lastCall![0].where).toEqual({
      subject: { contains: 'x', mode: 'insensitive' },
    });
  });

  it('[BE-MUT-252] stats counts open as OPEN + IN_PROGRESS + WAITING_ON_CUSTOMER and excludes closed tickets from unassigned/urgent', async () => {
    const { prisma, service } = setup();
    prisma.supportTicket.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { _all: 2 } },
      { status: 'IN_PROGRESS', _count: { _all: 3 } },
      { status: 'WAITING_ON_CUSTOMER', _count: { _all: 4 } },
      { status: 'RESOLVED', _count: { _all: 5 } },
      { status: 'CLOSED', _count: { _all: 7 } },
    ]);
    prisma.supportTicket.count
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(13);
    await expect(service.stats()).resolves.toEqual({
      total: 21,
      open: 9,
      unassigned: 11,
      urgent: 13,
      by_status: {
        OPEN: 2,
        IN_PROGRESS: 3,
        WAITING_ON_CUSTOMER: 4,
        RESOLVED: 5,
        CLOSED: 7,
      },
    });
    expect(prisma.supportTicket.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    expect(prisma.supportTicket.count).toHaveBeenNthCalledWith(1, {
      where: {
        assigned_to_id: null,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    });
    expect(prisma.supportTicket.count).toHaveBeenNthCalledWith(2, {
      where: {
        priority: 'URGENT',
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    });
  });

  it('[BE-MUT-253] stats treats absent statuses as zero', async () => {
    const { prisma, service } = setup();
    prisma.supportTicket.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { _all: 1 } },
    ]);
    prisma.supportTicket.count.mockResolvedValue(0);
    await expect(service.stats()).resolves.toMatchObject({
      total: 1,
      open: 1,
    });
  });

  it('[BE-MUT-254] findOne loads the full ticket thread oldest message first, and a miss is a 404', async () => {
    const { prisma, service } = setup();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 3 });
    await expect(service.findOne(3)).resolves.toEqual({ id: 3 });
    expect(prisma.supportTicket.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      include: {
        consumer: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
            email: true,
            phone: true,
            plan: { select: { id: true, name: true } },
          },
        },
        created_by: { select: { id: true, name: true, email: true } },
        assigned_to: { select: { id: true, name: true } },
        messages: { select: messageSelect, orderBy: { created_at: 'asc' } },
      },
    });
    prisma.supportTicket.findUnique.mockResolvedValue(null);
    await expect(service.findOne(3)).rejects.toThrow(
      new NotFoundException('Support ticket not found'),
    );
  });

  describe('reply', () => {
    const arrange = (ticket: object | null) => {
      const ctx = setup();
      ctx.prisma.supportTicket.findUnique
        .mockResolvedValueOnce(ticket)
        .mockResolvedValue({ id: 3, thread: true });
      return ctx;
    };
    const updateData = (prisma: any) =>
      prisma.supportTicket.update.mock.calls[0][0].data;

    it('[BE-MUT-255] a reply is written with the trimmed body in one transaction and the ticket is returned', async () => {
      const { prisma, service } = arrange({
        id: 3,
        assigned_to_id: 8,
        status: 'OPEN',
      });
      await expect(
        service.reply(3, 5, { body: '  hello  ' } as any),
      ).resolves.toEqual({ id: 3, thread: true });
      expect(prisma.supportTicket.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 3 },
        select: { id: true, assigned_to_id: true, status: true },
      });
      expect(prisma.supportTicketMessage.create).toHaveBeenCalledWith({
        data: {
          ticket_id: 3,
          author_type: 'SUPER_ADMIN',
          super_admin_id: 5,
          body: 'hello',
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'create-op',
        'update-op',
      ]);
    });

    it('[BE-MUT-256] a normal reply hands the ticket to the customer, stamps the reply time and keeps an existing assignee', async () => {
      const { prisma, service } = arrange({
        id: 3,
        assigned_to_id: 8,
        status: 'OPEN',
      });
      await service.reply(3, 5, { body: 'x' });
      expect(prisma.supportTicket.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: {
          last_reply_at: NOW,
          status: 'WAITING_ON_CUSTOMER',
          closed_at: null,
        },
      });
    });

    it('[BE-MUT-257] the first responder takes ownership of an unassigned ticket', async () => {
      const { prisma, service } = arrange({
        id: 3,
        assigned_to_id: null,
        status: 'OPEN',
      });
      await service.reply(3, 5, { body: 'x' });
      expect(updateData(prisma)).toEqual({
        last_reply_at: NOW,
        status: 'WAITING_ON_CUSTOMER',
        closed_at: null,
        assigned_to_id: 5,
      });
    });

    it('[BE-MUT-258] a reply on a resolved or closed ticket keeps that status and its closing time', async () => {
      for (const status of ['RESOLVED', 'CLOSED']) {
        const { prisma, service } = arrange({
          id: 3,
          assigned_to_id: 8,
          status,
        });
        await service.reply(3, 5, { body: 'note' });
        expect(updateData(prisma)).toMatchObject({ status, closed_at: NOW });
      }
    });

    it('[BE-MUT-259] an explicit status wins: closing sets closed_at, reopening clears it', async () => {
      const closing = arrange({ id: 3, assigned_to_id: 8, status: 'OPEN' });
      await closing.service.reply(3, 5, { body: 'x', status: 'CLOSED' } as any);
      expect(updateData(closing.prisma)).toMatchObject({
        status: 'CLOSED',
        closed_at: NOW,
      });
      const reopening = arrange({
        id: 3,
        assigned_to_id: 8,
        status: 'CLOSED',
      });
      await reopening.service.reply(3, 5, {
        body: 'x',
        status: 'IN_PROGRESS',
      } as any);
      expect(updateData(reopening.prisma)).toMatchObject({
        status: 'IN_PROGRESS',
        closed_at: null,
      });
    });

    it('[BE-MUT-260] replying to a missing ticket is a 404 and writes nothing', async () => {
      const { prisma, service } = arrange(null);
      await expect(service.reply(3, 5, { body: 'x' } as any)).rejects.toThrow(
        new NotFoundException('Support ticket not found'),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const arrange = () => {
      const ctx = setup();
      ctx.prisma.supportTicket.findUnique
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValue({ id: 3, thread: true });
      return ctx;
    };

    it('[BE-MUT-261] only the supplied fields are written and the ticket is returned', async () => {
      const { prisma, service } = arrange();
      await expect(
        service.update(3, { priority: 'HIGH' } as any),
      ).resolves.toEqual({ id: 3, thread: true });
      expect(prisma.supportTicket.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { priority: 'HIGH' },
      });
      expect(prisma.superAdmin.findUnique).not.toHaveBeenCalled();
    });

    it('[BE-MUT-262] a status change sets or clears closed_at', async () => {
      const closing = arrange();
      await closing.service.update(3, { status: 'RESOLVED' } as any);
      expect(closing.prisma.supportTicket.update.mock.calls[0][0].data).toEqual(
        { status: 'RESOLVED', closed_at: NOW },
      );
      const reopening = arrange();
      await reopening.service.update(3, { status: 'OPEN' } as any);
      expect(
        reopening.prisma.supportTicket.update.mock.calls[0][0].data,
      ).toEqual({ status: 'OPEN', closed_at: null });
    });

    it('[BE-MUT-263] assigning checks that the super admin exists; null unassigns without a lookup', async () => {
      const { prisma, service } = arrange();
      prisma.superAdmin.findUnique.mockResolvedValue({ id: 7 });
      await service.update(3, { assigned_to_id: 7 });
      expect(prisma.superAdmin.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        select: { id: true },
      });
      expect(prisma.supportTicket.update.mock.calls[0][0].data).toEqual({
        assigned_to_id: 7,
      });
      const unassign = arrange();
      await unassign.service.update(3, { assigned_to_id: null });
      expect(unassign.prisma.superAdmin.findUnique).not.toHaveBeenCalled();
      expect(
        unassign.prisma.supportTicket.update.mock.calls[0][0].data,
      ).toEqual({ assigned_to_id: null });
    });

    it('[BE-MUT-264] an unknown assignee is a 400 and nothing is written; an unknown ticket is a 404', async () => {
      const { prisma, service } = arrange();
      prisma.superAdmin.findUnique.mockResolvedValue(null);
      await expect(
        service.update(3, { assigned_to_id: 7 } as any),
      ).rejects.toThrow(new BadRequestException('Assignee not found'));
      expect(prisma.supportTicket.update).not.toHaveBeenCalled();
      const missing = setup();
      missing.prisma.supportTicket.findUnique.mockResolvedValue(null);
      await expect(
        missing.service.update(3, { priority: 'LOW' } as any),
      ).rejects.toThrow(new NotFoundException('Support ticket not found'));
    });
  });
});
