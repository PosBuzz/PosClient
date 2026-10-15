import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminSupportService } from '../../src/admin/support/services/support.service';
import { SupportService } from '../../src/consumer/support/services/support.service';
import { AppService } from '../../src/app.service';
import { createAdmin } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('support administration and application diagnostics', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let service: AdminSupportService;
  beforeAll(async () => {
    boot = await bootDomain();
    service = boot.get(AdminSupportService);
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });

  it('[BE-ASUP-100] {AdminSupportService.findAll} {AdminSupportService.findOne} {AdminSupportService.stats} {AdminSupportService.reply} {AdminSupportService.update} replies assign the agent, update status and preserve closed tickets', async () => {
    const admin = await createAdmin(db);
    const ticket = await boot
      .get(SupportService)
      .create(w.tenant.consumer.id, w.tenant.adminUser.id, {
        subject: 'Printer problem',
        message: 'Help',
        category: 'TECHNICAL',
        priority: 'URGENT',
      } as any);
    expect(await service.stats()).toMatchObject({
      total: 1,
      open: 1,
      urgent: 1,
      unassigned: 1,
    });
    expect(
      (
        await service.findAll({
          search: 'PRINTER',
          consumer_id: w.tenant.consumer.id,
          priority: 'URGENT',
        })
      ).map((row) => row.id),
    ).toEqual([ticket.id]);
    expect(
      await service.findAll({ consumer_id: w.bystander.consumer.id }),
    ).toEqual([]);
    expect(await service.findOne(ticket.id)).toMatchObject({
      subject: 'Printer problem',
      messages: [{ body: 'Help' }],
    });
    const replied = await service.reply(ticket.id, admin.id, {
      body: '  Try again  ',
    });
    expect(replied).toMatchObject({
      status: 'WAITING_ON_CUSTOMER',
      assigned_to_id: admin.id,
    });
    expect(
      await db.supportTicketMessage.findFirstOrThrow({
        where: { ticket_id: ticket.id, author_type: 'SUPER_ADMIN' },
      }),
    ).toMatchObject({ body: 'Try again', super_admin_id: admin.id });
    expect(
      await service.update(ticket.id, {
        status: 'CLOSED',
        priority: 'LOW',
        assigned_to_id: null,
      }),
    ).toMatchObject({
      status: 'CLOSED',
      priority: 'LOW',
      assigned_to_id: null,
      closed_at: expect.any(Date),
    });
    expect(
      await service.reply(ticket.id, admin.id, { body: 'Closing note' }),
    ).toMatchObject({ status: 'CLOSED', closed_at: expect.any(Date) });
    expect(
      await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
    ).toMatchObject({ status: 'CLOSED', priority: 'LOW' });
    expect(await service.stats()).toMatchObject({
      total: 1,
      open: 0,
      urgent: 0,
      unassigned: 0,
    });
  });

  it('[BE-ASUP-101] {AdminSupportService.findOne} {AdminSupportService.reply} {AdminSupportService.update} missing tickets and assignees return exact errors without writing messages', async () => {
    const admin = await createAdmin(db);
    const ticket = await boot
      .get(SupportService)
      .create(w.tenant.consumer.id, w.tenant.adminUser.id, {
        subject: 'Help',
        message: 'Help',
        category: 'TECHNICAL',
      } as any);
    for (const action of [
      () => service.findOne(-1),
      () => service.reply(-1, admin.id, { body: 'No' }),
      () => service.update(-1, { status: 'CLOSED' }),
    ]) {
      const error = await action().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Support ticket not found');
    }
    const error = await service
      .update(ticket.id, { assigned_to_id: -1 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe('Assignee not found');
    expect(await db.supportTicketMessage.count()).toBe(1);
    expect(
      await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
    ).toMatchObject({ status: 'OPEN', assigned_to_id: null });
  });

  it('[BE-APP-100] {AppService.getHello} {AppService.getHealth} {AppService.getMetrics} diagnostics report the real migrated database and disabled optional Redis', async () => {
    const app = boot.get(AppService);
    expect(app.getHello()).toBe('Hello World!');
    expect(await app.getHealth()).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
      services: {
        database: {
          status: 'healthy',
          latency: expect.any(Number),
          connections: expect.any(Number),
        },
        redis: { status: 'disabled' },
      },
    });
    const metrics = await app.getMetrics();
    expect(metrics.database).not.toHaveProperty('error');
    expect(metrics.process).toMatchObject({
      uptime: expect.any(Number),
      memory: { rss: expect.any(Number) },
      cpu: { user: expect.any(Number), system: expect.any(Number) },
    });
  });
});
