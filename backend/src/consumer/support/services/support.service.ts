import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupportAuthorType, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AddSupportMessageDto,
  CreateSupportTicketDto,
  SupportTicketQueryDto,
} from '../dto/support-ticket.dto';

const messageSelect = {
  id: true,
  body: true,
  author_type: true,
  created_at: true,
  consumer_user: { select: { id: true, name: true } },
  super_admin: { select: { id: true, name: true } },
} satisfies Prisma.SupportTicketMessageSelect;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(consumerId: number, query: SupportTicketQueryDto) {
    return this.prisma.supportTicket.findMany({
      where: {
        consumer_id: consumerId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? { subject: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: {
        created_by: { select: { id: true, name: true } },
        assigned_to: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ last_reply_at: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number, consumerId: number) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, consumer_id: consumerId },
      include: {
        created_by: { select: { id: true, name: true } },
        assigned_to: { select: { id: true, name: true } },
        messages: { select: messageSelect, orderBy: { created_at: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  create(consumerId: number, userId: number, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        consumer_id: consumerId,
        created_by_id: userId,
        subject: dto.subject.trim(),
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        messages: {
          create: {
            author_type: SupportAuthorType.CONSUMER,
            consumer_user_id: userId,
            body: dto.message.trim(),
          },
        },
      },
      include: {
        messages: { select: messageSelect, orderBy: { created_at: 'asc' } },
      },
    });
  }

  async addMessage(
    id: number,
    consumerId: number,
    userId: number,
    dto: AddSupportMessageDto,
  ) {
    const ticket = await this.assertExists(id, consumerId);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: {
          ticket_id: id,
          author_type: SupportAuthorType.CONSUMER,
          consumer_user_id: userId,
          body: dto.body.trim(),
        },
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: {
          last_reply_at: now,
          // A customer reply always puts the ticket back in the support queue.
          status:
            ticket.status === SupportTicketStatus.IN_PROGRESS
              ? SupportTicketStatus.IN_PROGRESS
              : SupportTicketStatus.OPEN,
          closed_at: null,
        },
      }),
    ]);

    return this.findOne(id, consumerId);
  }

  async close(id: number, consumerId: number) {
    await this.assertExists(id, consumerId);
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: SupportTicketStatus.CLOSED, closed_at: new Date() },
    });
    return this.findOne(id, consumerId);
  }

  async reopen(id: number, consumerId: number) {
    await this.assertExists(id, consumerId);
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.OPEN,
        closed_at: null,
        last_reply_at: new Date(),
      },
    });
    return this.findOne(id, consumerId);
  }

  private async assertExists(id: number, consumerId: number) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, consumer_id: consumerId },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }
}
