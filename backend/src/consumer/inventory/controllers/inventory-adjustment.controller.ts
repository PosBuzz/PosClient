import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { InventoryAdjustmentService } from '../services/inventory-adjustment.service';
import { CreateInventoryAdjustmentDto } from '../dto/inventory-adjustment.dto';
import { InventoryQueryDto } from '../dto/inventory-query.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { Request } from 'express';

@Controller('consumer/inventory/adjustments')
@UseGuards(ClientAuthGuard)
export class InventoryAdjustmentController {
  constructor(private readonly inventoryAdjustmentService: InventoryAdjustmentService) {}

  @Post()
  create(@Req() req: Request, @Body() createInventoryAdjustmentDto: CreateInventoryAdjustmentDto) {
    return this.inventoryAdjustmentService.create(
      Number(req?.user.consumer_id),
      Number(req?.user.id),
      createInventoryAdjustmentDto,
    );
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: InventoryQueryDto) {
    return this.inventoryAdjustmentService.findAll(Number(req?.user.consumer_id), query);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryAdjustmentService.findOne(id, Number(req?.user.consumer_id));
  }
}