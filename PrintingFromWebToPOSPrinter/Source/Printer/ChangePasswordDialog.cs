using System;
using System.Drawing;
using System.Windows.Forms;
using Printer.Services;

namespace Printer
{
    public class ChangePasswordDialog : Form
    {
        private TextBox oldPasswordTextBox;
        private TextBox newPasswordTextBox;
        private TextBox confirmPasswordTextBox;
        private Button okButton;
        private Button cancelButton;
        private Label oldPasswordLabel;
        private Label newPasswordLabel;
        private Label confirmPasswordLabel;

        public ChangePasswordDialog()
        {
            InitializeComponents();
        }

        private void InitializeComponents()
        {
            this.Text = "Change Password";
            this.Width = 350;
            this.Height = 260;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.ShowInTaskbar = false;

            // Old password label
            oldPasswordLabel = new Label
            {
                Text = "Old Password:",
                Location = new Point(20, 20),
                AutoSize = true
            };

            // Old password text box
            oldPasswordTextBox = new TextBox
            {
                Location = new Point(20, 45),
                Width = 290,
                PasswordChar = '●',
                Font = new Font("Arial", 10F)
            };

            // New password label
            newPasswordLabel = new Label
            {
                Text = "New Password:",
                Location = new Point(20, 75),
                AutoSize = true
            };

            // New password text box
            newPasswordTextBox = new TextBox
            {
                Location = new Point(20, 100),
                Width = 290,
                PasswordChar = '●',
                Font = new Font("Arial", 10F)
            };

            // Confirm password label
            confirmPasswordLabel = new Label
            {
                Text = "Confirm Password:",
                Location = new Point(20, 130),
                AutoSize = true
            };

            // Confirm password text box
            confirmPasswordTextBox = new TextBox
            {
                Location = new Point(20, 155),
                Width = 290,
                PasswordChar = '●',
                Font = new Font("Arial", 10F)
            };
            confirmPasswordTextBox.KeyDown += ConfirmPasswordTextBox_KeyDown;

            // OK button
            okButton = new Button
            {
                Text = "OK",
                Location = new Point(150, 195),
                Width = 75
            };
            okButton.Click += OkButton_Click;

            // Cancel button
            cancelButton = new Button
            {
                Text = "Cancel",
                Location = new Point(235, 195),
                Width = 75,
                DialogResult = DialogResult.Cancel
            };

            this.Controls.Add(oldPasswordLabel);
            this.Controls.Add(oldPasswordTextBox);
            this.Controls.Add(newPasswordLabel);
            this.Controls.Add(newPasswordTextBox);
            this.Controls.Add(confirmPasswordLabel);
            this.Controls.Add(confirmPasswordTextBox);
            this.Controls.Add(okButton);
            this.Controls.Add(cancelButton);

            this.AcceptButton = okButton;
            this.CancelButton = cancelButton;
        }

        private void ConfirmPasswordTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                okButton.PerformClick();
            }
        }

        private void OkButton_Click(object sender, EventArgs e)
        {
            // Validate old password
            var config = ConfigManager.GetConfig();
            string currentPassword = string.IsNullOrEmpty(config.Password) ? "123456" : config.Password;

            if (oldPasswordTextBox.Text != currentPassword)
            {
                MessageBox.Show("Old password is incorrect!", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                oldPasswordTextBox.Clear();
                oldPasswordTextBox.Focus();
                return;
            }

            // Validate new password
            if (string.IsNullOrWhiteSpace(newPasswordTextBox.Text))
            {
                MessageBox.Show("New password cannot be empty!", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                newPasswordTextBox.Focus();
                return;
            }

            if (newPasswordTextBox.Text.Length < 4)
            {
                MessageBox.Show("New password must be at least 4 characters!", "Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                newPasswordTextBox.Focus();
                return;
            }

            // Validate confirmation
            if (newPasswordTextBox.Text != confirmPasswordTextBox.Text)
            {
                MessageBox.Show("Passwords do not match!", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                confirmPasswordTextBox.Clear();
                confirmPasswordTextBox.Focus();
                return;
            }

            // Save new password
            config.Password = newPasswordTextBox.Text;
            ConfigManager.UpdateConfig(config);

            MessageBox.Show("Password changed successfully!", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
            this.DialogResult = DialogResult.OK;
            this.Close();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            oldPasswordTextBox.Focus();
        }
    }
}
