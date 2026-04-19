import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { DashboardAnalyticsDto } from '../dto/dashboard-analytics.dto';
import { DashboardService } from '../services/dashboard.service';

@Controller('consumer/dashboard')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('analytics')
  async getAnalytics(
    @Query() query: DashboardAnalyticsDto,
    @Req() req: Request,
  ) {
    return this.dashboardService.getAnalytics(req.user.consumer_id!, query);
  }
}
