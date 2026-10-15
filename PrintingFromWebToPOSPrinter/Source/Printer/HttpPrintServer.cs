using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using Printer.Models;
using Printer.Services;
using Newtonsoft.Json;

namespace Printer
{
    public class HttpPrintServer
    {
        private HttpListener listener;
        private bool isRunning;
        private Thread listenerThread;
        
        // Static log storage
        private static readonly object logLock = new object();
        private static StringBuilder logBuffer = new StringBuilder();
        private static readonly int MAX_LOG_SIZE = 100000; // ~100KB of log data

        public HttpPrintServer()
        {
        }
        
        // Public methods to access logs
        public static string GetLogs()
        {
            lock (logLock)
            {
                return logBuffer.ToString();
            }
        }
        
        public static void ClearLogs()
        {
            lock (logLock)
            {
                logBuffer.Clear();
                LogMessage("=== LOGS CLEARED ===");
            }
        }
        
        private static void LogMessage(string message)
        {
            lock (logLock)
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                string logEntry = $"[{timestamp}] {message}\r\n";
                
                // Write to console
                Console.Write(logEntry);
                
                // Append to buffer
                logBuffer.Append(logEntry);
                
                // Trim if too large (keep last ~100KB)
                if (logBuffer.Length > MAX_LOG_SIZE)
                {
                    string currentLogs = logBuffer.ToString();
                    int keepFromIndex = currentLogs.Length - (MAX_LOG_SIZE / 2);
                    logBuffer.Clear();
                    logBuffer.Append(currentLogs.Substring(keepFromIndex));
                }
            }
        }

        public void Start(int port = 8080)
        {
            if (isRunning) return;

            listener = new HttpListener();
            listener.Prefixes.Add(string.Format("http://localhost:{0}/", port));
            listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", port));
            
            try
            {
                listener.Start();
                isRunning = true;
                
                LogMessage(string.Format("HTTP Print Server started on port {0}", port));
                LogMessage("Endpoints:");
                LogMessage(string.Format("  POST http://localhost:{0}/print - Print receipt", port));
                LogMessage(string.Format("  GET  http://localhost:{0}/status - Server status", port));
                LogMessage(string.Format("  GET  http://localhost:{0}/config - Get configuration", port));
                LogMessage(string.Format("  POST http://localhost:{0}/config - Update configuration", port));
                LogMessage(string.Format("  GET  http://localhost:{0}/cash-drawer - Open cash drawer", port));
                LogMessage(string.Format("  POST http://localhost:{0}/print-barcode-label - Print barcode label", port));
                LogMessage(string.Format("  GET  http://localhost:{0}/test-barcode-label - Test barcode print", port));
                LogMessage(string.Format("  GET  http://localhost:{0}/test-receipt - Test receipt print", port));
                LogMessage("");
                LogMessage("Server is ready. Use right-click tray icon → View Logs to see activity.");

                listenerThread = new Thread(HandleRequests);
                listenerThread.Start();
            }
            catch (Exception ex)
            {
                LogMessage("Failed to start HTTP server: " + ex.Message);
                LogMessage("Make sure you run as Administrator or the port is not in use.");
            }
        }

        public void Stop()
        {
            if (!isRunning) return;

            isRunning = false;
            listener.Stop();
            listenerThread.Join(5000);
            LogMessage("HTTP Print Server stopped.");
        }

