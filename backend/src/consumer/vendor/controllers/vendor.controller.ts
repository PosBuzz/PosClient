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
import { VendorService } from '../services/vendor.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer/vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @HasPermissions([ConsumerPermission.add_purchase, ConsumerPermission.edit_purchase])
  @Post()
  async create(@Body() createVendorDto: CreateVendorDto, @Req() req: Request) {
    return this.vendorService.create(createVendorDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_purchase, ConsumerPermission.add_purchase, ConsumerPermission.edit_purchase])
  @Get()
  async findAll(@Req() req: Request) {
    return this.vendorService.findAll(req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_purchase])
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.vendorService.findOne(+id, req.user.id);
  }

  @HasPermissions([ConsumerPermission.edit_purchase])
  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateVendorDto: UpdateVendorDto,
    @Req() req: Request
  ) {
    return this.vendorService.update(+id, updateVendorDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.delete_purchase])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.vendorService.remove(+id, req.user.id);
  }
}