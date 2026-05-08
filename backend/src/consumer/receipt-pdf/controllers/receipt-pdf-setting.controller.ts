// receipt-pdf-setting.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReceiptPdfSettingService } from '../services/receipt-pdf-setting.service';
import { ReceiptPresetType } from '../services/receipt-pdf-settings';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@Controller('receipt-settings')
@UseGuards(ClientAuthGuard, PermissionsGuard)
export class ReceiptPdfSettingController {
  constructor(private readonly service: ReceiptPdfSettingService) {}

  // GET /receipt-settings?type=receipt&branchId=1
  @Get()
  async list(
    @Request() req: any,
    @Query('type') type?: ReceiptPresetType,
    @Query('branchId') branchId?: string,
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.listSettings(
      consumerId,
      type,
      branchId ? parseInt(branchId) : null,
    );
  }

  // GET /receipt-settings/by-type/receipt
  @Get('by-type/:type')
  async listByType(
    @Request() req: any,
    @Param('type') type: ReceiptPresetType,
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.listAllByType(consumerId, type);
  }

  // POST /receipt-settings
  @Post()
  async create(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      type: ReceiptPresetType;
      branchId?: number;
      settings: any;
      isActive?: boolean;
    },
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.createSetting({
      consumerId,
      branchId: body.branchId,
      name: body.name,
      type: body.type,
      settings: body.settings,
      isActive: body.isActive,
      createdById: req.user.id,
    });
  }

  // PUT /receipt-settings/:id
  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; settings?: any },
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.updateSetting(id, consumerId, body);
  }

  // PUT /receipt-settings/:id/activate
  @Put(':id/activate')
  async activate(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.setActive(id, consumerId);
  }

  // POST /receipt-settings/:id/copy-to-branch/:branchId
  @Post(':id/copy-to-branch/:branchId')
  async copyToBranch(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('branchId', ParseIntPipe) branchId: number,
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.copyToBranch(id, branchId, consumerId, req.user.id);
  }

  // POST /receipt-settings/reset-branch/:branchId/:type
  @Post('reset-branch/:branchId/:type')
  async resetBranch(
    @Request() req: any,
    @Param('branchId', ParseIntPipe) branchId: number,
    @Param('type') type: ReceiptPresetType,
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.resetBranchToDefault(branchId, consumerId, type);
  }

  // DELETE /receipt-settings/:id
  @Delete(':id')
  async delete(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.deleteSetting(id, consumerId);
  }
}