        private void HandleRequests()
        {
            while (isRunning)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem(ProcessRequest, context);
                }
                catch (Exception ex)
                {
                    if (isRunning)
                    {
                        LogMessage("Error handling request: " + ex.Message);
                    }
                }
            }
        }

        private void ProcessRequest(object state)
        {
            HttpListenerContext context = (HttpListenerContext)state;
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            try
            {
                LogMessage(string.Format("--> {0} {1}", request.HttpMethod, request.Url.AbsolutePath));
                
                string responseText = "";
                int statusCode = 200;

                // Add CORS headers
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

                if (request.HttpMethod == "OPTIONS")
                {
                    // Handle preflight CORS request
                    statusCode = 200;
                    responseText = "";
                }
                else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/print")
                {
                    responseText = HandlePrintRequest(request);
                }
                else if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/status")
                {
                    responseText = HandleStatusRequest();
                }
                else if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/config")
                {
                    responseText = HandleGetConfig();
                }
                else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/config")
                {
                    responseText = HandleUpdateConfig(request);
                }
                else if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/cash-drawer")
                {
                    responseText = HandleCashDrawerRequest();
                }
                else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/print-barcode-label")
                {
                    responseText = HandlePrintBarcodeLabel(request);
                }
                else if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/test-barcode-label")
                {
                    responseText = HandleTestBarcodeLabel();
                }
                else if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/test-receipt")
                {
                    responseText = HandleTestReceipt();
                }
                else
                {
                    statusCode = 404;
                    responseText = "{\"error\":\"Endpoint not found\"}";
                }

                response.StatusCode = statusCode;
                response.ContentType = "application/json";
                byte[] buffer = Encoding.UTF8.GetBytes(responseText);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
                response.OutputStream.Close();

                LogMessage(string.Format("<-- {0} {1} ({2} bytes)", statusCode, request.Url.AbsolutePath, buffer.Length));
            }
            catch (Exception ex)
            {
                LogMessage("ERROR processing request: " + ex.Message);
                Console.WriteLine("Error processing request: " + ex.Message);
                try
                {
                    response.StatusCode = 500;
                    byte[] errorBuffer = Encoding.UTF8.GetBytes("{\"error\":\"Internal server error\"}");
                    response.OutputStream.Write(errorBuffer, 0, errorBuffer.Length);
                    response.OutputStream.Close();
                }
                catch { }
            }
        }

        private string HandlePrintRequest(HttpListenerRequest request)
        {
            try
            {
                LogMessage("Processing print request...");
                Console.WriteLine("=== PRINT REQUEST DETAILS ===");
                
                string body = "";
                using (Stream receiveStream = request.InputStream)
                using (StreamReader readStream = new StreamReader(receiveStream, Encoding.UTF8))
                {
                    body = readStream.ReadToEnd();
                }

                Console.WriteLine("Request Body Length: " + body.Length + " characters");
                Console.WriteLine("Request Body (first 500 chars): " + body.Substring(0, Math.Min(500, body.Length)) + "...");

                if (string.IsNullOrEmpty(body))
                {
                    Console.WriteLine("ERROR: Request body is empty");
                    return "{\"error\":\"Request body is empty\"}";
                }

                Console.WriteLine("=== PARSING JSON ===");
                // Parse the JSON manually (simple parsing for our needs)
                ReceiptData receiptData = ParseReceiptJson(body);
                
                if (receiptData == null)
                {
                    Console.WriteLine("ERROR: Failed to parse JSON - Invalid format");
                    return "{\"error\":\"Invalid JSON format\"}";
                }

                Console.WriteLine("=== PARSED RECEIPT DATA ===");
                Console.WriteLine("Store Name: " + (receiptData.Branch != null ? receiptData.Branch.Name : ""));
                Console.WriteLine("Sale Number: " + receiptData.SaleNumber);
                Console.WriteLine("Branch: " + (receiptData.Branch != null ? receiptData.Branch.Name : ""));
                Console.WriteLine("User: " + (receiptData.Cashier != null ? receiptData.Cashier.Name : ""));
                Console.WriteLine("Items Count: " + (receiptData.Items != null ? receiptData.Items.Count : 0));
                Console.WriteLine("=== FINANCIAL DETAILS ===");
                Console.WriteLine("Subtotal: $" + receiptData.Subtotal);
                Console.WriteLine("Discount: $" + receiptData.Discount);
                Console.WriteLine("DiscountAmount: $" + receiptData.DiscountAmount);
                Console.WriteLine("ShippingCost: $" + receiptData.ShippingCost);
                Console.WriteLine("Tax: $" + receiptData.Tax);
                Console.WriteLine("TaxAmount: $" + receiptData.TaxAmount);
                Console.WriteLine("Total: $" + receiptData.Total);
                Console.WriteLine("TotalAmount: $" + receiptData.TotalAmount);
                Console.WriteLine("Date: " + (receiptData.OrderDate != null ? receiptData.OrderDate.ToString() : ""));
                Console.WriteLine("===============================");

                Console.WriteLine("=== PRINTING RECEIPT ===");
                // Print the receipt
                SimpleReceiptPrint printer = new SimpleReceiptPrint();
                bool success = printer.Print("", receiptData);
                
                Console.WriteLine("Print Result: " + (success ? "SUCCESS" : "FAILED"));
                LogMessage("Print result: " + (success ? "SUCCESS" : "FAILED"));
                Console.WriteLine("===========================");

                if (success)
                {
                    return "{\"success\":true,\"message\":\"Receipt printed successfully\"}";
                }
                else
                {
                    return "{\"error\":\"Failed to print receipt\"}";
                }
            }
            catch (Exception ex)
            {
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandleStatusRequest()
        {
            StoreConfig config = ConfigManager.GetConfig();
            return string.Format("{{\"status\":\"running\",\"storeName\":\"{0}\",\"version\":\"1.0\"}}", 
                config.StoreName.Replace("\"", "\\\""));
        }

        private string HandleGetConfig()
        {
            try
            {
                StoreConfig config = ConfigManager.GetConfig();
                return string.Format("{{\"storeName\":\"{0}\",\"address\":\"{1}\",\"phone\":\"{2}\",\"email\":\"{3}\",\"contactInfo\":\"{4}\",\"logoPath\":\"{5}\",\"printerName\":\"{6}\",\"barcodePrinterName\":\"{7}\",\"currency\":\"{8}\",\"port\":{9},\"headerText\":\"{10}\",\"vatRegistrationNumber\":\"{11}\",\"footerTerms\":\"{12}\",\"showPoweredByPosbuzz\":{13},\"poweredByText\":\"{14}\",\"showCustomerRewardPoints\":{15}}}",
                    EscapeJson(config.StoreName),
                    EscapeJson(config.Address),
                    EscapeJson(config.Phone),
                    EscapeJson(config.Email),
                    EscapeJson(config.ContactInfo),
                    EscapeJson(config.LogoPath),
                    EscapeJson(config.PrinterName),
                    EscapeJson(config.BarcodePrinterName),
                    EscapeJson(config.Currency),
                    config.Port,
                    EscapeJson(config.HeaderText),
                    EscapeJson(config.VatRegistrationNumber),
                    EscapeJson(config.FooterTerms),
                    config.ShowPoweredByPosbuzz.ToString().ToLower(),
                    EscapeJson(config.PoweredByText),
                    config.ShowCustomerRewardPoints.ToString().ToLower());
            }
            catch (Exception ex)
            {
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }
        
        private string EscapeJson(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
        }

        private string HandleUpdateConfig(HttpListenerRequest request)
        {
            try
            {
                string body = "";
                using (Stream receiveStream = request.InputStream)
                using (StreamReader readStream = new StreamReader(receiveStream, Encoding.UTF8))
                {
                    body = readStream.ReadToEnd();
                }

                Console.WriteLine("Received config update: " + body);

                // Seed with current booleans because partial updates do not indicate field presence.
                StoreConfig currentConfig = ConfigManager.GetConfig();
                StoreConfig updatedFields = new StoreConfig
                {
                    ShowPoweredByPosbuzz = currentConfig.ShowPoweredByPosbuzz,
                    ShowCustomerRewardPoints = currentConfig.ShowCustomerRewardPoints
                };
                
                string storeName = GetFirstNonNull(
                    ExtractJsonString(body, "storeName"),
                    ExtractJsonString(body, "StoreName"));
                if (storeName != null) {
                    updatedFields.StoreName = storeName;
                    Console.WriteLine("HTTP: Setting StoreName = " + storeName);
                }
                
                string address = GetFirstNonNull(
                    ExtractJsonString(body, "address"),
                    ExtractJsonString(body, "Address"));
                if (address != null) {
                    updatedFields.Address = address;
                    Console.WriteLine("HTTP: Setting Address = " + address);
                }
                
                string phone = GetFirstNonNull(
                    ExtractJsonString(body, "phone"),
                    ExtractJsonString(body, "Phone"));
                if (phone != null) {
                    updatedFields.Phone = phone;
                    Console.WriteLine("HTTP: Setting Phone = " + phone);
                }
                
                string email = GetFirstNonNull(
                    ExtractJsonString(body, "email"),
                    ExtractJsonString(body, "Email"));
                if (email != null) {
                    updatedFields.Email = email;
                    Console.WriteLine("HTTP: Setting Email = " + email);
                }
                
                string logoPath = GetFirstNonNull(
                    ExtractJsonString(body, "logoPath"),
                    ExtractJsonString(body, "LogoPath"));
                if (logoPath != null) {
                    updatedFields.LogoPath = logoPath;
                    Console.WriteLine("HTTP: Setting LogoPath = " + logoPath);
                }
                
                string printerName = GetFirstNonNull(
                    ExtractJsonString(body, "printerName"),
                    ExtractJsonString(body, "PrinterName"));
                if (printerName != null) {
                    updatedFields.PrinterName = printerName;
                    Console.WriteLine("HTTP: Setting PrinterName = " + printerName);
                }
                
                string barcodePrinterName = GetFirstNonNull(
                    ExtractJsonString(body, "barcodePrinterName"),
                    ExtractJsonString(body, "BarcodePrinterName"));
                if (barcodePrinterName != null) {
                    updatedFields.BarcodePrinterName = barcodePrinterName;
                    Console.WriteLine("HTTP: Setting BarcodePrinterName = " + barcodePrinterName);
                }
                
                string currency = GetFirstNonNull(
                    ExtractJsonString(body, "currency"),
                    ExtractJsonString(body, "Currency"));
                if (currency != null) {
                    updatedFields.Currency = currency;
                    Console.WriteLine("HTTP: Setting Currency = " + currency);
                }
                
                // Handle new fields
                string contactInfo = GetFirstNonNull(
                    ExtractJsonString(body, "contactInfo"),
                    ExtractJsonString(body, "ContactInfo"));
                if (contactInfo != null) {
                    updatedFields.ContactInfo = contactInfo;
                    Console.WriteLine("HTTP: Setting ContactInfo = " + contactInfo);
                }
                
                string headerText = GetFirstNonNull(
                    ExtractJsonString(body, "headerText"),
                    ExtractJsonString(body, "HeaderText"));
                if (headerText != null) {
                    updatedFields.HeaderText = headerText;
                    Console.WriteLine("HTTP: Setting HeaderText = " + headerText);
                }
                
                string vatRegNumber = GetFirstNonNull(
                    ExtractJsonString(body, "vatRegistrationNumber"),
                    ExtractJsonString(body, "VatRegistrationNumber"));
                if (vatRegNumber != null) {
                    updatedFields.VatRegistrationNumber = vatRegNumber;
                    Console.WriteLine("HTTP: Setting VatRegistrationNumber = " + vatRegNumber);
                }
                
                string footerTerms = GetFirstNonNull(
                    ExtractJsonString(body, "footerTerms"),
                    ExtractJsonString(body, "FooterTerms"));
                if (footerTerms != null) {
                    updatedFields.FooterTerms = footerTerms;
                    Console.WriteLine("HTTP: Setting FooterTerms = " + footerTerms);
                }

                string poweredByText = GetFirstNonNull(
                    ExtractJsonString(body, "poweredByText"),
                    ExtractJsonString(body, "PoweredByText"));
                if (poweredByText != null) {
                    updatedFields.PoweredByText = poweredByText;
                    Console.WriteLine("HTTP: Setting PoweredByText = " + poweredByText);
                }
                
                // Handle integer fields  
                string portStr = GetFirstNonNull(
                    ExtractJsonValue(body, "port"),
                    ExtractJsonValue(body, "Port"));
                if (portStr != null) {
                    int port;
                    if (int.TryParse(portStr, out port)) {
                        updatedFields.Port = port;
                        Console.WriteLine("HTTP: Setting Port = " + port);
                    }
                }

                string showPoweredByStr = GetFirstNonNull(
                    ExtractJsonValue(body, "showPoweredByPosbuzz"),
                    ExtractJsonValue(body, "ShowPoweredByPosbuzz"));
                if (showPoweredByStr != null) {
                    bool showPoweredBy;
                    if (bool.TryParse(showPoweredByStr, out showPoweredBy)) {
                        updatedFields.ShowPoweredByPosbuzz = showPoweredBy;
                        Console.WriteLine("HTTP: Setting ShowPoweredByPosbuzz = " + showPoweredBy);
                    }
                }

                string showCustomerRewardPointsStr = GetFirstNonNull(
                    ExtractJsonValue(body, "showCustomerRewardPoints"),
                    ExtractJsonValue(body, "ShowCustomerRewardPoints"));
                if (showCustomerRewardPointsStr != null) {
                    bool showCustomerRewardPoints;
                    if (bool.TryParse(showCustomerRewardPointsStr, out showCustomerRewardPoints)) {
                        updatedFields.ShowCustomerRewardPoints = showCustomerRewardPoints;
                        Console.WriteLine("HTTP: Setting ShowCustomerRewardPoints = " + showCustomerRewardPoints);
                    }
                }
                
                // Update only the provided fields
                ConfigManager.UpdateFields(updatedFields);
                
                Console.WriteLine("HTTP Server: Config update completed");
                
                return "{\"success\":true,\"message\":\"Configuration updated successfully\"}";
            }
            catch (Exception ex)
            {
                Console.WriteLine("Config update error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandleCashDrawerRequest()
        {
            try
            {
                Console.WriteLine("=== CASH DRAWER REQUEST ===");
                Console.WriteLine("Opening cash drawer directly...");
                
                // Get the configured printer name
                StoreConfig config = ConfigManager.GetConfig();
                string printerName = config.PrinterName;
                
                if (string.IsNullOrEmpty(printerName))
                {
                    Console.WriteLine("ERROR: No printer configured for cash drawer");
                    return "{\"error\":\"No printer configured. Please set printer name in configuration.\"}";
                }
                
                Console.WriteLine("Using printer: " + printerName);
                
                // Create a simple printer instance and open cash drawer
                SimpleReceiptPrint printer = new SimpleReceiptPrint();
                bool success = printer.OpenCashDrawer(printerName);
                
                if (success)
                {
                    Console.WriteLine("✓ Cash drawer opened successfully!");
                    return "{\"success\":true,\"message\":\"Cash drawer opened successfully\"}";
                }
                else
                {
                    Console.WriteLine("✗ Failed to open cash drawer");
                    return "{\"error\":\"Failed to open cash drawer. Check printer connection and configuration.\"}";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Cash drawer error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandlePrintBarcodeLabel(HttpListenerRequest request)
        {
            try
            {
                LogMessage("Barcode label print request received");
                string body = "";
                using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                {
                    body = reader.ReadToEnd();
                }
                var printRequest = JsonConvert.DeserializeObject<BarcodeLabelPrintRequest>(body);
                if (printRequest == null)
                {
                    LogMessage("ERROR: Failed to parse barcode print request");
                    return "{\"error\":\"Invalid request format\"}";
                }
                LogMessage(string.Format("Printing barcode: {0} | product: {1} | qty: {2}", printRequest.BarcodeValue, printRequest.ProductName, printRequest.Quantity));
                BarcodeLabelPrint.PrintLabel(printRequest.BarcodeValue, printRequest.ProductName, printRequest.Price, printRequest.PrintBarcodeOnly, printRequest.VatIncluded, printRequest.VatPercentage, printRequest.Quantity, printRequest.ShopName, printRequest.BranchName, printRequest.Location);
                LogMessage("Barcode label printed successfully");
                return "{\"success\":true,\"message\":\"Barcode label printed successfully\"}";
            }
            catch (Exception ex)
            {
                LogMessage("Barcode print error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandleTestBarcodeLabel()
        {
            try
            {
                LogMessage("Test barcode label print requested");
                BarcodeLabelPrint.PrintLabel("123456789012", "Test Product", "9.99", false, true, 21.0m);
                LogMessage("Test barcode label printed successfully");
                return "{\"success\":true,\"message\":\"Test barcode label printed successfully\"}";
            }
            catch (Exception ex)
            {
                LogMessage("Test barcode print error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandleTestReceipt()
        {
            try
            {
                Console.WriteLine("=== TEST RECEIPT PRINT ===");
                Console.WriteLine("Printing comprehensive test receipt with all properties...");
                
                // Use real config from settings for all store display (header, footer, contact, etc.)
                StoreConfig config = ConfigManager.GetConfig();

                // Create a comprehensive test receipt with all properties
                ReceiptData testReceipt = new ReceiptData
                {
                    SaleNumber = "TEST-001",
                    OrderId = "TEST-001",
                    BarcodeValue = "TEST-001",
                    Subtotal = 180.00m,        // Items subtotal before discount/shipping
                    Discount = 20.00m,         // Discount amount
                    DiscountAmount = 20.00m,   // Alternative discount field
                    ShippingCost = 15.00m,     // Shipping cost
                    Tax = 25.00m,              // Tax amount
                    TaxAmount = 25.00m,        // Alternative tax field
                    Total = 200.00m,           // Final total (180 - 20 + 15 + 25 = 200)
                    TotalAmount = 200.00m,     // Alternative total field
                    ReceivedAmount = 250.00m,  // Amount paid
                    ChangeAmount = 50.00m,     // Change given
                    OpenCashDrawer = false,    // Disable cash drawer for now
                    OrderDate = DateTime.Now,
                    PaymentStatus = "paid",
                    Notes = "Test receipt with all properties - Comprehensive test print"
                };
                
                // Add store info
                testReceipt.Branch = new BranchInfo
                {
                    Name = !string.IsNullOrEmpty(config.StoreName) ? config.StoreName : "Test Branch Location",
                    Address = !string.IsNullOrEmpty(config.Address) ? config.Address : "123 Main Street, Business District, Test City 12345",
                    Phone = !string.IsNullOrEmpty(config.Phone) ? config.Phone : "(555) 123-4567"
                };
                
                // Add cashier info
                testReceipt.Cashier = new UserInfo
                {
                    Name = "John Test Cashier",
                    Id = "CASHIER-001"
                };

                // Add served by info
                testReceipt.ServedBy = new UserInfo
                {
                    Name = "Alice Test Server",
                    Id = "SERVER-001"
                };
                
                // Add customer info
                testReceipt.Customer = new CustomerInfo
                {
                    Name = "Jane Test Customer",
                    Phone = "(555) 987-6543",
                    Address = "456 Customer Ave, Test Town",
                    RewardPoints = 127,
                    PointsEarned = 15,
                    PointsRedeemed = 3
                };
                
                // Add payment info with multiple payment methods
                testReceipt.Payment = new PaymentInfo
                {
                    Method = "Cash, Card",
                    PaymentMethod = "Cash, Card",
                    Amount = 250.00m,
                    AmountPaid = 250.00m,
                    Change = 50.00m
                };
                
                // Add multiple payments
                testReceipt.Payments.Add(new PaymentInfo
                {
                    Method = "Cash",
                    PaymentMethod = "Cash", 
                    Amount = 150.00m,
                    AmountPaid = 150.00m
                });
                
                testReceipt.Payments.Add(new PaymentInfo
                {
                    Method = "Card",
                    PaymentMethod = "Card",
                    Amount = 100.00m,
                    AmountPaid = 100.00m
                });
                
                // Add comprehensive test items
                testReceipt.Items.Add(new ReceiptItem
                {
                    Name = "Premium Product A",
                    Description = "High-quality item with warranty",
                    Quantity = 3,
                    Price = 35.00m,
                    UnitPrice = 35.00m,
                    GrossLineTotal = 105.00m,
                    AverageDiscountAmount = 3.00m,
                    SpecialDiscountAmount = 2.00m,
                    PromotionDiscountAmount = 1.00m,
                    DiscountAmount = 6.00m,
                    TaxAmount = 4.50m,
                    TaxPercentage = 5.00m,
                    TaxMethod = "inclusive",
                    Total = 99.00m,
                    LineTotal = 99.00m
                });
                
                testReceipt.Items.Add(new ReceiptItem
                {
                    Name = "Standard Product B", 
                    Description = "Regular everyday item",
                    Quantity = 2,
                    Price = 25.00m,
                    UnitPrice = 25.00m,
                    GrossLineTotal = 50.00m,
                    AverageDiscountAmount = 1.00m,
                    SpecialDiscountAmount = 0.00m,
                    PromotionDiscountAmount = 1.00m,
                    DiscountAmount = 2.00m,
                    TaxAmount = 2.40m,
                    TaxPercentage = 5.00m,
                    TaxMethod = "exclusive",
                    Total = 48.00m,
                    LineTotal = 48.00m
                });
                
                testReceipt.Items.Add(new ReceiptItem
                {
                    Name = "Discounted Product C",
                    Description = "Special offer item",
                    Quantity = 1,
                    Price = 25.00m,
                    UnitPrice = 25.00m,
                    GrossLineTotal = 25.00m,
                    AverageDiscountAmount = 1.00m,
                    SpecialDiscountAmount = 0.00m,
                    PromotionDiscountAmount = 0.00m,
                    DiscountAmount = 1.00m,
                    TaxAmount = 1.25m,
                    TaxPercentage = 5.00m,
                    TaxMethod = "exclusive",
                    Total = 24.00m,
                    LineTotal = 24.00m
                });
                
                // Print the comprehensive test receipt using real configured printer
                SimpleReceiptPrint printer = new SimpleReceiptPrint();
                bool success = printer.Print(config.PrinterName, testReceipt);

                if (success)
                {
                    Console.WriteLine("\u2713 Comprehensive test receipt printed successfully!");
                    return "{\"success\":true,\"message\":\"Test receipt printed successfully\"}";
                }
                else
                {
                    Console.WriteLine("\u2717 Failed to print comprehensive test receipt");
                    return "{\"error\":\"Failed to print comprehensive test receipt\"}";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Test receipt print error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        // Helper method to replace null-coalescing operator for better compatibility
        private string GetFirstNonNull(params string[] values)
        {
            foreach (string value in values)
            {
                if (!string.IsNullOrEmpty(value))
                    return value;
            }
            return null;
        }

        private int? ParseNullableIntField(string json, params string[] fieldNames)
        {
            foreach (string fieldName in fieldNames)
            {
                string valueStr = ExtractJsonValue(json, fieldName);
                if (!string.IsNullOrEmpty(valueStr))
                {
                    int value;
                    if (int.TryParse(valueStr, out value))
                    {
                        return value;
                    }
                }
            }

            return null;
        }

        private ReceiptData ParseReceiptJson(string json)
        {
            // Enhanced JSON parsing for POS system compatibility
            try
            {
                Console.WriteLine("ParseReceiptJson: Starting to parse JSON: " + json.Substring(0, Math.Min(200, json.Length)) + "...");
                
                ReceiptData receipt = new ReceiptData();
                
                // Extract basic fields - try multiple naming conventions
                receipt.OrderId = GetFirstNonNull(
                    ExtractJsonString(json, "orderId"), 
                    ExtractJsonString(json, "receiptNumber"),
                    ExtractJsonString(json, "receipt_number"),
                    ExtractJsonString(json, "sale_number"),
                    ExtractJsonString(json, "saleNumber"));
                    
                receipt.SaleNumber = GetFirstNonNull(
                    ExtractJsonString(json, "saleNumber"),
                    ExtractJsonString(json, "sale_number"), 
                    ExtractJsonString(json, "receiptNumber"),
                    receipt.OrderId);
                receipt.BarcodeValue = GetFirstNonNull(
                    ExtractJsonString(json, "barcodeValue"),
                    ExtractJsonString(json, "BarcodeValue"),
                    receipt.SaleNumber,
                    receipt.OrderId);
                    
                receipt.Notes = ExtractJsonString(json, "notes");
                receipt.PaymentStatus = GetFirstNonNull(ExtractJsonString(json, "payment_status"), ExtractJsonString(json, "paymentStatus"));
                
                Console.WriteLine("ParseReceiptJson: OrderId = " + receipt.OrderId + ", SaleNumber = " + receipt.SaleNumber + ", Notes = " + receipt.Notes);
                
                // Extract customer info - handle both simple string and nested object
                string customerName = GetFirstNonNull(
                    ExtractJsonString(json, "customer"),
                    ExtractJsonString(json, "customer_name"), 
                    ExtractJsonString(json, "customerName"));
                    
                if (customerName == null)
                {
                    // Try nested customer object
                    int customerStart = json.IndexOf("\"customer\"");
                    if (customerStart > -1)
                    {
                        customerName = ExtractJsonString(json.Substring(customerStart), "name");
                    }
                }
                
                if (!string.IsNullOrEmpty(customerName))
                {
                    receipt.Customer = new CustomerInfo { Name = customerName };
                    
                    string customerPhone = GetFirstNonNull(
                        ExtractJsonString(json, "customer_phone"), 
                        ExtractJsonString(json, "customerPhone"));
                    if (customerPhone == null)
                    {
                        int customerStart = json.IndexOf("\"customer\"");
                        if (customerStart > -1)
                        {
                            customerPhone = ExtractJsonString(json.Substring(customerStart), "phone");
                        }
                    }
                    if (!string.IsNullOrEmpty(customerPhone))
                    {
                        receipt.Customer.Phone = customerPhone;
                    }

                    string customerAddress = GetFirstNonNull(
                        ExtractJsonString(json, "customer_address"),
                        ExtractJsonString(json, "customerAddress"));
                    if (!string.IsNullOrEmpty(customerAddress))
                    {
                        receipt.Customer.Address = customerAddress;
                    }

                    receipt.Customer.RewardPoints = ParseNullableIntField(
                        json,
                        "rewardPoints",
                        "customerRewardPoints",
                        "pointsBalance",
                        "totalPoints");
                    receipt.Customer.PointsEarned = ParseNullableIntField(
                        json,
                        "pointsEarned",
                        "rewardPointsEarned",
                        "lifetimeEarned");
                    receipt.Customer.PointsRedeemed = ParseNullableIntField(
                        json,
                        "pointsRedeemed",
                        "rewardPointsRedeemed",
                        "lifetimeRedeemed");
                    
                    Console.WriteLine("ParseReceiptJson: Customer = " + customerName + ", Phone = " + customerPhone);
                }
                
                // Extract cashier info
                string cashierName = GetFirstNonNull(
                    ExtractJsonString(json, "cashier"),
                    ExtractJsonString(json, "cashier_name"),
                    ExtractJsonString(json, "cashierName"));
                if (!string.IsNullOrEmpty(cashierName))
                {
                    receipt.Cashier = new UserInfo { Name = cashierName };
                    Console.WriteLine("ParseReceiptJson: Cashier = " + cashierName);
                }

                // Extract served by info
                string servedByName = GetFirstNonNull(
                    ExtractJsonString(json, "servedBy"),
                    ExtractJsonString(json, "served_by"),
                    ExtractJsonString(json, "servedByName"));
                if (!string.IsNullOrEmpty(servedByName))
                {
                    receipt.ServedBy = new UserInfo { Name = servedByName };
                }
                
                // Parse date and time
                string dateStr = ExtractJsonString(json, "date");
                string timeStr = ExtractJsonString(json, "time");
                if (!string.IsNullOrEmpty(dateStr))
                {
                    DateTime parsedDate;
                    if (DateTime.TryParse(dateStr, out parsedDate))
                    {
                        if (!string.IsNullOrEmpty(timeStr))
                        {
                            // Combine date and time
                            TimeSpan parsedTime;
                            if (TimeSpan.TryParse(timeStr, out parsedTime))
                            {
                                receipt.OrderDate = parsedDate.Date + parsedTime;
                            }
                            else
                            {
                                receipt.OrderDate = parsedDate;
                            }
                        }
                        else
                        {
                            receipt.OrderDate = parsedDate;
                        }
                        Console.WriteLine("ParseReceiptJson: Date = " + receipt.OrderDate);
                    }
                }
                
                // Extract branch info
                int branchStart = json.IndexOf("\"branch\"");
                if (branchStart > -1)
                {
                    string branchSection = json.Substring(branchStart);
                    string branchName = ExtractJsonString(branchSection, "name");
                    if (!string.IsNullOrEmpty(branchName))
                    {
                        receipt.Branch = new BranchInfo 
                        { 
                            Name = branchName,
                            Address = ExtractJsonString(branchSection, "address"),
                            Phone = ExtractJsonString(branchSection, "phone"),
                            Email = ExtractJsonString(branchSection, "email")
                        };
                    }
                }
                
                // Extract cashier info
                int userStart = json.IndexOf("\"user\"");
                if (userStart > -1)
                {
                    string userSection = json.Substring(userStart);
                    string userName = ExtractJsonString(userSection, "name");
                    if (!string.IsNullOrEmpty(userName))
                    {
                        receipt.Cashier = new UserInfo 
                        { 
                            Name = userName,
                            Id = ExtractJsonString(userSection, "id")
                        };
                    }
                }
                
                // Extract decimal values with multiple naming options (parse before items to avoid conflicts)
                ParseRootLevelDecimalField(json, receipt, "subtotal");
                ParseRootLevelDecimalField(json, receipt, "tax", "tax_amount", "taxAmount");
                ParseRootLevelDecimalField(json, receipt, "total", "total_amount", "totalAmount");
                ParseRootLevelDecimalField(json, receipt, "discount", "discount_amount", "discountAmount");
                ParseRootLevelDecimalField(json, receipt, "shipping", "shipping_cost", "shippingCost");
                ParseRootLevelDecimalField(json, receipt, "received_amount", "receivedAmount", "amountPaid", "amount_paid");
                ParseRootLevelDecimalField(json, receipt, "change_amount", "changeAmount", "change");
                
                // Extract payment info - handle both single payment and payments array
                ParsePayments(json, receipt);
                
                // Return receipts carry isReturn=true (or documentType=RETURN)
                string isReturnStr = GetFirstNonNull(ExtractJsonValue(json, "isReturn"), ExtractJsonValue(json, "is_return"));
                bool isReturn;
                receipt.IsReturn = (!string.IsNullOrEmpty(isReturnStr) && bool.TryParse(isReturnStr, out isReturn) && isReturn)
                    || string.Equals(ExtractJsonString(json, "documentType"), "RETURN", StringComparison.OrdinalIgnoreCase);

                // Extract items array (enhanced parsing)
                ParseItems(json, receipt);
                
                // Extract openCashDrawer
                // Extract openCashDrawer
                string openCashDrawerStr = GetFirstNonNull(ExtractJsonValue(json, "openCashDrawer"), ExtractJsonValue(json, "open_cash_drawer"));
                if (!string.IsNullOrEmpty(openCashDrawerStr))
                {
                    bool openCashDrawer;
                    if (bool.TryParse(openCashDrawerStr, out openCashDrawer))
                    {
                        receipt.OpenCashDrawer = openCashDrawer;
                        Console.WriteLine("ParseReceiptJson: openCashDrawer = " + openCashDrawer);
                    }
                }

                return receipt;
            }
            catch (Exception ex)
            {
                Console.WriteLine("ParseReceiptJson error: " + ex.Message);
                return null;
            }
        }
        
        private void ParseRootLevelDecimalField(string json, ReceiptData receipt, params string[] fieldNames)
        {
            foreach (string fieldName in fieldNames)
            {
                // Find the items array position to avoid parsing fields inside it
                int itemsArrayStart = json.IndexOf("\"items\"");
                int itemsArrayEnd = -1;
                
                if (itemsArrayStart > -1)
                {
                    int arrayStart = json.IndexOf("[", itemsArrayStart);
                    if (arrayStart > -1)
                    {
                        int bracketCount = 1;
                        int pos = arrayStart + 1;
                        while (pos < json.Length && bracketCount > 0)
                        {
                            if (json[pos] == '[') bracketCount++;
                            else if (json[pos] == ']') bracketCount--;
                            pos++;
                        }
                        if (bracketCount == 0) itemsArrayEnd = pos;
                    }
                }
                
                // Look for the field before the items array or after it
                string valueStr = null;
                string pattern = "\"" + fieldName + "\"";
                int keyIndex = json.IndexOf(pattern);
                
                while (keyIndex != -1)
                {
                    // Check if this occurrence is inside the items array
                    bool isInsideItemsArray = itemsArrayStart > -1 && itemsArrayEnd > -1 && 
                                             keyIndex > itemsArrayStart && keyIndex < itemsArrayEnd;
                    
                    if (!isInsideItemsArray)
                    {
                        // This is a root-level field, extract its value
                        int colonIndex = json.IndexOf(":", keyIndex);
                        if (colonIndex > -1)
                        {
                            valueStr = ExtractValueFromPosition(json, colonIndex + 1);
                            break;
                        }
                    }
                    
                    // Look for next occurrence
                    keyIndex = json.IndexOf(pattern, keyIndex + 1);
                }
                
                if (!string.IsNullOrEmpty(valueStr))
                {
                    decimal value;
                    if (decimal.TryParse(valueStr, out value))
                    {
                        Console.WriteLine("ParseRootLevelDecimalField: " + fieldName + " = " + value);
                        switch (fieldName.ToLower().Replace("_", ""))
                        {
                            case "subtotal":
                                receipt.Subtotal = value;
                                break;
                            case "tax":
                            case "taxamount":
                                receipt.Tax = value;
                                receipt.TaxAmount = value;
                                break;
                            case "total":
                            case "totalamount":
                                receipt.Total = value;
                                receipt.TotalAmount = value;
                                break;
                            case "discount":
                            case "discountamount":
                                receipt.Discount = value;
                                receipt.DiscountAmount = value;
                                break;
                            case "shipping":
                            case "shippingcost":
                                receipt.ShippingCost = value;
                                break;
                            case "receivedamount":
                            case "amountpaid":
                                receipt.ReceivedAmount = value;
                                break;
                            case "changeamount":
                            case "change":
                                receipt.ChangeAmount = value;
                                break;
                        }
                        break; // Use the first found value
                    }
                }
            }
        }
        
        private string ExtractValueFromPosition(string json, int startPos)
        {
            // Skip whitespace after colon
            while (startPos < json.Length && char.IsWhiteSpace(json[startPos]))
                startPos++;

            if (startPos >= json.Length) return null;

            int valueEnd;
            char firstChar = json[startPos];

            if (firstChar == '"')
            {
                // String value - find closing quote
                valueEnd = json.IndexOf("\"", startPos + 1);
                if (valueEnd == -1) return null;
                return json.Substring(startPos + 1, valueEnd - startPos - 1);
            }
            else
            {
                // Number value - find next comma, brace, or bracket
                valueEnd = startPos;
                while (valueEnd < json.Length && 
                       json[valueEnd] != ',' && 
                       json[valueEnd] != '}' && 
                       json[valueEnd] != ']' && 
                       !char.IsWhiteSpace(json[valueEnd]))
                {
                    valueEnd++;
                }
                
                if (valueEnd > startPos)
                {
                    return json.Substring(startPos, valueEnd - startPos);
                }
            }

            return null;
        }
        
        private void ParseDecimalField(string json, ReceiptData receipt, params string[] fieldNames)
        {
            foreach (string fieldName in fieldNames)
            {
                string valueStr = ExtractJsonValue(json, fieldName); // Use new method that handles numbers
                if (!string.IsNullOrEmpty(valueStr))
                {
                    decimal value;
                    if (decimal.TryParse(valueStr, out value))
                    {
                        Console.WriteLine("ParseDecimalField: " + fieldName + " = " + value);
                        switch (fieldName.ToLower().Replace("_", ""))
                        {
                            case "subtotal":
                                receipt.Subtotal = value;
                                break;
                            case "tax":
                            case "taxamount":
                                receipt.Tax = value;
                                receipt.TaxAmount = value;
                                break;
                            case "total":
                            case "totalamount":
                                receipt.Total = value;
                                receipt.TotalAmount = value;
                                break;
                            case "discount":
                            case "discountamount":
                                receipt.Discount = value;
                                receipt.DiscountAmount = value;
                                break;
                            case "shipping":
                            case "shippingcost":
                                receipt.ShippingCost = value;
                                break;
                            case "receivedamount":
                            case "amountpaid":
                                receipt.ReceivedAmount = value;
                                break;
                            case "changeamount":
                            case "change":
                                receipt.ChangeAmount = value;
                                break;
                        }
                        break; // Use the first found value
                    }
                }
            }
        }
        
        private void ParsePayments(string json, ReceiptData receipt)
        {
            // Check for payments array first
            int paymentsStart = json.IndexOf("\"payments\"");
            if (paymentsStart > -1)
            {
                // Parse payments array
                string paymentsSection = json.Substring(paymentsStart);
                int arrayStart = paymentsSection.IndexOf("[");
                int arrayEnd = paymentsSection.IndexOf("]");
                
                if (arrayStart > -1 && arrayEnd > arrayStart)
                {
                    string paymentsArray = paymentsSection.Substring(arrayStart + 1, arrayEnd - arrayStart - 1);
                    string[] paymentObjects = paymentsArray.Split(new string[] { "},{" }, StringSplitOptions.RemoveEmptyEntries);
                    
                    foreach (string paymentObj in paymentObjects)
                    {
                        string cleanPaymentObj = paymentObj.Replace("{", "").Replace("}", "");
                        
                        string method = GetFirstNonNull(
                            ExtractJsonString("{" + cleanPaymentObj + "}", "payment_method"),
                            ExtractJsonString("{" + cleanPaymentObj + "}", "paymentMethod"),
                            ExtractJsonString("{" + cleanPaymentObj + "}", "method"));
                        string amountStr = ExtractJsonValue("{" + cleanPaymentObj + "}", "amount"); // Use ExtractJsonValue for numbers
                        
                        if (!string.IsNullOrEmpty(method))
                        {
                            PaymentInfo payment = new PaymentInfo { Method = method, PaymentMethod = method };
                            
                            if (!string.IsNullOrEmpty(amountStr))
                            {
                                decimal amount;
                                if (decimal.TryParse(amountStr, out amount))
                                {
                                    payment.Amount = amount;
                                    payment.AmountPaid = amount;
                                    Console.WriteLine("ParsePayments: " + method + " = " + amount);
                                }
                            }
                            
                            receipt.Payments.Add(payment);
                        }
                    }
                    
                    // Set the first payment as the main payment for backwards compatibility
                    if (receipt.Payments.Count > 0)
                    {
                        receipt.Payment = receipt.Payments[0];
                    }
                }
            }
            else
            {
                // Fallback to single payment object or direct paymentMethod field
                string paymentMethod = GetFirstNonNull(
                    ExtractJsonString(json, "paymentMethod"),
                    ExtractJsonString(json, "payment_method"),
                    ExtractJsonString(json, "method"));
                    
                if (string.IsNullOrEmpty(paymentMethod))
                {
                    int paymentStart = json.IndexOf("\"payment\"");
                    if (paymentStart > -1)
                    {
                        string paymentSection = json.Substring(paymentStart);
                        paymentMethod = GetFirstNonNull(
                            ExtractJsonString(paymentSection, "method"),
                            ExtractJsonString(paymentSection, "payment_method"),
                            ExtractJsonString(paymentSection, "paymentMethod"));
                    }
                }
                
                if (!string.IsNullOrEmpty(paymentMethod))
                {
                    receipt.Payment = new PaymentInfo 
                    { 
                        Method = paymentMethod, 
                        PaymentMethod = paymentMethod,
                        AmountPaid = receipt.ReceivedAmount,
                        Amount = receipt.ReceivedAmount,
                        Change = receipt.ChangeAmount
                    };
                    receipt.Payments.Add(receipt.Payment);
                    Console.WriteLine("ParseReceiptJson: Payment Method = " + paymentMethod + ", Amount = " + receipt.ReceivedAmount + ", Change = " + receipt.ChangeAmount);
                }
            }
        }
        
        private void ParseItems(string json, ReceiptData receipt)
        {
            int itemsStart = json.IndexOf("\"items\"");
            if (itemsStart > -1)
            {
                string itemsSection = json.Substring(itemsStart);
                int arrayStart = itemsSection.IndexOf("[");
                int arrayEnd = itemsSection.IndexOf("]");
                
                if (arrayStart > -1 && arrayEnd > arrayStart)
                {
                    string itemsArray = itemsSection.Substring(arrayStart + 1, arrayEnd - arrayStart - 1);
                    // Enhanced item parsing - handle nested objects
                    string[] itemObjects = SplitJsonObjects(itemsArray);
                    
                    foreach (string itemObj in itemObjects)
                    {
                        ReceiptItem item = ParseReceiptItem(itemObj);
                        if (item != null && !string.IsNullOrEmpty(item.Name))
                        {
                            receipt.Items.Add(item);
                        }
                    }
                }
            }
        }
        
        private ReceiptItem ParseReceiptItem(string itemJson)
        {
            try
            {
                string cleanItemObj = itemJson.Trim().TrimStart('{').TrimEnd('}');
                string fullItemJson = "{" + cleanItemObj + "}";
                
                ReceiptItem item = new ReceiptItem();
                
                // Try multiple field names for item name
                item.Name = GetFirstNonNull(
                    ExtractJsonString(fullItemJson, "name"),
                    ExtractJsonString(fullItemJson, "product_name"),
                    ExtractJsonString(fullItemJson, "productName"));
                
                // Check for nested variant object
                int variantStart = fullItemJson.IndexOf("\"variant\"");
                if (variantStart > -1)
                {
                    string variantSection = fullItemJson.Substring(variantStart);
                    string variantName = ExtractJsonString(variantSection, "name");
                    if (!string.IsNullOrEmpty(variantName))
                    {
                        item.Name = variantName;
                    }
                    else
                    {
                        // Check for nested product in variant
                        int productStart = variantSection.IndexOf("\"product\"");
                        if (productStart > -1)
                        {
                            string productSection = variantSection.Substring(productStart);
                            string productName = ExtractJsonString(productSection, "name");
                            if (!string.IsNullOrEmpty(productName))
                            {
                                item.Name = productName;
                            }
                        }
                    }
                }
                
                item.Description = ExtractJsonString(fullItemJson, "description");
                
                // Parse quantity
                string qtyStr = ExtractJsonValue(fullItemJson, "quantity"); // Use ExtractJsonValue for numbers
                if (!string.IsNullOrEmpty(qtyStr))
                {
                    int qty;
                    if (int.TryParse(qtyStr, out qty))
                    {
                        item.Quantity = qty;
                        Console.WriteLine("ParseReceiptItem: quantity = " + qty);
                    }
                }
                
                // Parse price (try multiple field names)
                string priceStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "unitPrice"),
                    ExtractJsonValue(fullItemJson, "price"),
                    ExtractJsonValue(fullItemJson, "unit_price"),
                    ExtractJsonValue(fullItemJson, "regular_price"));
                if (!string.IsNullOrEmpty(priceStr))
                {
                    decimal price;
                    if (decimal.TryParse(priceStr, out price))
                    {
                        item.Price = price;
                        item.UnitPrice = price;
                        Console.WriteLine("ParseReceiptItem: price = " + price);
                    }
                }
                
                // Parse total (try multiple field names)
                string totalStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "lineTotal"),
                    ExtractJsonValue(fullItemJson, "line_total"),
                    ExtractJsonValue(fullItemJson, "total"),
                    ExtractJsonValue(fullItemJson, "netTotal"));
                if (!string.IsNullOrEmpty(totalStr))
                {
                    decimal total;
                    if (decimal.TryParse(totalStr, out total))
                    {
                        item.Total = total;
                        item.LineTotal = total;
                        Console.WriteLine("ParseReceiptItem: total = " + total);
                    }
                }
                else
                {
                    // Calculate total if not provided
                    item.Total = item.Quantity * item.Price;
                    item.LineTotal = item.Total;
                    Console.WriteLine("ParseReceiptItem: calculated total = " + item.Total);
                }

                string grossTotalStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "grossLineTotal"),
                    ExtractJsonValue(fullItemJson, "gross_line_total"));
                if (!string.IsNullOrEmpty(grossTotalStr))
                {
                    decimal grossTotal;
                    if (decimal.TryParse(grossTotalStr, out grossTotal))
                    {
                        item.GrossLineTotal = grossTotal;
                    }
                }

                if (item.GrossLineTotal <= 0)
                {
                    item.GrossLineTotal = item.Quantity * item.Price;
                }

                string averageDiscountStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "averageDiscountAmount"),
                    ExtractJsonValue(fullItemJson, "average_discount_amount"));
                if (!string.IsNullOrEmpty(averageDiscountStr))
                {
                    decimal averageDiscount;
                    if (decimal.TryParse(averageDiscountStr, out averageDiscount))
                    {
                        item.AverageDiscountAmount = averageDiscount;
                    }
                }
                
                // Parse discount amount
                string discountStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "discountAmount"),
                    ExtractJsonValue(fullItemJson, "discount_amount"),
                    ExtractJsonValue(fullItemJson, "totalDiscount"));
                if (!string.IsNullOrEmpty(discountStr))
                {
                    decimal discount;
                    if (decimal.TryParse(discountStr, out discount))
                    {
                        item.DiscountAmount = discount;
                        Console.WriteLine("ParseReceiptItem: discount = " + discount);
                    }
                }

                string specialDiscountStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "specialDiscountAmount"),
                    ExtractJsonValue(fullItemJson, "special_discount_amount"));
                if (!string.IsNullOrEmpty(specialDiscountStr))
                {
                    decimal specialDiscount;
                    if (decimal.TryParse(specialDiscountStr, out specialDiscount))
                    {
                        item.SpecialDiscountAmount = specialDiscount;
                    }
                }

                string promotionDiscountStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "promotionDiscountAmount"),
                    ExtractJsonValue(fullItemJson, "promotion_discount_amount"));
                if (!string.IsNullOrEmpty(promotionDiscountStr))
                {
                    decimal promotionDiscount;
                    if (decimal.TryParse(promotionDiscountStr, out promotionDiscount))
                    {
                        item.PromotionDiscountAmount = promotionDiscount;
                    }
                }

                if (item.DiscountAmount <= 0)
                {
                    item.DiscountAmount = item.AverageDiscountAmount + item.SpecialDiscountAmount + item.PromotionDiscountAmount;
                }

                string taxAmountStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "taxAmount"),
                    ExtractJsonValue(fullItemJson, "tax_amount"));
                if (!string.IsNullOrEmpty(taxAmountStr))
                {
                    decimal taxAmount;
                    if (decimal.TryParse(taxAmountStr, out taxAmount))
                    {
                        item.TaxAmount = taxAmount;
                    }
                }

                string taxPercentageStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "taxPercentage"),
                    ExtractJsonValue(fullItemJson, "tax_percentage"));
                if (!string.IsNullOrEmpty(taxPercentageStr))
                {
                    decimal taxPercentage;
                    if (decimal.TryParse(taxPercentageStr, out taxPercentage))
                    {
                        item.TaxPercentage = taxPercentage;
                    }
                }

                item.TaxMethod = GetFirstNonNull(
                    ExtractJsonString(fullItemJson, "taxMethod"),
                    ExtractJsonString(fullItemJson, "tax_method"),
                    item.TaxMethod);
                
                return item;
            }
            catch (Exception ex)
            {
                Console.WriteLine("ParseReceiptItem error: " + ex.Message);
                return null;
            }
        }
        
        private string[] SplitJsonObjects(string jsonArray)
        {
            // Simple JSON object splitting - more robust than just splitting by },{
            List<string> objects = new List<string>();
            int braceCount = 0;
            int start = 0;
            
            for (int i = 0; i < jsonArray.Length; i++)
            {
                if (jsonArray[i] == '{')
                {
                    braceCount++;
                }
                else if (jsonArray[i] == '}')
                {
                    braceCount--;
                    if (braceCount == 0)
                    {
                        string obj = jsonArray.Substring(start, i - start + 1);
                        objects.Add(obj);
                        start = i + 1;
                        // Skip comma and whitespace
                        while (start < jsonArray.Length && (jsonArray[start] == ',' || char.IsWhiteSpace(jsonArray[start])))
                        {
                            start++;
                        }
                        i = start - 1; // Will be incremented by loop
                    }
                }
            }
            
            return objects.ToArray();
        }

        private StoreConfig ParseConfigJson(string json)
        {
            try
            {
                return new StoreConfig
                {
                    StoreName = GetFirstNonNull(ExtractJsonString(json, "storeName"), "My Store"),
                    Address = GetFirstNonNull(ExtractJsonString(json, "address"), ""),
                    Phone = GetFirstNonNull(ExtractJsonString(json, "phone"), ""),
                    Currency = GetFirstNonNull(ExtractJsonString(json, "currency"), "$")
                };
            }
            catch
            {
                return null;
            }
        }

        private string ExtractJsonString(string json, string key)
        {
            try
            {
                string pattern = "\"" + key + "\"";
                int keyIndex = json.IndexOf(pattern);
                if (keyIndex == -1) 
                {
                    Console.WriteLine("ExtractJsonString: Key '" + key + "' not found in JSON");
                    return null;
                }

                int colonIndex = json.IndexOf(":", keyIndex);
                if (colonIndex == -1) 
                {
                    Console.WriteLine("ExtractJsonString: Colon not found after key '" + key + "'");
                    return null;
                }

                int startQuoteIndex = json.IndexOf("\"", colonIndex);
                if (startQuoteIndex == -1) 
                {
                    Console.WriteLine("ExtractJsonString: Start quote not found for key '" + key + "'");
                    return null;
                }

                int endQuoteIndex = json.IndexOf("\"", startQuoteIndex + 1);
                if (endQuoteIndex == -1) 
                {
                    Console.WriteLine("ExtractJsonString: End quote not found for key '" + key + "'");
                    return null;
                }

                string value = json.Substring(startQuoteIndex + 1, endQuoteIndex - startQuoteIndex - 1);
                Console.WriteLine("ExtractJsonString: " + key + " = '" + value + "'");
                return value;
            }
            catch (Exception ex)
            {
                Console.WriteLine("ExtractJsonString error for key '" + key + "': " + ex.Message);
                return null;
            }
        }

        // New method to extract any JSON value (string, number, boolean, null)
        private string ExtractJsonValue(string json, string key)
        {
            try
            {
                string pattern = "\"" + key + "\"";
                int keyIndex = json.IndexOf(pattern);
                if (keyIndex == -1) 
                {
                    Console.WriteLine("ExtractJsonValue: Key '" + key + "' not found in JSON");
                    return null;
                }

                int colonIndex = json.IndexOf(":", keyIndex);
                if (colonIndex == -1) 
                {
                    Console.WriteLine("ExtractJsonValue: Colon not found after key '" + key + "'");
                    return null;
                }

                // Skip whitespace after colon
                int valueStart = colonIndex + 1;
                while (valueStart < json.Length && char.IsWhiteSpace(json[valueStart]))
                    valueStart++;

                if (valueStart >= json.Length) return null;

                int valueEnd;
                char firstChar = json[valueStart];

                if (firstChar == '"')
                {
                    // String value - find closing quote
                    valueEnd = json.IndexOf("\"", valueStart + 1);
                    if (valueEnd == -1) return null;
                    string value = json.Substring(valueStart + 1, valueEnd - valueStart - 1);
                    Console.WriteLine("ExtractJsonValue: " + key + " = '" + value + "' (string)");
                    return value;
                }
                else if (firstChar == 'n' && json.Substring(valueStart, Math.Min(4, json.Length - valueStart)) == "null")
                {
                    // Null value
                    Console.WriteLine("ExtractJsonValue: " + key + " = null");
                    return null;
                }
                else if (firstChar == 't' && json.Substring(valueStart, Math.Min(4, json.Length - valueStart)) == "true")
                {
                    // Boolean true
                    Console.WriteLine("ExtractJsonValue: " + key + " = true (boolean)");
                    return "true";
                }
                else if (firstChar == 'f' && json.Substring(valueStart, Math.Min(5, json.Length - valueStart)) == "false")
                {
                    // Boolean false
                    Console.WriteLine("ExtractJsonValue: " + key + " = false (boolean)");
                    return "false";
                }
                else
                {
                    // Number value - find next comma, brace, or bracket
                    valueEnd = valueStart;
                    while (valueEnd < json.Length && 
                           json[valueEnd] != ',' && 
                           json[valueEnd] != '}' && 
                           json[valueEnd] != ']' && 
                           !char.IsWhiteSpace(json[valueEnd]))
                    {
                        valueEnd++;
                    }
                    
                    if (valueEnd > valueStart)
                    {
                        string value = json.Substring(valueStart, valueEnd - valueStart);
                        Console.WriteLine("ExtractJsonValue: " + key + " = '" + value + "' (number)");
                        return value;
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine("ExtractJsonValue error for key '" + key + "': " + ex.Message);
                return null;
            }
        }
    }
}
