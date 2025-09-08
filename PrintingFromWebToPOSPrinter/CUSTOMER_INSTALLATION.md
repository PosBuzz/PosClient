# PosBuzz Print Server - Customer Installation Guide

## What This Application Does

PosBuzz Print Server is a background service that enables web applications to print receipts and barcode labels to local POS printers. It runs quietly in your system tray and provides an HTTP API for printing.

## Installation Instructions

### Option 1: Using the Installer (Recommended for Customers)

1. **Download** the `PosBuzzPrintServer_Setup.exe` file
2. **Run** the installer as Administrator (right-click → "Run as administrator")
3. **Follow** the installation wizard:
   - Choose installation location (default: `C:\Program Files\PosBuzz Print Server\`)
   - Select "Start with Windows" to automatically start the service on boot
   - Click "Install"
4. **Done!** The application will start automatically in your system tray

### Option 2: Manual Installation (For Developers)

1. Copy the `Printer.exe` and all related files to a folder
2. Run `Printer.exe` - it will start in system tray mode by default
3. To enable Windows startup: Right-click the tray icon → Configure → Check "Start with Windows"

## How to Use

### After Installation

1. **Look for the tray icon**: A "P" icon will appear in your system tray (bottom-right corner)
2. **The HTTP server starts automatically** on port 8080
3. **Right-click the tray icon** to access configuration and testing options

### Configuration

Right-click the tray icon and select "Configure" to set up:
- Store information (name, address, phone, email)
- Printer settings (receipt printer, barcode printer)
- Server port (default: 8080)
- Auto-startup preferences

### API Endpoints

Once running, the following endpoints are available:

- `http://localhost:8080/config` - Get/update configuration
- `http://localhost:8080/print` - Print receipts
- `http://localhost:8080/print-barcode-label` - Print barcode labels
- `http://localhost:8080/test-receipt` - Test receipt printing
- `http://localhost:8080/cash-drawer` - Open cash drawer
- `http://localhost:8080/status` - Server status

### Testing

Right-click the tray icon and select:
- "Test Receipt" - Print a sample receipt
- "Test Barcode" - Print a sample barcode label

## Running Modes

### Default Mode (System Tray)
- Runs silently in background
- HTTP server auto-starts
- Perfect for customer installations

### Console Mode (For Debugging)
- Run with `--console` parameter
- Shows detailed logging
- Useful for troubleshooting

### Command Examples
```
Printer.exe                    # Start in system tray (default)
Printer.exe --console          # Start in console mode
Printer.exe setup              # Create test printer config
Printer.exe printers           # List available printers
```

## Uninstallation

1. **Use Windows "Add or Remove Programs"**
2. **Or run the uninstaller** from the Start Menu → PosBuzz Print Server → Uninstall
3. **The application will be removed** from startup and system tray

## Troubleshooting

### Common Issues

1. **"Server failed to start"**
   - Check if port 8080 is already in use
   - Try changing the port in configuration
   - Run as Administrator if needed

2. **"Printer not found"**
   - Make sure printers are properly installed
   - Check printer names in configuration
   - Test printers from Windows directly

3. **"Application not starting"**
   - Check Windows Event Viewer for errors
   - Try running in console mode for detailed logs
   - Ensure .NET Framework 4.6.1 or higher is installed

### Getting Help

1. **Check the tray icon** for status information
2. **Run in console mode** to see detailed error messages
3. **Test individual components** using the right-click menu options

## For Developers

### Building the Installer

1. Install Inno Setup 6 from https://jrsoftware.org/isdl.php
2. Run `build_installer.bat` to create the installer
3. The installer will be created in `Installer\Output\`

### API Integration

The HTTP API accepts JSON requests for printing receipts and barcode labels. See the backend integration documentation for detailed API specifications.

## Requirements

- Windows 10 or later
- .NET Framework 4.6.1 or higher (usually pre-installed)
- Thermal receipt printer (optional)
- Barcode label printer (optional)
- Administrator rights for installation
