using System;
using System.Drawing;
using ZXing;
using System.Drawing.Printing;
using Printer.Services;

namespace Printer.Barcode
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
        
        private const string BARCODE_PRINTER_NAME = "Gprinter GP-3120TUC";
        
        public static void PrintLabel(string barcodeValue, string productName = null, string price = null, bool printBarcodeOnly = false)
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
                Console.WriteLine("Barcode Only: " + printBarcodeOnly);
                
                var labelBitmap = new Bitmap(LabelWidth, LabelHeight);
                using (Graphics g = Graphics.FromImage(labelBitmap))
                {
                    g.Clear(Color.White);
                    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                    g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
                    
                    if (printBarcodeOnly)
                    {
                        var writer = new BarcodeWriter
                        {
                            Format = BarcodeFormat.CODE_128,
                            Options = new ZXing.Common.EncodingOptions
                            {
                                Width = PrintableWidth, // Use full printable width - no margins
                                Height = PrintableHeight - 20, // Use maximum height available
                                Margin = 0,
                                PureBarcode = false
                            }
                        };
                        
                        var barcodeBitmap = writer.Write(barcodeValue);
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
                        
                        var writer = new BarcodeWriter
                        {
                            Format = BarcodeFormat.CODE_128,
                            Options = new ZXing.Common.EncodingOptions
                            {
                                Width = PrintableWidth, // Use full printable width - no margins
                                Height = 160, // Shorter barcode for more text space
                                Margin = 0,
                                PureBarcode = false
                            }
                        };
                        
                        var barcodeBitmap = writer.Write(barcodeValue);
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
                                var textSize = g.MeasureString(priceText, font);
                                float textX = ExposedLinerWidth + (PrintableWidth - textSize.Width) / 2;
                                g.DrawString(priceText, font, Brushes.Black, textX, currentY);
                                Console.WriteLine("Drew price: " + priceText);
                            }
                        }
                    }
                }

                Console.WriteLine("Label bitmap created successfully");

                PrintDocument pd = new PrintDocument();
                pd.PrinterSettings.PrinterName = BARCODE_PRINTER_NAME;
                Console.WriteLine("Using dedicated barcode printer: " + BARCODE_PRINTER_NAME);
                
                bool printerExists = false;
                foreach (string printerName in PrinterSettings.InstalledPrinters)
                {
                    if (printerName.Equals(BARCODE_PRINTER_NAME, StringComparison.OrdinalIgnoreCase))
                    {
                        printerExists = true;
                        break;
                    }
                }
                
                if (!printerExists)
                {
                    Console.WriteLine("WARNING: Barcode printer '" + BARCODE_PRINTER_NAME + "' not found!");
                    Console.WriteLine("Available printers:");
                    foreach (string printerName in PrinterSettings.InstalledPrinters)
                    {
                        Console.WriteLine("  - " + printerName);
                    }
                    
                    var config = ConfigManager.GetConfig();
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
                pd.Print();
                Console.WriteLine("? Barcode label sent to GPrinter successfully!");
                
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
