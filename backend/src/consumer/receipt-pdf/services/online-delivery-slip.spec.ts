import { SalesPdfService } from './sales-pdf.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { PRESET_DEFAULTS } from '../preset/receipt-pdf-settings';

describe('online delivery slip', () => {
  it('renders the partner, customer destination and outstanding balance with its own preset', async () => {
    const renderer = new ReceiptPdfService();
    const render = jest.spyOn(renderer, 'generatePdf');
    const settingsService = {
      getActiveSettings: jest
        .fn()
        .mockResolvedValue(PRESET_DEFAULTS.online_delivery_slip),
      getBrandingData: jest
        .fn()
        .mockResolvedValue({
          storeName: 'Test Store',
          branchName: 'Main',
          branchAddress: '',
          branchPhone: '0123456',
          branchEmail: '',
          logoPath: '',
          vatRegistrationNumber: '',
        }),
    };
    const service = new SalesPdfService(renderer, settingsService as any);
    const result = await service.generateSaleReceiptPdf(
      {
        consumer_id: 7,
        branch_id: 2,
        sale_number: 'ONLINE-123',
        sale_date: '2026-09-16',
        is_online_order: true,
        delivery_partner: 'Test Courier',
        customer: {
          name: 'Test Customer',
          phone: '0123456',
          address: '123 Test Road',
        },
        total_amount: 100,
        received_amount: 20,
        payment_status: 'partial',
        notes: 'Call on arrival',
        items: [
          {
            quantity: 1,
            variant: { name: 'Blue', product: { name: 'Test Product' } },
          },
        ],
      },
      undefined,
      undefined,
      'online_delivery_slip',
    );
    expect(settingsService.getActiveSettings).toHaveBeenCalledWith(
      7,
      'online_delivery_slip',
      2,
    );
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        headerText: 'ONLINE DELIVERY SLIP',
        customerAddress: '123 Test Road',
        dueAmount: 80,
        notes: 'Delivery partner: Test Courier\nCall on arrival',
      }),
      PRESET_DEFAULTS.online_delivery_slip,
    );
    expect(result.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.length).toBeGreaterThan(1000);
  });
});
