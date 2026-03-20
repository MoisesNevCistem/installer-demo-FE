// NOTE: IMPORTACIÓN DE CSS GLOBAL
//* Importaciones de estilos globales
import "@/assets/css/global.css";
import "@/assets/css/reset.css";

//* Importaciones globales
import App from './App.vue'
import router from './router'
import { createApp } from 'vue'

//* Importaciones de paqueterias
import { createPinia } from 'pinia'

//? Instancias
const app = createApp(App)
const pinia = createPinia();

// NOTE: AGREGAR LA TECNOLOGIAS(vue-cookies) FALTANTES O FUNCIONES(Interceptor)
app.use( pinia );
app.use( router )

app.mount('#app')
