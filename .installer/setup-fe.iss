; ============================================================
;  MonitAgent FrontEnd Installer
;  Versión: 1.1.1
;  Publisher: Cistem Innovacion
; ============================================================

#define MyAppName "MonitTray-FE"
#define MyAppVersion "1.1.1"
#define MyAppPublisher "Cistem Innovacion"

; ── [Setup] ─────────────────────────────────────────────────
; Configuración general del instalador: nombre, versión,
; directorio destino, compresión y privilegios requeridos.
; ────────────────────────────────────────────────────────────
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

; ── [Languages] ─────────────────────────────────────────────
; Idioma del instalador: español.
; ────────────────────────────────────────────────────────────
[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

; ── [Dirs] ──────────────────────────────────────────────────
; Crea el directorio de instalación con permisos de
; modificación para usuarios normales.
; ────────────────────────────────────────────────────────────
[Dirs]
Name: "{app}"; Permissions: users-modify

; ── [Files] ─────────────────────────────────────────────────
; Archivos que se copian al directorio de instalación.
; - win-unpacked: binarios del tray (Electron)
; - server.cjs / server.js: servidor backend local
; - dist: build de Vite (frontend compilado)
; - src: fuentes originales (por si se necesita referencia)
; ────────────────────────────────────────────────────────────
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

; ── [Registry] ──────────────────────────────────────────────
; Escribe la ruta de instalación en el registro de Windows
; (tanto en 64 bit como en 32 bit / WOW6432Node).
; También registra el .exe para inicio automático con Windows
; bajo HKCU\...\Run (solo el usuario actual, no todos).
; ────────────────────────────────────────────────────────────
[Registry]
Root: HKLM; Subkey: "SOFTWARE\Cistem Innovacion\MonitTray-FE"; \
  ValueType: string; ValueName: "InstallPath"; \
  ValueData: "{app}"; Flags: createvalueifdoesntexist uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\WOW6432Node\Cistem Innovacion\MonitTray-FE"; \
  ValueType: string; ValueName: "InstallPath"; \
  ValueData: "{app}"; Flags: createvalueifdoesntexist uninsdeletekey
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "MonitTray-FE"; \
  ValueData: """{app}\MonitTray-FE.exe"""; \
  Flags: uninsdeletevalue

; ── [Run] ────────────────────────────────────────────────────
; Pasos que se ejecutan al terminar la instalación:
; 1) npm install (oculto, espera a que termine)
; 2) Lanzar la app (opcional, visible al usuario)
; ────────────────────────────────────────────────────────────
[Run]
Filename: "cmd.exe"; \
  Parameters: "/c cd /d ""{app}"" && npm install"; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Instalando dependencias..."

Filename: "{app}\MonitTray-FE.exe"; \
  Flags: nowait postinstall skipifsilent runasoriginaluser; \
  Description: "Iniciar MonitAgent ahora"

; ── [Icons] ──────────────────────────────────────────────────
; Accesos directos en el menú Inicio.
; ────────────────────────────────────────────────────────────
[Icons]
Name: "{group}\MonitAgent Tray";        Filename: "{app}\MonitTray-FE.exe"
Name: "{group}\Desinstalar MonitAgent"; Filename: "{uninstallexe}"

; ============================================================
;  [Code] — Lógica personalizada del asistente de instalación
; ============================================================
[Code]

{ ── Variables globales ───────────────────────────────────────
  Se declaran aquí para que sean accesibles desde cualquier
  procedimiento / función del script.
  ─────────────────────────────────────────────────────────── }
