# Control de Gastos — Diseño

Fecha: 2026-11-20 · Estado: borrador para aprobar

## 1. Para qué y por qué

Un emprendimiento familiar chico vende **bidones** y **pizzetas**. El dueño (Maximiliano) quiere
saber **qué producto deja más ganancia**, cuánto se gasta y cuánto se recauda por producto y en
total, y **cuánto duran los insumos** (un kilo de harina, un maple de huevos, el azúcar).

La usa **su esposa**, que es quien atiende el negocio. No es programadora: la app tiene que
entenderse sola desde el celular. Él no está en el día a día; se entera por un **resumen que ella le
comparte por WhatsApp**.

No hace falta esperar a fin de mes: la pantalla principal muestra **cómo va la semana**.

## 2. Objetivos

1. Anotar un gasto o una venta en 2–3 toques (monto, producto, y rubro si es gasto).
2. Ver por semana y por mes: recaudado, gastado y ganancia, por producto y del total.
3. Gráfico de barras: recaudado vs. gastado de las últimas semanas.
4. Insumos con botón **"Abrí uno nuevo"**: la app calcula cuántos días dura cada uno y estima cuándo
   se termina el actual.
5. Botón **"Compartir resumen"** (texto, por WhatsApp u otra app del celular).
6. **Calculadora** chica para uso ocasional.
7. Copia de seguridad (archivo) para no perder datos si se cambia o se rompe el celular.

## 3. No objetivos (por ahora)

- **WhatsApp automático** (mensajes que salen solos). Lo pidió para más adelante, no ahora.
- Recetas, costo exacto por pizzeta y stock de alacena (descartado: la receta cambia según la tanda).
- Varios celulares sincronizados, cuentas, login o servidor.
- Facturación, clientes, fiados, impuestos.

## 4. Anti-objetivos (sería un fracaso aunque funcione)

- Que ella necesite ayuda para cargar algo, o que aparezca jerga técnica ("JSON", "PWA", "caché").
- Que cargar un gasto lleve más de unos segundos o pida campos que no sabe.
- Que se pierdan datos sin aviso.
- Una ganancia por producto falsa (por repartir a ojo gastos compartidos).

## 5. Restricciones

Mismo modelo que `controlLinea`, `informeCalidad` y `mash-check`:

- HTML, CSS y JavaScript puro, scripts clásicos, un objeto global por archivo. **Sin** frameworks,
  npm ni build. Sin librerías de gráficos: el gráfico es SVG armado a mano.
- PWA: `manifest.json` + service worker con `VERSION` (subirla en cada cambio).
- Datos solo en el celular (localStorage) + copia de seguridad exportar/importar.
- Funciona sin conexión una vez cargada.
- GitHub Pages en subdirectorio → **todas las rutas relativas**.
- Mobile first: botones grandes (mín. 48 px), pocos campos por pantalla.
- Español rioplatense con voseo ("Anotá", "Guardá"). Comentarios en español explicando el porqué.
- Escapar todo texto del usuario antes de `innerHTML`.
- Fecha local (nunca `toISOString()`: UTC corre el día a la noche).

## 6. Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **1. PWA local (elegido)** | Modelo conocido, sin costo, sin internet, sin cuentas | Él no ve en vivo; depende del resumen compartido |
| 2. Formulario + Planilla de Google | Él ve todo en vivo con gráficos | Carga menos "de app", necesita internet, "abrí uno nuevo" y calculadora quedan forzados |
| 3. App con servidor y cuentas | Los dos en vivo | Login, servidor, mantenimiento; demasiado para arrancar |

Eligió la **1**. Si más adelante hace falta verlo en vivo o WhatsApp automático, se evalúa aparte.

## 7. Lo que decidió el usuario

- Ganancia **por producto** y **total**.
- Insumos: opción "se terminó / abrí uno nuevo", **sin receta**.
- Vista **semanal** con gráfico, además del mes.
- Calculadora ocasional.
- La usa la esposa en **un solo celular**; él recibe resúmenes.

## 8. Diseño

### 8.1 Pantallas

Una barra de pestañas abajo, con 3 pestañas grandes: **Inicio · Insumos · Más**.

**Inicio** (lo que se ve al abrir):

```
┌──────────────────────────────┐
│ Esta semana  ‹ 16–22 nov ›   │
│ Recaudado   $ 48.000         │
│ Gastado     $ 21.500         │
│ Te quedan   $ 26.500  (verde)│
│ ──────────────────────────── │
│ Bidones   +$ 18.000          │
│ Pizzetas  +$  8.500          │
│ General   −$  2.000          │
│ ──────────────────────────── │
│ [gráfico: últimas 8 semanas] │
│ [ Compartir resumen ]        │
│ Últimos movimientos…         │
├──────────────────────────────┤
│ [ + Gasto ]   [ + Venta ]    │  ← siempre visibles, grandes
└──────────────────────────────┘
```

- En modo Mes, el gráfico muestra los últimos 6 meses.
- Selector **Semana / Mes** arriba; flechas ‹ › para ir a semanas o meses anteriores.
- Por producto: recaudado, gastado y ganancia (toca la fila para ver el detalle por rubro).
- "General" muestra solo su gasto: no tiene ventas y **no se reparte** entre productos.
- Lista de movimientos del período, tocable para **editar o borrar** (borrar pide confirmación).

