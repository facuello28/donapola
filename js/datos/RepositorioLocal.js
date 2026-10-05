/**
 * Guarda y lee los datos en el navegador (localStorage).
 * Cualquier repositorio nuevo (por ejemplo uno que sincronice con un servidor)
 * solo necesita ofrecer estos dos métodos: cargar() y guardar(datos).
 */
const CLAVE = 'donapola';

export class RepositorioLocal {
    cargar() {
        try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; }
    }

    guardar(datos) {
        try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { console.error('No se pudo guardar', e); }
    }
}
