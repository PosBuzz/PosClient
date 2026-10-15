using System;
using System.IO;
using Printer.Models;

namespace Printer.Services
{
    public class ConfigManager
    {
        private static readonly string[] LogoExtensions = { ".png", ".jpg", ".jpeg", ".bmp", ".gif" };

        /// <summary>
        /// Settings and logo live here, not next to Printer.exe, so updating the
        /// program (delete the folder, extract a new zip) keeps the shop's setup.
        /// </summary>
        public static readonly string DataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PosBuzz Print Server");

        public static readonly string ConfigPath = Path.Combine(DataDirectory, "store-config.txt");
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
                Directory.CreateDirectory(DataDirectory);

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
                                    case "ShowPoweredByPosbuzz": _config.ShowPoweredByPosbuzz = string.Equals(value, "true", StringComparison.OrdinalIgnoreCase); break;
                                    case "PoweredByText": _config.PoweredByText = value; break;
                                    case "ShowCustomerRewardPoints": _config.ShowCustomerRewardPoints = string.Equals(value, "true", StringComparison.OrdinalIgnoreCase); break;
                                }
                            }
                        }
                    }

                    if (string.IsNullOrWhiteSpace(_config.BarcodePrinterName))
                    {
                        _config.BarcodePrinterName = "Gprinter GP-3120TUC";
                    }

                    AdoptLogo();
                }
                else
                {
                    _config = CreateDefaultConfig();
                    AdoptLogo();
                    SaveConfig();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error loading config: " + ex.Message);
                _config = CreateDefaultConfig();
            }
        }

        /// <summary>
        /// A saved logo path that no longer exists (file deleted, config from
        /// another PC) falls back to the logo in the data folder, else no logo.
        /// </summary>
        private static void AdoptLogo()
        {
            if (!string.IsNullOrEmpty(_config.LogoPath) && File.Exists(_config.LogoPath))
            {
                return;
            }
            _config.LogoPath = FindLogo(DataDirectory) ?? "";
        }

        private static string FindLogo(string directory)
        {
            foreach (var extension in LogoExtensions)
            {
                string candidate = Path.Combine(directory, "logo" + extension);
                if (File.Exists(candidate)) return candidate;
            }
            return null;
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
                    "FooterTerms=" + _config.FooterTerms,
                    "ShowPoweredByPosbuzz=" + _config.ShowPoweredByPosbuzz,
                    "PoweredByText=" + _config.PoweredByText,
                    "ShowCustomerRewardPoints=" + _config.ShowCustomerRewardPoints
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
            _config.ShowPoweredByPosbuzz = fieldsToUpdate.ShowPoweredByPosbuzz;
            if (fieldsToUpdate.PoweredByText != null)
                _config.PoweredByText = fieldsToUpdate.PoweredByText;
            _config.ShowCustomerRewardPoints = fieldsToUpdate.ShowCustomerRewardPoints;
            
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
            config.StoreName = "PosBuzz Store";
            config.Address = "123 Demo Street, Motijheel C/A, Dhaka-1000";
            config.Phone = "01700-000000";
            config.Email = "demo@posbuzz.com";
            config.ContactInfo = "123 Demo Street, Motijheel C/A, Dhaka-1000\nBIN: 000123456-0202\nPhone: 01700-000000\nEmail: demo@posbuzz.com";
            config.HeaderText = "Government of the People's Republic of Bangladesh\nNational Board of Revenue, \"Tax Invoice\": Musahk-6.3\n[See clauses (c) and (f) of Rule 40]";
            config.VatRegistrationNumber = "VAT-000123456-0202";
            config.FooterTerms = "Terms & Conditions:\n1. All sales are final\n2. No returns after 7 days\n3. Warranty claims require original receipt\n4. Customer is responsible for verifying items";
            config.LogoPath = "";
            config.PrinterName = "RONGTA 80mm Series Printer";
            config.BarcodePrinterName = "Gprinter GP-3120TUC";
            config.Currency = "\u09F3";
            config.Port = 8080;
            config.ShowPoweredByPosbuzz = true;
            config.PoweredByText = "Powered by Posbuzz";
            config.ShowCustomerRewardPoints = true;
            return config;
        }
    }
}
