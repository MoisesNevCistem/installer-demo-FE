// Importaciones de repositorio de reglas
import { customRules } from '../custom-rules/customRules.js';

//* REPOSITORIO DE ESQUEMAS
export const errorScheme = {
    // TODO: AGREGUE LAS VALIDACIONES DE CAMPOS CORRESPONDIENTES
    // NOTE: AGREGAR UNICAMENTE LOS ESQUEMAS DE ERRORES GENERALES
    'TEST_FIELD_ERROR': (value) => {
        return [
            customRules.notEmpty(value),
        ]
    },
}