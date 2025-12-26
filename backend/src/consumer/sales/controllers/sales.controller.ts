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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { SalesService } from '../services/sales.service';
import { SalesPdfService } from '../services/sales-pdf.service';
import { QuotationPdfService } from '../services/quotation-pdf.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { SaleListFiltersDto } from '../dto/sale-list-filters.dto';
import { EODReportDto } from '../dto/eod-report.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

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
  async findAll(
    @Query() filters: SaleListFiltersDto,
    @Req() req: Request,
  ) {
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
  async getEODReport(
    @Query() eodDto: EODReportDto,
    @Req() req: Request,
  ) {
    return this.salesService.getEODReport(req.user.consumer_id!, eodDto);
  }

  @Get('receipt/:id')
  async generateReceiptPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    // Get the sale data
    const sale = await this.salesService.findOne(id, req.user.consumer_id!);
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Generate PDF
    const pdfBuffer = await this.salesPdfService.generateSaleReceiptPdf(sale);

    // Set response headers
    const filename = `receipt-${(sale as any).sale_number || 'unknown'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    // Send the PDF
    res.send(pdfBuffer);
  }

  @Get('search/:saleNumber')
  async findBySaleNumber(
    @Param('saleNumber') saleNumber: string,
    @Req() req: Request,
  ) {
    return this.salesService.findBySaleNumber(saleNumber, req.user.consumer_id!);
  }

  @Get('quotations/list')
  async findAllQuotations(
    @Query() filters: SaleListFiltersDto,
    @Req() req: Request,
  ) {
    return this.salesService.findAllQuotations(filters, req.user.consumer_id!);
  }

  @Get('quotations/:id')
  async findOneQuotation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.salesService.findOneQuotation(id, req.user.consumer_id!);
  }

  @Get('quotations/:id/pdf')
  async generateQuotationPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    // Get the quotation data
    const quotation = await this.salesService.findOneQuotation(id, req.user.consumer_id!);
    
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Generate PDF
    const pdfBuffer = await this.quotationPdfService.generateQuotationPdf(quotation);

    // Set response headers
    const filename = `quotation-${(quotation as any).sale_number || 'unknown'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    // Send the PDF
    res.send(pdfBuffer);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.salesService.findOne(id, req.user.consumer_id!);
  }
}
