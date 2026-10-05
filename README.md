# Donapola · Pedidos

App web instalable (PWA) para llevar los pedidos de Donapola. Sin dependencias ni build.

## Correrla en local
Los módulos ES no funcionan abriendo el archivo directo. Desde esta carpeta:

    python3 -m http.server 8000

y abrí http://localhost:8000

## Estructura
- `js/main.js`: punto de entrada, eventos y pestañas
- `js/modelos/`: `Pedido`, `ListaPrecios` (reglas de negocio, sin DOM)
- `js/datos/`: `Almacen` (estado), `RepositorioLocal` (guardado), `normalizar` (migraciones)
- `js/vistas/`: pantallas (devuelven HTML) y `FormularioPedido`
- `js/utilidades/`: fechas y formato
- `sw.js`: service worker (HTML/JS/CSS red primero; íconos desde caché)

Al agregar un archivo JS, sumalo a `ASSETS` en `sw.js` y subí `CACHE_NAME`.

## Sincronizar con otro dispositivo (idea)
Crear un repositorio nuevo con `cargar()` y `guardar(datos)` y pasárselo a `new Almacen(...)` en `main.js`.
