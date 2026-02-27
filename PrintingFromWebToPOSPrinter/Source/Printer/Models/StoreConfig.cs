using System;

namespace Printer.Models
{
    public class StoreConfig
    {
        public string StoreName { get; set; }
        // Legacy fields kept for backwards compatibility
        public string Address { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        // New unified contact field
        public string ContactInfo { get; set; }
        public string LogoPath { get; set; }
        public string PrinterName { get; set; }
        public string BarcodePrinterName { get; set; }
        public string Currency { get; set; }
        public int Port { get; set; }
        public string Password { get; set; }
        // New fields
        public string HeaderText { get; set; }
        public string VatRegistrationNumber { get; set; }
        public string FooterTerms { get; set; }

        public StoreConfig()
        {
            StoreName = "";
            Address = "";
            Phone = "";
            Email = "";
            ContactInfo = "";
            LogoPath = "";
            PrinterName = "";
            BarcodePrinterName = "";
            Currency = "$";
            Port = 8080;
            Password = "123456"; // Default password
            HeaderText = "Government of the People's Republic of Bangladesh;\nNational Board of Revenue, \"Tax Invoice\": Musahk-6.3; [See clauses (c) and (f) of Rule 40]";
            VatRegistrationNumber = "";
            FooterTerms = "";
        }
    }
}
