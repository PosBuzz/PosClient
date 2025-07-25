# Thermal Printing for Sales Receipts

This document describes the thermal printing implementation for sales receipts in the POS system.

## Overview

The thermal printing system provides the ability to print professional sales receipts on thermal printers. It includes support for various printer settings, receipt formatting, and error handling.

## Features

- **Professional Receipt Layout**: Well-formatted receipts with store information, sale details, and payment information
- **Multiple Payment Methods**: Support for displaying multiple payment methods on a single receipt
- **Flexible Printer Settings**: Configurable paper width, encoding, auto-cut, and buzzer settings
- **Error Handling**: Graceful fallback to file saving when printer is not available
- **Test Printing**: Built-in test functionality to verify printer connectivity
- **Barcode Support**: Generates Code 128 barcodes for sale numbers
- **Receipt Preview**: Preview receipt content before printing

## API Endpoints

### Print Sales Receipt
```
POST /consumer/thermal-printer/print-receipt/:saleId
```
Prints a receipt for the specified sale.

**Request Body:**
```json
{
  "printerName": "string (optional)",
  "paperWidth": 40,
  "encoding": "utf8",
  "autocut": true,
  "buzzer": false
}
```

### Preview Receipt
```
GET /consumer/thermal-printer/preview-receipt/:saleId
```
Returns the formatted receipt content without printing.

### Test Print
```
POST /consumer/thermal-printer/test-print
```
Prints a test receipt to verify printer functionality.

### Reprint Receipt
```
POST /consumer/thermal-printer/print-receipt/:saleId/reprint
```
Reprints a receipt for the specified sale.

### Bulk Print
```
POST /consumer/thermal-printer/bulk-print
```
Prints multiple receipts in batch.

**Request Body:**
```json
{
  "saleIds": [1, 2, 3],
  "printerSettings": {
    "paperWidth": 40,
    "autocut": true
  }
}
```

### Printer Settings
```
GET /consumer/thermal-printer/settings
POST /consumer/thermal-printer/settings
```
Get and update default printer settings.

## Receipt Format

The thermal printer generates receipts with the following sections:

### Header
- Store/Business name (centered)
- Branch name (if applicable)
- Branch address and phone (if available)

### Sale Information
- Sale number
- Date and time
- Cashier name
- Customer information (if provided)

### Items
- Item name and details
- Quantity, unit price, and line total
- Individual item discounts (if applicable)

### Totals
- Subtotal
- Discounts (if applicable)
- Tax (if applicable)
- Shipping cost (if applicable)
- **Total Amount** (emphasized)

### Payment Details
- Payment methods and amounts
- Reference numbers (if provided)
- Change amount (if applicable)

### Footer
- Payment status
- Thank you message
- Barcode with sale number
- Notes (if provided)

## Configuration

### Default Settings
```typescript
{
  paperWidth: 40,      // Characters per line (40 or 80 typical)
  encoding: 'utf8',    // Character encoding
  autocut: true,       // Automatically cut paper after printing
  buzzer: false        // Sound buzzer after printing
}
```

### Supported Paper Widths
- **40 characters**: Standard for 58mm thermal paper
- **80 characters**: Standard for 80mm thermal paper

## ESC/POS Commands Used

The service uses standard ESC/POS commands for thermal printer control:

- `\x1B\x40`: Initialize printer
- `\x1B\x61\x01`: Center alignment
- `\x1B\x61\x00`: Left alignment
- `\x1B\x45\x01`: Bold text on
- `\x1B\x45\x00`: Bold text off
- `\x1D\x56\x00`: Full paper cut
- `\x1B\x70\x00\x19\x0A`: Buzzer
- `\x1D\x6B\x49`: Code 128 barcode

## Installation

### Dependencies
```bash
npm install escpos
```

### Printer Setup

#### USB Thermal Printer
1. Connect the thermal printer via USB
2. Install printer drivers if required
3. The service will automatically detect USB printers

#### Network Thermal Printer
```typescript
// For network printers, modify the service to use:
new escpos.Network('192.168.1.100', 9100)
```

#### Serial Thermal Printer
```typescript
// For serial printers, modify the service to use:
new escpos.Serial('/dev/ttyUSB0', {
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
})
```

## Error Handling

The service includes comprehensive error handling:

1. **Printer Not Found**: Falls back to saving receipt as text file
2. **Invalid Sale ID**: Returns appropriate error message
3. **Permission Errors**: Handled through existing authorization system
4. **Printer Communication Errors**: Graceful degradation with error logging

## File Fallback

When a printer is not available, receipts are automatically saved to:
```
/receipts/receipt-[timestamp].txt
```

This ensures no receipt data is lost even when printing fails.

## Usage Examples

### Basic Print
```typescript
const result = await thermalPrinterService.printSalesReceipt(
  saleId, 
  consumerId
);
```

### Custom Settings
```typescript
const result = await thermalPrinterService.printSalesReceipt(
  saleId, 
  consumerId, 
  {
    paperWidth: 80,
    autocut: false,
    buzzer: true
  }
);
```

### Test Print
```typescript
const result = await thermalPrinterService.testPrint({
  paperWidth: 40
});
```

## Troubleshooting

### Common Issues

1. **Printer Not Found**
   - Check USB connection
   - Verify printer drivers are installed
   - Check printer power and paper

2. **Garbled Text**
   - Try different encoding settings ('utf8', 'ascii', 'cp1252')
   - Check printer language settings

3. **Paper Not Cutting**
   - Ensure autocut is enabled
   - Check if printer supports auto-cut
   - Verify paper type and size

4. **Receipt Too Wide**
   - Adjust paperWidth setting (40 for 58mm, 80 for 80mm)
   - Check printer specifications

### Logging

The service provides detailed logging for troubleshooting:
- Successful prints are logged
- Failed prints include error details
- Cache operations are logged
- File fallback operations are logged

## Performance Considerations

- Receipt data is cached for 5 minutes to improve repeated access
- Bulk printing processes sequentially to avoid printer buffer overflow
- Large text content is automatically truncated to fit paper width
- Database queries are optimized with proper includes and selects

## Security

- All print operations require proper authentication
- Consumer isolation ensures users can only print their own sales
- Permission-based access control via existing guards
- No sensitive data is stored in print queues

## Future Enhancements

Potential improvements for the thermal printing system:

1. **Print Queue Management**: Queue multiple print jobs
2. **Template Customization**: Allow custom receipt templates
3. **Multi-language Support**: Support for different languages
4. **Logo Printing**: Add business logo to receipts
5. **Printer Status Monitoring**: Real-time printer status
6. **Cloud Printing**: Support for cloud-connected printers
7. **Mobile Printing**: Integration with mobile thermal printers

## Technical Notes

- The service uses the `escpos` library for printer communication
- ESC/POS commands are used for printer control
- Supports Windows, Linux, and macOS platforms
- Compatible with most ESC/POS thermal printers
- Fallback mechanisms ensure reliability
