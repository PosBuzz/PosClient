using System;
using System.Drawing;
using System.Windows.Forms;

namespace Printer
{
    public class PasswordDialog : Form
    {
        private TextBox passwordTextBox;
        private Button okButton;
        private Button cancelButton;
        private Label promptLabel;

        public string EnteredPassword { get; private set; }

        public PasswordDialog(string prompt = "Enter Password:")
        {
            InitializeComponents(prompt);
        }

        private void InitializeComponents(string prompt)
        {
            this.Text = "Password Required";
            this.Width = 350;
            this.Height = 150;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.ShowInTaskbar = false;

            // Prompt label
            promptLabel = new Label
            {
                Text = prompt,
                Location = new Point(20, 20),
                AutoSize = true
            };

            // Password text box
            passwordTextBox = new TextBox
            {
                Location = new Point(20, 45),
                Width = 290,
                PasswordChar = '●',
                Font = new Font("Arial", 12F)
            };
            passwordTextBox.KeyDown += PasswordTextBox_KeyDown;

            // OK button
            okButton = new Button
            {
                Text = "OK",
                Location = new Point(150, 80),
                Width = 75,
                DialogResult = DialogResult.OK
            };
            okButton.Click += OkButton_Click;

            // Cancel button
            cancelButton = new Button
            {
                Text = "Cancel",
                Location = new Point(235, 80),
                Width = 75,
                DialogResult = DialogResult.Cancel
            };

            this.Controls.Add(promptLabel);
            this.Controls.Add(passwordTextBox);
            this.Controls.Add(okButton);
            this.Controls.Add(cancelButton);

            this.AcceptButton = okButton;
            this.CancelButton = cancelButton;
        }

        private void PasswordTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                okButton.PerformClick();
            }
        }

        private void OkButton_Click(object sender, EventArgs e)
        {
            EnteredPassword = passwordTextBox.Text;
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            passwordTextBox.Focus();
        }

        public static bool Authenticate(string correctPassword = "123456")
        {
            using (var dialog = new PasswordDialog("Enter Password:"))
            {
                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    return dialog.EnteredPassword == correctPassword;
                }
                return false;
            }
        }
    }
}
