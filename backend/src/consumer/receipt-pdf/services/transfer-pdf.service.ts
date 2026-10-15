import { Injectable } from '@nestjs/common';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfSettingService } from './receipt-pdf-setting.service';
import { ReceiptPresetType } from '../preset/receipt-pdf-settings';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';

export type TransferDocumentType = Extract<
  ReceiptPresetType,
  'transfer_slip' | 'transfer_chalan'
>;

/** Prints an inventory transfer as a slip or chalan, using the saved presets. */
@Injectable()
export class TransferPdfService {
  constructor(
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly receiptPdfSettingService: ReceiptPdfSettingService,
  ) {}

  async generateTransferPdf(
    transfer: any,
    consumerId: number,
    type: TransferDocumentType = 'transfer_slip',
  ): Promise<Buffer> {
    // The slip travels with the stock, so it uses the sending branch's branding
    const branchId: number = transfer.source_branch_id;

    const [settings, branding] = await Promise.all([
      this.receiptPdfSettingService.getActiveSettings(
        consumerId,
        type,
        branchId,
      ),
      this.receiptPdfSettingService.getBrandingData(consumerId, branchId),
    ]);

    return this.receiptPdfService.generatePdf(
      this.mapTransferToPdfData(transfer, settings, branding),
      settings,
    );
  }

  private mapTransferToPdfData(
    transfer: any,
    settings: any,
    branding: any,
  ): ReceiptPdfData {
    const items: ReceiptPdfData['items'] = (transfer.items || []).map(
      (item: any) => {
        const variant = item.batch?.variant;
        return {
          productName: variant?.product?.name || '',
          variantName: variant?.name || '',
          sku: variant?.sku || '',
          barcode: variant?.barcode || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: 0,
          soldUnitPrice: 0,
          averageDiscount: 0,
          specialDiscount: 0,
          promotionDiscount: 0,
          totalDiscount: 0,
          taxAmount: 0,
          taxPercentage: 0,
          taxMethod: 'EXCLUSIVE',
          lineTotal: 0,
        };
      },
    );

    return {
      storeName: branding.storeName,
      branchName: branding.branchName,
      branchAddress: branding.branchAddress,
      branchPhone: branding.branchPhone,
      branchEmail: branding.branchEmail,
      logoPath: branding.logoPath,
      vatRegistrationNumber: branding.vatRegistrationNumber,

      currencySymbol: settings.currencySymbol || '৳',
      currencyPosition: settings.currencyPosition || 'before',
      footerTerms: '',

      headerText: settings.header?.text || 'INVENTORY TRANSFER SLIP',

      saleNumber: `TR-${transfer.id}`,
      numberLabel: 'Transfer No:',
      codeHeader: 'Code',
      saleDate: new Date(transfer.created_at),
      saleType: 'transfer',
      priceType: 'regular',
      paymentStatus: transfer.status || '',
      cashierName: transfer.created_by_user?.name || '',
      servedByName: '',

      sourceBranchName: transfer.source_branch?.name || '',
      destinationBranchName: transfer.destination_branch?.name || '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerRewardPoints: null,

      items,

      subtotal: 0,
      discountAmount: 0,
      promotionDiscount: 0,
      shippingCost: 0,
      taxAmount: 0,
      totalAmount: 0,

      payments: [],
      receivedAmount: 0,
      changeAmount: 0,
      dueAmount: 0,

      notes: transfer.notes || '',
      isOnlineOrder: false,
      onlineOrderStatus: null,
    };
  }
}
