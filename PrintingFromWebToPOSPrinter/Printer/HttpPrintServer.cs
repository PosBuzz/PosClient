using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using Printer.Models;
using Printer.Services;
using Printer.Barcode;
using Newtonsoft.Json;

namespace Printer
{
    public class HttpPrintServer
    {
        private HttpListener listener;
        private bool isRunning;
        private Thread listenerThread;

        public HttpPrintServer()
        {
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
                
                Console.WriteLine("HTTP Print Server started on port {0}", port);
                Console.WriteLine("Endpoints:");
                Console.WriteLine("  POST http://localhost:{0}/print - Print receipt", port);
                Console.WriteLine("  GET  http://localhost:{0}/status - Server status", port);
                Console.WriteLine("  GET  http://localhost:{0}/config - Get configuration", port);
                Console.WriteLine("  POST http://localhost:{0}/config - Update configuration", port);
                Console.WriteLine("  GET  http://localhost:{0}/cash-drawer - Open cash drawer", port);
                Console.WriteLine("  POST http://localhost:{0}/print-barcode-label - Print barcode label", port);
                Console.WriteLine("  GET  http://localhost:{0}/test-barcode-label - Test barcode print", port);
                Console.WriteLine("  GET  http://localhost:{0}/test-receipt - Test receipt print", port);
                Console.WriteLine();
                Console.WriteLine("Press 'q' to quit the server...");

                listenerThread = new Thread(HandleRequests);
                listenerThread.Start();
            }
            catch (Exception ex)
            {
                Console.WriteLine("Failed to start HTTP server: " + ex.Message);
                Console.WriteLine("Make sure you run as Administrator or the port is not in use.");
            }
        }

