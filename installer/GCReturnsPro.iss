; Inno Setup script — builds GCReturnsPro-Setup.exe (compiled by GitHub Actions)
;
; Compile:   iscc GCReturnsPro.iss
; Options:   /DExtId=<32-char id>        (defaults to the ID derived from manifest.json "key")
;            /DEdgeExtId=<id>            (only if the Edge Add-ons ID differs; WebStore mode)
;            /DUpdateXmlUrl=<url>        (self-hosted update.xml)
;            /DWebStore=1                (force-install from Chrome Web Store / Edge Add-ons)
;
; IMPORTANT - self-hosted vs Web Store:
;   Chrome, Edge and Brave on Windows IGNORE force-install of off-store extensions
;   (update.xml + .crx) unless the PC is domain-joined / MDM- or CBCM-managed.
;   On ordinary home/office PCs use /DWebStore=1 (publish the extension as
;   "Unlisted" on the Chrome Web Store) - that works on every Windows PC.

#ifndef MyVersion
  #define MyVersion "2.8.31"
#endif
#ifndef ExtId
  #define ExtId "jgbigkbpalolljkpdccfkpagjghcpkol"
#endif
#ifndef EdgeExtId
  #define EdgeExtId ExtId
#endif
#ifndef UpdateXmlUrl
  #define UpdateXmlUrl "https://a3th0r.github.io/NEOGST/extension/update.xml"
#endif

#ifdef WebStore
  #define ChromeUpdateUrl "https://clients2.google.com/service/update2/crx"
  #define EdgeUpdateUrl   "https://edge.microsoft.com/extensionwebstorebase/v1/crx"
#else
  #define ChromeUpdateUrl UpdateXmlUrl
  #define EdgeUpdateUrl   UpdateXmlUrl
#endif

#define SiteUrl       "https://a3th0r.github.io/NEOGST/"
#define AllowedOrigin "https://a3th0r.github.io/*"

