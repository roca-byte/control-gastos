# Desarrollo

## Estructura

```
index.html            Barra, <main id="vista">, pestañas y hoja inferior
css/styles.css        Estilos mobile first (botones de 48 px o más), modo oscuro
js/reglas.js          Fechas, semanas, pesos, totales, series del gráfico, duración de insumos (global Reglas)
js/calculadora.js     Calculadora de bolsillo, sin pantalla (global Calculadora)
js/store.js           localStorage 'controlGastos.v1', listas, insumos, copia de seguridad (global Store)
js/grafico.js         SVG de barras recaudado/gastado (global Grafico)
js/resumen.js         Texto del resumen para WhatsApp (global Resumen)
js/app.js             Pantallas y eventos delegados con data-act (IIFE)
sw.js                 Service worker: red primero, caché sin señal. VERSION = 'control-gastos-vN'
manifest.json         Datos de instalación (rutas relativas)
icons/                icon.svg (fuente), icon-192.png, icon-512.png
tests/                Pruebas con node:test y de punta a punta con Playwright
tools/                Capturas, video, íconos y datos de ejemplo (la app no los carga)
docs/                 Guía de uso, capturas, video, diseño y plan
```

Orden de carga: `reglas → calculadora → store → grafico → resumen → app`.

## Datos

```js
{
  version: 1,
  configurado: false,                        // true después de la bienvenida
  negocio: '',                                // nombre del emprendimiento (opcional)
  productos:   [{ id, nombre, fijo? }],        // 'general' es fijo
  rubros:      [{ id, nombre }],
  movimientos: [{ id, tipo: 'gasto'|'venta', fecha: 'AAAA-MM-DD', monto, productoId, rubroId?, cantidad?, nota, creado }],
  insumos:     [{ id, nombre, presentacion, aperturas: ['AAAA-MM-DD'] }],
  ultimaCopia: 'AAAA-MM-DD' | null
}
```

Copia de seguridad: `{ app: 'control-gastos', version: 1, datos }`. Recuperar reemplaza todo y
guarda lo anterior en `controlGastos.v1.anterior`. Si lo guardado está roto, la app arranca de
cero y deja el texto roto en `controlGastos.v1.danado`.

## Probar

```
node --test tests/*.test.js
node tests/e2e.js [parte del nombre de un escenario]
```

Para mirarla en el navegador: `python3 -m http.server 8000` desde la carpeta de arriba y abrir
`http://localhost:8000/control-gastos/` (con `file://` el service worker no anda).

## Guía, capturas y video

Las capturas de `docs/img/` y el video de `docs/video/` se generan con Playwright sobre la app
real, con datos **inventados** (`tools/ejemplo.js`). Volver a generarlos si cambia algo visible:

```
node tools/demo.js    # capturas
node tools/video.js   # video (necesita ffmpeg)
node tools/iconos.js  # íconos PNG desde icons/icon.svg
```
