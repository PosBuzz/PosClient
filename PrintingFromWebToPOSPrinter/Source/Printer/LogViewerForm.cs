using System;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace Printer
{
    public class LogViewerForm : Form
    {
        private TextBox logTextBox;
        private Button closeButton;
        private Button clearButton;
        private Button refreshButton;
        private Label statusLabel;
        private StringBuilder logBuffer;
        private Timer autoRefreshTimer;
        private const int MAX_LOG_LINES = 500; // Keep last 500 lines

        public LogViewerForm()
        {
            logBuffer = new StringBuilder();
            InitializeComponents();
            LoadLogs();
            
            // Setup auto-refresh timer
            autoRefreshTimer = new Timer();
            autoRefreshTimer.Interval = 1000; // Refresh every 1 second
            autoRefreshTimer.Tick += (s, e) => RefreshLogs();
            autoRefreshTimer.Start();
        }

        private void InitializeComponents()
        {
            // Form settings
            this.Text = "PosBuzz Print Server - Logs";
            this.Width = 900;
            this.Height = 600;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.MinimizeBox = true;
            this.MaximizeBox = true;
            this.ShowInTaskbar = true;
            this.KeyPreview = true;
            this.KeyDown += LogViewerForm_KeyDown;

            // Main panel
            Panel mainPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(10)
            };

            // Log text box
            logTextBox = new TextBox
            {
                Dock = DockStyle.Fill,
                Multiline = true,
                ScrollBars = ScrollBars.Both,
                ReadOnly = true,
                Font = new Font("Consolas", 9F),
                BackColor = Color.FromArgb(30, 30, 30),
                ForeColor = Color.FromArgb(220, 220, 220),
                BorderStyle = BorderStyle.FixedSingle
            };

            // Bottom panel for buttons
            Panel bottomPanel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 50,
                Padding = new Padding(0, 10, 0, 0)
            };

            // Status label
            statusLabel = new Label
            {
                Dock = DockStyle.Left,
                AutoSize = false,
                Width = 400,
                TextAlign = ContentAlignment.MiddleLeft,
                Text = "Auto-refreshing every 1 second"
            };

            // Close button
            closeButton = new Button
            {
                Text = "Close (ESC)",
                Width = 100,
                Height = 30,
                Dock = DockStyle.Right
            };
            closeButton.Click += (s, e) => this.Close();

            // Clear button
            clearButton = new Button
            {
                Text = "Clear Logs",
                Width = 100,
                Height = 30,
                Dock = DockStyle.Right,
                Margin = new Padding(0, 0, 10, 0)
            };
            clearButton.Click += (s, e) => ClearLogs();

            // Refresh button
            refreshButton = new Button
            {
                Text = "Refresh",
                Width = 100,
                Height = 30,
                Dock = DockStyle.Right,
                Margin = new Padding(0, 0, 10, 0)
            };
            refreshButton.Click += (s, e) => RefreshLogs();

            // Add controls
            bottomPanel.Controls.Add(closeButton);
            bottomPanel.Controls.Add(clearButton);
            bottomPanel.Controls.Add(refreshButton);
            bottomPanel.Controls.Add(statusLabel);

            mainPanel.Controls.Add(logTextBox);
            mainPanel.Controls.Add(bottomPanel);

            this.Controls.Add(mainPanel);

            // Handle form closing
            this.FormClosing += LogViewerForm_FormClosing;
        }

        private void LogViewerForm_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape)
            {
                this.Close();
            }
        }

        private void LogViewerForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (autoRefreshTimer != null)
            {
                autoRefreshTimer.Stop();
                autoRefreshTimer.Dispose();
            }
        }

        private string _lastLogContent = null;
        
        private void LoadLogs()
        {
            try
            {
                // Get logs from the HttpPrintServer static log
                string logs = HttpPrintServer.GetLogs();
                
                // Only update if content changed (avoid flicker and scroll reset)
                if (logs == _lastLogContent) return;
                _lastLogContent = logs;
                
                if (!string.IsNullOrEmpty(logs))
                {
                    // Check if user is scrolled to the bottom
                    bool isAtBottom = logTextBox.SelectionStart >= logTextBox.Text.Length - 5;
                    
                    logTextBox.Text = logs;
                    
                    // Only auto-scroll to bottom if user was already at bottom
                    if (isAtBottom || logTextBox.Text.Length == logs.Length)
                    {
                        logTextBox.SelectionStart = logTextBox.Text.Length;
                        logTextBox.ScrollToCaret();
                    }
                    
                    // Update status
                    int lineCount = logTextBox.Lines.Length;
                    statusLabel.Text = string.Format("Showing {0} lines - auto-refreshing", lineCount);
                }
                else
                {
                    logTextBox.Text = "No logs yet. Server activity will appear here automatically.";
                    statusLabel.Text = "Waiting for server activity...";
                }
            }
            catch (Exception ex)
            {
                logTextBox.Text = "Error loading logs: " + ex.Message;
                statusLabel.Text = "Error loading logs";
            }
        }

        private void RefreshLogs()
        {
            LoadLogs();
        }

        private void ClearLogs()
        {
            if (MessageBox.Show("Are you sure you want to clear all logs?", "Clear Logs", 
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
            {
                HttpPrintServer.ClearLogs();
                _lastLogContent = null; // Force refresh
                logTextBox.Text = "Logs cleared. New activity will appear here automatically.";
                statusLabel.Text = "Logs cleared - auto-refreshing";
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            // Bring to front
            this.BringToFront();
            this.Activate();
        }
    }
}
