/** Utilidades de formato de texto. */

/** Escapa texto del usuario antes de meterlo en HTML. */
export const escaparHTML = texto => String(texto ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 1250 -> "$1.250" */
export const formatearMoneda = numero => '$' + Math.round(numero).toLocaleString('es-UY');
