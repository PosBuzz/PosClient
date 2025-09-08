using System;
using System.Drawing;
using System.Windows.Forms;
using Printer.Services;

namespace Printer
{
    public class SystemTrayManager
    {
        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;
        private HttpPrintServer httpServer;
        private bool isServerRunning = false;

        public SystemTrayManager()
        {
            try
            {
                httpServer = new HttpPrintServer();
                InitializeSystemTray();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error initializing system tray: {ex.Message}", "System Tray Error", 
                               MessageBoxButtons.OK, MessageBoxIcon.Error);
                throw;
            }
        }

        private void InitializeSystemTray()
        {
            // Create the context menu
            contextMenu = new ContextMenuStrip();
            
            // Add menu items
            var startServerItem = new ToolStripMenuItem("Start Server", null, StartServer_Click);
            var stopServerItem = new ToolStripMenuItem("Stop Server", null, StopServer_Click);
            var configureItem = new ToolStripMenuItem("Configure", null, Configure_Click);
            var testReceiptItem = new ToolStripMenuItem("Test Receipt", null, TestReceipt_Click);
            var testBarcodeItem = new ToolStripMenuItem("Test Barcode", null, TestBarcode_Click);
            var exitItem = new ToolStripMenuItem("Exit", null, Exit_Click);
            
            contextMenu.Items.Add(startServerItem);
            contextMenu.Items.Add(stopServerItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(configureItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(testReceiptItem);
            contextMenu.Items.Add(testBarcodeItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(exitItem);

            // Create the notify icon
            notifyIcon = new NotifyIcon();
            notifyIcon.Icon = CreateIcon();
            notifyIcon.Text = "PosBuzz Print Server";
            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Visible = true;
            
            // Double-click to toggle server
            notifyIcon.DoubleClick += NotifyIcon_DoubleClick;

            // Show startup notification
            ShowBalloonTip("PosBuzz Print Server", "Print server started in system tray", ToolTipIcon.Info);

            // Auto-start server
            StartServer();
        }

        private Icon CreateIcon()
        {
            // Create a simple icon with "P" text
            var bitmap = new Bitmap(16, 16);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Blue);
                graphics.DrawString("P", new Font("Arial", 8, FontStyle.Bold), Brushes.White, 4, 2);
            }
            return Icon.FromHandle(bitmap.GetHicon());
        }

        private void StartServer_Click(object sender, EventArgs e) => StartServer();
        private void StopServer_Click(object sender, EventArgs e) => StopServer();
        private void Configure_Click(object sender, EventArgs e) => ShowConfigurationDialog();
        private void TestReceipt_Click(object sender, EventArgs e) => TestReceipt();
        private void TestBarcode_Click(object sender, EventArgs e) => TestBarcode();
        private void Exit_Click(object sender, EventArgs e) => Exit();

        private void NotifyIcon_DoubleClick(object sender, EventArgs e)
        {
            if (isServerRunning)
            {
                StopServer();
            }
            else
            {
                StartServer();
            }
        }

        public void StartServer()
        {
            if (!isServerRunning && httpServer != null)
            {
                try
                {
                    var config = ConfigManager.GetConfig();
                    httpServer.Start(config.Port);
                    isServerRunning = true;
                    notifyIcon.Text = $"PosBuzz Print Server - Running on port {config.Port}";
                    ShowBalloonTip("Server Started", $"Print server is now running on port {config.Port}", ToolTipIcon.Info);
                    UpdateMenuItems();
                }
                catch (Exception ex)
                {
                    ShowBalloonTip("Server Error", "Failed to start server: " + ex.Message, ToolTipIcon.Error);
                }
            }
        }

        public void StopServer()
        {
            if (isServerRunning && httpServer != null)
            {
                try
                {
                    httpServer.Stop();
                    isServerRunning = false;
                    notifyIcon.Text = "PosBuzz Print Server - Stopped";
                    ShowBalloonTip("Server Stopped", "Print server has been stopped", ToolTipIcon.Info);
                    UpdateMenuItems();
                }
                catch (Exception ex)
                {
                    ShowBalloonTip("Server Error", "Error stopping server: " + ex.Message, ToolTipIcon.Error);
                }
            }
        }

        private void UpdateMenuItems()
        {
            if (contextMenu != null && contextMenu.Items.Count > 1)
            {
                contextMenu.Items[0].Enabled = !isServerRunning; // Start Server
                contextMenu.Items[1].Enabled = isServerRunning;  // Stop Server
            }
        }

        private void ShowConfigurationDialog()
        {
            var config = ConfigManager.GetConfig();
            var configForm = new ConfigurationForm(config);
            if (configForm.ShowDialog() == DialogResult.OK)
            {
                ConfigManager.UpdateConfig(configForm.UpdatedConfig);
                ShowBalloonTip("Configuration Updated", "Settings have been saved successfully", ToolTipIcon.Info);
            }
        }

        private void TestReceipt()
        {
            try
            {
                var printer = new SimpleReceiptPrint();
                var testData = CreateTestReceiptData();
                var config = ConfigManager.GetConfig();
                
                if (printer.Print(config.PrinterName, testData))
                {
                    ShowBalloonTip("Test Receipt", "Test receipt printed successfully", ToolTipIcon.Info);
                }
                else
                {
                    ShowBalloonTip("Test Receipt", "Failed to print test receipt", ToolTipIcon.Warning);
                }
            }
            catch (Exception ex)
            {
                ShowBalloonTip("Test Receipt Error", "Error: " + ex.Message, ToolTipIcon.Error);
            }
        }

        private void TestBarcode()
        {
            try
            {
                Barcode.BarcodeLabelPrint.PrintLabel("1234567890123", "Test Product", "19.99", false, true, 21.0m, 1);
                ShowBalloonTip("Test Barcode", "Test barcode printed successfully", ToolTipIcon.Info);
            }
            catch (Exception ex)
            {
                ShowBalloonTip("Test Barcode Error", "Error: " + ex.Message, ToolTipIcon.Error);
            }
        }

        private Models.ReceiptData CreateTestReceiptData()
        {
            var config = ConfigManager.GetConfig();
            return new Models.ReceiptData
            {
                SaleNumber = "TEST-001",
                OrderDate = DateTime.Now,
                Branch = new Models.BranchInfo { Name = config.StoreName, Address = config.Address, Phone = config.Phone },
                Cashier = new Models.UserInfo { Name = "System Test" },
                Customer = new Models.CustomerInfo { Name = "Test Customer" },
                Items = new System.Collections.Generic.List<Models.ReceiptItem>
                {
                    new Models.ReceiptItem { Name = "Test Item 1", Quantity = 2, Price = 10.00m, Total = 20.00m },
                    new Models.ReceiptItem { Name = "Test Item 2", Quantity = 1, Price = 15.99m, Total = 15.99m }
                },
                Subtotal = 35.99m,
                Tax = 3.60m,
                Total = 39.59m,
                ReceivedAmount = 40.00m,
                ChangeAmount = 0.41m,
                Payment = new Models.PaymentInfo { PaymentMethod = "Cash", AmountPaid = 40.00m, Change = 0.41m }
            };
        }

        private void ShowBalloonTip(string title, string text, ToolTipIcon icon)
        {
            if (notifyIcon != null)
            {
                notifyIcon.ShowBalloonTip(3000, title, text, icon);
            }
        }

        public void Run()
        {
            Application.Run();
        }

        public void Exit()
        {
            if (httpServer != null && isServerRunning)
            {
                StopServer();
            }
            
            if (notifyIcon != null)
            {
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
            }
            
            Application.Exit();
        }
    }
}
