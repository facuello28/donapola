import { fechaHoyIso } from '../utilidades/fechas.js';

/** Estados de un pedido, en el orden en que avanzan. */
export const EstadoPedido = Object.freeze({
    A_COMPLETAR: 0,
    COMPLETADO: 1,  // listo, pero todavía no entregado
    ENTREGADO: 2,
    FINALIZADO: 3   // cerrado
});
export const TEXTOS_ESTADO = ['A completar', 'Completado', 'Entregado', 'Finalizado'];
export const TEXTOS_ACCION = ['Marcar completado', 'Marcar entregado', 'Finalizar', 'Reabrir'];

/** Id único. Con UUID no hay choques cuando se sincronicen varios dispositivos. */
function generarId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Un pedido de un cliente. Los nombres de campos son los mismos que ya se guardan en el celular. */
export class Pedido {
    constructor(datos = {}) {
        this.id = datos.id ?? generarId();
        this.cliente = datos.cliente ?? '';
        this.tel = datos.tel ?? '';
        this.fecha = datos.fecha ?? fechaHoyIso();   // "YYYY-MM-DD"
        this.hora = datos.hora ?? '';
        this.tipoPaquete = datos.tipoPaquete ?? '6'; // '1' | '2' | '6' | 'brochette' | 'custom'
        this.brochettes = datos.brochettes ?? 1;
        this.cantidadCustom = datos.cantidadCustom ?? '';
        this.cantidades = { ...datos.cantidades };   // { "Limón": 2, ... }
        this.precioPersonalizado = datos.precioPersonalizado ?? false; // regalo, descuento
        this.precio = datos.precio ?? '';            // precio final (número) una vez guardado
        this.notas = datos.notas ?? '';
        this.estado = datos.estado ?? EstadoPedido.A_COMPLETAR;
        this.actualizadoEn = datos.actualizadoEn ?? Date.now(); // para resolver conflictos al sincronizar
    }

    get totalDonasElegidas() {
        return Object.values(this.cantidades).reduce((a, b) => a + b, 0);
    }

    /** Máximo de donas que se pueden repartir en sabores (0 = sin tope). */
    get limiteDonas() {
        switch (this.tipoPaquete) {
            case '1': return 1;
            case '2': return 2;
            case '6': return 6;
            case 'brochette': return this.brochettes || 1;
            case 'custom': return Number(this.cantidadCustom) || 0;
            default: return 6;
        }
    }

    get estaEnCurso() { return this.estado < EstadoPedido.FINALIZADO; }
    get faltaEntregar() { return this.estado < EstadoPedido.ENTREGADO; }

    cantidadDe(sabor) { return this.cantidades[sabor] || 0; }

    /** Suma o resta donas de un sabor respetando el tope. Devuelve la cantidad resultante. */
    cambiarCantidad(sabor, delta) {
        const tope = this.limiteDonas;
        if (delta > 0 && tope > 0 && this.totalDonasElegidas >= tope) return this.cantidadDe(sabor);
        this.cantidades[sabor] = Math.max(0, this.cantidadDe(sabor) + delta);
        return this.cantidades[sabor];
    }

    cambiarBrochettes(delta) {
        this.brochettes = Math.max(1, (this.brochettes || 1) + delta);
    }

    /** Cambia de paquete y reinicia el reparto de sabores. */
    elegirPaquete(tipo) {
        this.tipoPaquete = tipo;
        this.cantidades = {};
        if (tipo === 'brochette') this.brochettes = 1;
    }

    /** Precio según la lista de precios actual. */
    calcularPrecio(lista) {
        if (this.precioPersonalizado) return Number(this.precio) || 0;
        switch (this.tipoPaquete) {
            case '1': return lista.unidad;
            case '2': return lista.par;
            case '6': return lista.bandeja;
            case 'brochette': return (this.brochettes || 1) * lista.brochette;
            default: return lista.costoDonas(this.totalDonasElegidas);
        }
    }

    /** Guarda el precio en el pedido, así el historial no cambia si después suben los precios. */
    congelarPrecio(lista) {
        this.precio = this.calcularPrecio(lista);
        this.actualizadoEn = Date.now();
    }

    /** Precio con el que se guardó (o el calculado, si nunca se guardó con precio). */
    precioGuardado(lista) {
        return typeof this.precio === 'number' ? this.precio : this.calcularPrecio(lista);
    }

    /** Pasa al estado siguiente; después de Finalizado vuelve a "A completar". */
    avanzarEstado() {
        this.estado = (this.estado + 1) % TEXTOS_ESTADO.length;
        this.actualizadoEn = Date.now();
    }

    /** Mensaje de error si falta algo, o null si está bien. */
    validar() {
        if (!this.cliente) return 'Poné para quién es el pedido';
        if (!this.fecha) return 'Elegí la fecha de entrega';
        return null;
    }

    clonar() { return new Pedido(JSON.parse(JSON.stringify(this))); }
}
