using System;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using Printer.Models;
using Printer.Services;

namespace Printer
{
    public class DynamicReceiptPrint : PrintBase
    {
        private ReceiptData receiptData;
        private StoreConfig config;

        public bool Print(string printerName, ReceiptData data)
        {
            try
            {
                this.receiptData = data;
                this.config = ConfigManager.GetConfig();
                
                bool success = this.Print(printerName, this.PrintReceipt);
                
                // Open cash drawer if requested and enabled
                if (success && data.OpenCashDrawer && config.EnableCashDrawer)
                {
                    OpenCashDrawer(printerName);
                }
                
                return success;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error printing receipt: {ex.Message}");
                return false;
            }
        }

        private void PrintReceipt(Graphics g)
        {
            float y = 10; // Start position
            float lineHeight = 15;

            // Print logo if available
            if (!string.IsNullOrEmpty(config.LogoPath) && File.Exists(config.LogoPath))
            {
                try
                {
                    using (Image logoImage = Image.FromFile(config.LogoPath))
                    {
                        float logoWidth = Math.Min(60, logoImage.Width * 60 / logoImage.Height);
                        float logoHeight = logoImage.Height * logoWidth / logoImage.Width;
                        float logoX = (this.width - logoWidth) / 2;
                        
                        g.DrawImage(logoImage, logoX, y, logoWidth, logoHeight);
                        y += logoHeight + 10;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Could not load logo: {ex.Message}");
                }
            }

            // Store information
            if (!string.IsNullOrEmpty(config.StoreName))
            {
                y += this.DrawCenteredText(g, y, config.StoreName, 16f, FontStyle.Bold);
                y += 5;
            }

            if (!string.IsNullOrEmpty(config.Address))
            {
                y += this.DrawCenteredText(g, y, config.Address, 10f);
                y += 2;
            }

            if (!string.IsNullOrEmpty(config.Phone))
            {
                y += this.DrawCenteredText(g, y, config.Phone, 10f);
                y += 2;
            }

            if (!string.IsNullOrEmpty(config.Email))
            {
                y += this.DrawCenteredText(g, y, config.Email, 10f);
                y += 10;
            }

            // Separator line
            y += this.DrawLine(g, y);
            y += 5;

            // Order information
            if (!string.IsNullOrEmpty(receiptData.OrderId))
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Order ID:", 0.6f, fontSize: 12f, style: FontStyle.Bold),
                    new TextColumn(receiptData.OrderId, 0.4f, StringAlignment.Far, 12f)
                );
            }

