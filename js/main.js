import { Almacen } from './datos/Almacen.js';
import { RepositorioLocal } from './datos/RepositorioLocal.js';
import { FormularioPedido } from './vistas/FormularioPedido.js';
import { renderPedidos } from './vistas/pedidosVista.js';
import { renderProduccion } from './vistas/produccionVista.js';
import { renderEstadisticas } from './vistas/estadisticasVista.js';
import { renderAjustes } from './vistas/ajustesVista.js';
import { activarNotificaciones, avisarPedidosCercanos } from './notificaciones.js';

/* Punto de entrada: arma las piezas y conecta eventos con el almacén. */

const $ = selector => document.querySelector(selector);

const almacen = new Almacen(new RepositorioLocal());
const formulario = new FormularioPedido(almacen, $('#modal-fondo'), () => { pestanaActual = 'pedidos'; renderizar(); });

let pestanaActual = 'pedidos';
let filtroPedidos = 'curso';

const DEFINICION_TABS = [
    { id: 'pedidos', icono: '🍩', texto: 'Pedidos', subtitulo: 'Pedidos' },
    { id: 'produccion', icono: '👩‍🍳', texto: 'Producir', subtitulo: 'Qué hay que hacer' },
    { id: 'estadisticas', icono: '📊', texto: 'Ventas', subtitulo: 'Historial y ventas' },
    { id: 'ajustes', icono: '⚙️', texto: 'Ajustes', subtitulo: 'Ajustes' }
];

const VISTAS = {
    pedidos: () => renderPedidos(almacen, filtroPedidos),
    produccion: () => renderProduccion(almacen),
    estadisticas: () => renderEstadisticas(almacen),
    ajustes: () => renderAjustes(almacen)
};

function renderizar() {
    $('#nav').innerHTML = DEFINICION_TABS.map(t =>
        `<button class="${pestanaActual == t.id ? 'on' : ''}" data-accion="cambiar_tab" data-id="${t.id}">${t.icono} ${t.texto}</button>`
    ).join('');
    $('#subtitulo').textContent = DEFINICION_TABS.find(t => t.id === pestanaActual).subtitulo;
    $('#vista-principal').innerHTML = VISTAS[pestanaActual]();
    $('#fab').style.display = pestanaActual == 'pedidos' ? 'block' : 'none';
}

function copiarRespaldo() {
    const texto = almacen.exportarRespaldo();
    const mostrarEnCaja = () => {
        $('#texto-respaldo').value = texto;
        $('#texto-respaldo').select();
        alert('Copialo desde el cuadro de texto.');
    };
    if (!navigator.clipboard) return mostrarEnCaja();
    navigator.clipboard.writeText(texto)
        .then(() => alert('Respaldo copiado. Pegalo en un mensaje o nota para guardarlo.'))
        .catch(mostrarEnCaja);
}

function restaurarRespaldo() {
    try {
        almacen.importarRespaldo($('#texto-respaldo').value);
        alert('Respaldo restaurado correctamente');
    } catch (error) {
        alert('El texto pegado no es un respaldo válido');
    }
}

// Acciones de los botones de las pantallas (los del formulario las maneja FormularioPedido)
const ACCIONES = {
    cambiar_tab: boton => { pestanaActual = boton.dataset.id; renderizar(); window.scrollTo(0, 0); },
    filtro: boton => { filtroPedidos = boton.dataset.id; renderizar(); },
    editar: boton => formulario.abrir(boton.dataset.id),
    avanzar_estado: boton => almacen.avanzarEstado(boton.dataset.id),
    agregar_sabor: () => almacen.agregarSabor($('#nuevo-sabor').value.trim()),
    eliminar_sabor: boton => almacen.quitarSabor(Number(boton.dataset.id)),
    copiar_respaldo: copiarRespaldo,
    restaurar_respaldo: restaurarRespaldo,
    activar_notificaciones: () => activarNotificaciones(almacen)
};

document.addEventListener('click', e => {
    const boton = e.target.closest('[data-accion]');
    if (boton) ACCIONES[boton.dataset.accion]?.(boton);
});

document.addEventListener('input', e => {
    if (e.target.dataset.precio) almacen.cambiarPrecio(e.target.dataset.precio, e.target.value);
    if (e.target.id === 'select-avisos') almacen.cambiarDiasAviso(e.target.value);
});

$('#fab').onclick = () => formulario.abrir();

almacen.suscribirse(renderizar);
renderizar();

// Avisos al abrir la app y al volver a ella
avisarPedidosCercanos(almacen);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') avisarPedidosCercanos(almacen);
});

// PWA: service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
            .catch(err => console.error('Error al registrar Service Worker:', err));
    });
}
