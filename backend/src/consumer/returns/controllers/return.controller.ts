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
  Res,
} from '@nestjs/common';
import { ReturnService } from '../services/return.service';
import { CreateReturnDto } from '../dto/create-return.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request, Response } from 'express';
import { ReturnPdfService } from 'src/consumer/receipt-pdf/services/return-pdf.service';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/returns')
export class ReturnController {
  constructor(
    private readonly returnService: ReturnService,
    private readonly returnPdfService: ReturnPdfService,
  ) {}

  @Post()
  async create(@Body() createReturnDto: CreateReturnDto, @Req() req: Request) {
    return this.returnService.create(
      req.user.consumer_id!,
      req.user.id,
      createReturnDto,
    );
  }

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('branch_id') branchId?: string,
    @Query('original_sale_id') originalSaleId?: string,
  ) {
    return this.returnService.findAll(req.user.consumer_id!, {
      page: parseInt(page),
      limit: parseInt(limit),
      branch_id: branchId ? parseInt(branchId) : undefined,
      original_sale_id: originalSaleId ? parseInt(originalSaleId) : undefined,
    });
  }

  @Get(':id/pdf')
  async generateReceiptPdfGet(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const returnData = await this.returnService.findOne(
      id,
      req.user.consumer_id!,
    );

    if (!returnData) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const pdfBuffer =
      await this.returnPdfService.generateReturnReceiptPdf(returnData);

    const returnNumber = (returnData as any).return_number || 'unknown';
    const filename = `receipt-${returnNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    res.send(pdfBuffer);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.returnService.findOne(id, req.user.consumer_id!);
  }
}
