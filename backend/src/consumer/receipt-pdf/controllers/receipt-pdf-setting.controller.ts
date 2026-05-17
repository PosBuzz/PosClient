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

    // 2. Get mock data as base (items, totals, payments, etc.)
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
        // Overwrite mock branding with real data
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
      // If branding fetch fails, continue with pure mock data
      this.logger?.warn?.(
        `Preview: Could not load branding data, using mock — ${error.message}`,
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

  // ─── MOCK DATA ───

  private getMockPdfData(type: ReceiptPresetType): ReceiptPdfData {
    const base: ReceiptPdfData = {
      storeName: 'PosBuzz Store',
      branchName: 'Main Branch',
      branchAddress: '123 Commerce Street, Business District',
      branchPhone: '+1 234 567 890',
      branchEmail: 'store@posbuzz.com',
      logoPath: '',
      currencySymbol: '$',
      currencyPosition: 'before',
      vatRegistrationNumber: 'VAT123456789',
      footerTerms:
        'All sales are final. Items must be returned within 7 days with original receipt.',
      headerText: 'RECEIPT',
      saleNumber: 'SL-2024-001234',
      saleDate: new Date(),
      saleType: 'sale',
      priceType: 'regular',
      paymentStatus: 'paid',
      cashierName: 'John Doe',
      servedByName: 'Jane Smith',
      customerName: 'Alice Johnson',
      customerPhone: '+1 987 654 321',
      customerEmail: 'alice@example.com',
      customerRewardPoints: 150,
      items: [
        {
          productName: 'Wireless Bluetooth Headphones',
          variantName: 'Black',
          sku: 'WBH-001',
          barcode: '1234567890',
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
          productName: 'USB-C Charging Cable',
          variantName: '1m',
          sku: 'UCC-010',
          barcode: '9876543210',
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
          productName: 'Phone Case Premium',
          variantName: 'iPhone 15',
          sku: 'PCP-015',
          barcode: '5556667778',
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
          type: 'Visa',
          amount: 67.62,
          reference: 'TXN-789012',
        },
      ],
      receivedAmount: 170.0,
      changeAmount: 2.38,
      dueAmount: 0,
      notes: 'Customer requested gift wrapping.',
      isOnlineOrder: false,
      onlineOrderStatus: null,
    };

    if (type === 'quotation') {
      base.saleType = 'quotation';
      base.headerText = 'QUOTATION';
      base.paymentStatus = 'unpaid';
      base.payments = [];
      base.receivedAmount = 0;
      base.changeAmount = 0;
      base.dueAmount = base.totalAmount;
      base.notes = 'Valid for 30 days from issue date.';
    } else if (type === 'return') {
      base.saleType = 'return';
      base.headerText = 'RETURN RECEIPT';
      base.notes = 'Refund processed to original payment method.';
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
