/**
 * Valores iniciales y normalización de datos guardados o de respaldos:
 * completa lo que falte y migra formatos viejos.
 */

export const CONFIG_DEFAULT = {
    pedidos: [],
    sabores: [
        'Vainilla y chips de colores', 'Chocolate y chips de choco', 'Limón',
        'Chocolate y chips de colores', 'Canela', 'Chocolate y rocklets',
        'Vainilla con galletita', 'Chocolate y maní'
    ],
    precios: { unidad: 80, par: 150, bandeja: 390, brochette: 90 },
    diasAviso: 2
};

// Nombres de precios usados por versiones anteriores de la app
const CLAVES_PRECIOS_ANTERIORES = { u: 'unidad', d: 'par', b: 'bandeja', br: 'brochette', docena_parcial: 'par', caja_seis: 'bandeja' };

// Convierte un pedido de la versión anterior (qty / br / custom) al formato actual.
// Si el pedido ya está en el formato actual, lo devuelve sin cambios.
function migrarPedidoAntiguo(pedido) {
    const esFormatoAnterior = 'qty' in pedido || 'custom' in pedido || 'br' in pedido;
    if (!esFormatoAnterior) return pedido;

    const cantidades = pedido.qty || {};
    const brochettes = pedido.br || 0;
    const totalDonas = Object.values(cantidades).reduce((a, b) => a + b, 0);

    return {
        id: pedido.id, cliente: pedido.cliente, tel: pedido.tel,
        fecha: pedido.fecha, hora: pedido.hora, notas: pedido.notas, estado: pedido.estado,
        cantidades,
        brochettes,
        tipoPaquete: totalDonas === 0 && brochettes > 0 ? 'brochette' : 'custom',
        cantidadCustom: totalDonas,
        precioPersonalizado: !!pedido.custom,
        precio: pedido.precio // el precio ya guardado se respeta
    };
}

// Toma datos guardados o de un respaldo (posiblemente viejos o incompletos)
// y devuelve un estado completo y válido.
export function normalizarEstado(datos) {
    const origen = (datos && typeof datos === 'object') ? datos : {};

    // Precios: traducir nombres viejos y descartar valores que no sean números
    const guardados = { ...origen.precios };
    for (const [vieja, nueva] of Object.entries(CLAVES_PRECIOS_ANTERIORES)) {
        if (guardados[vieja] !== undefined && guardados[nueva] === undefined) guardados[nueva] = guardados[vieja];
    }
    const precios = { ...CONFIG_DEFAULT.precios };
    for (const clave of Object.keys(precios)) {
        const valor = Number(guardados[clave]);
        if (guardados[clave] !== undefined && Number.isFinite(valor) && valor >= 0) precios[clave] = valor;
    }

    return {
        pedidos: Array.isArray(origen.pedidos) ? origen.pedidos.map(migrarPedidoAntiguo) : [],
        sabores: Array.isArray(origen.sabores) ? origen.sabores : [...CONFIG_DEFAULT.sabores],
        precios,
        diasAviso: [1, 2, 3].includes(Number(origen.diasAviso)) ? Number(origen.diasAviso) : CONFIG_DEFAULT.diasAviso
    };
}
