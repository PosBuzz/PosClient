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
