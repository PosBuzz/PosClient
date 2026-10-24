# PosBuzz Print Server v2.0.0

A complete Windows application for thermal receipt printing and barcode label printing via HTTP API.

## 🚀 Quick Start (5 Minutes)

1. **Extract** all files to `C:\PosBuzz-Print-Server\`
2. **Run** `Printer.exe` (green icon appears in system tray)
3. **Configure** - Right-click tray icon → Configuration
4. **Set printer names** exactly as shown in Windows
5. **Test** - Visit `http://localhost:8080/print/test-receipt`

## 📋 What's Included

- **Printer.exe** - Main application with system tray
- **Complete HTTP API** - Print receipts, barcode labels, open cash drawer
- **Configuration GUI** - Easy printer setup
- **Auto-startup** - Starts with Windows
- **API Examples** - Postman collection included

## 🖨️ Printer Setup

### Find Your Printer Names
1. **Windows Settings**: Win+I → Devices → Printers & scanners
2. **Control Panel**: Win+R → `control printers`
3. **Command Line**: `wmic printer get name`

Copy the **exact** printer names into the configuration.

### Supported Printers
- **Thermal**: 80mm receipt printers (RONGTA, Star TSP, Epson TM series)
- **Barcode**: Label printers (Gprinter GP-3120TUC, Zebra, DYMO, Brother QL)
- **Cash Drawer**: Connected via thermal printer (RJ11/RJ12)

### Barcode Label Size
Labels are laid out on the label size selected in the printer driver, so set it once:
**Printers → barcode printer → Printing Preferences → Page Setup → Stock**, pick (or create with **New...**)
a stock with the exact width and height of the labels in the printer, and click **OK**.
Text wraps and resizes to fit that label. If the print sits off to one side, adjust
**Advanced Options... → Horizontal Offset** in the same window.

## 🌐 API Usage

**Base URL**: `http://localhost:8080`

### Print Receipt
```bash
POST /print/receipt
{
  "storeName": "My Store",
  "items": [{"name": "Coffee", "quantity": 1, "price": 3.50, "total": 3.50}],
  "total": 3.50,
  "openDrawer": true
}
```

### Print Barcode Label
```bash
POST /print/barcode
{
  "productName": "Sample Product",
  "barcode": "1234567890123",
  "price": "9.99",
  "currency": "$"
}
```

### Test & Status
- **GET /** - Server status
- **GET /config** - View settings
- **POST /print/test-receipt** - Test receipt + drawer

## 🔧 System Tray Controls

**Green Icon** = Server running  
**Right-click menu**:
- **Configure** - Open settings
- **Start/Stop Server** - Control server
- **Test Receipt/Barcode** - Quick tests
- **Exit** - Close application

## ⚙️ Configuration Options

- **Store Info**: Name, address, phone, email
- **Thermal Printer**: Receipt printer name
- **Logo**: a PNG/JPG file on this PC, printed at the top of receipts fitted inside 50 × 25 mm (never stretched). Black on white prints best, and a wide (about 2:1) logo uses the space fully
- **Barcode Printer**: Label printer name
- **Port**: Server port (default: 8080)
- **Currency**: Price symbol ($, €, £)
- **Cash Drawer**: Enable/disable
- **Auto-start**: Start with Windows

## � Troubleshooting

### Printer Not Found
- ✅ Check printer name matches Windows exactly
- ✅ Ensure printer is powered on and connected
- ✅ Test print from Windows first

### Server Not Starting
- ✅ Check if port 8080 is in use
- ✅ Run as Administrator if needed
- ✅ Check Windows Firewall

### Green Icon Missing
- ✅ Check if Printer.exe is running (Task Manager)
- ✅ Check Windows notification area settings
- ✅ Try running as Administrator

### Auto-start Not Working
- ✅ Run as Administrator once
- ✅ Enable "Start with Windows" in configuration
- ✅ Check Windows Startup programs

## 🔐 Security & Requirements

- **Local Only**: Server only accessible from localhost (127.0.0.1)
- **Windows**: 7/8/10/11 (32-bit or 64-bit)
- **.NET Framework**: 4.6.1+ (usually pre-installed)
- **Memory**: 50MB RAM
- **Storage**: 15MB disk space

## 📁 Package Contents

```
PosBuzz-Print-Server/
├── Printer.exe              # Main application
├── Printer.exe.config       # App configuration
(your settings and logo are kept outside this folder, in
 %LOCALAPPDATA%\PosBuzz Print Server — see Updating)
├── Newtonsoft.Json.dll      # JSON library
├── zxing.dll                # Barcode generation
├── zxing.presentation.dll   # Barcode presentation
├── LICENSE.txt              # Software license
├── README.md                # This guide
└── Documentation/
    ├── API_REFERENCE.md     # API quick reference
    └── PosBuzz_Print_Server.postman_collection.json
```

## 🎯 Integration Examples

### JavaScript
```javascript
fetch('http://localhost:8080/print/receipt', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    storeName: "My Store",
    items: [{name: "Item", quantity: 1, price: 10.00, total: 10.00}],
    total: 10.00,
    openDrawer: true
  })
});
```

### cURL
```bash
curl -X POST http://localhost:8080/print/receipt \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Test","total":5.00}],"total":5.00}'
```

### Postman
Import `Documentation/PosBuzz_Print_Server.postman_collection.json` for ready-to-use examples.

## 💡 Features

✅ **Thermal Receipt Printing** - 80mm receipt printers  
✅ **Barcode Label Printing** - Product labels with barcodes  
✅ **Cash Drawer Control** - Automatic drawer opening  
✅ **System Tray Integration** - Background operation  
✅ **Windows Auto-startup** - Starts with Windows  
✅ **Multiple Barcode Formats** - EAN13, UPC-A, Code128, Code39  
✅ **VAT Support** - Tax information on labels  
✅ **Error Handling** - Graceful printer error recovery  
✅ **Test Endpoints** - Built-in testing capabilities  

## 🔄 Updating

Your settings (`store-config.txt`) and logo are kept in
`%LOCALAPPDATA%\PosBuzz Print Server`, outside the program folder. To update:
quit the tray app, delete the old program folder, extract the new zip, run it.
Nothing is lost.

**First time on this version:** open the tray icon → Configuration and fill in
the store details, printers and logo once. They are remembered from then on.

## 📞 Support

1. **Check printer setup** - Ensure Windows can print to your printers
2. **Verify server status** - Green tray icon should be visible
3. **Test endpoints** - Use `http://localhost:8080/config` in browser
4. **API examples** - Import Postman collection for testing

---

**Version**: 2.0.0 | **Release**: September 2025 | **Size**: ~8MB  
**Ready for production use!** ✅
