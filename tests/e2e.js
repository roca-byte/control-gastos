/* Pruebas de punta a punta en un Chromium real (Playwright), con la pantalla de un celular.
 * Uso:  node tests/e2e.js
 * Levanta un servidor local sobre la carpeta del repo, corre cada escenario en un perfil
 * nuevo (datos vacíos) y sale con código 1 si alguno falla.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// Sirve el repo bajo /control-gastos/, igual que GitHub Pages, para que las rutas relativas
// y el service worker se prueben como en el celular.
function servidor() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (!p.startsWith('/control-gastos/')) { res.writeHead(404); return res.end(); }
    p = p.slice('/control-gastos'.length);
    if (p.endsWith('/')) p += 'index.html';
    const archivo = path.join(RAIZ, p);
    if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

const escenarios = [];
const escenario = (nombre, fn) => escenarios.push({ nombre, fn });

// Ayudas: abrir el formulario, cargar y guardar.
async function anotar(page, tipo, { monto, producto, rubro, nota, cantidad }) {
  await page.click(`[data-act="nuevo"][data-tipo="${tipo}"]`);
  await page.fill('#monto', monto);
  await page.click(`#hoja [data-campo="productoId"][data-valor="${producto}"]`);
  if (rubro) await page.click(`#hoja [data-campo="rubroId"][data-valor="${rubro}"]`);
  if (nota) await page.fill('#nota', nota);
  if (cantidad) await page.fill('#cantidad', cantidad);
  await page.click('#hoja [data-act="guardar"]');
}
const texto = (page, sel) => page.locator(sel).innerText();

escenario('anotar un gasto y una venta muestra los totales', async (page) => {
  await anotar(page, 'gasto', { monto: '1.500', producto: 'pizzetas', rubro: 'harina' });
  await anotar(page, 'venta', { monto: '3000', producto: 'pizzetas' });
  assert.equal(await texto(page, '#t-recaudado'), '$ 3.000');
  assert.equal(await texto(page, '#t-gastado'), '$ 1.500');
  assert.match(await texto(page, '[data-producto="pizzetas"] .ganancia'), /\+\$ 1\.500/);
});

escenario('un monto mal escrito avisa y no guarda', async (page) => {
  await page.click('[data-act="nuevo"][data-tipo="gasto"]');
  await page.fill('#monto', 'abc');
  await page.click('#hoja [data-campo="productoId"][data-valor="pizzetas"]');
  await page.click('#hoja [data-campo="rubroId"][data-valor="harina"]');
  await page.click('#hoja [data-act="guardar"]');
  assert.match(await texto(page, '#hoja .error'), /Escribí un monto/);
  assert.equal(await page.evaluate(() => Store.datos().movimientos.length), 0);
});

escenario('editar y borrar un gasto', async (page) => {
  await anotar(page, 'gasto', { monto: '1500', producto: 'pizzetas', rubro: 'harina' });
  await page.click('.movimiento');
  await page.fill('#monto', '2000');
  await page.click('#hoja [data-act="guardar"]');
  assert.equal(await texto(page, '#t-gastado'), '$ 2.000');
  page.once('dialog', d => d.accept());
  await page.click('.movimiento');
  await page.click('#hoja [data-act="borrar-mov"]');
  assert.equal(await texto(page, '#t-gastado'), '$ 0');
});

escenario('el texto del usuario no se ejecuta', async (page) => {
  let dialogo = false;
  page.on('dialog', d => { dialogo = true; d.dismiss(); });
  await anotar(page, 'gasto', { monto: '100', producto: 'general', rubro: 'gas', nota: '<img src=x onerror=alert(1)>' });
  await page.waitForTimeout(300);
  assert.match(await texto(page, '.movimiento'), /<img src=x onerror=alert\(1\)>/);
  assert.equal(dialogo, false);
});

escenario('recargar conserva lo anotado', async (page) => {
  await anotar(page, 'venta', { monto: '500', producto: 'bidones', cantidad: '2' });
  await page.reload();
  assert.equal(await texto(page, '#t-recaudado'), '$ 500');
});

escenario('la flecha lleva a la semana anterior y Mes cambia el período', async (page) => {
  const antes = await texto(page, '#periodo');
  await page.click('[data-act="anterior"]');
  assert.notEqual(await texto(page, '#periodo'), antes);
  await page.click('[data-act="modo"][data-modo="mes"]');
  assert.match(await texto(page, '#periodo'), /^[a-z]+ \d{4}$/);
});

escenario('compartir resumen sin navigator.share copia el texto', async (page, context) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => { delete Navigator.prototype.share; });
  await anotar(page, 'venta', { monto: '500', producto: 'bidones' });
  await page.click('[data-act="compartir"]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Resumen semana/);
  assert.match(await texto(page, '#aviso'), /Copiado/);
});

escenario('insumos: cuánto dura y doble toque el mismo día', async (page) => {
  // Una apertura de hace 4 días cargada directo, y la de hoy con el botón.
  await page.evaluate(() => { Store.abrirInsumo('harina', Reglas.sumarDias(Reglas.hoy(), -4)); });
  await page.click('[data-act="tab"][data-tab="insumos"]');
  await page.click('[data-insumo="harina"] [data-act="abrir-insumo"]');
  assert.match(await texto(page, '[data-insumo="harina"]'), /Te dura unos 4 días/);
  assert.match(await texto(page, '[data-insumo="huevos"]'), /Todavía no hay datos/);
  await page.click('[data-insumo="harina"] [data-act="abrir-insumo"]');
  assert.match(await texto(page, '#aviso'), /Ya lo marcaste hoy/);
  await page.click('[data-insumo="harina"] [data-act="deshacer-apertura"]');
  assert.equal(await page.evaluate(() => Store.buscar('insumos', 'harina').aperturas.length), 1);
});

escenario('insumo atrasado se marca', async (page) => {
  await page.evaluate(() => { const h = Reglas.hoy(); Store.abrirInsumo('huevos', Reglas.sumarDias(h, -30)); Store.abrirInsumo('huevos', Reglas.sumarDias(h, -20)); });
  await page.click('[data-act="tab"][data-tab="insumos"]');
  assert.match(await texto(page, '[data-insumo="huevos"] .atrasado'), /Ya debería estar por terminarse/);
});

escenario('agregar un insumo nuevo', async (page) => {
  await page.click('[data-act="tab"][data-tab="insumos"]');
  page.once('dialog', d => d.accept('Levadura'));
  await page.click('[data-act="nuevo-insumo"]');
  assert.match(await texto(page, '#vista'), /Levadura/);
});

escenario('calculadora pasa el resultado al monto', async (page) => {
  await page.click('[data-act="nuevo"][data-tipo="gasto"]');
  await page.click('#hoja [data-act="calc"]');
  for (const t of '1500+2300=') await page.click(`#hoja [data-tecla="${t}"]`);
  assert.equal(await texto(page, '.calc-pantalla'), '3.800');
  await page.click('#hoja [data-act="usar-calc"]');
  assert.equal(await page.inputValue('#monto'), '3800');
});

escenario('calculadora suelta desde Más', async (page) => {
  await page.click('[data-act="tab"][data-tab="mas"]');
  await page.click('[data-act="calc"]');
  for (const t of '9×3=') await page.click(`#hoja [data-tecla="${t}"]`);
  assert.equal(await texto(page, '.calc-pantalla'), '27');
  assert.equal(await page.locator('#hoja [data-act="usar-calc"]').count(), 0);
});

escenario('productos y rubros editables', async (page) => {
  await page.click('[data-act="tab"][data-tab="mas"]');
  page.once('dialog', d => d.accept('Empanadas'));
  await page.click('[data-act="agregar-item"][data-lista="productos"]');
  await page.click('[data-act="tab"][data-tab="inicio"]');
  await page.click('[data-act="nuevo"][data-tipo="venta"]');
  assert.equal(await page.locator('#hoja [data-campo="productoId"]', { hasText: 'Empanadas' }).count(), 1);
  await page.click('#hoja [data-act="cerrar"]');
  await anotar(page, 'gasto', { monto: '100', producto: 'pizzetas', rubro: 'harina' });
  await page.click('[data-act="tab"][data-tab="mas"]');
  page.once('dialog', d => d.accept());
  await page.click('[data-act="borrar-item"][data-lista="rubros"][data-id="harina"]');
  assert.match(await texto(page, '#aviso'), /Tiene movimientos anotados/);
});

escenario('copia de seguridad: guardar, recuperar y rechazar un archivo equivocado', async (page) => {
  await page.evaluate(() => { delete Navigator.prototype.share; delete Navigator.prototype.canShare; });
  await anotar(page, 'venta', { monto: '700', producto: 'bidones' });
  await page.click('[data-act="tab"][data-tab="mas"]');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="guardar-copia"]')]);
  assert.match(descarga.suggestedFilename(), /^control-gastos-\d{4}-\d{2}-\d{2}\.json$/);
  const contenido = fs.readFileSync(await descarga.path(), 'utf8');
  await page.evaluate(() => { localStorage.clear(); Store.iniciar(localStorage); });
  page.once('dialog', d => d.accept());
  await page.setInputFiles('#archivo-copia', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(contenido) });
  await page.waitForFunction(() => Store.datos().movimientos.length === 1);
  page.once('dialog', d => d.accept());
  await page.setInputFiles('#archivo-copia', { name: 'hola.json', mimeType: 'application/json', buffer: Buffer.from('hola') });
  await page.waitForSelector('#aviso:not(.oculto)');
  assert.match(await texto(page, '#aviso'), /no es una copia/);
  assert.equal(await page.evaluate(() => Store.datos().movimientos.length), 1);
});

escenario('la versión se ve al pie de Más', async (page) => {
  await page.click('[data-act="tab"][data-tab="mas"]');
  assert.match(await texto(page, '.version'), /Control de Gastos/);
});

escenarios.push({ nombre: 'abre sin conexión con los datos y muestra la versión', conSW: true, fn: async (page, context, url) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await anotar(page, 'venta', { monto: '900', producto: 'bidones' });
  await context.setOffline(true);
  await page.reload();
  assert.equal(await texto(page, '#t-recaudado'), '$ 900');
  await page.click('[data-act="tab"][data-tab="mas"]');
  await page.waitForFunction(() => /versión \d+/.test(document.querySelector('.version').textContent));
  const v = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').match(/control-gastos-v(\d+)/)[1];
  assert.match(await texto(page, '.version'), new RegExp('versión ' + v + '$'));
  await context.setOffline(false);
} });

escenario('el manifest y los íconos existen', async (page, context, url) => {
  const m = await (await page.request.get(url + 'manifest.json')).json();
  assert.equal(m.start_url, './');
  for (const i of m.icons) assert.equal((await page.request.get(url + i.src)).status(), 200, i.src);
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  for (const a of sw.match(/'\.\/[^']*'/g)) assert.equal((await page.request.get(url + a.slice(3, -1))).status(), 200, a);
});

// Bienvenida: arranca sin configurar, como la primera vez que alguien abre la app.
escenarios.push({ nombre: 'bienvenida: nombre, productos y en qué gasta', sinConfigurar: true, fn: async (page) => {
  assert.equal(await page.locator('.pestanas').isVisible(), false);
  await page.fill('#negocio', 'La Esquina');
  await page.click('[data-act="bien-siguiente"]');
  await page.click('[data-act="bien-siguiente"]');
  assert.match(await texto(page, '.error'), /al menos un producto/);
  await page.fill('.producto-nombre >> nth=0', 'Bidones');
  await page.click('[data-act="bien-otro-producto"]');
  await page.fill('.producto-nombre >> nth=1', 'Pizzetas');
  await page.click('[data-act="bien-siguiente"]');
  await page.click('[data-act="bien-rubro"][data-nombre="Harina"]');
  await page.fill('#rubro-otro', 'Fletes');
  await page.click('[data-act="bien-agregar-rubro"]');
  await page.click('[data-act="bien-empezar"]');
  assert.equal(await texto(page, '.barra h1'), 'La Esquina');
  assert.equal(await page.locator('.pestanas').isVisible(), true);
  await page.click('[data-act="nuevo"][data-tipo="gasto"]');
  const prods = await page.locator('#hoja [data-campo="productoId"]').allInnerTexts();
  assert.deepEqual(prods, ['Bidones', 'Pizzetas', 'General']);
  const rubros = await page.locator('#hoja [data-campo="rubroId"]').allInnerTexts();
  assert.deepEqual(rubros, ['Harina', 'Fletes', 'Otros']);
  await page.reload();
  assert.equal(await page.locator('#negocio').count(), 0, 'no vuelve a preguntar');
}});

escenarios.push({ nombre: 'bienvenida: se puede volver atrás sin perder lo escrito', sinConfigurar: true, fn: async (page) => {
  await page.fill('#negocio', 'Mi negocio');
  await page.click('[data-act="bien-siguiente"]');
  await page.fill('.producto-nombre >> nth=0', 'Tortas');
  await page.click('[data-act="bien-atras"]');
  assert.equal(await page.inputValue('#negocio'), 'Mi negocio');
  await page.click('[data-act="bien-siguiente"]');
  assert.equal(await page.inputValue('.producto-nombre >> nth=0'), 'Tortas');
}});

escenario('el nombre del negocio se cambia en Más y sale en el resumen', async (page, context) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => { delete Navigator.prototype.share; });
  await page.click('[data-act="tab"][data-tab="mas"]');
  page.once('dialog', d => d.accept('Bidones Juan'));
  await page.click('[data-act="nombrar-negocio"]');
  assert.equal(await texto(page, '.barra h1'), 'Bidones Juan');
  await page.click('[data-act="compartir"]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Bidones Juan\nResumen semana/);
});

(async () => {
  const filtro = process.argv[2];
  const srv = servidor().listen(0);
  const url = `http://localhost:${srv.address().port}/control-gastos/`;
  const browser = await chromium.launch();
  let fallas = 0;
  for (const e of escenarios) {
    if (filtro && !e.nombre.includes(filtro)) continue;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: e.conSW ? 'allow' : 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errores = [];
    page.on('pageerror', err => errores.push(err.message));
    try {
      await page.goto(url);
      // Salvo en la bienvenida, cada escenario arranca con el negocio del diseño ya configurado.
      if (!e.sinConfigurar) {
        await page.evaluate(() => {
          Store.configurar({ negocio: '', productos: ['Bidones', 'Pizzetas'], rubros: ['Harina', 'Huevos', 'Azúcar', 'Levadura', 'Envases', 'Gas', 'Otros'] });
          Store.agregar('insumos', { nombre: 'Harina', presentacion: '1 kg' });
          Store.agregar('insumos', { nombre: 'Huevos', presentacion: 'maple' });
          App.pintar();
        });
      }
      await e.fn(page, context, url);
      assert.deepEqual(errores, [], 'errores de JavaScript en la página');
      console.log('ok   ' + e.nombre);
    } catch (err) {
      fallas++;
      console.log('FALLA ' + e.nombre + '\n      ' + String(err.message).split('\n').slice(0, 6).join('\n      '));
    }
    await context.close();
  }
  await browser.close();
  srv.close();
  console.log(fallas ? `${fallas} escenario(s) fallaron` : 'todos los escenarios pasaron');
  process.exit(fallas ? 1 : 0);
})();
