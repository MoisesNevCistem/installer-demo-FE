// ============================================================
// server.js — Servidor de producción para MonitAgent FrontEnd
// Sirve el bundle compilado (dist/) con Express
// Soporta HTTP y HTTPS según variables de entorno
// Las variables de entorno las inyecta server.cjs via process.env
// ============================================================

import dotenv from 'dotenv'
dotenv.config({ override: false })
import express           from 'express'
import https             from 'https'
import http              from 'http'
import fs                from 'fs'
import path              from 'path'
import { fileURLToPath } from 'url'

// ── __dirname para ESM (no existe nativamente en ES Modules)
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app = express()

// ── Lee las variables de entorno inyectadas por server.cjs
const {
  VITE_NODE_ENV,
  VITE_BRAND,
  VITE_VERSION,
  VITE_APP_PORT,
  VITE_HTTPS,
  VITE_HOST,
  VITE_SSL_KEY,
  VITE_SSL_CERT
} = process.env

// ── Valida que las variables requeridas para producción existan
// ── Retorna array de variables faltantes
const validateProdVars = () => {
  const missing = []
  if (!VITE_APP_PORT) missing.push('VITE_APP_PORT')
  if (!VITE_BRAND)    missing.push('VITE_BRAND')
  if (!VITE_VERSION)  missing.push('VITE_VERSION')

  // Si usa HTTPS también valida certificados y host
  if (VITE_HTTPS === 'OK' || VITE_HTTPS === 'true') {
    if (!VITE_HOST)     missing.push('VITE_HOST')
    if (!VITE_SSL_CERT) missing.push('VITE_SSL_CERT')
    if (!VITE_SSL_KEY)  missing.push('VITE_SSL_KEY')
  }

  return missing
}

// ── Log de inicio exitoso — muestra protocolo, host y puerto
const message = (protocol) => {
  console.log(`✅ ${VITE_BRAND} ${VITE_VERSION} ha sido inicializado...`)
  console.log(`⚡ ${protocol}${VITE_HOST || 'localhost'}:${VITE_APP_PORT}/`)
  console.log('')
}

// ── Log de error cuando no se encuentra el directorio dist/
const failInit = () => {
  console.log(`❌ ${VITE_BRAND} ${VITE_VERSION} no ha sido inicializado...\n`)
  console.log("- ✨ Inicialización de servidor fallida, ya que no se ha encontrado el directorio 'dist'.")
  console.log("- ✨ Ejecute el comando 'npm run build' para la generación del bundle...\n")
}

// ── Inicialización del servidor
const initServer = () => {
  if (VITE_NODE_ENV === 'production') {

    // Valida variables requeridas antes de arrancar
    const missing = validateProdVars()
    if (missing.length > 0) {
      console.log(`❌ ${VITE_BRAND || 'MonitAgent FrontEnd'} no ha sido inicializado...\n`)
      console.log('- ✨ Faltan las siguientes variables de entorno:')
      missing.forEach(v => console.log(`    → ${v}`))
      console.log('\n👉🏻 NOTA: Edita el archivo .env desde Variables de Entorno en el tray.')
      return
    }

    // Verifica que exista el bundle compilado usando ruta absoluta
    if (!fs.existsSync(path.join(__dirname, 'dist'))) {
      failInit()
      return
    }

    // Sirve los archivos estáticos del dist/ usando ruta absoluta
    app.use(express.static(path.join(__dirname, 'dist')))

    // Redirige todas las rutas al index.html para soporte de SPA (Vue Router)
    app.get(/(.*)/, (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'))
    })

    // ── Modo HTTPS — requiere certificados SSL configurados en .env
    if (VITE_HTTPS === 'OK' || VITE_HTTPS === 'true') {
      try {
        const SSLCredentials = {
          key:  fs.readFileSync(`${VITE_SSL_KEY}`),
          cert: fs.readFileSync(`${VITE_SSL_CERT}`)
        }
        https.createServer(SSLCredentials, app).listen(VITE_APP_PORT, () => {
          message('[HTTPS]: running at https://')
        })
      } catch (error) {
        console.error("❌ Error cargando certificados SSL:", error.message)
        console.error("- ✨ Verifica las rutas en VITE_SSL_CERT y VITE_SSL_KEY")
      }

    // ── Modo HTTP — sin certificados
    } else {
      http.createServer(app).listen(VITE_APP_PORT, () => {
        message('[HTTP]: running at http://')
      })
    }

  // ── Si no está en producción muestra instrucciones
  } else {
    console.log(`❌ ${VITE_BRAND || 'MonitAgent FrontEnd'} ${VITE_VERSION || ''} no ha sido inicializado...\n`)
    console.log("- ✨ Active 'VITE_NODE_ENV' en 'production'.")
    console.log("- ✨ Active 'VITE_HTTPS' en 'OK' si necesita integrar HTTPS.")
    console.log("- ✨ Coloque certificados SSL en 'VITE_SSL_KEY' y 'VITE_SSL_CERT', respectivamente.")
    console.log("- ✨ Coloque número de puerto en 'VITE_APP_PORT'\n")
    console.log('👉🏻 NOTA: Si nada de lo anterior funciona, comuníquese con desarrollo.')
  }
}

initServer()