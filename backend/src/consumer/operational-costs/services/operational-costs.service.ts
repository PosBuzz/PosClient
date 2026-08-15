import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateOperationalCostDto,
  OperationalCostQueryDto,
  UpdateOperationalCostDto,
} from '../dto/operational-cost.dto';

@Injectable()
export class OperationalCostsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll(consumerId: number, query: OperationalCostQueryDto) {
    return this.prisma.operationalCost.findMany({
      where: {
        consumer_id: consumerId,
        ...(query.branch_id ? { branch_id: query.branch_id } : {}),
        ...(query.from || query.to
          ? {
              incurred_on: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: [{ incurred_on: 'desc' }, { id: 'desc' }],
    });
  }
  async create(
    consumerId: number,
    userId: number,
    dto: CreateOperationalCostDto,
  ) {
    await this.assertBranch(dto.branch_id, consumerId);
    return this.prisma.operationalCost.create({
      data: {
        consumer_id: consumerId,
        created_by: userId,
        name: dto.name.trim(),
        amount: dto.amount,
        incurred_on: new Date(dto.incurred_on),
        branch_id: dto.branch_id,
        notes: dto.notes?.trim() || null,
      },
    });
  }
  async update(id: number, consumerId: number, dto: UpdateOperationalCostDto) {
    await this.assertExists(id, consumerId);
    await this.assertBranch(dto.branch_id, consumerId);
    return this.prisma.operationalCost.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        amount: dto.amount,
        incurred_on: new Date(dto.incurred_on),
        branch_id: dto.branch_id ?? null,
        notes: dto.notes?.trim() || null,
      },
    });
  }
  async remove(id: number, consumerId: number) {
    await this.assertExists(id, consumerId);
    await this.prisma.operationalCost.delete({ where: { id } });
    return { success: true };
  }
  private async assertExists(id: number, consumerId: number) {
    const cost = await this.prisma.operationalCost.findFirst({
      where: { id, consumer_id: consumerId },
      select: { id: true },
    });
    if (!cost) throw new NotFoundException('Operational cost not found');
  }
  private async assertBranch(branchId: number | undefined, consumerId: number) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, consumer_id: consumerId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }
}
