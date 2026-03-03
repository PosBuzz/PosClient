using System;
using System.Drawing;
using System.Windows.Forms;
using Printer.Models;

namespace Printer
{
    public partial class ConfigurationForm : Form
    {
        public StoreConfig UpdatedConfig { get; private set; }
        private StoreConfig config; // Current config reference for logo updates

        private TextBox txtStoreName;
        private TextBox txtContactInfo;
        private TextBox txtHeaderText;
        private TextBox txtVatRegNumber;
        private TextBox txtFooterTerms;
        private TextBox txtPrinterName;
        private TextBox txtBarcodePrinterName;
        private TextBox txtCurrency;
        private NumericUpDown numPort;
        private CheckBox chkStartupWithWindows;
        private Button btnSelectLogo;
        private Button btnOK;
        private Button btnCancel;

        public ConfigurationForm(StoreConfig currentConfig)
        {
            this.config = currentConfig;
            InitializeComponent();
            LoadConfiguration(currentConfig);
        }

        private void InitializeComponent()
        {
            this.Text = "Configuration - PosBuzz Print Server";
            this.Size = new Size(650, 650);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.AutoScroll = true;

            int yPos = 20;
            
            // Store Name
            var lblStoreName = new Label { Text = "Store Name:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtStoreName = new TextBox { Location = new Point(150, yPos - 2), Size = new Size(460, 20) };
            yPos += 30;

            // Header Text (multiline)
            var lblHeaderText = new Label { Text = "Header Text:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtHeaderText = new TextBox 
            { 
                Location = new Point(150, yPos - 2), 
                Size = new Size(460, 60),
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                AcceptsReturn = true
            };
            yPos += 70;

            // Contact Info (multiline) - New unified field
            var lblContactInfo = new Label { Text = "Contact Info:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtContactInfo = new TextBox 
            { 
                Location = new Point(150, yPos - 2), 
                Size = new Size(460, 60),
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                AcceptsReturn = true
            };
            yPos += 70;

            // VAT Registration Number
            var lblVatRegNumber = new Label { Text = "VAT Reg. Number:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtVatRegNumber = new TextBox { Location = new Point(150, yPos - 2), Size = new Size(460, 20) };
            yPos += 30;

            // Printer settings
            var lblPrinterName = new Label { Text = "Receipt Printer:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtPrinterName = new TextBox { Location = new Point(150, yPos - 2), Size = new Size(460, 20) };
            yPos += 30;

            var lblBarcodePrinter = new Label { Text = "Barcode Printer:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtBarcodePrinterName = new TextBox { Location = new Point(150, yPos - 2), Size = new Size(460, 20) };
            yPos += 30;

            var lblCurrency = new Label { Text = "Currency:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtCurrency = new TextBox { Location = new Point(150, yPos - 2), Size = new Size(100, 20) };
            yPos += 30;

            var lblPort = new Label { Text = "Server Port:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            numPort = new NumericUpDown 
            { 
                Location = new Point(150, yPos - 2), 
                Size = new Size(100, 20),
                Minimum = 1000,
                Maximum = 65535,
                Value = 8080
            };
            yPos += 30;

            // Logo upload button
            var lblLogo = new Label { Text = "Logo Image:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            btnSelectLogo = new Button 
            { 
                Text = "Select Logo...", 
                Location = new Point(150, yPos - 2), 
                Size = new Size(120, 25)
            };
            btnSelectLogo.Click += BtnSelectLogo_Click;
            yPos += 35;

            // Footer Terms (multiline)
            var lblFooterTerms = new Label { Text = "Footer Terms:", Location = new Point(20, yPos), Size = new Size(120, 20) };
            txtFooterTerms = new TextBox 
            { 
                Location = new Point(150, yPos - 2), 
                Size = new Size(460, 60),
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                AcceptsReturn = true
            };
            yPos += 70;

            chkStartupWithWindows = new CheckBox 
            { 
                Text = "Start with Windows (system tray)", 
                Location = new Point(20, yPos), 
                Size = new Size(250, 20) 
            };
            yPos += 35;

            btnOK = new Button 
            { 
                Text = "OK", 
                Location = new Point(450, yPos), 
                Size = new Size(75, 30),
                DialogResult = DialogResult.OK
            };
            btnOK.Click += BtnOK_Click;

            btnCancel = new Button 
            { 
                Text = "Cancel", 
                Location = new Point(535, yPos), 
                Size = new Size(75, 30),
                DialogResult = DialogResult.Cancel
            };

            // Add controls to form
            this.Controls.AddRange(new Control[] 
            {
                lblStoreName, txtStoreName,
                lblHeaderText, txtHeaderText,
                lblContactInfo, txtContactInfo,
                lblVatRegNumber, txtVatRegNumber,
                lblPrinterName, txtPrinterName,
                lblBarcodePrinter, txtBarcodePrinterName,
                lblCurrency, txtCurrency,
                lblPort, numPort,
                lblLogo, btnSelectLogo,
                lblFooterTerms, txtFooterTerms,
                chkStartupWithWindows,
                btnOK, btnCancel
            });

            this.AcceptButton = btnOK;
            this.CancelButton = btnCancel;
        }

        private void LoadConfiguration(StoreConfig config)
        {
            txtStoreName.Text = config.StoreName ?? "";
            txtHeaderText.Text = config.HeaderText ?? "";
            txtContactInfo.Text = config.ContactInfo ?? "";
            txtVatRegNumber.Text = config.VatRegistrationNumber ?? "";
            txtPrinterName.Text = config.PrinterName ?? "";
            txtBarcodePrinterName.Text = config.BarcodePrinterName ?? "";
            txtCurrency.Text = config.Currency ?? "$";
            numPort.Value = config.Port > 0 ? config.Port : 8080;
            txtFooterTerms.Text = config.FooterTerms ?? "";
            chkStartupWithWindows.Checked = StartupManager.IsStartupEnabled();
            
            // Update logo button if logo exists
            if (!string.IsNullOrEmpty(config.LogoPath) && System.IO.File.Exists(config.LogoPath))
            {
                btnSelectLogo.Text = "Logo Selected \u2713";
            }
        }

        private void BtnOK_Click(object sender, EventArgs e)
        {
            UpdatedConfig = new StoreConfig
            {
                StoreName = txtStoreName.Text,
                HeaderText = txtHeaderText.Text,
                ContactInfo = txtContactInfo.Text,
                VatRegistrationNumber = txtVatRegNumber.Text,
                PrinterName = txtPrinterName.Text,
                BarcodePrinterName = txtBarcodePrinterName.Text,
                Currency = txtCurrency.Text,
                Port = (int)numPort.Value,
                FooterTerms = txtFooterTerms.Text,
                LogoPath = config.LogoPath // Preserve logo path from current config
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
        
        private void BtnSelectLogo_Click(object sender, EventArgs e)
        {
            using (OpenFileDialog openFileDialog = new OpenFileDialog())
            {
                openFileDialog.Title = "Select Logo Image";
                openFileDialog.Filter = "Image Files|*.png;*.jpg;*.jpeg;*.bmp;*.gif|All Files|*.*";
                openFileDialog.FilterIndex = 1;
                
                if (openFileDialog.ShowDialog() == DialogResult.OK)
                {
                    try
                    {
                        // Copy the image to the application directory
                        string fileName = System.IO.Path.GetFileName(openFileDialog.FileName);
                        string destPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logo" + System.IO.Path.GetExtension(openFileDialog.FileName));
                        
                        System.IO.File.Copy(openFileDialog.FileName, destPath, true);
                        
                        // Update the config with new logo path
                        config.LogoPath = destPath;
                        
                        MessageBox.Show("Logo image uploaded successfully!\nPath: " + destPath, "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        btnSelectLogo.Text = "Logo Selected ✓";
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("Error uploading logo: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
            }
        }
    }
}
