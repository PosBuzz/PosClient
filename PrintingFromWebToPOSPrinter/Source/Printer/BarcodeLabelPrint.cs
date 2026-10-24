using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using ZXing;
using ZXing.Common;
using System.Drawing.Printing;
using Printer.Services;

namespace Printer
{
    public class BarcodeLabelPrint
    {
        // The label is drawn straight onto the printer's page in device dots, so it follows
        // whatever stock is selected in the driver (1.40" x 0.90", 1.25" x 1.60", ...) and
        // nothing here hardcodes a label size. Sizes below are in points (1/72 in); k = dpi / 72
        // converts them to dots.

        // Breathing room between the content and the label edge, and between blocks
        private const float EDGE_PAD = 3f;       // ~0.04 in
        private const float LINE_GAP = 1.5f;

        // Font sizes (pt) at scale 1. The whole label scales up or down together to use
        // the space the stock offers; MIN_SCALE keeps the smallest text readable at 203 DPI.
        private const float FONT_SHOP = 8f;
        private const float FONT_LOCATION = 6.5f;
        private const float FONT_NUMBER = 7f;
        private const float FONT_PRODUCT = 9f;
        private const float FONT_PRICE = 10f;
        private const float MAX_SCALE = 1.6f;
        private const float MIN_SCALE = 0.6f;
        private const float SCALE_STEP = 0.05f;

        // Max wrapped lines per field before the last one is ellipsised
        private const int LINES_SHOP = 2;
        private const int LINES_LOCATION = 2;
        private const int LINES_NUMBER = 2;
        private const int LINES_PRODUCT = 3;
        private const int LINES_PRICE = 2;

        // Barcode bar height (pt). Text only grows while the bars keep at least PREF.
        private const float BARCODE_H_MIN = 16f;   // ~0.22 in
        private const float BARCODE_H_PREF = 24f;  // ~0.33 in
        private const float BARCODE_H_MAX = 40f;   // ~0.55 in
        private const int QUIET_ZONE_MODULES = 8;

        // ── Barcode encoding ──────────────────────────────────────────────────────

        private static BitMatrix Encode(string value, BarcodeFormat format)
        {
            // Margin 0 and size 1 give the natural module pattern; quiet zone and scaling are ours
            var hints = new Dictionary<EncodeHintType, object> { { EncodeHintType.MARGIN, 0 } };
            return new MultiFormatWriter().encode(value, format, 1, 1, hints);
        }

        private static BitMatrix EncodeRobust(string barcodeValue, BarcodeFormat preferredFormat)
        {
            try { return Encode(barcodeValue, preferredFormat); }
            catch (Exception ex) { Console.WriteLine("Failed " + preferredFormat + ": " + ex.Message); }

            // EAN/UPC reject a wrong check digit. Never "correct" it: the scan must return the
            // exact value saved on the product, so encode that value as Code 128 instead.
            try { return Encode(barcodeValue, BarcodeFormat.CODE_128); } catch { }

            // Code 39 adds its own start/stop '*'
            try { return Encode(barcodeValue.Trim('*'), BarcodeFormat.CODE_39); } catch { }

            return null;
        }

        private static BarcodeFormat DetectBarcodeFormat(string v)
        {
            if (string.IsNullOrWhiteSpace(v)) return BarcodeFormat.CODE_128;
            v = v.Trim();
            if (v.Length == 12 && v.All(char.IsDigit)) return BarcodeFormat.UPC_A;
            if (v.Length == 13 && v.All(char.IsDigit)) return BarcodeFormat.EAN_13;
            if (v.Length == 8 && v.All(char.IsDigit)) return BarcodeFormat.EAN_8;
            if (v.StartsWith("*") && v.EndsWith("*")) return BarcodeFormat.CODE_39;
            return BarcodeFormat.CODE_128;
        }

