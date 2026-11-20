# Control de Gastos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA para el celular que anota gastos y ventas de un emprendimiento (bidones y pizzetas), muestra la ganancia por producto por semana y por mes con un gráfico, estima cuánto duran los insumos y comparte un resumen por WhatsApp.

**Architecture:** Scripts clásicos sin build, un objeto global por archivo. Toda la lógica que se puede probar sin navegador (fechas, totales, duración de insumos, calculadora, texto del resumen, SVG del gráfico, capa de datos) es pura y se prueba con `node --test`; `app.js` solo pinta pantallas y conecta eventos, y se prueba de punta a punta con Playwright.

**Tech Stack:** HTML + CSS + JavaScript ES2017 (scripts clásicos), localStorage, Service Worker, Node 20+ (`node:test`) y Playwright (preinstalado) solo para pruebas. Sin dependencias en la app.

**Spec:** `docs/superpowers/specs/2026-11-20-control-gastos-design.md`

## Global Constraints

- Sin frameworks, npm ni build en la app. Sin librerías de gráficos (SVG a mano).
- Cada archivo de `js/` expone un global y termina con `if (typeof module !== 'undefined') module.exports = <Global>;` (para las pruebas en Node). `app.js` es una IIFE.
- Orden de carga en `index.html`: `reglas.js → calculadora.js → store.js → grafico.js → resumen.js → app.js`.
- Todas las rutas relativas (`./archivo`); la app vive en GitHub Pages bajo `/control-gastos/`.
- Botones de mínimo 48 px de alto; interfaz en español rioplatense con voseo; sin jerga técnica visible ("copia de seguridad", nunca "JSON"/"backup"/"caché").
- Todo texto del usuario pasa por `Reglas.esc()` antes de `innerHTML`.
- Fechas `'AAAA-MM-DD'` en hora local; prohibido `toISOString()`.
- Montos en pesos enteros; se muestran `$ 48.000` (punto de miles, sin centavos).
- localStorage clave `controlGastos.v1`; copia anterior en `controlGastos.v1.anterior`.
- `sw.js` con `VERSION = 'control-gastos-vN'`; **cada cambio en un archivo de la app sube N**; archivo nuevo → sumarlo a `ARCHIVOS`.
- Comentarios en español que explican el porqué.
- Semana de lunes a domingo. Duración de insumo = promedio de los intervalos entre las últimas 4 aperturas.
- "General" es un producto fijo: solo gastos, nunca ventas, no se reparte, no se puede borrar ni renombrar.

## Review Focus

1. **Montos escritos como los escribe una persona** (`48.000`, `1.500,50`, `$ 300`, ` 25 `, vacío, `0`, `abc`) → se aceptan los válidos redondeados a peso entero y se rechazan vacío/cero/negativo/letras con un mensaje, sin guardar. Test en Task 1.
2. **Semanas que cruzan mes o año** (domingo 3-ene-2027 pertenece a la semana del lunes 28-dic-2026) → el movimiento cuenta en esa semana y en el mes de su propia fecha. Test en Task 1 y Task 2.
3. **Toque doble en "Abrí uno nuevo"** el mismo día → no se guarda una segunda apertura con 0 días que arrastre el promedio. Test en Task 5.
4. **Datos guardados rotos** (JSON inválido en localStorage) → la app arranca con datos vacíos, conserva el texto roto en `controlGastos.v1.danado` y avisa; no tira error en pantalla. Test en Task 5.
5. **Recuperar un archivo equivocado** (de otra app, texto cualquiera, versión futura) → se rechaza con mensaje claro y los datos actuales quedan intactos. Test en Task 5.

---

### Task 1: Reglas — fechas, períodos y pesos

**Files:**
- Create: `js/reglas.js`, `tests/reglas.test.js`, `package.json` (solo `{"private":true,"scripts":{"test":"node --test tests/"}}`, sin dependencias)

