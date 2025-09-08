namespace Printer.Barcode
{
    public class BarcodeLabelPrintRequest
    {
        public string BarcodeValue { get; set; }
        public string ProductName { get; set; }
        public string Price { get; set; }
        public bool PrintBarcodeOnly { get; set; }
        public bool VatIncluded { get; set; }
        public decimal VatPercentage { get; set; }
        public int Quantity { get; set; } = 1;
    }
}
