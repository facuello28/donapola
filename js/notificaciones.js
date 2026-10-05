/** Avisos de pedidos próximos (se muestran a través del service worker). */

import { obtenerFechaHoy, calcularDiferenciaDias, formatearEtiquetaFecha } from './utilidades/fechas.js';

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
export async function activarNotificaciones(almacen) {
    if (!notificacionesDisponibles()) return alert('Este navegador no permite notificaciones');

    const permiso = await Notification.requestPermission();
    if (permiso === 'denied') {
        return alert('Las notificaciones están bloqueadas. Activalas desde los ajustes del sitio en Chrome.');
    }
    if (permiso !== 'granted') return;

    await mostrarNotificacion('¡Listo! 🍩', 'Las notificaciones de Donapola están activadas.', 'prueba');
    avisarPedidosCercanos(almacen);
}

// Avisa de los pedidos que hay que preparar pronto. Una sola vez por día.
export async function avisarPedidosCercanos(almacen) {
    if (!notificacionesDisponibles() || Notification.permission !== 'granted') return;

    const claveHoy = 'notif_' + obtenerFechaHoy().getTime();
    try {
        if (localStorage.getItem(claveHoy)) return;

        const cercanos = almacen.pedidos.filter(p => {
            const dias = calcularDiferenciaDias(p.fecha);
            return p.faltaEntregar && dias >= 0 && dias <= almacen.diasAviso;
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
