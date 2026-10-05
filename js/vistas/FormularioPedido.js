import { Pedido } from '../modelos/Pedido.js';
import { escaparHTML, formatearMoneda } from '../utilidades/formato.js';

/**
 * Formulario (hoja inferior) para crear o editar un pedido.
 * Trabaja sobre un borrador: el pedido real no cambia hasta tocar "Guardar".
 */
export class FormularioPedido {
    #almacen;
    #fondo;
    #panel;
    #alGuardar;
    #borrador = null;

    constructor(almacen, fondo, alGuardar) {
        this.#almacen = almacen;
        this.#fondo = fondo;
        this.#panel = fondo.querySelector('#panel-formulario');
        this.#alGuardar = alGuardar;
        fondo.addEventListener('click', e => this.#alHacerClick(e));
        fondo.addEventListener('input', () => this.#actualizar());
    }

    /** Abre el formulario vacío, o con el pedido `idPedido` para editarlo. */
    abrir(idPedido = null) {
        const existente = idPedido ? this.#almacen.buscarPedido(idPedido) : null;
        this.#borrador = existente ? existente.clonar() : new Pedido();
        this.#dibujar(Boolean(existente));
        this.#fondo.classList.add('open');
        this.#actualizar();
    }

    cerrar() { this.#fondo.classList.remove('open'); }

    #campo(selector) { return this.#panel.querySelector(selector); }

    #dibujar(esEdicion) {
        const b = this.#borrador;
        this.#panel.innerHTML = `
        <h2 style="margin-top:0">${esEdicion ? 'Editar pedido' : 'Nuevo pedido'}</h2>
        <label>Para quién</label>
        <input id="form-cliente" value="${escaparHTML(b.cliente)}" placeholder="Nombre">

        <label>Teléfono (opcional)</label>
        <input id="form-tel" type="tel" value="${escaparHTML(b.tel)}">

        <div class="grid-dos-columnas">
            <div><label>Fecha de entrega</label><input id="form-fecha" type="date" value="${b.fecha}"></div>
            <div><label>Hora</label><input id="form-hora" type="time" value="${b.hora}"></div>
        </div>

        <label>Cantidad / Paquete</label>
        <div class="selector-paquete">
            <button class="${b.tipoPaquete == '1' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="1">1 Dona</button>
            <button class="${b.tipoPaquete == '2' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="2">2 Donas</button>
            <button class="${b.tipoPaquete == '6' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="6">Bandeja (6)</button>
            <button class="${b.tipoPaquete == 'brochette' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="brochette">Brochette</button>
            <button class="${b.tipoPaquete == 'custom' ? 'activo' : ''}" data-accion="seleccionar_paquete" data-id="custom">Personalizado</button>
        </div>

        <!-- Opción específica para brochette -->
        <div id="seccion-brochette" class="fila-input" style="display:${b.tipoPaquete == 'brochette' ? 'flex' : 'none'}">
            <span>Cantidad de brochettes (x3 mini c/u)</span>
            <div class="stepper">
                <button class="ghost" data-accion="modificar_brochette" data-delta="-1">−</button>
                <span id="cant-brochettes">${b.brochettes || 1}</span>
                <button data-accion="modificar_brochette" data-delta="1">+</button>
            </div>
        </div>

        <!-- Opción específica para personalizado -->
        <div id="seccion-custom" style="display:${b.tipoPaquete == 'custom' ? 'block' : 'none'}">
            <label>Cantidad total de donas</label>
            <input id="form-cantidad-custom" type="number" placeholder="Ej. 12" value="${b.cantidadCustom || ''}">
        </div>

        <!-- Contador / Límite de Sabores -->
        <div class="contador-tope" id="contador-tope"></div>

        <label>Seleccionar Sabores</label>
        <div id="lista-sabores">
        ${this.#almacen.sabores.map((sabor, i) => `
            <div class="fila-input">
                <span>${escaparHTML(sabor)}</span>
                <div class="stepper">
                    <button class="ghost" data-accion="modificar_cantidad" data-id="${i}" data-delta="-1">−</button>
                    <span id="cant-${i}">${b.cantidades[sabor] || 0}</span>
                    <button class="btn-sumar" id="btn-sumar-${i}" data-accion="modificar_cantidad" data-id="${i}" data-delta="1">+</button>
                </div>
            </div>`).join('')}
        </div>

        <label><input type="checkbox" id="form-precio-personalizado" style="width:auto" ${b.precioPersonalizado ? 'checked' : ''}> Precio personalizado (descuento / regalo)</label>
        <input id="form-precio-fijo" type="number" placeholder="Precio final $" value="${b.precio}" style="display:${b.precioPersonalizado ? 'block' : 'none'}">

        <label>Notas</label>
        <textarea id="form-notas" rows="2">${escaparHTML(b.notas)}</textarea>

        <div class="row" style="margin: 14px 0;"><span>Total</span><span class="price" id="total-calculado"></span></div>

        <div class="row">
            <button class="ghost" data-accion="cerrar_formulario">Cancelar</button>
            ${esEdicion ? '<button class="ghost" data-accion="borrar_pedido">Borrar</button>' : ''}
            <button data-accion="guardar_pedido">Guardar pedido</button>
        </div>`;
    }

    /** Copia lo escrito en los campos al borrador. */
    #leerCampos() {
        const b = this.#borrador;
        b.cliente = this.#campo('#form-cliente').value.trim();
        b.tel = this.#campo('#form-tel').value.trim();
        b.fecha = this.#campo('#form-fecha').value;
        b.hora = this.#campo('#form-hora').value;
        b.precioPersonalizado = this.#campo('#form-precio-personalizado').checked;
        b.precio = this.#campo('#form-precio-fijo').value;
        b.cantidadCustom = this.#campo('#form-cantidad-custom')?.value ?? '';
        b.notas = this.#campo('#form-notas').value.trim();
    }

    /** Refresca lo que depende del borrador: secciones visibles, tope de sabores y total. */
    #actualizar() {
        if (!this.#borrador || !this.#campo('#form-precio-personalizado')) return;
        this.#leerCampos();
        const b = this.#borrador;
        const tope = b.limiteDonas;
        const elegidas = b.totalDonasElegidas;

        this.#campo('#seccion-brochette').style.display = b.tipoPaquete === 'brochette' ? 'flex' : 'none';
        this.#campo('#seccion-custom').style.display = b.tipoPaquete === 'custom' ? 'block' : 'none';
        this.#campo('#form-precio-fijo').style.display = b.precioPersonalizado ? 'block' : 'none';

        const contador = this.#campo('#contador-tope');
        const completo = tope > 0 && elegidas >= tope;
        contador.className = 'contador-tope' + (completo ? ' completo' : '');
        contador.innerHTML = tope > 0
            ? `<span>Sabores elegidos:</span> <span>${elegidas} / ${tope} ${completo ? '✓' : ''}</span>`
            : `<span>Sabores elegidos:</span> <span>${elegidas}</span>`;

        // No dejar sumar más sabores cuando se llegó al tope
        this.#almacen.sabores.forEach((_, i) => { this.#campo('#btn-sumar-' + i).disabled = completo; });
        this.#campo('#total-calculado').textContent = formatearMoneda(b.calcularPrecio(this.#almacen.precios));
    }

    #alHacerClick(e) {
        if (e.target === this.#fondo) return this.cerrar();
        const boton = e.target.closest('[data-accion]');
        if (!boton) return;
        const { id, delta } = boton.dataset;
        const acciones = {
            seleccionar_paquete: () => this.#elegirPaquete(id),
            modificar_cantidad: () => this.#cambiarCantidad(Number(id), Number(delta)),
            modificar_brochette: () => this.#cambiarBrochettes(Number(delta)),
            cerrar_formulario: () => this.cerrar(),
            borrar_pedido: () => this.#borrar(),
            guardar_pedido: () => this.#guardar(),
        };
        acciones[boton.dataset.accion]?.();
    }

    #elegirPaquete(tipo) {
        this.#borrador.elegirPaquete(tipo);
        this.#panel.querySelectorAll('.selector-paquete button')
            .forEach(b => b.classList.toggle('activo', b.dataset.id === tipo));
        this.#almacen.sabores.forEach((_, i) => { this.#campo('#cant-' + i).textContent = '0'; });
        this.#actualizar();
    }

    #cambiarCantidad(indiceSabor, delta) {
        const sabor = this.#almacen.sabores[indiceSabor];
        this.#campo('#cant-' + indiceSabor).textContent = this.#borrador.cambiarCantidad(sabor, delta);
        this.#actualizar();
    }

    #cambiarBrochettes(delta) {
        this.#borrador.cambiarBrochettes(delta);
        this.#campo('#cant-brochettes').textContent = this.#borrador.brochettes;
        this.#actualizar();
    }

    #guardar() {
        this.#leerCampos();
        const error = this.#borrador.validar();
        if (error) return alert(error);
        this.#almacen.guardarPedido(this.#borrador);
        this.cerrar();
        this.#alGuardar();
    }

    #borrar() {
        if (!confirm('¿Borrar este pedido?')) return;
        this.#almacen.borrarPedido(this.#borrador.id);
        this.cerrar();
    }
}
