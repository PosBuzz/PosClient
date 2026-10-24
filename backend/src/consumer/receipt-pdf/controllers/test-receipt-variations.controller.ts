// test-receipt-variations.controller.ts

import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { SalesService } from '../../sales/services/sales.service';
import { SalesPdfService } from '../services/sales-pdf.service';
import { ReceiptPdfSettings } from '../preset/receipt-pdf-settings';
import { ReceiptPdfData } from '../interfaces/receipt-pdf-data.interface';
import { errorMessage } from '../../../common/utils/error.util';
import { DevelopmentOnlyGuard } from '../../../common/guards/development-only.guard';

// Local receipt-layout preview against seed data; never reachable outside development.
@UseGuards(DevelopmentOnlyGuard)
@Controller('test-receipts')
export class TestReceiptVariationsController {
  private readonly CONSUMER_ID = 1;
  private readonly SALE_ID = 16;

  constructor(
    private readonly salesService: SalesService,
    private readonly salesPdfService: SalesPdfService,
  ) {}

  // ============================================================
  // Main index page - shows all variations as clickable links
  // GET /test-receipts
  // ============================================================

  @Get()
  async index(@Req() req: Request, @Res() res: Response) {
    const baseUrl = this.getBaseUrl(req);
    const variations = ALL_VARIATIONS;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt PDF Variations Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      text-align: center;
      color: #94a3b8;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .stats {
      display: flex;
      gap: 20px;
      justify-content: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    .stat {
      background: #1e293b;
      padding: 12px 24px;
      border-radius: 8px;
      text-align: center;
    }
    .stat .num { font-size: 24px; font-weight: 700; color: #60a5fa; }
    .stat .label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .category {
      margin-bottom: 24px;
      background: #1e293b;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #334155;
    }
    .category-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      background: #334155;
      border-bottom: 1px solid #475569;
    }
    .category-header .icon { font-size: 20px; }
    .category-header h2 { font-size: 16px; font-weight: 600; flex: 1; }
    .category-header .count {
      background: #60a5fa;
      color: #0f172a;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 20px;
    }
    .links { padding: 8px; }
    .link-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      text-decoration: none;
      color: #e2e8f0;
      transition: all 0.15s;
      border: 1px solid transparent;
    }
    .link-card:hover {
      background: #334155;
      border-color: #60a5fa;
    }
    .link-card .idx {
      background: #475569;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      min-width: 32px;
      text-align: center;
      font-family: 'SF Mono', monospace;
    }
    .link-card .name { flex: 1; font-size: 14px; }
    .link-card .arrow { color: #60a5fa; font-size: 18px; }
    .toc {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      border: 1px solid #334155;
    }
    .toc h3 { color: #60a5fa; margin-bottom: 12px; font-size: 14px; }
    .toc a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 13px;
      display: inline-block;
      margin: 4px 12px 4px 0;
    }
    .toc a:hover { color: #60a5fa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📄 Receipt PDF Variations</h1>
    <p class="subtitle">Click any variation to generate and preview the PDF</p>
    
    <div class="stats">
      <div class="stat">
        <div class="num">${variations.length}</div>
        <div class="label">Total Variations</div>
      </div>
      <div class="stat">
        <div class="num">${[...new Set(variations.map((v) => v.category))].length}</div>
        <div class="label">Categories</div>
      </div>
    </div>

    <div class="toc">
      <h3>Quick Jump</h3>
      ${[...new Set(variations.map((v) => v.category))]
        .map(
          (c) =>
            `<a href="#cat-${c.replace(/\s+/g, '-').toLowerCase()}">${c}</a>`,
        )
        .join('')}
    </div>

    ${this.buildCategorySections(variations, baseUrl)}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  private buildCategorySections(
    variations: { category: string; name: string }[],
    baseUrl: string,
  ): string {
    const categories = [...new Set(variations.map((v) => v.category))];
    const icons: Record<string, string> = {
      Page: '📄',
      Header: '🏷️',
      'Store Info': '🏪',
      'Order Info': '📋',
      'Customer Info': '👤',
      Items: '📦',
      Totals: '💰',
      Payment: '💳',
      Notes: '📝',
      Footer: '🔻',
      Branding: '🎨',
      'Font Sizes': '🔤',
      Presets: '⚡',
      'Use Cases': '🎯',
      'Terms & Conditions': '📜',
    };

    return categories
      .map((cat) => {
        const items = variations
          .map((v, i) => ({ ...v, globalIndex: i }))
          .filter((v) => v.category === cat);

        const linksHtml = items
          .map(
            (item) =>
              `<a class="link-card" href="${baseUrl}/test-receipts/${item.globalIndex}" target="_blank">
        <span class="idx">${item.globalIndex}</span>
        <span class="name">${item.name}</span>
        <span class="arrow">→</span>
      </a>`,
          )
          .join('\n      ');

        return `<div class="category" id="cat-${cat.replace(/\s+/g, '-').toLowerCase()}">
      <div class="category-header">
        <span class="icon">${icons[cat] || '📌'}</span>
        <h2>${cat}</h2>
        <span class="count">${items.length}</span>
      </div>
      <div class="links">
        ${linksHtml}
      </div>
    </div>`;
      })
      .join('\n\n    ');
  }

  // ============================================================
  // Render a specific variation
  // GET /test-receipts/:index
  // ============================================================

  @Get(':index')
  async renderVariation(
    @Param('index', ParseIntPipe) index: number,
    @Res() res: Response,
  ) {
    const variations = ALL_VARIATIONS;

    if (index < 0 || index >= variations.length) {
      return res
        .status(404)
        .send(`Invalid index. Must be 0-${variations.length - 1}`);
    }

    const variation = variations[index];

    let sale: any;
    try {
      sale = await this.salesService.findOne(this.SALE_ID, this.CONSUMER_ID);
    } catch {
      return res
        .status(404)
        .send(
          `Sale #${this.SALE_ID} not found for consumer #${this.CONSUMER_ID}`,
        );
    }

    if (!sale) {
      return res
        .status(404)
        .send(
          `Sale #${this.SALE_ID} not found for consumer #${this.CONSUMER_ID}`,
        );
    }

    try {
      const pdfBuffer = await this.salesPdfService.generateSaleReceiptPdf(
        sale,
        variation.settings,
        variation.dataOverrides, // Pass the dynamic branding data overrides here
      );

      const safeName = variation.name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase();
      const filename = `receipt-${safeName}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(pdfBuffer);
    } catch (err) {
      return res
        .status(500)
        .send(
          `PDF generation failed: ${errorMessage(err)}\n\nVariation: ${variation.name}`,
        );
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getBaseUrl(req: any): string {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:8000';
    return `${protocol}://${host}/api/v1`;
  }
}

// ============================================================
// TERMS & CONDITIONS TEXT TEMPLATES
// ============================================================

const TERMS_SHORT = 'Goods once sold will not be returned or exchanged.';

const TERMS_SINGLE_LINE =
  'Goods once sold will not be returned or exchanged. All disputes are subject to Dhaka jurisdiction. This is a computer-generated invoice.';

const TERMS_WITH_NEWLINES = `Goods once sold will not be returned or exchanged.
All disputes are subject to Dhaka jurisdiction.
This is a computer-generated invoice.
Please retain this receipt for warranty claims.`;

const TERMS_WITH_BR_TAGS =
  '1. Goods once sold will not be returned or exchanged.<br>2. All disputes are subject to Dhaka jurisdiction.<br>3. This is a computer-generated invoice.<br>4. Please retain this receipt for warranty claims.<br>5. For support, contact support@store.com';

const TERMS_WITH_BR_SLASH_TAGS =
  '1. Goods once sold will not be returned or exchanged.<br/>2. All disputes are subject to Dhaka jurisdiction.<br/>3. This is a computer-generated invoice.<br/>4. Please retain this receipt for warranty claims.<br/>5. For support, contact support@store.com';

const TERMS_WITH_BR_SPACE_TAGS =
  '1. Goods once sold will not be returned or exchanged.<br />2. All disputes are subject to Dhaka jurisdiction.<br />3. This is a computer-generated invoice.<br />4. Please retain this receipt for warranty claims.<br />5. For support, contact support@store.com';

const TERMS_MIXED_BREAKS = `Return & Exchange Policy
Goods once sold will not be returned or exchanged unless defective.
<br/>
Warranty Information
All products carry manufacturer warranty as specified.
Please retain this receipt for warranty claims.
<br/>
Dispute Resolution
All disputes are subject to Dhaka jurisdiction.
For support, contact support@store.com`;

const TERMS_NUMBERED = `1. Goods once sold will not be returned or exchanged.
2. Defective items must be reported within 7 days of purchase.
3. Warranty is valid only with original receipt.
4. All disputes are subject to local jurisdiction.
5. This is a computer-generated invoice.
6. Prices are inclusive of applicable taxes unless stated otherwise.
7. Management reserves the right to refuse service.`;

const TERMS_LEGAL = `TERMS AND CONDITIONS OF SALE

By accepting this receipt, you agree to the following terms:

1. GENERAL TERMS
  - All sales are final unless otherwise stated.
  - Products must be inspected at the time of delivery.
  - Claims for damaged goods must be made within 24 hours.

2. WARRANTY TERMS
  - Warranty period starts from the date of purchase.
  - Warranty covers manufacturing defects only.
  - Warranty does not cover physical damage or misuse.
  - Original receipt is required for warranty claims.

3. RETURN POLICY
  - Returns are accepted within 7 days with original packaging.
  - Returned items must be unused and in resalable condition.
  - Refunds will be processed within 5-7 business days.

4. PAYMENT TERMS
  - Full payment must be made at the time of purchase.
  - Credit terms are available for approved customers only.
  - Late payments may incur interest charges.

5. LIMITATION OF LIABILITY
  - Maximum liability is limited to the purchase price.
  - We are not liable for consequential damages.
  - We are not liable for delays caused by third parties.

6. GOVERNING LAW
  - These terms are governed by the laws of Bangladesh.
  - All disputes shall be resolved in Dhaka jurisdiction.`;

const TERMS_RETAIL_SHOP = `• No return or exchange after purchase
• Check products before leaving the counter
• Keep this receipt for warranty claims
• Warranty void if seal is broken
• For complaints, call our helpline`;

const TERMS_RESTAURANT = `• All food items are non-refundable
• We are not responsible for allergies
• Service charge is not included in bill
• GST is included in the prices
• Please inform staff of any dietary requirements`;

const TERMS_WHOLESALE = `WHOLESALE TERMS:
• Minimum order quantity applies
• Payment must be made within 30 days
• Late payment incurs 2% monthly interest
• Goods remain property of seller until full payment
• Delivery subject to stock availability
• Bulk discounts are non-negotiable
• Claims must be lodged within 48 hours of delivery`;

const TERMS_ONLINE_ORDER = `ONLINE ORDER TERMS:
• Delivery within 3-5 business days
• Free delivery on orders above $1000
• Cash on delivery available
• Order cancellation within 1 hour only
• We are not responsible for wrong address
• Track your order at our website
• Return pickup within 48 hours of request`;

const TERMS_MULTILINE_WITH_BLANKS = `RETURN POLICY:

Items can be returned within 7 days of purchase.

CONDITIONS:
- Item must be unused and in original packaging
- Original receipt is mandatory
- Refund will be processed to original payment method

EXCLUSIONS:
- Personal hygiene products
- Customized items
- Software and digital products

For assistance, contact our customer support.`;

const TERMS_BANGLA_ENGLISH = `Return Policy / রিটার্ন পলিসি:
Goods once sold will not be returned / পণ্য বিক্রয়ের পর ফেরত নেওয়া হবে না
Warranty claim requires this receipt / ওয়ারেন্টি দাবির জন্য এই রিসিপট প্রয়োজন
All disputes subject to Dhaka jurisdiction / সকল বিরোধ ঢাকা এখতিয়ারে বিবেচিত হবে`;

const TERMS_VERY_LONG = `IMPORTANT NOTICE - PLEASE READ CAREFULLY

This receipt serves as proof of purchase and must be retained for any future claims, warranty services, or returns.

1. PRODUCT WARRANTIES
Each product carries its own warranty terms as specified by the manufacturer. The warranty period begins from the date of purchase indicated on this receipt. To avail warranty service, you must present this original receipt along with the product in its original packaging. Warranty does not cover damages resulting from misuse, unauthorized modifications, natural disasters, or normal wear and tear.

2. RETURN AND EXCHANGE POLICY
We accept returns and exchanges within 7 calendar days from the date of purchase, subject to the following conditions: (a) The product must be unused, unwashed, and in its original condition with all tags intact. (b) The product must be in its original packaging. (c) A valid receipt must be presented. (d) Items purchased under promotional offers or during clearance sales are not eligible for return or exchange. (e) Personal hygiene products, undergarments, and perishable goods cannot be returned under any circumstances.

3. REFUND PROCESSING
Approved refunds will be processed within 7-10 business days. Refunds will be made using the same payment method used for the original purchase. Cash refunds are available for cash purchases. For card payments, the refund will be credited to the same card. Please allow additional time for your bank to process the refund.

4. PRICE AND PAYMENT
All prices are inclusive of applicable taxes unless explicitly stated otherwise. We reserve the right to change prices without prior notice. However, once a purchase is completed, the price paid is final. We accept cash, credit cards, debit cards, and approved digital payment methods.

5. LIMITATION OF LIABILITY
Our total liability for any claim arising from the sale of products shall not exceed the purchase price of the product in question. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities.

6. GOVERNING LAW AND JURISDICTION
These terms and conditions shall be governed by and construed in accordance with the laws of Bangladesh. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts in Dhaka, Bangladesh.

7. CHANGES TO TERMS
We reserve the right to modify these terms and conditions at any time without prior notice. The updated terms will be effective from the date of publication and will apply to all subsequent purchases.

By completing this purchase, you acknowledge that you have read, understood, and agree to be bound by these terms and conditions.

For any questions or concerns, please contact our customer service at support@store.com or call our helpline at +880-XXXX-XXXX.`;

// ============================================================
// ALL VARIATIONS DATA
// ============================================================

const ALL_VARIATIONS: {
  category: string;
  name: string;
  settings?: Partial<ReceiptPdfSettings>;
  dataOverrides?: Partial<ReceiptPdfData>; // Replaces settings.branding
}[] = [
  // ── PAGE ──────────────────────────────────────────────────
  {
    category: 'Page',
    name: 'A4 - Default Margins',
    settings: {
      page: {
        size: 'A4',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
      },
    },
  },
  {
    category: 'Page',
    name: 'A4 - Narrow Margins',
    settings: {
      page: {
        size: 'A4',
        margins: { top: 25, right: 25, bottom: 25, left: 25 },
      },
    },
  },
  {
    category: 'Page',
    name: 'A4 - Wide Margins',
    settings: {
      page: {
        size: 'A4',
        margins: { top: 80, right: 80, bottom: 80, left: 80 },
      },
    },
  },
  {
    category: 'Page',
    name: 'A5 - Default Margins',
    settings: {
      page: {
        size: 'A5',
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
      },
    },
  },
  {
    category: 'Page',
    name: 'Letter - Default Margins',
    settings: {
      page: {
        size: 'Letter',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
      },
    },
  },
  {
    category: 'Page',
    name: 'Letter - Narrow Margins',
    settings: {
      page: {
        size: 'Letter',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
      },
    },
  },

  // ── HEADER ────────────────────────────────────────────────
  {
    category: 'Header',
    name: 'RECEIPT - Centered with Logo',
    settings: {
      header: {
        show: true,
        text: 'RECEIPT',
        showLogo: true,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
    },
  },
  {
    category: 'Header',
    name: 'TAX INVOICE - Logo Left',
    settings: {
      header: {
        show: true,
        text: 'TAX INVOICE',
        showLogo: true,
        logoMaxWidth: 150,
        logoMaxHeight: 75,
        layout: 'logo-left',
      },
    },
  },
  {
    category: 'Header',
    name: 'SALES INVOICE - Centered No Logo',
    settings: {
      header: {
        show: true,
        text: 'SALES INVOICE',
        showLogo: false,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
    },
  },
  {
    category: 'Header',
    name: 'Small Logo',
    settings: {
      header: {
        show: true,
        text: 'RECEIPT',
        showLogo: true,
        logoMaxWidth: 60,
        logoMaxHeight: 30,
        layout: 'centered',
      },
    },
  },
  {
    category: 'Header',
    name: 'Large Logo',
    settings: {
      header: {
        show: true,
        text: 'RECEIPT',
        showLogo: true,
        logoMaxWidth: 200,
        logoMaxHeight: 100,
        layout: 'centered',
      },
    },
  },
  {
    category: 'Header',
    name: 'Header Hidden',
    settings: {
      header: {
        show: false,
        text: 'RECEIPT',
        showLogo: false,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
    },
  },

  // ── STORE INFO ────────────────────────────────────────────
  {
    category: 'Store Info',
    name: 'All Store Info',
    settings: {
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showVatRegistration: true,
      },
    },
  },
  {
    category: 'Store Info',
    name: 'Name and Branch Only',
    settings: {
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: false,
        showPhone: false,
        showEmail: false,
        showVatRegistration: false,
      },
    },
  },
  {
    category: 'Store Info',
    name: 'Name and Contact Only',
    settings: {
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: false,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showVatRegistration: false,
      },
    },
  },
  {
    category: 'Store Info',
    name: 'Store Info Hidden',
    settings: {
      storeInfo: {
        show: false,
        showStoreName: false,
        showBranchName: false,
        showAddress: false,
        showPhone: false,
        showEmail: false,
        showVatRegistration: false,
      },
    },
  },
  {
    category: 'Store Info',
    name: 'Only VAT Registration',
    settings: {
      storeInfo: {
        show: true,
        showStoreName: false,
        showBranchName: false,
        showAddress: false,
        showPhone: false,
        showEmail: false,
        showVatRegistration: true,
      },
    },
  },

  // ── ORDER INFO ────────────────────────────────────────────
  {
    category: 'Order Info',
    name: 'All Order Info',
    settings: {
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: true,
      },
    },
  },
  {
    category: 'Order Info',
    name: 'Minimal (Sale No + Date)',
    settings: {
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: true,
        showCashier: false,
        showServedBy: false,
        showPriceType: false,
      },
    },
  },
  {
    category: 'Order Info',
    name: 'No Sale Type No Price Type',
    settings: {
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: false,
      },
    },
  },
  {
    category: 'Order Info',
    name: 'Only Sale Number',
    settings: {
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: false,
        showCashier: false,
        showServedBy: false,
        showPriceType: false,
      },
    },
  },
  {
    category: 'Order Info',
    name: 'Order Info Hidden',
    settings: {
      orderInfo: {
        show: false,
        showSaleNumber: false,
        showSaleType: false,
        showDate: false,
        showCashier: false,
        showServedBy: false,
        showPriceType: false,
      },
    },
  },

  // ── CUSTOMER INFO ─────────────────────────────────────────
  {
    category: 'Customer Info',
    name: 'All Customer Info',
    settings: {
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: true,
      },
    },
  },
  {
    category: 'Customer Info',
    name: 'Name Only',
    settings: {
      customerInfo: {
        show: true,
        showName: true,
        showPhone: false,
        showEmail: false,
        showRewardPoints: false,
      },
    },
  },
  {
    category: 'Customer Info',
    name: 'Name and Phone',
    settings: {
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: false,
        showRewardPoints: false,
      },
    },
  },
  {
    category: 'Customer Info',
    name: 'Name Phone Email (No Rewards)',
    settings: {
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: false,
      },
    },
  },
  {
    category: 'Customer Info',
    name: 'Customer Info Hidden',
    settings: {
      customerInfo: {
        show: false,
        showName: false,
        showPhone: false,
        showEmail: false,
        showRewardPoints: false,
      },
    },
  },

  // ── ITEMS ─────────────────────────────────────────────────
  {
    category: 'Items',
    name: 'All Columns',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'No SKU No Variant',
    settings: {
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'No Unit Price',
    settings: {
      items: {
        show: true,
        showSku: false,
        showVariantName: true,
        showUnitPrice: false,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'No Discount Column',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: false,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'No Tax Column',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'Qty and Total Only',
    settings: {
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: false,
        showQuantity: true,
        showDiscount: false,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'Item Name Only',
    settings: {
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: false,
        showQuantity: false,
        showDiscount: false,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: false,
      },
    },
  },
  {
    category: 'Items',
    name: 'Discount Breakdown',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'Tax Breakdown',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'Both Breakdown (Discount + Tax)',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
    },
  },
  {
    category: 'Items',
    name: 'Items Hidden',
    settings: {
      items: {
        show: false,
        showSku: false,
        showVariantName: false,
        showUnitPrice: false,
        showQuantity: false,
        showDiscount: false,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: false,
      },
    },
  },

  // ── TOTALS ────────────────────────────────────────────────
  {
    category: 'Totals',
    name: 'All Totals',
    settings: {
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: true,
        showTax: true,
      },
    },
  },
  {
    category: 'Totals',
    name: 'Subtotal and Total Only',
    settings: {
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: false,
        showShipping: false,
        showTax: false,
      },
    },
  },
  {
    category: 'Totals',
    name: 'No Subtotal',
    settings: {
      totals: {
        show: true,
        showSubtotal: false,
        showDiscount: true,
        showShipping: true,
        showTax: true,
      },
    },
  },
  {
    category: 'Totals',
    name: 'No Discount',
    settings: {
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: false,
        showShipping: true,
        showTax: true,
      },
    },
  },
  {
    category: 'Totals',
    name: 'No Shipping',
    settings: {
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: false,
        showTax: true,
      },
    },
  },
  {
    category: 'Totals',
    name: 'No Tax',
    settings: {
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: true,
        showTax: false,
      },
    },
  },
  {
    category: 'Totals',
    name: 'Totals Hidden',
    settings: {
      totals: {
        show: false,
        showSubtotal: false,
        showDiscount: false,
        showShipping: false,
        showTax: false,
      },
    },
  },

  // ── PAYMENT ───────────────────────────────────────────────
  {
    category: 'Payment',
    name: 'Full Payment Info',
    settings: {
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
    },
  },
  {
    category: 'Payment',
    name: 'No Breakdown',
    settings: {
      payment: {
        show: true,
        showBreakdown: false,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
    },
  },
  {
    category: 'Payment',
    name: 'No Received No Change',
    settings: {
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
    },
  },
  {
    category: 'Payment',
    name: 'Breakdown Only',
    settings: {
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
    },
  },
  {
    category: 'Payment',
    name: 'Payment Hidden',
    settings: {
      payment: {
        show: false,
        showBreakdown: false,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
    },
  },

  // ── NOTES ─────────────────────────────────────────────────
  {
    category: 'Notes',
    name: 'Notes Visible',
    settings: { notes: { show: true } },
  },
  {
    category: 'Notes',
    name: 'Notes Hidden',
    settings: { notes: { show: false } },
  },

  // ── FOOTER ────────────────────────────────────────────────
  {
    category: 'Footer',
    name: 'All Footer Elements',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
  },
  {
    category: 'Footer',
    name: 'Barcode + Thank You Only',
    settings: {
      footer: {
        showTerms: false,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: false,
      },
    },
  },
  {
    category: 'Footer',
    name: 'No Barcode',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: false,
        showThankYou: true,
        showPrintDate: true,
      },
    },
  },
  {
    category: 'Footer',
    name: 'Minimal Footer (Thank You Only)',
    settings: {
      footer: {
        showTerms: false,
        showBarcode: false,
        showThankYou: true,
        showPrintDate: false,
      },
    },
  },
  {
    category: 'Footer',
    name: 'No Thank You',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: false,
        showPrintDate: true,
      },
    },
  },
  {
    category: 'Footer',
    name: 'Footer Completely Hidden',
    settings: {
      footer: {
        showTerms: false,
        showBarcode: false,
        showThankYou: false,
        showPrintDate: false,
      },
    },
  },

  // ── BRANDING ──────────────────────────────────────────────
  {
    category: 'Branding',
    name: 'Currency After (BDT ৳)',
    dataOverrides: {
      currencySymbol: '৳',
      currencyPosition: 'after',
    },
  },
  {
    category: 'Branding',
    name: 'Currency Before (EUR €)',
    dataOverrides: {
      currencySymbol: '€',
      currencyPosition: 'before',
    },
  },
  {
    category: 'Branding',
    name: 'Currency After (GBP £)',
    dataOverrides: {
      currencySymbol: '£',
      currencyPosition: 'after',
    },
  },
  {
    category: 'Branding',
    name: 'With Single Line Terms',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: {
      currencySymbol: '৳',
      currencyPosition: 'before',
      footerTerms: TERMS_SINGLE_LINE,
    },
  },

  // ── FONT SIZES ────────────────────────────────────────────
  {
    category: 'Font Sizes',
    name: 'Default Fonts',
    settings: {
      fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 7.5 },
    },
  },
  {
    category: 'Font Sizes',
    name: 'Large Fonts',
    settings: {
      fontSizes: { title: 24, subtitle: 16, heading: 13, body: 12, small: 10 },
    },
  },
  {
    category: 'Font Sizes',
    name: 'Small Fonts',
    settings: {
      fontSizes: { title: 14, subtitle: 11, heading: 8, body: 7, small: 6 },
    },
  },
  {
    category: 'Font Sizes',
    name: 'Extra Small (Thermal)',
    settings: {
      fontSizes: { title: 12, subtitle: 10, heading: 7, body: 6, small: 5 },
    },
  },
  {
    category: 'Font Sizes',
    name: 'Medium Fonts',
    settings: {
      fontSizes: { title: 20, subtitle: 14, heading: 11, body: 10, small: 8 },
    },
  },

  // ── PRESETS ───────────────────────────────────────────────
  {
    category: 'Presets',
    name: 'Default (Full)',
    settings: {},
  },
  {
    category: 'Presets',
    name: 'Compact Preset',
    settings: {
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: false,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      fontSizes: { title: 16, subtitle: 11, heading: 9, body: 8, small: 7 },
    },
  },
  {
    category: 'Presets',
    name: 'Detailed Preset',
    settings: {
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: true,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: true,
      },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 7.5 },
    },
  },
  {
    category: 'Presets',
    name: 'Invoice Preset',
    settings: {
      header: {
        show: true,
        text: 'TAX INVOICE',
        showLogo: true,
        logoMaxWidth: 150,
        logoMaxHeight: 75,
        layout: 'logo-left',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showVatRegistration: true,
      },
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
      fontSizes: { title: 20, subtitle: 14, heading: 10, body: 9.5, small: 8 },
    },
  },

  // ── TERMS & CONDITIONS ────────────────────────────────────
  {
    category: 'Terms & Conditions',
    name: 'Short Single Line',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_SHORT },
  },
  {
    category: 'Terms & Conditions',
    name: 'Single Line (Long)',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_SINGLE_LINE },
  },
  {
    category: 'Terms & Conditions',
    name: 'With \\n Newlines',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_WITH_NEWLINES },
  },
  {
    category: 'Terms & Conditions',
    name: 'With <br> Tags',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_WITH_BR_TAGS },
  },
  {
    category: 'Terms & Conditions',
    name: 'With <br/> Tags',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_WITH_BR_SLASH_TAGS },
  },
  {
    category: 'Terms & Conditions',
    name: 'With <br /> Tags (Spaced)',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_WITH_BR_SPACE_TAGS },
  },
  {
    category: 'Terms & Conditions',
    name: 'Mixed \\n and <br/>',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_MIXED_BREAKS },
  },
  {
    category: 'Terms & Conditions',
    name: 'Numbered List (7 Items)',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_NUMBERED },
  },
  {
    category: 'Terms & Conditions',
    name: 'Full Legal Document',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_LEGAL },
  },
  {
    category: 'Terms & Conditions',
    name: 'With Blank Lines Between Sections',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_MULTILINE_WITH_BLANKS },
  },
  {
    category: 'Terms & Conditions',
    name: 'Bangla + English Mixed',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_BANGLA_ENGLISH },
  },
  {
    category: 'Terms & Conditions',
    name: 'Very Long Terms (Full Page)',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_VERY_LONG },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms Without Barcode',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: false,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_WITH_NEWLINES },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms Without Thank You',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: false,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_LEGAL },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms Only (No Barcode/ThankYou/Date)',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: false,
        showThankYou: false,
        showPrintDate: false,
      },
    },
    dataOverrides: { footerTerms: TERMS_NUMBERED },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With Small Font',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 6 },
    },
    dataOverrides: { footerTerms: TERMS_LEGAL },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With Large Font',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 20, subtitle: 14, heading: 11, body: 10, small: 9 },
    },
    dataOverrides: { footerTerms: TERMS_WITH_NEWLINES },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms on A5 Page',
    settings: {
      page: {
        size: 'A5',
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
      },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_NUMBERED },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms on Letter Page',
    settings: {
      page: {
        size: 'Letter',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
      },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { currencyPosition: 'after', footerTerms: TERMS_LEGAL },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With Narrow Margins',
    settings: {
      page: {
        size: 'A4',
        margins: { top: 25, right: 25, bottom: 25, left: 25 },
      },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_VERY_LONG },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With Wide Margins',
    settings: {
      page: {
        size: 'A4',
        margins: { top: 80, right: 80, bottom: 80, left: 80 },
      },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_NUMBERED },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms Hidden (Empty String)',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: '' },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With \\r\\n Line Breaks',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: {
      footerTerms:
        'Line one with CRLF\r\nLine two with CRLF\r\nLine three with CRLF',
    },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With Multiple Consecutive Breaks',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: 'Section A\n\n\nSection B\n\n\n\nSection C' },
  },
  {
    category: 'Terms & Conditions',
    name: 'Terms With Leading/Trailing Whitespace',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: {
      footerTerms:
        '\n\n   First line with leading spaces\n   Second line   \n\n   Third line   \n\n',
    },
  },
  {
    category: 'Terms & Conditions',
    name: 'Bullet Point Style Terms',
    settings: {
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
    },
    dataOverrides: { footerTerms: TERMS_RETAIL_SHOP },
  },

  // ── USE CASES ─────────────────────────────────────────────
  {
    category: 'Use Cases',
    name: 'Retail Shop Receipt',
    settings: {
      header: {
        show: true,
        text: 'RECEIPT',
        showLogo: true,
        logoMaxWidth: 100,
        logoMaxHeight: 50,
        layout: 'centered',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showVatRegistration: false,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: true,
        showCashier: true,
        showServedBy: false,
        showPriceType: false,
      },
      customerInfo: {
        show: false,
        showName: false,
        showPhone: false,
        showEmail: false,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: false,
        showTax: false,
      },
      payment: {
        show: true,
        showBreakdown: false,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
      notes: { show: false },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 16, subtitle: 11, heading: 9, body: 8, small: 7 },
    },
    dataOverrides: { footerTerms: TERMS_RETAIL_SHOP },
  },
  {
    category: 'Use Cases',
    name: 'Restaurant Bill',
    settings: {
      header: {
        show: true,
        text: 'BILL',
        showLogo: true,
        logoMaxWidth: 80,
        logoMaxHeight: 40,
        layout: 'centered',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: false,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showVatRegistration: true,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: false,
      },
      customerInfo: {
        show: false,
        showName: false,
        showPhone: false,
        showEmail: false,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: false,
        showTax: true,
      },
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
      notes: { show: true },
      footer: {
        showTerms: true,
        showBarcode: false,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 18, subtitle: 12, heading: 10, body: 9, small: 7.5 },
    },
    dataOverrides: {
      vatRegistrationNumber: 'VAT-987654321',
      footerTerms: TERMS_RESTAURANT,
    },
  },
  {
    category: 'Use Cases',
    name: 'Wholesale Invoice',
    settings: {
      header: {
        show: true,
        text: 'SALES INVOICE',
        showLogo: true,
        logoMaxWidth: 150,
        logoMaxHeight: 75,
        layout: 'logo-left',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showVatRegistration: true,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: true,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: true,
        showTax: true,
      },
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
      notes: { show: true },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: false,
        showPrintDate: true,
      },
      fontSizes: { title: 20, subtitle: 14, heading: 10, body: 9.5, small: 8 },
    },
    dataOverrides: {
      vatRegistrationNumber: 'BIN-1234567890',
      footerTerms: TERMS_WHOLESALE,
    },
  },
  {
    category: 'Use Cases',
    name: 'Online Order Receipt',
    settings: {
      header: {
        show: true,
        text: 'ORDER RECEIPT',
        showLogo: true,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: false,
        showPhone: true,
        showEmail: true,
        showVatRegistration: false,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: false,
        showServedBy: false,
        showPriceType: false,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: true,
        showTax: true,
      },
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
      notes: { show: true },
      footer: {
        showTerms: true,
        showBarcode: false,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 7.5 },
    },
    dataOverrides: { footerTerms: TERMS_ONLINE_ORDER },
  },
  {
    category: 'Use Cases',
    name: 'Thermal 80mm Receipt',
    settings: {
      page: {
        size: 'A5',
        margins: { top: 15, right: 10, bottom: 15, left: 10 },
      },
      header: {
        show: true,
        text: 'RECEIPT',
        showLogo: true,
        logoMaxWidth: 80,
        logoMaxHeight: 40,
        layout: 'centered',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: false,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showVatRegistration: false,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: true,
        showCashier: false,
        showServedBy: false,
        showPriceType: false,
      },
      customerInfo: {
        show: false,
        showName: false,
        showPhone: false,
        showEmail: false,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: false,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: false,
        showDiscount: true,
        showShipping: false,
        showTax: false,
      },
      payment: {
        show: true,
        showBreakdown: false,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
      notes: { show: false },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 14, subtitle: 10, heading: 8, body: 7, small: 6 },
    },
    dataOverrides: { footerTerms: TERMS_SHORT },
  },
  {
    category: 'Use Cases',
    name: 'Quotation Format',
    settings: {
      header: {
        show: true,
        text: 'QUOTATION',
        showLogo: true,
        logoMaxWidth: 150,
        logoMaxHeight: 75,
        layout: 'logo-left',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showVatRegistration: true,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: true,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: true,
        showTax: true,
      },
      payment: {
        show: false,
        showBreakdown: false,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
      notes: { show: true },
      footer: {
        showTerms: true,
        showBarcode: false,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 20, subtitle: 14, heading: 10, body: 9.5, small: 8 },
    },
    dataOverrides: {
      vatRegistrationNumber: 'VAT-123456789',
      footerTerms: TERMS_LEGAL,
    },
  },
  {
    category: 'Use Cases',
    name: 'Return Receipt',
    settings: {
      header: {
        show: true,
        text: 'RETURN RECEIPT',
        showLogo: true,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showVatRegistration: false,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: true,
        showServedBy: false,
        showPriceType: false,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: false,
        showRewardPoints: true,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: false,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: false,
        showShipping: false,
        showTax: true,
      },
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
      notes: { show: true },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 7.5 },
    },
    dataOverrides: { footerTerms: TERMS_MULTILINE_WITH_BLANKS },
  },
  {
    category: 'Use Cases',
    name: 'Tax Invoice (Full Legal Terms)',
    settings: {
      header: {
        show: true,
        text: 'TAX INVOICE',
        showLogo: true,
        logoMaxWidth: 150,
        logoMaxHeight: 75,
        layout: 'logo-left',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showVatRegistration: true,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: true,
        showDate: true,
        showCashier: true,
        showServedBy: true,
        showPriceType: true,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: true,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: true,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'breakdown',
        showTax: true,
        taxDisplay: 'breakdown',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: true,
        showTax: true,
      },
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
      notes: { show: false },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: false,
        showPrintDate: true,
      },
      fontSizes: { title: 20, subtitle: 14, heading: 10, body: 9.5, small: 8 },
    },
    dataOverrides: {
      vatRegistrationNumber: 'BIN-9876543210',
      footerTerms: TERMS_VERY_LONG,
    },
  },
  {
    category: 'Use Cases',
    name: 'Minimal / Hidden Everything',
    settings: {
      header: {
        show: false,
        text: '',
        showLogo: false,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
      storeInfo: {
        show: false,
        showStoreName: false,
        showBranchName: false,
        showAddress: false,
        showPhone: false,
        showEmail: false,
        showVatRegistration: false,
      },
      orderInfo: {
        show: false,
        showSaleNumber: false,
        showSaleType: false,
        showDate: false,
        showCashier: false,
        showServedBy: false,
        showPriceType: false,
      },
      customerInfo: {
        show: false,
        showName: false,
        showPhone: false,
        showEmail: false,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: false,
        showUnitPrice: false,
        showQuantity: true,
        showDiscount: false,
        discountDisplay: 'total',
        showTax: false,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: false,
        showDiscount: false,
        showShipping: false,
        showTax: false,
      },
      payment: {
        show: false,
        showBreakdown: false,
        showReceivedAmount: false,
        showChangeAmount: false,
      },
      notes: { show: false },
      footer: {
        showTerms: false,
        showBarcode: false,
        showThankYou: false,
        showPrintDate: false,
      },
    },
  },
  {
    category: 'Use Cases',
    name: 'Bilingual Invoice (Bangla + English)',
    settings: {
      header: {
        show: true,
        text: 'INVOICE / চালান',
        showLogo: true,
        logoMaxWidth: 120,
        logoMaxHeight: 60,
        layout: 'centered',
      },
      storeInfo: {
        show: true,
        showStoreName: true,
        showBranchName: true,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showVatRegistration: true,
      },
      orderInfo: {
        show: true,
        showSaleNumber: true,
        showSaleType: false,
        showDate: true,
        showCashier: true,
        showServedBy: false,
        showPriceType: false,
      },
      customerInfo: {
        show: true,
        showName: true,
        showPhone: true,
        showEmail: false,
        showRewardPoints: false,
      },
      items: {
        show: true,
        showSku: false,
        showVariantName: true,
        showUnitPrice: true,
        showQuantity: true,
        showDiscount: true,
        discountDisplay: 'total',
        showTax: true,
        taxDisplay: 'total',
        showLineTotal: true,
      },
      totals: {
        show: true,
        showSubtotal: true,
        showDiscount: true,
        showShipping: false,
        showTax: true,
      },
      payment: {
        show: true,
        showBreakdown: true,
        showReceivedAmount: true,
        showChangeAmount: true,
      },
      notes: { show: false },
      footer: {
        showTerms: true,
        showBarcode: true,
        showThankYou: true,
        showPrintDate: true,
      },
      fontSizes: { title: 18, subtitle: 13, heading: 10, body: 9, small: 7.5 },
    },
    dataOverrides: {
      vatRegistrationNumber: 'VAT-123456789',
      footerTerms: TERMS_BANGLA_ENGLISH,
    },
  },
];
