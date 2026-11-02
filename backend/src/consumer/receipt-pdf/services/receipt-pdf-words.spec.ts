import * as PDFDocument from 'pdfkit';
import { ReceiptPdfService } from './receipt-pdf.service';
import { DEFAULT_RECEIPT_SETTINGS } from '../preset/receipt-pdf-settings';

describe('ReceiptPdfService total in words', () => {
  const printed = (showAmountInWords?: boolean, show = true): string[] => {
    const doc = new PDFDocument({ size: 'A4' });
    const lines: string[] = [];
    const text = doc.text.bind(doc);
    jest.spyOn(doc, 'text').mockImplementation(((t: any, ...rest: any[]) => {
      lines.push(String(t));
      return text(t, ...rest);
    }) as any);
    const settings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      totals: { ...DEFAULT_RECEIPT_SETTINGS.totals, show, showAmountInWords },
    };
    const data: any = {
      totalAmount: 1250.5,
      subtotal: 1250.5,
      discountAmount: 0,
      promotionDiscount: 0,
      shippingCost: 0,
      taxAmount: 0,
      currencySymbol: 'Tk ',
      currencyPosition: 'before',
    };
    (new ReceiptPdfService() as any).drawTotals(
      doc,
      data,
      settings,
      50,
      400,
      50,
    );
    return lines;
  };

  it('[BE-RCP-052] prints the total in words under TOTAL when enabled', () => {
    expect(printed(true)).toContain(
      'In words: One Thousand Two Hundred Fifty Taka and Fifty Paisa Only',
    );
  });

  it('[BE-RCP-053] prints nothing extra when off or unset', () => {
    expect(printed(false).join('|')).not.toContain('In words');
    expect(printed(undefined).join('|')).not.toContain('In words');
  });

  it('[BE-RCP-054] stays off when the totals section is hidden', () => {
    expect(printed(true, false)).toEqual([]);
  });
});
