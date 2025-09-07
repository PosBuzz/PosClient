namespace Printer.Barcode
{
    public class BarcodeLabelPrintRequest
    {
        public string BarcodeValue { get; set; }
        public string ProductName { get; set; }
        public string Price { get; set; }
        public bool PrintBarcodeOnly { get; set; }
    }
}
