import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/auth/enums/roles.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { HasRoles } from 'src/decorators/set-roles.decorator';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';
import { ConsumerService } from '../services/consumer.service';

@HasRoles([Role.SUPER_ADMIN])
@UseGuards(AdminAuthGuard, RolesGuard)
@Controller('admin/consumers')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post()
  create(@Body() dto: CreateConsumerDto) {
    return this.consumerService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateConsumerDto) {
    return this.consumerService.update(id, dto);
  }
}