        /// <summary>
        /// Draws the bars as filled rectangles, each module a whole number of printer dots
        /// so every bar of the same width prints identically (bitmap scaling smears them).
        /// </summary>
        private static void DrawBarcode(Graphics g, string value, BarcodeFormat fmt, RectangleF box)
        {
            BitMatrix m = EncodeRobust(value, fmt);
            if (m == null)
            {
                DrawTextBarcode(g, value, box);
                return;
            }

            int modules = m.Width;
            float moduleW = (float)Math.Floor(box.Width / (modules + 2 * QUIET_ZONE_MODULES));
            if (moduleW < 1) moduleW = (float)Math.Floor(box.Width / modules);
            if (moduleW < 1)
            {
                // Code is longer than the label is wide — squeeze it; it may not scan
                Console.WriteLine("WARNING: barcode '" + value + "' needs " + modules + " dots, label has " + (int)box.Width);
                moduleW = box.Width / modules;
            }

            float x0 = (float)Math.Round(box.X + (box.Width - modules * moduleW) / 2f);

            var oldSmoothing = g.SmoothingMode;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
            int x = 0;
            while (x < modules)
            {
                if (!m[x, 0]) { x++; continue; }
                int start = x;
                while (x < modules && m[x, 0]) x++;
                g.FillRectangle(Brushes.Black, x0 + start * moduleW, box.Y, (x - start) * moduleW, box.Height);
            }
            g.SmoothingMode = oldSmoothing;
        }

        private static void DrawTextBarcode(Graphics g, string value, RectangleF box)
        {
            g.DrawRectangle(Pens.Black, box.X, box.Y, box.Width, box.Height);
            using (Font f = new Font("Arial", box.Height * 0.3f, FontStyle.Bold, GraphicsUnit.Pixel))
            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                g.DrawString(value, f, Brushes.Black, box, sf);
        }

        // ── Text helpers ──────────────────────────────────────────────────────────

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

            string[] words = text.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            string current = "";

            foreach (string word in words)
            {
                string candidate = string.IsNullOrEmpty(current) ? word : current + " " + word;
                if (Fits(g, candidate, font, maxWidth, sf))
                {
                    current = candidate;
                    continue;
                }

                if (!string.IsNullOrEmpty(current)) result.Add(current);
                current = "";

                // Word wider than maxWidth on its own — split at character level
                string rem = word;
                while (!Fits(g, rem, font, maxWidth, sf))
                {
                    int fit = 1; // absolute safety: take at least 1 char
                    while (fit < rem.Length && Fits(g, rem.Substring(0, fit + 1), font, maxWidth, sf)) fit++;
                    result.Add(rem.Substring(0, fit));
                    rem = rem.Substring(fit);
                }
                current = rem;
            }

            if (!string.IsNullOrEmpty(current)) result.Add(current);
            return result;
        }

        private static bool Fits(Graphics g, string text, Font font, float maxWidth, StringFormat sf)
        {
            return g.MeasureString(text, font, new PointF(0, 0), sf).Width <= maxWidth;
        }

        private static string Ellipsize(Graphics g, string line, Font font, float maxWidth, StringFormat sf)
        {
            string s = line.TrimEnd();
            while (s.Length > 0 && !Fits(g, s + "…", font, maxWidth, sf))
                s = s.Substring(0, s.Length - 1).TrimEnd();
            return s + "…";
        }

        /// <summary>
        /// Draws wrapped lines centered within box, starting at startY.
        /// Returns Y after the last line.
        /// </summary>
        private static float DrawLines(Graphics g, TextField field, RectangleF box, float startY, StringFormat sf)
        {
            float y = startY;
            foreach (string line in field.Lines)
            {
                // Height is generous (2× lineH) so GDI+ never clips descenders
                g.DrawString(line, field.Font, Brushes.Black,
                    new RectangleF(box.X, y, box.Width, field.LineH * 2f), sf);
                y += field.LineH;
            }
            return y;
        }

