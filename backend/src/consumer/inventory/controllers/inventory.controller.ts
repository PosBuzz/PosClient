import {
  Controller,
  Get,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { InventoryService } from '../services/inventory.service';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { Request } from 'express';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';

@Controller('consumer/inventory')
@UseGuards(ClientAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @HasPermissions([ConsumerPermission.inventory_batches])
  @Get('summary')
  getSummary(@Req() req: Request, @Query('branch_id') branchId?: string) {
    return this.inventoryService.getInventorySummary(
      Number(req?.user.consumer_id),
      branchId ? Number(branchId) : undefined,
    );
  }

  @HasPermissions([ConsumerPermission.inventory_batches])
  @Get('stock-by-variant')
  getStockByVariant(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('branch_id') branchId?: string,
    @Query('search') search?: string,
    @Query('low_stock_only') lowStockOnly?: string,
  ) {
    return this.inventoryService.getStockByVariant(
      Number(req?.user.consumer_id),
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        branch_id: branchId ? Number(branchId) : undefined,
        search,
        low_stock_only: lowStockOnly === 'true',
      },
    );
  }

  @HasPermissions([ConsumerPermission.inventory_batches])
  @Get('expiring')
  getExpiringBatches(@Req() req: Request, @Query('days') days?: string) {
    return this.inventoryService.getExpiringBatches(
      Number(req?.user.consumer_id),
      days ? Number(days) : undefined,
    );
  }

  @HasPermissions([
    ConsumerPermission.inventory_batches,
    ConsumerPermission.inventory_adjustment,
  ])
  @Get('products')
  getProductsForInventory(@Req() req: Request) {
    return this.inventoryService.getProductsForInventory(
      Number(req?.user.consumer_id),
    );
  }

  @HasPermissions([ConsumerPermission.inventory_batches])
  @Get('products/:productId/variants')
  getProductVariants(@Param('productId', ParseIntPipe) productId: number) {
    return this.inventoryService.getProductVariants(productId);
  }

  @HasPermissions([ConsumerPermission.inventory_batches])
  @Get('variants/:variantId/stock')
  getVariantStock(
    @Req() req: Request,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Query('branch_id') branchId?: string,
  ) {
    return this.inventoryService.getVariantStock(
      variantId,
      Number(req?.user.consumer_id),
      branchId ? Number(branchId) : undefined,
    );
  }

  @HasPermissions([ConsumerPermission.inventory_batches])
  @Get('low-stock')
  getLowStockItems(@Req() req: Request, @Query('branch_id') branchId?: string) {
    return this.inventoryService.getLowStockItems(
      Number(req?.user.consumer_id),
      branchId ? Number(branchId) : undefined,
    );
  }

  @Get('movement-history/:variantId')
  getInventoryMovementHistory(
    @Req() req: Request,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.inventoryService.getInventoryMovementHistory(
      variantId,
      Number(req?.user.consumer_id),
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        branch_id: branchId ? Number(branchId) : undefined,
      },
    );
  }
}
