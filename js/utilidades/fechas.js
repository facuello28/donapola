/** Utilidades de fechas. Las fechas de entrega se guardan como texto "YYYY-MM-DD". */

export const obtenerFechaHoy = () => {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    return fecha;
};

export const calcularDiferenciaDias = fechaString => Math.round((new Date(fechaString + 'T00:00') - obtenerFechaHoy()) / 864e5);

export const formatearEtiquetaFecha = fechaString => {
    const diasDif = calcularDiferenciaDias(fechaString);
    if (diasDif === 0) return 'Hoy';
    if (diasDif === 1) return 'Mañana';
    if (diasDif < 0) return 'Atrasado';
    return new Date(fechaString + 'T00:00').toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Hoy como "YYYY-MM-DD" en hora local. */
export const fechaHoyIso = () =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
