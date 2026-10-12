import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import * as bwipjs from 'bwip-js';
import { ReceiptPdfSettings } from '../preset/receipt-pdf-settings';
import {
  ReceiptPdfData,
  ReceiptPdfItem,
} from '../interfaces/receipt-pdf-data.interface';

/* ------------------------------------------------------------------ */
/*  Internal helpers for table column layout                          */
/* ------------------------------------------------------------------ */

interface ColumnDef {
  key: string;
  header: string;
  weight: number;
  align: 'left' | 'center' | 'right';
  x: number;
  width: number;
}

@Injectable()
export class ReceiptPdfService {
  private readonly logger = new Logger(ReceiptPdfService.name);
  private readonly pdfFontRegularPath = this.findFontFile(
    'NotoSansBengali-Regular.ttf',
  );
  private readonly pdfFontBoldPath = this.findFontFile(
    'NotoSansBengali-Bold.ttf',
  );

  /* ================================================================== */
  /*  PUBLIC API                                                        */
  /* ================================================================== */

  async generatePdf(
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
  ): Promise<Buffer> {
    const [logoBuffer, barcodeBuffer] = await Promise.all([
      this.loadImage(data.logoPath),
      s.footer.showBarcode && data.saleNumber
        ? this.generateBarcodeBuffer(data.saleNumber)
        : Promise.resolve(null),
    ]);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: s.page.size,
        margins: s.page.margins,
        bufferPages: true,
        info: {
          Title: `${data.headerText} - ${data.saleNumber}`,
          Author: data.storeName,
        },
      });
      this.registerPdfFonts(doc);

      const buffers: Buffer[] = [];
      doc.on('data', (b: Buffer) => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const usableWidth =
        doc.page.width - s.page.margins.left - s.page.margins.right;
      const lm = s.page.margins.left;

      let y = s.page.margins.top;

      y = this.drawStoreHeader(doc, data, s, y, usableWidth, lm, logoBuffer);
      y = this.drawHeaderLabel(doc, data, s, y, usableWidth, lm);
      y = this.drawOrderInfo(doc, data, s, y, usableWidth, lm);
      y = this.drawCustomerInfo(doc, data, s, y, usableWidth, lm);
      y = this.drawItemsTable(doc, data, s, y, usableWidth, lm);

      y = this.ensureSpace(doc, y, 100, s);
      y = this.drawTotals(doc, data, s, y, usableWidth, lm);

      y = this.ensureSpace(doc, y, 80, s);
      y = this.drawPaymentInfo(doc, data, s, y, usableWidth, lm);

      y = this.ensureSpace(doc, y, 50, s);
      y = this.drawNotes(doc, data, s, y, usableWidth, lm);

      this.drawFooter(doc, data, s, y, usableWidth, lm, barcodeBuffer);

      doc.end();
    });
  }

  private findFontFile(fileName: string): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'src/assets/fonts', fileName),
      path.resolve(process.cwd(), 'dist/assets/fonts', fileName),
      path.resolve(process.cwd(), 'dist/assets/assets/fonts', fileName),
      path.resolve(process.cwd(), 'assets/fonts', fileName),
      path.resolve(__dirname, '../../../../assets/fonts', fileName),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  }

  private registerPdfFonts(doc: PDFKit.PDFDocument): void {
    if (!this.pdfFontRegularPath || !this.pdfFontBoldPath) {
      this.logger.warn(
        'Receipt PDF Unicode fonts were not found; falling back to built-in Helvetica fonts.',
      );
      return;
    }

    doc.registerFont('ReceiptCurrency', this.pdfFontRegularPath);
    doc.registerFont('ReceiptCurrency-Bold', this.pdfFontBoldPath);
  }

  /* ================================================================== */
  /*  CURRENCY                                                          */
  /* ================================================================== */

  private fmt(amount: number, data: ReceiptPdfData): string {
    const v = amount.toFixed(2);
    return data.currencyPosition === 'before'
      ? `${data.currencySymbol}${v}`
      : `${v}${data.currencySymbol}`;
  }

  /* ================================================================== */
  /*  TEXT NORMALIZATION                                                */
  /* ================================================================== */

  private normalizeLineBreaks(text: string): string {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  /* ================================================================== */
  /*  BARCODE GENERATION                                                */
  /* ================================================================== */

  private async generateBarcodeBuffer(text: string): Promise<Buffer> {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    });
    return Buffer.from(png);
  }

  /* ================================================================== */
  /*  IMAGE HELPERS                                                     */
  /* ================================================================== */

  private async loadImage(pathOrUrl: string): Promise<Buffer | null> {
    if (!pathOrUrl) return null;

    if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
      try {
        if (fs.existsSync(pathOrUrl)) return fs.readFileSync(pathOrUrl);
      } catch {
        // ignore
      }
      return null;
    }

    try {
      const response = await fetch(pathOrUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  private getImageDimensions(
    buf: Buffer,
  ): { width: number; height: number } | null {
    try {
      // PNG
      if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
        return {
          width: buf.readUInt32BE(16),
          height: buf.readUInt32BE(20),
        };
      }
      // JPEG
      if (buf.length > 10 && buf[0] === 0xff && buf[1] === 0xd8) {
        let off = 2;
        while (off < buf.length - 9) {
          if (buf[off] !== 0xff) break;
          const marker = buf[off + 1];
          if (marker === 0xc0 || marker === 0xc2) {
            return {
              height: buf.readUInt16BE(off + 5),
              width: buf.readUInt16BE(off + 7),
            };
          }
          const segLen = buf.readUInt16BE(off + 2);
          off += 2 + segLen;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /* ================================================================== */
  /*  DRAWING PRIMITIVES                                                */
  /* ================================================================== */

  private static HEADER_ABBREVS: Record<string, string> = {
    'Unit Price': 'Unit Pr.',
    Discount: 'Disc.',
    Item: 'Item',
    SKU: 'SKU',
    Qty: 'Qty',
    Tax: 'Tax',
    Total: 'Total',
  };

  private truncateText(
    doc: PDFKit.PDFDocument,
    text: string,
    maxWidth: number,
    abbrevMap?: Record<string, string>,
  ): string {
    if (maxWidth <= 0) return '';
    if (doc.widthOfString(text) <= maxWidth) return text;

    if (abbrevMap && abbrevMap[text]) {
      const abbr = abbrevMap[text];
      if (doc.widthOfString(abbr) <= maxWidth) return abbr;
    }

    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = text.substring(0, mid) + '…';
      if (doc.widthOfString(candidate) <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo > 0 ? text.substring(0, lo) + '…' : '…';
  }

  private widthOfCurrencyAwareText(
    doc: PDFKit.PDFDocument,
    text: string,
    font: string,
    fontSize: number,
    bold = false,
  ): number {
    if (!text.includes('৳') || !this.pdfFontRegularPath) {
      return doc.font(font).fontSize(fontSize).widthOfString(text);
    }

    let width = 0;
    for (const part of this.splitCurrencyText(text)) {
      doc
        .font(part === '৳' ? this.currencyFontName(bold) : font)
        .fontSize(fontSize);
      width += doc.widthOfString(part);
    }
    doc.font(font).fontSize(fontSize);
    return width;
  }

  private drawCurrencyAwareText(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    options: PDFKit.Mixins.TextOptions & {
      font: string;
      fontSize: number;
      bold?: boolean;
    },
  ): void {
    const {
      font,
      fontSize,
      bold = false,
      width,
      align,
      ...textOptions
    } = options;

    if (!text.includes('৳') || !this.pdfFontRegularPath) {
      doc
        .font(font)
        .fontSize(fontSize)
        .text(text, x, y, {
          width,
          align,
          ...textOptions,
        });
      return;
    }

    let cursorX = x;
    const totalWidth = this.widthOfCurrencyAwareText(
      doc,
      text,
      font,
      fontSize,
      bold,
    );

    if (width && align === 'right') cursorX = x + width - totalWidth;
    if (width && align === 'center') cursorX = x + (width - totalWidth) / 2;

    for (const part of this.splitCurrencyText(text)) {
      const isCurrencyGlyph = part === '৳';
      const partFont = isCurrencyGlyph ? this.currencyFontName(bold) : font;
      const partY = isCurrencyGlyph
        ? y + this.currencyGlyphYOffset(fontSize)
        : y;
      doc
        .font(partFont)
        .fontSize(fontSize)
        .text(part, cursorX, partY, {
          ...textOptions,
          lineBreak: false,
        });
      cursorX += doc.font(partFont).fontSize(fontSize).widthOfString(part);
    }

    doc.font(font).fontSize(fontSize);
  }

  private splitCurrencyText(text: string): string[] {
    return text.split(/(৳)/).filter(Boolean);
  }

  private currencyFontName(bold: boolean): string {
    return bold && this.pdfFontBoldPath
      ? 'ReceiptCurrency-Bold'
      : 'ReceiptCurrency';
  }

  private currencyGlyphYOffset(fontSize: number): number {
    return -fontSize * 0.16;
  }

  private hr(
    doc: PDFKit.PDFDocument,
    y: number,
    left: number,
    width: number,
  ): number {
    doc
      .save()
      .moveTo(left, y)
      .lineTo(left + width, y)
      .lineWidth(0.5)
      .strokeColor('#000000')
      .stroke()
      .restore();
    return y + 4;
  }

  private doubleHr(
    doc: PDFKit.PDFDocument,
    y: number,
    left: number,
    width: number,
  ): number {
    const safeWidth = Math.max(0, width);
    doc
      .save()
      .moveTo(left, y)
      .lineTo(left + safeWidth, y)
      .moveTo(left, y + 2)
      .lineTo(left + safeWidth, y + 2)
      .lineWidth(0.75)
      .strokeColor('#000000')
      .stroke()
      .restore();
    return y + 6;
  }

  private ensureSpace(
    doc: PDFKit.PDFDocument,
    y: number,
    needed: number,
    s: ReceiptPdfSettings,
  ): number {
    if (y + needed > doc.page.height - s.page.margins.bottom) {
      doc.addPage();
      return s.page.margins.top;
    }
    return y;
  }

  private drawKeyValueRight(
    doc: PDFKit.PDFDocument,
    key: string,
    value: string,
    y: number,
    rightEdge: number,
    fontSize: number,
    bold = false,
    keyAlign: 'left' | 'right' = 'left',
  ): number {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);

    const valueFont = bold ? 'Helvetica-Bold' : 'Helvetica';
    const vw = this.widthOfCurrencyAwareText(
      doc,
      value,
      valueFont,
      fontSize,
      bold,
    );
    const valueX = rightEdge - vw;
    const gap = 8;

    const keyAvailableWidth = Math.max(0, valueX - gap - doc.page.margins.left);
    const keyTextWidth = doc
      .font('Helvetica')
      .fontSize(fontSize)
      .widthOfString(key);
    const keyMaxWidth =
      keyAlign === 'right'
        ? Math.min(Math.max(keyTextWidth + 2, 40), keyAvailableWidth)
        : keyAvailableWidth;
    const keyStartX =
      keyAlign === 'right' ? valueX - gap - keyMaxWidth : doc.page.margins.left;

    this.drawCurrencyAwareText(doc, value, valueX, y, {
      width: vw + 2,
      lineBreak: false,
      align: 'right',
      font: valueFont,
      fontSize,
      bold,
    });

    doc.font('Helvetica').fontSize(fontSize);

    if (keyMaxWidth > 0) {
      const keyHeight = doc.heightOfString(key, { width: keyMaxWidth });
      doc.text(key, keyStartX, y, {
        width: keyMaxWidth,
        align: keyAlign,
        lineBreak: true,
      });
      return y + keyHeight + 5;
    }

    return y + fontSize + 5;
  }

  private drawRightAlignedKeyValueRows(
    doc: PDFKit.PDFDocument,
    rows: { key: string; value: string; bold?: boolean }[],
    y: number,
    rightEdge: number,
    fontSize: number,
  ): number {
    if (!rows.length) return y;

    const gap = 8;
    const leftEdge = doc.page.margins.left;

    const valueWidths = rows.map((row) =>
      this.widthOfCurrencyAwareText(
        doc,
        row.value,
        row.bold ? 'Helvetica-Bold' : 'Helvetica',
        fontSize,
        !!row.bold,
      ),
    );
    const maxValueWidth = Math.max(...valueWidths);
    const labelRightEdge = rightEdge - maxValueWidth - gap;
    const availableLabelWidth = Math.max(0, labelRightEdge - leftEdge);

    if (availableLabelWidth <= 0) {
      return rows.reduce(
        (currentY, row) =>
          this.drawKeyValueRight(
            doc,
            row.key,
            row.value,
            currentY,
            rightEdge,
            fontSize,
            !!row.bold,
          ),
        y,
      );
    }

    const labelWidth = Math.min(
      Math.max(
        ...rows.map((row) =>
          doc
            .font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(fontSize)
            .widthOfString(row.key),
        ),
        40,
      ) + 2,
      availableLabelWidth,
    );
    const labelX = labelRightEdge - labelWidth;

    rows.forEach((row, index) => {
      const bold = !!row.bold;
      const valueFont = bold ? 'Helvetica-Bold' : 'Helvetica';
      const valueX = rightEdge - valueWidths[index];

      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(row.key, labelX, y, {
          width: labelWidth,
          align: 'right',
          lineBreak: false,
        });

      this.drawCurrencyAwareText(doc, row.value, valueX, y, {
        width: valueWidths[index] + 2,
        lineBreak: false,
        align: 'right',
        font: valueFont,
        fontSize,
        bold,
      });

      y += fontSize + 5;
    });

    return y;
  }

  private formatDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  /* ================================================================== */
  /*  SECTION: Store Header                                             */
  /* ================================================================== */

  private drawStoreHeader(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
    logoBuffer: Buffer | null,
  ): number {
    if (!s.storeInfo.show && !s.header.showLogo) return y;

    const cx = lm + uw / 2;
    let logoDrawn = false;

    if (s.header.showLogo && logoBuffer && logoBuffer.length > 0) {
      try {
        const dims = this.getImageDimensions(logoBuffer);
        let renderedH = s.header.logoMaxHeight;
        if (dims) {
          const scale = Math.min(
            s.header.logoMaxWidth / dims.width,
            s.header.logoMaxHeight / dims.height,
          );
          renderedH = Math.ceil(dims.height * scale);
        }

        if (s.header.layout === 'logo-left') {
          doc.image(logoBuffer, lm, y, {
            fit: [s.header.logoMaxWidth, s.header.logoMaxHeight],
          });
          const logoBottom = y + renderedH + 8;
          const infoW = Math.max(0, uw - s.header.logoMaxWidth - 15);

          if (infoW > 50) {
            y = this.drawStoreInfoBlock(
              doc,
              data,
              s,
              y + 4,
              lm + s.header.logoMaxWidth + 15,
              infoW,
            );
          } else {
            y += renderedH + 8;
            y = this.drawStoreInfoBlock(doc, data, s, y, lm, uw);
          }
          y = Math.max(y, logoBottom);
        } else {
          doc.image(logoBuffer, cx - s.header.logoMaxWidth / 2, y, {
            fit: [s.header.logoMaxWidth, s.header.logoMaxHeight],
          });
          y += renderedH + 6;
          y = this.drawStoreInfoBlock(doc, data, s, y, lm, uw);
        }

        logoDrawn = true;
      } catch {
        // ignore
      }
    }

    if (!logoDrawn) {
      y = this.drawStoreInfoBlock(doc, data, s, y, lm, uw);
    }

    y = this.hr(doc, y, lm, uw);
    return y;
  }

  private drawStoreInfoBlock(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    x: number,
    maxW: number,
  ): number {
    if (!s.storeInfo.show) return y;

    if (s.storeInfo.showStoreName && data.storeName) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.subtitle)
        .text(data.storeName, x, y, { width: maxW, align: 'center' });
      y += s.fontSizes.subtitle + 3;
    }

    if (s.storeInfo.showBranchName && data.branchName) {
      doc
        .font('Helvetica')
        .fontSize(s.fontSizes.body)
        .text(data.branchName, x, y, { width: maxW, align: 'center' });
      y += s.fontSizes.body + 2;
    }

    const contactLines: string[] = [];
    if (s.storeInfo.showAddress && data.branchAddress) {
      contactLines.push(data.branchAddress);
    }
    if (s.storeInfo.showPhone && data.branchPhone) {
      contactLines.push('Tel: ' + data.branchPhone);
    }
    if (s.storeInfo.showEmail && data.branchEmail) {
      contactLines.push(data.branchEmail);
    }

    if (contactLines.length) {
      doc
        .font('Helvetica')
        .fontSize(s.fontSizes.small)
        .text(contactLines.join('  |  '), x, y, {
          width: maxW,
          align: 'center',
        });
      y += s.fontSizes.small + 2;
    }

    if (s.storeInfo.showVatRegistration && data.vatRegistrationNumber) {
      doc
        .font('Helvetica')
        .fontSize(s.fontSizes.small)
        .text('VAT Reg: ' + data.vatRegistrationNumber, x, y, {
          width: maxW,
          align: 'center',
        });
      y += s.fontSizes.small + 2;
    }

    return y + 2;
  }

  /* ================================================================== */
  /*  SECTION: Header Label                                             */
  /* ================================================================== */

  private drawHeaderLabel(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.header.show) return y;

    const label = data.headerText || 'RECEIPT';

    doc
      .font('Helvetica-Bold')
      .fontSize(s.fontSizes.title)
      .text(label, lm, y, { width: uw, align: 'center' });

    y += s.fontSizes.title + 4;
    y = this.doubleHr(doc, y, lm, uw);
    return y;
  }

  /* ================================================================== */
  /*  SECTION: Order Information                                        */
  /* ================================================================== */

  private drawOrderInfo(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.orderInfo.show) return y;

    const halfW = uw / 2 - 10;
    const leftX = lm;
    const rightX = lm + halfW + 20;
    const lh = s.fontSizes.body + 3;

    const startY = y;

    if (s.orderInfo.showSaleNumber && data.saleNumber) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Sale No:', leftX, y, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + data.saleNumber);
      y += lh;
    }

    if (s.orderInfo.showSaleNumber && data.exchangeSaleNumber) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Exchange Sale No:', leftX, y, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + data.exchangeSaleNumber);
      y += lh;
    }

    if (s.orderInfo.showDate) {
      const dateStr = this.formatDate(data.saleDate);
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Date:', leftX, y, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + dateStr);
      y += lh;
    }

    if (s.orderInfo.showSaleType && data.saleType) {
      const typeLabel =
        data.saleType.charAt(0).toUpperCase() + data.saleType.slice(1);
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Type:', leftX, y, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + typeLabel);
      y += lh;
    }

    if (s.orderInfo.showPriceType && data.priceType) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Price Type:', leftX, y, { continued: true, width: halfW })
        .font('Helvetica')
        .text(
          ' ' +
            data.priceType.charAt(0).toUpperCase() +
            data.priceType.slice(1),
        );
      y += lh;
    }

    let ry = Math.max(startY, y - lh * this.countOrderRightFields(data, s));

    if (s.orderInfo.showCashier && data.cashierName) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Cashier:', rightX, ry, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + data.cashierName);
      ry += lh;
    }

    if (s.orderInfo.showServedBy && data.servedByName) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Served By:', rightX, ry, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + data.servedByName);
      ry += lh;
    }

    if (data.isOnlineOrder && data.onlineOrderStatus) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.body)
        .text('Status:', rightX, ry, { continued: true, width: halfW })
        .font('Helvetica')
        .text(' ' + data.onlineOrderStatus);
      ry += lh;
    }

    y = Math.max(y, ry);
    y = this.hr(doc, y, lm, uw);
    return y;
  }

  private countOrderRightFields(
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
  ): number {
    let n = 0;
    if (s.orderInfo.showCashier && data.cashierName) n++;
    if (s.orderInfo.showServedBy && data.servedByName) n++;
    if (data.isOnlineOrder && data.onlineOrderStatus) n++;
    return n;
  }

  /* ================================================================== */
  /*  SECTION: Customer Information                                     */
  /* ================================================================== */

  private drawCustomerInfo(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.customerInfo.show) return y;
    if (
      !data.customerName &&
      !data.customerPhone &&
      !data.customerEmail &&
      !data.customerAddress
    ) {
      return y;
    }

    const lh = s.fontSizes.body + 3;

    doc
      .font('Helvetica-Bold')
      .fontSize(s.fontSizes.heading)
      .text('Customer', lm, y, { width: uw });
    y += s.fontSizes.heading + 4;

    if (s.customerInfo.showName && data.customerName) {
      doc
        .font('Helvetica')
        .fontSize(s.fontSizes.body)
        .text(data.customerName, lm, y, { width: uw });
      y += lh;
    }

    if (s.customerInfo.showPhone && data.customerPhone) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.small)
        .text('Phone: ', lm, y, { continued: true, width: uw })
        .font('Helvetica')
        .text(data.customerPhone);
      y += s.fontSizes.small + 3;
    }

    if (s.customerInfo.showEmail && data.customerEmail) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.small)
        .text('Email: ', lm, y, { continued: true, width: uw })
        .font('Helvetica')
        .text(data.customerEmail);
      y += s.fontSizes.small + 3;
    }

    if (s.customerInfo.showAddress && data.customerAddress) {
      const addressText = this.normalizeLineBreaks(data.customerAddress);
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.small)
        .text('Address: ', lm, y, { continued: true, width: uw })
        .font('Helvetica')
        .text(addressText, { width: uw });
      y = doc.y + 3;
    }

    if (s.customerInfo.showRewardPoints && data.customerRewardPoints !== null) {
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.small)
        .text('Reward Points: ', lm, y, { continued: true, width: uw })
        .font('Helvetica')
        .text(String(data.customerRewardPoints));
      y += s.fontSizes.small + 3;
    }

    y = this.hr(doc, y, lm, uw);
    return y;
  }

  /* ================================================================== */
  /*  SECTION: Items Table                                              */
  /* ================================================================== */

  private drawItemsTable(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.items.show || !data.items.length) return y;

    const cols = this.buildItemColumns(s, uw, lm);

    y = this.ensureSpace(doc, y, 30, s);
    y = this.drawItemTableHeader(doc, cols, y, s);
    y = this.hr(doc, y, lm, uw);

    for (const item of data.items) {
      y = this.ensureSpace(doc, y, s.fontSizes.body + 12, s);
      y = this.drawItemRow(doc, data, item, cols, y, s, uw, lm);
    }

    y = this.hr(doc, y, lm, uw);
    return y;
  }

  private buildItemColumns(
    s: ReceiptPdfSettings,
    uw: number,
    lm: number,
  ): ColumnDef[] {
    interface ColSpec {
      key: string;
      header: string;
      weight: number;
      align: 'left' | 'center' | 'right';
    }

    const specs: ColSpec[] = [];

    specs.push({ key: 'item', header: 'Item', weight: 5, align: 'left' });

    if (s.items.showSku) {
      specs.push({ key: 'sku', header: 'SKU', weight: 1.8, align: 'left' });
    }

    if (s.items.showQuantity) {
      specs.push({ key: 'qty', header: 'Qty', weight: 1, align: 'center' });
    }

    if (s.items.showUnitPrice) {
      specs.push({
        key: 'unitPrice',
        header: 'Unit Price',
        weight: 1.6,
        align: 'right',
      });
    }

    if (s.items.showDiscount) {
      specs.push({
        key: 'discount',
        header: 'Discount',
        // Wider than the other money columns: the cell carries "-৳5.00 (10%)".
        weight: 2.2,
        align: 'right',
      });
    }

    if (s.items.showTax) {
      specs.push({
        key: 'tax',
        header: 'Tax',
        weight: 1.4,
        align: 'right',
      });
    }

    if (s.items.showLineTotal) {
      specs.push({
        key: 'total',
        header: 'Total',
        weight: 1.6,
        align: 'right',
      });
    }

    const totalWeight = specs.reduce((a, c) => a + c.weight, 0);

    let x = lm;
    return specs.map((sp) => {
      const w = (sp.weight / totalWeight) * uw;
      const col: ColumnDef = { ...sp, x, width: w };
      x += w;
      return col;
    });
  }

  private drawItemTableHeader(
    doc: PDFKit.PDFDocument,
    cols: ColumnDef[],
    y: number,
    s: ReceiptPdfSettings,
  ): number {
    doc.font('Helvetica-Bold').fontSize(s.fontSizes.heading);

    for (const c of cols) {
      const pad = 4;
      const maxW = c.width - pad;

      const displayHeader = this.truncateText(
        doc,
        c.header,
        maxW,
        ReceiptPdfService.HEADER_ABBREVS,
      );

      doc.text(displayHeader, c.x + pad / 2, y, {
        width: maxW,
        align: c.align,
        lineBreak: false,
      });
    }

    return y + s.fontSizes.heading + 5;
  }

  /**
   * " (10%)" — the discount as a share of the line before discount. Empty when
   * the base is unknown or the rate would round to nothing meaningful.
   */
  private discountPercentSuffix(item: ReceiptPdfItem, amount: number): string {
    const grossLine = item.unitPrice * item.quantity;
    if (grossLine <= 0 || amount <= 0) return '';

    const pct = (amount / grossLine) * 100;
    if (pct < 0.01) return '';

    const rounded = Math.round(pct * 100) / 100;
    return ` (${rounded}%)`;
  }

  private drawItemRow(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    item: ReceiptPdfItem,
    cols: ColumnDef[],
    y: number,
    s: ReceiptPdfSettings,
    uw: number,
    lm: number,
  ): number {
    let displayName = item.productName;
    if (s.items.showVariantName && item.variantName) {
      const isDefault =
        item.variantName.toLowerCase() === 'default' ||
        item.variantName.toLowerCase() === item.productName.toLowerCase();
      if (!isDefault) {
        displayName += ` - ${item.variantName}`;
      }
    }

    const values: Record<string, string> = {
      item: displayName,
      sku: item.sku || '—',
      qty: String(item.quantity),
      unitPrice: this.fmt(item.unitPrice, data),
      discount:
        item.totalDiscount > 0
          ? '-' +
            this.fmt(item.totalDiscount, data) +
            this.discountPercentSuffix(item, item.totalDiscount)
          : '—',
      tax:
        item.taxAmount > 0
          ? `${this.fmt(item.taxAmount, data)} ${item.taxMethod === 'INCLUSIVE' ? 'Inc.' : 'Exc.'}`
          : '—',
      total: this.fmt(item.lineTotal, data),
    };

    doc.font('Helvetica').fontSize(s.fontSizes.body);
    let rowH = s.fontSizes.body + 4;
    for (const c of cols) {
      if (c.key === 'item' && values.item) {
        const h = doc.heightOfString(values.item, { width: c.width - 4 });
        rowH = Math.max(rowH, h + 4);
      }
    }

    const padding = 2;
    for (const c of cols) {
      const val = values[c.key] || '';
      const maxW = c.width - padding * 2;
      const font = 'Helvetica';
      doc.font(font).fontSize(s.fontSizes.body);

      let displayVal = val;
      if (c.key !== 'item') {
        displayVal = this.truncateText(doc, val, maxW);
      }

      this.drawCurrencyAwareText(doc, displayVal, c.x + padding, y + 2, {
        width: maxW,
        align: c.align,
        lineBreak: c.key === 'item',
        font,
        fontSize: s.fontSizes.body,
      });
    }

    y += rowH;

    if (
      s.items.showDiscount &&
      s.items.discountDisplay === 'breakdown' &&
      (item.specialDiscount > 0 || item.promotionDiscount > 0)
    ) {
      y = this.ensureSpace(doc, y, 14, s);
      const indent = lm + 12;
      const parts: string[] = [];

      // Each discount carries its rate as well as its amount, the way the tax
      // breakdown does — a flat "-৳5.00" alone doesn't say how deep the cut was.
      if (item.specialDiscount > 0) {
        parts.push(
          `Special Discount${this.discountPercentSuffix(item, item.specialDiscount)}: ${this.fmt(item.specialDiscount, data)}`,
        );
      }
      if (item.promotionDiscount > 0) {
        parts.push(
          `Promotion Discount${this.discountPercentSuffix(item, item.promotionDiscount)}: ${this.fmt(item.promotionDiscount, data)}`,
        );
      }
      if (item.averageDiscount > 0) {
        parts.push(
          `Average Discount${this.discountPercentSuffix(item, item.averageDiscount)}: ${this.fmt(item.averageDiscount, data)}`,
        );
      }

      doc.font('Helvetica').fontSize(s.fontSizes.small).fillColor('#333333');
      this.drawCurrencyAwareText(doc, parts.join('   |   '), indent, y, {
        width: uw - 12,
        font: 'Helvetica',
        fontSize: s.fontSizes.small,
      });
      doc.fillColor('#000000');
      y += s.fontSizes.small + 3;
    }

    if (
      s.items.showTax &&
      s.items.taxDisplay === 'breakdown' &&
      item.taxAmount > 0
    ) {
      y = this.ensureSpace(doc, y, 14, s);
      const indent = lm + 12;
      const methodLabel = item.taxMethod === 'INCLUSIVE' ? 'Incl.' : 'Excl.';
      const taxLine =
        item.taxPercentage > 0
          ? `Tax (${item.taxPercentage}% ${methodLabel}): ${this.fmt(item.taxAmount, data)}`
          : `Tax (${methodLabel}): ${this.fmt(item.taxAmount, data)}`;

      doc.font('Helvetica').fontSize(s.fontSizes.small).fillColor('#333333');
      this.drawCurrencyAwareText(doc, taxLine, indent, y, {
        width: uw - 12,
        font: 'Helvetica',
        fontSize: s.fontSizes.small,
      });
      doc.fillColor('#000000');
      y += s.fontSizes.small + 3;
    }

    return y;
  }

  /* ================================================================== */
  /*  SECTION: Totals                                                   */
  /* ================================================================== */

  private drawTotals(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.totals.show) return y;

    const rightEdge = lm + uw;
    const fs = s.fontSizes.body;
    const totalRows: { key: string; value: string; bold?: boolean }[] = [];

    if (s.totals.showSubtotal) {
      totalRows.push({
        key: 'Subtotal:',
        value: this.fmt(data.subtotal, data),
      });
    }

    if (s.totals.showDiscount && data.discountAmount > 0) {
      totalRows.push({
        key: 'Discount:',
        value: '-' + this.fmt(data.discountAmount, data),
      });
    }

    if (
      s.totals.showDiscount &&
      data.promotionDiscount > 0 &&
      data.discountAmount !== data.promotionDiscount
    ) {
      totalRows.push({
        key: 'Promo Discount:',
        value: '-' + this.fmt(data.promotionDiscount, data),
      });
    }

    if (s.totals.showShipping && data.shippingCost > 0) {
      totalRows.push({
        key: 'Shipping:',
        value: this.fmt(data.shippingCost, data),
      });
    }

    if (s.totals.showTax && data.taxAmount > 0) {
      totalRows.push({ key: 'Tax:', value: this.fmt(data.taxAmount, data) });
    }

    if (s.totals.titleAlign === 'right') {
      y = this.drawRightAlignedKeyValueRows(doc, totalRows, y, rightEdge, fs);
    } else {
      for (const row of totalRows) {
        y = this.drawKeyValueRight(doc, row.key, row.value, y, rightEdge, fs);
      }
    }

    y += 2;
    const hrWidth = Math.min(Math.max(uw * 0.6, 100), uw);
    y = this.doubleHr(doc, y, rightEdge - hrWidth, hrWidth);
    if (s.totals.titleAlign === 'right') {
      y = this.drawRightAlignedKeyValueRows(
        doc,
        [
          {
            key: 'TOTAL:',
            value: this.fmt(data.totalAmount, data),
            bold: true,
          },
        ],
        y,
        rightEdge,
        s.fontSizes.subtitle,
      );
    } else {
      y = this.drawKeyValueRight(
        doc,
        'TOTAL:',
        this.fmt(data.totalAmount, data),
        y,
        rightEdge,
        s.fontSizes.subtitle,
        true,
      );
    }
    y += 4;

    y = this.hr(doc, y, lm, uw);
    return y;
  }

  /* ================================================================== */
  /*  SECTION: Payment Information                                      */
  /* ================================================================== */

  private drawPaymentInfo(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.payment.show) return y;
    if (!data.payments.length && data.paymentStatus === 'paid') return y;

    const rightEdge = lm + uw;
    const fs = s.fontSizes.body;

    doc
      .font('Helvetica-Bold')
      .fontSize(s.fontSizes.heading)
      .text('Payment', lm, y, {
        width: uw,
        align: s.payment.titleAlign === 'right' ? 'right' : 'left',
      });
    y += s.fontSizes.heading + 6;

    const paymentRows: { key: string; value: string }[] = [];

    if (s.payment.showBreakdown && data.payments.length > 0) {
      for (const p of data.payments) {
        let label = p.method;
        if (p.type) label += ' (' + p.type + ')';
        if (s.payment.showPaymentDate && p.date) {
          label += ' — ' + this.formatDate(p.date);
        }
        if (s.payment.showReference !== false && p.reference) {
          label += ' — Ref: ' + p.reference;
        }

        paymentRows.push({ key: label + ':', value: this.fmt(p.amount, data) });
      }
    } else if (data.payments.length === 1) {
      const p = data.payments[0];
      paymentRows.push({
        key: 'Method:',
        value: p.method + (p.type ? ' (' + p.type + ')' : ''),
      });
    }

    // Per-payment money receipts carry the balance the payment was set against.
    if (data.previousDueAmount !== undefined) {
      paymentRows.push({
        key: 'Previous Balance:',
        value: this.fmt(data.previousDueAmount, data),
      });
    }

    if (s.payment.showReceivedAmount && data.receivedAmount > 0) {
      paymentRows.push({
        key: 'Received:',
        value: this.fmt(data.receivedAmount, data),
      });
    }

    if (s.payment.showChangeAmount && data.changeAmount > 0) {
      paymentRows.push({
        key: 'Change:',
        value: this.fmt(data.changeAmount, data),
      });
    }

    if (
      s.payment.showDueAmount !== false &&
      (data.dueAmount > 0 || data.previousDueAmount !== undefined)
    ) {
      paymentRows.push({
        // On a per-payment receipt a ৳0 balance is the point of the document,
        // so it is printed even when nothing is left owing.
        key: data.previousDueAmount !== undefined ? 'Balance Due:' : 'Due:',
        value: this.fmt(data.dueAmount, data),
      });
    }

    if (s.payment.titleAlign === 'right') {
      y = this.drawRightAlignedKeyValueRows(doc, paymentRows, y, rightEdge, fs);
    } else {
      for (const row of paymentRows) {
        y = this.drawKeyValueRight(doc, row.key, row.value, y, rightEdge, fs);
      }
    }

    if (data.paymentStatus && data.paymentStatus !== 'paid') {
      doc
        .font('Helvetica-Bold')
        .fontSize(fs)
        .text(
          'Status: ' +
            data.paymentStatus.charAt(0).toUpperCase() +
            data.paymentStatus.slice(1),
          lm,
          y,
        );
      y += fs + 5;
    }

    y = this.hr(doc, y, lm, uw);
    return y;
  }

  /* ================================================================== */
  /*  SECTION: Notes                                                    */
  /* ================================================================== */

  private drawNotes(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
  ): number {
    if (!s.notes.show || !data.notes) return y;

    doc
      .font('Helvetica-Bold')
      .fontSize(s.fontSizes.heading)
      .text('Notes', lm, y, { width: uw });
    y += s.fontSizes.heading + 4;

    const normalizedNotes = this.normalizeLineBreaks(data.notes);
    doc
      .font('Helvetica-Oblique')
      .fontSize(s.fontSizes.small)
      .text(normalizedNotes, lm, y, { width: uw });
    y +=
      doc.fontSize(s.fontSizes.small).heightOfString(normalizedNotes, {
        width: uw,
      }) + 6;

    y = this.hr(doc, y, lm, uw);
    return y;
  }

  /* ================================================================== */
  /*  SECTION: Footer                                                   */
  /* ================================================================== */

  private drawFooter(
    doc: PDFKit.PDFDocument,
    data: ReceiptPdfData,
    s: ReceiptPdfSettings,
    y: number,
    uw: number,
    lm: number,
    barcodeBuffer: Buffer | null,
  ): number {
    // --- Machine-readable Barcode ---
    if (s.footer.showBarcode && data.saleNumber) {
      y = this.ensureSpace(doc, y, 70, s);
      y = this.drawBarcode(doc, y, lm, uw, barcodeBuffer);
    }

    // --- Preformatted Terms & Conditions ---
    if (s.footer.showTerms && data.footerTerms) {
      doc.font('Helvetica').fontSize(s.fontSizes.small);
      const termsHeight = doc.heightOfString(data.footerTerms, {
        width: uw,
      });
      y = this.ensureSpace(doc, y, termsHeight + 30, s);

      y = this.hr(doc, y, lm, uw);
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.small)
        .text('Terms & Conditions', lm, y, { width: uw });
      y += s.fontSizes.small + 4;

      doc
        .font('Helvetica')
        .fontSize(s.fontSizes.small)
        .text(data.footerTerms, lm, y, { width: uw, lineGap: 2 });

      y +=
        doc.fontSize(s.fontSizes.small).heightOfString(data.footerTerms, {
          width: uw,
          lineGap: 2,
        }) + 8;
    }

    // --- Thank you ---
    if (s.footer.showThankYou) {
      y = this.ensureSpace(doc, y, 30, s);
      y += 10;
      doc
        .font('Helvetica-Bold')
        .fontSize(s.fontSizes.subtitle)
        .text('Thank you for your business!', lm, y, {
          width: uw,
          align: 'center',
        });
      y += s.fontSizes.subtitle + 4;
    }

    // --- Print date ---
    if (s.footer.showPrintDate) {
      y = this.ensureSpace(doc, y, 16, s);
      const now = new Date();
      doc
        .font('Helvetica')
        .fontSize(s.fontSizes.small)
        .text('Printed: ' + this.formatDate(now), lm, y, {
          width: uw,
          align: 'center',
        });
      y += s.fontSizes.small + 3;
    }

    // --- Powered by ---
    doc
      .font('Helvetica-Oblique')
      .fontSize(s.fontSizes.small)
      .text('Powered by Posbuzz', lm, y, { width: uw, align: 'center' });
    y += s.fontSizes.small + 3;

    return y;
  }

  /* ================================================================== */
  /*  BARCODE DRAWING                                                   */
  /* ================================================================== */

  private drawBarcode(
    doc: PDFKit.PDFDocument,
    y: number,
    lm: number,
    uw: number,
    barcodeBuffer: Buffer | null,
  ): number {
    if (barcodeBuffer && barcodeBuffer.length > 0) {
      const barcodeW = Math.min(250, uw * 0.7);
      const barcodeH = 55;
      const bx = lm + (uw - barcodeW) / 2;

      doc.image(barcodeBuffer, bx, y, {
        width: barcodeW,
        height: barcodeH,
      });

      return y + barcodeH + 8;
    }

    // Fallback
    const boxW = Math.min(220, uw * 0.65);
    const boxH = 40;
    const bx = lm + (uw - boxW) / 2;

    doc
      .save()
      .roundedRect(bx, y, boxW, boxH, 3)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    doc
      .font('Helvetica')
      .fontSize(11)
      .text('BARCODE', bx + 10, y + 12, {
        width: boxW - 20,
        align: 'center',
      });

    return y + boxH + 8;
  }
}
