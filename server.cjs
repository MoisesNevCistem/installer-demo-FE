const { spawn } = require("child_process")
const path = require("path")
const fs   = require("fs")
const os   = require("os")
const { execSync } = require("child_process")

function normalizeVal(v) {
  if (!v) return ""
  return v.replace(/^["']|["']$/g, "").trim()
}

function getInstallPath() {
  const keys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Cistem Innovacion\\MonitTray-FE',
    'HKLM\\SOFTWARE\\Cistem Innovacion\\MonitTray-FE',
    'HKCU\\SOFTWARE\\Cistem Innovacion\\MonitTray-FE',
  ]
  for (const key of keys) {
    try {
      const result = execSync(`reg query "${key}" /v InstallPath`, { 
        encoding: "utf8",
        stdio: ['pipe', 'pipe', 'pipe']
      })
      const match  = result.match(/InstallPath\s+REG_SZ\s+(.+)/)
      if (match) return match[1].trim()
    } catch {}
  }
  return null
}

function detectNodeEnv() {
  const fromEnv = normalizeVal(process.env.VITE_NODE_ENV)
               || normalizeVal(process.env.NODE_ENV)
  if (fromEnv) return fromEnv
  const regPath = getInstallPath()
  if (regPath) {
    try {
      const envPath = path.join(regPath, ".env")
      const lines   = fs.readFileSync(envPath, "utf8").split("\n")
      for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith("#")) continue
        const eqIdx = line.indexOf("=")
        if (eqIdx === -1) continue
        const k = line.slice(0, eqIdx).trim()
        if (k === "VITE_NODE_ENV") {
          let val = line.slice(eqIdx + 1).trim()
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
          return val
        }
      }
    } catch {}
  }
  return "production"
}

const nodeEnv    = detectNodeEnv()
const isPackaged = nodeEnv === "production"

const INSTALL_ROOT = isPackaged
  ? (getInstallPath() || __dirname)
  : (getInstallPath() || path.resolve(__dirname))

function getAllEnvVars() {
  const vars = {}
  try {
    const envPath = path.join(INSTALL_ROOT, ".env")
    const lines   = fs.readFileSync(envPath, "utf8").split("\n")
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith("#")) continue
      const eqIdx = line.indexOf("=")
      if (eqIdx === -1) continue
      const k = line.slice(0, eqIdx).trim()
      let val = line.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      vars[k] = val
    }
  } catch {}
  return vars
}

const envVars = getAllEnvVars()
const port    = envVars.VITE_APP_PORT || "92"
const host    = envVars.VITE_HOST     || ""

let command, args, options

if (isPackaged) {
  // ── Producción: lanza server.js con Express
  const serverJs = path.join(INSTALL_ROOT, "server.js")
  console.log("[server.cjs] server.js path:", serverJs)

  command = process.execPath
  args    = [serverJs]
  options = {
    cwd:   INSTALL_ROOT,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    env:   {
      ...process.env,
      ...envVars,
      VITE_NODE_ENV: "production"
    }
  }
} else {
  // ── Desarrollo: lanza Vite con config temporal en %TEMP%
  // ── Evita EPERM en Program Files al escribir caché de Vite
  const rootSlash  = INSTALL_ROOT.replace(/\\/g, '/')
  const tmpDir     = os.tmpdir().replace(/\\/g, '/')
  const tmpConfig  = path.join(os.tmpdir(), 'vite.config.monitfe.mjs')
  const pluginPath = path.join(INSTALL_ROOT, 'node_modules/@vitejs/plugin-vue/dist/index.mjs').replace(/\\/g, '/')

  const configContent = `
    import { defineConfig } from '${rootSlash}/node_modules/vite/dist/node/index.js'
    import vue from '${pluginPath}'
    import { fileURLToPath } from 'url'
    import path from 'path'
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    export default defineConfig({
      root: '${rootSlash}',
      cacheDir: '${tmpDir}/vite-cache-monitfe',
      plugins: [vue()],
      resolve: {
        alias: {
          '@': '${rootSlash}/src'
        }
      },
      server: {
        port: ${port},
        host: '${host || '0.0.0.0'}'
      }
    })
  `
  fs.writeFileSync(tmpConfig, configContent, 'utf8')
  console.log("[server.cjs] vite.config temporal:", tmpConfig)

  command = "cmd"
  args    = [
    "/c", "node",
    path.join(INSTALL_ROOT, "node_modules", "vite", "bin", "vite.js"),
    "--config", tmpConfig
  ]
  options = {
    cwd:   os.tmpdir(),
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    env:   { ...process.env, ...envVars }
  }
}

const child = spawn(command, args, options)
child.stdout.on("data", (data) => process.stdout.write(data.toString()))
child.stderr.on("data", (data) => process.stderr.write(data.toString()))
child.on("error", (err) => {
  process.exit(1)
})
child.on("close", (code) => process.exit(code ?? 0))