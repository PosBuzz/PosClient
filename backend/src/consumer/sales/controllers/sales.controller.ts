import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import {
  RECEIPT_PRESET_TYPES,
  ReceiptPresetType,
} from '../../receipt-pdf/preset/receipt-pdf-settings';
import { SalesPdfService } from '../../receipt-pdf/services/sales-pdf.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { DailyTargetReportDto } from '../dto/daily-target-report.dto';
import { EODReportDto } from '../dto/eod-report.dto';
import { GetUserSalesDetailDto } from '../dto/get-user-sales-detail.dto';
import { GetVariantSalesStatsDto } from '../dto/get-variant-sales-stats.dto';
import { SaleListFiltersDto } from '../dto/sale-list-filters.dto';
import { UpdateOnlineOrderStatusDto } from '../dto/update-online-order-status.dto';
import { UpdateSaleNoteDto } from '../dto/update-sale-note.dto';
import { DeleteSaleDto } from '../dto/delete-sale.dto';
import { SalesService } from '../services/sales.service';
import { QuotationPdfService } from 'src/consumer/receipt-pdf/services/quotation-pdf.service';
import { BusinessReportPdfService } from '../services/business-report-pdf.service';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly salesPdfService: SalesPdfService,
    private readonly quotationPdfService: QuotationPdfService,
    private readonly businessReportPdfService: BusinessReportPdfService,
  ) {}

  @Post()
  async create(@Body() createSaleDto: CreateSaleDto, @Req() req: Request) {
    return this.salesService.create(
      createSaleDto,
      req.user.consumer_id!,
      req.user.id,
    );
  }

  @Get()
  async findAll(@Query() filters: SaleListFiltersDto, @Req() req: Request) {
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

  @Get('product-by-barcode')
  async getProductByBarcode(
    @Query('branch_id', ParseIntPipe) branchId: number,
    @Query('barcode') barcode: string,
    @Req() req: Request,
  ) {
    if (!barcode) {
      throw new BadRequestException('Barcode is required');
    }

    const product = await this.salesService.getProductByBarcode(
      req.user.consumer_id!,
      branchId,
      barcode,
    );

    if (!product) {
      throw new NotFoundException('Product not found for this barcode');
    }

    return product;
  }

  @Get('reports/eod')
  @HasPermissions([ConsumerPermission.business_insights])
  async getEODReport(@Query() eodDto: EODReportDto, @Req() req: Request) {
    return this.salesService.getEODReport(req.user.consumer_id!, eodDto);
  }

  @Get('reports/business/pdf')
  @HasPermissions([ConsumerPermission.business_insights])
  async getBusinessReportPdf(
    @Query() reportDto: EODReportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const report = await this.salesService.getEODReport(
      req.user.consumer_id!,
      reportDto,
    );
    const pdf = await this.businessReportPdfService.generate(
      req.user.consumer_id!,
      reportDto,
      report,
    );
    const suffix =
      report.period === 'all'
        ? `till-${report.period_end}`
        : `${report.period}-${report.period_start}`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="business-report-${suffix}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('reports/daily-target')
  @HasPermissions([ConsumerPermission.business_insights])
  async getDailyTargetReport(
    @Query() dailyTargetDto: DailyTargetReportDto,
    @Req() req: Request,
  ) {
    return this.salesService.getDailyTargetReport(
      req.user.consumer_id!,
      dailyTargetDto,
    );
  }

  @Get('receipt/:id')
  async generateReceiptPdfGet(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
    @Query('type') type?: string,
  ) {
    const sale = await this.salesService.findOne(id, req.user.consumer_id!);

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Chalan / money receipt / delivery slip are the same sale printed with a
    // different preset; without ?type the sale's own type decides as before.
    let presetType: ReceiptPresetType | undefined;
    if (type) {
      if (!(RECEIPT_PRESET_TYPES as readonly string[]).includes(type)) {
        return res
          .status(400)
          .json({ message: `Unsupported receipt type: ${type}` });
      }
      presetType = type as ReceiptPresetType;
    }

    const pdfBuffer = await this.salesPdfService.generateSaleReceiptPdf(
      sale,
      undefined,
      undefined,
      presetType,
    );

    const saleNumber = (sale as any).sale_number || 'unknown';
    const filename = `${presetType ?? 'receipt'}-${saleNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    res.send(pdfBuffer);
  }

  @Get('receipt/:id/payment/:paymentId')
  async generatePaymentReceiptPdf(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sale = await this.salesService.findOne(id, req.user.consumer_id!);

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const pdfBuffer = await this.salesPdfService.generatePaymentReceiptPdf(
      sale,
      paymentId,
    );

    const saleNumber = (sale as any).sale_number || 'unknown';
    const filename = `money-receipt-${saleNumber}-${paymentId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    res.send(pdfBuffer);
  }

  @Get('search/:saleNumber')
  async findBySaleNumber(
    @Param('saleNumber') saleNumber: string,
    @Req() req: Request,
  ) {
    return this.salesService.findBySaleNumber(
      saleNumber,
      req.user.consumer_id!,
    );
  }

  @HasPermissions([ConsumerPermission.quotations])
  @Get('quotations/list')
  async findAllQuotations(
    @Query() filters: SaleListFiltersDto,
    @Req() req: Request,
  ) {
    return this.salesService.findAllQuotations(filters, req.user.consumer_id!);
  }

  @HasPermissions([ConsumerPermission.quotations])
  @Get('quotations/:id')
  async findOneQuotation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.salesService.findOneQuotation(id, req.user.consumer_id!);
  }

  @HasPermissions([ConsumerPermission.quotations])
  @Get('quotations/:id/pdf')
  async generateQuotationPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Get the quotation data
    const quotation = await this.salesService.findOneQuotation(
      id,
      req.user.consumer_id!,
    );

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Generate PDF
    const pdfBuffer =
      await this.quotationPdfService.generateQuotationPdf(quotation);

    // Set response headers
    const filename = `quotation-${(quotation as any).sale_number || 'unknown'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Send the PDF
    res.send(pdfBuffer);
  }

  @Get('variant-sales-stats')
  @HasPermissions([ConsumerPermission.business_insights])
  async getVariantSalesStats(
    @Query() query: GetVariantSalesStatsDto,
    @Req() req: Request,
  ) {
    const { startDate, endDate, branch_id, page, limit } = query;

    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    return this.salesService.getVariantSalesStats(
      req.user.consumer_id!,
      startDate,
      endDate,
      branch_id,
      page,
      limit,
    );
  }

  @Get('variant-sales-stats/:variantId')
  @HasPermissions([ConsumerPermission.business_insights])
  async getVariantSalesDetail(
    @Param('variantId', ParseIntPipe) variantId: number,
    @Query() query: GetVariantSalesStatsDto,
    @Req() req: Request,
  ) {
    const { startDate, endDate, branch_id, page, limit } = query;
    return this.salesService.getVariantSalesDetail(
      req.user.consumer_id!,
      variantId,
      startDate,
      endDate,
      branch_id,
      page,
      limit,
    );
  }

  @Get('user-sales-stats')
  @HasPermissions([ConsumerPermission.business_insights])
  async getUserSalesStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branch_id') branchId: number,
    @Req() req: Request,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    return this.salesService.getUsersSalesStats(
      req.user.consumer_id!,
      startDate,
      endDate,
      branchId ? parseInt(branchId.toString()) : undefined,
    );
  }

  @Get('user-sales-stats/:userId')
  @HasPermissions([ConsumerPermission.business_insights])
  async getUserSalesDetail(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GetUserSalesDetailDto,
    @Req() req: Request,
  ) {
    const { startDate, endDate, branch_id, page, limit } = query;

    return this.salesService.getUserSalesDetail(
      req.user.consumer_id!,
      userId,
      startDate,
      endDate,
      branch_id,
      page,
      limit,
    );
  }
  @Get('pending-deliveries/list')
  getPendingDeliveries(@Query() filters: any, @Req() req: Request) {
    return this.salesService.getPendingDeliveries(
      req.user.consumer_id!,
      filters,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Query('include_deleted') includeDeleted?: string,
  ) {
    return this.salesService.findOne(
      id,
      req.user.consumer_id!,
      includeDeleted === 'true',
    );
  }

  @Patch(':id/note')
  async updateNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSaleNoteDto: UpdateSaleNoteDto,
    @Req() req: Request,
  ) {
    return this.salesService.updateNote(
      id,
      req.user.consumer_id!,
      updateSaleNoteDto,
      req.user.id,
    );
  }

  @Delete(':id')
  async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Body() deleteSaleDto: DeleteSaleDto,
    @Req() req: Request,
  ) {
    return this.salesService.softDelete(
      id,
      req.user.consumer_id!,
      req.user.id,
      deleteSaleDto,
    );
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.salesService.restore(id, req.user.consumer_id!, req.user.id);
  }

  // ========== ONLINE ORDERS ENDPOINTS ==========

  @Get('online-orders/list')
  async findAllOnlineOrders(@Query() filters: any, @Req() req: Request) {
    return this.salesService.findAllOnlineOrders(
      filters,
      req.user.consumer_id!,
    );
  }

  @Get('online-orders/stats')
  async getOnlineOrderStats(
    @Query('branch_id') branchId: number,
    @Req() req: Request,
  ) {
    return this.salesService.getOnlineOrderStats(
      req.user.consumer_id!,
      branchId ? parseInt(branchId.toString()) : undefined,
    );
  }

  @Patch('online-orders/:id/status')
  async updateOnlineOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateOnlineOrderStatusDto,
    @Req() req: Request,
  ) {
    return this.salesService.updateOnlineOrderStatus(
      id,
      updateStatusDto.status,
      req.user.consumer_id!,
      updateStatusDto.delivery_partner,
    );
  }

  @Patch('pending-deliveries/:id/complete')
  completePendingDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.salesService.completePendingDelivery(
      id,
      req.user.consumer_id!,
      req.user.id,
    );
  }

  @Patch('pending-deliveries/:id/cancel')
  cancelPendingDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.salesService.cancelPendingDelivery(id, req.user.consumer_id!);
  }
}
