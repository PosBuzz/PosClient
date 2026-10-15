import { SupportService } from '../../src/consumer/support/services/support.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createAdmin } from '../factories';
import { getPrisma, disconnect } from '../helpers/db';
import { Boot, World, bootDomain, newWorld } from '../helpers/domain';

describe('consumer support extra (mutation hardening)', () => {
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
  afterEach(async () => {
    jest.restoreAllMocks();
    await w.check();
  });
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
  const personKeys = ['id', 'name'];

  it('[BE-SUP-200] {SupportService.create} returns only the include shape (scalars plus messages) and persists the row and message once', async () => {
    const t: any = await open({ category: 'BILLING', priority: 'LOW' });
    expect(t.category).toBe('BILLING');
    expect(t.priority).toBe('LOW');
    expect(t.assigned_to_id).toBeNull();
    expect(t).not.toHaveProperty('created_by');
    expect(t).not.toHaveProperty('_count');
    const row = await db.supportTicket.findUniqueOrThrow({
      where: { id: t.id },
    });
    expect(row.last_reply_at).toBeInstanceOf(Date);
    const msgs = await db.supportTicketMessage.findMany({
      where: { ticket_id: t.id },
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({
      author_type: 'CONSUMER',
      consumer_user_id: uid(),
      super_admin_id: null,
      body: 'It is stuck',
    });
  });

  it('[BE-SUP-201] {SupportService.findAll} include shape: creator and assignee selects, message count, and no message bodies', async () => {
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
        body: 'r',
      },
    });
    const [row] = (await service.findAll(cid(), {})) as any[];
    expect(Object.keys(row.created_by).sort()).toEqual(personKeys);
    expect(Object.keys(row.assigned_to).sort()).toEqual(personKeys);
    expect(row.assigned_to.id).toBe(admin.id);
    expect(row._count).toEqual({ messages: 2 });
    expect(row.messages).toBeUndefined();
  });

  it('[BE-SUP-202] {SupportService.findAll} undefined status or search apply no filter and an unmatched subject filter returns nothing', async () => {
    const t = await open({ subject: 'Needle in haystack' });
    await open({ subject: 'Other' });
    const ids = async (q: object) =>
      (await service.findAll(cid(), q as any)).map((r) => r.id);
    expect(await ids({ status: undefined, search: undefined })).toHaveLength(2);
    expect(await ids({ search: 'edle in hay' })).toEqual([t.id]);
    expect(await ids({ search: 'absent' })).toEqual([]);
    expect(await ids({ status: 'OPEN', search: 'absent' })).toEqual([]);
    expect(await ids({ status: 'OPEN' })).toHaveLength(2);
    expect(await ids({ status: 'IN_PROGRESS' })).toEqual([]);
  });

  it('[BE-SUP-203] {SupportService.findOne} message select has exactly the allowed keys and creator/assignee selects only id and name', async () => {
    const t = await open();
    const admin = await createAdmin(db);
    await db.supportTicket.update({
      where: { id: t.id },
      data: { assigned_to_id: admin.id },
    });
    const found: any = await service.findOne(t.id, cid());
    expect(Object.keys(found.created_by).sort()).toEqual(personKeys);
    expect(Object.keys(found.assigned_to).sort()).toEqual(personKeys);
    expect(Object.keys(found.messages[0]).sort()).toEqual(
      [
        'author_type',
        'body',
        'consumer_user',
        'created_at',
        'id',
        'super_admin',
      ].sort(),
    );
    expect(Object.keys(found.messages[0].consumer_user).sort()).toEqual(
      personKeys,
    );
    expect(found).not.toHaveProperty('_count');
    // a second ticket in the same tenant never leaks its messages
    await open({ message: 'second ticket' });
    expect(
      (await service.findOne(t.id, cid())).messages.map((m) => m.body),
    ).toEqual(['It is stuck']);
  });

  it('[BE-SUP-204] {SupportService.addMessage} stores the reply under the caller as a consumer message and leaves other tickets untouched', async () => {
    const t = await open();
    const untouched = await open({ subject: 'Other ticket' });
    await db.supportTicket.update({
      where: { id: untouched.id },
      data: { status: 'CLOSED', closed_at: new Date('2026-01-01T00:00:00Z') },
    });
    const out = await service.addMessage(t.id, cid(), uid(), {
      body: '  second  ',
    });
    const rows = await db.supportTicketMessage.findMany({
      where: { ticket_id: t.id },
      orderBy: { id: 'asc' },
    });
    expect(rows.map((r) => r.body)).toEqual(['It is stuck', 'second']);
    expect(rows[1]).toMatchObject({
      author_type: 'CONSUMER',
      consumer_user_id: uid(),
      super_admin_id: null,
    });
    expect(out.id).toBe(t.id);
    const other = await db.supportTicket.findUniqueOrThrow({
      where: { id: untouched.id },
    });
    expect(other.status).toBe('CLOSED');
    expect(other.closed_at).not.toBeNull();
    expect(
      await db.supportTicketMessage.count({
        where: { ticket_id: untouched.id },
      }),
    ).toBe(1);
  });

  it('[BE-SUP-205] {SupportService.addMessage} is atomic: if the ticket update fails the message is not stored', async () => {
    const t = await open();
    const prisma = boot.get(PrismaService);
    jest.spyOn(prisma.supportTicket, 'update').mockImplementationOnce(() => {
      throw new Error('update failed');
    });
    await expect(
      service.addMessage(t.id, cid(), uid(), { body: 'lost' }),
    ).rejects.toThrow('update failed');
    expect(
      await db.supportTicketMessage.count({ where: { ticket_id: t.id } }),
    ).toBe(1);
  });

  it('[BE-SUP-206] {SupportService.close} closing keeps the thread and last_reply_at; closing twice stays closed; priority and category are untouched', async () => {
    const t = await open({ priority: 'HIGH', category: 'BILLING' });
    const stamp = new Date('2026-02-02T00:00:00Z');
    await db.supportTicket.update({
      where: { id: t.id },
      data: { last_reply_at: stamp, status: 'IN_PROGRESS' },
    });
    const closed = await service.close(t.id, cid());
    expect(closed).toMatchObject({
      status: 'CLOSED',
      priority: 'HIGH',
      category: 'BILLING',
    });
    expect(closed.last_reply_at).toEqual(stamp);
    expect(closed.messages).toHaveLength(1);
    const again = await service.close(t.id, cid());
    expect(again.status).toBe('CLOSED');
    expect(again.closed_at).toBeInstanceOf(Date);
    expect(again.created_by).toEqual({
      id: uid(),
      name: w.tenant.adminUser.name,
    });
    expect(again.assigned_to).toBeNull();
  });

  it('[BE-SUP-207] {SupportService.reopen} reopening adds no message, keeps priority and the thread, and does not touch other tickets', async () => {
    const t = await open({ priority: 'URGENT' });
    const other = await open({ subject: 'Other' });
    await db.supportTicket.updateMany({
      where: { id: { in: [t.id, other.id] } },
      data: { status: 'CLOSED', closed_at: new Date('2026-01-01T00:00:00Z') },
    });
    const out = await service.reopen(t.id, cid());
    expect(out).toMatchObject({
      status: 'OPEN',
      closed_at: null,
      priority: 'URGENT',
    });
    expect(out.messages).toHaveLength(1);
    const untouched = await db.supportTicket.findUniqueOrThrow({
      where: { id: other.id },
    });
    expect(untouched.status).toBe('CLOSED');
    expect(untouched.closed_at).not.toBeNull();
  });
});
