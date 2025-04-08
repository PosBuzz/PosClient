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
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { CreateConsumerDto } from '../../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../../dto/update-consumer.dto';
import { ConsumerService } from '../../services/consumer/consumer.service';
import { HasRoles } from 'src/decorators/set-roles.decorator';
import { Role } from 'src/enums/roles.enum';

@UseGuards(AuthGuard, RolesGuard)
@HasRoles([Role.SUPER_ADMIN])
@Controller('admin/consumers')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post()
  create(@Body() dto: CreateConsumerDto) {
    return this.consumerService.create(dto);
  }

  @Get()
  findAll() {
    return this.consumerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consumerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConsumerDto) {
    return this.consumerService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.consumerService.remove(id);
  }
}
