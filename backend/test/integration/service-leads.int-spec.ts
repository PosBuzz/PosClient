import { NotFoundException } from '@nestjs/common';
import { PortfolioLeadType } from '@prisma/client';
import { PortfolioLeadService } from '../../src/portfolio/services/portfolio-lead.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { getPrisma, resetDb, disconnect } from '../helpers/db';

describe('portfolio lead persistence', () => {
  const db = getPrisma();
  const service = new PortfolioLeadService(db as unknown as PrismaService);
  const dto = {
    type: PortfolioLeadType.DEMO,
    name: '  Ali  ',
    email: ' ALI@EXAMPLE.TEST ',
    phone: ' 123 ',
    business_name: ' Shop ',
    industry: ' Retail ',
    locations: ' 2 ',
    message: ' Demo please ',
    source_page: ' /demo ',
  };
  beforeEach(resetDb);
  afterAll(disconnect);

  it('[BE-LEAD-100] {PortfolioLeadService.create} trims contact fields and discards honeypot submissions without storing them', async () => {
    expect(await service.create(dto)).toEqual({ success: true });
    const row = await db.portfolioLead.findFirstOrThrow();
    expect(row).toMatchObject({
      name: 'Ali',
      email: 'ali@example.test',
      phone: '123',
      business_name: 'Shop',
      industry: 'Retail',
      locations: '2',
      message: 'Demo please',
      source_page: '/demo',
      status: 'NEW',
    });
    expect(await service.create({ ...dto, company_website: 'bot' })).toEqual({
      success: true,
    });
    expect(await db.portfolioLead.count()).toBe(1);
  });

  it('[BE-LEAD-101] {PortfolioLeadService.findAll} {PortfolioLeadService.update} filters case-insensitive contact search, status and type and persists trimmed notes', async () => {
    await service.create(dto);
    await service.create({
      ...dto,
      name: 'Other',
      email: 'other@example.test',
      business_name: 'Elsewhere',
    });
    const mine = (await service.findAll({ search: 'aLi' }))[0];
    expect(mine.email).toBe('ali@example.test');
    expect(
      await service.update(mine.id, { status: 'WON', notes: '  Sold  ' }),
    ).toMatchObject({ id: mine.id, status: 'WON', notes: 'Sold' });
    expect(
      await db.portfolioLead.findUniqueOrThrow({ where: { id: mine.id } }),
    ).toMatchObject({ status: 'WON', notes: 'Sold' });
    expect(
      (
        await service.findAll({ status: 'WON', type: dto.type, search: 'SHOP' })
      ).map((row) => row.id),
    ).toEqual([mine.id]);
    expect(await service.findAll({ status: 'NEW', search: 'ALI' })).toEqual([]);
    expect(await service.update(mine.id, { notes: '   ' })).toMatchObject({
      notes: null,
      status: 'WON',
    });
  });

  it('[BE-LEAD-102] {PortfolioLeadService.stats} counts each status and the fixed seven-day window', async () => {
    jest.useFakeTimers({
      now: new Date('2026-03-15T10:00:00Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'queueMicrotask',
        'hrtime',
        'performance',
      ],
    });
    try {
      await service.create(dto);
      const row = await db.portfolioLead.findFirstOrThrow();
      await db.portfolioLead.update({
        where: { id: row.id },
        data: { created_at: new Date('2026-03-08T10:00:00Z') },
      });
      await service.create({ ...dto, email: 'won@example.test' });
      const won = await db.portfolioLead.findFirstOrThrow({
        where: { email: 'won@example.test' },
      });
      await service.update(won.id, { status: 'WON' });
      await db.portfolioLead.update({
        where: { id: won.id },
        data: { created_at: new Date('2026-03-08T09:59:59.999Z') },
      });
      expect(await service.stats()).toEqual({
        total: 2,
        new: 1,
        won: 1,
        last_7_days: 1,
        by_status: { NEW: 1, WON: 1 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('[BE-LEAD-103] {PortfolioLeadService.remove} {PortfolioLeadService.update} missing leads return 404 and preserve other records', async () => {
    await service.create(dto);
    const row = await db.portfolioLead.findFirstOrThrow();
    expect(await service.remove(row.id)).toEqual({ success: true });
    expect(await db.portfolioLead.count()).toBe(0);
    for (const action of [
      () => service.remove(row.id),
      () => service.update(row.id, { status: 'WON' }),
    ]) {
      const error = await action().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Lead not found');
      expect(await db.portfolioLead.count()).toBe(0);
    }
  });
});
