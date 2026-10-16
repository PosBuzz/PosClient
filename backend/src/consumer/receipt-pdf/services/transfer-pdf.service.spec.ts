import { ReceiptPdfService } from './receipt-pdf.service';
import { TransferPdfService } from './transfer-pdf.service';
import { PRESET_DEFAULTS } from '../preset/receipt-pdf-settings';

const branding = {
  storeName: 'Test Store',
  branchName: 'Main',
  branchAddress: '',
  branchPhone: '',
  branchEmail: '',
  logoPath: '',
  vatRegistrationNumber: '',
};

const transfer = {
  id: 12,
  source_branch_id: 2,
  status: 'pending',
  notes: 'Fragile',
  created_at: '2026-10-16T10:00:00Z',
  created_by_user: { name: 'Rina' },
  source_branch: { id: 2, name: 'Warehouse' },
  destination_branch: { id: 3, name: 'Downtown' },
  items: [
    {
      quantity: 5,
      batch: {
        variant: {
          sku: 'SKU-1',
          name: 'Red',
          product: { name: 'Shirt' },
        },
      },
    },
  ],
};

describe('TransferPdfService', () => {
  const build = (type: 'transfer_slip' | 'transfer_chalan') => {
    const renderer = new ReceiptPdfService();
    const render = jest.spyOn(renderer, 'generatePdf');
    const settingsService = {
      getActiveSettings: jest.fn().mockResolvedValue(PRESET_DEFAULTS[type]),
      getBrandingData: jest.fn().mockResolvedValue(branding),
    };
    return {
      service: new TransferPdfService(renderer, settingsService as any),
      render,
      settingsService,
    };
  };

  it('[BE-TRPDF-001] {TransferPdfService.generateTransferPdf} renders code, name, quantity and both branches with the transfer preset', async () => {
    const { service, render, settingsService } = build('transfer_slip');
    const pdf = await service.generateTransferPdf(transfer, 7, 'transfer_slip');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(settingsService.getActiveSettings).toHaveBeenCalledWith(
      7,
      'transfer_slip',
      2,
    );
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        headerText: 'INVENTORY TRANSFER SLIP',
        saleNumber: 'TR-12',
        numberLabel: 'Transfer No:',
        sourceBranchName: 'Warehouse',
        destinationBranchName: 'Downtown',
        items: [
          expect.objectContaining({
            sku: 'SKU-1',
            productName: 'Shirt',
            variantName: 'Red',
            quantity: 5,
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('[BE-TRPDF-002] {TransferPdfService.generateTransferPdf} uses the chalan preset and title for a transfer chalan', async () => {
    const { service, render, settingsService } = build('transfer_chalan');
    await service.generateTransferPdf(transfer, 7, 'transfer_chalan');
    expect(settingsService.getActiveSettings).toHaveBeenCalledWith(
      7,
      'transfer_chalan',
      2,
    );
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({ headerText: 'TRANSFER CHALAN' }),
      expect.anything(),
    );
  });

  const stubbed = (settings: any) => {
    const renderer = new ReceiptPdfService();
    const render = jest
      .spyOn(renderer, 'generatePdf')
      .mockResolvedValue(Buffer.from('pdf'));
    const settingsService = {
      getActiveSettings: jest.fn().mockResolvedValue(settings),
      getBrandingData: jest.fn().mockResolvedValue(branding),
    };
    return {
      service: new TransferPdfService(renderer, settingsService as any),
      render,
      settingsService,
    };
  };

  const zeroMoney = {
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

  it('[BE-TRPDF-004] {TransferPdfService.generateTransferPdf} maps every field of a complete transfer, with the preset settings and no money', async () => {
    const settings = {
      currencySymbol: '$',
      currencyPosition: 'after',
      header: { text: 'STOCK MOVE' },
    };
    const { service, render } = stubbed(settings);
    await service.generateTransferPdf(
      {
        ...transfer,
        items: [
          {
            quantity: '3',
            batch: {
              variant: {
                sku: 'SKU-2',
                barcode: '8901',
                name: 'Blue',
                product: { name: 'Cap' },
              },
            },
          },
        ],
      },
      7,
    );
    expect(render.mock.calls[0][1]).toBe(settings);
    expect(render.mock.calls[0][0]).toEqual({
      ...branding,
      currencySymbol: '$',
      currencyPosition: 'after',
      footerTerms: '',
      headerText: 'STOCK MOVE',
      saleNumber: 'TR-12',
      numberLabel: 'Transfer No:',
      codeHeader: 'Code',
      saleDate: new Date('2026-10-16T10:00:00Z'),
      saleType: 'transfer',
      priceType: 'regular',
      paymentStatus: 'pending',
      cashierName: 'Rina',
      servedByName: '',
      sourceBranchName: 'Warehouse',
      destinationBranchName: 'Downtown',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerRewardPoints: null,
      items: [
        {
          productName: 'Cap',
          variantName: 'Blue',
          sku: 'SKU-2',
          barcode: '8901',
          quantity: 3,
          ...zeroMoney,
        },
      ],
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
      notes: 'Fragile',
      isOnlineOrder: false,
      onlineOrderStatus: null,
    });
  });

  it('[BE-TRPDF-005] {TransferPdfService.generateTransferPdf} defaults to the slip preset and fills blanks for a sparse transfer and empty settings', async () => {
    const { service, render, settingsService } = stubbed({});
    await service.generateTransferPdf(
      {
        id: 13,
        source_branch_id: 4,
        created_at: '2026-10-16T10:00:00Z',
        items: [
          { quantity: 'x', batch: null },
          { quantity: 2, batch: { variant: { product: null } } },
        ],
      },
      7,
    );
    expect(settingsService.getActiveSettings).toHaveBeenCalledWith(
      7,
      'transfer_slip',
      4,
    );
    expect(settingsService.getBrandingData).toHaveBeenCalledWith(7, 4);
    const blankItem = {
      productName: '',
      variantName: '',
      sku: '',
      barcode: '',
      ...zeroMoney,
    };
    expect(render.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        currencySymbol: '৳',
        currencyPosition: 'before',
        headerText: 'INVENTORY TRANSFER SLIP',
        paymentStatus: '',
        cashierName: '',
        sourceBranchName: '',
        destinationBranchName: '',
        notes: '',
        items: [
          { ...blankItem, quantity: 0 },
          { ...blankItem, quantity: 2 },
        ],
      }),
    );
  });

  it('[BE-TRPDF-006] {TransferPdfService.generateTransferPdf} prints a transfer without items as an empty list', async () => {
    const { service, render } = stubbed({});
    await service.generateTransferPdf(
      { id: 14, source_branch_id: 4, created_at: '2026-10-16T10:00:00Z' },
      7,
    );
    expect(render.mock.calls[0][0].items).toEqual([]);
  });

  it('[BE-TRPDF-003] the transfer presets show no money columns', () => {
    for (const type of ['transfer_slip', 'transfer_chalan'] as const) {
      const items = PRESET_DEFAULTS[type].items;
      expect(items.showSku).toBe(true);
      expect(items.showQuantity).toBe(true);
      expect(items.showUnitPrice).toBe(false);
      expect(items.showLineTotal).toBe(false);
      expect(PRESET_DEFAULTS[type].totals.show).toBe(false);
    }
  });
});
