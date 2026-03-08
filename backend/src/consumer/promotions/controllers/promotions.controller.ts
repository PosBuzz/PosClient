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
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { PromotionSalesFiltersDto } from '../dto/promotion-sales-filters.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';
import { ValidatePromotionDto } from '../dto/validate-promotion.dto';
import { PromotionsService } from '../services/promotions.service';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  async create(@Body() dto: CreatePromotionDto, @Req() req: Request) {
    return this.promotionsService.create(dto, req.user.consumer_id!, req.user.id);
  }

  @Get('options')
  async getOptions(@Req() req: Request) {
    return this.promotionsService.getOptions(req.user.consumer_id!);
  }

  @Get('active/list')
  async getActive(
    @Query('branch_id') branchId?: string,
    @Req() req?: Request,
  ) {
    const parsedBranchId = branchId ? parseInt(branchId, 10) : undefined;
    return this.promotionsService.findActive(req!.user.consumer_id!, parsedBranchId);
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.promotionsService.findAll(req.user.consumer_id!);
  }

  @Post(':id/validate-cart')
  async validateCart(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ValidatePromotionDto,
    @Req() req: Request,
  ) {
    return this.promotionsService.validateCart(id, payload, req.user.consumer_id!);
  }

  @Get(':id/sales')
  async getPromotionSales(
    @Param('id', ParseIntPipe) id: number,
    @Query() filters: PromotionSalesFiltersDto,
    @Req() req: Request,
  ) {
    return this.promotionsService.getPromotionSales(
      id,
      filters,
      req.user.consumer_id!,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.promotionsService.findOne(id, req.user.consumer_id!);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromotionDto,
    @Req() req: Request,
  ) {
    return this.promotionsService.update(id, dto, req.user.consumer_id!);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.promotionsService.remove(id, req.user.consumer_id!);
  }
}
