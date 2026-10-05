/** Vista: Lista de pedidos en curso o finalizados, con el aviso de pedidos cercanos. Devuelve HTML; no toca el DOM. */

import { escaparHTML, formatearMoneda } from '../utilidades/formato.js';
import { calcularDiferenciaDias, formatearEtiquetaFecha } from '../utilidades/fechas.js';
import { EstadoPedido, TEXTOS_ESTADO, TEXTOS_ACCION } from '../modelos/Pedido.js';

/** Chips con los sabores y brochettes de un pedido. */
function generarEtiquetasSabores(pedido) {
    let html = Object.entries(pedido.cantidades || {})
        .filter(([, cantidad]) => cantidad > 0)
        .map(([sabor, cantidad]) => `<span class="chip">${cantidad} ${escaparHTML(sabor)}</span>`)
        .join('');
    if (pedido.brochettes && pedido.tipoPaquete === 'brochette') {
        html += `<span class="chip">${pedido.brochettes} brochette${pedido.brochettes > 1 ? 's' : ''} (mini)</span>`;
    }
    return html;
}

/** Tarjeta de un pedido (el precio mostrado es el guardado, no el actual). */
function generarTarjetaPedido(pedido, precios) {
    const diasDif = calcularDiferenciaDias(pedido.fecha);
    const estaAtrasado = diasDif < 0 && pedido.faltaEntregar;

    return `
    <div class="card">
        <div class="row">
            <span class="name">${escaparHTML(pedido.cliente || 'Sin nombre')}</span>
            <span class="price">${formatearMoneda(pedido.precioGuardado(precios))}</span>
        </div>
        <div class="when">
            ${formatearEtiquetaFecha(pedido.fecha)}${pedido.hora ? ' · ' + escaparHTML(pedido.hora) : ''}
            ${estaAtrasado ? '<span class="late">atrasado</span>' : ''}
        </div>
        <div class="chips">${generarEtiquetasSabores(pedido)}</div>
        ${pedido.notas ? `<div>📝 ${escaparHTML(pedido.notas)}</div>` : ''}
        <div class="row" style="margin-top:10px">
            <span>${TEXTOS_ESTADO[pedido.estado]}${pedido.precioPersonalizado ? ' · precio especial' : ''}</span>
            <span>
                <button class="ghost" data-accion="editar" data-id="${pedido.id}">Editar</button>
                <button class="estado-${pedido.estado}" data-accion="avanzar_estado" data-id="${pedido.id}">${TEXTOS_ACCION[pedido.estado]}</button>
            </span>
        </div>
    </div>`;
}

/** Lista de pedidos en curso o finalizados, con el aviso de pedidos cercanos. */
export function renderPedidos(almacen, filtro) {
    const activos = almacen.pedidos.filter(p => p.estaEnCurso).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const cercanos = activos.filter(p => p.faltaEntregar && calcularDiferenciaDias(p.fecha) <= almacen.diasAviso);
    let html = '';

    if (cercanos.length) {
        html += `<div class="banner"><b>Para preparar pronto</b>
            ${cercanos.map(p => `${formatearEtiquetaFecha(p.fecha)}: ${escaparHTML(p.cliente)} (${p.totalDonasElegidas})`).join('<br>')}
        </div>`;
    }

    html += `<div class="tabs-secundarias">
        <button class="${filtro == 'curso' ? '' : 'ghost'}" data-accion="filtro" data-id="curso">En curso</button>
        <button class="${filtro == 'finalizados' ? '' : 'ghost'}" data-accion="filtro" data-id="finalizados">Finalizados</button>
    </div>`;

    const listaMostrar = filtro == 'curso'
        ? activos
        : almacen.pedidos.filter(p => p.estado === EstadoPedido.FINALIZADO).sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (listaMostrar.length) {
        html += `<div class="grid-escritorio">${listaMostrar.map(p => generarTarjetaPedido(p, almacen.precios)).join('')}</div>`;
    } else {
        html += `<div class="vacio">${filtro == 'curso' ? 'No hay pedidos en curso.<br>Tocá + para anotar el primero.' : 'Todavía no hay pedidos finalizados.'}</div>`;
    }
    return html;
}
