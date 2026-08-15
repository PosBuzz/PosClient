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
  Query,
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
@HasPermissions([
  ConsumerPermission.vendors,
  ConsumerPermission.inventory_batches,
])
@Controller('consumer/vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  async create(@Body() createVendorDto: CreateVendorDto, @Req() req: Request) {
    return this.vendorService.create(
      createVendorDto,
      Number(req.user.consumer_id),
    );
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.vendorService.findAll(Number(req.user.consumer_id));
  }

  @Get(':id/details')
  async findOneWithDetails(
    @Param('id') id: string,
    @Query() query: { page?: number; limit?: number },
    @Req() req: Request,
  ) {
    return this.vendorService.findOneWithDetails(
      +id,
      Number(req.user.consumer_id),
      query,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.vendorService.findOne(+id, Number(req.user.consumer_id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
    @Req() req: Request,
  ) {
    return this.vendorService.update(
      +id,
      updateVendorDto,
      Number(req.user.consumer_id),
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.vendorService.remove(+id, Number(req.user.consumer_id));
  }
}