        // ── TextField: one field's complete layout data ───────────────────────────

        private class TextField
        {
            public Font Font { get; private set; }
            public List<string> Lines { get; private set; }
            public float LineH { get; private set; }
            public bool Truncated { get; private set; }
            public float TotalH => LineH * Lines.Count;
            public bool HasContent => Lines.Count > 0;

            /// <summary>
            /// Wrap → cap lines → measure in one call.
            /// A null/whitespace text produces a no-op field (HasContent == false).
            /// </summary>
            public static TextField Prepare(Graphics g, string text, FontStyle style,
                float sizePx, int maxLines, float maxWidth, StringFormat sf)
            {
                var tf = new TextField { Lines = new List<string>() };
                if (string.IsNullOrWhiteSpace(text)) return tf;

                tf.Font = new Font("Arial", sizePx, style, GraphicsUnit.Pixel);
                tf.Lines = WrapText(g, text.Trim(), tf.Font, maxWidth, sf);
                if (tf.Lines.Count > maxLines)
                {
                    tf.Lines = tf.Lines.Take(maxLines).ToList();
                    tf.Lines[maxLines - 1] = Ellipsize(g, tf.Lines[maxLines - 1], tf.Font, maxWidth, sf);
                    tf.Truncated = true;
                }
                tf.LineH = tf.Font.GetHeight(g);
                return tf;
            }

            public void Dispose() { if (Font != null) { Font.Dispose(); Font = null; } }
        }

        // ── LabelLayout: every text field at one scale ────────────────────────────

        private class LabelLayout
        {
            public TextField Shop, Location, Number, Product, Price;
            public float TextH;  // all text plus the gaps between blocks, excluding the bars

            public bool Truncated => Fields.Any(f => f.Truncated);
            public IEnumerable<TextField> Fields => new[] { Shop, Location, Number, Product, Price };

            public static LabelLayout Build(Graphics g, LabelText t, float scale, float k, float maxWidth, StringFormat sf,
                int productLines = LINES_PRODUCT, int locationLines = LINES_LOCATION, int shopLines = LINES_SHOP)
            {
                scale *= k;
                var l = new LabelLayout
                {
                    Shop = TextField.Prepare(g, t.Shop, FontStyle.Bold, FONT_SHOP * scale, shopLines, maxWidth, sf),
                    Location = TextField.Prepare(g, t.Location, FontStyle.Regular, FONT_LOCATION * scale, locationLines, maxWidth, sf),
                    Number = TextField.Prepare(g, t.Number, FontStyle.Regular, FONT_NUMBER * scale, LINES_NUMBER, maxWidth, sf),
                    Product = TextField.Prepare(g, t.Product, FontStyle.Bold, FONT_PRODUCT * scale, productLines, maxWidth, sf),
                    Price = TextField.Prepare(g, t.Price, FontStyle.Bold, FONT_PRICE * scale, LINES_PRICE, maxWidth, sf)
                };
                // One gap after every text block (the bars are one more block in the stack)
                foreach (var f in l.Fields)
                    if (f.HasContent) l.TextH += f.TotalH + LINE_GAP * k;
                return l;
            }

            public void Dispose() { foreach (var f in Fields) f.Dispose(); }
        }

        private class LabelText
        {
            public string Shop, Location, Number, Product, Price;
        }

