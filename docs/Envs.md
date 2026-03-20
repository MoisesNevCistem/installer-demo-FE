# **Variables de Entorno**

Esta sección es creada con el propósito de explicar el procedimiento con las variables de entorno de la aplicación.

## 🌐 **Variables Globales**

Definición y estandarización de variables de entorno generalizadas de la aplicación:

| Variable                  | Descripción                                    | Requerido | Ejemplo                                                                  |
| -------------------       | ---------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `VITE_BRAND`              | Define el nombre del producto                  | Si        | `Cistem Innovation`                                                      |
| `VITE_COPYRIGHT`          | Define los derechos reservados                 | Si        | `Cistem Innovaci&oacute;n &reg; Casa de Software. All Rights Reserved.`  | 
| `VITE_NODE_ENV`           | Define el tipo de entorno                      | Si        | `development` o `production`                                             |
| `VITE_PATH_LOGO_BRAND`    | Define la ruta del archivo de la marca         | Si        | `./brand/cistem.svg`                                                     |
| `VITE_PATH_LOGO_CISTEM`   | Define la ruta del archivo de la marca         | Si        | `./brand/cistem.svg`                                                     |
| `VITE_VERSION`            | Define la versión del producto                 | Si        | `1.5.0-beta`                                                             |

## 💚 **Variables de Puertos BackEnd y FrontEnd**

Definición y estandarización de variables de entorno para puertos de aplicación:

| Variable                  | Descripción                                    | Requerido | Ejemplo                                                                  |
| -------------------       | ---------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `VITE_API_APP`            | Define la url de servicios backend             | Si        | `http://000.000.00.000:00`                                               |
| `VITE_API_AUTH`           | Define la url de servicios backend             | Si        | `http://000.000.00.000:00`                                               |
| `VITE_APP_PORT`           | Define los puertos de la aplicación            | Si        | `5000`                                                                   |

**NOTAS:**

- El servidor **App** hace referencia a la entidad que proveerá los servicios globales de la aplicación.
- El servidor **Auth** hace referencia a la entidad que proveerá los servicios de autenticación de la aplicación.

## 🛜 **Variables de Configuración para HTTPS**

Definición y estandarización de variables para configuración del entorno HTTPS:

| Variable                  | Descripción                                    | Requerido | Ejemplo                                                                  |
| -------------------       | ---------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `VITE_HOST`               | Define el nombre del Host para desplegar HTTPS | Si        | `https://devfront.nodo.uno:3001/#/`                                      |
| `VITE_HTTPS`              | Habilita la utilización de HTTPS               | Si        | `OK` o ''                                                                |
| `VITE_SSL_CERT`           | Define la ruta absoluta de Certificación SSL   | Si        | `./deploy/ssl/nodo_uno.key`                                              |
| `VITE_SSL_KEY`            | Define la ruta absoluta de Certificación SSL   | Si        | `./shared/ssl/nodo_uno.crt`                                              |

## ⏱️ **Variables de Tiempo**

Definición y estandarización de variables para configuración del tiempo de espera al realizar peticiones:

| Variable                  | Descripción                                    | Requerido | Ejemplo                                                                  |
| -------------------       | ---------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `VITE_TIMEOUT`            | Define el tiempo de respuesta al servidor      | Si        | `8000`                                                                   |

**NOTAS:**

- Para dominar la notación de tiempo en estas variables, se debe seguir el estándar documentado en **[Time Notation](./TimeNotation.md)**.