**Formulario de Gasto** (hoja que sube desde abajo):
1. Monto (teclado numérico, grande) con botón de **calculadora** al lado.
2. ¿Para qué producto? → botones: Bidones · Pizzetas · General.
3. ¿Qué compraste? → botones de rubro (Harina, Huevos, Azúcar, Envases, Nafta, Otros…).
4. Fecha (por defecto hoy; cambiable) y nota opcional, abajo y chicas.
5. [Guardar].

**Formulario de Venta**: monto, producto (Bidones · Pizzetas), cantidad opcional, fecha, nota.

**Insumos**:

```
Harina (1 kg)
  Te dura unos 4 días · Abriste el actual el lun 16
  Se terminaría el vie 20                [ Abrí uno nuevo ]
Huevos (maple)
  Todavía no hay datos: tocá cuando abras el próximo
                                         [ Abrí uno nuevo ]
```

- Cada toque en "Abrí uno nuevo" guarda la fecha. Duración = promedio de días entre aperturas,
  usando las **últimas 4** (así se ajusta si cambia el ritmo de venta).
- Con 1 sola apertura: "todavía no hay datos". Si hoy ya pasó la fecha estimada, se marca en naranja
  ("ya debería estar por terminarse").
- Se puede deshacer la última apertura (por si tocó sin querer) y ver/borrar el historial.
- Lista editable de insumos (nombre + presentación).
- Los insumos **no se vinculan** con los gastos: comprar harina se anota como gasto; abrirla, acá.
  Son dos cosas distintas y así la carga sigue siendo de un toque.

**Más**: Calculadora · Compartir resumen · Productos y rubros (editar listas) · Copia de seguridad
(Guardar copia / Recuperar copia) · versión de la app al pie.

### 8.2 Resumen para compartir

Texto plano por `navigator.share` (ella elige WhatsApp); si el celular no lo soporta, copiar al
portapapeles y avisar.

```
Resumen semana 16–22 nov
Recaudado: $48.000
Gastado: $21.500
Quedó: $26.500
• Bidones: +$18.000 (vendido $30.000, gastado $12.000)
• Pizzetas: +$8.500 (vendido $18.000, gastado $9.500)
• Gastos generales: $2.000
Insumos: harina dura ~4 días, huevos ~6 días
```

### 8.3 Calculadora

Teclado de 4 operaciones con borrar y "=". Abierta desde el formulario, tiene el botón **"Usar este
número"** que lo pasa al monto (sirve para sumar varias compras de un ticket).

### 8.4 Datos (localStorage, clave `controlGastos.v1`)

```js
{
  version: 1,
  productos: [{ id, nombre }],          // 'bidones', 'pizzetas' + 'general' fijo
  rubros:    [{ id, nombre }],          // editables
  movimientos: [{
    id, tipo: 'gasto' | 'venta', fecha: 'AAAA-MM-DD',
    monto,                               // pesos enteros
    productoId, rubroId /* solo gasto */, cantidad /* venta, opcional */, nota, creado
  }],
  insumos: [{ id, nombre, presentacion, aperturas: ['AAAA-MM-DD', ...] }]
}
```

- Borrar un producto o rubro con movimientos: no se permite (se puede renombrar).
- Copia de seguridad: archivo `{ app: 'control-gastos', version: 1, datos }`. Recuperar
  **reemplaza todo**, pide confirmación y guarda lo anterior en `controlGastos.v1.anterior`.
  Un archivo de otra app se rechaza con un mensaje claro.
- Recordatorio suave en Inicio si pasaron más de 30 días sin guardar copia.

### 8.5 Reglas y cálculos

- Semana de **lunes a domingo**. Mes calendario.
- Ganancia de un producto = ventas − gastos de ese producto. Total = ventas − todos los gastos
  (incluye General).
- Montos en pesos enteros, mostrados con separador de miles (`$ 48.000`).

### 8.6 Archivos

```
index.html
css/styles.css
js/reglas.js     cálculos puros: totales por período, semanas, duración de insumos (con pruebas)
js/store.js      localStorage, copias de seguridad (global Store)
js/grafico.js    SVG de barras (global Grafico)
js/resumen.js    texto para compartir (global Resumen)
js/app.js        pantallas y eventos (IIFE)
sw.js, manifest.json, icons/
tests/           node --test sobre reglas.js
docs/GUIA.md     guía para ella, con capturas
GUIA-PUBLICACION.md  cómo publicarla en GitHub Pages
```

## 9. Decisiones que tomé yo (a revisar)

- Gastos compartidos (nafta, gas) van a **"General"**: cuentan en el total, no se reparten.
- Duración de insumos = promedio de las últimas 4 aperturas.
- Semana lunes–domingo; pesos sin centavos.
- Rubros iniciales: Harina, Huevos, Azúcar, Levadura, Envases, Nafta, Otros (editables).
- Insumos iniciales: Harina (1 kg), Huevos (maple), Azúcar (1 kg) (editables).
- Se pueden agregar productos nuevos desde "Más" (ej. si suma empanadas).
- Una venta puede ser una venta suelta o el total del día: la app no obliga.
- Nombre provisorio de la app: **"Control de Gastos"**; repo nuevo `control-gastos`.

## 10. Lo que queda para quien la construya

- Estilo visual concreto (colores, tipografía), respetando contraste y botones grandes.
- Ícono de la app.
- Detalle de la animación/hoja inferior y de los mensajes vacíos.