var
  { Página 0: cargar .env existente }
  PageUpload    : TWizardPage;
  BtnBrowse     : TButton;       { Botón "Examinar..." para seleccionar .env }
  LblFilePath   : TLabel;        { Muestra la ruta del archivo seleccionado }
  LblUploadHint : TLabel;        { Mensaje de ayuda inferior }
  MemoValidation: TMemo;         { Área con scroll para mostrar errores/éxito }
  EnvFilePath   : String;        { Ruta completa del .env seleccionado }
  EnvFileLoaded : Boolean;       { True si el .env pasó la validación }

  { Página 1: entorno general, logos, timeout }
  PageEnv1         : TWizardPage;
  cmbNodeEnv       : TComboBox;  { production | development }
  edtPathLogoBrand : TEdit;      { Ruta imagen logo del proyecto }
  BtnLogoBrand     : TButton;
  edtPathLogoCistem: TEdit;      { Ruta imagen logo Cistem }
  BtnLogoCistem    : TButton;
  edtTimeout       : TEdit;      { Timeout en ms para peticiones }

  { Página 2: URLs de backend y puerto del frontend }
  PageEnv2  : TWizardPage;
  edtApiApp : TEdit;             { URL backend principal }
  edtApiAuth: TEdit;             { URL backend autenticación }
  edtAppPort: TEdit;             { Puerto donde corre el frontend }

  { Página 3: red, HTTPS y certificados SSL
    Solo se muestra cuando el entorno es "production" }
  PageEnv3  : TWizardPage;
  edtHost   : TEdit;             { Host / dominio (vacío = localhost) }
  LblHost   : TLabel;
  edtSslCert: TEdit;             { Ruta al certificado .crt / .pem }
  LblSslCert: TLabel;
  BtnSslCert: TButton;
  edtSslKey : TEdit;             { Ruta a la clave privada .key / .pem }
  LblSslKey : TLabel;
  BtnSslKey : TButton;
  cmbHttps  : TComboBox;         { NO | YES }
  LblHttps  : TLabel;


{ ══════════════════════════════════════════════════════════════
  UpdateSslFieldsVisibility
  ──────────────────────────────────────────────────────────────
  Muestra u oculta los campos de la Página 3 según el entorno
  seleccionado en cmbNodeEnv:
    - production  (index 0) → muestra todos los campos SSL
    - development (index 1) → oculta todos los campos SSL
  Se llama cada vez que cambia el combo y al inicializar.
  ══════════════════════════════════════════════════════════════ }
procedure UpdateSslFieldsVisibility();
var
  IsProd: Boolean;
begin
  { index 0 = production }
  IsProd := cmbNodeEnv.ItemIndex = 0;

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


{ ══════════════════════════════════════════════════════════════
  NodeEnvChange
  ──────────────────────────────────────────────────────────────
  Evento OnChange del combo cmbNodeEnv.
  Cada vez que el usuario cambia el entorno, actualiza la
  visibilidad de los campos SSL en la Página 3.
  ══════════════════════════════════════════════════════════════ }
procedure NodeEnvChange(Sender: TObject);
begin
  UpdateSslFieldsVisibility();
end;


{ ══════════════════════════════════════════════════════════════
  ShouldSkipPage
  ──────────────────────────────────────────────────────────────
  Si el entorno seleccionado es "development" (index 1),
  la Página 3 (SSL/Red) se salta completamente porque esos
  campos no aplican en desarrollo local.
  ══════════════════════════════════════════════════════════════ }
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = PageEnv3.ID) and (cmbNodeEnv.ItemIndex = 1) then
    Result := True;
end;


{ ══════════════════════════════════════════════════════════════
  GetRequiredKeys
  ──────────────────────────────────────────────────────────────
  Devuelve la lista de claves que DEBEN existir en el .env
  para que el instalador lo considere válido.
  ══════════════════════════════════════════════════════════════ }
function GetRequiredKeys(): TStringList;
var
  Keys: TStringList;
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


{ ══════════════════════════════════════════════════════════════
  GetEnvValue
  ──────────────────────────────────────────────────────────────
  Busca en un TStringList (contenido del .env) el valor de
  la clave indicada y lo devuelve sin comillas.
  Ignora líneas vacías y comentarios (#).
  ══════════════════════════════════════════════════════════════ }
function GetEnvValue(Content: TStringList; Key: String): String;
var
  I: Integer;
  Line, K, V: String;
  EqPos: Integer;
begin
  Result := '';
  for I := 0 to Content.Count - 1 do
  begin
    Line := Trim(Content[I]);

    { Saltar líneas vacías y comentarios }
    if (Length(Line) = 0) or (Line[1] = '#') then Continue;

    EqPos := Pos('=', Line);
    if EqPos = 0 then Continue;

    K := Trim(Copy(Line, 1, EqPos - 1));
    V := Trim(Copy(Line, EqPos + 1, Length(Line)));

    { Quitar comillas dobles si las tiene }
    if (Length(V) >= 2) and (V[1] = '"') and (V[Length(V)] = '"') then
      V := Copy(V, 2, Length(V) - 2);

    if K = Key then
    begin
      Result := V;
      Exit;
    end;
  end;
end;


{ ══════════════════════════════════════════════════════════════
  ValidateEnvFile
  ──────────────────────────────────────────────────────────────
  Lee el archivo .env indicado y realiza dos comprobaciones:
    1) Claves requeridas que faltan.
    2) Claves que existen pero no son reconocidas por MonitTray-FE.
  Devuelve un string con los mensajes de error (vacío = OK).
  ══════════════════════════════════════════════════════════════ }
