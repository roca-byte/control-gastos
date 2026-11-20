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
