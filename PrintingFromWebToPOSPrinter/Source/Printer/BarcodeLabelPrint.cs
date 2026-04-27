using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using ZXing;
using System.Drawing.Printing;
using Printer.Services;

namespace Printer
{
    public class BarcodeLabelPrint
    {
        // Label physical dimensions at 600 DPI: 1.50" x 1.00"
        private static readonly int LabelWidth        = (int)(1.50 * 600); // 900 px
        private static readonly int LabelHeight       = (int)(1.00 * 600); // 600 px
        private static readonly int ExposedLinerWidth  = (int)(0.04 * 600); // 24 px each side
        private static readonly int PrintableWidth    = (int)(1.50 * 600) - 2 * (int)(0.04 * 600);
        private static readonly int PrintableHeight   = (int)(1.00 * 600);

        // Barcode image horizontal margins
        private const int BARCODE_SIDE_MARGIN = 40;

        // Font size bounds — MIN is deliberately small so wrapping wins over clipping
        private const float FONT_LARGE_MAX  = 36f;
        private const float FONT_LARGE_MIN  = 10f;
        private const float FONT_MEDIUM_MAX = 26f;
        private const float FONT_MEDIUM_MIN = 9f;

        // ── Barcode generation ────────────────────────────────────────────────────

        private static Bitmap GenerateRobustBarcode(string barcodeValue, BarcodeFormat preferredFormat, int width, int height)
        {
            var writer = new BarcodeWriter
            {
                Format  = preferredFormat,
                Options = new ZXing.Common.EncodingOptions { Width = width, Height = height, Margin = 0, PureBarcode = false }
            };

            try { return writer.Write(barcodeValue); }
            catch (Exception ex) { Console.WriteLine("Failed " + preferredFormat + ": " + ex.Message); }

            if (preferredFormat == BarcodeFormat.EAN_13 && barcodeValue.Length >= 12)
                try { return writer.Write(FixEan13Checksum(barcodeValue)); } catch { }

            if (barcodeValue.Length == 12 && barcodeValue.All(char.IsDigit))
                try { writer.Format = BarcodeFormat.UPC_A; return writer.Write(FixUpcChecksum(barcodeValue)); } catch { }

            try { writer.Format = BarcodeFormat.CODE_128; return writer.Write(barcodeValue); } catch { }

            try
            {
                writer.Format = BarcodeFormat.CODE_39;
                string v = barcodeValue;
                if (!v.StartsWith("*")) v = "*" + v;
                if (!v.EndsWith("*"))   v = v + "*";
                return writer.Write(v);
            }
            catch { }

            return CreateTextBarcode(barcodeValue, width, height);
        }

        private static string FixEan13Checksum(string s)
        {
            string b = s.Substring(0, 12);
            int sum = 0;
            for (int i = 0; i < 12; i++) sum += int.Parse(b[i].ToString()) * (i % 2 == 0 ? 1 : 3);
            return b + ((10 - sum % 10) % 10).ToString();
        }

        private static string FixUpcChecksum(string s)
        {
            string b = s.Substring(0, 11);
            int sum = 0;
            for (int i = 0; i < 11; i++) sum += int.Parse(b[i].ToString()) * (i % 2 == 0 ? 3 : 1);
            return b + ((10 - sum % 10) % 10).ToString();
        }