function ValidateEnvFile(FilePath: String): String;
var
  Content   : TStringList;
  Keys      : TStringList;  { Claves requeridas }
  KnownKeys : TStringList;  { Todas las claves reconocidas }
  Missing   : String;       { Acumula claves faltantes }
  Unknown   : String;       { Acumula claves desconocidas }
  I, J      : Integer;
  Found, IsKnown: Boolean;
  Line, K   : String;
  EqPos     : Integer;
begin
  Result := '';

  if not FileExists(FilePath) then
  begin
    Result := 'Archivo no encontrado.';
    Exit;
  end;

  Content   := TStringList.Create;
  Keys      := GetRequiredKeys();
  KnownKeys := TStringList.Create;
  Missing   := '';
  Unknown   := '';

  { Lista completa de claves válidas para MonitTray-FE }
  KnownKeys.Add('VITE_BRAND');
  KnownKeys.Add('VITE_COPYRIGHT');
  KnownKeys.Add('VITE_NODE_ENV');
  KnownKeys.Add('VITE_VERSION');
  KnownKeys.Add('VITE_APP_PORT');
  KnownKeys.Add('VITE_API_APP');
  KnownKeys.Add('VITE_API_AUTH');
  KnownKeys.Add('VITE_TIMEOUT');
  KnownKeys.Add('VITE_HOST');
  KnownKeys.Add('VITE_HTTPS');
  KnownKeys.Add('VITE_SSL_CERT');
  KnownKeys.Add('VITE_SSL_KEY');
  KnownKeys.Add('VITE_PATH_LOGO_BRAND');
  KnownKeys.Add('VITE_PATH_LOGO_CISTEM');
  KnownKeys.Add('_SYS_CK1');
  KnownKeys.Add('_SYS_CK2');

  try
    Content.LoadFromFile(FilePath);

    { ── 1) Verificar que todas las claves requeridas estén presentes ── }
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
        if K = Keys[I] then
        begin
          Found := True;
          Break;
        end;
      end;
      if not Found then
        Missing := Missing + Keys[I] + #13#10;
    end;

    { ── 2) Detectar claves que existen pero no son reconocidas ── }
    for J := 0 to Content.Count - 1 do
    begin
      Line := Trim(Content[J]);
      if (Length(Line) = 0) or (Line[1] = '#') then Continue;
      EqPos := Pos('=', Line);
      if EqPos = 0 then Continue;
      K := Trim(Copy(Line, 1, EqPos - 1));

      IsKnown := False;
      for I := 0 to KnownKeys.Count - 1 do
        if K = KnownKeys[I] then
        begin
          IsKnown := True;
          Break;
        end;

      if not IsKnown then
        Unknown := Unknown + K + #13#10;
    end;

  finally
    Content.Free;
    Keys.Free;
    KnownKeys.Free;
  end;

  { ── Construir mensaje de resultado con cada error en su propia línea ── }
  if Missing <> '' then
    Result := Result + '--- Claves requeridas faltantes ---' + #13#10
                     + Missing + #13#10;

  if Unknown <> '' then
    Result := Result + '--- Claves no reconocidas ---' + #13#10
                     + Unknown;

  Result := Trim(Result);
end;


{ ══════════════════════════════════════════════════════════════
  LoadEnvIntoForm
  ──────────────────────────────────────────────────────────────
  Lee el .env validado y rellena todos los campos del
  formulario con los valores encontrados.
  También actualiza la visibilidad SSL según VITE_NODE_ENV.
  ══════════════════════════════════════════════════════════════ }
procedure LoadEnvIntoForm(FilePath: String);
var
  Content   : TStringList;
  NodeEnvVal: String;
  HttpsVal  : String;
