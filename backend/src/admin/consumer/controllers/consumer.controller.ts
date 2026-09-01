import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';
import { ConsumerService } from '../services/consumer.service';
import { ConsumerPurgeService } from '../services/consumer-purge.service';
import { ConsumerDataImportService } from '../services/consumer-data-import.service';
import {
  PreviewConsumerDataImportDto,
  RunConsumerDataImportDto,
} from '../dto/consumer-data-import.dto';

@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/consumers')
export class ConsumerController {
  constructor(
    private readonly consumerService: ConsumerService,
    private readonly consumerPurgeService: ConsumerPurgeService,
    private readonly consumerDataImportService: ConsumerDataImportService,
  ) {}

  @HasPermissions([AdminPermission.show_consumers])
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('plan_id') planId?: string,
    @Query('status') status?: 'active' | 'inactive',
    @Query('deleted') deleted?: string,
  ) {
    return this.consumerService.findAll({
      search,
      planId: planId ? Number(planId) : undefined,
      status,
      deleted: deleted === 'true',
    });
  }

  @HasPermissions([AdminPermission.add_consumers])
  @Post()
  create(@Body() dto: CreateConsumerDto) {
    return this.consumerService.create(dto);
  }

  @HasPermissions([AdminPermission.modify_consumers])
  @Get('data-imports')
  importHistory(@Query('limit') limit?: string) {
    return this.consumerDataImportService.history(
      limit ? Number(limit) : undefined,
    );
  }

  @HasPermissions([AdminPermission.modify_consumers])
  @Post('data-imports/preview')
  previewImport(@Body() dto: PreviewConsumerDataImportDto) {
    return this.consumerDataImportService.preview(dto);
  }

  @HasPermissions([AdminPermission.modify_consumers])
  @Post('data-imports')
  runImport(@Body() dto: RunConsumerDataImportDto, @Req() req: any) {
    return this.consumerDataImportService.run(dto, req?.user?.id);
  }

  @HasPermissions([AdminPermission.delete_consumers])
  @Delete(':id')
  softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.consumerService.softDelete(id, req?.user?.id, reason);
  }

  @HasPermissions([AdminPermission.delete_consumers])
  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.consumerService.restore(id);
  }

  @HasPermissions([AdminPermission.modify_consumers])
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConsumerDto,
  ) {
    return this.consumerService.update(id, dto);
  }

  @Get('check-subdomain')
  async checkSubdomain(@Query('value') value: string) {
    return this.consumerService.checkSubdomain(value);
  }

  /**
   * Permanently erases a tenant and all of its data. Irreversible — the caller
   * must echo back the subdomain so a mistyped id cannot destroy the wrong
   * tenant. Works on any consumer; it does not require a soft delete first.
   */
  @HasPermissions([AdminPermission.delete_consumers])
  @Delete(':id/purge')
  purge(
    @Param('id', ParseIntPipe) id: number,
    @Body('confirm_subdomain') confirmSubdomain: string,
  ) {
    return this.consumerPurgeService.purge(id, confirmSubdomain);
  }
}
