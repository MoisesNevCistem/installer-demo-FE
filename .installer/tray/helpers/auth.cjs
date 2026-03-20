// helpers/auth.cjs
const crypto = require("crypto")
const fs     = require("fs")

/**
 * Genera un hash SHA-256 de un texto.
 * @param {string} text
 * @returns {string} Hash en hexadecimal
 */
function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex")
}

/**
 * Lee y parsea un archivo .env dado su ruta.
 * Ignora comentarios y líneas vacías.
 * Elimina comillas dobles de los valores si las tiene.
 * @param {string} envPath - Ruta absoluta al .env
 * @returns {Record<string, string>}
 */
function parseEnv(envPath) {
  const vars = {}
  if (!fs.existsSync(envPath)) return vars
  const lines = fs.readFileSync(envPath, "utf8").split("\n")
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
  return vars
}

/**
 * Autentica una contraseña comparando su SHA-256
 * contra _SYS_CK1 (dev) y _SYS_CK2 (support) en el .env.
 * La ruta del .env la provee tray.cjs (ya resuelta con registro + fallbacks).
 * @param {string} password - Contraseña en texto plano ingresada por el usuario
 * @param {string} envPath  - Ruta absoluta al .env, pasada desde tray.cjs
 * @returns {"dev"|"support"|null} Rol autenticado o null si falla
 */
function authenticate(password, envPath) {
  const envVars = parseEnv(envPath)
  const hash    = sha256(password)
  if (hash === envVars["_SYS_CK1"]) return "dev"
  if (hash === envVars["_SYS_CK2"]) return "support"
  return null
}

module.exports = { authenticate, sha256 }