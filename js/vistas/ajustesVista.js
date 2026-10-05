/** Vista: Precios, sabores, avisos y respaldo. Devuelve HTML; no toca el DOM. */

import { escaparHTML } from '../utilidades/formato.js';

/** Precios, sabores, avisos y respaldo. */
export function renderAjustes(almacen) {
    const p = almacen.precios;
    return `<h2>Precios</h2>
    <div class="card">
        <div class="grid-dos-columnas">
            <div><label>Unidad</label><input type="number" data-precio="unidad" value="${p.unidad}"></div>
            <div><label>2 unidades</label><input type="number" data-precio="par" value="${p.par}"></div>
            <div><label>Bandeja (6)</label><input type="number" data-precio="bandeja" value="${p.bandeja}"></div>
            <div><label>Brochette x3 mini</label><input type="number" data-precio="brochette" value="${p.brochette}"></div>
        </div>
    </div>
    <h2>Sabores</h2>
    <div class="card">
        ${almacen.sabores.map((s, i) => `<div class="fila-input"><span>${escaparHTML(s)}</span><button class="ghost" data-accion="eliminar_sabor" data-id="${i}">Quitar</button></div>`).join('')}
        <div class="row" style="margin-top:8px"><input id="nuevo-sabor" placeholder="Nuevo sabor"><button data-accion="agregar_sabor">Agregar</button></div>
    </div>
    <h2>Avisos</h2>
    <div class="card">
        <label>Avisarme con anticipación</label>
        <select id="select-avisos">
            ${[1, 2, 3].map(n => `<option value="${n}" ${almacen.diasAviso == n ? 'selected' : ''}>${n} día${n > 1 ? 's' : ''} antes</option>`).join('')}
        </select>
        <p style="font-size:14px">Los pedidos cercanos aparecen arriba de la lista. Si activás las notificaciones, también te avisa al abrir la app.</p>
        <button data-accion="activar_notificaciones">Activar notificaciones</button>
    </div>
    <h2>Respaldo</h2>
    <div class="card">
        <p style="font-size:14px;margin-top:0">Los pedidos se guardan en este navegador. Copiá un respaldo de vez en cuando.</p>
        <button data-accion="copiar_respaldo">Copiar respaldo</button>
        <textarea id="texto-respaldo" rows="3" placeholder="Pegá acá un respaldo para restaurarlo" style="margin-top:10px"></textarea>
        <button class="ghost" data-accion="restaurar_respaldo" style="margin-top:8px">Restaurar</button>
    </div>`;
}
