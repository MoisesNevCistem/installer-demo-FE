// ============================================================
// tray.cjs — Proceso principal de Electron para MonitAgent FrontEnd
// ============================================================

const { app, Tray, Menu, BrowserWindow, ipcMain, crashReporter } = require("electron")
const path = require("path")
const { spawn, exec } = require("child_process")
const http = require("http")
const net = require("net")
const fs = require("fs")
const { execSync } = require("child_process")
const { authenticate } = require("./helpers/auth.cjs")
const { initLogger, writeLog, logServerEvent, logEnvChange, closeLogger } = require("./helpers/weblog.cjs")

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

crashReporter.start({ uploadToServer: false })

// ============================================================
// ESTADO GLOBAL
// ============================================================

let tray        = null
let logWindow   = null
let envWindow   = null
let restarting  = false
let serverProcess = null
let logBuffer   = ""
let autoRestartEnabled = true
let startupTimer = null
let serverState  = "starting"
let startedAt    = null
let currentEnvRole = null

// ============================================================
// CONSTANTES
// ============================================================

const LOG_MAX_BYTES         = 512 * 1024
const HEALTH_INTERVAL       = 10000
const RESTART_DELAY         = 3000
const MAX_AUTO_RESTARTS     = 5
const STARTUP_TIMEOUT       = 15000
const HEALTH_FAIL_THRESHOLD = 3

/**
 * Claves del .env que nunca se muestran ni se pueden editar desde el editor visual.
 * Se reinyectan automáticamente al guardar para que no se pierdan.
 */
const HIDDEN_ENV_KEYS = ["_SYS_CK1", "_SYS_CK2"]

let autoRestartCount = 0
let healthFailCount  = 0
let healthChecking   = false
let cachedEnvVars    = null
let envLastModified  = 0

// ============================================================
// LOGGING
// ============================================================

/**
 * Agrega una línea al buffer de logs con timestamp.
 * Si el buffer supera LOG_MAX_BYTES se recorta desde el inicio.
 * Notifica a la ventana de logs si está abierta.
 * También escribe en la bitácora diaria (weblog).
 * @param {string|Buffer} data - Texto o buffer a agregar
 */
function appendLog(data) {
  const ts  = new Date().toLocaleTimeString("es-MX", { hour12: false })
  const raw = data.toString()
  const timestamped = raw
    .split("\n")
    .map(line => line.trim() ? `[${ts}] ${line}` : line)
    .join("\n")

  logBuffer += timestamped
  if (logBuffer.length > LOG_MAX_BYTES) {
    logBuffer = "[... logs anteriores recortados ...]\n" +
                logBuffer.slice(logBuffer.length - LOG_MAX_BYTES)
  }
  if (logWindow) logWindow.webContents.send("log-update", logBuffer)

  // ── Todo lo que ve la ventana de logs también va al weblog.txt ──
  writeLog(raw)
}

// ============================================================
// MANEJO DEL .env
// ============================================================

/**
 * Parsea un archivo .env y devuelve un objeto clave-valor.
 * Ignora líneas vacías y comentarios (#).
 * Elimina comillas dobles de los valores si las tiene.
 * @param {string} filePath - Ruta absoluta al archivo .env
 * @returns {Record<string, string>}
 */
function parseEnvFile(filePath) {
  const vars = {}
  if (!fs.existsSync(filePath)) return vars
  try {
    const lines = fs.readFileSync(filePath, "utf8").split("\n")
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith("#")) continue
      const eqIdx = line.indexOf("=")
      if (eqIdx === -1) continue
      const key = line.slice(0, eqIdx).trim()
      let val   = line.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      vars[key] = val
    }
  } catch (err) {
    appendLog(`[Error] No se pudo leer .env: ${err.message}\n`)
  }
  return vars
}

/**
 * Filtra las líneas ocultas del contenido del .env antes de enviarlo al editor.
 * Las claves en HIDDEN_ENV_KEYS nunca llegan al frontend.
 * @param {string} content - Contenido crudo del .env
 * @returns {string} Contenido sin las líneas protegidas
 */
