using System;
using System.Drawing;
using System.Windows.Forms;
using Printer.Models;

namespace Printer
{
    public partial class ConfigurationForm : Form
    {
        public StoreConfig UpdatedConfig { get; private set; }

        private TextBox txtStoreName;
        private TextBox txtAddress;
        private TextBox txtPhone;
        private TextBox txtEmail;
        private TextBox txtPrinterName;
        private TextBox txtBarcodePrinterName;
        private TextBox txtCurrency;
        private NumericUpDown numPort;
        private CheckBox chkStartupWithWindows;
        private Button btnOK;
        private Button btnCancel;

        public ConfigurationForm(StoreConfig currentConfig)
        {
            InitializeComponent();
            LoadConfiguration(currentConfig);
        }

        private void InitializeComponent()
        {
            this.Text = "Configuration - PosBuzz Print Server";
            this.Size = new Size(450, 390);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;

            // Create controls
            var lblStoreName = new Label { Text = "Store Name:", Location = new Point(20, 20), Size = new Size(100, 20) };
            txtStoreName = new TextBox { Location = new Point(130, 18), Size = new Size(280, 20) };

            var lblAddress = new Label { Text = "Address:", Location = new Point(20, 50), Size = new Size(100, 20) };
            txtAddress = new TextBox { Location = new Point(130, 48), Size = new Size(280, 20) };

            var lblPhone = new Label { Text = "Phone:", Location = new Point(20, 80), Size = new Size(100, 20) };
            txtPhone = new TextBox { Location = new Point(130, 78), Size = new Size(280, 20) };

            var lblEmail = new Label { Text = "Email:", Location = new Point(20, 110), Size = new Size(100, 20) };
            txtEmail = new TextBox { Location = new Point(130, 108), Size = new Size(280, 20) };

            var lblPrinterName = new Label { Text = "Receipt Printer:", Location = new Point(20, 140), Size = new Size(100, 20) };
            txtPrinterName = new TextBox { Location = new Point(130, 138), Size = new Size(280, 20) };

            var lblBarcodePrinter = new Label { Text = "Barcode Printer:", Location = new Point(20, 170), Size = new Size(100, 20) };
            txtBarcodePrinterName = new TextBox { Location = new Point(130, 168), Size = new Size(280, 20) };

            var lblCurrency = new Label { Text = "Currency:", Location = new Point(20, 200), Size = new Size(100, 20) };
            txtCurrency = new TextBox { Location = new Point(130, 198), Size = new Size(100, 20) };

            var lblPort = new Label { Text = "Server Port:", Location = new Point(20, 230), Size = new Size(100, 20) };
            numPort = new NumericUpDown 
            { 
                Location = new Point(130, 228), 
                Size = new Size(100, 20),
                Minimum = 1000,
                Maximum = 65535,
                Value = 8080
            };

            chkStartupWithWindows = new CheckBox 
            { 
                Text = "Start with Windows (system tray)", 
                Location = new Point(20, 260), 
                Size = new Size(200, 20) 
            };

            btnOK = new Button 
            { 
                Text = "OK", 
                Location = new Point(250, 320), 
                Size = new Size(75, 30),
                DialogResult = DialogResult.OK
            };
            btnOK.Click += BtnOK_Click;

            btnCancel = new Button 
            { 
                Text = "Cancel", 
                Location = new Point(335, 320), 
                Size = new Size(75, 30),
                DialogResult = DialogResult.Cancel
            };

            // Add controls to form
            this.Controls.AddRange(new Control[] 
            {
                lblStoreName, txtStoreName,
                lblAddress, txtAddress,
                lblPhone, txtPhone,
                lblEmail, txtEmail,
                lblPrinterName, txtPrinterName,
                lblBarcodePrinter, txtBarcodePrinterName,
                lblCurrency, txtCurrency,
                lblPort, numPort,
                chkStartupWithWindows,
                btnOK, btnCancel
            });

            this.AcceptButton = btnOK;
            this.CancelButton = btnCancel;
        }

        private void LoadConfiguration(StoreConfig config)
        {
            txtStoreName.Text = config.StoreName ?? "";
            txtAddress.Text = config.Address ?? "";
            txtPhone.Text = config.Phone ?? "";
            txtEmail.Text = config.Email ?? "";
            txtPrinterName.Text = config.PrinterName ?? "";
            txtBarcodePrinterName.Text = config.BarcodePrinterName ?? "";
            txtCurrency.Text = config.Currency ?? "$";
            numPort.Value = config.Port > 0 ? config.Port : 8080;
            chkStartupWithWindows.Checked = StartupManager.IsStartupEnabled();
        }

        private void BtnOK_Click(object sender, EventArgs e)
        {
            UpdatedConfig = new StoreConfig
            {
                StoreName = txtStoreName.Text,
                Address = txtAddress.Text,
                Phone = txtPhone.Text,
                Email = txtEmail.Text,
                PrinterName = txtPrinterName.Text,
                BarcodePrinterName = txtBarcodePrinterName.Text,
                Currency = txtCurrency.Text,
                Port = (int)numPort.Value
            };

            // Handle Windows startup setting
            if (chkStartupWithWindows.Checked)
            {
                StartupManager.EnableStartup();
            }
            else
            {
                StartupManager.DisableStartup();
            }
        }
    }
}
