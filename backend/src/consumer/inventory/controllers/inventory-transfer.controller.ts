import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { InventoryTransferService } from '../services/inventory-transfer.service';
import { CreateInventoryTransferDto } from '../dto/create-inventory-transfer.dto';
import { InventoryQueryDto } from '../dto/inventory-query.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { Request } from 'express';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';

@Controller('consumer/inventory/transfers')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.inventory_transfer])
export class InventoryTransferController {
  constructor(
    private readonly inventoryTransferService: InventoryTransferService,
  ) {}

  @Post()
  create(
    @Req() req: Request,
    @Body() createInventoryTransferDto: CreateInventoryTransferDto,
  ) {
    return this.inventoryTransferService.create(
      Number(req?.user.consumer_id),
      Number(req?.user.id),
      createInventoryTransferDto,
    );
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: InventoryQueryDto) {
    return this.inventoryTransferService.findAll(
      Number(req?.user.consumer_id),
      query,
    );
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryTransferService.findOne(
      id,
      Number(req?.user.consumer_id),
    );
  }

  @Patch(':id/complete')
  completeTransfer(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryTransferService.completeTransfer(
      id,
      Number(req?.user.consumer_id),
    );
  }

  @Patch(':id/cancel')
  cancelTransfer(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryTransferService.cancelTransfer(
      id,
      Number(req?.user.consumer_id),
    );
  }
}
