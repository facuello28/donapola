/* =========================================
   UTILIDADES Y CONFIGURACIÓN INICIAL
   ========================================= */
const $ = selector => document.querySelector(selector);
const escaparHTML = texto => String(texto ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CONFIG_DEFAULT = {
    pedidos: [],
    sabores: [
        'Vainilla y chips de colores', 'Chocolate y chips de choco', 'Limón',
        'Chocolate y chips de colores', 'Canela', 'Chocolate y rocklets',
        'Vainilla con galletita', 'Chocolate y maní'
    ],
    precios: { unidad: 80, docena_parcial: 150, caja_seis: 390, brochette: 90 },
    diasAviso: 2
};

// Nombres de precios usados por versiones anteriores de la app
const CLAVES_PRECIOS_ANTERIORES = { u: 'unidad', d: 'docena_parcial', b: 'caja_seis', br: 'brochette' };

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
function normalizarEstado(datos) {
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

let estadoApp;
try {
    estadoApp = normalizarEstado(JSON.parse(localStorage.getItem('donapola') || 'null'));
} catch (e) {
    estadoApp = normalizarEstado(null);
}

const guardarEstado = () => {
    try { localStorage.setItem('donapola', JSON.stringify(estadoApp)); } catch (e) {}
};
guardarEstado(); // deja guardado el estado ya migrado

const TEXTOS_ESTADO = ['A completar', 'Completado', 'Entregado', 'Finalizado'];
const TEXTOS_ACCION = ['Marcar completado', 'Marcar entregado', 'Finalizar', 'Reabrir'];

let pestanaActual = 'pedidos';
let filtroPedidos = 'curso';
let pedidoEnEdicion = null;

/* =========================================
   FUNCIONES DE FORMATEO Y CÁLCULO
   ========================================= */
const formatearMoneda = numero => '$' + Math.round(numero).toLocaleString('es-UY');

const obtenerFechaHoy = () => {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    return fecha;
};

const calcularDiferenciaDias = fechaString => Math.round((new Date(fechaString + 'T00:00') - obtenerFechaHoy()) / 864e5);

const formatearEtiquetaFecha = fechaString => {
    const diasDif = calcularDiferenciaDias(fechaString);
    if (diasDif === 0) return 'Hoy';
    if (diasDif === 1) return 'Mañana';
    if (diasDif < 0) return 'Atrasado';
    return new Date(fechaString + 'T00:00').toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Obtener el límite máximo de donas/unidades asignables según el paquete elegido
function obtenerLimiteUnidades(pedido) {
    switch (pedido.tipoPaquete) {
        case '1': return 1;
        case '2': return 2;
        case '6': return 6;
        case 'brochette': return pedido.brochettes || 1;
        case 'custom': return Number(pedido.cantidadCustom) || 0; // 0 significa sin límite estricto
        default: return 6;
    }
}

const obtenerTotalUnidadesElegidas = pedido => Object.values(pedido.cantidades || {}).reduce((a, b) => a + b, 0);

function calcularCostoDonas(cantidad) {
    const p = estadoApp.precios;
    const dp = [0];
    for (let i = 1; i <= cantidad; i++) {
        let costo = dp[i - 1] + p.unidad;
        if (i >= 2) costo = Math.min(costo, dp[i - 2] + p.docena_parcial);
        if (i >= 6) costo = Math.min(costo, dp[i - 6] + p.caja_seis);
        dp[i] = costo;
    }
    return dp[cantidad];
}

const calcularPrecioFinal = pedido => {
    if (pedido.precioPersonalizado) return (Number(pedido.precio) || 0);

    if (pedido.tipoPaquete === '1') return estadoApp.precios.unidad;
    if (pedido.tipoPaquete === '2') return estadoApp.precios.docena_parcial;
    if (pedido.tipoPaquete === '6') return estadoApp.precios.caja_seis;
    if (pedido.tipoPaquete === 'brochette') return (pedido.brochettes || 1) * estadoApp.precios.brochette;

    // Si es custom pero no marcó precio manual
    return calcularCostoDonas(obtenerTotalUnidadesElegidas(pedido));
};

// Precio con el que se guardó el pedido. Así el historial no cambia si después
// se modifican los precios. (Solo recalcula en pedidos que nunca se guardaron con precio.)
const obtenerPrecioGuardado = pedido =>
    typeof pedido.precio === 'number' ? pedido.precio : calcularPrecioFinal(pedido);

/* =========================================
   GENERACIÓN DE HTML (VISTAS)
   ========================================= */
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

function generarTarjetaPedido(pedido) {
    const diasDif = calcularDiferenciaDias(pedido.fecha);
    const estaAtrasado = diasDif < 0 && pedido.estado < 2;

    return `
    <div class="card">
        <div class="row">
            <span class="name">${escaparHTML(pedido.cliente || 'Sin nombre')}</span>
            <span class="price">${formatearMoneda(obtenerPrecioGuardado(pedido))}</span>
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

const Vistas = {
    pedidos: () => {
        const activos = estadoApp.pedidos.filter(p => p.estado < 3).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        const cercanos = activos.filter(p => p.estado < 2 && calcularDiferenciaDias(p.fecha) <= estadoApp.diasAviso);
        let html = '';

        if (cercanos.length) {
            html += `<div class="banner"><b>Para preparar pronto</b>
                ${cercanos.map(p => `${formatearEtiquetaFecha(p.fecha)}: ${escaparHTML(p.cliente)} (${obtenerTotalUnidadesElegidas(p)})`).join('<br>')}
            </div>`;
        }

        html += `<div class="tabs-secundarias">
            <button class="${filtroPedidos == 'curso' ? '' : 'ghost'}" data-accion="filtro" data-id="curso">En curso</button>
            <button class="${filtroPedidos == 'finalizados' ? '' : 'ghost'}" data-accion="filtro" data-id="finalizados">Finalizados</button>
        </div>`;

        const listaMostrar = filtroPedidos == 'curso'
            ? activos
            : estadoApp.pedidos.filter(p => p.estado == 3).sort((a, b) => b.fecha.localeCompare(a.fecha));

        if (listaMostrar.length) {
            html += `<div class="grid-escritorio">${listaMostrar.map(generarTarjetaPedido).join('')}</div>`;
        } else {
            html += `<div class="vacio">${filtroPedidos == 'curso' ? 'No hay pedidos en curso.<br>Tocá + para anotar el primero.' : 'Todavía no hay pedidos finalizados.'}</div>`;
        }
        return html;
    },

    produccion: () => {
        const pendientes = estadoApp.pedidos.filter(p => p.estado == 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
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
    },

    estadisticas: () => {
        const todos = estadoApp.pedidos;
        if (!todos.length) return '<div class="vacio">Cuando haya pedidos van a aparecer acá los sabores que más y menos se venden.</div>';

        const ranking = {};
        estadoApp.sabores.forEach(s => ranking[s] = 0);
        let totalBrochettes = 0, facturacion = 0, donasVendidas = 0;

        todos.forEach(p => {
            if (p.tipoPaquete === 'brochette') totalBrochettes += p.brochettes || 0;
            facturacion += obtenerPrecioGuardado(p);
            donasVendidas += obtenerTotalUnidadesElegidas(p);
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
    },

    ajustes: () => {
        const p = estadoApp.precios;
        return `<h2>Precios</h2>
        <div class="card">
            <div class="grid-dos-columnas">
                <div><label>Unidad</label><input type="number" data-precio="unidad" value="${p.unidad}"></div>
                <div><label>2 unidades</label><input type="number" data-precio="docena_parcial" value="${p.docena_parcial}"></div>
                <div><label>Bandeja (6)</label><input type="number" data-precio="caja_seis" value="${p.caja_seis}"></div>
                <div><label>Brochette x3 mini</label><input type="number" data-precio="brochette" value="${p.brochette}"></div>
            </div>
        </div>
        <h2>Sabores</h2>
        <div class="card">
            ${estadoApp.sabores.map((s, i) => `<div class="fila-input"><span>${escaparHTML(s)}</span><button class="ghost" data-accion="eliminar_sabor" data-id="${i}">Quitar</button></div>`).join('')}
            <div class="row" style="margin-top:8px"><input id="nuevo-sabor" placeholder="Nuevo sabor"><button data-accion="agregar_sabor">Agregar</button></div>
        </div>
        <h2>Avisos</h2>
        <div class="card">
            <label>Avisarme con anticipación</label>
            <select id="select-avisos">
                ${[1, 2, 3].map(n => `<option value="${n}" ${estadoApp.diasAviso == n ? 'selected' : ''}>${n} día${n > 1 ? 's' : ''} antes</option>`).join('')}
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
};

/* =========================================
   CONTROLADORES DE INTERFAZ Y FORMULARIO
   ========================================= */
const DEFINICION_TABS = [
    { id: 'pedidos', icono: '🍩', texto: 'Pedidos', subtitulo: 'Pedidos' },
    { id: 'produccion', icono: '👩‍🍳', texto: 'Producir', subtitulo: 'Qué hay que hacer' },
    { id: 'estadisticas', icono: '📊', texto: 'Ventas', subtitulo: 'Historial y ventas' },
    { id: 'ajustes', icono: '⚙️', texto: 'Ajustes', subtitulo: 'Ajustes' }
];

function renderizarInterfaz() {
    $('#nav').innerHTML = DEFINICION_TABS.map(t =>
        `<button class="${pestanaActual == t.id ? 'on' : ''}" data-accion="cambiar_tab" data-id="${t.id}">${t.icono} ${t.texto}</button>`
    ).join('');

    const tabActual = DEFINICION_TABS.find(t => t.id === pestanaActual);
    $('#subtitulo').textContent = tabActual.subtitulo;
    $('#vista-principal').innerHTML = Vistas[pestanaActual]();
    $('#fab').style.display = pestanaActual == 'pedidos' ? 'block' : 'none';
}

function abrirFormulario(idPedido = null) {
    const pedidoExistente = estadoApp.pedidos.find(x => x.id == idPedido);

    pedidoEnEdicion = pedidoExistente
        ? JSON.parse(JSON.stringify(pedidoExistente))
        : {
            id: Date.now(), cliente: '', tel: '',
            fecha: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
            hora: '', tipoPaquete: '6', brochettes: 1, cantidadCustom: '',
            cantidades: {}, precioPersonalizado: false, precio: '', notas: '', estado: 0
        };

    $('#panel-formulario').innerHTML = `
        <h2 style="margin-top:0">${pedidoExistente ? 'Editar pedido' : 'Nuevo pedido'}</h2>
        <label>Para quién</label>
        <input id="form-cliente" value="${escaparHTML(pedidoEnEdicion.cliente)}" placeholder="Nombre">

        <label>Teléfono (opcional)</label>
        <input id="form-tel" type="tel" value="${escaparHTML(pedidoEnEdicion.tel)}">

        <div class="grid-dos-columnas">
            <div><label>Fecha de entrega</label><input id="form-fecha" type="date" value="${pedidoEnEdicion.fecha}"></div>
            <div><label>Hora</label><input id="form-hora" type="time" value="${pedidoEnEdicion.hora}"></div>
        </div>

        <label>Cantidad / Paquete</label>
        <div class="selector-paquete">
            <button class="${pedidoEnEdicion.tipoPaquete == '1' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="1">1 Dona</button>
            <button class="${pedidoEnEdicion.tipoPaquete == '2' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="2">2 Donas</button>
            <button class="${pedidoEnEdicion.tipoPaquete == '6' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="6">Bandeja (6)</button>
            <button class="${pedidoEnEdicion.tipoPaquete == 'brochette' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="brochette">Brochette</button>
            <button class="${pedidoEnEdicion.tipoPaquete == 'custom' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="custom">Personalizado</button>
        </div>

        <!-- Opción específica para brochette -->
        <div id="seccion-brochette" class="fila-input" style="display:${pedidoEnEdicion.tipoPaquete == 'brochette' ? 'flex' : 'none'}">
            <span>Cantidad de brochettes (x3 mini c/u)</span>
            <div class="stepper">
                <button class="ghost" data-accion="modificar_brochette" data-delta="-1">−</button>
                <span id="cant-brochettes">${pedidoEnEdicion.brochettes || 1}</span>
                <button data-accion="modificar_brochette" data-delta="1">+</button>
            </div>
        </div>

        <!-- Opción específica para personalizado -->
        <div id="seccion-custom" style="display:${pedidoEnEdicion.tipoPaquete == 'custom' ? 'block' : 'none'}">
            <label>Cantidad total de donas</label>
            <input id="form-cantidad-custom" type="number" placeholder="Ej. 12" value="${pedidoEnEdicion.cantidadCustom || ''}">
        </div>

        <!-- Contador / Límite de Sabores -->
        <div class="contador-tope" id="contador-tope"></div>

        <label>Seleccionar Sabores</label>
        <div id="lista-sabores">
        ${estadoApp.sabores.map((sabor, i) => `
            <div class="fila-input">
                <span>${escaparHTML(sabor)}</span>
                <div class="stepper">
                    <button class="ghost" data-accion="modificar_cantidad" data-id="${i}" data-delta="-1">−</button>
                    <span id="cant-${i}">${pedidoEnEdicion.cantidades[sabor] || 0}</span>
                    <button class="btn-sumar" id="btn-sumar-${i}" data-accion="modificar_cantidad" data-id="${i}" data-delta="1">+</button>
                </div>
            </div>`).join('')}
        </div>

        <label><input type="checkbox" id="form-precio-personalizado" style="width:auto" ${pedidoEnEdicion.precioPersonalizado ? 'checked' : ''}> Precio personalizado (descuento / regalo)</label>
        <input id="form-precio-fijo" type="number" placeholder="Precio final $" value="${pedidoEnEdicion.precio}" style="display:${pedidoEnEdicion.precioPersonalizado ? 'block' : 'none'}">

        <label>Notas</label>
        <textarea id="form-notas" rows="2">${escaparHTML(pedidoEnEdicion.notas)}</textarea>

        <div class="row" style="margin: 14px 0;"><span>Total</span><span class="price" id="total-calculado"></span></div>

        <div class="row">
            <button class="ghost" data-accion="cerrar_formulario">Cancelar</button>
            ${pedidoExistente ? '<button class="ghost" data-accion="borrar_pedido">Borrar</button>' : ''}
            <button data-accion="guardar_pedido">Guardar pedido</button>
        </div>`;

    $('#modal-fondo').classList.add('open');
    actualizarTotalesFormulario();
}

function leerDatosFormulario() {
    pedidoEnEdicion.cliente = $('#form-cliente').value.trim();
    pedidoEnEdicion.tel = $('#form-tel').value.trim();
    pedidoEnEdicion.fecha = $('#form-fecha').value;
    pedidoEnEdicion.hora = $('#form-hora').value;
    pedidoEnEdicion.precioPersonalizado = $('#form-precio-personalizado').checked;
    pedidoEnEdicion.precio = $('#form-precio-fijo').value;
    pedidoEnEdicion.cantidadCustom = $('#form-cantidad-custom') ? $('#form-cantidad-custom').value : '';
    pedidoEnEdicion.notas = $('#form-notas').value.trim();
}

function actualizarTotalesFormulario() {
    if (!$('#form-precio-personalizado')) return;
    leerDatosFormulario();

    const limiteMax = obtenerLimiteUnidades(pedidoEnEdicion);
    const elegidas = obtenerTotalUnidadesElegidas(pedidoEnEdicion);

    // Ajustar visibilidad de sub-secciones
    $('#seccion-brochette').style.display = pedidoEnEdicion.tipoPaquete === 'brochette' ? 'flex' : 'none';
    $('#seccion-custom').style.display = pedidoEnEdicion.tipoPaquete === 'custom' ? 'block' : 'none';
    $('#form-precio-fijo').style.display = pedidoEnEdicion.precioPersonalizado ? 'block' : 'none';

    // Actualizar indicador de tope
    const elContador = $('#contador-tope');
    if (limiteMax > 0) {
        const alcanzado = elegidas >= limiteMax;
        elContador.className = 'contador-tope' + (alcanzado ? ' completo' : '');
        elContador.innerHTML = `<span>Sabores elegidos:</span> <span>${elegidas} / ${limiteMax} ${alcanzado ? '✓' : ''}</span>`;
    } else {
        elContador.className = 'contador-tope';
        elContador.innerHTML = `<span>Sabores elegidos:</span> <span>${elegidas}</span>`;
    }

    // Bloquear/Desbloquear botones "+" de los sabores según el tope
    estadoApp.sabores.forEach((_, i) => {
        const btnSumar = $('#btn-sumar-' + i);
        if (btnSumar) {
            btnSumar.disabled = limiteMax > 0 && elegidas >= limiteMax;
        }
    });

    // Actualizar total monetario
    $('#total-calculado').textContent = formatearMoneda(calcularPrecioFinal(pedidoEnEdicion));
}

/* =========================================
   LISTENERS (EVENTOS DEL DOM)
   ========================================= */
document.addEventListener('input', e => {
    if (e.target.closest('#panel-formulario')) actualizarTotalesFormulario();

    if (e.target.dataset.precio) {
        estadoApp.precios[e.target.dataset.precio] = Number(e.target.value) || 0;
        guardarEstado();
    }
    if (e.target.id == 'select-avisos') {
        estadoApp.diasAviso = Number(e.target.value);
        guardarEstado();
    }
});

document.addEventListener('click', e => {
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;

    const accion = btn.dataset.accion;
    const id = btn.dataset.id;

    switch (accion) {
        case 'cambiar_tab':
            pestanaActual = id;
            renderizarInterfaz();
            window.scrollTo(0, 0);
            break;

        case 'filtro':
            filtroPedidos = id;
            renderizarInterfaz();
            break;

        case 'editar':
            abrirFormulario(id);
            break;

        case 'avanzar_estado':
            const pedido = estadoApp.pedidos.find(x => x.id == id);
            pedido.estado = (pedido.estado + 1) % 4;
            guardarEstado();
            renderizarInterfaz();
            break;

        case 'seleccionar_paquete':
            pedidoEnEdicion.tipoPaquete = id;
            // Reiniciar o ajustar cantidades al cambiar de paquete
            pedidoEnEdicion.cantidades = {};
            if (id === 'brochette') pedidoEnEdicion.brochettes = 1;

            // Actualizar botones activos
            document.querySelectorAll('.selector-paquete button').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');

            // Actualizar interfaz del formulario
            estadoApp.sabores.forEach((_, i) => $('#cant-' + i).textContent = '0');
            actualizarTotalesFormulario();
            break;

        case 'modificar_cantidad':
            const sabor = estadoApp.sabores[id];
            const limiteMax = obtenerLimiteUnidades(pedidoEnEdicion);
            const elegidas = obtenerTotalUnidadesElegidas(pedidoEnEdicion);
            const delta = Number(btn.dataset.delta);
            const actual = pedidoEnEdicion.cantidades[sabor] || 0;

            if (delta > 0 && limiteMax > 0 && elegidas >= limiteMax) {
                return; // Bloqueo extra por seguridad
            }

            const nuevaCantidad = Math.max(0, actual + delta);
            pedidoEnEdicion.cantidades[sabor] = nuevaCantidad;
            $('#cant-' + id).textContent = nuevaCantidad;
            actualizarTotalesFormulario();
            break;

        case 'modificar_brochette':
            pedidoEnEdicion.brochettes = Math.max(1, (pedidoEnEdicion.brochettes || 1) + Number(btn.dataset.delta));
            $('#cant-brochettes').textContent = pedidoEnEdicion.brochettes;
            actualizarTotalesFormulario();
            break;

        case 'cerrar_formulario':
            $('#modal-fondo').classList.remove('open');
            break;

        case 'borrar_pedido':
            if (confirm('¿Borrar este pedido?')) {
                estadoApp.pedidos = estadoApp.pedidos.filter(x => x.id != pedidoEnEdicion.id);
                guardarEstado();
                $('#modal-fondo').classList.remove('open');
                renderizarInterfaz();
            }
            break;

        case 'guardar_pedido':
            leerDatosFormulario();
            if (!pedidoEnEdicion.cliente) return alert('Poné para quién es el pedido');
            if (!pedidoEnEdicion.fecha) return alert('Elegí la fecha de entrega');

            pedidoEnEdicion.precio = calcularPrecioFinal(pedidoEnEdicion);
            const indice = estadoApp.pedidos.findIndex(x => x.id == pedidoEnEdicion.id);
            if (indice < 0) estadoApp.pedidos.push(pedidoEnEdicion);
            else estadoApp.pedidos[indice] = pedidoEnEdicion;

            guardarEstado();
            $('#modal-fondo').classList.remove('open');
            pestanaActual = 'pedidos';
            renderizarInterfaz();
            break;

        case 'agregar_sabor':
            const nuevoSabor = $('#nuevo-sabor').value.trim();
            if (nuevoSabor) {
                estadoApp.sabores.push(nuevoSabor);
                guardarEstado();
                renderizarInterfaz();
            }
            break;

        case 'eliminar_sabor':
            estadoApp.sabores.splice(id, 1);
            guardarEstado();
            renderizarInterfaz();
            break;

        case 'copiar_respaldo':
            const respaldoStr = JSON.stringify(estadoApp);
            if (navigator.clipboard) {
                navigator.clipboard.writeText(respaldoStr)
                    .then(() => alert('Respaldo copiado. Pegalo en un mensaje o nota para guardarlo.'))
                    .catch(() => fallbackCopiar(respaldoStr));
            } else {
                fallbackCopiar(respaldoStr);
            }
            function fallbackCopiar(texto) {
                $('#texto-respaldo').value = texto;
                $('#texto-respaldo').select();
                alert('Copialo desde el cuadro de texto.');
            }
            break;

        case 'restaurar_respaldo':
            try {
                const datos = JSON.parse($('#texto-respaldo').value);
                if (!Array.isArray(datos.pedidos)) throw new Error();
                estadoApp = normalizarEstado(datos);
                guardarEstado();
                renderizarInterfaz();
                alert('Respaldo restaurado correctamente');
            } catch (error) {
                alert('El texto pegado no es un respaldo válido');
            }
            break;

        case 'activar_notificaciones':
            activarNotificaciones();
            break;
    }
});

$('#modal-fondo').addEventListener('click', e => {
    if (e.target.id == 'modal-fondo') $('#modal-fondo').classList.remove('open');
});

$('#fab').onclick = () => abrirFormulario();

renderizarInterfaz();

/* =========================================
   NOTIFICACIONES
   ========================================= */
// En Android (Chrome) no se puede usar `new Notification()`: hay que pedirle
// al service worker que la muestre con `showNotification()`.
const notificacionesDisponibles = () =>
    'Notification' in window && 'serviceWorker' in navigator;

async function mostrarNotificacion(titulo, cuerpo, etiqueta = 'donapola') {
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification(titulo, {
        body: cuerpo,
        icon: './icons/web-app-manifest-192x192.png',
        tag: etiqueta // evita que se apilen avisos repetidos
    });
}

// Pide permiso (tiene que venir de un toque del usuario) y manda un aviso de prueba.
async function activarNotificaciones() {
    if (!notificacionesDisponibles()) return alert('Este navegador no permite notificaciones');

    const permiso = await Notification.requestPermission();
    if (permiso === 'denied') {
        return alert('Las notificaciones están bloqueadas. Activalas desde los ajustes del sitio en Chrome.');
    }
    if (permiso !== 'granted') return;

    await mostrarNotificacion('¡Listo! 🍩', 'Las notificaciones de Donapola están activadas.', 'prueba');
    avisarPedidosCercanos();
}

// Avisa de los pedidos que hay que preparar pronto. Una sola vez por día.
async function avisarPedidosCercanos() {
    if (!notificacionesDisponibles() || Notification.permission !== 'granted') return;

    const claveHoy = 'notif_' + obtenerFechaHoy().getTime();
    try {
        if (localStorage.getItem(claveHoy)) return;

        const cercanos = estadoApp.pedidos.filter(p => {
            const dias = calcularDiferenciaDias(p.fecha);
            return p.estado < 2 && dias >= 0 && dias <= estadoApp.diasAviso;
        });
        if (!cercanos.length) return;

        await mostrarNotificacion(
            'Donapola: pedidos para preparar',
            cercanos.map(p => formatearEtiquetaFecha(p.fecha) + ': ' + p.cliente).join('\n'),
            'pedidos-cercanos'
        );

        // Se marca como avisado recién después de mostrarla con éxito
        localStorage.setItem(claveHoy, '1');
        Object.keys(localStorage)
            .filter(k => k.startsWith('notif_') && k !== claveHoy)
            .forEach(k => localStorage.removeItem(k));
    } catch (error) {
        console.error('Error al mostrar notificaciones', error);
    }
}

avisarPedidosCercanos();
// Si la app quedó abierta en segundo plano, volver a revisar al regresar a ella
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') avisarPedidosCercanos();
});


/* =========================================
   REGISTRO DE SERVICE WORKER (PWA)
   ========================================= */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
            .catch(err => console.error('Error al registrar Service Worker:', err));
    });
}