function filterHiddenEnvLines(content) {
  return content
    .split("\n")
    .filter(line => {
      const key = line.split("=")[0].trim()
      return !HIDDEN_ENV_KEYS.includes(key)
    })
    .join("\n")
}

/**
 * Devuelve las variables del .env usando caché.
 * Relee el archivo solo si cambió (comparando mtime).
 * @returns {Record<string, string>}
 */
function getEnvVars() {
  try {
    const mtime = fs.statSync(ENV_PATH).mtimeMs
    if (mtime !== envLastModified) {
      cachedEnvVars   = parseEnvFile(ENV_PATH)
      envLastModified = mtime
    }
  } catch {}
  return cachedEnvVars || {}
}

// ============================================================
// DETECCIÓN DE RUTA — lee registro escrito por el .iss
// Clave: HKLM\SOFTWARE\Cistem Innovacion\MonitTray-FE
// ============================================================

/**
 * Lee la clave InstallPath desde el registro de Windows.
 * Intenta en HKLM 64bit, HKLM 32bit y HKCU en ese orden.
 * @returns {string|null} Ruta de instalación o null si no se encontró
 */
function getInstallPath() {
  const keys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Cistem Innovacion\\MonitTray-FE',
    'HKLM\\SOFTWARE\\Cistem Innovacion\\MonitTray-FE',
    'HKCU\\SOFTWARE\\Cistem Innovacion\\MonitTray-FE',
  ]
  for (const key of keys) {
    try {
      const result = execSync(`reg query "${key}" /v InstallPath`, { encoding: "utf8" })
      const match  = result.match(/InstallPath\s+REG_SZ\s+(.+)/)
      if (match) return match[1].trim()
    } catch {}
  }
  return null
}

const IS_PACKAGED = app.isPackaged

/**
 * Resuelve la raíz de instalación de la app.
 * En desarrollo apunta dos niveles arriba del __dirname.
 * En producción usa el registro, luego el directorio del .exe como fallback.
 * @returns {string} Ruta absoluta a la raíz de instalación
 */
function resolveInstallRoot() {
  if (!IS_PACKAGED) {
    return path.resolve(__dirname, "../../")
  }

  // 1. Registro — escrito por el instalador .iss
  const fromRegistry = getInstallPath()
  if (fromRegistry && fs.existsSync(fromRegistry)) {
    return fromRegistry
  }

  // 2. Señal en filesystem junto al .exe
  const fromExe = path.dirname(app.getPath("exe"))
  if (fs.existsSync(path.join(fromExe, "server.cjs"))) return fromExe
  if (fs.existsSync(path.join(fromExe, "dist")))       return fromExe

  // 3. Fallback
  return fromExe
}

const INSTALL_ROOT = resolveInstallRoot()

const SERVER_PATH = IS_PACKAGED
  ? path.join(INSTALL_ROOT, "server.cjs")
  : path.resolve(__dirname, "../../server.cjs")

const ENV_PATH = IS_PACKAGED
  ? path.join(INSTALL_ROOT, ".env")
  : path.resolve(__dirname, "../../.env")

const VIEWS_PATH = path.join(__dirname, "views")
const ICON_PATH  = path.join(__dirname, "Jigglypuff.ico")

// ============================================================
// ESTADO DEL SERVIDOR
// ============================================================

/**
 * Notifica a la ventana de logs el estado actual del servidor
 * para que sincronice sus botones (iniciar / detener / reiniciar).
 */
function syncButtonState() {
  if (logWindow) logWindow.webContents.send("button-state", serverState)
}

/**
 * Cambia el estado del servidor y notifica a la UI.
 * @param {"starting"|"running"|"stopping"|"stopped"} state
 */
function setServerState(state) {
  serverState = state
  syncButtonState()
}

// ============================================================
// UTILIDADES DE RED Y PROCESO
// ============================================================

/**
 * Mata el proceso que esté usando un puerto específico (Windows).
 * @param {number} port
 * @param {Function} [callback]
 */
function killPort(port, callback) {
  exec(
    `for /f "tokens=5" %a in ('netstat -aon ^| findstr LISTENING ^| findstr :${port}') do taskkill /PID %a /F /T`,
    () => { callback && callback() }
  )
}

/**
 * Verifica si un puerto está en uso intentando una conexión HTTP.
 * @param {number} port
 * @param {function(boolean): void} callback
 */
