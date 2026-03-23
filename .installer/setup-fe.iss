#define MyAppName "MonitTray-FE"
#define MyAppVersion "1.1.1"
#define MyAppPublisher "Cistem Innovacion"

; ============================================================
; MonitAgent FrontEnd Installer
; ============================================================

[Setup]
AppId={{COM.CISTEM.MONITTRAYFЕ}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputBaseFilename=MonitAgentFrontEndInstaller - v{#MyAppVersion}
OutputDir=C:\builds\MonitTray-FE
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
Uninstallable=yes
CreateUninstallRegKey=yes
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\MonitTray-FE.exe
DisableWelcomePage=no
SourceDir=C:\Users\CISTEM-MOISES\Documents\testing\monitor-tester\Monit-FrontEnd

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Dirs]
Name: "{app}"; Permissions: users-modify

[Files]
Source: ".installer\tray\bundle\win-unpacked\*"; DestDir: "{app}"; \
  Flags: ignoreversion recursesubdirs createallsubdirs
Source: "server.cjs";     DestDir: "{app}"; Flags: ignoreversion
Source: "server.js";      DestDir: "{app}"; Flags: ignoreversion
Source: "package.json";   DestDir: "{app}"; Flags: ignoreversion
Source: "vite.config.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.html";     DestDir: "{app}"; Flags: ignoreversion
Source: "dist\*"; DestDir: "{app}\dist"; \
  Flags: ignoreversion recursesubdirs createallsubdirs
Source: "src\*";  DestDir: "{app}\src"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKLM; Subkey: "SOFTWARE\Cistem Innovacion\MonitTray-FE"; \
  ValueType: string; ValueName: "InstallPath"; \
  ValueData: "{app}"; Flags: createvalueifdoesntexist uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\WOW6432Node\Cistem Innovacion\MonitTray-FE"; \
  ValueType: string; ValueName: "InstallPath"; \
  ValueData: "{app}"; Flags: createvalueifdoesntexist uninsdeletekey
; ── Inicio automático con Windows ──
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "MonitTray-FE"; \
  ValueData: """{app}\MonitTray-FE.exe"""; \
  Flags: uninsdeletevalue

[Run]
Filename: "cmd.exe"; \
  Parameters: "/c cd /d ""{app}"" && npm install"; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Instalando dependencias..."

Filename: "{app}\MonitTray-FE.exe"; \
  Flags: nowait postinstall skipifsilent runasoriginaluser; \
  Description: "Iniciar MonitAgent ahora"

[Icons]
Name: "{group}\MonitAgent Tray";        Filename: "{app}\MonitTray-FE.exe"
Name: "{group}\Desinstalar MonitAgent"; Filename: "{uninstallexe}"

[Code]

var
  PageUpload: TWizardPage;
  BtnBrowse: TButton;
  LblFilePath: TLabel;
  LblUploadHint: TLabel;
  LblValidation: TLabel;
  EnvFilePath: String;
  EnvFileLoaded: Boolean;

  PageEnv1: TWizardPage;
  cmbNodeEnv: TComboBox;
  edtBrand: TEdit;
  edtPathLogoBrand: TEdit;
  BtnLogoBrand: TButton;
  edtPathLogoCistem: TEdit;
  BtnLogoCistem: TButton;

  PageEnv2: TWizardPage;
  edtApiApp: TEdit;
  edtApiAuth: TEdit;
  edtAppPort: TEdit;

  PageEnv3: TWizardPage;
  edtHost: TEdit;
  LblHost: TLabel;        // ← nuevo
  edtTimeout: TEdit;
  cmbHttps: TComboBox;
  LblHttps: TLabel;       // ← nuevo
  edtSslCert: TEdit;
  LblSslCert: TLabel;     // ← nuevo
  BtnSslCert: TButton;
  edtSslKey: TEdit;
  LblSslKey: TLabel;      // ← nuevo
  BtnSslKey: TButton;

// ── Muestra u oculta los campos que NO aplican en development ──
procedure UpdateSslFieldsVisibility();
var IsProd: Boolean;
begin
  IsProd := cmbNodeEnv.ItemIndex = 0; // 0 = production

  LblHost.Visible    := IsProd;
  edtHost.Visible    := IsProd;

  LblHttps.Visible   := IsProd;
  cmbHttps.Visible   := IsProd;

  LblSslCert.Visible := IsProd;
  edtSslCert.Visible := IsProd;
  BtnSslCert.Visible := IsProd;

  LblSslKey.Visible  := IsProd;
  edtSslKey.Visible  := IsProd;
  BtnSslKey.Visible  := IsProd;
end;

procedure NodeEnvChange(Sender: TObject);
begin
  UpdateSslFieldsVisibility();
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  // Si el entorno es development, saltar la página 3 completa
  if (PageID = PageEnv3.ID) and (cmbNodeEnv.ItemIndex = 1) then
    Result := True;
end;

// ──────────────────────────────────────────────────────────────

function GetRequiredKeys(): TStringList;
var Keys: TStringList;
begin
  Keys := TStringList.Create;
  Keys.Add('VITE_BRAND');
  Keys.Add('VITE_COPYRIGHT');
  Keys.Add('VITE_NODE_ENV');
  Keys.Add('VITE_VERSION');
  Keys.Add('VITE_APP_PORT');
  Keys.Add('VITE_API_APP');
  Keys.Add('VITE_API_AUTH');
  Keys.Add('VITE_TIMEOUT');
  Result := Keys;
end;

function GetEnvValue(Content: TStringList; Key: String): String;
var I: Integer; Line, K, V: String; EqPos: Integer;
begin
  Result := '';
  for I := 0 to Content.Count - 1 do
  begin
    Line := Trim(Content[I]);
    if (Length(Line) = 0) or (Line[1] = '#') then Continue;
    EqPos := Pos('=', Line);
    if EqPos = 0 then Continue;
    K := Trim(Copy(Line, 1, EqPos - 1));
    V := Trim(Copy(Line, EqPos + 1, Length(Line)));
    if (Length(V) >= 2) and (V[1] = '"') and (V[Length(V)] = '"') then
      V := Copy(V, 2, Length(V) - 2);
    if K = Key then begin Result := V; Exit; end;
  end;
end;

function ValidateEnvFile(FilePath: String): String;
var Content: TStringList; Keys: TStringList; Missing: String;
    I, J: Integer; Found: Boolean; Line, K: String; EqPos: Integer;
begin
  Result := '';
  if not FileExists(FilePath) then begin Result := 'Archivo no encontrado.'; Exit; end;
  Content := TStringList.Create;
  Keys    := GetRequiredKeys();
  Missing := '';
  try
    Content.LoadFromFile(FilePath);
    for I := 0 to Keys.Count - 1 do
    begin
      Found := False;
      for J := 0 to Content.Count - 1 do
      begin
        Line := Trim(Content[J]);
        if (Length(Line) = 0) or (Line[1] = '#') then Continue;
        EqPos := Pos('=', Line);
        if EqPos = 0 then Continue;
        K := Trim(Copy(Line, 1, EqPos - 1));
        if K = Keys[I] then begin Found := True; Break; end;
      end;
      if not Found then Missing := Missing + Keys[I] + ', ';
    end;
  finally Content.Free; Keys.Free; end;
  if Missing <> '' then
    Result := 'Faltan claves: ' + Copy(Missing, 1, Length(Missing) - 2);
end;

procedure LoadEnvIntoForm(FilePath: String);
var Content: TStringList; NodeEnvVal, HttpsVal: String;
begin
  Content := TStringList.Create;
  try
    Content.LoadFromFile(FilePath);
    NodeEnvVal := GetEnvValue(Content, 'VITE_NODE_ENV');
    if NodeEnvVal = 'development' then
      cmbNodeEnv.ItemIndex := 1
    else
      cmbNodeEnv.ItemIndex := 0;
    HttpsVal := GetEnvValue(Content, 'VITE_HTTPS');
    if HttpsVal = 'OK' then
      cmbHttps.ItemIndex := 1
    else
      cmbHttps.ItemIndex := 0;
    edtBrand.Text          := GetEnvValue(Content, 'VITE_BRAND');
    edtPathLogoBrand.Text  := GetEnvValue(Content, 'VITE_PATH_LOGO_BRAND');
    edtPathLogoCistem.Text := GetEnvValue(Content, 'VITE_PATH_LOGO_CISTEM');
    edtApiApp.Text         := GetEnvValue(Content, 'VITE_API_APP');
    edtApiAuth.Text        := GetEnvValue(Content, 'VITE_API_AUTH');
    edtAppPort.Text        := GetEnvValue(Content, 'VITE_APP_PORT');
    edtHost.Text           := GetEnvValue(Content, 'VITE_HOST');
    edtTimeout.Text        := GetEnvValue(Content, 'VITE_TIMEOUT');
    edtSslCert.Text        := GetEnvValue(Content, 'VITE_SSL_CERT');
    edtSslKey.Text         := GetEnvValue(Content, 'VITE_SSL_KEY');
  finally Content.Free; end;

  // Actualiza visibilidad según el entorno cargado del .env
  UpdateSslFieldsVisibility();
end;

procedure BrowseClick(Sender: TObject);
var FileName, ErrMsg: String;
begin
  if GetOpenFileName('Seleccionar archivo .env', FileName, '',
    'Archivos ENV (*.env)|*.env|Todos (*.*)|*.*', '') then
  begin
    EnvFilePath := FileName;
    LblFilePath.Caption := FileName;
    ErrMsg := ValidateEnvFile(FileName);
    if ErrMsg = '' then
    begin
      EnvFileLoaded := True;
      LblValidation.Caption := '✔ Archivo válido — valores cargados en el formulario';
      LblValidation.Font.Color := clGreen;
      LoadEnvIntoForm(FileName);
    end else
    begin
      EnvFileLoaded := False;
      LblValidation.Caption := '✘ ' + ErrMsg;
      LblValidation.Font.Color := clRed;
    end;
  end;
end;

procedure BrowseLogoBrandClick(Sender: TObject);
var FileName: String;
begin
  if GetOpenFileName('Seleccionar logo del proyecto', FileName, '',
    'Imágenes (*.png;*.jpg;*.jpeg;*.gif;*.svg;*.webp;*.ico;*.bmp)|*.png;*.jpg;*.jpeg;*.gif;*.svg;*.webp;*.ico;*.bmp|Todos (*.*)|*.*', '') then
    edtPathLogoBrand.Text := FileName;
end;

procedure BrowseLogoCistemClick(Sender: TObject);
var FileName: String;
begin
  if GetOpenFileName('Seleccionar logo Cistem', FileName, '',
    'Imágenes (*.png;*.jpg;*.jpeg;*.gif;*.svg;*.webp;*.ico;*.bmp)|*.png;*.jpg;*.jpeg;*.gif;*.svg;*.webp;*.ico;*.bmp|Todos (*.*)|*.*', '') then
    edtPathLogoCistem.Text := FileName;
end;

procedure BrowseSslCertClick(Sender: TObject);
var FileName: String;
begin
  if GetOpenFileName('Seleccionar certificado SSL', FileName, '',
    'Certificados (*.crt;*.pem)|*.crt;*.pem|Todos (*.*)|*.*', '') then
    edtSslCert.Text := FileName;
end;

procedure BrowseSslKeyClick(Sender: TObject);
var FileName: String;
begin
  if GetOpenFileName('Seleccionar clave SSL', FileName, '',
    'Claves (*.key;*.pem)|*.key;*.pem|Todos (*.*)|*.*', '') then
    edtSslKey.Text := FileName;
end;

function AddField(Page: TWizardPage; var YPos: Integer; LabelText: String; DefaultVal: String): TEdit;
var Lbl: TLabel; Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos; Lbl.Width := Page.SurfaceWidth;
  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16; Edt.Width := Page.SurfaceWidth; Edt.Text := DefaultVal;
  YPos := YPos + 44;
  Result := Edt;
end;

function AddComboField(Page: TWizardPage; var YPos: Integer; LabelText: String): TComboBox;
var Lbl: TLabel; Cmb: TComboBox;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos; Lbl.Width := Page.SurfaceWidth;
  Cmb := TComboBox.Create(Page); Cmb.Parent := Page.Surface;
  Cmb.Left := 0; Cmb.Top := YPos + 16; Cmb.Width := Page.SurfaceWidth;
  Cmb.Style := csDropDownList;
  YPos := YPos + 44;
  Result := Cmb;
end;

function AddBrowseField(Page: TWizardPage; var YPos: Integer; LabelText: String; DefaultVal: String; out Btn: TButton): TEdit;
var Lbl: TLabel; Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos; Lbl.Width := Page.SurfaceWidth;
  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16; Edt.Width := Page.SurfaceWidth - 110; Edt.Text := DefaultVal;
  Btn := TButton.Create(Page); Btn.Parent := Page.Surface;
  Btn.Caption := 'Examinar...'; Btn.Left := Page.SurfaceWidth - 105; Btn.Top := YPos + 14;
  Btn.Width := 105;
  YPos := YPos + 44;
  Result := Edt;
end;

// ── Variante que también devuelve el Label para poder ocultarlo ──
function AddBrowseFieldEx(Page: TWizardPage; var YPos: Integer; LabelText: String;
  DefaultVal: String; out Btn: TButton; out OutLbl: TLabel): TEdit;
var Lbl: TLabel; Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos; Lbl.Width := Page.SurfaceWidth;
  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16; Edt.Width := Page.SurfaceWidth - 110; Edt.Text := DefaultVal;
  Btn := TButton.Create(Page); Btn.Parent := Page.Surface;
  Btn.Caption := 'Examinar...'; Btn.Left := Page.SurfaceWidth - 105; Btn.Top := YPos + 14;
  Btn.Width := 105;
  YPos := YPos + 44;
  OutLbl := Lbl;
  Result := Edt;
end;

// ── Variante que también devuelve el Label para campos simples ──
function AddFieldEx(Page: TWizardPage; var YPos: Integer; LabelText: String;
  DefaultVal: String; out OutLbl: TLabel): TEdit;
var Lbl: TLabel; Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos; Lbl.Width := Page.SurfaceWidth;
  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16; Edt.Width := Page.SurfaceWidth; Edt.Text := DefaultVal;
  YPos := YPos + 44;
  OutLbl := Lbl;
  Result := Edt;
end;

// ── Variante que también devuelve el Label para combos ──
function AddComboFieldEx(Page: TWizardPage; var YPos: Integer; LabelText: String;
  out OutLbl: TLabel): TComboBox;
var Lbl: TLabel; Cmb: TComboBox;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos; Lbl.Width := Page.SurfaceWidth;
  Cmb := TComboBox.Create(Page); Cmb.Parent := Page.Surface;
  Cmb.Left := 0; Cmb.Top := YPos + 16; Cmb.Width := Page.SurfaceWidth;
  Cmb.Style := csDropDownList;
  YPos := YPos + 44;
  OutLbl := Lbl;
  Result := Cmb;
end;

procedure InitializeWizard();
var YPos: Integer; LblInfo, LblFixed: TLabel;
begin
  EnvFileLoaded := False;

  // ── Página 0: Cargar .env existente ─────────────────────────
  PageUpload := CreateCustomPage(wpSelectDir, 'Configuración .env',
    'Sube tu archivo .env o configura los valores manualmente en los siguientes pasos.');

  LblInfo := TLabel.Create(PageUpload); LblInfo.Parent := PageUpload.Surface;
  LblInfo.Caption := 'Opcionalmente sube un archivo .env existente. Se validará y los valores se cargarán automáticamente.';
  LblInfo.Left := 0; LblInfo.Top := 0; LblInfo.Width := PageUpload.SurfaceWidth; LblInfo.WordWrap := True;

  BtnBrowse := TButton.Create(PageUpload); BtnBrowse.Parent := PageUpload.Surface;
  BtnBrowse.Caption := 'Examinar...'; BtnBrowse.Left := 0; BtnBrowse.Top := 50;
  BtnBrowse.Width := 100; BtnBrowse.OnClick := @BrowseClick;

  LblFilePath := TLabel.Create(PageUpload); LblFilePath.Parent := PageUpload.Surface;
  LblFilePath.Caption := 'Ningún archivo seleccionado';
  LblFilePath.Left := 110; LblFilePath.Top := 55; LblFilePath.Width := PageUpload.SurfaceWidth - 110;

  LblValidation := TLabel.Create(PageUpload); LblValidation.Parent := PageUpload.Surface;
  LblValidation.Caption := ''; LblValidation.Left := 0; LblValidation.Top := 80;
  LblValidation.Width := PageUpload.SurfaceWidth; LblValidation.WordWrap := True;

  LblUploadHint := TLabel.Create(PageUpload); LblUploadHint.Parent := PageUpload.Surface;
  LblUploadHint.Caption := 'Si no subes archivo, puedes llenar los campos manualmente en los siguientes pasos.';
  LblUploadHint.Left := 0; LblUploadHint.Top := 110; LblUploadHint.Width := PageUpload.SurfaceWidth;
  LblUploadHint.WordWrap := True;

  // ── Página 1: Entorno, marca y logos ────────────────────────
  PageEnv1 := CreateCustomPage(PageUpload.ID, 'Configuración general',
    'Define el entorno, nombre del proyecto y logos.');
  YPos := 0;

  cmbNodeEnv := AddComboField(PageEnv1, YPos, 'VITE_NODE_ENV — Entorno de ejecución');
  cmbNodeEnv.Items.Add('production');
  cmbNodeEnv.Items.Add('development');
  cmbNodeEnv.ItemIndex := 0;
  cmbNodeEnv.OnChange := @NodeEnvChange;  // ← asigna el evento

  edtPathLogoBrand  := AddBrowseField(PageEnv1, YPos, 'VITE_PATH_LOGO_BRAND — Logo del proyecto (imagen)', '', BtnLogoBrand);
  BtnLogoBrand.OnClick := @BrowseLogoBrandClick;
  edtPathLogoCistem := AddBrowseField(PageEnv1, YPos, 'VITE_PATH_LOGO_CISTEM — Logo Cistem (imagen)', '', BtnLogoCistem);
  BtnLogoCistem.OnClick := @BrowseLogoCistemClick;

  edtTimeout := AddField(PageEnv1, YPos,'VITE_TIMEOUT — Tiempo de espera en ms', '8000');

  // ── Página 2: APIs de backend ────────────────────────────────
  PageEnv2 := CreateCustomPage(PageEnv1.ID, 'Conexión al backend', 'URLs de los servicios backend y puerto del frontend.');
  YPos := 0;

  edtAppPort := AddField(PageEnv2, YPos, 'VITE_APP_PORT * — Puerto donde corre el frontend', '92');
  edtApiApp  := AddField(PageEnv2, YPos, 'VITE_API_APP * — URL del backend principal (APP)', 'http://localhost:91');
  edtApiAuth := AddField(PageEnv2, YPos, 'VITE_API_AUTH * — URL del backend de autenticación (AUTH)', 'http://localhost:9091');

  // ── Página 3: Red, HTTPS y SSL ───────────────────────────────
  PageEnv3 := CreateCustomPage(PageEnv2.ID, 'Red y certificados SSL',
    'Configura el host, HTTPS y las rutas de tus certificados SSL.');
  YPos := 0;

  // Usamos las variantes *Ex para guardar referencia a cada Label
  edtHost    := AddFieldEx(PageEnv3, YPos, 'VITE_HOST — Host o dominio (dejar vacío para localhost)', '', LblHost);
  cmbHttps   := AddComboFieldEx(PageEnv3, YPos, 'VITE_HTTPS — ¿Usar HTTPS?', LblHttps);
  cmbHttps.Items.Add('NO');
  cmbHttps.Items.Add('YES');
  cmbHttps.ItemIndex := 0;

  edtSslCert := AddBrowseFieldEx(PageEnv3, YPos,
    'VITE_SSL_CERT — Certificado (.crt / .pem)', '', BtnSslCert, LblSslCert);
  BtnSslCert.OnClick := @BrowseSslCertClick;

  edtSslKey  := AddBrowseFieldEx(PageEnv3, YPos,
    'VITE_SSL_KEY — Clave privada (.key / .pem)', '', BtnSslKey, LblSslKey);
  BtnSslKey.OnClick := @BrowseSslKeyClick;

  // Aplica visibilidad inicial según el valor por defecto (production)
  UpdateSslFieldsVisibility();
end;

procedure WriteEnvFile();
var EnvPath, AppDir, Lines, HttpsVal: String;
begin
  AppDir := ExpandConstant('{app}');
  if not DirExists(AppDir) then
    ForceDirectories(AppDir);

  EnvPath := AppDir + '\.env';

  if cmbHttps.ItemIndex = 1 then
    HttpsVal := 'OK'
  else
    HttpsVal := '';

  Lines :=
      '#* Generado por MonitAgent FrontEnd Installer'                               + #13#10
    + 'VITE_NODE_ENV="'        + cmbNodeEnv.Items[cmbNodeEnv.ItemIndex]       + '"' + #13#10
    + 'VITE_BRAND="MonitTray-FE"'                                                   + #13#10
    + 'VITE_COPYRIGHT="Cistem Innovacion"'                                          + #13#10
    + 'VITE_VERSION="1.1.1"'                                                        + #13#10
    + 'VITE_PATH_LOGO_BRAND="' + edtPathLogoBrand.Text                        + '"' + #13#10
    + 'VITE_PATH_LOGO_CISTEM="'+ edtPathLogoCistem.Text                       + '"' + #13#10
    + 'VITE_API_APP="'         + edtApiApp.Text                               + '"' + #13#10
    + 'VITE_API_AUTH="'        + edtApiAuth.Text                              + '"' + #13#10
    + 'VITE_APP_PORT="'        + edtAppPort.Text                              + '"' + #13#10
    + 'VITE_HOST="'            + edtHost.Text                                 + '"' + #13#10
    + 'VITE_HTTPS="'           + HttpsVal                                     + '"' + #13#10
    + 'VITE_SSL_CERT="'        + edtSslCert.Text                              + '"' + #13#10
    + 'VITE_SSL_KEY="'         + edtSslKey.Text                               + '"' + #13#10
    + 'VITE_TIMEOUT="'         + edtTimeout.Text                              + '"' + #13#10;

  SaveStringToFile(EnvPath, Lines, False);
end;

procedure CopySslFiles();
var SslDir, CertDest, KeyDest: String;
begin
  SslDir := ExpandConstant('{app}\ssl');
  if not DirExists(SslDir) then
    CreateDir(SslDir);
  if (edtSslCert.Text <> '') and FileExists(edtSslCert.Text) then
  begin
    CertDest := SslDir + '\' + ExtractFileName(edtSslCert.Text);
    CopyFile(edtSslCert.Text, CertDest, False);
  end;
  if (edtSslKey.Text <> '') and FileExists(edtSslKey.Text) then
  begin
    KeyDest := SslDir + '\' + ExtractFileName(edtSslKey.Text);
    CopyFile(edtSslKey.Text, KeyDest, False);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    CopySslFiles();
    WriteEnvFile();
  end;
end;