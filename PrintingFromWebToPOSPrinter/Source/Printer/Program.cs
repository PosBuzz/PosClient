// Copyright © 2018 Dmitry Sikorsky. All rights reserved.
// Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.

using System;
using System.Windows.Forms;
using Printer.Services;
using Printer.Models;
using System.Runtime.InteropServices;

namespace Printer
{
  class Program
  {
    // Import Windows API functions for console allocation
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool AllocConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool FreeConsole();

    [STAThread]
    static void Main(string[] args)
    {
      // Load config first
      var config = ConfigManager.GetConfig();
      
      // Check if we should start in console mode (for debugging or specific commands)
      bool consoleMode = false;
      
      if (args != null && args.Length > 0)
      {
        string command = args[0].ToLower();
        
        if (command == "console" || command == "--console" || command == "-console")
        {
          consoleMode = true;
        }
        else if (command == "setup")
        {
          AllocConsole();
          PrinterUtility.CreateTestPrinterConfig();
          Console.WriteLine("Press any key to exit...");
          Console.ReadKey();
          FreeConsole();
          return;
        }
        else if (command == "printers")
        {
          AllocConsole();
          PrinterUtility.ListAvailablePrinters();
          Console.WriteLine("Press any key to exit...");
          Console.ReadKey();
          FreeConsole();
          return;
        }
        else if (args[0].StartsWith("print://") || args[0].StartsWith("{"))
        {
          // Handle print request in background
          HandlePrintRequest(args[0], config);
          return;
        }
      }
      
      // Default behavior: Start in system tray mode with auto-started server
      if (!consoleMode)
      {
        try
        {
          Application.EnableVisualStyles();
          Application.SetCompatibleTextRenderingDefault(false);
          
          var trayManager = new SystemTrayManager();
          trayManager.Run();
        }
        catch (Exception ex)
        {
          // Show error in message box since no console is available
          MessageBox.Show($"Error starting application: {ex.Message}", "PosBuzz Print Server Error", 
                         MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        return;
      }
      
      // Console mode (only when explicitly requested)
      AllocConsole();
      Console.WriteLine("=== POS Receipt Printer ===");
      Console.WriteLine("Auto-starting HTTP server...");
      
      try
      {
        StartHttpServer();
        
        Console.WriteLine("HTTP server is running. Press 'c' to configure, 't' to test, 'y' for system tray, 'p' for printers, 'q' to quit:");
        
        // Interactive mode with server running
        while (true)
        {
          var input = Console.ReadLine();
          
          if (string.IsNullOrEmpty(input))
            continue;
            
          if (input.ToLower() == "q")
          {
            Console.WriteLine("Goodbye!");
            break;
          }
          else if (input.ToLower() == "c")
          {
            ShowConfigMenu(config);
          }
          else if (input.ToLower() == "t")
          {
            TestPrint(config);
          }
          else if (input.ToLower() == "s")
          {
            Console.WriteLine("HTTP server is already running!");
          }
          else if (input.ToLower() == "y")
          {
            // Switch to system tray mode
            Console.WriteLine("Switching to system tray mode...");
            FreeConsole();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            var trayManager = new SystemTrayManager();
            trayManager.Run();
            break;
          }
          else if (input.ToLower() == "p")
          {
            PrinterUtility.ListAvailablePrinters();
          }
          else if (input.StartsWith("print://") || input.StartsWith("{"))
          {
            HandlePrintRequest(input, config);
          }
          else
          {
            Console.WriteLine("Commands: 'c' (configure), 't' (test), 's' (server status), 'y' (system tray), 'p' (printers), 'q' (quit)");
            Console.WriteLine("Or provide JSON receipt data or print:// URL");
          }
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error: {ex.Message}");
        Console.WriteLine("Press any key to exit...");
        Console.ReadKey();
      }
      finally
      {
        FreeConsole();
      }
    }
    
    private static void HandlePrintRequest(string input, StoreConfig config)
    {
      try
      {
        if (input.StartsWith("print://"))
        {
          // Legacy mode - just print order ID
          var orderId = input.Replace("print://", "").Replace("/", "");
          Console.WriteLine("Processing print request: " + input);
          new ReceiptPrint().Print(config.PrinterName, orderId);
        }
        else if (input.StartsWith("{"))
        {
          // JSON mode - parse and print dynamic receipt
          Console.WriteLine("Processing JSON receipt data...");
          var receiptData = ParseSimpleJson(input);
          if (receiptData != null)
          {
            var printer = new SimpleReceiptPrint();
            printer.Print(config.PrinterName, receiptData);
          }
          else
          {
            Console.WriteLine("Error: Could not parse JSON data");
          }
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine("Error processing print request: " + ex.Message);
      }
    }
    
    private static void ShowConfigMenu(StoreConfig config)
    {
      Console.WriteLine("\n" + new string('=', 50));
      Console.WriteLine("CONFIGURATION");
      Console.WriteLine(new string('=', 50));
      
      Console.WriteLine("Store Name: " + config.StoreName);
      Console.WriteLine("Address: " + config.Address);
      Console.WriteLine("Phone: " + config.Phone);
      Console.WriteLine("Email: " + config.Email);
      Console.WriteLine("Logo Path: " + config.LogoPath);
      Console.WriteLine("Printer: " + config.PrinterName);
      Console.WriteLine("Cash Drawer: " + (config.EnableCashDrawer ? "Enabled" : "Disabled"));
      Console.WriteLine("Currency: " + config.Currency);
      
      Console.WriteLine("\nTo modify settings, edit the 'store-config.txt' file");
      Console.WriteLine(new string('=', 50) + "\n");
    }
    
    private static void TestPrint(StoreConfig config)
    {
      Console.WriteLine("Printing test receipt...");
      
      try
      {
        var testData = new ReceiptData();
        testData.OrderId = "TEST-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
        testData.OrderDate = DateTime.Now;
        
        testData.Customer = new CustomerInfo();
        testData.Customer.Name = "Test Customer";
        testData.Customer.Phone = "(555) 123-4567";
        
        testData.Items.Add(new ReceiptItem 
        { 
          Name = "Test Item 1", 
          Description = "Sample product",
          Quantity = 2, 
          Price = 15.50m, 
          Total = 31.00m 
        });
        
        testData.Items.Add(new ReceiptItem 
        { 
          Name = "Test Item 2", 
          Quantity = 1, 
          Price = 8.99m, 
          Total = 8.99m 
        });
        
        testData.Subtotal = 39.99m;
        testData.Tax = 3.20m;
        testData.Discount = 2.00m;
        testData.Total = 41.19m;
        
        testData.Payment = new PaymentInfo();
        testData.Payment.Method = "Cash";
        testData.Payment.AmountPaid = 50.00m;
        testData.Payment.Change = 8.81m;
        
        testData.Notes = "Thank you for testing our POS system!";
        testData.OpenCashDrawer = true;

        var printer = new SimpleReceiptPrint();
        var success = printer.Print(config.PrinterName, testData);
        
        if (success)
        {
          Console.WriteLine("✓ Test receipt printed successfully!");
        }
        else
        {
          Console.WriteLine("✗ Failed to print test receipt");
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine("✗ Error printing test receipt: " + ex.Message);
      }
    }
    
    // Simple JSON parser for basic receipt data (no external dependencies)
    private static ReceiptData ParseSimpleJson(string json)
    {
      try
      {
        var data = new ReceiptData();
        
        // Very basic JSON parsing - for production use a proper JSON library
        if (json.Contains("\"orderId\""))
        {
          var start = json.IndexOf("\"orderId\":\"") + 11;
          var end = json.IndexOf("\"", start);
          if (end > start) data.OrderId = json.Substring(start, end - start);
        }
        
        if (json.Contains("\"total\""))
        {
          var start = json.IndexOf("\"total\":") + 8;
          var end = json.IndexOfAny(new char[] { ',', '}' }, start);
          if (end > start) 
          {
            var totalStr = json.Substring(start, end - start).Trim();
            decimal total;
            if (decimal.TryParse(totalStr, out total))
            {
              data.Total = total;
            }
          }
        }
        
        // Add basic customer info if present
        if (json.Contains("\"customer\""))
        {
          data.Customer = new CustomerInfo();
          if (json.Contains("\"name\""))
          {
            var start = json.IndexOf("\"name\":\"") + 8;
            var end = json.IndexOf("\"", start);
            if (end > start) data.Customer.Name = json.Substring(start, end - start);
          }
        }
        
        return data;
      }
      catch
      {
        return null;
      }
    }

    private static void StartHttpServer()
    {
      try
      {
        HttpPrintServer server = new HttpPrintServer();
        server.Start(8080);
        
        // Wait for quit command
        while (true)
        {
          string input = Console.ReadLine();
          if (input != null && input.ToLower() == "q")
          {
            server.Stop();
            break;
          }
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine("Error starting HTTP server: " + ex.Message);
      }
    }
  }
}