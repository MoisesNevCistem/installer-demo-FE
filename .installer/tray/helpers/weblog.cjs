// ============================================================
// weblog.cjs — Bitácora diaria para MonitAgent FrontEnd
// Estructura: {INSTALL_ROOT}/weblog/YYYYMMDD/weblog.txt
// ============================================================

"use strict"

const fs   = require("fs")
const path = require("path")

// ============================================================
// ESTADO INTERNO
// ============================================================

let _weblogDir  = null
let _currentDay = null
let _stream     = null

// ============================================================
// UTILIDADES PRIVADAS
// ============================================================

/**
 * Devuelve la fecha actual en formato YYYYMMDD.
 * Ejemplo: 20260323
 * @returns {string}
 */
function _today() {
  const d   = new Date()
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/**
 * Devuelve la hora actual en formato HH:MM:SS (24h, es-MX).
 * @returns {string}
 */
function _timestamp() {
  return new Date().toLocaleTimeString("es-MX", { hour12: false })
}

/**
 * Formatea un mensaje agregando timestamp a cada línea no vacía.
 * @param {string} message
 * @returns {string}
 */
function _format(message) {
  const ts = _timestamp()
  return message
    .toString()
    .split("\n")
    .map(line => line.trim() ? `[${ts}] ${line}` : line)
    .join("\n")
}

/**
 * Abre (o reabre) el stream apuntando al archivo del día actual.
 * - Crea la carpeta del día si no existe: weblog/YYYYMMDD/
 * - Crea weblog.txt si no existe; si existe agrega al final (flag "a").
 * - Si ya había un stream de un día anterior lo cierra limpiamente.
 */
function _openStream() {
  const day = _today()

  // Ya está abierto el stream del día de hoy — no hacer nada
  if (_stream && _currentDay === day) return

  // Cerrar stream del día anterior si existe
  if (_stream) {
    try { _stream.end() } catch (_) {}
    _stream = null
  }

  _currentDay = day

  // Crear carpeta del día: weblog/20260323/
  const dayDir = path.join(_weblogDir, day)
  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true })
  }

  // Abrir (o crear) weblog/20260323/weblog.txt
  const filePath = path.join(dayDir, "weblog.txt")
  _stream = fs.createWriteStream(filePath, { flags: "a", encoding: "utf8" })
  _stream.on("error", (err) => {
    console.error(`[Weblog] Error en stream (${filePath}):`, err.message)
  })
}

// ============================================================
// API PÚBLICA
// ============================================================

/**
 * Inicializa el sistema de bitácora.
 * Debe llamarse UNA sola vez al arrancar la app, pasando la raíz
 * de instalación para que sepa dónde crear la carpeta weblog/.
 *
 * Crea automáticamente:
 *   {installRoot}/weblog/
 *   {installRoot}/weblog/YYYYMMDD/
 *   {installRoot}/weblog/YYYYMMDD/weblog.txt
 *
 * @param {string} installRoot - Ruta absoluta a la raíz de instalación
 */
function initLogger(installRoot) {
  _weblogDir = path.join(installRoot, "weblog")

  // Crear carpeta base weblog/ si no existe
  if (!fs.existsSync(_weblogDir)) {
    fs.mkdirSync(_weblogDir, { recursive: true })
  }

  _openStream()

  // Encabezado de sesión al abrir
  const now = new Date().toLocaleString("es-MX")
  _stream.write(
    `\n${"=".repeat(60)}\n` +
    `  MonitAgent FrontEnd — Sesión iniciada: ${now}\n` +
    `${"=".repeat(60)}\n`
  )
}

/**
 * Escribe un mensaje libre en la bitácora del día.
 * Rota automáticamente a medianoche si el día cambió.
 * Todo lo que pasa por appendLog() en tray.cjs llega aquí.
 * @param {string} message - Texto a escribir
 */
function writeLog(message) {
  if (!_weblogDir || !_stream) return

  // Rotar automáticamente si cambió el día (medianoche)
  if (_today() !== _currentDay) _openStream()

  _stream.write(_format(message))
}

/**
 * Registra un evento de ciclo de vida del servidor.
 *
 * Eventos soportados:
 *   START   — servidor iniciando
 *   READY   — servidor listo y escuchando
 *   STOP    — servidor detenido manualmente
 *   RESTART — servidor reiniciado
 *   CRASH   — servidor caído con código de error
 *
 * @param {"START"|"READY"|"STOP"|"RESTART"|"CRASH"} event
 * @param {string} [detail] - Información extra (puerto, código de salida, etc.)
 */
function logServerEvent(event, detail = "") {
  const labels = {
    START:   "▶  Servidor INICIADO",
    READY:   "✅ Servidor LISTO",
    STOP:    "⏹  Servidor DETENIDO",
    RESTART: "🔄 Servidor REINICIADO",
    CRASH:   "💥 Servidor CAÍDO",
  }
  const label = labels[event] ?? event
  const line  = detail ? `${label}: ${detail}` : label
  writeLog(`\n[SERVIDOR] ${line}\n`)
}

/**
 * Registra una modificación al archivo .env.
 *
 * @param {string} [user]  - Usuario que realizó el cambio (default: "operador")
 * @param {string} [note]  - Nota o detalle adicional opcional
 */
function logEnvChange(user = "operador", note = "") {
  const base = `[ENV] Variables de entorno modificadas por: ${user}`
  const line = note ? `${base} — ${note}` : base
  writeLog(`\n${line}\n`)
}

/**
 * Cierra el stream de escritura limpiamente.
 * Llamar antes de que la app termine (app.quit).
 */
function closeLogger() {
  if (_stream) {
    const now = new Date().toLocaleString("es-MX")
    _stream.write(
      `\n${"=".repeat(60)}\n` +
      `  MonitAgent FrontEnd — Sesión cerrada: ${now}\n` +
      `${"=".repeat(60)}\n`
    )
    try { _stream.end() } catch (_) {}
    _stream = null
  }
}

module.exports = { initLogger, writeLog, logServerEvent, logEnvChange, closeLogger }