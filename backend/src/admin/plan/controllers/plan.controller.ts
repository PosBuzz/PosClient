import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlanService } from '../services/plan.service';
import { HasRoles } from 'src/decorators/set-roles.decorator';
import { Role } from 'src/auth/enums/roles.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@HasRoles([Role.SUPER_ADMIN])
@UseGuards(AdminAuthGuard, RolesGuard)
@Controller('admin/plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}
      @Post()
      create(@Body() dto: CreatePlanDto) {
        return this.planService.create(dto);
      }
    
      @Patch(':id')
      update(@Param('id') id: number, @Body() dto: UpdatePlanDto) {
        return this.planService.update(id, dto);
      }
}
