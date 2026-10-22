import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { DeliveryPartnersService } from '../services/delivery-partners.service';
import {
  CreateDeliveryPartnerDto,
  UpdateDeliveryPartnerDto,
} from '../dto/delivery-partner.dto';
import {
  CreateAdjustmentDto,
  CreateSettlementDto,
  PartnerListQueryDto,
  PartnerOrdersQueryDto,
  VoidSettlementDto,
} from '../dto/settlement.dto';

// Online orders live under sales, so do their delivery partners
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/delivery-partners')
export class DeliveryPartnersController {
  constructor(private readonly service: DeliveryPartnersService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(req.user.consumer_id!);
  }

  @Post()
  create(@Body() dto: CreateDeliveryPartnerDto, @Req() req: Request) {
    return this.service.create(dto, req.user.consumer_id!);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.findOne(id, req.user.consumer_id!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryPartnerDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, req.user.consumer_id!);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.remove(id, req.user.consumer_id!);
  }

  @Get(':id/summary')
  summary(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.getSummary(id, req.user.consumer_id!);
  }

  @Get(':id/ledger')
  ledger(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PartnerListQueryDto,
    @Req() req: Request,
  ) {
    return this.service.getLedger(id, req.user.consumer_id!, query);
  }

  @Get(':id/orders')
  orders(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PartnerOrdersQueryDto,
    @Req() req: Request,
  ) {
    return this.service.getOrders(id, req.user.consumer_id!, query);
  }

  @Get(':id/settlements')
  settlements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PartnerListQueryDto,
    @Req() req: Request,
  ) {
    return this.service.getSettlements(id, req.user.consumer_id!, query);
  }

  @Post(':id/settlements')
  createSettlement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSettlementDto,
    @Req() req: Request,
  ) {
    return this.service.createSettlement(
      id,
      req.user.consumer_id!,
      req.user.id,
      dto,
    );
  }

  @Post(':id/settlements/:settlementId/void')
  voidSettlement(
    @Param('id', ParseIntPipe) id: number,
    @Param('settlementId', ParseIntPipe) settlementId: number,
    @Body() dto: VoidSettlementDto,
    @Req() req: Request,
  ) {
    return this.service.voidSettlement(
      id,
      settlementId,
      req.user.consumer_id!,
      req.user.id,
      dto,
    );
  }

  @Post(':id/adjustments')
  createAdjustment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAdjustmentDto,
    @Req() req: Request,
  ) {
    return this.service.createAdjustment(
      id,
      req.user.consumer_id!,
      req.user.id,
      dto,
    );
  }
}
