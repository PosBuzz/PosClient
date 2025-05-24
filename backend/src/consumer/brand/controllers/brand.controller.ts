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
import { BrandService } from '../services/brand.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer/brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @HasPermissions([ConsumerPermission.add_product, ConsumerPermission.edit_product])
  @Post()
  async create(@Body() createBrandDto: CreateBrandDto, @Req() req: Request) {
    return this.brandService.create(createBrandDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_product, ConsumerPermission.add_product, ConsumerPermission.edit_product])
  @Get()
  async findAll(@Req() req: Request) {
    return this.brandService.findAll(req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_product])
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.brandService.findOne(+id, req.user.id);
  }

  @HasPermissions([ConsumerPermission.edit_product])
  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateBrandDto: UpdateBrandDto,
    @Req() req: Request
  ) {
    return this.brandService.update(+id, updateBrandDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.delete_product])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.brandService.remove(+id, req.user.id);
  }
}