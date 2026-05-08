import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ReceiptPdfSettings } from '../../receipt-pdf/preset/receipt-pdf-settings';
import { SalesPdfService } from '../../receipt-pdf/services/sales-pdf.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { DailyTargetReportDto } from '../dto/daily-target-report.dto';
import { EODReportDto } from '../dto/eod-report.dto';
import { GetUserSalesDetailDto } from '../dto/get-user-sales-detail.dto';
import { GetVariantSalesStatsDto } from '../dto/get-variant-sales-stats.dto';
import { SaleListFiltersDto } from '../dto/sale-list-filters.dto';
import { UpdateOnlineOrderStatusDto } from '../dto/update-online-order-status.dto';
import { QuotationPdfService } from '../services/quotation-pdf.service';
import { SalesService } from '../services/sales.service';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly salesPdfService: SalesPdfService,
    private readonly quotationPdfService: QuotationPdfService,
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
  async getEODReport(@Query() eodDto: EODReportDto, @Req() req: Request) {
    return this.salesService.getEODReport(req.user.consumer_id!, eodDto);
  }

  @Get('reports/daily-target')
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
    @Query('download') download?: string,
  ) {
    return this.buildAndSendReceipt(id, req, res, undefined, download);
  }

  @Post('receipt/:id')
  async generateReceiptPdfPost(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: { settings?: Partial<ReceiptPdfSettings> },
    @Query('download') download?: string,
  ) {
    return this.buildAndSendReceipt(id, req, res, body?.settings, download);
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
    @Query('download') download?: string,
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

    if (download === 'true') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    // Send the PDF
    res.send(pdfBuffer);
  }

  @Get('variant-sales-stats')
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
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.salesService.findOne(id, req.user.consumer_id!);
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
    );
  }

  private async buildAndSendReceipt(
    id: number,
    req: Request,
    res: Response,
    settingsOverride?: Partial<ReceiptPdfSettings>,
    download?: string,
  ) {
    const sale = await this.salesService.findOne(id, req.user.consumer_id!);

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const pdfBuffer = await this.salesPdfService.generateSaleReceiptPdf(
      sale,
      settingsOverride,
    );

    const saleNumber = (sale as any).sale_number || 'unknown';
    const filename = `receipt-${saleNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);

    if (download === 'true') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    res.send(pdfBuffer);
  }
}