function isPortInUse(port, callback) {
  const req = http.request({
    host: "127.0.0.1", port, method: "GET", timeout: 1000, path: "/"
  }, () => callback(true))
  req.on("error",   () => callback(false))
  req.on("timeout", () => { req.destroy(); callback(false) })
  req.end()
}

/**
 * Verifica si el agente está respondiendo en el puerto configurado.
 * Usa TCP directamente para mayor velocidad que HTTP.
 * @param {function(boolean): void} callback
 */
function checkAgent(callback) {
  const envVars = getEnvVars()
  const port    = parseInt(process.env._VITE_REAL_PORT)
               || parseInt(envVars.VITE_APP_PORT)
               || 92

  const socket = new net.Socket()
  let done = false
  socket.setTimeout(3000)
  socket.connect(port, "127.0.0.1", () => { done = true; socket.destroy(); callback(true)  })
  socket.on("error",   () => { if (!done) { done = true; socket.destroy(); callback(false) } })
  socket.on("timeout", () => { if (!done) { done = true; socket.destroy(); callback(false) } })
}

/**
 * Mata el proceso del servidor y libera el puerto.
 * Limpia listeners y referencias antes de matar para evitar auto-restart involuntario.
 * @param {Function} [callback] - Se llama cuando el proceso ya fue terminado
 */
function killServer(callback) {
  if (!serverProcess) { callback && callback(); return }
  if (startupTimer) { clearTimeout(startupTimer); startupTimer = null }

  const pid = serverProcess.pid
  serverProcess.removeAllListeners()
  serverProcess = null
  process.env._VITE_REAL_PORT = ""

  const envVars = getEnvVars()
  const port    = parseInt(envVars.VITE_APP_PORT) || 92

  exec(`taskkill /PID ${pid} /F /T`, () => {
    killPort(port, () => {
      setTimeout(() => { callback && callback() }, 1000)
    })
  })
}

// ============================================================
// SERVIDOR
// ============================================================

/**
 * Inicia el proceso del servidor Node (server.cjs).
 * - Inyecta las variables del .env al entorno del proceso hijo.
 * - Detecta el puerto real desde stdout (Vite o serve).
 * - Activa auto-restart si el proceso muere con código != 0.
 * - Cancela el timer de startup cuando el servidor confirma estar listo.
 */