[Setup]
AppId={{6F1C2E0B-4C0A-4E6B-9C33-7A0E5D1B2A11}
AppName=GC Returns Pro (Website Bridge)
AppVersion={#MyVersion}
AppPublisher=Gaddam Chiranjeevi
DefaultDirName={autopf}\GCReturnsPro
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=GCReturnsPro-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=GC Returns Pro (Website Bridge)
DisableWelcomePage=no
LicenseFile=consent.txt

[Files]
Source: "consent.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\GC Returns Pro website"; Filename: "{#SiteUrl}"

[Run]
Filename: "{#SiteUrl}"; Description: "Open GC Returns Pro website"; Flags: postinstall shellexec nowait skipifsilent

[Messages]
WizardLicense=User Consent
LicenseLabel=Please read this consent policy carefully.
LicenseLabel3=GC Returns Pro will automatically install a browser extension in Google Chrome, Microsoft Edge and Brave using enterprise policy. The extension accesses the GST portal and its cookies on your behalf. If you do not consent, setup will exit and nothing will be installed.
LicenseAccepted=I &consent to installing the extension and to it accessing the GST portal and its cookies
LicenseNotAccepted=I do &not consent (exit setup)
FinishedLabel=GC Returns Pro is installed.%n%nThe extension will appear automatically in Chrome, Edge and Brave within a minute (restart the browser if it is already open). It will show as "Installed by your administrator".%n%nTo remove it, uninstall "GC Returns Pro" from Windows Settings > Apps.%n%nWebsite: {#SiteUrl}

[Code]
const
  ChromeForceKey  = 'SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist';
  EdgeForceKey    = 'SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist';
  BraveForceKey   = 'SOFTWARE\Policies\BraveSoftware\Brave\ExtensionInstallForcelist';

  ChromeSourceKey = 'SOFTWARE\Policies\Google\Chrome\ExtensionInstallSources';
  EdgeSourceKey   = 'SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallSources';
  BraveSourceKey  = 'SOFTWARE\Policies\BraveSoftware\Brave\ExtensionInstallSources';

var
  Declined: Boolean;

{ Brave uses the Chrome Web Store, so it shares the Chrome entry }
function ChromeEntry: string;
begin
  Result := '{#ExtId};{#ChromeUpdateUrl}';
end;

function EdgeEntry: string;
begin
  Result := '{#EdgeExtId};{#EdgeUpdateUrl}';
end;

{ Self-hosted mode only: is update.xml actually downloadable? }
function UpdateXmlReachable: Boolean;
var
  Req: Variant;
begin
  Result := False;
  try
    Req := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Req.Open('GET', '{#UpdateXmlUrl}', False);
    Req.SetTimeouts(5000, 5000, 5000, 10000);
    Req.Send('');
    Result := (Req.Status = 200);
    Log('update.xml HTTP status: ' + IntToStr(Req.Status));
  except
    Log('update.xml check failed: ' + GetExceptionMessage);
  end;
end;

{ Adds an entry to a numbered policy list (1, 2, 3...) without overwriting other entries.
  Existing entry with the same prefix is replaced; otherwise the first free slot is used. }
procedure AddNumberedPolicy(SubKey, Entry, MatchPrefix: string);
var
  I, FreeSlot: Integer;
  V: string;
begin
  FreeSlot := 0;
  for I := 1 to 1000 do
  begin
    if RegQueryStringValue(HKLM64, SubKey, IntToStr(I), V) then
    begin
      if Pos(LowerCase(MatchPrefix), LowerCase(V)) = 1 then
      begin
        RegWriteStringValue(HKLM64, SubKey, IntToStr(I), Entry);
        exit;
      end;
    end
    else if FreeSlot = 0 then
      FreeSlot := I;
  end;
  if FreeSlot = 0 then FreeSlot := 1001;
  RegWriteStringValue(HKLM64, SubKey, IntToStr(FreeSlot), Entry);
end;

{ Removes matching entry from a numbered policy list and deletes the key if empty }
procedure RemoveNumberedPolicy(SubKey, MatchPrefix: string);
var
  Names: TArrayOfString;
  I: Integer;
  V: string;
begin
  if not RegGetValueNames(HKLM64, SubKey, Names) then exit;
  for I := 0 to GetArrayLength(Names) - 1 do
    if RegQueryStringValue(HKLM64, SubKey, Names[I], V) and
       (Pos(LowerCase(MatchPrefix), LowerCase(V)) = 1) then
      RegDeleteValue(HKLM64, SubKey, Names[I]);
  RegDeleteKeyIfEmpty(HKLM64, SubKey);
end;

{ Silent installs skip the consent page, so require explicit /CONSENT=YES }
function InitializeSetup: Boolean;
begin
  Result := True;
  if WizardSilent and (UpperCase(ExpandConstant('{param:CONSENT|NO}')) <> 'YES') then
  begin
    Log('Silent install aborted: /CONSENT=YES not supplied.');
    Result := False;
  end;
end;

procedure DeclineClick(Sender: TObject);
begin
  if (WizardForm.CurPageID = wpLicense) and WizardForm.LicenseNotAcceptedRadio.Checked then
  begin
    Declined := True;
    MsgBox('You did not give consent. Setup will now exit and nothing has been installed.',
           mbInformation, MB_OK);
    WizardForm.Close;
  end;
end;

procedure InitializeWizard;
begin
  Declined := False;
  WizardForm.LicenseNotAcceptedRadio.OnClick := @DeclineClick;
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if Declined then
  begin
    Cancel := True;
    Confirm := False;
  end;
end;

{ Enterprise policies are written only after consent, at the end of installation }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
#ifndef WebStore
    { 1. Allow self-hosted downloads from your domain }
    AddNumberedPolicy(ChromeSourceKey, '{#AllowedOrigin}', '{#AllowedOrigin}');
    AddNumberedPolicy(EdgeSourceKey,   '{#AllowedOrigin}', '{#AllowedOrigin}');
    AddNumberedPolicy(BraveSourceKey,  '{#AllowedOrigin}', '{#AllowedOrigin}');
#endif

    { 2. Force-install the extension }
    AddNumberedPolicy(ChromeForceKey, ChromeEntry, '{#ExtId}');
    AddNumberedPolicy(EdgeForceKey,   EdgeEntry,   '{#EdgeExtId}');
    AddNumberedPolicy(BraveForceKey,  ChromeEntry, '{#ExtId}');

#ifndef WebStore
    if (not WizardSilent) and (not UpdateXmlReachable) then
      MsgBox('The policies were written, but the extension update file could not be downloaded:' + #13#10 +
             '{#UpdateXmlUrl}' + #13#10#13#10 +
             'Check your internet connection and that the file is published. ' +
             'Open chrome://policy and chrome://extensions to see the status.',
             mbError, MB_OK);
#endif
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    RemoveNumberedPolicy(ChromeForceKey,  '{#ExtId}');
    RemoveNumberedPolicy(EdgeForceKey,    '{#EdgeExtId}');
    RemoveNumberedPolicy(BraveForceKey,   '{#ExtId}');

    RemoveNumberedPolicy(ChromeSourceKey, '{#AllowedOrigin}');
    RemoveNumberedPolicy(EdgeSourceKey,   '{#AllowedOrigin}');
    RemoveNumberedPolicy(BraveSourceKey,  '{#AllowedOrigin}');
  end;
end;
