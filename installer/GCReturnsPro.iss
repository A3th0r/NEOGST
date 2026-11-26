; Inno Setup script — GCReturnsPro-Setup.exe
; Opens the extension's Chrome Web Store / Edge Add-ons listing in whichever
; browsers are installed, so the user installs it with one normal click.
;
; WHY THIS APPROACH:
;   Chrome, Edge and Brave only allow silent/forced extension installs on
;   machines that are domain-joined (Active Directory) or enrolled in a cloud
;   management console (Chrome Browser Cloud Management / Intune). On an
;   ordinary, unmanaged PC there is no supported way to add an extension
;   without the user seeing and clicking the browser's own "Add extension?"
;   consent dialog — that dialog IS the install mechanism, not an obstacle.
;   This script gets the user to that dialog with the least possible friction.
;
; BEFORE COMPILING:
;   1. Publish the extension to the Chrome Web Store (Unlisted is fine) and
;      to the Microsoft Edge Add-ons store.
;   2. Fill in ChromeWebStoreId / EdgeAddonsId below with the IDs those stores
;      assign you (NOT your local manifest key-derived ID necessarily — use
;      the ID shown in your Chrome Web Store Developer Dashboard / Partner
;      Center listing URL).
;
; Compile:  iscc GCReturnsPro_WebStoreLauncher.iss

#define MyVersion "3.0.0"

; TODO: replace with your real published Web Store IDs
#define ChromeWebStoreId "jgbigkbpalolljkpdccfkpagjghcpkol"
#define EdgeAddonsId     "jgbigkbpalolljkpdccfkpagjghcpkol"

#define ChromeStoreUrl "https://chromewebstore.google.com/detail/" + ChromeWebStoreId
#define EdgeStoreUrl   "https://microsoftedge.microsoft.com/addons/detail/" + EdgeAddonsId
#define SiteUrl        "https://a3th0r.github.io/NEOGST/"

[Setup]
AppId={{6F1C2E0B-4C0A-4E6B-9C33-7A0E5D1B2A11}
AppName=GC Returns Pro
AppVersion={#MyVersion}
AppPublisher=Gaddam Chiranjeevi
DefaultDirName={autopf}\GCReturnsPro
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=GCReturnsPro-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=GC Returns Pro
LicenseFile=consent.txt

[Files]
Source: "consent.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\GC Returns Pro website"; Filename: "{#SiteUrl}"

[Messages]
WizardLicense=Before You Continue
LicenseLabel=Please read before continuing.
LicenseLabel3=GC Returns Pro is a browser extension that helps you work with the GST portal. After this setup finishes, your browser(s) will open to the extension's official store page (Chrome Web Store / Microsoft Edge Add-ons). You will need to click "Add to Chrome" / "Get" there to finish installing it — this one click is required by Chrome and Edge themselves and cannot be skipped.
LicenseAccepted=I &understand, continue
LicenseNotAccepted=&Cancel setup
FinishedLabel=Setup is nearly done.%n%nClick Finish and your browser(s) will open to the GC Returns Pro store page. Click "Add to Chrome" (or "Get" in Edge) to complete the install — it only takes a few seconds.%n%nWebsite: {#SiteUrl}

[Code]
function FileExistsOnDisk(Path: string): Boolean;
begin
  Result := FileExists(Path);
end;

function ChromePath: string;
begin
  Result := ExpandConstant('{pf}\Google\Chrome\Application\chrome.exe');
  if not FileExistsOnDisk(Result) then
    Result := ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe');
end;

function EdgePath: string;
begin
  Result := ExpandConstant('{pf}\Microsoft\Edge\Application\msedge.exe');
  if not FileExistsOnDisk(Result) then
    Result := ExpandConstant('{pf32}\Microsoft\Edge\Application\msedge.exe');
end;

function BravePath: string;
begin
  Result := ExpandConstant('{pf}\BraveSoftware\Brave-Browser\Application\brave.exe');
  if not FileExistsOnDisk(Result) then
    Result := ExpandConstant('{localappdata}\BraveSoftware\Brave-Browser\Application\brave.exe');
end;

procedure OpenStorePages;
var
  ResultCode: Integer;
  OpenedAny: Boolean;
begin
  OpenedAny := False;

  if FileExistsOnDisk(ChromePath) then
  begin
    Exec(ChromePath, '{#ChromeStoreUrl}', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    OpenedAny := True;
  end;

  if FileExistsOnDisk(BravePath) then
  begin
    { Brave uses the Chrome Web Store too }
    Exec(BravePath, '{#ChromeStoreUrl}', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    OpenedAny := True;
  end;

  if FileExistsOnDisk(EdgePath) then
  begin
    Exec(EdgePath, '{#EdgeStoreUrl}', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    OpenedAny := True;
  end;

  if not OpenedAny then
  begin
    { No supported browser detected — fall back to default browser via shell }
    ShellExec('open', '{#ChromeStoreUrl}', '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    OpenStorePages;
end;
