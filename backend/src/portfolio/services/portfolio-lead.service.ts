import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PortfolioLeadStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreatePortfolioLeadDto,
  PortfolioLeadQueryDto,
  UpdatePortfolioLeadDto,
} from '../dto/portfolio-lead.dto';

@Injectable()
export class PortfolioLeadService {
  private readonly logger = new Logger(PortfolioLeadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePortfolioLeadDto) {
    // Honeypot hit: accept the request so the bot sees success, store nothing.
    if (dto.company_website) {
      this.logger.warn(`Discarded honeypot lead from ${dto.email}`);
      return { success: true };
    }

    await this.prisma.portfolioLead.create({
      data: {
        type: dto.type,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        business_name: dto.business_name?.trim() || null,
        industry: dto.industry?.trim() || null,
        locations: dto.locations?.trim() || null,
        message: dto.message?.trim() || null,
        source_page: dto.source_page?.trim() || null,
      },
    });

    return { success: true };
  }

  findAll(query: PortfolioLeadQueryDto) {
    return this.prisma.portfolioLead.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                {
                  business_name: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { created_at: 'desc' },
      take: query.take && query.take > 0 ? Math.min(query.take, 500) : 200,
    });
  }

  async stats() {
    const grouped = await this.prisma.portfolioLead.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ) as Record<PortfolioLeadStatus, number | undefined>;

    const since = new Date();
    since.setDate(since.getDate() - 7);

    return {
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
      new: byStatus.NEW || 0,
      won: byStatus.WON || 0,
      last_7_days: await this.prisma.portfolioLead.count({
        where: { created_at: { gte: since } },
      }),
      by_status: byStatus,
    };
  }

  async update(id: number, dto: UpdatePortfolioLeadDto) {
    const lead = await this.prisma.portfolioLead.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.portfolioLead.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
  }

  async remove(id: number) {
    const lead = await this.prisma.portfolioLead.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.portfolioLead.delete({ where: { id } });
    return { success: true };
  }
}
