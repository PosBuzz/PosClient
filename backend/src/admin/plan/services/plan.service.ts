import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePlanDto) {
    return await this.prisma.plan.create({
      data: {
        name: data.name,
        price: data.price,
        permissions: {
          create: data.permission_ids.map((permission_id) => ({
            permission: { connect: { id: permission_id } },
          })),
        },
      },
    });
  }

  async update(planId: number, data: UpdatePlanDto) {
    const { permission_ids, ...rest } = data;

    // If permissions are provided, update them along with name/price
    if (permission_ids?.length) {
      await this.prisma.planPermission.deleteMany({
        where: { plan_id: planId },
      });

      return await this.prisma.plan.update({
        where: { id: planId },
        data: {
          ...rest,
          permissions: {
            create: permission_ids.map((permission_id) => ({
              permission: { connect: { id: permission_id } },
            })),
          },
        },
      });
    }

    // If no permissions are provided, only update the plan basic info
    return await this.prisma.plan.update({
      where: { id: planId },
      data: { ...rest },
    });
  }
}
