/**
  *
  * @param {Object} listRegex - Lista de expresiones regulares.
  */
export const listRegex = {
    EMAIL_REGEX: /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/,
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@.#$!%*?&^])[A-Za-z\d@.#$!%*?&]{8,}$/,
    STRING_INT_REGEX: /^\d+$/,
    RFC_REGEX: /^([A-Z,Ñ,&]{3,4}([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[A-Z|\d]{3})$/,
    NUMBER_PHONE_REGEX: /^\d{3}\d{3}\d{4}$/,
    WITHOUT_SPACES: /^\S+(?:\s+)?$/,
    JUST_NUMBERS: /\D+/g,
    FORMAT_NUMBERS: /[^\d.,]/g,
    ADD_DOT: /(\d+)(\d{2})$/,
    JUST_LETTERS: /^[A-Za-z]/,
    EXCLUDE_DIFERENT_LETTERS: /[^A-Za-z\s]+/
,
}