**Interfaces:**
- Produces (global `Reglas`):
  - `fechaLocal(d: Date) -> 'AAAA-MM-DD'`
  - `hoy() -> 'AAAA-MM-DD'`
  - `sumarDias(f: string, n: number) -> string`
  - `diasEntre(a: string, b: string) -> number` (b − a, enteros, inmune a cambio de horario: calcular con `Date.UTC`)
  - `rangoSemana(f) -> {desde, hasta}` (lunes..domingo)
  - `rangoMes(f) -> {desde, hasta}`
  - `etiquetaRango({desde,hasta}) -> string` (`'16–22 nov'`, `'28 dic – 3 ene'`, mes: `'noviembre 2026'` si desde es día 1 y hasta es último día)
  - `formatoPesos(n: number) -> string` (`'$ 48.000'`, negativos `'−$ 2.000'`)
  - `leerMonto(texto: string) -> number | null`
  - `esc(texto) -> string` (escapa `& < > " '`)

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
const R = require('../js/reglas.js');
test('semana lunes a domingo, cruzando año', () => {
  assert.deepEqual(R.rangoSemana('2026-11-20'), { desde: '2026-11-16', hasta: '2026-11-22' });
  assert.deepEqual(R.rangoSemana('2026-11-16'), { desde: '2026-11-16', hasta: '2026-11-22' });
  assert.deepEqual(R.rangoSemana('2026-11-22'), { desde: '2026-11-16', hasta: '2026-11-22' });
  assert.deepEqual(R.rangoSemana('2027-01-03'), { desde: '2026-12-28', hasta: '2027-01-03' });
  assert.equal(R.etiquetaRango(R.rangoSemana('2027-01-03')), '28 dic – 3 ene');
  assert.equal(R.etiquetaRango(R.rangoSemana('2026-11-20')), '16–22 nov');
});
test('mes y días', () => {
  assert.deepEqual(R.rangoMes('2028-02-10'), { desde: '2028-02-01', hasta: '2028-02-29' });
  assert.equal(R.etiquetaRango(R.rangoMes('2026-11-20')), 'noviembre 2026');
  assert.equal(R.sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(R.diasEntre('2026-03-28', '2026-04-04'), 7);
  assert.equal(R.fechaLocal(new Date(2026, 10, 20, 23, 59)), '2026-11-20');
});
test('pesos', () => {
  assert.equal(R.formatoPesos(48000), '$ 48.000');
  assert.equal(R.formatoPesos(500), '$ 500');
  assert.equal(R.formatoPesos(-2000), '−$ 2.000');
  assert.equal(R.formatoPesos(1234567), '$ 1.234.567');
});
test('montos como los escribe una persona', () => {
  assert.equal(R.leerMonto('48000'), 48000);
  assert.equal(R.leerMonto('48.000'), 48000);
  assert.equal(R.leerMonto('$ 300'), 300);
  assert.equal(R.leerMonto(' 25 '), 25);
  assert.equal(R.leerMonto('1.500,50'), 1501);
  assert.equal(R.leerMonto('1500,4'), 1500);
  for (const malo of ['', '0', '-5', 'abc', '12a', ',']) assert.equal(R.leerMonto(malo), null, malo);
});
test('escapar', () => {
  assert.equal(R.esc('<b>"a"&\'b\'</b>'), '&lt;b&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/b&gt;');
});
```

- [ ] **Step 2: Correr y ver que fallan** — `node --test tests/` → FAIL (`Cannot find module '../js/reglas.js'`).
- [ ] **Step 3: Implementar `js/reglas.js`** con las firmas de arriba. `leerMonto`: quitar `$` y espacios; los puntos son separadores de miles; la coma es decimal; redondear; `null` si no queda un número > 0. Meses en español para las etiquetas (`ene feb mar abr may jun jul ago sep oct nov dic` y nombres completos).
- [ ] **Step 4: Correr** — `node --test tests/` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Reglas: fechas, semanas, pesos y montos"`

### Task 2: Reglas — totales del período y series para el gráfico

**Files:**
- Modify: `js/reglas.js`, `tests/reglas.test.js`

**Interfaces:**
- Consumes: `rangoSemana`, `rangoMes`, `sumarDias` (Task 1).
- Produces:
  - Tipo `Movimiento = { id, tipo: 'gasto'|'venta', fecha, monto, productoId, rubroId?, cantidad?, nota, creado }`
  - `totales(movs: Movimiento[], rango: {desde,hasta}) -> { recaudado, gastado, quedo, porProducto: { [productoId]: { vendido, gastado, ganancia, cantidad, porRubro: { [rubroId]: number } } } }` — solo incluye productos con algún movimiento en el rango; `cantidad` suma las cantidades de ventas.
  - `serieSemanas(movs, fechaRef, n) -> [{ desde, hasta, recaudado, gastado }]` — n semanas terminando en la de `fechaRef`, de la más vieja a la más nueva.
  - `serieMeses(movs, fechaRef, n) -> igual forma, por mes`.
  - `movimientosDe(movs, rango) -> Movimiento[]` ordenados por fecha desc, luego `creado` desc.

- [ ] **Step 1: Pruebas que fallan**

```js
const M = [
  { id:'1', tipo:'venta', fecha:'2026-11-16', monto:30000, productoId:'bidones', cantidad:10, nota:'', creado:1 },
  { id:'2', tipo:'gasto', fecha:'2026-11-17', monto:12000, productoId:'bidones', rubroId:'envases', nota:'', creado:2 },
  { id:'3', tipo:'venta', fecha:'2026-11-18', monto:18000, productoId:'pizzetas', nota:'', creado:3 },
  { id:'4', tipo:'gasto', fecha:'2026-11-18', monto:6000, productoId:'pizzetas', rubroId:'harina', nota:'', creado:4 },
  { id:'5', tipo:'gasto', fecha:'2026-11-19', monto:3500, productoId:'pizzetas', rubroId:'huevos', nota:'', creado:5 },
  { id:'6', tipo:'gasto', fecha:'2026-11-22', monto:2000, productoId:'general', rubroId:'gas', nota:'', creado:6 },
  { id:'7', tipo:'venta', fecha:'2026-11-23', monto:999, productoId:'bidones', nota:'', creado:7 },
];
test('totales de la semana, por producto, General solo en el total', () => {
  const t = R.totales(M, R.rangoSemana('2026-11-20'));
  assert.equal(t.recaudado, 48000); assert.equal(t.gastado, 23500); assert.equal(t.quedo, 24500);
  assert.deepEqual(t.porProducto.bidones, { vendido:30000, gastado:12000, ganancia:18000, cantidad:10, porRubro:{ envases:12000 } });
  assert.equal(t.porProducto.pizzetas.ganancia, 8500);
  assert.deepEqual(t.porProducto.pizzetas.porRubro, { harina:6000, huevos:3500 });
  assert.equal(t.porProducto.general.gastado, 2000);
  assert.equal(t.porProducto.general.vendido, 0);
});
test('período vacío da ceros', () => {
  const t = R.totales(M, R.rangoSemana('2026-10-01'));
  assert.deepEqual(t, { recaudado:0, gastado:0, quedo:0, porProducto:{} });
});
test('serie de semanas, de la más vieja a la actual', () => {
  const s = R.serieSemanas(M, '2026-11-23', 2);
  assert.deepEqual(s.map(x => x.desde), ['2026-11-16', '2026-11-23']);
  assert.equal(s[0].recaudado, 48000); assert.equal(s[1].recaudado, 999);
});
test('serie de meses cruzando año', () => {
  assert.deepEqual(R.serieMeses([], '2027-01-15', 3).map(x => x.desde), ['2026-11-01', '2026-12-01', '2027-01-01']);
});
test('movimiento del domingo 3-ene cuenta en la semana del 28-dic y en enero', () => {
  const m = [{ id:'a', tipo:'venta', fecha:'2027-01-03', monto:100, productoId:'bidones', nota:'', creado:1 }];
  assert.equal(R.totales(m, R.rangoSemana('2026-12-28')).recaudado, 100);
  assert.equal(R.totales(m, R.rangoMes('2027-01-03')).recaudado, 100);
  assert.equal(R.totales(m, R.rangoMes('2026-12-28')).recaudado, 0);
});
test('lista del período ordenada, la más nueva arriba', () => {
  assert.deepEqual(R.movimientosDe(M, R.rangoSemana('2026-11-20')).map(x => x.id), ['6','5','4','3','2','1']);
});
```

- [ ] **Step 2: Correr** — FAIL (`R.totales is not a function`).
- [ ] **Step 3: Implementar** en `js/reglas.js`. Comparar fechas como strings (`'AAAA-MM-DD'` ordena bien).
- [ ] **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** — `"Reglas: totales por producto y series semanales/mensuales"`

### Task 3: Reglas — duración de insumos

**Files:**
- Modify: `js/reglas.js`, `tests/reglas.test.js`

**Interfaces:**
- Consumes: `diasEntre`, `sumarDias`.
- Produces: `duracionInsumo(aperturas: string[], hoy: string) -> null | { dias: number, abierto: string, terminaria: string, atrasado: boolean }` — `aperturas` en cualquier orden (se ordena una copia); `null` con menos de 2 aperturas; `dias` = promedio redondeado (mínimo 1) de los intervalos entre las últimas 4 aperturas; `abierto` = última apertura; `terminaria = abierto + dias`; `atrasado = hoy > terminaria`.

- [ ] **Step 1: Pruebas que fallan**

```js
test('duración de insumos', () => {
  assert.equal(R.duracionInsumo([], '2026-11-20'), null);
  assert.equal(R.duracionInsumo(['2026-11-16'], '2026-11-20'), null);
  assert.deepEqual(R.duracionInsumo(['2026-11-12', '2026-11-16'], '2026-11-18'),
    { dias:4, abierto:'2026-11-16', terminaria:'2026-11-20', atrasado:false });
  // solo cuentan las últimas 4 aperturas: el intervalo viejo de 30 días no pesa
  const a = ['2026-09-01', '2026-10-01', '2026-10-05', '2026-10-08', '2026-10-13'];
  assert.equal(R.duracionInsumo(a, '2026-10-14').dias, 4); // (4+3+5)/3
  assert.equal(R.duracionInsumo(['2026-11-16', '2026-11-12'], '2026-11-21').atrasado, true);
  assert.equal(R.duracionInsumo(['2026-11-16', '2026-11-12'], '2026-11-20').atrasado, false);
});
```

- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar.** **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** — `"Reglas: cuánto dura cada insumo"`

### Task 4: Calculadora (lógica pura)

**Files:**
- Create: `js/calculadora.js`, `tests/calculadora.test.js`

**Interfaces:**
- Produces (global `Calculadora`):
  - `nueva() -> Estado` (estado opaco; pantalla inicial `'0'`)
  - `tecla(e: Estado, t: string) -> Estado` — teclas `'0'..'9' ',' '+' '−' '×' '÷' '=' 'C' '⌫'`; no muta `e`.
  - `pantalla(e) -> string` — número con coma decimal y punto de miles (`'1.234,5'`); división por cero → `'Error'` hasta `'C'`.
  - `valor(e) -> number | null` — número actual (null si Error).
- Comportamiento de calculadora de bolsillo: evalúa de izquierda a derecha (sin precedencia), `=` repetido no hace nada, operador seguido de otro operador reemplaza al anterior, resultados redondeados a 2 decimales.

- [ ] **Step 1: Pruebas que fallan**

```js
const C = require('../js/calculadora.js');
const run = s => [...s].reduce((e, t) => C.tecla(e, t), C.nueva());
test('suma de un ticket', () => assert.equal(C.pantalla(run('1500+2300+800=')), '4.600'));
test('izquierda a derecha', () => assert.equal(C.pantalla(run('2+3×4=')), '20'));
test('decimales con coma', () => assert.equal(C.pantalla(run('10÷4=')), '2,5'));
test('cambiar de operador', () => assert.equal(C.pantalla(run('8+−3=')), '5'));
test('borrar', () => { assert.equal(C.pantalla(run('123⌫')), '12'); assert.equal(C.pantalla(run('12+3C')), '0'); });
test('dividir por cero', () => { const e = run('5÷0='); assert.equal(C.pantalla(e), 'Error'); assert.equal(C.valor(e), null); assert.equal(C.pantalla(C.tecla(e, 'C')), '0'); });
test('valor para pasar al monto', () => assert.equal(C.valor(run('1500+2300=')), 3800));
```

- [ ] **Step 2–4:** correr (FAIL), implementar, correr (PASS).
- [ ] **Step 5: Commit** — `"Calculadora de bolsillo"`

### Task 5: Store — datos, listas, insumos y copias de seguridad

**Files:**
- Create: `js/store.js`, `tests/store.test.js`

**Interfaces:**
- Consumes: `Reglas.hoy`, `Reglas.diasEntre` (el monto ya llega como número entero desde la pantalla).
- Produces (global `Store`):
  - `iniciar(storage = window.localStorage) -> { aviso: string | null }` — carga o crea datos de fábrica. En Node las pruebas pasan un storage falso `{getItem,setItem,removeItem}`.
  - `datos() -> Datos` con forma `{ version:1, productos:[{id,nombre,fijo?}], rubros:[{id,nombre}], movimientos:[Movimiento], insumos:[{id,nombre,presentacion,aperturas:[]}], ultimaCopia: string|null }`
  - Fábrica: productos `bidones/Bidones`, `pizzetas/Pizzetas`, `general/General (fijo:true)`; rubros `harina, huevos, azucar, levadura, envases, gas, otros` (nombres con mayúscula y tilde: Azúcar); insumos `Harina (1 kg)`, `Huevos (maple)`, `Azúcar (1 kg)`.
  - `guardarMovimiento(m) -> { ok: true, mov } | { ok: false, error: string }` — crea (sin `id`) o actualiza (con `id`); valida monto entero > 0, tipo, producto existente, venta nunca a `general`, gasto con rubro existente.
  - `borrarMovimiento(id) -> void`
  - `agregar(lista: 'productos'|'rubros'|'insumos', campos: {nombre, presentacion?}) -> item` (nombre recortado, no vacío; id derivado del nombre + sufijo si choca)
  - `renombrar(lista, id, campos) -> { ok, error? }` — rechaza `fijo`.
  - `borrar(lista, id) -> { ok, error? }` — rechaza `fijo` y productos/rubros usados por algún movimiento (`'Tiene movimientos anotados: podés cambiarle el nombre.'`).
  - `abrirInsumo(id, fecha = Reglas.hoy()) -> boolean` — false si ya hay apertura esa fecha.
  - `deshacerApertura(id) -> void` (quita la más reciente), `borrarApertura(id, fecha) -> void`
  - `exportarCopia() -> string` (`{app:'control-gastos', version:1, datos}`) y marca `ultimaCopia = hoy`.
  - `restaurarCopia(texto: string) -> { ok, error? }` — guarda lo actual en `controlGastos.v1.anterior` antes de reemplazar.
  - `necesitaCopia(hoy) -> boolean` — hay movimientos y (`ultimaCopia` null o > 30 días).
- Cada cambio persiste inmediatamente en `controlGastos.v1`.

- [ ] **Step 1: Pruebas que fallan** (helper `falso()` = storage en memoria)

```js
test('arranca con datos de fábrica', () => { /* productos ids ['bidones','pizzetas','general'], 7 rubros, 3 insumos, aviso null */ });
test('guardar, editar y borrar un gasto persiste', () => { /* guardarMovimiento sin id → ok, id nuevo; con id → actualiza monto; borrar; re-iniciar con el mismo storage y comprobar */ });
test('validaciones', () => {
  // monto 0 → ok:false; venta a 'general' → ok:false; gasto sin rubro → ok:false; producto 'x' → ok:false
});
test('no se borra General ni lo que tiene movimientos', () => {
  // borrar('productos','general').ok === false; con un gasto en 'harina', borrar('rubros','harina').ok === false; renombrar sí
});
test('doble toque en "Abrí uno nuevo" el mismo día no duplica', () => {
  // abrirInsumo(id,'2026-11-20') === true; de nuevo === false; aperturas.length === 1; deshacerApertura → 0
});
test('datos rotos: arranca vacío, guarda lo roto y avisa', () => {
  // storage con 'controlGastos.v1' = '{roto'; iniciar → aviso string no vacío; getItem('controlGastos.v1.danado') === '{roto'; datos() de fábrica
});
test('copia de seguridad ida y vuelta', () => { /* exportar, borrar todo, restaurar → mismos movimientos; anterior guardado */ });
test('archivo equivocado se rechaza y no toca nada', () => {
  for (const t of ['hola', '{"app":"mash-check","version":1,"datos":{}}', '{"app":"control-gastos","version":99,"datos":{}}', '{"app":"control-gastos","version":1}'])
    { /* restaurarCopia(t).ok === false, error string; movimientos sin cambios */ }
});
test('recordatorio de copia a los 30 días', () => { /* sin movimientos → false; con movimiento y ultimaCopia null → true; ultimaCopia hace 10 días → false; hace 31 → true */ });
```

Completar cada cuerpo con las aserciones del comentario.

- [ ] **Step 2–4:** correr (FAIL), implementar, correr (PASS).
- [ ] **Step 5: Commit** — `"Store: datos en el celular, insumos y copias de seguridad"`

### Task 6: Gráfico SVG y texto del resumen

**Files:**
- Create: `js/grafico.js`, `js/resumen.js`, `tests/grafico.test.js`, `tests/resumen.test.js`

**Interfaces:**
- Consumes: `serieSemanas`/`serieMeses` (forma `[{desde,hasta,recaudado,gastado}]`), `totales`, `duracionInsumo`, `etiquetaRango`, `formatoPesos`, `esc`.
- Produces:
  - `Grafico.barras(serie, etiquetas: string[]) -> string` — SVG con `viewBox="0 0 320 160"`, por cada período dos `<rect>` (clase `recaudado` y `gastado`), etiqueta corta abajo, `<title>` con los montos para accesibilidad. Serie toda en cero → SVG con el texto `Todavía no hay movimientos`. Escala al máximo de la serie.
  - `Resumen.texto({ rango, totales, productos, insumos, hoy }) -> string` — exactamente el formato de la sección 8.2 del spec: título `Resumen semana <etiqueta>` o `Resumen <mes año>`, líneas `Recaudado:`, `Gastado:`, `Quedó:`, una línea `• <Producto>: +$… (vendido $…, gastado $…)` por producto no-General con movimientos (ganancia negativa con `−$`), `• Gastos generales: $…` si hay, y `Insumos: harina dura ~4 días, …` solo con insumos que tengan duración. Montos sin espacio tras `$` en este texto (`$48.000`).

- [ ] **Step 1: Pruebas que fallan**

```js
test('barras: dos por período y proporcionales', () => {
  const svg = G.barras([{desde:'a',hasta:'b',recaudado:100,gastado:50}], ['16 nov']);
  assert.equal((svg.match(/<rect[^>]*class="recaudado"/g)||[]).length, 1);
  // altura de gastado = mitad de recaudado (leer atributo height)
});
test('barras vacías', () => assert.match(G.barras([{desde:'a',hasta:'b',recaudado:0,gastado:0}], ['x']), /Todavía no hay movimientos/));
test('resumen de la semana igual al del diseño', () => {
  // con los movimientos M de Task 2 (+ ajustar General a 2000) y harina ['2026-11-12','2026-11-16'], huevos con 2 aperturas a 6 días
  assert.equal(Resumen.texto(...), 'Resumen semana 16–22 nov\nRecaudado: $48.000\nGastado: $23.500\nQuedó: $24.500\n• Bidones: +$18.000 (vendido $30.000, gastado $12.000)\n• Pizzetas: +$8.500 (vendido $18.000, gastado $9.500)\n• Gastos generales: $2.000\nInsumos: harina dura ~4 días, huevos ~6 días');
});
test('resumen sin insumos con datos omite la línea Insumos', () => { /* sin aperturas → sin línea Insumos */ });
```

- [ ] **Step 2–4:** correr (FAIL), implementar, correr (PASS).
- [ ] **Step 5: Commit** — `"Gráfico de barras y resumen para compartir"`

### Task 7: Pantalla Inicio y formularios de gasto/venta

**Files:**
- Create: `index.html`, `css/styles.css`, `js/app.js`, `tests/e2e.js`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `index.html` con barra superior, `<main id="vista">`, barra de pestañas `Inicio · Insumos · Más` (`data-act="tab" data-tab="..."`), botones fijos `+ Gasto` / `+ Venta` en Inicio, hoja inferior `#hoja`. Eventos delegados con `data-act`. `tests/e2e.js`: levanta `python3 -m http.server` en un puerto libre sobre la raíz, abre Chromium (Playwright) a 390×844 y corre escenarios; sale con código 1 si alguno falla.

Pantalla según spec 8.1: selector Semana/Mes, flechas ‹ ›, bloque de totales (Te quedan en verde si ≥ 0, rojo si < 0), filas por producto tocables que despliegan el detalle por rubro, gráfico (8 semanas o 6 meses), botón Compartir resumen (`navigator.share({text})`, si no existe → `navigator.clipboard.writeText` + aviso "Copiado: pegalo en WhatsApp"), lista de movimientos del período (tocar → editar en la misma hoja, con botón Borrar que confirma), aviso de copia si `Store.necesitaCopia`. Formularios: monto con `inputmode="decimal"` leído con `Reglas.leerMonto` (error en rojo debajo si es null: "Escribí un monto, por ejemplo 1500"), productos y rubros como botones grandes, fecha por defecto `Reglas.hoy()`, nota opcional, cantidad opcional en venta. Al guardar: cierra la hoja y muestra "Guardado" 2 s.

- [ ] **Step 1: Escenarios e2e que fallan** en `tests/e2e.js`:
  - Anotar gasto `1.500` Pizzetas/Harina y venta `3000` Pizzetas → Inicio muestra Recaudado `$ 3.000`, Gastado `$ 1.500`, fila Pizzetas `+$ 1.500`.
  - Monto `abc` → mensaje de error visible y no se guarda nada.
  - Editar el gasto a `2000` y luego borrarlo (aceptando la confirmación) → Gastado `$ 0`.
  - Nota `<img src=x onerror=alert(1)>` se ve como texto literal y no se ejecuta (ningún diálogo).
  - Recargar la página conserva los movimientos.
  - Flecha ‹ lleva a la semana anterior y la etiqueta cambia.
- [ ] **Step 2: Correr** — `node tests/e2e.js` → FAIL.
- [ ] **Step 3: Implementar** `index.html`, `css/styles.css` (mobile first, botones ≥ 48 px, colores con buen contraste, `@media (prefers-color-scheme: dark)` opcional), `js/app.js`.
- [ ] **Step 4: Correr** — `node tests/e2e.js` y `node --test tests/` → PASS.
- [ ] **Step 5: Commit** — `"Inicio con totales, gráfico y carga de gastos y ventas"`

### Task 8: Pantallas Insumos y Más (calculadora, listas, copia de seguridad)

**Files:**
- Modify: `js/app.js`, `css/styles.css`, `tests/e2e.js`

**Interfaces:**
- Consumes: `Store.abrirInsumo/deshacerApertura/borrarApertura/agregar/renombrar/borrar/exportarCopia/restaurarCopia`, `Reglas.duracionInsumo`, `Calculadora`.

Insumos según spec 8.1 (mensajes: "Te dura unos N días · Abriste el actual el <día corto>", "Se terminaría el <día>", "Todavía no hay datos: tocá cuando abras el próximo", naranja "Ya debería estar por terminarse"); "Deshacer" visible 10 s tras abrir; historial con borrar; agregar/editar/borrar insumo. Si `abrirInsumo` devuelve false: "Ya lo marcaste hoy".
Más: Calculadora (desde el formulario muestra "Usar este número", que pone `Calculadora.valor` en el monto), Compartir resumen, Productos y rubros (agregar, renombrar, borrar con el error de Store), Copia de seguridad: "Guardar copia" descarga `control-gastos-AAAA-MM-DD.json` (si `navigator.canShare({files})` → compartir el archivo, para mandarlo por WhatsApp), "Recuperar copia" con `<input type=file>` y confirmación "Esto reemplaza todo lo que hay ahora. ¿Seguís?"; versión de la app al pie (sale del nombre de la caché).

- [ ] **Step 1: Escenarios e2e que fallan:**
  - Abrir Harina dos días distintos (fijando la fecha con `page.clock` o `Date` falso) → muestra "Te dura unos 4 días"; segundo toque el mismo día → "Ya lo marcaste hoy".
  - Calculadora desde el formulario: `1500+2300=` → "Usar este número" → monto `3800`.
  - Agregar producto "Empanadas" → aparece como botón en el formulario de venta; borrar rubro "Harina" con movimientos → mensaje de error.
  - Guardar copia (capturar la descarga), borrar datos, recuperar copia → movimientos de vuelta. Recuperar un archivo `hola.json` con texto "hola" → mensaje de error y datos intactos.
- [ ] **Step 2–4:** correr (FAIL), implementar, correr `node tests/e2e.js` y `node --test tests/` (PASS).
- [ ] **Step 5: Commit** — `"Insumos, calculadora, listas editables y copia de seguridad"`

### Task 9: PWA, publicación y guías

**Files:**
- Create: `sw.js`, `manifest.json`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `GUIA-PUBLICACION.md`, `docs/GUIA.md`, `docs/img/*`, `tools/demo.js`, `tools/ejemplo.js`, `README.md`, `CLAUDE.md`, `LICENSE` (MIT), `.gitignore`
- Modify: `index.html` (link al manifest, registro del SW), `tests/e2e.js`

`sw.js`: mismo esquema que `mash-check` (red primero con `cache:'no-cache'`, caché si no hay señal, `VERSION = 'control-gastos-v1'`, `ARCHIVOS` con todas las rutas relativas, borrar cachés viejas en `activate`). `manifest.json`: `name`/`short_name` "Control de Gastos", `lang` es-AR, `start_url`/`scope` `./`, `display` standalone, íconos 192/512 + maskable. Íconos PNG generados desde el SVG con Playwright (screenshot). `tools/demo.js` carga `tools/ejemplo.js` (datos inventados) y saca capturas a `docs/img/`; `docs/GUIA.md` es la guía para quien usa la app, en voseo, sin jerga, con esas capturas. `GUIA-PUBLICACION.md`: crear el repo `control-gastos`, subir archivos desde la web de GitHub, activar Pages, instalar en el celular, actualizar (subir `sw.js` siempre). `CLAUDE.md`: reglas de la sección Global Constraints + comandos de prueba.

- [ ] **Step 1: Escenario e2e que falla:** servir la carpeta bajo `/control-gastos/` (servir el directorio padre con un enlace simbólico), cargar, esperar al SW, cortar la red (`context.setOffline(true)`), recargar → la app abre y muestra los datos; el pie muestra `v1`.
- [ ] **Step 2–4:** correr (FAIL), implementar, correr `node tests/e2e.js` y `node --test tests/` (PASS). Correr `node tools/demo.js` y revisar que las capturas y la guía coincidan con lo que hace la app.
- [ ] **Step 5: Commit** — `"PWA instalable sin conexión, guía de uso y de publicación"`
