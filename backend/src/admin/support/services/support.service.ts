import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupportAuthorType, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AdminSupportQueryDto,
  AdminSupportReplyDto,
  UpdateSupportTicketDto,
} from '../dto/support.dto';

const messageSelect = {
  id: true,
  body: true,
  author_type: true,
  created_at: true,
  consumer_user: { select: { id: true, name: true } },
  super_admin: { select: { id: true, name: true } },
} satisfies Prisma.SupportTicketMessageSelect;

const CLOSED_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.RESOLVED,
  SupportTicketStatus.CLOSED,
];

@Injectable()
export class AdminSupportService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: AdminSupportQueryDto) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.consumer_id ? { consumer_id: query.consumer_id } : {}),
        ...(query.assigned_to_id
          ? { assigned_to_id: query.assigned_to_id }
          : {}),
        ...(query.search
          ? { subject: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: {
        consumer: { select: { id: true, company_name: true, subdomain: true } },
        created_by: { select: { id: true, name: true, email: true } },
        assigned_to: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ last_reply_at: 'desc' }, { id: 'desc' }],
    });
  }

  async stats() {
    const grouped = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ) as Record<SupportTicketStatus, number | undefined>;

    const open =
      (byStatus.OPEN || 0) +
      (byStatus.IN_PROGRESS || 0) +
      (byStatus.WAITING_ON_CUSTOMER || 0);

    return {
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
      open,
      unassigned: await this.prisma.supportTicket.count({
        where: { assigned_to_id: null, status: { notIn: CLOSED_STATUSES } },
      }),
      urgent: await this.prisma.supportTicket.count({
        where: { priority: 'URGENT', status: { notIn: CLOSED_STATUSES } },
      }),
      by_status: byStatus,
    };
  }

  async findOne(id: number) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
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
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async reply(id: number, superAdminId: number, dto: AdminSupportReplyDto) {
    const ticket = await this.assertExists(id);
    const status = dto.status ?? SupportTicketStatus.WAITING_ON_CUSTOMER;

    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: {
          ticket_id: id,
          author_type: SupportAuthorType.SUPER_ADMIN,
          super_admin_id: superAdminId,
          body: dto.body.trim(),
        },
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: {
          last_reply_at: new Date(),
          status,
          closed_at: CLOSED_STATUSES.includes(status) ? new Date() : null,
          // First responder takes ownership; an existing assignee is kept.
          ...(ticket.assigned_to_id ? {} : { assigned_to_id: superAdminId }),
        },
      }),
    ]);

    return this.findOne(id);
  }

  async update(id: number, dto: UpdateSupportTicketDto) {
    await this.assertExists(id);
    if (dto.assigned_to_id) {
      const admin = await this.prisma.superAdmin.findUnique({
        where: { id: dto.assigned_to_id },
        select: { id: true },
      });
      if (!admin) throw new BadRequestException('Assignee not found');
    }

    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.assigned_to_id !== undefined
          ? { assigned_to_id: dto.assigned_to_id ?? null }
          : {}),
        ...(dto.status
          ? {
              closed_at: CLOSED_STATUSES.includes(dto.status)
                ? new Date()
                : null,
            }
          : {}),
      },
    });

    return this.findOne(id);
  }

  private async assertExists(id: number) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, assigned_to_id: true },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }
}
