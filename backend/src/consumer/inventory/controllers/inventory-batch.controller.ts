import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { InventoryBatchService } from '../services/inventory-batch.service';
import { CreateInventoryBatchDto } from '../dto/create-inventory-batch.dto';
import { UpdateInventoryBatchDto } from '../dto/update-inventory-batch.dto';
import { InventoryQueryDto } from '../dto/inventory-query.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { Request } from 'express';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@Controller('consumer/inventory/batches')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.inventory_batches])
export class InventoryBatchController {
  constructor(private readonly inventoryBatchService: InventoryBatchService) {}

  @Post()
  create(
    @Req() req: Request,
    @Body() createInventoryBatchDto: CreateInventoryBatchDto,
  ) {
    return this.inventoryBatchService.create(
      Number(req?.user.consumer_id),
      createInventoryBatchDto,
    );
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: InventoryQueryDto) {
    return this.inventoryBatchService.findAll(
      Number(req?.user.consumer_id),
      query,
    );
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryBatchService.findOne(
      id,
      Number(req?.user.consumer_id),
    );
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryBatchDto: UpdateInventoryBatchDto,
  ) {
    return this.inventoryBatchService.update(
      id,
      Number(req?.user.consumer_id),
      updateInventoryBatchDto,
    );
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryBatchService.remove(id, Number(req?.user.consumer_id));
  }
}