begin
  Content := TStringList.Create;
  try
    Content.LoadFromFile(FilePath);

    { Entorno: production o development }
    NodeEnvVal := GetEnvValue(Content, 'VITE_NODE_ENV');
    if NodeEnvVal = 'development' then
      cmbNodeEnv.ItemIndex := 1
    else
      cmbNodeEnv.ItemIndex := 0;

    { HTTPS: mapea 'OK' → index 1, cualquier otro → index 0 }
    HttpsVal := GetEnvValue(Content, 'VITE_HTTPS');
    if HttpsVal = 'OK' then
      cmbHttps.ItemIndex := 1
    else
      cmbHttps.ItemIndex := 0;

    { Rellenar campos de texto con los valores del .env }
    edtPathLogoBrand.Text  := GetEnvValue(Content, 'VITE_PATH_LOGO_BRAND');
    edtPathLogoCistem.Text := GetEnvValue(Content, 'VITE_PATH_LOGO_CISTEM');
    edtApiApp.Text         := GetEnvValue(Content, 'VITE_API_APP');
    edtApiAuth.Text        := GetEnvValue(Content, 'VITE_API_AUTH');
    edtAppPort.Text        := GetEnvValue(Content, 'VITE_APP_PORT');
    edtHost.Text           := GetEnvValue(Content, 'VITE_HOST');
    edtTimeout.Text        := GetEnvValue(Content, 'VITE_TIMEOUT');
    edtSslCert.Text        := GetEnvValue(Content, 'VITE_SSL_CERT');
    edtSslKey.Text         := GetEnvValue(Content, 'VITE_SSL_KEY');
  finally
    Content.Free;
  end;

  { Actualiza visibilidad SSL según el entorno recién cargado }
  UpdateSslFieldsVisibility();
end;


{ ══════════════════════════════════════════════════════════════
  BrowseClick
  ──────────────────────────────────────────────────────────────
  Abre un diálogo para seleccionar el archivo .env.
  Tras la selección:
    - Valida el archivo con ValidateEnvFile.
    - Si es válido: carga los valores en el formulario y
      muestra mensaje verde en el MemoValidation.
    - Si tiene errores: muestra la lista detallada en rojo
      dentro del MemoValidation (con scroll si es larga).
  ══════════════════════════════════════════════════════════════ }
procedure BrowseClick(Sender: TObject);
var
  FileName: String;
  ErrMsg  : String;
begin
  if GetOpenFileName('Seleccionar archivo .env', FileName, '',
    'Archivos ENV (*.env)|*.env|Todos (*.*)|*.*', '') then
  begin
    EnvFilePath := FileName;
    LblFilePath.Caption := FileName;

    ErrMsg := ValidateEnvFile(FileName);

    if ErrMsg = '' then
    begin
      { ── Archivo válido ── }
      EnvFileLoaded := True;
      MemoValidation.Text       := '✔ Archivo válido — valores cargados en el formulario.';
      MemoValidation.Font.Color := clGreen;
      LoadEnvIntoForm(FileName);
    end else
    begin
      { ── Archivo con errores: muestra lista completa en el memo ── }
      EnvFileLoaded := False;
      MemoValidation.Text       := '✘ El archivo tiene problemas:' + #13#10 + #13#10 + ErrMsg;
      MemoValidation.Font.Color := clRed;
    end;
  end;
end;


{ ── Diálogos de selección de archivos ──────────────────────
  Cada procedimiento abre un OpenDialog filtrado por tipo
  de archivo y coloca la ruta en el campo correspondiente.
  ─────────────────────────────────────────────────────────── }

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


{ ══════════════════════════════════════════════════════════════
  Helpers para construir controles en las páginas
  ──────────────────────────────────────────────────────────────
  Estas funciones simplifican la creación repetitiva de
  Label + TEdit / TComboBox en las páginas del wizard.
  YPos se incrementa automáticamente después de cada control.
  ══════════════════════════════════════════════════════════════ }

{ Campo de texto simple (Label + TEdit) }
function AddField(Page: TWizardPage; var YPos: Integer;
  LabelText: String; DefaultVal: String): TEdit;
