const CACHE_NAME = 'donapola-v3.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/datos/Almacen.js',
  './js/datos/RepositorioLocal.js',
  './js/datos/normalizar.js',
  './js/main.js',
  './js/modelos/ListaPrecios.js',
  './js/modelos/Pedido.js',
  './js/notificaciones.js',
  './js/utilidades/fechas.js',
  './js/utilidades/formato.js',
  './js/vistas/FormularioPedido.js',
  './js/vistas/ajustesVista.js',
  './js/vistas/estadisticasVista.js',
  './js/vistas/pedidosVista.js',
  './js/vistas/produccionVista.js',
  './icons/favicon.ico',
  './icons/favicon.svg',
  './icons/favicon-96x96.png',
  './icons/apple-touch-icon.png',
  './icons/web-app-manifest-192x192.png',
  './icons/web-app-manifest-512x512.png'
];

// Instalación: Guardar archivos base en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

// Activación: Limpiar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Código de la app (HTML, JS, CSS, manifest): RED PRIMERO, así los cambios llegan solos.
// Si no hay internet, se usa la copia guardada.
async function redPrimero(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const respuesta = await fetch(request, { cache: 'no-cache' }); // revalida con el servidor
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch (error) {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    if (request.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }
}

// Íconos y demás archivos que casi no cambian: CACHÉ PRIMERO.
async function cachePrimero(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) (await caches.open(CACHE_NAME)).put(request, respuesta.clone());
    return respuesta;
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fuentes de Google, etc.: que las maneje el navegador

  const esCodigo = request.mode === 'navigate'
    || ['script', 'style'].includes(request.destination)
    || url.pathname.endsWith('manifest.json');

  event.respondWith(esCodigo ? redPrimero(request) : cachePrimero(request));
});

// Al tocar una notificación: enfocar la app si está abierta, o abrirla
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ventanas => {
      const abierta = ventanas.find(v => 'focus' in v);
      return abierta ? abierta.focus() : clients.openWindow('./index.html');
    })
  );
});
