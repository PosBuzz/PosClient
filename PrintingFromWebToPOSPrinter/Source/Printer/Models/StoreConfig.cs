using System;

namespace Printer.Models
{
    public class StoreConfig
    {
        public string StoreName { get; set; }
        public string Address { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string LogoPath { get; set; }
        public string PrinterName { get; set; }
        public string BarcodePrinterName { get; set; }
        public string Currency { get; set; }
        public int Port { get; set; }
        public string Password { get; set; }

        public StoreConfig()
        {
            StoreName = "";
            Address = "";
            Phone = "";
            Email = "";
            LogoPath = "";
            PrinterName = "";
            BarcodePrinterName = "";
            Currency = "$";
            Port = 8080;
            Password = "123456"; // Default password
        }
    }
}