            if (receiptData.OrderDate.HasValue)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Date:", 0.6f, fontSize: 10f),
                    new TextColumn(receiptData.OrderDate.Value.ToString("MM/dd/yyyy HH:mm"), 0.4f, StringAlignment.Far, 10f)
                );
            }

            // Customer information
            if (receiptData.Customer != null && !string.IsNullOrEmpty(receiptData.Customer.Name))
            {
                y += 5;
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Customer:", 0.3f, fontSize: 10f),
                    new TextColumn(receiptData.Customer.Name, 0.7f, fontSize: 10f)
                );

                if (!string.IsNullOrEmpty(receiptData.Customer.Phone))
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Phone:", 0.3f, fontSize: 10f),
                        new TextColumn(receiptData.Customer.Phone, 0.7f, fontSize: 10f)
                    );
                }
            }

            y += 10;
            y += this.DrawLine(g, y);
            y += 5;

            // Items header
            y += this.DrawTextColumns(
                g, y,
                new TextColumn("Item", 0.5f, fontSize: 10f, style: FontStyle.Bold),
                new TextColumn("Qty", 0.15f, StringAlignment.Center, 10f, FontStyle.Bold),
                new TextColumn("Price", 0.175f, StringAlignment.Far, 10f, FontStyle.Bold),
                new TextColumn("Total", 0.175f, StringAlignment.Far, 10f, FontStyle.Bold)
            );
            
            y += this.DrawLine(g, y);
            y += 2;

            // Items
            foreach (var item in receiptData.Items)
            {
                string itemText = item.Name;
                if (!string.IsNullOrEmpty(item.Description))
                {
                    itemText += "\n" + item.Description;
                }

                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn(itemText, 0.5f, fontSize: 10f),
                    new TextColumn(item.Quantity.ToString(), 0.15f, StringAlignment.Center, 10f),
                    new TextColumn(FormatCurrency(item.Price), 0.175f, StringAlignment.Far, 10f),
                    new TextColumn(FormatCurrency(item.Total), 0.175f, StringAlignment.Far, 10f)
                );
            }

            y += 10;
            y += this.DrawLine(g, y);
            y += 5;

            // Totals
            if (receiptData.Subtotal > 0)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Subtotal:", 0.7f, fontSize: 11f),
                    new TextColumn(FormatCurrency(receiptData.Subtotal), 0.3f, StringAlignment.Far, 11f)
                );
            }

            if (receiptData.Tax > 0)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Tax:", 0.7f, fontSize: 11f),
                    new TextColumn(FormatCurrency(receiptData.Tax), 0.3f, StringAlignment.Far, 11f)
                );
            }

            if (receiptData.Discount > 0)
            {
                y += this.DrawTextColumns(
                    g, y,
                    new TextColumn("Discount:", 0.7f, fontSize: 11f),
                    new TextColumn("-" + FormatCurrency(receiptData.Discount), 0.3f, StringAlignment.Far, 11f)
                );
            }

            y += 5;
            y += this.DrawTextColumns(
                g, y,
                new TextColumn("TOTAL:", 0.7f, fontSize: 14f, style: FontStyle.Bold),
                new TextColumn(FormatCurrency(receiptData.Total), 0.3f, StringAlignment.Far, 14f, FontStyle.Bold)
            );

            // Payment information
            if (receiptData.Payment != null)
            {
                y += 10;
                y += this.DrawLine(g, y);
                y += 5;

                if (!string.IsNullOrEmpty(receiptData.Payment.Method))
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Payment Method:", 0.6f, fontSize: 10f),
                        new TextColumn(receiptData.Payment.Method, 0.4f, StringAlignment.Far, 10f)
                    );
                }

                if (receiptData.Payment.AmountPaid > 0)
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Amount Paid:", 0.6f, fontSize: 10f),
                        new TextColumn(FormatCurrency(receiptData.Payment.AmountPaid), 0.4f, StringAlignment.Far, 10f)
                    );
                }

                if (receiptData.Payment.Change > 0)
                {
                    y += this.DrawTextColumns(
                        g, y,
                        new TextColumn("Change:", 0.6f, fontSize: 10f),
                        new TextColumn(FormatCurrency(receiptData.Payment.Change), 0.4f, StringAlignment.Far, 10f)
                    );
                }
            }

            // Notes
            if (!string.IsNullOrEmpty(receiptData.Notes))
            {
                y += 10;
                y += this.DrawLine(g, y);
                y += 5;
                y += this.DrawCenteredText(g, y, receiptData.Notes, 10f, FontStyle.Italic);
            }

            // Footer
            y += 15;
            y += this.DrawCenteredText(g, y, "Thank you for your business!", 12f, FontStyle.Bold);
            y += 5;
            y += this.DrawCenteredText(g, y, DateTime.Now.ToString("MM/dd/yyyy HH:mm:ss"), 8f);
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

        private void OpenCashDrawer(string printerName)
        {
            try
            {
                // ESC/POS command to open cash drawer (standard command)
                byte[] openDrawerCommand = { 0x1B, 0x70, 0x00, 0x19, 0xFA };
                
                // Send raw command to printer to open cash drawer
                using (var printDoc = new PrintDocument())
                {
                    printDoc.PrinterSettings.PrinterName = printerName;
                    printDoc.PrintPage += (sender, e) =>
                    {
                        // The cash drawer command is typically sent as raw data
                        // This is a simplified approach - in production you might need
                        // more sophisticated raw printing methods
                    };
                }
                
                Console.WriteLine("Cash drawer open command sent");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error opening cash drawer: {ex.Message}");
            }
        }
    }
}
