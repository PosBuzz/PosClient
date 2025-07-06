import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { SalesService } from '../services/sales.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { SaleListFiltersDto } from '../dto/sale-list-filters.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  async create(@Body() createSaleDto: CreateSaleDto, @Req() req: Request) {
    return this.salesService.create(
      createSaleDto,
      req.user.consumer_id!,
      req.user.id,
    );
  }

  @Get()
  async findAll(
    @Query() filters: SaleListFiltersDto,
    @Req() req: Request,
  ) {
    return this.salesService.findAll(filters, req.user.consumer_id!);
  }

  @Get('stats')
  async getStats(
    @Query('branch_id', ParseIntPipe) branchId: number,
    @Req() req: Request,
  ) {
    return this.salesService.getSalesStats(req.user.consumer_id!, branchId);
  }

  @Get('products')
  async getProductsForSale(
    @Query('branch_id', ParseIntPipe) branchId: number,
    @Query('search') search: string,
    @Req() req: Request,
  ) {
    return this.salesService.getProductsForSale(
      req.user.consumer_id!,
      branchId,
      search,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.salesService.findOne(id, req.user.consumer_id!);
  }
}
