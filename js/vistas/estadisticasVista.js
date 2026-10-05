/** Vista: Historial: totales y ranking de sabores. Devuelve HTML; no toca el DOM. */

import { escaparHTML, formatearMoneda } from '../utilidades/formato.js';

/** Historial: totales y ranking de sabores. */
export function renderEstadisticas(almacen) {
    const todos = almacen.pedidos;
    if (!todos.length) return '<div class="vacio">Cuando haya pedidos van a aparecer acá los sabores que más y menos se venden.</div>';

    const ranking = {};
    almacen.sabores.forEach(s => ranking[s] = 0);
    let totalBrochettes = 0, facturacion = 0, donasVendidas = 0;

    todos.forEach(p => {
        if (p.tipoPaquete === 'brochette') totalBrochettes += p.brochettes || 0;
        facturacion += p.precioGuardado(almacen.precios);
        donasVendidas += p.totalDonasElegidas;
        for (const sabor in p.cantidades) ranking[sabor] = (ranking[sabor] || 0) + p.cantidades[sabor];
    });

    const arrayRanking = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
    const maximo = Math.max(1, arrayRanking[0][1]);

    return `<div class="card">
        <div class="row"><span>Pedidos</span><b>${todos.length}</b></div>
        <div class="row"><span>Donas vendidas</span><b>${donasVendidas}</b></div>
        <div class="row"><span>Brochettes</span><b>${totalBrochettes}</b></div>
        <div class="row"><span>Total facturado</span><span class="price">${formatearMoneda(facturacion)}</span></div>
    </div>
    <h2>Sabores</h2>
    <div class="grid-escritorio">
    ${arrayRanking.map(([sabor, cant]) => `
        <div class="card" style="padding:10px 14px">
            <div class="row"><span>${escaparHTML(sabor)}</span><b>${cant}</b></div>
            <div class="barra-progreso"><i style="width:${cant / maximo * 100}%"></i></div>
        </div>`).join('')}
    </div>
    <p style="opacity:.75">Arriba los más vendidos, abajo los menos vendidos.</p>`;
}
