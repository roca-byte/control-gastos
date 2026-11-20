# CLAUDE.md — Control de Gastos

PWA para un emprendimiento familiar chico (bidones y pizzetas): anotar gastos y ventas, ver la
ganancia por producto por semana y por mes, estimar cuánto duran los insumos y compartir un
resumen por WhatsApp. La usa una persona que **no es programadora**, desde un solo celular.
App **independiente y pública** (MIT): **no** es parte de la suite QualityOS (ni su nombre, ni su
marca, ni su formato de respaldo).

Diseño: `docs/superpowers/specs/2026-11-20-control-gastos-design.md`.
Plan: `docs/superpowers/plans/2026-11-20-control-gastos.md`.

## Reglas
- HTML, CSS y JavaScript puro, scripts clásicos, un global por archivo. **Sin** frameworks, npm
  en la app, build ni librerías (el gráfico es SVG a mano).
- Lógica pura en `js/reglas.js`, `js/calculadora.js`, `js/store.js`, `js/grafico.js`,
  `js/resumen.js` (con pruebas en Node). `js/app.js` solo pantalla y eventos.
- **Cada cambio en un archivo de la app: subir `VERSION` en `sw.js`** y decir qué archivos subir
  (siempre `sw.js`). Archivo nuevo → sumarlo a `ARCHIVOS`.
- Rutas relativas (`./archivo`): vive en GitHub Pages bajo `/control-gastos/`.
- Interfaz en español rioplatense con voseo, sin jerga técnica. Botones de 48 px o más.
- Escapar todo texto del usuario con `Reglas.esc()` antes de `innerHTML`.
- Fechas `'AAAA-MM-DD'` locales (`Reglas.hoy()`); nunca `toISOString()`.
- Montos en pesos enteros. "General" = gastos de todo el negocio: no lleva ventas ni se reparte.
- Nada de datos reales del negocio en el repo: los de ejemplo son inventados (`tools/ejemplo.js`).
- WhatsApp automático: pedido para más adelante, no ahora.

## Pruebas
```
node --test tests/*.test.js   # reglas, calculadora, datos, gráfico y resumen
node tests/e2e.js             # de punta a punta en Chromium (Playwright)
```

## Guía y video
Si cambia algo visible: `node tools/demo.js` (capturas de `docs/img/`) y `node tools/video.js`
(video de `docs/video/`), y revisar que `docs/GUIA.md` siga diciendo lo que hace la app.
Íconos PNG: `node tools/iconos.js` desde `icons/icon.svg`.
