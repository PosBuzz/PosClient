import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import {
  CreateOperationalCostDto,
  OperationalCostQueryDto,
  UpdateOperationalCostDto,
} from '../dto/operational-cost.dto';
import { OperationalCostsService } from '../services/operational-costs.service';

@Controller('consumer/operational-costs')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.business_insights])
export class OperationalCostsController {
  constructor(private readonly service: OperationalCostsService) {}
  @Get() findAll(@Query() query: OperationalCostQueryDto, @Req() req: Request) {
    return this.service.findAll(req.user.consumer_id!, query);
  }
  @Post() create(@Body() dto: CreateOperationalCostDto, @Req() req: Request) {
    return this.service.create(req.user.consumer_id!, req.user.id, dto);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateOperationalCostDto,
    @Req() req: Request,
  ) {
    return this.service.update(+id, req.user.consumer_id!, dto);
  }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: Request) {
    return this.service.remove(+id, req.user.consumer_id!);
  }
}
