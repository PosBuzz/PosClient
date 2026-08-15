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
  Res,
  Patch,
  Logger,
} from '@nestjs/common';
import { ReceiptPdfSettingService } from '../services/receipt-pdf-setting.service';
import {
  PRESET_DEFAULTS,
  ReceiptPresetType,
} from '../preset/receipt-pdf-settings';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';
import { Response } from 'express';
import { ReceiptPdfService } from '../services/receipt-pdf.service';

@Controller('receipt-settings')
@HasPermissions([ConsumerPermission.receipt_settings])
@UseGuards(ClientAuthGuard, PermissionsGuard)
export class ReceiptPdfSettingController {
  private readonly logger = new Logger(ReceiptPdfSettingController.name);
  constructor(
    private readonly service: ReceiptPdfSettingService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  @Get('defaults/:type')
  async getDefaults(@Param('type') type: ReceiptPresetType) {
    return PRESET_DEFAULTS[type];
  }

  @Post('preview')
  async preview(
    @Request() req: any,
    @Body()
    body: {
      settings: any;
      type: ReceiptPresetType;
      branchId?: number;
    },
    @Res() res: Response,
  ) {
    const consumerId = req.user.consumer_id;

    // 1. Always merge with defaults so missing fields don't crash PDF generation
    const defaults = PRESET_DEFAULTS[body.type] || PRESET_DEFAULTS.receipt;
    const mergedSettings = this.deepMergeSettings(defaults, body.settings);

    // 2. Get sample data as base (items, totals, payments, etc.)
    const mockData = this.getMockPdfData(body.type);

    if (mergedSettings.header?.text) {
      mockData.headerText = mergedSettings.header.text;
    }

    // 3. Apply settings JSON values to mockData (Currency & Footer Terms)
    mockData.currencySymbol =
      mergedSettings.currencySymbol || mockData.currencySymbol;
    mockData.currencyPosition =
      mergedSettings.currencyPosition || mockData.currencyPosition;
    mockData.footerTerms =
      mergedSettings.footer?.termsText || mockData.footerTerms;

    // 4. Overlay real branding data from consumer/branch
    try {
      let branding: any = null;

      if (body.branchId) {
        // Branch-level: get both consumer + branch data
        branding = await this.service.getBrandingData(
          consumerId,
          body.branchId,
        );
      } else {
        // Consumer-level: get consumer data only
        branding = await this.service.getConsumerOnlyBrandingData(consumerId);
      }

      if (branding) {
        // Show real branding/layout context, while all transaction data stays sample.
        mockData.storeName = branding.storeName || mockData.storeName;
        mockData.logoPath = branding.logoPath || mockData.logoPath;

        // Branch-specific fields (only present when branchId was provided)
        if (branding.branchName) mockData.branchName = branding.branchName;
        if (branding.branchAddress)
          mockData.branchAddress = branding.branchAddress;
        if (branding.branchPhone) mockData.branchPhone = branding.branchPhone;
        if (branding.branchEmail) mockData.branchEmail = branding.branchEmail;
        if (branding.vatRegistrationNumber)
          mockData.vatRegistrationNumber = branding.vatRegistrationNumber;
      }
    } catch (error) {
      // If branding fetch fails, continue with pure sample data
      this.logger?.warn?.(
        `Preview: Could not load branding data, using sample data — ${error.message}`,
      );
    }

    // 5. Generate PDF with safe settings and enriched data
    const pdfBuffer = await this.receiptPdfService.generatePdf(
      mockData,
      mergedSettings,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

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

  @Get(':id')
  async getOne(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const consumerId = req.user.consumer_id;
    return this.service.getSettingById(id, consumerId);
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

  // PATCH /receipt-settings/:id/activate
  @Patch(':id/activate')
  async activate(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const consumerId = req.user.consumer_id;
    return this.service.setActive(id, consumerId);
  }

  // PATCH /receipt-settings/:id/deactivate
  @Patch(':id/deactivate')
  async deactivate(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const consumerId = req.user.consumer_id;
    return this.service.deactivateSetting(id, consumerId);
  }

  // PATCH /receipt-settings/:id
  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; settings?: any },
  ) {
    const consumerId = req.user.consumer_id;
    return this.service.updateSetting(id, consumerId, body);
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

  // DELETE /receipt-settings/:id
  @Delete(':id')
  async delete(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const consumerId = req.user.consumer_id;
    return this.service.deleteSetting(id, consumerId);
  }

  // ─── SAMPLE PREVIEW DATA ───

  private getMockPdfData(type: ReceiptPresetType): ReceiptPdfData {
    const base: ReceiptPdfData = {
      storeName: 'Sample Preview Store',
      branchName: 'Sample Branch (Preview)',
      branchAddress: '123 Sample Street, Demo City',
      branchPhone: '+880 1000 000 000',
      branchEmail: 'fake.sample@email.com',
      logoPath: '',
      currencySymbol: '৳',
      currencyPosition: 'before',
      vatRegistrationNumber: 'SAMPLE-VAT-000000',
      footerTerms:
        'SAMPLE PREVIEW ONLY. This fake receipt data is used only to preview PDF layout and settings.',
      headerText: 'SAMPLE RECEIPT',
      saleNumber: 'SAMPLE-SL-000123',
      saleDate: new Date(),
      saleType: 'sale',
      priceType: 'regular',
      paymentStatus: 'paid',
      cashierName: 'Sample Cashier',
      servedByName: 'Sample Staff',
      customerName: 'Sample Customer (Fake)',
      customerPhone: '+880 1999 000 000',
      customerEmail: 'fake.sample@email.com',
      customerAddress: '456 Sample Road, Apt 7B, Demo City - 1200',
      customerRewardPoints: 150,
      items: [
        {
          productName: 'Sample Product - Bluetooth Headphones',
          variantName: 'Demo Black',
          sku: 'SAMPLE-WBH-001',
          barcode: 'SAMPLE123456',
          quantity: 2,
          unitPrice: 49.99,
          soldUnitPrice: 49.99,
          averageDiscount: 0,
          specialDiscount: 5.0,
          promotionDiscount: 0,
          totalDiscount: 5.0,
          taxAmount: 4.5,
          taxPercentage: 5,
          taxMethod: 'EXCLUSIVE',
          lineTotal: 94.98,
        },
        {
          productName: 'Sample Product - USB-C Cable',
          variantName: 'Demo 1m',
          sku: 'SAMPLE-UCC-010',
          barcode: 'SAMPLE987654',
          quantity: 3,
          unitPrice: 12.99,
          soldUnitPrice: 12.99,
          averageDiscount: 0,
          specialDiscount: 0,
          promotionDiscount: 3.0,
          totalDiscount: 3.0,
          taxAmount: 1.17,
          taxPercentage: 5,
          taxMethod: 'INCLUSIVE',
          lineTotal: 36.97,
        },
        {
          productName: 'Sample Product - Phone Case',
          variantName: 'Demo Model',
          sku: 'SAMPLE-PCP-015',
          barcode: 'SAMPLE555666',
          quantity: 1,
          unitPrice: 29.99,
          soldUnitPrice: 29.99,
          averageDiscount: 2.0,
          specialDiscount: 0,
          promotionDiscount: 0,
          totalDiscount: 2.0,
          taxAmount: 1.35,
          taxPercentage: 5,
          taxMethod: 'EXCLUSIVE',
          lineTotal: 27.99,
        },
      ],
      subtotal: 159.95,
      discountAmount: 0,
      promotionDiscount: 3.0,
      shippingCost: 5.0,
      taxAmount: 5.67,
      totalAmount: 167.62,
      payments: [
        { method: 'Cash', type: '', amount: 100.0, reference: '' },
        {
          method: 'Card',
          type: 'Sample Card',
          amount: 67.62,
          reference: 'SAMPLE-TXN-789012',
        },
      ],
      receivedAmount: 170.0,
      changeAmount: 2.38,
      dueAmount: 0,
      notes:
        'SAMPLE PREVIEW ONLY - This is fake data for testing the receipt PDF layout.',
      isOnlineOrder: false,
      onlineOrderStatus: null,
    };

    if (type === 'quotation') {
      base.saleType = 'quotation';
      base.headerText = 'SAMPLE QUOTATION';
      base.saleNumber = 'SAMPLE-QT-000123';
      base.paymentStatus = 'unpaid';
      base.payments = [];
      base.receivedAmount = 0;
      base.changeAmount = 0;
      base.dueAmount = base.totalAmount;
      base.notes =
        'SAMPLE PREVIEW ONLY - This fake quotation is used to preview layout.';
    } else if (type === 'return') {
      base.saleType = 'return';
      base.headerText = 'SAMPLE RETURN RECEIPT';
      base.saleNumber = 'SAMPLE-RT-000123';
      base.notes =
        'SAMPLE PREVIEW ONLY - This fake return receipt is used to preview layout.';
    } else if (type === 'chalan') {
      base.headerText = 'SAMPLE DELIVERY CHALAN';
      base.saleNumber = 'SAMPLE-CH-000123';
      base.notes =
        'SAMPLE PREVIEW ONLY - Delivery address: 456 Sample Road, Demo City. Handle with care.';
    } else if (type === 'money_receipt') {
      base.headerText = 'SAMPLE MONEY RECEIPT';
      base.saleNumber = 'SAMPLE-MR-000123';
      base.paymentStatus = 'partial';
      base.receivedAmount = 100.0;
      base.changeAmount = 0;
      base.dueAmount = 67.62;
      base.notes =
        'SAMPLE PREVIEW ONLY - This fake money receipt is used to preview layout.';
    } else if (type === 'delivery_slip') {
      base.headerText = 'SAMPLE DELIVERY SLIP';
      base.saleNumber = 'SAMPLE-DS-000123';
      base.notes =
        'SAMPLE PREVIEW ONLY - Deliver to: 456 Sample Road, Demo City. Call before delivery.';
    }

    return base;
  }

  private deepMergeSettings(target: any, source: any): any {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        source[key] !== undefined &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        out[key] = this.deepMergeSettings(target[key] ?? {}, source[key]);
      } else if (source[key] !== undefined) {
        out[key] = source[key];
      }
    }
    return out;
  }
}
