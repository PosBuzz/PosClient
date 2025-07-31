# POS Receipt Printing Setup Instructions

## Overview
Your POS system now uses a local printing agent that runs on the client computer to handle receipt printing. This agent communicates with thermal printers and can be controlled from your web application.

## Setup Steps

### 1. Start the Printing Agent

On the client computer (where the printer is connected):

1. Open Command Prompt or PowerShell as Administrator
2. Navigate to the printing agent directory:
   ```
   cd "c:\projects\posbuzz\PrintingFromWebToPOSPrinter\Printer\bin\Debug"
   ```
3. Start the HTTP server:
   ```
   Printer.exe server
   ```
4. You should see output like:
   ```
   HTTP Print Server started on port 8080
   Endpoints:
     POST http://localhost:8080/print - Print receipt
     GET  http://localhost:8080/status - Server status
     GET  http://localhost:8080/config - Get configuration
     POST http://localhost:8080/config - Update configuration
   
   Press 'q' to quit the server...
   ```

### 2. Configure Your Printer (First Time Setup)

1. In the same Command Prompt, open another window and run:
   ```
   Printer.exe setup
   ```
2. Follow the prompts to configure your printer name and settings
3. Or manually edit the `store-config.txt` file in the same directory

### 3. Test the Connection

In your POS web application:

1. Go to the Sales page
2. Click "Printer Settings" button
3. Verify the Agent URL is set to `http://localhost:8080`
4. Click "Test Connection" - you should see a success message
5. Click "Test Print" to send a test receipt to your printer

### 4. Print Receipts

1. Go to any sale in the Sales table
2. Click the printer icon next to the sale
3. The receipt should print automatically on your thermal printer

## Troubleshooting

### Agent Not Running
- **Error**: "Printing agent is not running"
- **Solution**: Make sure the `Printer.exe server` command is running on the client computer

### Printer Not Found
- **Error**: "Settings to access printer '' are not valid"
- **Solutions**: 
  1. Check if your printer is powered on and connected
  2. Go to Windows Settings > Printers & Scanners and verify the printer is listed
  3. Try printing a test page from Windows to verify the printer works
  4. Update the printer name in `store-config.txt`

### Connection Issues
- **Error**: "Failed to communicate with printing agent"
- **Solutions**:
  1. Check if the agent is running on the correct port (8080)
  2. Verify firewall isn't blocking the connection
  3. Try accessing `http://localhost:8080/status` directly in a browser

### Different Computer Setup
If the printing agent runs on a different computer than the web browser:

1. In Printer Settings, change the Agent URL to the IP address of the computer running the agent
2. Example: `http://192.168.1.100:8080`
3. Make sure the firewall allows connections on port 8080

## Features

### Automatic Features
- **Auto Cash Drawer**: Opens automatically for cash payments
- **Receipt Formatting**: Automatically formats receipts with your store information
- **Multiple Payment Methods**: Supports all payment types from your POS

### Customizable Settings
- **Paper Width**: 40 or 80 character receipts
- **Auto Cut**: Automatically cuts receipts
- **Buzzer**: Sounds when printing
- **Store Information**: Company name, address, phone in receipts

## Advanced Configuration

Edit the `store-config.txt` file to customize:
```
StoreName=Your Store Name
Address=123 Main Street, City, State 12345
Phone=(555) 123-4567
PrinterName=Your Printer Name
Currency=$
EnableCashDrawer=true
```

## Support

If you encounter issues:

1. Check the agent console output for error messages
2. Verify your printer drivers are installed correctly
3. Test printing from other applications (like Notepad) to verify printer functionality
4. Contact support with the error messages from both the web application and the agent console
