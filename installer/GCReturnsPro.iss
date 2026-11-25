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
; 2) open the extensions page in every Chromium browser found on this PC
Filename: "{code:ExePath|chrome}";  Parameters: "chrome://extensions";  Description: "Open Google Chrome extensions page";  Flags: postinstall nowait skipifsilent; Check: Has('chrome')
Filename: "{code:ExePath|edge}";    Parameters: "edge://extensions";    Description: "Open Microsoft Edge extensions page"; Flags: postinstall nowait skipifsilent; Check: Has('edge')
Filename: "{code:ExePath|brave}";   Parameters: "brave://extensions";   Description: "Open Brave extensions page";           Flags: postinstall nowait skipifsilent; Check: Has('brave')
Filename: "{code:ExePath|vivaldi}"; Parameters: "vivaldi://extensions"; Description: "Open Vivaldi extensions page";         Flags: postinstall nowait skipifsilent; Check: Has('vivaldi')
Filename: "{code:ExePath|opera}";   Parameters: "opera://extensions";   Description: "Open Opera extensions page";           Flags: postinstall nowait skipifsilent; Check: Has('opera')

[Messages]
FinishedLabel=The extension files are installed in:%n%n{app}\extension%n%nThe folder path is copied to your clipboard. Tick each browser below to open its extensions page, then in EACH browser (one time only):%n  1. Turn ON "Developer mode".%n  2. Click "Load unpacked".%n  3. Paste the path (Ctrl+V) and select the folder.%n%nThen open: {#SiteUrl}

[Code]
function Probe(Key: string; Fallback: string): string;
var
  P: string;
begin
  Result := '';
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\' + Key, '', P) or
     RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\' + Key, '', P) then
    if FileExists(P) then begin Result := P; exit; end;
  if (Fallback <> '') and FileExists(ExpandConstant(Fallback)) then Result := ExpandConstant(Fallback);
end;

function ExePath(Name: string): string;
begin
  if Name = 'chrome' then Result := Probe('chrome.exe', '')
  else if Name = 'edge' then Result := Probe('msedge.exe', '')
  else if Name = 'brave' then Result := Probe('brave.exe', '{localappdata}\BraveSoftware\Brave-Browser\Application\brave.exe')
  else if Name = 'vivaldi' then Result := Probe('vivaldi.exe', '{localappdata}\Vivaldi\Application\vivaldi.exe')
  else if Name = 'opera' then Result := Probe('opera.exe', '{localappdata}\Programs\Opera\opera.exe')
  else Result := '';
end;

function Has(Name: string): Boolean;
begin
  Result := ExePath(Name) <> '';
end;
