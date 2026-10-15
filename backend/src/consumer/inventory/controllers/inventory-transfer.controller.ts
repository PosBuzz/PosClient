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
  Res,
  BadRequestException,
} from '@nestjs/common';
import { InventoryTransferService } from '../services/inventory-transfer.service';
import { CreateInventoryTransferDto } from '../dto/create-inventory-transfer.dto';
import { InventoryQueryDto } from '../dto/inventory-query.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { Request, Response } from 'express';
import { TransferPdfService } from '../../receipt-pdf/services/transfer-pdf.service';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';

@Controller('consumer/inventory/transfers')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.inventory_transfer])
export class InventoryTransferController {
  constructor(
    private readonly inventoryTransferService: InventoryTransferService,
    private readonly transferPdfService: TransferPdfService,
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

  /** ?type=transfer_slip (default) or transfer_chalan */
  @Get(':id/pdf')
  async pdf(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Query('type') type = 'transfer_slip',
  ) {
    if (type !== 'transfer_slip' && type !== 'transfer_chalan') {
      throw new BadRequestException(`Unsupported transfer document: ${type}`);
    }
    const consumerId = Number(req.user.consumer_id);
    const transfer = await this.inventoryTransferService.findOne(
      id,
      consumerId,
    );
    const buffer = await this.transferPdfService.generateTransferPdf(
      transfer,
      consumerId,
      type,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${type}-TR-${id}.pdf"`,
    );
    return res.send(buffer);
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
