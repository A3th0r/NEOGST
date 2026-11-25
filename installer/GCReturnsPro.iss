; Inno Setup script — builds GCReturnsPro-Setup.exe (compiled by GitHub Actions)
; Compile with:  iscc /DExtId=<32-char Chrome Web Store ID> GCReturnsPro.iss
; Optional:      /DEdgeExtId=<Edge Add-ons ID>  (otherwise Edge uses the Chrome Web Store copy)
#ifndef MyVersion
  #define MyVersion "2.8.0"
#endif
#ifndef ExtId
  #error ExtId is required: publish the extension (Unlisted is fine) on the Chrome Web Store and pass /DExtId=...
#endif
#define SiteUrl "https://a3th0r.github.io/NEOGST/"
#define CwsUrl  "https://clients2.google.com/service/update2/crx"
#define EdgeUrl "https://edge.microsoft.com/extensionwebstorebase/v1/crx"

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
LicenseLabel3=GC Returns Pro will automatically install a browser extension in Google Chrome, Microsoft Edge and Brave. The extension accesses the GST portal and its cookies on your behalf. If you do not consent, setup will exit and nothing will be installed.
LicenseAccepted=I &consent to installing the extension and to it accessing the GST portal and its cookies
LicenseNotAccepted=I do &not consent (exit setup)
FinishedLabel=GC Returns Pro is installed.%n%nThe extension will appear automatically in Chrome, Edge and Brave within a minute (restart the browser if it is already open). It will show as "Installed by your administrator".%n%nTo remove it, uninstall "GC Returns Pro" from Windows Settings > Apps.%n%nWebsite: {#SiteUrl}

[Code]
const
  ChromeKey = 'SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist';
  EdgeKey   = 'SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist';
  BraveKey  = 'SOFTWARE\Policies\BraveSoftware\Brave\ExtensionInstallForcelist';

var
  Declined: Boolean;

function CwsEntry: string;
begin
  Result := '{#ExtId};{#CwsUrl}';
end;

function EdgeEntry: string;
begin
#ifdef EdgeExtId
  Result := '{#EdgeExtId};{#EdgeUrl}';
#else
  Result := '{#ExtId};{#CwsUrl}';
#endif
end;

function EntryId(Entry: string): string;
begin
  Result := Copy(Entry, 1, Pos(';', Entry) - 1);
end;

{ Adds our entry without overwriting other force-installed extensions.
  Reuses our own slot if present, otherwise takes the first free number. }
procedure AddForcelist(SubKey, Entry: string);
var
  I: Integer;
  V: string;
begin
  for I := 1 to 1000 do
  begin
    if not RegQueryStringValue(HKLM64, SubKey, IntToStr(I), V) then
    begin
      RegWriteStringValue(HKLM64, SubKey, IntToStr(I), Entry);
      exit;
    end;
    if Pos(LowerCase(EntryId(Entry)), LowerCase(V)) = 1 then
    begin
      RegWriteStringValue(HKLM64, SubKey, IntToStr(I), Entry);
      exit;
    end;
  end;
end;

{ Removes only our entry; deletes the key if it ends up empty. }
procedure RemoveForcelist(SubKey, Id: string);
var
  Names: TArrayOfString;
  I: Integer;
  V: string;
begin
  if not RegGetValueNames(HKLM64, SubKey, Names) then exit;
  for I := 0 to GetArrayLength(Names) - 1 do
    if RegQueryStringValue(HKLM64, SubKey, Names[I], V) and
       (Pos(LowerCase(Id), LowerCase(V)) = 1) then
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

{ Policies are written only after consent, at the end of installation }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    AddForcelist(ChromeKey, CwsEntry);
    AddForcelist(EdgeKey,   EdgeEntry);
    AddForcelist(BraveKey,  CwsEntry);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    RemoveForcelist(ChromeKey, '{#ExtId}');
    RemoveForcelist(BraveKey,  '{#ExtId}');
#ifdef EdgeExtId
    RemoveForcelist(EdgeKey,   '{#EdgeExtId}');
#else
    RemoveForcelist(EdgeKey,   '{#ExtId}');
#endif
  end;
end;