        /// <summary>
        /// Picks the largest text scale where nothing is ellipsised and the bars keep their
        /// preferred height, then relaxes the bars to their minimum, then allows ellipsis.
        /// </summary>
        private static LabelLayout FitLayout(Graphics g, LabelText t, RectangleF box, float k, StringFormat sf, out float barcodeH)
        {
            foreach (float barsNeeded in new[] { BARCODE_H_PREF * k, BARCODE_H_MIN * k })
            {
                for (float scale = MAX_SCALE; scale >= MIN_SCALE - 0.001f; scale -= SCALE_STEP)
                {
                    var l = LabelLayout.Build(g, t, scale, k, box.Width, sf);
                    if (!l.Truncated && l.TextH + barsNeeded <= box.Height)
                    {
                        barcodeH = Math.Min(BARCODE_H_MAX * k, box.Height - l.TextH);
                        Console.WriteLine("[Layout] scale=" + scale.ToString("0.00") + " barcodeH=" + (barcodeH / k).ToString("0.0") + "pt");
                        return l;
                    }
                    l.Dispose();
                }
            }

            // Still too tall at the smallest text: give up lines (ellipsised) from the product
            // name first, then the location, then the shop. The price and number are never cut.
            int[][] lineCaps =
            {
                new[] { 2, LINES_LOCATION, LINES_SHOP },
                new[] { 1, LINES_LOCATION, LINES_SHOP },
                new[] { 1, 1, LINES_SHOP },
                new[] { 1, 1, 1 }
            };
            LabelLayout last = null;
            foreach (int[] caps in lineCaps)
            {
                if (last != null) last.Dispose();
                last = LabelLayout.Build(g, t, MIN_SCALE, k, box.Width, sf, caps[0], caps[1], caps[2]);
                if (last.TextH + BARCODE_H_MIN * k <= box.Height) break;
            }

            barcodeH = Math.Min(BARCODE_H_MAX * k, Math.Max(BARCODE_H_MIN * k, box.Height - last.TextH));
            if (last.TextH + barcodeH > box.Height)
                Console.WriteLine("WARNING: label content is taller than the label; the bottom will be cut");
            Console.WriteLine("[Layout] scale=min (text ellipsised) barcodeH=" + (barcodeH / k).ToString("0.0") + "pt");
            return last;
        }

        // ── Public API ────────────────────────────────────────────────────────────