var
  Lbl: TLabel;
  Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos;
  Lbl.Width := Page.SurfaceWidth;

  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16;
  Edt.Width := Page.SurfaceWidth; Edt.Text := DefaultVal;

  YPos := YPos + 44;
  Result := Edt;
end;

{ ComboBox simple (Label + TComboBox) }
function AddComboField(Page: TWizardPage; var YPos: Integer;
  LabelText: String): TComboBox;
var
  Lbl: TLabel;
  Cmb: TComboBox;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos;
  Lbl.Width := Page.SurfaceWidth;

  Cmb := TComboBox.Create(Page); Cmb.Parent := Page.Surface;
  Cmb.Left := 0; Cmb.Top := YPos + 16;
  Cmb.Width := Page.SurfaceWidth;
  Cmb.Style := csDropDownList;

  YPos := YPos + 44;
  Result := Cmb;
end;

{ Campo de texto con botón "Examinar..." (Label + TEdit + TButton) }
function AddBrowseField(Page: TWizardPage; var YPos: Integer;
  LabelText: String; DefaultVal: String; out Btn: TButton): TEdit;
var
  Lbl: TLabel;
  Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos;
  Lbl.Width := Page.SurfaceWidth;

  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16;
  Edt.Width := Page.SurfaceWidth - 110; Edt.Text := DefaultVal;

  Btn := TButton.Create(Page); Btn.Parent := Page.Surface;
  Btn.Caption := 'Examinar...';
  Btn.Left := Page.SurfaceWidth - 105; Btn.Top := YPos + 14;
  Btn.Width := 105;

  YPos := YPos + 44;
  Result := Edt;
end;

{ Igual que AddBrowseField pero también devuelve referencia al Label
  → necesario para poder ocultarlo con Visible := False }
function AddBrowseFieldEx(Page: TWizardPage; var YPos: Integer;
  LabelText: String; DefaultVal: String;
  out Btn: TButton; out OutLbl: TLabel): TEdit;
var
  Lbl: TLabel;
  Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos;
  Lbl.Width := Page.SurfaceWidth;

  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16;
  Edt.Width := Page.SurfaceWidth - 110; Edt.Text := DefaultVal;

  Btn := TButton.Create(Page); Btn.Parent := Page.Surface;
  Btn.Caption := 'Examinar...';
  Btn.Left := Page.SurfaceWidth - 105; Btn.Top := YPos + 14;
  Btn.Width := 105;

  YPos := YPos + 44;
  OutLbl := Lbl;
  Result := Edt;
end;

{ Igual que AddField pero también devuelve referencia al Label }
function AddFieldEx(Page: TWizardPage; var YPos: Integer;
  LabelText: String; DefaultVal: String; out OutLbl: TLabel): TEdit;
var
  Lbl: TLabel;
  Edt: TEdit;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos;
  Lbl.Width := Page.SurfaceWidth;

  Edt := TEdit.Create(Page); Edt.Parent := Page.Surface;
  Edt.Left := 0; Edt.Top := YPos + 16;
  Edt.Width := Page.SurfaceWidth; Edt.Text := DefaultVal;

  YPos := YPos + 44;
  OutLbl := Lbl;
  Result := Edt;
end;

{ Igual que AddComboField pero también devuelve referencia al Label }
function AddComboFieldEx(Page: TWizardPage; var YPos: Integer;
  LabelText: String; out OutLbl: TLabel): TComboBox;
var
  Lbl: TLabel;
  Cmb: TComboBox;
begin
  Lbl := TLabel.Create(Page); Lbl.Parent := Page.Surface;
  Lbl.Caption := LabelText; Lbl.Left := 0; Lbl.Top := YPos;
  Lbl.Width := Page.SurfaceWidth;

  Cmb := TComboBox.Create(Page); Cmb.Parent := Page.Surface;
  Cmb.Left := 0; Cmb.Top := YPos + 16;
  Cmb.Width := Page.SurfaceWidth;
  Cmb.Style := csDropDownList;

  YPos := YPos + 44;
  OutLbl := Lbl;
  Result := Cmb;
end;


{ ══════════════════════════════════════════════════════════════
  InitializeWizard
  ──────────────────────────────────────────────────────────────
  Punto de entrada principal del [Code].
  Se llama una sola vez al arrancar el instalador.
  Crea las 4 páginas personalizadas y sus controles.
  ══════════════════════════════════════════════════════════════ }
