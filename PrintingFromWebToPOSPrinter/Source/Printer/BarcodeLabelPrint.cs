using System;
using System.Drawing;
using System.Linq;
using ZXing;
using System.Drawing.Printing;
using Printer.Services;

namespace Printer
{
    public class BarcodeLabelPrint
    {
        private const int DPI = 203;
        private static int CmToPixels(double cm) => (int)(cm * DPI / 2.54);
        private static int InchesToPixels(double inches) => (int)(inches * DPI);

        // Using exact measurements from printer configuration: 1.50" x 1.00"
        // Use 600 DPI for maximum size and quality
        private static readonly int LabelWidth = (int)(1.50 * 600); // 900 pixels
        private static readonly int LabelHeight = (int)(1.00 * 600); // 600 pixels
        private static readonly int ExposedLinerWidth = (int)(0.04 * 600); // 24 pixels

        // Actual printable area (excluding exposed liner)
        private static readonly int PrintableWidth = LabelWidth - (2 * ExposedLinerWidth);
        private static readonly int PrintableHeight = LabelHeight;
        const int BARCODE_SIDE_MARGIN = 60;

        /// <summary>
        /// Detects the best barcode format based on the input data
        /// Falls back to CODE_128 as it's the most versatile
        /// </summary>
        // Helper method to try different barcode formats and fix checksums if needed
        private static Bitmap GenerateRobustBarcode(string barcodeValue, BarcodeFormat preferredFormat, int width, int height)
        {
            BarcodeWriter writer = null;

            try
            {
                // First try the preferred format
                writer = new BarcodeWriter
                {
                    Format = preferredFormat,
                    Options = new ZXing.Common.EncodingOptions
                    {
                        Width = width,
                        Height = height,
                        Margin = 0,
                        PureBarcode = false
                    }
                };

                return writer.Write(barcodeValue);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Failed with " + preferredFormat + ": " + ex.Message);

                // Try to fix EAN-13 checksum if it's EAN-13
                if (preferredFormat == BarcodeFormat.EAN_13 && barcodeValue.Length >= 12)
                {
                    try
                    {
                        string fixedEan13 = FixEan13Checksum(barcodeValue);
                        Console.WriteLine("Trying fixed EAN-13: " + fixedEan13);
                        return writer.Write(fixedEan13);
                    }
                    catch (Exception ex2)
                    {
                        Console.WriteLine("Fixed EAN-13 failed: " + ex2.Message);
                    }
                }

                // Try UPC-A if it's 12 digits
                if (barcodeValue.Length == 12 && barcodeValue.All(char.IsDigit))
                {
                    try
                    {
                        writer.Format = BarcodeFormat.UPC_A;
                        string fixedUpc = FixUpcChecksum(barcodeValue);
                        Console.WriteLine("Trying fixed UPC-A: " + fixedUpc);
                        return writer.Write(fixedUpc);
                    }
                    catch (Exception ex3)
                    {
                        Console.WriteLine("UPC-A failed: " + ex3.Message);
                    }
                }

                // Fallback to CODE_128 which is very flexible
                try
                {
                    writer.Format = BarcodeFormat.CODE_128;
                    Console.WriteLine("Falling back to CODE_128");
                    return writer.Write(barcodeValue);
                }
                catch (Exception ex4)
                {
                    Console.WriteLine("CODE_128 failed: " + ex4.Message);
                }

                // Last resort - CODE_39 (but needs to be wrapped in *)
                try
                {
                    writer.Format = BarcodeFormat.CODE_39;
                    string code39Value = barcodeValue;
                    if (!code39Value.StartsWith("*"))
                        code39Value = "*" + code39Value;
                    if (!code39Value.EndsWith("*"))
                        code39Value = code39Value + "*";

                    Console.WriteLine("Last resort CODE_39: " + code39Value);
                    return writer.Write(code39Value);
                }
                catch (Exception)
                {
                    Console.WriteLine("All formats failed. Creating text-based barcode.");
                    // Create a simple text-based "barcode" as absolute last resort
                    return CreateTextBarcode(barcodeValue, width, height);
                }
            }
        }

        // Fix EAN-13 checksum
        private static string FixEan13Checksum(string ean13)
        {
            if (ean13.Length < 12) return ean13;

            string base12 = ean13.Substring(0, 12);
            int checksum = CalculateEan13Checksum(base12);
            return base12 + checksum.ToString();
        }

        // Fix UPC-A checksum  
        private static string FixUpcChecksum(string upc)
        {
            if (upc.Length < 11) return upc;

            string base11 = upc.Substring(0, 11);
            int checksum = CalculateUpcChecksum(base11);
            return base11 + checksum.ToString();
        }