        public void Stop()
        {
            if (!isRunning) return;

            isRunning = false;
            listener.Stop();
            listenerThread.Join(5000);
            Console.WriteLine("HTTP Print Server stopped.");
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
                        Console.WriteLine("Error handling request: " + ex.Message);
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
                Console.WriteLine();
                Console.WriteLine("=== INCOMING REQUEST ===");
                Console.WriteLine("Time: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
                Console.WriteLine("Method: " + request.HttpMethod);
                Console.WriteLine("URL: " + request.Url);
                Console.WriteLine("Content-Type: " + request.ContentType);
                Console.WriteLine("Content-Length: " + request.ContentLength64);
                Console.WriteLine("User-Agent: " + request.UserAgent);
                
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

                Console.WriteLine("=== RESPONSE SENT ===");
                Console.WriteLine("Status Code: " + statusCode);
                Console.WriteLine("Response Length: " + buffer.Length + " bytes");
                Console.WriteLine("Response: " + responseText.Substring(0, Math.Min(200, responseText.Length)) + "...");
                Console.WriteLine("========================");
            }
            catch (Exception ex)
            {
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
                Console.WriteLine("Total: $" + receiptData.Total);
                Console.WriteLine("Date: " + (receiptData.OrderDate != null ? receiptData.OrderDate.ToString() : ""));
                Console.WriteLine("===============================");

                Console.WriteLine("=== PRINTING RECEIPT ===");
                // Print the receipt
                SimpleReceiptPrint printer = new SimpleReceiptPrint();
                bool success = printer.Print("", receiptData);
                
                Console.WriteLine("Print Result: " + (success ? "SUCCESS" : "FAILED"));
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
                return string.Format("{{\"storeName\":\"{0}\",\"address\":\"{1}\",\"phone\":\"{2}\",\"email\":\"{3}\",\"logoPath\":\"{4}\",\"printerName\":\"{5}\",\"barcodePrinterName\":\"{6}\",\"enableCashDrawer\":{7},\"currency\":\"{8}\",\"port\":{9},\"autoStart\":{10}}}",
                    (config.StoreName ?? "").Replace("\"", "\\\""),
                    (config.Address ?? "").Replace("\"", "\\\""),
                    (config.Phone ?? "").Replace("\"", "\\\""),
                    (config.Email ?? "").Replace("\"", "\\\""),
                    (config.LogoPath ?? "").Replace("\"", "\\\""),
                    (config.PrinterName ?? "").Replace("\"", "\\\""),
                    (config.BarcodePrinterName ?? "").Replace("\"", "\\\""),
                    config.EnableCashDrawer.ToString().ToLower(),
                    (config.Currency ?? "$").Replace("\"", "\\\""),
                    config.Port,
                    config.AutoStart.ToString().ToLower());
            }
            catch (Exception ex)
            {
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
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

                // Create a config object with only the fields to update
                StoreConfig updatedFields = new StoreConfig();
                
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
                
                // Handle boolean fields - check for both string and boolean values
                string enableCashDrawerStr = GetFirstNonNull(
                    ExtractJsonValue(body, "enableCashDrawer"),
                    ExtractJsonValue(body, "EnableCashDrawer"));
                if (enableCashDrawerStr != null) {
                    bool enableCashDrawer = enableCashDrawerStr.ToLower() == "true" || enableCashDrawerStr == "1";
                    updatedFields.EnableCashDrawer = enableCashDrawer;
                    Console.WriteLine("HTTP: Setting EnableCashDrawer = " + enableCashDrawer);
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
                
                string autoStartStr = GetFirstNonNull(
                    ExtractJsonValue(body, "autoStart"),
                    ExtractJsonValue(body, "AutoStart"));
                if (autoStartStr != null) {
                    bool autoStart = autoStartStr.ToLower() == "true" || autoStartStr == "1";
                    updatedFields.AutoStart = autoStart;
                    Console.WriteLine("HTTP: Setting AutoStart = " + autoStart);
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
                Console.WriteLine("=== BARCODE LABEL PRINT REQUEST ===");
                
                string body = "";
                using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                {
                    body = reader.ReadToEnd();
                }
                
                Console.WriteLine("Barcode request body: " + body);
                
                var printRequest = JsonConvert.DeserializeObject<BarcodeLabelPrintRequest>(body);
                
                if (printRequest == null)
                {
                    Console.WriteLine("ERROR: Failed to parse barcode print request");
                    return "{\"error\":\"Invalid request format\"}";
                }
                
                Console.WriteLine("Printing barcode label:");
                Console.WriteLine("  Barcode Value: " + printRequest.BarcodeValue);
                Console.WriteLine("  Product Name: " + printRequest.ProductName);
                Console.WriteLine("  Price: " + printRequest.Price);
                Console.WriteLine("  VAT Included: " + printRequest.VatIncluded);
                Console.WriteLine("  VAT Percentage: " + printRequest.VatPercentage + "%");
                Console.WriteLine("  Quantity: " + printRequest.Quantity);
                Console.WriteLine("  Print Barcode Only: " + printRequest.PrintBarcodeOnly);
                
                BarcodeLabelPrint.PrintLabel(printRequest.BarcodeValue, printRequest.ProductName, printRequest.Price, printRequest.PrintBarcodeOnly, printRequest.VatIncluded, printRequest.VatPercentage, printRequest.Quantity);
                
                Console.WriteLine("✓ Barcode label printed successfully!");
                return "{\"success\":true,\"message\":\"Barcode label printed successfully\"}";
            }
            catch (Exception ex)
            {
                Console.WriteLine("Barcode print error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandleTestBarcodeLabel()
        {
            try
            {
                Console.WriteLine("=== TEST BARCODE LABEL PRINT ===");
                Console.WriteLine("Printing test barcode label...");
                
                BarcodeLabelPrint.PrintLabel("123456789012", "Test Product", "9.99", false, true, 21.0m);
                
                Console.WriteLine("✓ Test barcode label printed successfully!");
                return "{\"success\":true,\"message\":\"Test barcode label printed successfully\"}";
            }
            catch (Exception ex)
            {
                Console.WriteLine("Test barcode print error: " + ex.Message);
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        private string HandleTestReceipt()
        {
            try
            {
                Console.WriteLine("=== TEST RECEIPT PRINT ===");
                Console.WriteLine("Printing test receipt with cash drawer opening...");
                
                // Create a test receipt
                ReceiptData testReceipt = new ReceiptData
                {
                    SaleNumber = "TEST-001",
                    OrderId = "TEST-001",
                    Total = 25.99m,
                    Subtotal = 21.99m,
                    Tax = 4.00m,
                    ChangeAmount = 4.01m,
                    ReceivedAmount = 30.00m,
                    OpenCashDrawer = true, // This will trigger cash drawer opening
                    OrderDate = DateTime.Now
                };
                
                // Add store info
                testReceipt.Branch = new BranchInfo
                {
                    Name = "Test Store",
                    Address = "123 Test Street, Test City",
                    Phone = "(555) 123-4567"
                };
                
                // Add cashier info
                testReceipt.Cashier = new UserInfo
                {
                    Name = "Test Cashier",
                    Id = "CASHIER-001"
                };
                
                // Add customer info
                testReceipt.Customer = new CustomerInfo
                {
                    Name = "Test Customer",
                    Phone = "(555) 987-6543"
                };
                
                // Add payment info
                testReceipt.Payment = new PaymentInfo
                {
                    Method = "Cash",
                    PaymentMethod = "Cash",
                    Amount = 30.00m,
                    AmountPaid = 30.00m,
                    Change = 4.01m
                };
                testReceipt.Payments.Add(testReceipt.Payment);
                
                // Add test items
                testReceipt.Items.Add(new ReceiptItem
                {
                    Name = "Test Product 1",
                    Quantity = 2,
                    Price = 7.99m,
                    Total = 15.98m,
                    UnitPrice = 7.99m,
                    LineTotal = 15.98m
                });
                
                testReceipt.Items.Add(new ReceiptItem
                {
                    Name = "Test Product 2",
                    Quantity = 1,
                    Price = 6.01m,
                    Total = 6.01m,
                    UnitPrice = 6.01m,
                    LineTotal = 6.01m
                });
                
                // Print the test receipt
                SimpleReceiptPrint printer = new SimpleReceiptPrint();
                bool success = printer.Print("", testReceipt);
                
                if (success)
                {
                    Console.WriteLine("✓ Test receipt printed successfully!");
                    if (testReceipt.OpenCashDrawer)
                    {
                        Console.WriteLine("✓ Cash drawer should have opened as well!");
                    }
                    return "{\"success\":true,\"message\":\"Test receipt printed successfully with cash drawer opening\"}";
                }
                else
                {
                    Console.WriteLine("✗ Failed to print test receipt");
                    return "{\"error\":\"Failed to print test receipt\"}";
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

        private ReceiptData ParseReceiptJson(string json)
        {
            // Enhanced JSON parsing for POS system compatibility
            try
            {
                Console.WriteLine("ParseReceiptJson: Starting to parse JSON: " + json.Substring(0, Math.Min(200, json.Length)) + "...");
                
                ReceiptData receipt = new ReceiptData();
                
                // Extract basic fields - try both orderId and saleNumber
                receipt.OrderId = GetFirstNonNull(ExtractJsonString(json, "orderId"), ExtractJsonString(json, "sale_number"));
                receipt.SaleNumber = GetFirstNonNull(ExtractJsonString(json, "sale_number"), ExtractJsonString(json, "saleNumber"), receipt.OrderId);
                receipt.Notes = ExtractJsonString(json, "notes");
                receipt.PaymentStatus = GetFirstNonNull(ExtractJsonString(json, "payment_status"), ExtractJsonString(json, "paymentStatus"));
                
                Console.WriteLine("ParseReceiptJson: OrderId = " + receipt.OrderId + ", SaleNumber = " + receipt.SaleNumber + ", Notes = " + receipt.Notes);
                
                // Extract customer info
                string customerName = GetFirstNonNull(ExtractJsonString(json, "customer_name"), ExtractJsonString(json, "customerName"));
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
                    
                    string customerPhone = GetFirstNonNull(ExtractJsonString(json, "customer_phone"), ExtractJsonString(json, "customerPhone"));
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
                    
                    Console.WriteLine("ParseReceiptJson: Customer = " + customerName + ", Phone = " + customerPhone);
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
                
                // Extract decimal values with multiple naming options
                ParseDecimalField(json, receipt, "subtotal");
                ParseDecimalField(json, receipt, "tax", "tax_amount", "taxAmount");
                ParseDecimalField(json, receipt, "total", "total_amount", "totalAmount");
                ParseDecimalField(json, receipt, "discount", "discount_amount", "discountAmount");
                ParseDecimalField(json, receipt, "shipping_cost", "shippingCost");
                ParseDecimalField(json, receipt, "received_amount", "receivedAmount");
                ParseDecimalField(json, receipt, "change_amount", "changeAmount");
                
                // Extract payment info - handle both single payment and payments array
                ParsePayments(json, receipt);
                
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
                            case "shippingcost":
                                receipt.ShippingCost = value;
                                break;
                            case "receivedamount":
                                receipt.ReceivedAmount = value;
                                break;
                            case "changeamount":
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
                // Fallback to single payment object
                int paymentStart = json.IndexOf("\"payment\"");
                if (paymentStart > -1)
                {
                    string paymentSection = json.Substring(paymentStart);
                    string paymentMethod = GetFirstNonNull(
                        ExtractJsonString(paymentSection, "method"),
                        ExtractJsonString(paymentSection, "payment_method"),
                        ExtractJsonString(paymentSection, "paymentMethod"));
                    if (!string.IsNullOrEmpty(paymentMethod))
                    {
                        receipt.Payment = new PaymentInfo { Method = paymentMethod, PaymentMethod = paymentMethod };
                        
                        string amountPaidStr = GetFirstNonNull(
                            ExtractJsonString(paymentSection, "amountPaid"),
                            ExtractJsonString(paymentSection, "amount_paid"),
                            ExtractJsonString(paymentSection, "amount"));
                        if (!string.IsNullOrEmpty(amountPaidStr))
                        {
                            decimal amountPaid;
                            if (decimal.TryParse(amountPaidStr, out amountPaid))
                            {
                                receipt.Payment.AmountPaid = amountPaid;
                                receipt.Payment.Amount = amountPaid;
                            }
                        }
                        
                        string changeStr = ExtractJsonString(paymentSection, "change");
                        if (!string.IsNullOrEmpty(changeStr))
                        {
                            decimal change;
                            if (decimal.TryParse(changeStr, out change))
                                receipt.Payment.Change = change;
                        }
                        
                        receipt.Payments.Add(receipt.Payment);
                    }
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
                    ExtractJsonValue(fullItemJson, "price"),
                    ExtractJsonValue(fullItemJson, "unit_price"),
                    ExtractJsonValue(fullItemJson, "unitPrice"));
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
                    ExtractJsonValue(fullItemJson, "total"),
                    ExtractJsonValue(fullItemJson, "line_total"),
                    ExtractJsonValue(fullItemJson, "lineTotal"));
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
                
                // Parse discount amount
                string discountStr = GetFirstNonNull(
                    ExtractJsonValue(fullItemJson, "discount_amount"),
                    ExtractJsonValue(fullItemJson, "discountAmount"));
                if (!string.IsNullOrEmpty(discountStr))
                {
                    decimal discount;
                    if (decimal.TryParse(discountStr, out discount))
                    {
                        item.DiscountAmount = discount;
                        Console.WriteLine("ParseReceiptItem: discount = " + discount);
                    }
                }
                
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
