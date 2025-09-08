@echo off
echo Building PosBuzz Print Server Installer...
echo.

REM Build the application first
echo Step 1: Building the application...
cd /d "C:\projects\posbuzz\PrintingFromWebToPOSPrinter\Printer"
dotnet build --configuration Release
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build application
    pause
    exit /b 1
)

echo.
echo Step 2: Application built successfully!
echo.

REM Check if Inno Setup is installed
set "INNO_SETUP=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist "%INNO_SETUP%" (
    set "INNO_SETUP=C:\Program Files\Inno Setup 6\ISCC.exe"
)

if not exist "%INNO_SETUP%" (
    echo WARNING: Inno Setup not found. Please install Inno Setup 6 from https://jrsoftware.org/isdl.php
    echo.
    echo The application has been built and can be found in:
    echo %CD%\bin\Release\
    echo.
    echo You can run it directly from: %CD%\bin\Release\Printer.exe
    echo.
    pause
    exit /b 0
)

REM Build the installer
echo Step 3: Creating installer...
cd /d "C:\projects\posbuzz\PrintingFromWebToPOSPrinter\Installer"
"%INNO_SETUP%" setup.iss
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create installer
    pause
    exit /b 1
)

echo.
echo SUCCESS: Installer created successfully!
echo.
echo The installer can be found in:
echo %CD%\Output\PosBuzzPrintServer_Setup.exe
echo.
echo You can now distribute this installer to customers.
echo The application will automatically:
echo - Install to Program Files
echo - Add to Windows startup (optional)
echo - Run in system tray mode
echo - Auto-start the HTTP print server
echo.
pause
