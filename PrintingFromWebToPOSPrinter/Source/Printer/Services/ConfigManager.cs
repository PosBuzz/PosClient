using System;
using System.IO;
using Printer.Models;

namespace Printer.Services
{
    public class ConfigManager
    {
        private static readonly string ConfigPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "store-config.txt");
        private static StoreConfig _config;

        public static StoreConfig GetConfig()
        {
            if (_config == null)
            {
                LoadConfig();
            }
            return _config;
        }

        public static void SetConfig(StoreConfig config)
        {
            _config = config;
        }

        public static void LoadConfig()
        {
            try
            {
                if (File.Exists(ConfigPath))
                {
                    var lines = File.ReadAllLines(ConfigPath);
                    _config = new StoreConfig();
                    
                    foreach (var line in lines)
                    {
                        if (line.Contains("="))
                        {
                            var parts = line.Split('=');
                            if (parts.Length == 2)
                            {
                                var key = parts[0].Trim();
                                var value = parts[1].Trim();
                                
                                switch (key)
                                {
                                    case "StoreName": _config.StoreName = value; break;
                                    case "Address": _config.Address = value; break;
                                    case "Phone": _config.Phone = value; break;
                                    case "Email": _config.Email = value; break;
                                    case "ContactInfo": _config.ContactInfo = value; break;
                                    case "LogoPath": _config.LogoPath = value; break;
                                    case "PrinterName": _config.PrinterName = value; break;
                                    case "BarcodePrinterName": _config.BarcodePrinterName = value; break;
                                    case "Currency": _config.Currency = value; break;
                                    case "Port": _config.Port = int.Parse(value); break;
                                    case "HeaderText": _config.HeaderText = value; break;
                                    case "VatRegistrationNumber": _config.VatRegistrationNumber = value; break;
                                    case "FooterTerms": _config.FooterTerms = value; break;
                                }
                            }
                        }
                    }
                }
                else
                {
                    _config = CreateDefaultConfig();
                    SaveConfig();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error loading config: " + ex.Message);
                _config = CreateDefaultConfig();
            }
        }

        public static void SaveConfig()
        {
            try
            {
                var lines = new[]
                {
                    "StoreName=" + _config.StoreName,
                    "Address=" + _config.Address,
                    "Phone=" + _config.Phone,
                    "Email=" + _config.Email,
                    "ContactInfo=" + _config.ContactInfo,
                    "LogoPath=" + _config.LogoPath,
                    "PrinterName=" + _config.PrinterName,
                    "BarcodePrinterName=" + _config.BarcodePrinterName,
                    "Currency=" + _config.Currency,
                    "Port=" + _config.Port,
                    "HeaderText=" + _config.HeaderText,
                    "VatRegistrationNumber=" + _config.VatRegistrationNumber,
                    "FooterTerms=" + _config.FooterTerms
                };
                
                File.WriteAllLines(ConfigPath, lines);
                Console.WriteLine("Configuration saved to: " + ConfigPath);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error saving config: " + ex.Message);
            }
        }

        public static void UpdateConfig(StoreConfig newConfig)
        {
            _config = newConfig;
            SaveConfig();
            Console.WriteLine("ConfigManager: Config updated and saved");
            Console.WriteLine("ConfigManager: StoreName = " + _config.StoreName);
            Console.WriteLine("ConfigManager: PrinterName = " + _config.PrinterName);
        }

        public static void UpdateFields(StoreConfig fieldsToUpdate)
        {
            if (_config == null)
            {
                LoadConfig();
            }
            
            // Update fields regardless of empty/null status if they were provided
            if (fieldsToUpdate.StoreName != null)
                _config.StoreName = fieldsToUpdate.StoreName;
            if (fieldsToUpdate.Address != null)
                _config.Address = fieldsToUpdate.Address;
            if (fieldsToUpdate.Phone != null)
                _config.Phone = fieldsToUpdate.Phone;
            if (fieldsToUpdate.Email != null)
                _config.Email = fieldsToUpdate.Email;
            if (fieldsToUpdate.ContactInfo != null)
                _config.ContactInfo = fieldsToUpdate.ContactInfo;
            if (fieldsToUpdate.LogoPath != null)
                _config.LogoPath = fieldsToUpdate.LogoPath;
            if (fieldsToUpdate.PrinterName != null)
                _config.PrinterName = fieldsToUpdate.PrinterName;
            if (fieldsToUpdate.BarcodePrinterName != null)
                _config.BarcodePrinterName = fieldsToUpdate.BarcodePrinterName;
            if (fieldsToUpdate.Currency != null)
                _config.Currency = fieldsToUpdate.Currency;
            if (fieldsToUpdate.HeaderText != null)
                _config.HeaderText = fieldsToUpdate.HeaderText;
            if (fieldsToUpdate.VatRegistrationNumber != null)
                _config.VatRegistrationNumber = fieldsToUpdate.VatRegistrationNumber;
            if (fieldsToUpdate.FooterTerms != null)
                _config.FooterTerms = fieldsToUpdate.FooterTerms;
            
            SaveConfig();
            Console.WriteLine("ConfigManager: Individual fields updated and saved");
            Console.WriteLine("ConfigManager: StoreName = " + _config.StoreName);
            Console.WriteLine("ConfigManager: Address = " + _config.Address);
            Console.WriteLine("ConfigManager: Phone = " + _config.Phone);
            Console.WriteLine("ConfigManager: Currency = " + _config.Currency);
        }

        private static StoreConfig CreateDefaultConfig()
        {
            var config = new StoreConfig();
            config.StoreName = "Your Store Name";
            config.Address = "123 Main St, City, State 12345";
            config.Phone = "(555) 123-4567";
            config.Email = "info@yourstore.com";
            config.LogoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logo.png");
            config.PrinterName = "RONGTA 80mm Series Printer";
            config.BarcodePrinterName = "Default Barcode Printer";
            config.Currency = "$";
            config.Port = 8080;
            return config;
        }
    }
}
