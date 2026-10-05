/** Vista: Qué hay que producir cada día (solo pedidos "A completar"). Devuelve HTML; no toca el DOM. */

import { escaparHTML } from '../utilidades/formato.js';
import { formatearEtiquetaFecha } from '../utilidades/fechas.js';
import { EstadoPedido } from '../modelos/Pedido.js';

/** Qué hay que producir cada día (solo pedidos "A completar"). */
export function renderProduccion(almacen) {
    const pendientes = almacen.pedidos.filter(p => p.estado === EstadoPedido.A_COMPLETAR).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!pendientes.length) return '<div class="vacio">Nada para producir. ¡Todo al día!</div>';

    const porFecha = {};
    pendientes.forEach(p => (porFecha[p.fecha] = porFecha[p.fecha] || []).push(p));

    return Object.keys(porFecha).map(fecha => {
        const totalesSabores = {};
        let totalBrochettes = 0;

        porFecha[fecha].forEach(pedido => {
            if (pedido.tipoPaquete === 'brochette') totalBrochettes += pedido.brochettes || 0;
            for (const sabor in pedido.cantidades) {
                totalesSabores[sabor] = (totalesSabores[sabor] || 0) + pedido.cantidades[sabor];
            }
        });

        const totalDonas = Object.values(totalesSabores).reduce((a, b) => a + b, 0);

        return `<h2>${formatearEtiquetaFecha(fecha)}</h2>
        <div class="card">
            <div class="chips">
                ${Object.entries(totalesSabores).filter(([, cant]) => cant > 0).sort((a, b) => b[1] - a[1])
                    .map(([sabor, cant]) => `<span class="chip"><b>${cant}</b>${escaparHTML(sabor)}</span>`).join('')}
                ${totalBrochettes ? `<span class="chip"><b>${totalBrochettes}</b> brochettes</span>` : ''}
            </div>
            <div>${totalDonas} donas · ${porFecha[fecha].length} pedido${porFecha[fecha].length > 1 ? 's' : ''}</div>
        </div>`;
    }).join('');
}
