import { NotFoundException } from '@nestjs/common';
import { SupportService } from '../../src/consumer/support/services/support.service';
import { createAdmin } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('consumer support detail', () => {
  const db = getPrisma();
  let boot: Boot;
  let w: World;
  let service: SupportService;
  beforeAll(async () => {
    boot = await bootDomain();
    service = boot.get(SupportService);
  });
  beforeEach(async () => {
    w = await newWorld(db, boot);
  });
  afterEach(() => w.check());
  afterAll(async () => {
    await boot.app.close();
    await disconnect();
  });
  const cid = () => w.tenant.consumer.id;
  const uid = () => w.tenant.adminUser.id;
  const open = (extra: object = {}) =>
    service.create(cid(), uid(), {
      subject: 'Printer jam',
      message: 'It is stuck',
      category: 'TECHNICAL',
      ...extra,
    } as any);

  it('[BE-SUP-100] {SupportService.create} trims text, defaults priority to MEDIUM and writes the first consumer message', async () => {
    const t = await open({
      subject: '  Printer jam  ',
      message: '  Help me  ',
    });
    expect(t).toMatchObject({
      consumer_id: cid(),
      created_by_id: uid(),
      subject: 'Printer jam',
      category: 'TECHNICAL',
      priority: 'MEDIUM',
      status: 'OPEN',
      closed_at: null,
    });
    expect(t.messages).toHaveLength(1);
    expect(t.messages[0]).toMatchObject({
      body: 'Help me',
      author_type: 'CONSUMER',
      consumer_user: { id: uid(), name: w.tenant.adminUser.name },
      super_admin: null,
    });
    expect(Object.keys(t.messages[0]).sort()).toEqual(
      [
        'author_type',
        'body',
        'consumer_user',
        'created_at',
        'id',
        'super_admin',
      ].sort(),
    );
    expect((await open({ priority: 'URGENT' })).priority).toBe('URGENT');
    expect(await db.supportTicketMessage.count()).toBe(2);
  });

  it('[BE-SUP-101] {SupportService.findAll} lists only the tenant tickets, filtered by status and case-insensitive subject, newest activity first', async () => {
    const a = await open({ subject: 'Alpha Billing' });
    const b = await open({ subject: 'Beta billing' });
    const c = await open({ subject: 'Gamma' });
    const foreign = await service.create(
      w.bystander.consumer.id,
      w.bystander.adminUser.id,
      { subject: 'Alpha foreign', message: 'x', category: 'OTHER' } as any,
    );
    await w.rebaseBystander();
    await db.supportTicket.update({
      where: { id: a.id },
      data: { last_reply_at: new Date('2026-01-03T00:00:00Z') },
    });
    await db.supportTicket.update({
      where: { id: b.id },
      data: {
        last_reply_at: new Date('2026-01-02T00:00:00Z'),
        status: 'RESOLVED',
      },
    });
    await db.supportTicket.update({
      where: { id: c.id },
      data: { last_reply_at: new Date('2026-01-02T00:00:00Z') },
    });
    const ids = async (q: object) =>
      (await service.findAll(cid(), q as any)).map((r) => r.id);
    // ties on last_reply_at break by id desc
    expect(await ids({})).toEqual([a.id, c.id, b.id]);
    expect(await ids({ status: 'RESOLVED' })).toEqual([b.id]);
    expect(await ids({ status: 'CLOSED' })).toEqual([]);
    expect(await ids({ search: 'BILLING' })).toEqual([a.id, b.id]);
    expect(await ids({ search: 'billing', status: 'OPEN' })).toEqual([a.id]);
    expect(await ids({ search: 'alpha' })).toEqual([a.id]);
    expect(await ids({ search: '' })).toEqual([a.id, c.id, b.id]);
    expect(
      (await service.findAll(w.bystander.consumer.id, {})).map((r) => r.id),
    ).toEqual([foreign.id]);
    const row = (await service.findAll(cid(), {}))[0] as any;
    expect(row._count).toEqual({ messages: 1 });
    expect(row.created_by).toEqual({
      id: uid(),
      name: w.tenant.adminUser.name,
    });
    expect(row.assigned_to).toBeNull();
    expect(row.messages).toBeUndefined();
  });

  it('[BE-SUP-102] {SupportService.findOne} returns the ticket with ordered messages and hides foreign or unknown tickets', async () => {
    const t = await open();
    const admin = await createAdmin(db);
    await db.supportTicket.update({
      where: { id: t.id },
      data: { assigned_to_id: admin.id },
    });
    await db.supportTicketMessage.create({
      data: {
        ticket_id: t.id,
        author_type: 'SUPER_ADMIN',
        super_admin_id: admin.id,
        body: 'Agent reply',
        created_at: new Date(Date.now() + 60_000),
      },
    });
    const found = await service.findOne(t.id, cid());
    expect(found.assigned_to).toEqual({ id: admin.id, name: admin.name });
    expect(found.created_by).toEqual({
      id: uid(),
      name: w.tenant.adminUser.name,
    });
    expect(found.messages.map((m) => m.body)).toEqual([
      'It is stuck',
      'Agent reply',
    ]);
    expect(found.messages[1]).toMatchObject({
      author_type: 'SUPER_ADMIN',
      super_admin: { id: admin.id, name: admin.name },
      consumer_user: null,
    });
    for (const action of [
      () => service.findOne(t.id, w.bystander.consumer.id),
      () => service.findOne(987654, cid()),
    ]) {
      const error = await action().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.message).toBe('Support ticket not found');
    }
  });

  it('[BE-SUP-103] {SupportService.addMessage} a reply trims, stamps last_reply_at and reopens waiting/closed/resolved tickets but keeps IN_PROGRESS', async () => {
    const old = new Date('2026-01-01T00:00:00Z');
    for (const [from, to] of [
      ['OPEN', 'OPEN'],
      ['IN_PROGRESS', 'IN_PROGRESS'],
      ['WAITING_ON_CUSTOMER', 'OPEN'],
      ['RESOLVED', 'OPEN'],
      ['CLOSED', 'OPEN'],
    ] as const) {
      const t = await open();
      await db.supportTicket.update({
        where: { id: t.id },
        data: {
          status: from,
          last_reply_at: old,
          closed_at: from === 'CLOSED' ? old : null,
        },
      });
      const before = Date.now();
      const out = await service.addMessage(t.id, cid(), uid(), {
        body: '  more info  ',
      });
      expect(out.status).toBe(to);
      expect(out.closed_at).toBeNull();
      expect(out.last_reply_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(out.messages.map((m) => m.body)).toEqual([
        'It is stuck',
        'more info',
      ]);
      expect(out.messages[1]).toMatchObject({
        author_type: 'CONSUMER',
        consumer_user: { id: uid() },
      });
    }
  });

  it('[BE-SUP-104] {SupportService.addMessage} {SupportService.close} {SupportService.reopen} reject foreign and unknown tickets without writing', async () => {
    const t = await open();
    const other = w.bystander.consumer.id;
    const calls = [
      () =>
        service.addMessage(t.id, other, w.bystander.adminUser.id, {
          body: 'x',
        }),
      () => service.addMessage(987654, cid(), uid(), { body: 'x' }),
      () => service.close(t.id, other),
      () => service.close(987654, cid()),
      () => service.reopen(t.id, other),
      () => service.reopen(987654, cid()),
    ];
    for (const call of calls) {
      const error = await call().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.message).toBe('Support ticket not found');
    }
    expect(
      await db.supportTicketMessage.count({ where: { ticket_id: t.id } }),
    ).toBe(1);
    expect(
      await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } }),
    ).toMatchObject({ status: 'OPEN', closed_at: null });
  });

  it('[BE-SUP-105] {SupportService.close} {SupportService.reopen} close stamps closed_at and reopen clears it and bumps last_reply_at', async () => {
    const t = await open();
    const before = Date.now();
    const closed = await service.close(t.id, cid());
    expect(closed.status).toBe('CLOSED');
    expect(closed.closed_at!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(closed.messages).toHaveLength(1);
    await db.supportTicket.update({
      where: { id: t.id },
      data: { last_reply_at: new Date('2026-01-01T00:00:00Z') },
    });
    const reopened = await service.reopen(t.id, cid());
    expect(reopened.status).toBe('OPEN');
    expect(reopened.closed_at).toBeNull();
    expect(reopened.last_reply_at.getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
    // reopening an in-progress ticket also resets it to OPEN
    await db.supportTicket.update({
      where: { id: t.id },
      data: { status: 'IN_PROGRESS' },
    });
    expect((await service.reopen(t.id, cid())).status).toBe('OPEN');
  });
});
