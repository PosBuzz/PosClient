import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { PlanService } from '../services/plan.service';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';

@HasPermissions([AdminPermission.plans])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}
  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.planService.create(dto);
  }

  @Patch(':id')
  update(@Param('id',ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.planService.update(id, dto);
  }
}
