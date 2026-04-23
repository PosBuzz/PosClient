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
            var viewLogsItem = new ToolStripMenuItem("View Logs", null, ViewLogs_Click);
            var configureItem = new ToolStripMenuItem("Configure", null, Configure_Click);
            var changePasswordItem = new ToolStripMenuItem("Change Password", null, ChangePassword_Click);
            var testReceiptItem = new ToolStripMenuItem("Test Receipt", null, TestReceipt_Click);
            var testBarcodeItem = new ToolStripMenuItem("Test Barcode", null, TestBarcode_Click);
            var exitItem = new ToolStripMenuItem("Exit", null, Exit_Click);
            
            contextMenu.Items.Add(startServerItem);
            contextMenu.Items.Add(stopServerItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(viewLogsItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(configureItem);
            contextMenu.Items.Add(changePasswordItem);
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
            // Create a blue printer icon for system tray
            var bitmap = new Bitmap(16, 16);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Transparent);
                using (var brush = new SolidBrush(Color.FromArgb(0, 120, 215))) // Windows blue
                {
                    graphics.FillEllipse(brush, 1, 1, 14, 14);
                }
                graphics.DrawString("P", new Font("Arial", 10, FontStyle.Bold), Brushes.White, 3, 1);
            }
            return Icon.FromHandle(bitmap.GetHicon());
        }

        private void StartServer_Click(object sender, EventArgs e) => StartServer();
        private void StopServer_Click(object sender, EventArgs e) => StopServer();
        private void ViewLogs_Click(object sender, EventArgs e) => ShowLogViewer();
        private void Configure_Click(object sender, EventArgs e) => ShowConfigurationDialog();
        private void ChangePassword_Click(object sender, EventArgs e) => ShowChangePasswordDialog();
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

        private void ShowLogViewer()
        {
            try
            {
                var logViewer = new LogViewerForm();
                logViewer.ShowDialog();
            }
            catch (Exception ex)
            {
                ShowBalloonTip("Log Viewer Error", "Error opening log viewer: " + ex.Message, ToolTipIcon.Error);
            }
        }

        private void ShowConfigurationDialog()
        {
            // Require password authentication
            var config = ConfigManager.GetConfig();
            string currentPassword = string.IsNullOrEmpty(config.Password) ? "123456" : config.Password;

            if (!PasswordDialog.Authenticate(currentPassword))
            {
                ShowBalloonTip("Access Denied", "Incorrect password", ToolTipIcon.Warning);
                return;
            }

            // Show configuration form if authenticated
            var configForm = new ConfigurationForm(config);
            if (configForm.ShowDialog() == DialogResult.OK)
            {
                ConfigManager.UpdateConfig(configForm.UpdatedConfig);
                ShowBalloonTip("Configuration Updated", "Settings have been saved successfully", ToolTipIcon.Info);
            }
        }

        private void ShowChangePasswordDialog()
        {
            try
            {
                var changePasswordForm = new ChangePasswordDialog();
                changePasswordForm.ShowDialog();
            }
            catch (Exception ex)
            {
                ShowBalloonTip("Password Change Error", "Error: " + ex.Message, ToolTipIcon.Error);
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
                var config = ConfigManager.GetConfig();
                string shopName = !string.IsNullOrEmpty(config.StoreName) ? config.StoreName : "PosBuzz";
                string branchName = "Main Branch";
                string location = !string.IsNullOrEmpty(config.Address) ? config.Address : "Test Location";
                BarcodeLabelPrint.PrintLabel("1234567890123", "Test Product", "19.99", false, true, 21.0m, 1, shopName, branchName, location);
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
                OrderId = "TEST-001",
                BarcodeValue = "TEST-001",
                OrderDate = DateTime.Now,
                Branch = new Models.BranchInfo
                {
                    Name = !string.IsNullOrEmpty(config.StoreName) ? config.StoreName : "Test Branch",
                    Address = config.Address,
                    Phone = config.Phone
                },
                Cashier = new Models.UserInfo { Name = "System Test" },
                Customer = new Models.CustomerInfo
                {
                    Name = "Test Customer",
                    Phone = "01700-000000",
                    RewardPoints = 120,
                    PointsEarned = 15,
                    PointsRedeemed = 5
                },
                Items = new System.Collections.Generic.List<Models.ReceiptItem>
                {
                    new Models.ReceiptItem
                    {
                        Name = "Test Item 1",
                        Quantity = 2,
                        Price = 10.00m,
                        UnitPrice = 10.00m,
                        GrossLineTotal = 20.00m,
                        AverageDiscountAmount = 1.00m,
                        SpecialDiscountAmount = 0.50m,
                        PromotionDiscountAmount = 0.50m,
                        DiscountAmount = 2.00m,
                        TaxAmount = 0.90m,
                        TaxPercentage = 5.00m,
                        TaxMethod = "inclusive",
                        LineTotal = 18.00m,
                        Total = 18.00m
                    },
                    new Models.ReceiptItem
                    {
                        Name = "Test Item 2",
                        Quantity = 1,
                        Price = 15.99m,
                        UnitPrice = 15.99m,
                        GrossLineTotal = 15.99m,
                        AverageDiscountAmount = 0.50m,
                        SpecialDiscountAmount = 0.30m,
                        PromotionDiscountAmount = 0.20m,
                        DiscountAmount = 1.00m,
                        TaxAmount = 0.75m,
                        TaxPercentage = 5.00m,
                        TaxMethod = "exclusive",
                        LineTotal = 14.99m,
                        Total = 14.99m
                    }
                },
                Subtotal = 35.99m,
                Discount = 3.00m,
                DiscountAmount = 3.00m,
                Tax = 1.65m,
                TaxAmount = 1.65m,
                Total = 32.99m,
                TotalAmount = 32.99m,
                ReceivedAmount = 40.00m,
                ChangeAmount = 7.01m,
                Notes = "Tray test receipt with discount/tax split, barcode, and points",
                Payment = new Models.PaymentInfo { PaymentMethod = "Cash", AmountPaid = 40.00m, Change = 7.01m }
            };
        }

        private void ShowBalloonTip(string title, string text, ToolTipIcon icon)
        {
            if (notifyIcon != null)
            {
                // Force all notifications to use Info (blue) icon
                notifyIcon.ShowBalloonTip(3000, title, text, ToolTipIcon.Info);
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