procedure InitializeWizard();
var
  YPos   : Integer;
  LblInfo: TLabel;
begin
  EnvFileLoaded := False;

  { ══ Página 0: Carga opcional de .env existente ══════════════
    Permite al usuario subir un archivo .env ya configurado.
    Si es válido, rellena automáticamente las páginas siguientes.
    Si tiene errores, los muestra en el TMemo con scroll.
    ─────────────────────────────────────────────────────────── }
  PageUpload := CreateCustomPage(wpSelectDir,
    'Configuración .env',
    'Sube tu archivo .env o configura los valores manualmente en los siguientes pasos.');

  { Texto de instrucción superior }
  LblInfo := TLabel.Create(PageUpload);
  LblInfo.Parent    := PageUpload.Surface;
  LblInfo.Caption   := 'Opcionalmente sube un archivo .env existente. '
                      + 'Se validará y los valores se cargarán automáticamente.';
  LblInfo.Left      := 0;
  LblInfo.Top       := 0;
  LblInfo.Width     := PageUpload.SurfaceWidth;
  LblInfo.WordWrap  := True;

  { Botón para abrir el diálogo de selección de archivo }
  BtnBrowse := TButton.Create(PageUpload);
  BtnBrowse.Parent   := PageUpload.Surface;
  BtnBrowse.Caption  := 'Examinar...';
  BtnBrowse.Left     := 0;
  BtnBrowse.Top      := 50;
  BtnBrowse.Width    := 100;
  BtnBrowse.OnClick  := @BrowseClick;

  { Etiqueta que muestra la ruta del archivo seleccionado }
  LblFilePath := TLabel.Create(PageUpload);
  LblFilePath.Parent  := PageUpload.Surface;
  LblFilePath.Caption := 'Ningún archivo seleccionado';
  LblFilePath.Left    := 110;
  LblFilePath.Top     := 55;
  LblFilePath.Width   := PageUpload.SurfaceWidth - 110;

  { ── TMemo de validación (reemplaza al TLabel anterior) ──────
    Altura fija de 120px con scroll vertical.
    Muestra en verde si el .env es válido,
    en rojo con lista detallada si tiene errores.
    ReadOnly evita que el usuario modifique el mensaje.
    ─────────────────────────────────────────────────────────── }
  MemoValidation := TMemo.Create(PageUpload);
  MemoValidation.Parent      := PageUpload.Surface;
  MemoValidation.Left        := 0;
  MemoValidation.Top         := 80;
  MemoValidation.Width       := PageUpload.SurfaceWidth;
  MemoValidation.Height      := 120;          { Altura fija — ajusta a tu gusto }
  MemoValidation.ReadOnly    := True;          { Solo lectura: el usuario no puede editar }
  MemoValidation.ScrollBars  := ssVertical;    { Scroll vertical cuando el texto desborda }
  MemoValidation.WordWrap    := True;          { Ajuste de línea automático }
  MemoValidation.Text        := '';            { Vacío hasta que se seleccione un archivo }
  MemoValidation.Color       := clWindow;      { Fondo blanco igual que un edit normal }

  { Sugerencia para el usuario cuando no sube archivo }
  LblUploadHint := TLabel.Create(PageUpload);
  LblUploadHint.Parent    := PageUpload.Surface;
  LblUploadHint.Caption   := 'Si no subes archivo, puedes llenar los campos manualmente en los siguientes pasos.';
  LblUploadHint.Left      := 0;
  LblUploadHint.Top       := 210;             { Debajo del memo (80 + 120 + margen) }
  LblUploadHint.Width     := PageUpload.SurfaceWidth;
  LblUploadHint.WordWrap  := True;

  { ══ Página 1: Entorno, logos y timeout ══════════════════════
    Configura el entorno de ejecución (production / development),
    rutas de los logos y el timeout global de las peticiones.
    ─────────────────────────────────────────────────────────── }
  PageEnv1 := CreateCustomPage(PageUpload.ID,
    'Configuración general',
    'Define el entorno, nombre del proyecto y logos.');
  YPos := 0;

  { Combo entorno: production (0) | development (1) }
  cmbNodeEnv := AddComboField(PageEnv1, YPos, 'VITE_NODE_ENV — Entorno de ejecución');
  cmbNodeEnv.Items.Add('production');
  cmbNodeEnv.Items.Add('development');
  cmbNodeEnv.ItemIndex := 0;
  cmbNodeEnv.OnChange  := @NodeEnvChange;  { Actualiza visibilidad SSL al cambiar }

  { Ruta al logo del proyecto cliente }
  edtPathLogoBrand := AddBrowseField(PageEnv1, YPos,
    'VITE_PATH_LOGO_BRAND — Logo del proyecto (imagen)', '', BtnLogoBrand);
  BtnLogoBrand.OnClick := @BrowseLogoBrandClick;

  { Ruta al logo de Cistem }
  edtPathLogoCistem := AddBrowseField(PageEnv1, YPos,
    'VITE_PATH_LOGO_CISTEM — Logo Cistem (imagen)', '', BtnLogoCistem);
  BtnLogoCistem.OnClick := @BrowseLogoCistemClick;

  { Timeout en milisegundos para peticiones al backend }
  edtTimeout := AddField(PageEnv1, YPos,
    'VITE_TIMEOUT — Tiempo de espera en ms', '8000');

  { ══ Página 2: URLs de backend y puerto del frontend ═════════
    Configura los endpoints de las APIs y el puerto local.
    ─────────────────────────────────────────────────────────── }
  PageEnv2 := CreateCustomPage(PageEnv1.ID,
    'Conexión al backend',
    'URLs de los servicios backend y puerto del frontend.');
  YPos := 0;

  edtAppPort := AddField(PageEnv2, YPos,
    'VITE_APP_PORT * — Puerto donde corre el frontend', '92');
  edtApiApp  := AddField(PageEnv2, YPos,
    'VITE_API_APP * — URL del backend principal (APP)', 'http://localhost:91');
  edtApiAuth := AddField(PageEnv2, YPos,
    'VITE_API_AUTH * — URL del backend de autenticación (AUTH)', 'http://localhost:9091');

  { ══ Página 3: Red, HTTPS y certificados SSL ═════════════════
    Solo visible en modo production.
    Configura host, HTTPS y rutas a los archivos de certificado.
    ─────────────────────────────────────────────────────────── }
  PageEnv3 := CreateCustomPage(PageEnv2.ID,
    'Red y certificados SSL',
    'Configura el host, HTTPS y las rutas de tus certificados SSL.');
  YPos := 0;

  { Host / dominio (vacío = localhost) — LblHost guardado para ocultar }
  edtHost  := AddFieldEx(PageEnv3, YPos,
    'VITE_HOST — Host o dominio (dejar vacío para localhost)', '', LblHost);

  { Combo HTTPS: NO (0) | YES (1) — LblHttps guardado para ocultar }
  cmbHttps := AddComboFieldEx(PageEnv3, YPos,
    'VITE_HTTPS — ¿Usar HTTPS?', LblHttps);
  cmbHttps.Items.Add('NO');
  cmbHttps.Items.Add('YES');
  cmbHttps.ItemIndex := 0;

  { Certificado SSL (.crt / .pem) — LblSslCert guardado para ocultar }
  edtSslCert := AddBrowseFieldEx(PageEnv3, YPos,
    'VITE_SSL_CERT — Certificado (.crt / .pem)', '',
    BtnSslCert, LblSslCert);
  BtnSslCert.OnClick := @BrowseSslCertClick;

  { Clave privada SSL (.key / .pem) — LblSslKey guardado para ocultar }
  edtSslKey := AddBrowseFieldEx(PageEnv3, YPos,
    'VITE_SSL_KEY — Clave privada (.key / .pem)', '',
    BtnSslKey, LblSslKey);
  BtnSslKey.OnClick := @BrowseSslKeyClick;

  { Aplica visibilidad inicial (production por defecto → campos SSL visibles) }
  UpdateSslFieldsVisibility();
