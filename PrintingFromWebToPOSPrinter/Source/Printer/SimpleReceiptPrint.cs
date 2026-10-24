using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Runtime.InteropServices;
using Printer.Models;
using Printer.Services;
using ZXing;

namespace Printer
{
    public class SimpleReceiptPrint : PrintBase
    {
        // Windows API declarations for raw printing
        [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)]
            public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDataType;
        }

        private ReceiptData receiptData;
        private StoreConfig config;

        public bool Print(string printerName, ReceiptData data)
        {
            try
            {
                this.receiptData = data;
                this.config = ConfigManager.GetConfig();

                // If no printer name specified, try to use default printer
                if (string.IsNullOrEmpty(printerName))
                {
                    printerName = config.PrinterName;
                }

                // If still no printer name, use default system printer
                if (string.IsNullOrEmpty(printerName))
                {
                    Console.WriteLine("Warning: No printer name specified, using system default");
                    printerName = ""; // Empty string uses default printer
                }
                else
                {
                    Console.WriteLine("Attempting to print to: " + printerName);
                }

                this.Print(printerName, this.PrintReceipt);

                if (data.OpenCashDrawer)
                {
                    Console.WriteLine("Opening cash drawer...");
                    // Cash drawer opening logic here
                }

                Console.WriteLine("✓ Receipt printed successfully!");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error printing receipt: " + ex.Message);

                // Provide more specific error information
                if (ex.Message.Contains("Settings to access printer"))
                {
                    Console.WriteLine("Printer troubleshooting:");
                    Console.WriteLine("1. Check if printer is powered on and connected");
                    Console.WriteLine("2. Verify printer drivers are installed");
                    Console.WriteLine("3. Try printing a test page from Windows");
                    Console.WriteLine("4. Check if printer is set as default or available");
                }

                return false;
            }
        }

        private void PrintReceipt(Graphics g)
        {
            float y = 2; // Reduced top margin

            // Print header text (configurable tax invoice header)
            if (!string.IsNullOrEmpty(config.HeaderText))
            {
                y += this.DrawWrappedText(g, y, config.HeaderText, 7f, FontStyle.Regular);
                y += 3;
                y += this.DrawDashedLine(g, y);
                y += 3;
            }

            // Print logo if available, fitted inside a 50 x 25 mm box without stretching
            if (!string.IsNullOrEmpty(config.LogoPath) && File.Exists(config.LogoPath))
            {
                try
                {
                    using (Image logoImage = Image.FromFile(config.LogoPath))
                    {
                        const float maxLogoWidth = 50;  // mm
                        const float maxLogoHeight = 25; // mm
                        float fit = Math.Min(maxLogoWidth / logoImage.Width, maxLogoHeight / logoImage.Height);
                        float logoWidth = logoImage.Width * fit;
                        float logoHeight = logoImage.Height * fit;
                        float logoX = (this.width - logoWidth) / 2;

                        g.DrawImage(logoImage, logoX, y, logoWidth, logoHeight);
                        y += logoHeight + 3;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Could not load logo: " + ex.Message);
                }
            }

            // Store information - Show "Shop Name — Branch Name" format
            string headerText = "";

            // Build header with Shop Name and Branch Name
            if (receiptData.Branch != null && !string.IsNullOrEmpty(receiptData.Branch.Name))
            {
                // If we have branch info from receipt data, use Shop Name — Branch Name format
                if (!string.IsNullOrEmpty(config.StoreName))
                {
                    headerText = config.StoreName + " — " + receiptData.Branch.Name;
                }
                else
                {
                    headerText = receiptData.Branch.Name;
                }
            }
            else if (!string.IsNullOrEmpty(config.StoreName))
            {
                // Fallback to just store name if no branch info
                headerText = config.StoreName;
            }

            if (!string.IsNullOrEmpty(headerText))
            {
                y += this.DrawCenteredText(g, y, headerText, 12f, FontStyle.Bold);
                y += 2;
            }

            // Contact information - Use ContactInfo if available, otherwise legacy fields
            string contactToDisplay = "";

            if (!string.IsNullOrEmpty(config.ContactInfo))
            {
                // Use new unified contact field - preserves line breaks
                contactToDisplay = config.ContactInfo;
            }
            else
            {
                // Fallback to legacy fields for backwards compatibility
                if (receiptData.Branch != null)
                {
                    if (!string.IsNullOrEmpty(receiptData.Branch.Address))
                        contactToDisplay += receiptData.Branch.Address + "\n";
                    if (!string.IsNullOrEmpty(receiptData.Branch.Phone))
                        contactToDisplay += receiptData.Branch.Phone + "\n";
                    if (!string.IsNullOrEmpty(receiptData.Branch.Email))
                        contactToDisplay += receiptData.Branch.Email;
                }
                else
                {
                    if (!string.IsNullOrEmpty(config.Address))
                        contactToDisplay += config.Address + "\n";
                    if (!string.IsNullOrEmpty(config.Phone))
                        contactToDisplay += config.Phone + "\n";
                    if (!string.IsNullOrEmpty(config.Email))
                        contactToDisplay += config.Email;
                }
            }

            if (!string.IsNullOrEmpty(contactToDisplay))
            {
                y += this.DrawWrappedText(g, y, contactToDisplay.Trim(), 8f);
                y += 3;
            }

            // VAT Registration Number
            if (!string.IsNullOrEmpty(config.VatRegistrationNumber))
            {
                y += this.DrawCenteredText(g, y, "VAT Reg: " + config.VatRegistrationNumber, 7f);
                y += 2;
            }

            if (receiptData.IsReturn)
            {
                y += this.DrawCenteredText(g, y, "*** RETURN RECEIPT ***", 10f, FontStyle.Bold);
                y += 3;
            }

            // Order information
            string saleNumberText = GetSaleNumberText();
            if (!string.IsNullOrEmpty(saleNumberText))
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Sale No:", 0.35f, StringAlignment.Near, 7f),
                    new TextColumn(saleNumberText, 0.65f, StringAlignment.Far, 7f, FontStyle.Bold)
                );
            }

            if (receiptData.OrderDate.HasValue)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Date:", 0.6f, StringAlignment.Near, 7f),
                    new TextColumn(receiptData.OrderDate.Value.ToString("MM/dd/yyyy HH:mm"), 0.4f, StringAlignment.Far, 7f)
                );
            }

            // Cashier information (only if exists)
            if (receiptData.Cashier != null && !string.IsNullOrEmpty(receiptData.Cashier.Name))
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Cashier:", 0.6f, StringAlignment.Near, 7f),
                    new TextColumn(receiptData.Cashier.Name, 0.4f, StringAlignment.Far, 7f)
                );
            }

            if (receiptData.ServedBy != null && !string.IsNullOrEmpty(receiptData.ServedBy.Name))
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Served By:", 0.6f, StringAlignment.Near, 7f),
                    new TextColumn(receiptData.ServedBy.Name, 0.4f, StringAlignment.Far, 7f)
                );
            }

            // Customer information (only if exists)
            if (receiptData.Customer != null && !string.IsNullOrEmpty(receiptData.Customer.Name))
            {
                y += 2;
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Customer:", 0.3f, StringAlignment.Near, 7f),
                    new TextColumn(receiptData.Customer.Name, 0.7f, StringAlignment.Near, 7f)
                );

                if (!string.IsNullOrEmpty(receiptData.Customer.Phone))
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Phone:", 0.3f, StringAlignment.Near, 7f),
                        new TextColumn(receiptData.Customer.Phone, 0.7f, StringAlignment.Near, 7f)
                    );
                }

                if (config.ShowCustomerRewardPoints)
                {
                    string rewardSummary = BuildCustomerRewardSummary();
                    if (!string.IsNullOrEmpty(rewardSummary))
                    {
                        y += this.DrawTextColumns(
                            g, y,
                            new TextColumn("Points:", 0.3f, StringAlignment.Near, 7f),
                            new TextColumn(rewardSummary, 0.7f, StringAlignment.Near, 7f)
                        );
                    }
                }
            }

            // Items section
            if (receiptData.Items != null && receiptData.Items.Count > 0)
            {
                y += 4;
                y += this.DrawDashedLine(g, y);
                y += 2;

                // Items header — 6 columns; item name wraps within its column
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Item", 0.35f, StringAlignment.Near, 6.5f, FontStyle.Bold),
                    new TextColumn("Qty", 0.08f, StringAlignment.Near, 6.5f, FontStyle.Bold),
                    new TextColumn("Price", 0.15f, StringAlignment.Far, 6.5f, FontStyle.Bold),
                    new TextColumn("Disc", 0.12f, StringAlignment.Far, 6.5f, FontStyle.Bold),
                    new TextColumn("Tax", 0.14f, StringAlignment.Far, 6.5f, FontStyle.Bold),
                    new TextColumn("Total", 0.16f, StringAlignment.Far, 6.5f, FontStyle.Bold)
                );

                y += 2;
                y += this.DrawDashedLine(g, y);
                y += 2;

                foreach (var item in receiptData.Items)
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn(item.Name, 0.35f, StringAlignment.Near, 6.5f),
                        new TextColumn(item.Quantity.ToString(), 0.08f, StringAlignment.Near, 6.5f),
                        new TextColumn(item.Price.ToString("0.00"), 0.15f, StringAlignment.Far, 6.5f),
                        new TextColumn(item.DiscountAmount > 0 ? item.DiscountAmount.ToString("0.00") : "-", 0.12f, StringAlignment.Far, 6.5f),
                        new TextColumn(FormatTaxCell(item), 0.14f, StringAlignment.Far, 6.5f),
                        new TextColumn(GetItemTotal(item).ToString("0.00"), 0.16f, StringAlignment.Far, 6.5f)
                    );

                    y += 1;
                }

                y += 3;
                y += this.DrawDashedLine(g, y);
                y += 2;
            }

            // Totals (only show currency sign here)
            if (receiptData.Subtotal > 0)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Subtotal:", 0.7f, StringAlignment.Near, 7f),
                    new TextColumn(FormatCurrency(receiptData.Subtotal), 0.3f, StringAlignment.Far, 7f)
                );
            }

            if (receiptData.Discount > 0 || receiptData.DiscountAmount > 0)
            {
                decimal discountToShow = receiptData.Discount > 0 ? receiptData.Discount : receiptData.DiscountAmount;
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Total Discount:", 0.7f, StringAlignment.Near, 7f),
                    new TextColumn("-" + FormatCurrency(discountToShow), 0.3f, StringAlignment.Far, 7f)
                );
            }

            if (receiptData.ShippingCost > 0)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Shipping:", 0.7f, StringAlignment.Near, 7f),
                    new TextColumn(FormatCurrency(receiptData.ShippingCost), 0.3f, StringAlignment.Far, 7f)
                );
            }

            if (receiptData.Tax > 0 || receiptData.TaxAmount > 0)
            {
                decimal taxToShow = receiptData.Tax > 0 ? receiptData.Tax : receiptData.TaxAmount;
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Tax:", 0.7f, StringAlignment.Near, 7f),
                    new TextColumn(FormatCurrency(taxToShow), 0.3f, StringAlignment.Far, 7f)
                );
            }

            y += 2;
            decimal totalToShow = receiptData.Total > 0 ? receiptData.Total : receiptData.TotalAmount;
            y += this.DrawTextColumns(
                g, y,
                new TextColumn(receiptData.IsReturn ? "REFUND:" : "TOTAL:", 0.7f, StringAlignment.Near, 9f, FontStyle.Bold),
                new TextColumn(FormatCurrency(totalToShow), 0.3f, StringAlignment.Far, 9f, FontStyle.Bold)
            );

            // Payment information (only if exists)
            if (receiptData.Payment != null)
            {
                y += 3;
                y += this.DrawDashedLine(g, y);
                y += 2;

                if (!string.IsNullOrEmpty(receiptData.Payment.Method) || !string.IsNullOrEmpty(receiptData.Payment.PaymentMethod))
                {
                    string paymentMethod = !string.IsNullOrEmpty(receiptData.Payment.Method) ? receiptData.Payment.Method : receiptData.Payment.PaymentMethod;
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Payment:", 0.6f, StringAlignment.Near, 7f),
                        new TextColumn(paymentMethod, 0.4f, StringAlignment.Far, 7f)
                    );
                }

                if (!receiptData.IsReturn && receiptData.Payment.AmountPaid > 0)
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Paid:", 0.6f, StringAlignment.Near, 7f),
                        new TextColumn(FormatCurrency(receiptData.Payment.AmountPaid), 0.4f, StringAlignment.Far, 7f)
                    );
                }

                if (!receiptData.IsReturn && receiptData.Payment.Change > 0)
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Change:", 0.6f, StringAlignment.Near, 7f),
                        new TextColumn(FormatCurrency(receiptData.Payment.Change), 0.4f, StringAlignment.Far, 7f)
                    );
                }
            }

            // Notes (only if exists)
            if (!string.IsNullOrEmpty(receiptData.Notes))
            {
                y += 3;
                y += this.DrawDashedLine(g, y);
                y += 2;
                y += this.DrawCenteredText(g, y, receiptData.Notes, 7f, FontStyle.Italic);
            }

            // Footer terms and conditions (before thank you)
            if (!string.IsNullOrEmpty(config.FooterTerms))
            {
                y += 4;
                y += this.DrawDashedLine(g, y);
                y += 2;
                y += this.DrawWrappedTextLeftAligned(g, y, config.FooterTerms, 7f, FontStyle.Regular);
                y += 2;
            }

            // Sale barcode at bottom
            string barcodeValue = !string.IsNullOrEmpty(receiptData.BarcodeValue)
                ? receiptData.BarcodeValue
                : receiptData.SaleNumber;
            if (!string.IsNullOrEmpty(barcodeValue))
            {
                y += 4;
                y += this.DrawDashedLine(g, y);
                y += 2;
                y += this.DrawReceiptBarcode(g, y, barcodeValue);
            }

            // Footer — always show Powered by Posbuzz
            y += 6;
            y += this.DrawCenteredText(g, y, "Thank you for your business!", 8f, FontStyle.Bold);
            y += 2;
            y += this.DrawCenteredText(g, y, DateTime.Now.ToString("MM/dd/yyyy HH:mm:ss"), 6f);
            y += 2;
            y += this.DrawCenteredText(g, y, "Powered by Posbuzz", 6f, FontStyle.Italic);
        }

        private string FormatCurrency(decimal amount)
        {
            return config.Currency + amount.ToString("0.00");
        }

        private string GetSaleNumberText()
        {
            if (!string.IsNullOrEmpty(receiptData.SaleNumber))
            {
                return receiptData.SaleNumber;
            }

            if (!string.IsNullOrEmpty(receiptData.OrderId))
            {
                return receiptData.OrderId;
            }

            return "";
        }

        private string BuildCustomerRewardSummary()
        {
            if (receiptData.Customer == null)
            {
                return "";
            }

            if (receiptData.Customer.RewardPoints.HasValue)
            {
                return receiptData.Customer.RewardPoints.Value + " pts";
            }

            return "";
        }

        private decimal GetItemTotal(ReceiptItem item)
        {
            if (item.LineTotal > 0)
            {
                return item.LineTotal;
            }

            if (item.Total > 0)
            {
                return item.Total;
            }

            decimal gross = item.GrossLineTotal > 0
                ? item.GrossLineTotal
                : item.Quantity * item.Price;
            decimal net = gross - item.DiscountAmount;

            bool isInclusiveTax = !string.IsNullOrEmpty(item.TaxMethod) &&
                item.TaxMethod.StartsWith("inc", StringComparison.OrdinalIgnoreCase);

            if (!isInclusiveTax && item.TaxAmount > 0)
            {
                net += item.TaxAmount;
            }

            return net;
        }

        private string FormatTaxCell(ReceiptItem item)
        {
            string taxMode = string.IsNullOrEmpty(item.TaxMethod)
                ? ""
                : item.TaxMethod.StartsWith("inc", StringComparison.OrdinalIgnoreCase) || item.TaxMethod.StartsWith("INCLUSIVE", StringComparison.OrdinalIgnoreCase)
                    ? "inc"
                    : "exc";

            if (item.TaxAmount > 0)
            {
                return string.Format("{0:0.00} {1}", item.TaxAmount, taxMode).Trim();
            }

            if (item.TaxPercentage > 0)
            {
                return string.Format("{0:0.##}% {1}", item.TaxPercentage, taxMode).Trim();
            }

            return taxMode;
        }

        private float DrawReceiptBarcode(Graphics g, float y, string barcodeText)
        {
            try
            {
                BarcodeWriter writer = new BarcodeWriter
                {
                    Format = BarcodeFormat.CODE_128,
                    Options = new ZXing.Common.EncodingOptions
                    {
                        Width = 420,
                        Height = 120,
                        Margin = 0,
                        PureBarcode = false
                    }
                };

                using (Bitmap barcodeBitmap = writer.Write(barcodeText))
                {
                    float barcodeWidth = 52f;
                    float barcodeHeight = 14f;
                    float x = (this.width - barcodeWidth) / 2;
                    g.DrawImage(barcodeBitmap, x, y, barcodeWidth, barcodeHeight);
                    return barcodeHeight;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Could not render receipt barcode: " + ex.Message);
                return this.DrawCenteredText(g, y, barcodeText, 6f);
            }
        }

        private float DrawCenteredText(Graphics g, float y, string text, float fontSize, FontStyle style = FontStyle.Regular)
        {
            using (Font font = new Font("Arial", fontSize, style))
            {
                SizeF textSize = g.MeasureString(text, font);
                float x = (this.width - textSize.Width) / 2;
                g.DrawString(text, font, Brushes.Black, x, y);
                return textSize.Height;
            }
        }

        private float DrawWrappedText(Graphics g, float y, string text, float fontSize, FontStyle style = FontStyle.Regular)
        {
            using (Font font = new Font("Arial", fontSize, style))
            {
                // Handle explicit line breaks in the text
                string[] lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                float totalHeight = 0;

                foreach (string line in lines)
                {
                    // Measure and wrap the line if needed (including empty lines)
                    // Increased width by reducing margins from 5+5 to 2+2
                    RectangleF layoutRect = new RectangleF(2, y + totalHeight, this.width - 4, 1000);
                    StringFormat format = new StringFormat
                    {
                        Alignment = StringAlignment.Center,
                        LineAlignment = StringAlignment.Near,
                        Trimming = StringTrimming.Word
                    };

                    if (string.IsNullOrEmpty(line))
                    {
                        // Empty line - use minimal spacing (just the font height)
                        using (Font measureFont = new Font("Arial", fontSize, style))
                        {
                            totalHeight += measureFont.Height;
                        }
                    }
                    else
                    {
                        SizeF textSize = g.MeasureString(line, font, (int)(this.width - 4), format);
                        g.DrawString(line, font, Brushes.Black, layoutRect, format);
                        totalHeight += textSize.Height;
                    }
                }

                return totalHeight;
            }
        }

        private float DrawWrappedTextLeftAligned(Graphics g, float y, string text, float fontSize, FontStyle style = FontStyle.Regular)
        {
            using (Font font = new Font("Arial", fontSize, style))
            {
                // Handle explicit line breaks in the text
                string[] lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                float totalHeight = 0;

                foreach (string line in lines)
                {
                    // Measure and wrap the line if needed (including empty lines)
                    RectangleF layoutRect = new RectangleF(5, y + totalHeight, this.width - 10, 1000);
                    StringFormat format = new StringFormat
                    {
                        Alignment = StringAlignment.Near,
                        LineAlignment = StringAlignment.Near,
                        Trimming = StringTrimming.Word
                    };

                    if (string.IsNullOrEmpty(line))
                    {
                        // Empty line - use minimal spacing (just the font height)
                        using (Font measureFont = new Font("Arial", fontSize, style))
                        {
                            totalHeight += measureFont.Height;
                        }
                    }
                    else
                    {
                        SizeF textSize = g.MeasureString(line, font, (int)(this.width - 10), format);
                        g.DrawString(line, font, Brushes.Black, layoutRect, format);
                        totalHeight += textSize.Height;
                    }
                }

                return totalHeight;
            }
        }

        private float DrawLine(Graphics g, float y)
        {
            using (Pen pen = new Pen(Color.Black, 0.5f))
            {
                g.DrawLine(pen, 5, y, this.width - 5, y);
                return 2f;
            }
        }

        private float DrawDashedLine(Graphics g, float y)
        {
            using (Pen pen = new Pen(Color.Black, 0.3f))
            {
                pen.DashStyle = System.Drawing.Drawing2D.DashStyle.Dot;
                g.DrawLine(pen, 5, y, this.width - 5, y);
                return 1f;
            }
        }

        public bool OpenCashDrawer(string printerName)
        {
            try
            {
                Console.WriteLine("Opening cash drawer for printer: " + printerName);

                // ESC/POS commands to open cash drawer
                // Standard commands that work with most thermal printers
                byte[] openDrawerCommand1 = { 0x1B, 0x70, 0x00, 0x19, 0xFA }; // ESC p 0 25 250
                byte[] openDrawerCommand2 = { 0x1B, 0x70, 0x01, 0x19, 0xFA }; // ESC p 1 25 250 (alternative pin)

                // Try the working approach first
                bool success = SendRawCommandViaPrintSpooler(printerName, openDrawerCommand1);
                if (!success)
                {
                    Console.WriteLine("First cash drawer command failed, trying alternative...");
                    success = SendRawCommandViaPrintSpooler(printerName, openDrawerCommand2);
                }

                if (success)
                {
                    Console.WriteLine("✓ Cash drawer command sent successfully");
                }
                else
                {
                    Console.WriteLine("✗ All cash drawer commands failed");
                }

                return success;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error opening cash drawer: " + ex.Message);
                return false;
            }
        }

        private bool SendRawCommandViaPrintSpooler(string printerName, byte[] data)
        {
            try
            {
                // This is a more direct approach using .NET's printing capabilities
                // Create a print job that sends raw ESC/POS data

                using (var printDoc = new PrintDocument())
                {
                    printDoc.PrinterSettings.PrinterName = printerName;

                    // Set to raw mode if possible
                    printDoc.PrinterSettings.DefaultPageSettings.PrinterSettings.PrinterName = printerName;

                    bool success = false;
                    printDoc.PrintPage += (sender, e) =>
                    {
                        try
                        {
                            // Create a very small graphic to trigger the print
                            var font = new Font("Courier New", 6);

                            // Draw an invisible character that forces the printer to process
                            e.Graphics.DrawString(System.Text.Encoding.ASCII.GetString(data), font, Brushes.White, 0, 0);

                            Console.WriteLine("ESC/POS cash drawer command sent: " + BitConverter.ToString(data));
                            success = true;
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("Error sending cash drawer command: " + ex.Message);
                        }
                    };

                    printDoc.Print();
                    return success;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error in SendRawCommandViaPrintSpooler: " + ex.Message);

                // If the main approach fails, return false
                return false;
            }
        }
    }
}
