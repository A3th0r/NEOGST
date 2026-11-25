; Inno Setup script — builds GCReturnsPro-Setup.exe (compiled by GitHub Actions)
#ifndef MyVersion
  #define MyVersion "2.7.31"
#endif
#define SiteUrl "https://a3th0r.github.io/NEOGST/"

[Setup]
AppId={{6F1C2E0B-4C0A-4E6B-9C33-7A0E5D1B2A11}
AppName=GC Returns Pro (Website Bridge)
AppVersion={#MyVersion}
AppPublisher=Gaddam Chiranjeevi
DefaultDirName={localappdata}\GCReturnsPro
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=GCReturnsPro-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=GC Returns Pro (Website Bridge)
DisableWelcomePage=no

[Files]
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{userprograms}\GC Returns Pro website"; Filename: "{#SiteUrl}"

[Run]
; 1) copy the extension folder path to the clipboard so it can be pasted in "Load unpacked"
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -Command ""Set-Clipboard -Value '{app}\extension'"""; Flags: runhidden
; 2) open the browser's extensions page
Filename: "{code:BrowserExe}"; Parameters: "{code:ExtensionsUrl}"; Description: "Open the browser extensions page now"; Flags: postinstall nowait skipifsilent; Check: HasBrowser

[Messages]
FinishedLabel=The extension files are installed in:%n%n{app}\extension%n%nThe folder path has been copied to your clipboard.%n%nLast step (one time only, done in your browser):%n  1. On the extensions page, turn ON "Developer mode" (top right).%n  2. Click "Load unpacked".%n  3. Paste the path (Ctrl+V) and press "Select Folder".%n%nThen open the website: {#SiteUrl}

[Code]
var
  Exe, Url: string;

function FindBrowser(): Boolean;
var
  P: string;
begin
  Result := True;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe', '', P) or
     RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe', '', P) then
  begin Exe := P; Url := 'chrome://extensions'; exit; end;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe', '', P) or
     RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe', '', P) then
  begin Exe := P; Url := 'edge://extensions'; exit; end;
  Result := False;
end;

function HasBrowser(): Boolean; begin Result := FindBrowser(); end;
function BrowserExe(Param: string): string; begin FindBrowser(); Result := Exe; end;
function ExtensionsUrl(Param: string): string; begin FindBrowser(); Result := Url; end;