end;


{ ══════════════════════════════════════════════════════════════
  WriteEnvFile
  ──────────────────────────────────────────────────────────────
  Genera el archivo .env en el directorio de instalación
  con todos los valores recogidos en el formulario.
  Se ejecuta justo antes de que comiencen a copiarse archivos
  (ver CurStepChanged).
  ══════════════════════════════════════════════════════════════ }
procedure WriteEnvFile();
var
  EnvPath : String;
  AppDir  : String;
  Lines   : String;
  HttpsVal: String;
begin
  AppDir := ExpandConstant('{app}');

  { Asegura que el directorio de instalación exista }
  if not DirExists(AppDir) then
    ForceDirectories(AppDir);

  EnvPath := AppDir + '\.env';

  { Convierte la selección del combo a valor de variable }
  if cmbHttps.ItemIndex = 1 then
    HttpsVal := 'OK'
  else
    HttpsVal := '';

  { Construye el contenido completo del .env }
  Lines :=
      '#* Generado por MonitAgent FrontEnd Installer'                                    + #13#10
    + 'VITE_NODE_ENV="'         + cmbNodeEnv.Items[cmbNodeEnv.ItemIndex]           + '"' + #13#10
    + 'VITE_BRAND="MonitTray-FE"'                                                        + #13#10
    + 'VITE_COPYRIGHT="Cistem Innovacion"'                                               + #13#10
    + 'VITE_VERSION="1.1.1"'                                                             + #13#10
    + 'VITE_PATH_LOGO_BRAND="'  + edtPathLogoBrand.Text                           + '"' + #13#10
    + 'VITE_PATH_LOGO_CISTEM="' + edtPathLogoCistem.Text                          + '"' + #13#10
    + 'VITE_API_APP="'          + edtApiApp.Text                                  + '"' + #13#10
    + 'VITE_API_AUTH="'         + edtApiAuth.Text                                 + '"' + #13#10
    + 'VITE_APP_PORT="'         + edtAppPort.Text                                 + '"' + #13#10
    + 'VITE_HOST="'             + edtHost.Text                                    + '"' + #13#10
    + 'VITE_HTTPS="'            + HttpsVal                                        + '"' + #13#10
    + 'VITE_SSL_CERT="'         + edtSslCert.Text                                 + '"' + #13#10
    + 'VITE_SSL_KEY="'          + edtSslKey.Text                                  + '"' + #13#10
    + 'VITE_TIMEOUT="'          + edtTimeout.Text                                 + '"' + #13#10
    + '_SYS_CK1="cc0b3aa742db3db0c4d7925d7b308ca57c3788a78494da4b2c70650f560ea680"'      + #13#10
    + '_SYS_CK2="89c0364622ecfc31953d1a566cf99a19c3203f2b1d1919bc63901010e2608633"'      + #13#10;

  SaveStringToFile(EnvPath, Lines, False);
