using System;
using System.IO;
using System.Net;
using System.Text;
using Newtonsoft.Json;
using System.Threading.Tasks;
using Printer.Models;
using Printer.Services;

namespace Printer.Services
{
    public class PrintServer
    {
        private HttpListener _listener;
        private bool _isRunning;
        private readonly StoreConfig _config;

        public PrintServer()
        {
            _config = ConfigManager.GetConfig();
        }

        public async Task StartAsync()
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{_config.Port}/");
                _listener.Start();
                _isRunning = true;

                Console.WriteLine($"Print Server started on port {_config.Port}");
                Console.WriteLine($"Ready to receive print requests at: http://localhost:{_config.Port}/print");
                Console.WriteLine("Press 'q' to quit or 'c' to configure settings");

                while (_isRunning)
                {
                    try
                    {
                        var context = await _listener.GetContextAsync();
                        _ = Task.Run(() => ProcessRequest(context));
                    }
                    catch (HttpListenerException)
                    {
                        if (_isRunning)
                        {
                            Console.WriteLine("Listener stopped unexpectedly");
                        }
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error starting server: {ex.Message}");
            }
        }

        private async Task ProcessRequest(HttpListenerContext context)
        {
            var request = context.Request;
            var response = context.Response;

            try
            {
                // Add CORS headers for web applications
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

                if (request.HttpMethod == "OPTIONS")
                {
                    response.StatusCode = 200;
                    response.Close();
                    return;
                }

                string responseString = "";

                if (request.Url.AbsolutePath == "/print" && request.HttpMethod == "POST")
                {
                    responseString = await HandlePrintRequest(request);
                }
                else if (request.Url.AbsolutePath == "/config" && request.HttpMethod == "GET")
                {
                    responseString = HandleConfigRequest();
                }
                else if (request.Url.AbsolutePath == "/config" && request.HttpMethod == "POST")
                {
                    responseString = await HandleConfigUpdate(request);
                }
                else if (request.Url.AbsolutePath == "/printers" && request.HttpMethod == "GET")
                {
                    responseString = HandlePrintersRequest();
                }
                else if (request.Url.AbsolutePath == "/test" && request.HttpMethod == "POST")
                {
                    responseString = HandleTestPrint();
                }
                else
                {
                    response.StatusCode = 404;
                    responseString = JsonConvert.SerializeObject(new { error = "Endpoint not found" });
                }

                byte[] buffer = Encoding.UTF8.GetBytes(responseString);
                response.ContentType = "application/json";
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                response.Close();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error processing request: {ex.Message}");
                try
                {
                    response.StatusCode = 500;
                    var errorResponse = JsonConvert.SerializeObject(new { error = ex.Message });
                    byte[] errorBuffer = Encoding.UTF8.GetBytes(errorResponse);
                    response.ContentType = "application/json";
                    response.ContentLength64 = errorBuffer.Length;
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    response.Close();
                }
                catch { }
            }
        }

        private async Task<string> HandlePrintRequest(HttpListenerRequest request)
        {
            try
            {
                using (var reader = new StreamReader(request.InputStream))
                {
                    var json = await reader.ReadToEndAsync();
                    var receiptData = JsonConvert.DeserializeObject<ReceiptData>(json);
                    
                    var printer = new SimpleReceiptPrint();
                    var success = printer.Print(_config.PrinterName, receiptData);
                    
                    return JsonConvert.SerializeObject(new { 
                        success = success, 
                        message = success ? "Receipt printed successfully" : "Failed to print receipt",
                        orderId = receiptData.OrderId
                    });
                }
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message });
            }
        }

        private string HandleConfigRequest()
        {
            return JsonConvert.SerializeObject(_config);
        }

        private async Task<string> HandleConfigUpdate(HttpListenerRequest request)
        {
            try
            {
                using (var reader = new StreamReader(request.InputStream))
                {
                    var json = await reader.ReadToEndAsync();
                    var newConfig = JsonConvert.DeserializeObject<StoreConfig>(json);
                    ConfigManager.UpdateConfig(newConfig);
                    return JsonConvert.SerializeObject(new { success = true, message = "Configuration updated successfully" });
                }
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message });
            }
        }

        private string HandlePrintersRequest()
        {
            try
            {
                var printers = System.Drawing.Printing.PrinterSettings.InstalledPrinters;
                var printerList = new string[printers.Count];
                printers.CopyTo(printerList, 0);
                return JsonConvert.SerializeObject(new { printers = printerList });
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { error = ex.Message });
            }
        }

        private string HandleTestPrint()
        {
            try
            {
                var testData = new ReceiptData
                {
                    OrderId = "TEST-" + DateTime.Now.ToString("yyyyMMdd-HHmmss"),
                    OrderDate = DateTime.Now,
                    Customer = new CustomerInfo { Name = "Test Customer", Phone = "(555) 123-4567" },
                    Items = new System.Collections.Generic.List<ReceiptItem>
                    {
                        new ReceiptItem { Name = "Test Item 1", Quantity = 1, Price = 10.00m, Total = 10.00m },
                        new ReceiptItem { Name = "Test Item 2", Quantity = 2, Price = 5.50m, Total = 11.00m }
                    },
                    Subtotal = 21.00m,
                    Tax = 1.68m,
                    Total = 22.68m,
                    Payment = new PaymentInfo { Method = "Cash", AmountPaid = 25.00m, Change = 2.32m },
                    OpenCashDrawer = true
                };

                var printer = new SimpleReceiptPrint();
                var success = printer.Print(_config.PrinterName, testData);
                
                return JsonConvert.SerializeObject(new { 
                    success = success, 
                    message = success ? "Test receipt printed successfully" : "Failed to print test receipt",
                    orderId = testData.OrderId
                });
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message });
            }
        }

        public void Stop()
        {
            _isRunning = false;
            _listener?.Stop();
            _listener?.Close();
            Console.WriteLine("Print Server stopped");
        }
    }
}