        // Calculate EAN-13 checksum
        private static int CalculateEan13Checksum(string base12)
        {
            int sum = 0;
            for (int i = 0; i < 12; i++)
            {
                int digit = int.Parse(base12[i].ToString());
                sum += (i % 2 == 0) ? digit : digit * 3;
            }
            return (10 - (sum % 10)) % 10;
        }

        // Calculate UPC-A checksum
        private static int CalculateUpcChecksum(string base11)
        {
            int sum = 0;
            for (int i = 0; i < 11; i++)
            {
                int digit = int.Parse(base11[i].ToString());
                sum += (i % 2 == 0) ? digit * 3 : digit;
            }
            return (10 - (sum % 10)) % 10;
        }

        // Create a text-based barcode as last resort
        private static Bitmap CreateTextBarcode(string value, int width, int height)
        {
            var bitmap = new Bitmap(width, height);
            using (Graphics g = Graphics.FromImage(bitmap))
            {
                g.Clear(Color.White);
                g.DrawRectangle(Pens.Black, 0, 0, width - 1, height - 1);

                using (Font font = new Font("Arial", 16, FontStyle.Bold))
                {
                    var textSize = g.MeasureString(value, font);
                    float x = (width - textSize.Width) / 2;
                    float y = (height - textSize.Height) / 2;
                    g.DrawString(value, font, Brushes.Black, x, y);
                }
            }
            return bitmap;
        }

        private static BarcodeFormat DetectBarcodeFormat(string barcodeValue)
        {
            if (string.IsNullOrWhiteSpace(barcodeValue))
                return BarcodeFormat.CODE_128;

            // Remove any spaces or special characters for analysis
            string cleanValue = barcodeValue.Trim();

            // UPC-A: exactly 12 digits
            if (cleanValue.Length == 12 && cleanValue.All(char.IsDigit))
                return BarcodeFormat.UPC_A;

            // EAN-13: exactly 13 digits
            if (cleanValue.Length == 13 && cleanValue.All(char.IsDigit))
                return BarcodeFormat.EAN_13;

            // EAN-8: exactly 8 digits
            if (cleanValue.Length == 8 && cleanValue.All(char.IsDigit))
                return BarcodeFormat.EAN_8;

            // CODE_39: typically alphanumeric, often starts/ends with *
            if (cleanValue.StartsWith("*") && cleanValue.EndsWith("*"))
                return BarcodeFormat.CODE_39;

            // For everything else, use CODE_128 as it's the most versatile
            // CODE_128 can handle: numbers, letters, symbols, and special characters
            return BarcodeFormat.CODE_128;
        }