end;


{ ══════════════════════════════════════════════════════════════
  CopySslFiles
  ──────────────────────────────────────────────────────────────
  Si el usuario proporcionó archivos SSL, los copia a la
  carpeta (app) ssl para que el servidor los encuentre.
  Se ejecuta antes de WriteEnvFile (ver CurStepChanged).
  ══════════════════════════════════════════════════════════════ }
procedure CopySslFiles();
var
  SslDir  : String;
  CertDest: String;
  KeyDest : String;
begin
  SslDir := ExpandConstant('{app}\ssl');

  { Crea la carpeta ssl si no existe }
  if not DirExists(SslDir) then
    CreateDir(SslDir);

  { Copia el certificado si se seleccionó y el archivo existe }
  if (edtSslCert.Text <> '') and FileExists(edtSslCert.Text) then
  begin
    CertDest := SslDir + '\' + ExtractFileName(edtSslCert.Text);
    CopyFile(edtSslCert.Text, CertDest, False);
  end;

  { Copia la clave privada si se seleccionó y el archivo existe }
  if (edtSslKey.Text <> '') and FileExists(edtSslKey.Text) then
  begin
    KeyDest := SslDir + '\' + ExtractFileName(edtSslKey.Text);
    CopyFile(edtSslKey.Text, KeyDest, False);
  end;
end;


{ ══════════════════════════════════════════════════════════════
  CurStepChanged
  ──────────────────────────────────────────────────────────────
  Evento que dispara Inno Setup en cada cambio de paso.
  En ssInstall (justo antes de copiar archivos):
    1) Copia los certificados SSL a (app)\ssl
    2) Escribe el archivo .env en (app)
  ══════════════════════════════════════════════════════════════ }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    CopySslFiles();
    WriteEnvFile();
  end;
end;