        private static Bitmap CreateTextBarcode(string value, int width, int height)
        {
            var bmp = new Bitmap(width, height);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.White);
                g.DrawRectangle(Pens.Black, 0, 0, width - 1, height - 1);
                using (Font f = new Font("Arial", 16, FontStyle.Bold))
                {
                    SizeF sz = g.MeasureString(value, f);
                    g.DrawString(value, f, Brushes.Black, (width - sz.Width) / 2f, (height - sz.Height) / 2f);
                }
            }
            return bmp;
        }

        private static BarcodeFormat DetectBarcodeFormat(string v)
        {
            if (string.IsNullOrWhiteSpace(v)) return BarcodeFormat.CODE_128;
            v = v.Trim();
            if (v.Length == 12 && v.All(char.IsDigit)) return BarcodeFormat.UPC_A;
            if (v.Length == 13 && v.All(char.IsDigit)) return BarcodeFormat.EAN_13;
            if (v.Length == 8  && v.All(char.IsDigit)) return BarcodeFormat.EAN_8;
            if (v.StartsWith("*") && v.EndsWith("*"))  return BarcodeFormat.CODE_39;
            return BarcodeFormat.CODE_128;
        }

        // ── Text helpers ──────────────────────────────────────────────────────────

        /// <summary>
        /// Returns the largest font in [minSize, maxSize] where the whole text fits
        /// in one line within maxWidth.  Falls back to minSize — WrapText handles the rest.
        /// </summary>
        private static Font FitFontToWidth(Graphics g, string text, string family, FontStyle style,
            float maxSize, float minSize, float maxWidth, StringFormat sf)
        {
            for (float sz = maxSize; sz > minSize; sz -= 1f)
            {
                var f = new Font(family, sz, style);
                if (g.MeasureString(text, f, new PointF(0, 0), sf).Width <= maxWidth)
                    return f;
                f.Dispose();
            }
            return new Font(family, minSize, style);
        }

        /// <summary>
        /// Word-wraps text so every line fits within maxWidth.
        /// Falls back to character-level splitting for words wider than maxWidth.
        /// Never returns an empty list for non-empty input.
        /// </summary>
        private static List<string> WrapText(Graphics g, string text, Font font,
            float maxWidth, StringFormat sf)
        {
            var result = new List<string>();
            if (string.IsNullOrWhiteSpace(text)) return result;

            string[] words   = text.Split(' ');
            string   current = "";

            foreach (string word in words)
            {
                string candidate = string.IsNullOrEmpty(current) ? word : current + " " + word;
                if (g.MeasureString(candidate, font, new PointF(0, 0), sf).Width <= maxWidth)
                {
                    current = candidate;
                }
                else
                {
                    if (!string.IsNullOrEmpty(current))
                    {
                        result.Add(current);
                        current = word;
                    }
                    else
                    {
                        // Single word wider than maxWidth — split at character level
                        string rem = word;
                        while (!string.IsNullOrEmpty(rem))
                        {
                            int fit = 0;
                            for (int c = 1; c <= rem.Length; c++)
                            {
                                if (g.MeasureString(rem.Substring(0, c), font, new PointF(0, 0), sf).Width <= maxWidth)
                                    fit = c;
                                else
                                    break;
                            }
                            if (fit == 0) fit = 1; // absolute safety: take at least 1 char
                            result.Add(rem.Substring(0, fit));
                            rem = rem.Substring(fit);
                        }
                        current = "";
                    }
                }
            }

            if (!string.IsNullOrEmpty(current)) result.Add(current);
            return result;
        }

        /// <summary>
        /// Draws wrapped lines centered within LabelWidth, starting at startY.
        /// Returns Y after the last line.
        /// </summary>
        private static float DrawLines(Graphics g, List<string> lines, Font font,
            float startY, float lineH, StringFormat sf)
        {
            float y = startY;
            foreach (string line in lines)
            {
                // RectangleF spans the full label width — GDI+ centers within it
                // Height is generous (2× lineH) so GDI+ never clips descenders
                g.DrawString(line, font, Brushes.Black,
                    new RectangleF(0, y, LabelWidth, lineH * 2f), sf);
                y += lineH;
            }
            return y;
        }

        // ── TextField: one field's complete layout data ───────────────────────────

        private class TextField
        {
            public Font         Font     { get; private set; }
            public List<string> Lines    { get; private set; }
            public float        LineH    { get; private set; }
            public float        TotalH   { get; private set; }
            public bool         HasContent => Lines != null && Lines.Count > 0;

            /// <summary>
            /// Fit → wrap → measure in one call.
            /// A null/whitespace text produces a no-op field (HasContent == false).
            /// </summary>
            public static TextField Prepare(Graphics g, string text, FontStyle style,
                float maxSize, float minSize, float maxWidth, StringFormat sf)
            {
                var tf = new TextField { Lines = new List<string>() };

                if (string.IsNullOrWhiteSpace(text))
                {
                    tf.Font   = null;
                    tf.LineH  = 0;
                    tf.TotalH = 0;
                    return tf;
                }

                tf.Font  = FitFontToWidth(g, text, "Arial", style, maxSize, minSize, maxWidth, sf);
                tf.Lines = WrapText(g, text, tf.Font, maxWidth, sf);

                // Safety: if WrapText returned nothing, force at least the original text
                if (tf.Lines.Count == 0) tf.Lines.Add(text);

                tf.LineH  = g.MeasureString("Wy", tf.Font, new PointF(0, 0), sf).Height;
                tf.TotalH = tf.LineH * tf.Lines.Count;
                return tf;
            }

            public void Dispose() { if (Font != null) { Font.Dispose(); Font = null; } }
        }

        // ── Public API ────────────────────────────────────────────────────────────

        public static void PrintLabel(
            string  barcodeValue,
            string  productName      = null,
            string  price            = null,
            bool    printBarcodeOnly = false,
            bool    vatIncluded      = false,
            decimal vatPercentage    = 0,
            int     quantity         = 1,
            string  shopName         = null,
            string  branchName       = null,
            string  location         = null)
        {
            try
            {
                Console.WriteLine("=== BARCODE LABEL PRINT ===");
                Console.WriteLine("Barcode: "     + barcodeValue);
                Console.WriteLine("Shop: "        + shopName);
                Console.WriteLine("Branch: "      + branchName);
                Console.WriteLine("Location: "    + location);
                Console.WriteLine("Product: "     + productName);
                Console.WriteLine("Price: "       + price);
                Console.WriteLine("VAT: "         + vatPercentage + "% included=" + vatIncluded);
                Console.WriteLine("Qty: "         + quantity);
                Console.WriteLine("BarcodeOnly: " + printBarcodeOnly);

                var fmt = DetectBarcodeFormat(barcodeValue);
                Console.WriteLine("Format: " + fmt);

                var labelBitmap = new Bitmap(LabelWidth, LabelHeight);
                using (Graphics g = Graphics.FromImage(labelBitmap))
                {
                    g.Clear(Color.White);
                    g.SmoothingMode     = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                    g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;

                    if (printBarcodeOnly)
                    {
                        var bmp = GenerateRobustBarcode(barcodeValue, fmt, PrintableWidth, PrintableHeight - 10);
                        g.DrawImage(bmp, ExposedLinerWidth, (LabelHeight - bmp.Height) / 2);
                        bmp.Dispose();
                    }
                    else
                    {
                        RenderFullLabel(g, barcodeValue, fmt,
                            shopName, branchName, location,
                            productName, price, vatIncluded, vatPercentage);
                    }
                }

                // ── Send to printer ───────────────────────────────────────────────
                var    cfg      = ConfigManager.GetConfig();
                string printer  = !string.IsNullOrWhiteSpace(cfg.BarcodePrinterName)
                                  ? cfg.BarcodePrinterName : "Gprinter GP-3120TUC";

                var pd = new PrintDocument();
                pd.PrinterSettings.PrinterName = printer;

                bool found = false;
                foreach (string p in PrinterSettings.InstalledPrinters)
                    if (p.Equals(printer, StringComparison.OrdinalIgnoreCase)) { found = true; break; }

                if (!found)
                {
                    Console.WriteLine("WARNING: '" + printer + "' not found, fallback to " + cfg.PrinterName);
                    pd.PrinterSettings.PrinterName = cfg.PrinterName;
                }

                pd.DefaultPageSettings.PaperSize = new PaperSize("Custom150x100", 150, 100);
                pd.DefaultPageSettings.Margins   = new Margins(0, 0, 0, 0);
                pd.DefaultPageSettings.Landscape = false;
                pd.PrintController               = new StandardPrintController();

                pd.PrintPage += (s, a) =>
                {
                    try { a.Graphics.DrawImage(labelBitmap, 0, 0, a.PageBounds.Width, a.PageBounds.Height); }
                    catch (Exception ex) { Console.WriteLine("PrintPage err: " + ex.Message); }
                };

                for (int i = 0; i < quantity; i++)
                {
                    pd.Print();
                    Console.WriteLine("Printed " + (i + 1) + "/" + quantity);
                    if (i < quantity - 1) System.Threading.Thread.Sleep(100);
                }

                Console.WriteLine("Done — " + quantity + " label(s).");
                labelBitmap.Dispose();
            }
            catch (Exception ex)
            {
                Console.WriteLine("PrintLabel error: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
                throw;
            }
        }

        // ── Layout ────────────────────────────────────────────────────────────────

        private static void RenderFullLabel(
            Graphics      g,
            string        barcodeValue,
            BarcodeFormat fmt,
            string        shopName,
            string        branchName,
            string        location,
            string        productName,
            string        price,
            bool          vatIncluded,
            decimal       vatPercentage)
        {
            const int LINE_GAP      = 4;
            const int BARCODE_H_MAX = 160;
            const int BARCODE_H_MIN = 55;
            const int TEXT_PAD      = 8;  // px of breathing room each side of text

            float textW = LabelWidth - TEXT_PAD * 2;

            // Shared StringFormat — centered, no trimming, wrapping allowed
            var sf = new StringFormat(StringFormat.GenericTypographic)
            {
                Alignment     = StringAlignment.Center,
                LineAlignment = StringAlignment.Near,
                Trimming      = StringTrimming.None
            };
            sf.FormatFlags &= ~StringFormatFlags.NoWrap;

            string currency = ConfigManager.GetConfig().Currency;
            if (string.IsNullOrEmpty(currency)) currency = "$";

            // ── Build text strings ────────────────────────────────────────────────
            // Shop + branch on one line separated by em-dash
            string shopText = null;
            if (!string.IsNullOrWhiteSpace(shopName) || !string.IsNullOrWhiteSpace(branchName))
                shopText = (!string.IsNullOrWhiteSpace(shopName) && !string.IsNullOrWhiteSpace(branchName))
                    ? shopName.Trim() + " \u2014 " + branchName.Trim()
                    : (!string.IsNullOrWhiteSpace(shopName) ? shopName.Trim() : branchName.Trim());

            string locText     = !string.IsNullOrWhiteSpace(location)    ? location.Trim()    : null;
            string productText = !string.IsNullOrWhiteSpace(productName) ? productName.Trim() : null;

            // Price line — always built when price is provided, VAT appended when non-zero
            string priceText = null;
            if (!string.IsNullOrWhiteSpace(price))
            {
                // Strip any accidental currency prefix duplication
                string clean = price.Trim();
                if (clean.StartsWith(currency)) clean = clean.Substring(currency.Length).Trim();
                priceText = currency + clean;
                if (vatPercentage > 0)
                    priceText += vatIncluded
                        ? " (inc. VAT " + vatPercentage + "%)"
                        : " (exc. VAT " + vatPercentage + "%)";
            }

            Console.WriteLine("[Layout] shop='"    + shopText    + "'");
            Console.WriteLine("[Layout] loc='"     + locText     + "'");
            Console.WriteLine("[Layout] product='" + productText + "'");
            Console.WriteLine("[Layout] price='"   + priceText   + "'");

            // ── Prepare every field identically ───────────────────────────────────
            var tfShop    = TextField.Prepare(g, shopText,       FontStyle.Bold,    FONT_LARGE_MAX,  FONT_LARGE_MIN,  textW, sf);
            var tfLoc     = TextField.Prepare(g, locText,        FontStyle.Regular, FONT_MEDIUM_MAX, FONT_MEDIUM_MIN, textW, sf);
            var tfBarcNum = TextField.Prepare(g, barcodeValue,   FontStyle.Regular, FONT_MEDIUM_MAX, FONT_MEDIUM_MIN, textW, sf);
            var tfProduct = TextField.Prepare(g, productText,    FontStyle.Bold,    FONT_LARGE_MAX,  FONT_LARGE_MIN,  textW, sf);
            var tfPrice   = TextField.Prepare(g, priceText,      FontStyle.Bold,    FONT_LARGE_MAX,  FONT_LARGE_MIN,  textW, sf);

            // tfBarcNum must always have content (barcodeValue is never null/empty here)
            if (!tfBarcNum.HasContent)
            {
                tfBarcNum.Dispose();
                tfBarcNum = TextField.Prepare(g, barcodeValue, FontStyle.Regular, FONT_MEDIUM_MIN, FONT_MEDIUM_MIN, textW, sf);
            }

            // ── Measure text-only height ──────────────────────────────────────────
            float textOnlyH = 0;
            if (tfShop.HasContent)    textOnlyH += tfShop.TotalH    + LINE_GAP;
            if (tfLoc.HasContent)     textOnlyH += tfLoc.TotalH     + LINE_GAP;
            textOnlyH += LINE_GAP;                    // gap: barcode image → barcode number
            textOnlyH += tfBarcNum.TotalH;
            if (tfProduct.HasContent) textOnlyH += LINE_GAP + tfProduct.TotalH;
            if (tfPrice.HasContent)   textOnlyH += LINE_GAP + tfPrice.TotalH;

            // ── Dynamically shrink barcode image height to make everything fit ─────
            int barcodeH = BARCODE_H_MAX;
            while (barcodeH > BARCODE_H_MIN && (textOnlyH + barcodeH) > (LabelHeight - 4))
                barcodeH -= 4;

            Console.WriteLine("[Layout] textOnlyH=" + textOnlyH + " barcodeH=" + barcodeH + " total=" + (textOnlyH + barcodeH));

            // ── Draw — vertically centred on the label ────────────────────────────
            float y = Math.Max(2f, (LabelHeight - textOnlyH - barcodeH) / 2f);

            if (tfShop.HasContent)
            {
                y = DrawLines(g, tfShop.Lines, tfShop.Font, y, tfShop.LineH, sf);
                y += LINE_GAP;
            }

            if (tfLoc.HasContent)
            {
                y = DrawLines(g, tfLoc.Lines, tfLoc.Font, y, tfLoc.LineH, sf);
                y += LINE_GAP;
            }

            // Barcode image — truly centred on the label (ignoring BARCODE_SIDE_MARGIN asymmetry)
            int barcodeImgW = LabelWidth - BARCODE_SIDE_MARGIN * 2;
            var barcodeBmp  = GenerateRobustBarcode(barcodeValue, fmt, barcodeImgW, barcodeH);
            int barcodeX    = (LabelWidth - barcodeBmp.Width) / 2;   // actual pixel-perfect centre
            g.DrawImage(barcodeBmp, barcodeX, (int)y);
            barcodeBmp.Dispose();
            y += barcodeH + LINE_GAP;

            // Barcode number — always
            y = DrawLines(g, tfBarcNum.Lines, tfBarcNum.Font, y, tfBarcNum.LineH, sf);

            // Product name
            if (tfProduct.HasContent)
            {
                y += LINE_GAP;
                y = DrawLines(g, tfProduct.Lines, tfProduct.Font, y, tfProduct.LineH, sf);
            }

            // Price + VAT — always when priceText was set
            if (tfPrice.HasContent)
            {
                y += LINE_GAP;
                DrawLines(g, tfPrice.Lines, tfPrice.Font, y, tfPrice.LineH, sf);
            }

            // ── Dispose ───────────────────────────────────────────────────────────
            tfShop.Dispose();
            tfLoc.Dispose();
            tfBarcNum.Dispose();
            tfProduct.Dispose();
            tfPrice.Dispose();
            sf.Dispose();
        }
    }
}