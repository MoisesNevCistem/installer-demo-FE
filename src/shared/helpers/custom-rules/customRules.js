import { listRegex } from './regex/list.js';


/**
 * Objeto que contiene funciones de validación comunes.
 * @type {Object}
 */
export const customRules = {
    /**
   * Valida si el valor es un número.
   * @param {any} value - Valor a validar.
   * @returns {string} - Mensaje de error o cadena vacía si es válido.
   */
    onlyNumber: (value) => isNaN(value) ? 'El campo debe ser numérico' : '',

    /**
     * Valida el formato de un correo electrónico.
     * @param {string} value - Correo electrónico a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    formatEmail: (value) => listRegex.EMAIL_REGEX.test(value) ? '' : 'El correo electrónico no es válido',

    /**
     * Valida la longitud mínima de una cadena.
     * @param {string} value - Cadena a validar.
     * @param {number} length - Longitud mínima permitida.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    minLength: (value, length) => value.length < length ? 'El campo no cumple con los caracteres suficientes' : '',

    /**
     * Valida la longitud máxima de una cadena.
     * @param {string} value - Cadena a validar.
     * @param {number} length - Longitud máxima permitida.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    maxLength: (value, length) => value.length > length ? 'El campo excede los caracteres permitidos' : '',

    /**
     * Valida que el valor no esté vacío.
     * @param {any} value - Valor a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    notEmpty: (value) => value === '' ? 'El campo es requerido' : '',

    /**
     * Valida la complejidad de una contraseña.
     * @param {string} value - Contraseña a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    isPassword: (value) => listRegex.PASSWORD_REGEX.test(value) ? '' : 'El campo contraseña no es válido',

    /**
     * Valida que dos contraseñas sean iguales.
     * @param {string} value1 - Primera contraseña.
     * @param {string} value2 - Segunda contraseña a comparar.
     * @returns {string} - Mensaje de error o cadena vacía si son iguales.
     */
    samePassword: (value1, value2) => {
        return value1 === value2 ? '' : 'Las contraseñas no coinciden'
    },

    /**
     * Valida que el valor sea una cadena.
     * @param {any} value - Valor a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    isString: (value) => typeof value === 'string' ? '' : 'El campo no es string',

    /**
     * Valida que una cadena contenga solo dígitos.
     * @param {string} value - Cadena a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    isStringInteger: (value) => listRegex.STRING_INT_REGEX.test(value) ? '' : 'El campo no es válido',

    /**
     * Valida si un valor comienza con el dígito '0'.
     * @param {string} value - El valor a validar.
     * @returns {string} - Un mensaje de error si el valor comienza con '0', o una cadena vacía si es válido.
     */
    isStartWithZero: (value) => value[0] === '0' ? 'El campo no es válido' : '',

    /**
     * Valida el formato de un RFC.
     * @param {string} value - RFC a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    formatRfc: (value) => listRegex.RFC_REGEX.test(value) ? '' : 'El RFC no es válido',

    /**
     * Valida si el RFC es de dominio publico.
     * @param {string} value - RFC no permitido por ser de dominio publico
     * @returns 
     */
    invalidRfc: (value) => {
        const publicRfc = [
            'XAXX010101000',
            'XEXX010101000',
        ]

        return publicRfc.includes(value) ? 'RFC no valido "Publico en General"' : ''
    },

    isArray: (value) => !(value instanceof Array) ? 'Lista de correos no valida' : '',

    isEmptyArray: (value) => value.length === 0 ? 'La lista de correos es requerida' : '',

    isArrayEmails: ( value ) => {
        for (const email of value) {
            return listRegex.EMAIL_REGEX.test(email) ? '' : 'El correo electrónico no es válido';
        }
    },

    /**
     * Valida si el RFC es un Correo Electronico o un Número de Teléfono.
     * @param {string} isUser - Es un usuario valido
     * @returns 
     */
    isUser: (value) => {

        return listRegex.EMAIL_REGEX.test( value ) || listRegex.NUMBER_PHONE_REGEX.test( value ) 
        ? '' 
        : "El campo no cumple con el formato valido";

    },

    /**
     * Valida que una cadena contenga solo dígitos con decimales antes de los dos ultimos numeros.
     * @param {string} value - Cadena a validar.
     * @returns {string} - Mensaje de error o cadena vacía si es válido.
     */
    isNumberDot: (value) => !listRegex.FORMAT_NUMBERS.test(value) ? '' : 'El campo no es válido',

    hasSpaces: (value) => listRegex.WITHOUT_SPACES.test(value) === true ? '': 'El campo no permite espacios',

    anyZero: (value) => { if( value === '0' || value === '0.00' || value === '.00' ) return 'EL campo no es valído'; },
    
    hasZero: (value) => value.includes('0') ? 'El campo no es válido' : '',

    /**
     * Valida que se permita iniciar solo con un cero, pero que si hay mas digitos despues que devuelva un error
     * @function
     * @name isJustZero
     * @param {number} value - El valor a validar.
     * @returns 
     */
    isJustZero: (value) => {
        // Convertir el valor a string
        let valueStr = String(value);

        // Verificar si el valor es exactamente "0"
        if (valueStr === "0") {
            return "";
        }

        // Verificar si el valor comienza con un cero pero tiene más dígitos después
        if (valueStr.startsWith("0") && valueStr.length > 1) {
            return "El campo no es válido.";
        }

    },

    onlyLetters: (value) => listRegex.JUST_LETTERS.test(value) ? '' : 'El campo no es válido',
};