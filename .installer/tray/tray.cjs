// ============================================================
// tray.cjs — Proceso principal de Electron para MonitAgent FrontEnd
// ============================================================

const { app, Tray, Menu, BrowserWindow, ipcMain, crashReporter } = require("electron")
const path = require("path")
const { spawn, exec } = require("child_process")
const http = require("http")
const net  = require("net")
const fs   = require("fs")
const { execSync } = require("child_process")

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

crashReporter.start({ uploadToServer: false })

let tray = null
let logWindow = null
let envWindow = null
let restarting = false
let serverProcess = null
let logBuffer = ""
let autoRestartEnabled = true
let startupTimer = null
let serverState = "starting"
let startedAt = null

const LOG_MAX_BYTES     = 512 * 1024
const HEALTH_INTERVAL   = 10000
const RESTART_DELAY     = 3000
const MAX_AUTO_RESTARTS = 5
const STARTUP_TIMEOUT   = 15000
const HEALTH_FAIL_THRESHOLD = 3

let autoRestartCount = 0
let healthFailCount  = 0
let healthChecking   = false
let cachedEnvVars    = null
let envLastModified  = 0

function appendLog(data) {
  const ts = new Date().toLocaleTimeString("es-MX", { hour12: false })
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
}

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
      let val = line.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      vars[key] = val
    }
  } catch (err) {
    appendLog(`[Error] No se pudo leer .env: ${err.message}\n`)
  }
  return vars
}

// ============================================================
// DETECCIÓN DE RUTA — lee registro escrito por el .iss
// Clave: HKLM\SOFTWARE\Cistem Innovacion\MonitTray-FE
// ============================================================

function getInstallPath() {
  const keys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Cistem Innovacion\\MonitTray-FE',
    'HKLM\\SOFTWARE\\Cistem Innovacion\\MonitTray-FE',
    'HKCU\\SOFTWARE\\Cistem Innovacion\\MonitTray-FE',
  ]
  for (const key of keys) {
    try {
      const result = execSync(`reg query "${key}" /v InstallPath`, { encoding: "utf8" })
      const match = result.match(/InstallPath\s+REG_SZ\s+(.+)/)
      if (match) return match[1].trim()
    } catch {}
  }
  return null
}

const IS_PACKAGED = app.isPackaged

