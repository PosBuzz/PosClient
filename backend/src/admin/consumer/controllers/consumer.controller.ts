import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/auth/enums/roles.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';
import { ConsumerService } from '../services/consumer.service';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';

@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/consumers')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @HasPermissions([AdminPermission.add_consumers])
  @Post()
  create(@Body() dto: CreateConsumerDto) {
    return this.consumerService.create(dto);
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
}
