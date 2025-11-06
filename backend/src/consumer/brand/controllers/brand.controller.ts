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
@HasPermissions([
  ConsumerPermission.view_product,
  ConsumerPermission.add_product,
  ConsumerPermission.edit_product,
  ConsumerPermission.delete_product,
])
@Controller('consumer/brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  async create(@Body() createBrandDto: CreateBrandDto, @Req() req: Request) {
    return this.brandService.create(createBrandDto, Number(req.user.consumer_id));
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.brandService.findAll(Number(req.user.consumer_id));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.brandService.findOne(+id, Number(req.user.consumer_id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
    @Req() req: Request,
  ) {
    return this.brandService.update(+id, updateBrandDto, Number(req.user.consumer_id));
  }

  @HasPermissions([ConsumerPermission.delete_product])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.brandService.remove(+id, Number(req.user.consumer_id));
  }
}