        public static void PrintLabel(string barcodeValue, string productName = null, string price = null, bool printBarcodeOnly = false, bool vatIncluded = false, decimal vatPercentage = 0, int quantity = 1, string shopName = null, string branchName = null, string location = null)
        {
            try
            {
                Console.WriteLine("=== BARCODE LABEL PRINTING ===");
                Console.WriteLine("Label Size: " + LabelWidth + "x" + LabelHeight + " pixels (1.50x1.00 inches at 600 DPI)");
                Console.WriteLine("Printable Area: " + PrintableWidth + "x" + PrintableHeight + " pixels");
                Console.WriteLine("Exposed Liner: " + ExposedLinerWidth + " pixels each side");
                Console.WriteLine("Barcode Value: " + barcodeValue);
                Console.WriteLine("Shop Name: " + shopName);
                Console.WriteLine("Branch Name: " + branchName);
                Console.WriteLine("Location: " + location);
                Console.WriteLine("Product Name: " + productName);
                Console.WriteLine("Price: " + price);
                Console.WriteLine("VAT Included: " + vatIncluded);
                Console.WriteLine("VAT Percentage: " + vatPercentage + "%");
                Console.WriteLine("Quantity: " + quantity);
                Console.WriteLine("Barcode Only: " + printBarcodeOnly);

                // Detect the best barcode format for the input
                var detectedFormat = DetectBarcodeFormat(barcodeValue);
                Console.WriteLine("Detected barcode format: " + detectedFormat);

                var labelBitmap = new Bitmap(LabelWidth, LabelHeight);
                using (Graphics g = Graphics.FromImage(labelBitmap))
                {
                    g.Clear(Color.White);
                    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                    g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;

                    if (printBarcodeOnly)
                    {
                        var barcodeBitmap = GenerateRobustBarcode(barcodeValue, detectedFormat, PrintableWidth, PrintableHeight - 10);
                        Console.WriteLine("Generated large barcode: " + barcodeBitmap.Width + "x" + barcodeBitmap.Height);

                        // Position at the start of printable area (no left gap)
                        int x = ExposedLinerWidth;
                        int y = (LabelHeight - barcodeBitmap.Height) / 2;
                        g.DrawImage(barcodeBitmap, x, y);
                        barcodeBitmap.Dispose();
                    }
                    else
                    {
                        // ---- Fonts & helpers ----
                        const float FONT_LARGE = 36f;  // shop/branch, product, price
                        const float FONT_MEDIUM = 30f;  // location, barcode number
                        const int LINE_GAP = 6;    // vertical gap between rows
                        const int BARCODE_H = 170;  // barcode image height

                        // GenericTypographic removes the ~1/6 em horizontal padding that the default
                        // StringFormat injects, which was causing the right-shift.
                        // Using the SAME format for both MeasureString and DrawString guarantees
                        // that measured heights exactly match rendered heights (no vertical drift).
                        StringFormat sfC = new StringFormat(StringFormat.GenericTypographic);
                        sfC.Alignment = StringAlignment.Center;
                        sfC.LineAlignment = StringAlignment.Near;
                        sfC.Trimming = StringTrimming.EllipsisCharacter;

                        string currency = ConfigManager.GetConfig().Currency;
                        if (string.IsNullOrEmpty(currency)) currency = "$";

                        // Prepare all text strings up front
                        string shopText = null;
                        if (!string.IsNullOrWhiteSpace(shopName) || !string.IsNullOrWhiteSpace(branchName))
                        {
                            shopText = (!string.IsNullOrWhiteSpace(shopName) && !string.IsNullOrWhiteSpace(branchName))
                                ? shopName + " \u2014 " + branchName
                                : (!string.IsNullOrWhiteSpace(shopName) ? shopName : branchName);
                        }
                        string locText = !string.IsNullOrWhiteSpace(location) ? location : null;
                        string barcodeNumText = barcodeValue;
                        string productText = !string.IsNullOrWhiteSpace(productName) ? productName : null;
                        string priceText = null;
                        if (!string.IsNullOrWhiteSpace(price))
                        {
                            priceText = price.StartsWith(currency) ? price : currency + price;
                            if (vatPercentage > 0)
                                priceText += vatIncluded
                                    ? " (inc. VAT " + vatPercentage + "%)"
                                    : " (exc. VAT " + vatPercentage + "%)";
                        }

                        using (Font fL = new Font("Arial", FONT_LARGE, FontStyle.Bold))
                        using (Font fM = new Font("Arial", FONT_MEDIUM, FontStyle.Regular))
                        {
                            // Measure line heights using the same format as drawing — guarantees no drift
                            float fLH = g.MeasureString("Wy", fL, new PointF(0, 0), sfC).Height;
                            float fMH = g.MeasureString("Wy", fM, new PointF(0, 0), sfC).Height;

                            // ---- PASS 1: measure total content height ----
                            float totalH = 0;
                            if (shopText != null) totalH += fLH + LINE_GAP;
                            if (locText != null) totalH += fMH + LINE_GAP;
                            totalH += BARCODE_H + LINE_GAP;
                            totalH += fMH;   // barcode number (last item has no trailing gap)
                            if (productText != null) totalH += LINE_GAP + fLH;
                            if (priceText != null) totalH += LINE_GAP + fLH;

                            // ---- PASS 2: draw from vertically-centred startY ----
                            float startY = Math.Max(2, (LabelHeight - totalH) / 2f);
                            float y2 = startY;

                            if (shopText != null)
                            {
                                g.DrawString(shopText, fL, Brushes.Black, new RectangleF(0, y2, LabelWidth, fLH), sfC);
                                y2 += fLH + LINE_GAP;
                            }
                            if (locText != null)
                            {
                                g.DrawString(locText, fM, Brushes.Black, new RectangleF(0, y2, LabelWidth, fMH), sfC);
                                y2 += fMH + LINE_GAP;
                            }

                            // Barcode image — centred horizontally
                            // var barcodeBitmap = GenerateRobustBarcode(barcodeValue, detectedFormat, LabelWidth, BARCODE_H);
                            // int barcodeX = (LabelWidth - barcodeBitmap.Width) / 2;
                            int barcodeWidth = LabelWidth - (BARCODE_SIDE_MARGIN * 2);

                            var barcodeBitmap = GenerateRobustBarcode(
                                barcodeValue,
                                detectedFormat,
                                barcodeWidth,
                                BARCODE_H
                            );

                            // Force exact positioning using margin
                            int barcodeX = BARCODE_SIDE_MARGIN;
                            g.DrawImage(barcodeBitmap, barcodeX, (int)y2);
                            y2 += BARCODE_H + LINE_GAP;
                            barcodeBitmap.Dispose();

                            // Barcode number
                            g.DrawString(barcodeNumText, fM, Brushes.Black, new RectangleF(0, y2, LabelWidth, fMH), sfC);
                            y2 += fMH;

                            if (productText != null)
                            {
                                y2 += LINE_GAP;
                                g.DrawString(productText, fL, Brushes.Black, new RectangleF(0, y2, LabelWidth, fLH), sfC);
                                y2 += fLH;
                            }
                            if (priceText != null)
                            {
                                y2 += LINE_GAP;
                                g.DrawString(priceText, fL, Brushes.Black, new RectangleF(0, y2, LabelWidth, fLH), sfC);
                            }
                        }
                    }
                }

                Console.WriteLine("Label bitmap created successfully");

                var config = ConfigManager.GetConfig();
                string barcodePrinterName = !string.IsNullOrWhiteSpace(config.BarcodePrinterName) ? config.BarcodePrinterName : "Gprinter GP-3120TUC";

                PrintDocument pd = new PrintDocument();
                pd.PrinterSettings.PrinterName = barcodePrinterName;
                Console.WriteLine("Using barcode printer: " + barcodePrinterName);

                bool printerExists = false;
                foreach (string printerName in PrinterSettings.InstalledPrinters)
                {
                    if (printerName.Equals(barcodePrinterName, StringComparison.OrdinalIgnoreCase))
                    {
                        printerExists = true;
                        break;
                    }
                }

                if (!printerExists)
                {
                    Console.WriteLine("WARNING: Barcode printer '" + barcodePrinterName + "' not found!");
                    Console.WriteLine("Available printers:");
                    foreach (string printerName in PrinterSettings.InstalledPrinters)
                    {
                        Console.WriteLine("  - " + printerName);
                    }

                    pd.PrinterSettings.PrinterName = config.PrinterName;
                    Console.WriteLine("Using configured printer as fallback: " + config.PrinterName);
                }

                // Always force the exact label paper size (1.50" x 1.00") to avoid
                // unreliable auto-detection picking a wrong paper and stretching the output
                PaperSize customPaper = new PaperSize("Custom150x100", 150, 100); // units: 1/100 inch
                pd.DefaultPageSettings.PaperSize = customPaper;
                Console.WriteLine("Paper set to 1.50\" x 1.00\" (custom)");

                pd.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
                pd.DefaultPageSettings.Landscape = false;
                pd.PrintController = new StandardPrintController();

                pd.PrintPage += (sender, args) =>
                {
                    try
                    {
                        Console.WriteLine("=== PRINTING PAGE ===");
                        Console.WriteLine("Page bounds: " + args.PageBounds);
                        Console.WriteLine("Graphics DPI: " + args.Graphics.DpiX + " x " + args.Graphics.DpiY);
                        Console.WriteLine("Label size: " + LabelWidth + "x" + LabelHeight + " pixels");

                        // For label printers, we want 1:1 printing without scaling if possible
                        // The printer should handle the exact positioning based on its stock configuration

                        // Always draw to fill the entire page bounds (PrintDocument units = 1/100 inch)
                        // This ensures the label scales correctly regardless of DPI
                        args.Graphics.DrawImage(labelBitmap, 0, 0, args.PageBounds.Width, args.PageBounds.Height);
                        Console.WriteLine("Label printed to fill page bounds: " + args.PageBounds.Width + "x" + args.PageBounds.Height);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("Error in PrintPage event: " + ex.Message);
                    }
                };

                Console.WriteLine("Starting print job...");

                // Print the specified quantity
                for (int i = 0; i < quantity; i++)
                {
                    pd.Print();
                    Console.WriteLine("? Barcode label " + (i + 1) + " of " + quantity + " sent to printer successfully!");

                    // Small delay between prints to avoid overwhelming the printer
                    if (i < quantity - 1)
                    {
                        System.Threading.Thread.Sleep(100);
                    }
                }

                Console.WriteLine("? All " + quantity + " barcode labels printed successfully!");

                labelBitmap.Dispose();
            }
            catch (Exception ex)
            {
                Console.WriteLine("? Error printing barcode label: " + ex.Message);
                Console.WriteLine("Stack trace: " + ex.StackTrace);
                throw;
            }
        }

        private static string TruncateText(Graphics g, string text, Font font, float maxWidth)
        {
            if (g.MeasureString(text, font).Width <= maxWidth)
                return text;

            for (long i = text.Length - 1; i > 0; i--)
            {
                string truncated = text.Substring(0, (int)i) + "...";
                if (g.MeasureString(truncated, font).Width <= maxWidth)
                    return truncated;
            }

            return "...";
        }
    }
}