function startServer() {
  const envVars = getEnvVars()
  const port    = parseInt(envVars.VITE_APP_PORT) || 92

  setServerState("starting")
  logServerEvent("START")

  if (!fs.existsSync(SERVER_PATH)) {
    appendLog(`[Error] No se encontró server.cjs en: ${SERVER_PATH}\n`)
    appendLog(`[Info]  registry: ${getInstallPath() || "no encontrado"}\n`)
    setServerState("stopped")
    return
  }

  appendLog(`\n[Tray] Iniciando servidor...\n`)
  appendLog(`[Tray] Raíz  : ${INSTALL_ROOT}\n`)
  appendLog(`[Tray] .env  : ${ENV_PATH}\n`)

  if (IS_PACKAGED) {
    appendLog(Object.keys(envVars).length === 0
      ? `[Warn] No se pudieron leer variables del .env\n`
      : `[Tray] Variables cargadas: ${Object.keys(envVars).length}\n`
    )
  }

  serverProcess = spawn("node", [SERVER_PATH], {
    shell: false,
    env: { ...process.env, ...envVars }
  })

  // Timer de seguridad: si no responde en STARTUP_TIMEOUT ms se marca como detenido
  startupTimer = setTimeout(() => {
    appendLog("[Warn] El servidor no respondió tras el timeout de inicio.\n")
    setServerState("stopped")
    startupTimer = null
  }, STARTUP_TIMEOUT)

  serverProcess.stdout.on("data", (data) => {
    appendLog(data)
    const text = data.toString()

    // Detecta el puerto real desde la salida de Vite o serve
    const portMatchVite  = text.match(/Local:\s+http[s]?:\/\/localhost:(\d+)/)
    const portMatchServe = text.match(/Accepting connections at.*:(\d+)/)
    const portMatch      = portMatchVite || portMatchServe
    if (portMatch) {
      process.env._VITE_REAL_PORT = portMatch[1]
      appendLog(`[Tray] Puerto detectado: ${portMatch[1]}\n`)
    }

    // Detecta que el servidor está listo
    if (
      text.includes("ready in") ||
      text.includes("Accepting connections") ||
      text.includes("running at") ||
      (text.includes("Local:") && text.includes("localhost") && !text.includes("➜"))
    ) {
      if (startupTimer) { clearTimeout(startupTimer); startupTimer = null }
      autoRestartCount = 0
      healthFailCount  = 0
      setServerState("running")
      tray.setContextMenu(updateMenu(true))
      appendLog("[Tray] Servidor listo ✓\n")
      logServerEvent("READY", `puerto ${portMatch ? portMatch[1] : port}`)
    }
  })

  serverProcess.stderr.on("data", appendLog)

  serverProcess.on("error", (err) => {
    appendLog(`[Error] No se pudo iniciar el proceso: ${err.message}\n`)
    logServerEvent("CRASH", err.message)
    setServerState("stopped")
  })

  serverProcess.on("close", (code) => {
    if (startupTimer) { clearTimeout(startupTimer); startupTimer = null }
    if (serverProcess !== null) {
      appendLog(`\n[Servidor] Proceso cerrado con código ${code}\n`)
      serverProcess = null
      process.env._VITE_REAL_PORT = ""
      tray.setContextMenu(updateMenu(false))
      setServerState("stopped")

      // Registra en weblog según tipo de cierre
      if (code !== 0 && code !== null) {
        logServerEvent("CRASH", `código de salida ${code}`)
      } else {
        logServerEvent("STOP")
      }

      // Auto-restart si la caída no fue intencional
      if (code !== 0 && code !== null && autoRestartEnabled) {
        if (autoRestartCount < MAX_AUTO_RESTARTS) {
          autoRestartCount++
          appendLog(`[Tray] Caída detectada — reiniciando en ${RESTART_DELAY / 1000}s... (intento ${autoRestartCount}/${MAX_AUTO_RESTARTS})\n`)
          if (logWindow) logWindow.webContents.send("auto-restart-count", autoRestartCount)
          setTimeout(() => startServer(), RESTART_DELAY)
        } else {
          appendLog(`[Tray] Máximo de reinicios alcanzado (${MAX_AUTO_RESTARTS}). Intervención manual requerida.\n`)
          autoRestartCount = 0
          if (logWindow) logWindow.webContents.send("auto-restart-count", 0)
        }
      }
    }
  })

  tray.setContextMenu(updateMenu(true))
}

// ============================================================
// VENTANAS
// ============================================================

/**
 * Abre la ventana de logs.
 * Si ya está abierta la trae al frente.
 * Envía el buffer actual, estado del servidor e info de versión al cargar.
 */
function openLogWindow() {
  if (logWindow) { logWindow.focus(); return }

  logWindow = new BrowserWindow({
    width: 900, height: 600,
    title: "MonitAgent Logs",
    backgroundColor: "#000000",
    icon: ICON_PATH,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })

  logWindow.loadFile(path.join(VIEWS_PATH, "logs.html"))

  logWindow.webContents.on("did-finish-load", () => {
    if (logWindow) {
      const envVars = getEnvVars()
      const version = envVars.VITE_VERSION || "—"
      const started = startedAt ? startedAt.toLocaleString("es-MX") : "—"
      logWindow.webContents.send("log-update", logBuffer)
      logWindow.webContents.send("button-state", serverState)
      logWindow.webContents.send("auto-restart-count", autoRestartCount)
      logWindow.webContents.send("app-info", { version, started })
    }
  })

  logWindow.on("closed", () => (logWindow = null))
}

/**
 * Abre la ventana de variables de entorno.
 * Carga primero envs.login.html — el editor se abre desde tray.cjs
 * solo después de que el usuario se autentica correctamente via IPC.
 * Si ya está abierta la trae al frente.
 */