        public static void PrintLabel(
            string barcodeValue,
            string productName = null,
            string price = null,
            bool printBarcodeOnly = false,
            bool vatIncluded = false,
            decimal vatPercentage = 0,
            int quantity = 1,
            string shopName = null,
            string branchName = null,
            string location = null)
        {
            try
            {
                Console.WriteLine("=== BARCODE LABEL PRINT ===");
                Console.WriteLine("Barcode: " + barcodeValue);
                Console.WriteLine("Shop: " + shopName);
                Console.WriteLine("Branch: " + branchName);
                Console.WriteLine("Location: " + location);
                Console.WriteLine("Product: " + productName);
                Console.WriteLine("Price: " + price);
                Console.WriteLine("VAT: " + vatPercentage + "% included=" + vatIncluded);
                Console.WriteLine("Qty: " + quantity);
                Console.WriteLine("BarcodeOnly: " + printBarcodeOnly);

                var cfg = ConfigManager.GetConfig();
                string printer = !string.IsNullOrWhiteSpace(cfg.BarcodePrinterName)
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

                // Paper size and orientation come from the stock selected in the printer driver
                pd.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
                pd.PrintController = new StandardPrintController();

                pd.PrintPage += (s, a) =>
                {
                    try
                    {
                        Graphics g = a.Graphics;
                        g.PageUnit = GraphicsUnit.Pixel;
                        // The printable part of the driver's page (1/100 in, already rotated for its
                        // orientation) in dots. The Graphics origin is its top-left corner.
                        RectangleF area = a.PageSettings.PrintableArea;
                        var page = new RectangleF(0, 0, area.Width / 100f * g.DpiX, area.Height / 100f * g.DpiY);
                        Console.WriteLine("[Page] printable " + area.Width / 100f + "in x " + area.Height / 100f
                            + "in @ " + g.DpiX + "dpi (stock " + a.PageBounds.Width / 100f + "in x " + a.PageBounds.Height / 100f + "in)");

                        RenderLabel(g, page, g.DpiX, barcodeValue, printBarcodeOnly,
                            shopName, branchName, location, productName, price,
                            vatIncluded, vatPercentage, cfg.Currency);
                    }
                    catch (Exception ex) { Console.WriteLine("PrintPage err: " + ex.Message); }
                };

                for (int i = 0; i < quantity; i++)
                {
                    pd.Print();
                    Console.WriteLine("Printed " + (i + 1) + "/" + quantity);
                    if (i < quantity - 1) System.Threading.Thread.Sleep(100);
                }

                Console.WriteLine("Done — " + quantity + " label(s).");
            }
            catch (Exception ex)
            {
                Console.WriteLine("PrintLabel error: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
                throw;
            }
        }

        // ── Layout ────────────────────────────────────────────────────────────────

        /// <summary>
        /// Lays the label out inside page, in device dots (g.PageUnit must be Pixel).
        /// dpi is the device resolution, used to turn the point sizes above into dots.
        /// </summary>
        internal static void RenderLabel(
            Graphics g,
            RectangleF page,
            float dpi,
            string barcodeValue,
            bool printBarcodeOnly,
            string shopName,
            string branchName,
            string location,
            string productName,
            string price,
            bool vatIncluded,
            decimal vatPercentage,
            string currency)
        {
            var fmt = DetectBarcodeFormat(barcodeValue);
            Console.WriteLine("Format: " + fmt);

            float k = dpi / 72f;
            float gap = LINE_GAP * k;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
            RectangleF box = RectangleF.Inflate(page, -EDGE_PAD * k, -EDGE_PAD * k);

            if (printBarcodeOnly)
            {
                DrawBarcode(g, barcodeValue, fmt, box);
                return;
            }

            // Centered, no trimming; wrapping is done by WrapText so measuring matches drawing
            var sf = new StringFormat(StringFormat.GenericTypographic)
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Near,
                Trimming = StringTrimming.None
            };

            if (string.IsNullOrEmpty(currency)) currency = "$";

            // ── Build text strings ────────────────────────────────────────────────
            // Shop + branch on one line separated by em-dash
            string shopText = null;
            if (!string.IsNullOrWhiteSpace(shopName) || !string.IsNullOrWhiteSpace(branchName))
                shopText = (!string.IsNullOrWhiteSpace(shopName) && !string.IsNullOrWhiteSpace(branchName))
                    ? shopName.Trim() + " — " + branchName.Trim()
                    : (!string.IsNullOrWhiteSpace(shopName) ? shopName.Trim() : branchName.Trim());

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

            var text = new LabelText
            {
                Shop = shopText,
                Location = location,
                Number = barcodeValue,
                Product = productName,
                Price = priceText
            };

            Console.WriteLine("[Layout] shop='" + shopText + "'");
            Console.WriteLine("[Layout] loc='" + location + "'");
            Console.WriteLine("[Layout] product='" + productName + "'");
            Console.WriteLine("[Layout] price='" + priceText + "'");

            float barcodeH;
            var layout = FitLayout(g, text, box, k, sf, out barcodeH);

            // ── Draw — vertically centred on the label ────────────────────────────
            float y = box.Y + Math.Max(0f, (box.Height - layout.TextH - barcodeH) / 2f);

            if (layout.Shop.HasContent) y = DrawLines(g, layout.Shop, box, y, sf) + gap;
            if (layout.Location.HasContent) y = DrawLines(g, layout.Location, box, y, sf) + gap;

            DrawBarcode(g, barcodeValue, fmt, new RectangleF(box.X, y, box.Width, barcodeH));
            y += barcodeH + gap;

            if (layout.Number.HasContent) y = DrawLines(g, layout.Number, box, y, sf) + gap;
            if (layout.Product.HasContent) y = DrawLines(g, layout.Product, box, y, sf) + gap;
            if (layout.Price.HasContent) DrawLines(g, layout.Price, box, y, sf);

            layout.Dispose();
            sf.Dispose();
        }
    }
}