function resolveInstallRoot() {
  if (!IS_PACKAGED) {
    return path.resolve(__dirname, "../../")
  }

  // 1. Registro — escrito por el instalador .iss
  const fromRegistry = getInstallPath()
  if (fromRegistry && fs.existsSync(fromRegistry)) {
    appendLog(`[DEBUG] InstallRoot desde registro: ${fromRegistry}\n`)
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

function getEnvVars() {
  try {
    const mtime = fs.statSync(ENV_PATH).mtimeMs
    if (mtime !== envLastModified) {
      cachedEnvVars = parseEnvFile(ENV_PATH)
      envLastModified = mtime
    }
  } catch {}
  return cachedEnvVars || {}
}

function syncButtonState() {
  if (logWindow) logWindow.webContents.send("button-state", serverState)
}

function setServerState(state) {
  serverState = state
  syncButtonState()
}

function killPort(port, callback) {
  exec(
    `for /f "tokens=5" %a in ('netstat -aon ^| findstr LISTENING ^| findstr :${port}') do taskkill /PID %a /F /T`,
    () => { callback && callback() }
  )
}

function isPortInUse(port, callback) {
  const req = http.request({
    host: "127.0.0.1", port, method: "GET", timeout: 1000, path: "/"
  }, () => callback(true))
  req.on("error", () => callback(false))
  req.on("timeout", () => { req.destroy(); callback(false) })
  req.end()
}

function checkAgent(callback) {
  const envVars = getEnvVars()
  const port = parseInt(process.env._VITE_REAL_PORT)
            || parseInt(envVars.VITE_APP_PORT)
            || 92

  const socket = new net.Socket()
  let done = false
  socket.setTimeout(3000)
  socket.connect(port, "127.0.0.1", () => { done = true; socket.destroy(); callback(true) })
  socket.on("error",   () => { if (!done) { done = true; socket.destroy(); callback(false) } })
  socket.on("timeout", () => { if (!done) { done = true; socket.destroy(); callback(false) } })
}

function killServer(callback) {
  if (!serverProcess) { callback && callback(); return }
  if (startupTimer) { clearTimeout(startupTimer); startupTimer = null }

  const pid = serverProcess.pid
  serverProcess.removeAllListeners()
  serverProcess = null
  process.env._VITE_REAL_PORT = ""

  const envVars = getEnvVars()
  const port = parseInt(envVars.VITE_APP_PORT) || 92

  exec(`taskkill /PID ${pid} /F /T`, () => {
    killPort(port, () => {
      setTimeout(() => { callback && callback() }, 1000)
    })
  })
}

/* ============================================================
   INICIAR EL PROCESO DEL SERVIDOR
   ============================================================ */
function startServer() {
  const envVars = getEnvVars()
  const port    = parseInt(envVars.VITE_APP_PORT) || 92

  setServerState("starting")

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

  startupTimer = setTimeout(() => {
    appendLog("[Warn] El servidor no respondió tras el timeout de inicio.\n")
    setServerState("stopped")
    startupTimer = null
  }, STARTUP_TIMEOUT)

  serverProcess.stdout.on("data", (data) => {
    appendLog(data)
    const text = data.toString()

    const portMatchVite  = text.match(/Local:\s+http[s]?:\/\/localhost:(\d+)/)
    const portMatchServe = text.match(/Accepting connections at.*:(\d+)/)
    const portMatch      = portMatchVite || portMatchServe
    if (portMatch) {
      process.env._VITE_REAL_PORT = portMatch[1]
      appendLog(`[Tray] Puerto detectado: ${portMatch[1]}\n`)
    }

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
    }
  })

  serverProcess.stderr.on("data", appendLog)

  serverProcess.on("error", (err) => {
    appendLog(`[Error] No se pudo iniciar el proceso: ${err.message}\n`)
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

/* ============================================================
   VENTANA DE LOGS
   ============================================================ */
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

/* ============================================================
   VENTANA DE VARIABLES DE ENTORNO
   ============================================================ */
function openEnvWindow() {
  if (envWindow) { envWindow.focus(); return }

  envWindow = new BrowserWindow({
    width: 720, height: 540,
    title: "Variables de Entorno — .env",
    backgroundColor: "#0d1117",
    icon: ICON_PATH,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })

  let envContent = ""
  let envError   = false
  try {
    envContent = fs.readFileSync(ENV_PATH, "utf8")
  } catch {
    envContent = "# No se encontró el archivo .env\n# Ruta esperada: " + ENV_PATH
    envError   = true
  }

  envWindow.loadFile(path.join(VIEWS_PATH, "envs.editor.html"))

  envWindow.webContents.on("did-finish-load", () => {
    if (envWindow) {
      envWindow.webContents.send("env-init", {
        path:     ENV_PATH,
        content:  envContent,
        hasError: envError
      })
    }
  })

  envWindow.on("closed", () => (envWindow = null))
}

/* ============================================================
   IPC HANDLERS
   ============================================================ */
ipcMain.on("clear-log-buffer", () => {
  logBuffer = ""
  if (logWindow) logWindow.webContents.send("log-update", logBuffer)
})

ipcMain.on("server-start", () => {
  if (!serverProcess && serverState === "stopped") startServer()
})

ipcMain.on("server-stop", () => {
  if (serverProcess && serverState === "running") {
    autoRestartEnabled = false
    setServerState("stopping")
    appendLog("\n[Tray] Deteniendo servidor...\n")
    killServer(() => {
      autoRestartEnabled = true
      tray.setContextMenu(updateMenu(false))
      setServerState("stopped")
      appendLog("[Tray] Servidor detenido.\n")
    })
  }
})

ipcMain.on("server-restart", () => {
  if (serverState === "running") {
    autoRestartEnabled = false
    setServerState("stopping")
    appendLog("\n[Tray] Reiniciando servidor...\n")
    killServer(() => {
      autoRestartEnabled = true
      autoRestartCount   = 0
      startServer()
    })
  }
})

ipcMain.on("save-env", (event, data) => {
  try {
    fs.writeFileSync(ENV_PATH, data)
    envLastModified = 0
    cachedEnvVars   = null
    appendLog("[Tray] .env actualizado — cache invalidada\n")
    event.sender.send("env-saved", true)
  } catch (err) {
    appendLog(`[Error] No se pudo guardar .env: ${err.message}\n`)
    event.sender.send("env-saved", false)
  }
})

ipcMain.on("reload-env", (event) => {
  try {
    const content = fs.readFileSync(ENV_PATH, "utf8")
    event.sender.send("env-content", content)
  } catch {
    event.sender.send("env-content", "# No se pudo leer el archivo .env")
  }
})

/* ============================================================
   MENÚ CONTEXTUAL DEL TRAY
   ============================================================ */
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
        killServer(() => app.quit())
      }
    }
  ])
}

/* ============================================================
   ARRANQUE DE LA APLICACIÓN
   ============================================================ */
app.whenReady().then(() => {
  startedAt = new Date()
  tray = new Tray(ICON_PATH)
  tray.setToolTip("Monit Agent")
  tray.setContextMenu(updateMenu(false))

  const envVars = getEnvVars()
  const port    = parseInt(envVars.VITE_APP_PORT) || 92

  appendLog(`[Tray] Limpiando puerto ${port} antes de arrancar...\n`)
  killPort(port, () => {
    setTimeout(() => startServer(), 500)
  })

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

app.on("browser-window-created", (_, window) => window.setMenuBarVisibility(false))
app.on("window-all-closed", () => { })