function openEnvWindow() {
  if (envWindow) { envWindow.focus(); return }

  envWindow = new BrowserWindow({
    width: 720, height: 540,
    title: "Variables de Entorno — .env",
    backgroundColor: "#0d1117",
    icon: ICON_PATH,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })

  // Siempre arranca en el login — nunca directo al editor
  envWindow.loadFile(path.join(VIEWS_PATH, "envs.login.html"))

  envWindow.on("closed", () => (envWindow = null))
}

// ============================================================
// IPC HANDLERS
// ============================================================

/**
 * Limpia el buffer de logs y notifica a la ventana si está abierta.
 * Nota: NO limpia el weblog.txt — la bitácora en disco es permanente.
 */
ipcMain.on("clear-log-buffer", () => {
  logBuffer = ""
  if (logWindow) logWindow.webContents.send("log-update", logBuffer)
})

/** Inicia el servidor si está detenido. */
ipcMain.on("server-start", () => {
  if (!serverProcess && serverState === "stopped") startServer()
})

/** Detiene el servidor manualmente, deshabilitando el auto-restart temporalmente. */
ipcMain.on("server-stop", () => {
  if (serverProcess && serverState === "running") {
    autoRestartEnabled = false
    setServerState("stopping")
    appendLog("\n[Tray] Deteniendo servidor...\n")
    logServerEvent("STOP", "detención manual desde ventana de logs")
    killServer(() => {
      autoRestartEnabled = true
      tray.setContextMenu(updateMenu(false))
      setServerState("stopped")
      appendLog("[Tray] Servidor detenido.\n")
    })
  }
})

/** Reinicia el servidor desde la ventana de logs. */
ipcMain.on("server-restart", () => {
  if (serverState === "running") {
    autoRestartEnabled = false
    setServerState("stopping")
    appendLog("\n[Tray] Reiniciando servidor...\n")
    logServerEvent("RESTART", "reinicio manual desde ventana de logs")
    killServer(() => {
      autoRestartEnabled = true
      autoRestartCount   = 0
      startServer()
    })
  }
})

/**
 * Autentica al usuario usando el hash SHA-256 almacenado en el .env.
 * Si la contraseña es correcta, carga el editor directamente desde tray.cjs
 * e inyecta el contenido del .env filtrado (sin las claves ocultas).
 * Si falla, notifica al login para mostrar el error.
 */
ipcMain.on("env-auth", (event, pass) => {
  const rol = authenticate(pass, ENV_PATH)

  if (rol !== null) {
    currentEnvRole = rol  // ← guarda el rol para usarlo en save-env
    envWindow.loadFile(path.join(VIEWS_PATH, "envs.editor.html"))
    envWindow.webContents.once("did-finish-load", () => {
      let envContent = ""
      let envError   = false
      try {
        envContent = filterHiddenEnvLines(fs.readFileSync(ENV_PATH, "utf8"))
      } catch {
        envContent = "# No se encontró el archivo .env\n# Ruta esperada: " + ENV_PATH
        envError   = true
      }
      if (envWindow) {
        envWindow.webContents.send("env-init", {
          path:     ENV_PATH,
          content:  envContent,
          hasError: envError
        })
      }
    })
  } else {
    event.sender.send("env-auth-result", false)
  }
})

/**
 * Guarda el contenido editado en el .env.
 * Antes de escribir, reinyecta las líneas ocultas (HIDDEN_ENV_KEYS)
 * para que no se pierdan aunque el editor nunca las haya mostrado.
 * Registra el cambio en el weblog con el rol autenticado.
 */
ipcMain.on("save-env", (event, data) => {
  try {
    // Recupera las líneas protegidas del .env actual en disco
    let hiddenLines = ""
    try {
      const current = fs.readFileSync(ENV_PATH, "utf8")
      hiddenLines = current
        .split("\n")
        .filter(line => HIDDEN_ENV_KEYS.includes(line.split("=")[0].trim()))
        .join("\n")
    } catch {}

    // Combina el contenido editado con las líneas protegidas al final
    const finalContent = hiddenLines
      ? data.trimEnd() + "\n" + hiddenLines + "\n"
      : data

    fs.writeFileSync(ENV_PATH, finalContent)
    envLastModified = 0
    cachedEnvVars   = null
    appendLog("[Tray] .env actualizado — hashes preservados\n")

    // ── Registra el cambio en la bitácora con el rol autenticado ──
    logEnvChange(currentEnvRole ?? "Desconocido")
    currentEnvRole = null  // resetea tras guardar

    event.sender.send("env-saved", true)
  } catch (err) {
    appendLog(`[Error] No se pudo guardar .env: ${err.message}\n`)
    event.sender.send("env-saved", false)
  }
})

