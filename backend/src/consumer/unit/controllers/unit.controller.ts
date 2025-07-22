import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UnitService } from '../services/unit.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([
  ConsumerPermission.view_product,
  ConsumerPermission.add_product,
  ConsumerPermission.edit_product,
  ConsumerPermission.delete_product,
])
@Controller('consumer/units')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Post()
  async create(@Body() createUnitDto: CreateUnitDto, @Req() req: Request) {
    return this.unitService.create(createUnitDto, req.user.consumer_id!);
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.unitService.findAll(req.user.consumer_id!);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.unitService.findOne(+id, req.user.consumer_id!);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @Req() req: Request,
  ) {
    return this.unitService.update(+id, updateUnitDto, req.user.consumer_id!);
  }

  @HasPermissions([ConsumerPermission.delete_product])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.unitService.remove(+id, req.user.consumer_id!);
  }
}
