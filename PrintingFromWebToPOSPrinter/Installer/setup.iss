; Inno Setup Script for PosBuzz Print Server
; This script creates a Windows installer for the POS receipt printer application

#define MyAppName "PosBuzz Print Server"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PosBuzz"
#define MyAppURL "https://posbuzz.com"
#define MyAppExeName "Printer.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
AppId={{12345678-1234-1234-1234-123456789012}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
OutputDir=Output
OutputBaseFilename=PosBuzzPrintServer_Setup
SetupIconFile=
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
; Run the application after installation
RunAfterInstall=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Start with Windows (system tray)"; GroupDescription: "Startup Options:"; Flags: checked

[Files]
Source: "..\Printer\bin\Debug\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Printer\bin\Debug\*.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Printer\bin\Debug\*.config"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Printer\bin\Debug\*.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{#MyAppName} (Console Mode)"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"
Name: "{group}\Configure {#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Add to Windows startup if selected
Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"; WorkingDir: "{app}"; Flags: nowait postinstall runascurrentuser; Description: "Configure the print server"; Check: not IsTaskSelected('startup')
Filename: "reg"; Parameters: "add ""HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"" /v ""PosBuzzPrintServer"" /t REG_SZ /d ""\""{app}\{#MyAppExeName}\"""" /f"; Flags: runhidden; Tasks: startup
; Start the application in system tray mode
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Flags: nowait postinstall runasoriginaluser; Description: "Start PosBuzz Print Server"; Check: IsTaskSelected('startup')

[UninstallRun]
; Remove from Windows startup
Filename: "reg"; Parameters: "delete ""HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"" /v ""PosBuzzPrintServer"" /f"; Flags: runhidden

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Additional post-install tasks can be added here
  end;
end;

function IsTaskSelected(TaskName: String): Boolean;
begin
  Result := IsTaskSelected2(TaskName);
end;
