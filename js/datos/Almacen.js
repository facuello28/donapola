import { Pedido } from '../modelos/Pedido.js';
import { ListaPrecios } from '../modelos/ListaPrecios.js';
import { normalizarEstado } from './normalizar.js';

/**
 * Único dueño del estado de la app: pedidos, sabores, precios y días de aviso.
 * Todo cambio pasa por acá, se guarda en el repositorio y avisa a quien esté suscripto.
 */
export class Almacen {
    #repositorio;
    #oyentes = new Set();

    pedidos = [];
    sabores = [];
    precios = new ListaPrecios();
    diasAviso = 2;

    constructor(repositorio) {
        this.#repositorio = repositorio;
        this.#cargar(repositorio.cargar());
        this.#guardar(); // deja guardado el estado ya migrado
    }

    #cargar(datos) {
        const estado = normalizarEstado(datos);
        this.pedidos = estado.pedidos.map(datosPedido => new Pedido(datosPedido));
        this.sabores = estado.sabores;
        this.precios = new ListaPrecios(estado.precios);
        this.diasAviso = estado.diasAviso;
    }

    #guardar() { this.#repositorio.guardar(this.respaldo()); }
    #guardarYAvisar() { this.#guardar(); this.#oyentes.forEach(avisar => avisar()); }

    /** Registra una función que se llama cada vez que cambian los datos. */
    suscribirse(funcion) { this.#oyentes.add(funcion); }

    respaldo() {
        return { pedidos: this.pedidos, sabores: this.sabores, precios: this.precios, diasAviso: this.diasAviso };
    }
    exportarRespaldo() { return JSON.stringify(this.respaldo()); }
    importarRespaldo(texto) {
        const datos = JSON.parse(texto);
        if (!Array.isArray(datos.pedidos)) throw new Error('Respaldo inválido');
        this.#cargar(datos);
        this.#guardarYAvisar();
    }

    // ----- pedidos -----
    buscarPedido(id) { return this.pedidos.find(p => String(p.id) === String(id)); }

    guardarPedido(pedido) {
        pedido.congelarPrecio(this.precios);
        const indice = this.pedidos.findIndex(p => String(p.id) === String(pedido.id));
        if (indice < 0) this.pedidos.push(pedido); else this.pedidos[indice] = pedido;
        this.#guardarYAvisar();
    }

    borrarPedido(id) {
        this.pedidos = this.pedidos.filter(p => String(p.id) !== String(id));
        this.#guardarYAvisar();
    }

    avanzarEstado(id) {
        this.buscarPedido(id)?.avanzarEstado();
        this.#guardarYAvisar();
    }

    // ----- ajustes -----
    agregarSabor(nombre) {
        if (!nombre) return;
        this.sabores.push(nombre);
        this.#guardarYAvisar();
    }

    quitarSabor(indice) {
        this.sabores.splice(indice, 1);
        this.#guardarYAvisar();
    }

    // Estos dos no avisan: se escriben mientras se tipea y no hay que redibujar la pantalla.
    cambiarPrecio(clave, valor) { this.precios[clave] = Number(valor) || 0; this.#guardar(); }
    cambiarDiasAviso(dias) { this.diasAviso = Number(dias); this.#guardar(); }
}
