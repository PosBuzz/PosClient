using Microsoft.Win32;
using System;
using System.IO;
using System.Reflection;

namespace Printer
{
    public static class StartupManager
    {
        private const string AppName = "PosBuzzPrintServer";
        private const string RegistryPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

        public static bool IsStartupEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath, false))
                {
                    return key?.GetValue(AppName) != null;
                }
            }
            catch
            {
                return false;
            }
        }

        public static void EnableStartup()
        {
            try
            {
                string executablePath = Assembly.GetExecutingAssembly().Location;
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath, true))
                {
                    // No arguments needed since default behavior is now tray mode
                    key?.SetValue(AppName, $"\"{executablePath}\"");
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to enable startup: " + ex.Message);
            }
        }

        public static void DisableStartup()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath, true))
                {
                    key?.DeleteValue(AppName, false);
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to disable startup: " + ex.Message);
            }
        }

        public static void ToggleStartup()
        {
            if (IsStartupEnabled())
            {
                DisableStartup();
            }
            else
            {
                EnableStartup();
            }
        }
    }
}
