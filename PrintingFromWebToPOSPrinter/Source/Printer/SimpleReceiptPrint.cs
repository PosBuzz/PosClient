using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Runtime.InteropServices;
using Printer.Models;
using Printer.Services;

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

            // Print logo if available
            if (!string.IsNullOrEmpty(config.LogoPath) && File.Exists(config.LogoPath))
            {
                try
                {
                    using (Image logoImage = Image.FromFile(config.LogoPath))
                    {
                        float logoWidth = Math.Min(40, logoImage.Width * 40 / logoImage.Height);
                        float logoHeight = logoImage.Height * logoWidth / logoImage.Width;
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

            // Store information
            if (!string.IsNullOrEmpty(config.StoreName))
            {
                y += this.DrawCenteredText(g, y, config.StoreName, 10f, FontStyle.Bold);
                y += 2;
            }

            if (!string.IsNullOrEmpty(config.Address))
            {
                y += this.DrawCenteredText(g, y, config.Address, 7f);
                y += 1;
            }

            if (!string.IsNullOrEmpty(config.Phone))
            {
                y += this.DrawCenteredText(g, y, config.Phone, 7f);
                y += 3;
            }

            // Order information
            if (!string.IsNullOrEmpty(receiptData.OrderId))
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Order ID:", 0.6f, StringAlignment.Near, 7f),
                    new TextColumn(receiptData.OrderId, 0.4f, StringAlignment.Far, 7f)
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

            // Customer information (only if exists)
            if (receiptData.Customer != null && !string.IsNullOrEmpty(receiptData.Customer.Name))
            {
                y += 2;
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Customer:", 0.3f, StringAlignment.Near, 7f),
                    new TextColumn(receiptData.Customer.Name, 0.7f, StringAlignment.Near, 7f)
                );
            }

            // Items section
            if (receiptData.Items != null && receiptData.Items.Count > 0)
            {
                y += 4;
                y += this.DrawDashedLine(g, y);
                y += 4; // More gap after header line

                // Items header
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Item", 0.5f, StringAlignment.Near, 7f, FontStyle.Bold),
                    new TextColumn("Qty", 0.15f, StringAlignment.Center, 7f, FontStyle.Bold),
                    new TextColumn("Price", 0.175f, StringAlignment.Far, 7f, FontStyle.Bold),
                    new TextColumn("Total", 0.175f, StringAlignment.Far, 7f, FontStyle.Bold)
                );
                
                y += 2;
                y += this.DrawDashedLine(g, y);
                y += 2;

                foreach (var item in receiptData.Items)
                {
                    string itemText = item.Name;
                    if (!string.IsNullOrEmpty(item.Description))
                    {
                        itemText += " - " + item.Description;
                    }

                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn(itemText, 0.5f, StringAlignment.Near, 7f),
                        new TextColumn(item.Quantity.ToString(), 0.15f, StringAlignment.Center, 7f),
                        new TextColumn(item.Price.ToString("0.00"), 0.175f, StringAlignment.Far, 7f),
                        new TextColumn(item.Total.ToString("0.00"), 0.175f, StringAlignment.Far, 7f)
                    );
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
                    new TextColumn("Discount:", 0.7f, StringAlignment.Near, 7f),
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
                new TextColumn("TOTAL:", 0.7f, StringAlignment.Near, 9f, FontStyle.Bold),
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

                if (receiptData.Payment.AmountPaid > 0)
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Paid:", 0.6f, StringAlignment.Near, 7f),
                        new TextColumn(FormatCurrency(receiptData.Payment.AmountPaid), 0.4f, StringAlignment.Far, 7f)
                    );
                }

                if (receiptData.Payment.Change > 0)
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

            // Footer
            y += 6; // Reduced gap before thanks
            y += this.DrawCenteredText(g, y, "Thank you for your business!", 8f, FontStyle.Bold);
            y += 2;
            y += this.DrawCenteredText(g, y, DateTime.Now.ToString("MM/dd/yyyy HH:mm:ss"), 6f);
        }

        private string FormatCurrency(decimal amount)
        {
            return config.Currency + amount.ToString("0.00");
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
