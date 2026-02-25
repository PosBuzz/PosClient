namespace Printer
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
        public string ShopName { get; set; }
        public string BranchName { get; set; }
        public string Location { get; set; }
    }
}
