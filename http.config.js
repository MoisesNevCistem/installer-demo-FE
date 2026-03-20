import 'dotenv/config';
import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = decodeURIComponent(path.dirname(__filename).replace(/^\/(\w:)/, '$1'));

const app = express();

const { 
    VITE_NODE_ENV, VITE_VERSION,
    VITE_APP_PORT, VITE_HTTPS, VITE_HOST, 
    VITE_SSL_KEY, VITE_SSL_CERT 
} = process.env;

if ( VITE_NODE_ENV === 'production' && Boolean( VITE_HTTPS ) ) {

    const SSLCredentials = {
        key: fs.readFileSync(`${ VITE_SSL_KEY }`),
        cert: fs.readFileSync(`${ VITE_SSL_CERT }`)
    };

    if ( !fs.existsSync('dist') ) {
        console.log(`❌ [NOMBRE PROYECTO] v${ VITE_VERSION } no ha sido inicializado...\n`);
        console.log("- ✨ Inicialización de servidor fallida, ya que no se ha encontrado el directorio 'dist'.");
        console.log("- ✨ Ejecute el comando 'npm run build' para la generación del bundle...\n");
    }

    app.use( express.static('dist') );
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));

    https.createServer(SSLCredentials, app).listen(VITE_APP_PORT, () => {
        console.log(`✅ [NOMBRE PROYECTO] v${ VITE_VERSION } ha sido inicializado...`);
        console.log(`⚡ [HTTPS]: running at https://${ VITE_HOST }:${ VITE_APP_PORT }/`);
        console.log('');
    });

} else {
    console.log(`❌ [NOMBRE PROYECTO] v${ VITE_VERSION } no ha sido inicializado...\n`);
    console.log(`- ✨ Active 'VITE_NODE_ENV' en 'production'.`);
    console.log(`- ✨ Active 'VITE_HTTPS' en 'OK'.`);
    console.log(`- ✨ Coloque certificados SSL en 'VITE_SSL_KEY' y 'VITE_SSL_CERT', respectivamente.`);
    console.log(`- ✨ Coloque número de puerto en 'VITE_APP_PORT'\n`);
    console.log('👉🏻 NOTA: Si nada de lo anterior funciona, comuníquese con desarrollo.');
}
