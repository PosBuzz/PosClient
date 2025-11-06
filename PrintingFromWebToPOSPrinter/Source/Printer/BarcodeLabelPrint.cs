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
        
        // Using exact measurements from printer configuration: 1.50" x 0.79"
        // Use 600 DPI for maximum size and quality
        private static readonly int LabelWidth = (int)(1.50 * 600); // 900 pixels
        private static readonly int LabelHeight = (int)(0.79 * 600); // 474 pixels
        private static readonly int ExposedLinerWidth = (int)(0.04 * 600); // 24 pixels
        
        // Actual printable area (excluding exposed liner)
        private static readonly int PrintableWidth = LabelWidth - (2 * ExposedLinerWidth);
        private static readonly int PrintableHeight = LabelHeight;
        
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
        
        public static void PrintLabel(string barcodeValue, string productName = null, string price = null, bool printBarcodeOnly = false, bool vatIncluded = false, decimal vatPercentage = 0, int quantity = 1)
        {
            try
            {
                Console.WriteLine("=== BARCODE LABEL PRINTING ===");
                Console.WriteLine("Label Size: " + LabelWidth + "x" + LabelHeight + " pixels (1.50x0.79 inches at 600 DPI)");
                Console.WriteLine("Printable Area: " + PrintableWidth + "x" + PrintableHeight + " pixels");
                Console.WriteLine("Exposed Liner: " + ExposedLinerWidth + " pixels each side");
                Console.WriteLine("Barcode Value: " + barcodeValue);
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
                        int currentY = 8;
                        
                        var barcodeBitmap = GenerateRobustBarcode(barcodeValue, detectedFormat, PrintableWidth, 200);
                        Console.WriteLine("Generated compact barcode: " + barcodeBitmap.Width + "x" + barcodeBitmap.Height);
                        
                        // Position barcode at the very start of printable area (no left gap)
                        int barcodeX = ExposedLinerWidth;
                        g.DrawImage(barcodeBitmap, barcodeX, currentY);
                        currentY += barcodeBitmap.Height + 5;
                        barcodeBitmap.Dispose();
                        
                        // Barcode number directly under the barcode - much bigger
                        using (Font font = new Font("Arial", 36f, FontStyle.Regular)) // Much bigger font
                        {
                            string displayBarcode = barcodeValue;
                            var textSize = g.MeasureString(displayBarcode, font);
                            
                            if (textSize.Width > PrintableWidth)
                            {
                                displayBarcode = TruncateText(g, barcodeValue, font, PrintableWidth);
                                textSize = g.MeasureString(displayBarcode, font);
                            }
                            
                            float textX = ExposedLinerWidth + (PrintableWidth - textSize.Width) / 2;
                            g.DrawString(displayBarcode, font, Brushes.Black, textX, currentY);
                            currentY += 44;
                            Console.WriteLine("Drew barcode number: " + displayBarcode);
                        }
                        
                        if (!string.IsNullOrWhiteSpace(productName))
                        {
                            using (Font font = new Font("Arial", 40, FontStyle.Bold)) // Much bigger font
                            {
                                string displayName = productName;
                                var textSize = g.MeasureString(displayName, font);
                                
                                if (textSize.Width > PrintableWidth)
                                {
                                    displayName = TruncateText(g, productName, font, PrintableWidth);
                                    textSize = g.MeasureString(displayName, font);
                                }
                                
                                float textX = ExposedLinerWidth + (PrintableWidth - textSize.Width) / 2;
                                g.DrawString(displayName, font, Brushes.Black, textX, currentY);
                                currentY += 48;
                                Console.WriteLine("Drew product name: " + displayName);
                            }
                        }
                        
                        if (!string.IsNullOrWhiteSpace(price))
                        {
                            using (Font font = new Font("Arial", 44, FontStyle.Bold)) // Much bigger font
                            {
                                string priceText = price.StartsWith("$") ? price : "$" + price;
                                
                                // Add VAT information if specified
                                if (vatPercentage > 0)
                                {
                                    string vatText = vatIncluded ? " (inc. VAT " + vatPercentage + "%)" : " (exc. VAT " + vatPercentage + "%)";
                                    priceText += vatText;
                                }
                                
                                var textSize = g.MeasureString(priceText, font);
                                float textX = ExposedLinerWidth + (PrintableWidth - textSize.Width) / 2;
                                g.DrawString(priceText, font, Brushes.Black, textX, currentY);
                                Console.WriteLine("Drew price: " + priceText);
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

                bool paperSizeSet = false;
                PaperSize bestMatch = null;
                double bestScore = double.MaxValue;
                
                foreach (PaperSize paperSize in pd.PrinterSettings.PaperSizes)
                {
                    Console.WriteLine("Available paper size: " + paperSize.PaperName + " - " + (paperSize.Width/100.0).ToString("F2") + "\" x " + (paperSize.Height/100.0).ToString("F2") + "\"");
                    
                    // Target size: 1.50" x 0.79" (exact printer configuration)
                    double targetWidth = 1.50;
                    double targetHeight = 0.79;
                    double actualWidth = paperSize.Width / 100.0;
                    double actualHeight = paperSize.Height / 100.0;
                    
                    double widthDiff = Math.Abs(actualWidth - targetWidth);
                    double heightDiff = Math.Abs(actualHeight - targetHeight);
                    double score = widthDiff + heightDiff;
                    
                    // Look for exact or very close match
                    if (score < bestScore && score < 0.1) // Within 0.1 inch tolerance
                    {
                        bestScore = score;
                        bestMatch = paperSize;
                    }
                    
                    // Check for the custom stock name from printer settings
                    if (paperSize.PaperName.Contains("New Stock") || 
                        paperSize.PaperName.Contains("1.50") ||
                        (Math.Abs(actualWidth - targetWidth) < 0.01 && Math.Abs(actualHeight - targetHeight) < 0.01))
                    {
                        bestMatch = paperSize;
                        bestScore = 0;
                        break; // Perfect match found
                    }
                }
                
                if (bestMatch != null)
                {
                    pd.DefaultPageSettings.PaperSize = bestMatch;
                    Console.WriteLine("Using best matching paper size: " + bestMatch.PaperName + " (score: " + bestScore.ToString("F3") + ")");
                    paperSizeSet = true;
                }
                
                if (!paperSizeSet)
                {
                    // Create custom paper size matching exact printer configuration: 1.50" x 0.79"
                    int widthHundredths = 150; // 1.50 inches
                    int heightHundredths = 79;  // 0.79 inches
                    
                    PaperSize customPaper = new PaperSize("Custom150x79", widthHundredths, heightHundredths);
                    pd.DefaultPageSettings.PaperSize = customPaper;
                    Console.WriteLine("Created custom paper size: " + (widthHundredths/100.0).ToString("F2") + "\" x " + (heightHundredths/100.0).ToString("F2") + "\" (matches printer stock)");
                }

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
                        
                        if (args.PageBounds.Width >= LabelWidth && args.PageBounds.Height >= LabelHeight)
                        {
                            // Page is large enough - print at exact size, positioned at origin
                            // The printer's stock configuration handles the actual positioning on the label
                            args.Graphics.DrawImage(labelBitmap, 0, 0, LabelWidth, LabelHeight);
                            Console.WriteLine("Label printed at 1:1 scale at origin (recommended for label printers)");
                        }
                        else
                        {
                            // Page is smaller than label - scale down proportionally and center
                            float scaleX = (float)args.PageBounds.Width / LabelWidth;
                            float scaleY = (float)args.PageBounds.Height / LabelHeight;
                            float scale = Math.Min(scaleX, scaleY);
                            
                            int scaledWidth = (int)(LabelWidth * scale);
                            int scaledHeight = (int)(LabelHeight * scale);

                            // Center the scaled label
                            int offsetX = (args.PageBounds.Width - scaledWidth) / 2;
                            int offsetY = (args.PageBounds.Height - scaledHeight) / 2;

                            args.Graphics.DrawImage(labelBitmap, offsetX, offsetY, scaledWidth, scaledHeight);
                            Console.WriteLine("Label scaled down by " + scale.ToString("F3") + " and centered");
                        }
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