/**
 * Recarga el contenido del .env y lo envía al editor.
 * Filtra las claves ocultas igual que en la carga inicial.
 */
ipcMain.on("reload-env", (event) => {
  try {
    const content = fs.readFileSync(ENV_PATH, "utf8")
    event.sender.send("env-content", filterHiddenEnvLines(content))
  } catch {
    event.sender.send("env-content", "# No se pudo leer el archivo .env")
  }
})

// ============================================================
// MENÚ CONTEXTUAL DEL TRAY
// ============================================================

/**
 * Construye y devuelve el menú contextual del ícono en la bandeja.
 * @param {boolean} isAlive - true si el servidor está corriendo
 * @returns {Electron.Menu}
 */
function updateMenu(isAlive) {
  return Menu.buildFromTemplate([
    {
      label: restarting
        ? "Estado: 🔄 Reiniciando..."
        : `Estado: ${isAlive ? "🟢 Activo" : "🔴 Detenido"}`
    },
    {
      label: "Reiniciar Agente",
      enabled: isAlive && serverState === "running",
      click: () => {
        autoRestartEnabled = false
        setServerState("stopping")
        appendLog("\n[Tray] Reiniciando agente desde tray...\n")
        logServerEvent("RESTART", "reinicio manual desde tray")
        killServer(() => {
          autoRestartEnabled = true
          autoRestartCount   = 0
          restarting         = false
          startServer()
        })
      }
    },
    { type: "separator" },
    { label: "Ver Logs",             click: openLogWindow },
    { type: "separator" },
    { label: "Variables de Entorno", click: openEnvWindow },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        autoRestartEnabled = false
        logServerEvent("STOP", "salida manual desde tray")
        killServer(() => {
          closeLogger()
          app.quit()
        })
      }
    }
  ])
}

// ============================================================
// ARRANQUE DE LA APLICACIÓN
// ============================================================

/**
 * Punto de entrada principal.
 * - Inicializa la bitácora diaria (weblog).
 * - Crea el ícono de la bandeja.
 * - Limpia el puerto antes de arrancar para evitar conflictos.
 * - Inicia el health check periódico del agente.
 */
app.whenReady().then(() => {
  startedAt = new Date()

  // ── Inicializa la bitácora antes de cualquier appendLog ──
  initLogger(INSTALL_ROOT)

  tray = new Tray(ICON_PATH)
  tray.setToolTip("Monit Agent")
  tray.setContextMenu(updateMenu(false))

  const envVars = getEnvVars()
  const port    = parseInt(envVars.VITE_APP_PORT) || 92

  appendLog(`[Tray] Limpiando puerto ${port} antes de arrancar...\n`)
  killPort(port, () => {
    setTimeout(() => startServer(), 500)
  })

  // Health check periódico — verifica que el agente siga respondiendo
  setInterval(() => {
    if (!restarting && serverState === "running" && !healthChecking) {
      healthChecking = true
      checkAgent((alive) => {
        healthChecking = false
        if (alive) {
          healthFailCount = 0
          tray.setContextMenu(updateMenu(true))
          if (logWindow) logWindow.webContents.send("server-status", "running")
        } else {
          healthFailCount++
          // Solo marca como caído tras HEALTH_FAIL_THRESHOLD fallos consecutivos
          if (healthFailCount >= HEALTH_FAIL_THRESHOLD) {
            healthFailCount = 0
            tray.setContextMenu(updateMenu(false))
            if (logWindow) logWindow.webContents.send("server-status", "stopped")
          }
        }
      })
    }
  }, HEALTH_INTERVAL)
})

/** Oculta la barra de menú en todas las ventanas que se creen. */
app.on("browser-window-created", (_, window) => window.setMenuBarVisibility(false))

/** Evita que la app se cierre al cerrar todas las ventanas (vive en el tray). */
app.on("window-all-closed", () => { })