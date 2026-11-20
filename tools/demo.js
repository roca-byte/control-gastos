/* Saca las capturas de la guía (docs/img/*.png) sobre la app real, en un celular de 390×844,
 * con los datos inventados de tools/ejemplo.js.
 * Uso:  node tools/demo.js   (necesita Playwright). Volver a correrlo si cambia algo visible.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { arrancar, RAIZ } = require('./servidor');
const Ejemplo = require('./ejemplo');
const Reglas = require('../js/reglas.js');

const SALIDA = path.join(RAIZ, 'docs', 'img');

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { srv, url } = await arrancar();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light', locale: 'es-AR' });
  // Primero la bienvenida, en un perfil vacío (como la primera vez que alguien abre la app).
  {
    const nuevo = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light', locale: 'es-AR' });
    const p = await nuevo.newPage();
    await p.goto(url);
    await p.fill('#negocio', 'La Esquina');
    await p.screenshot({ path: path.join(SALIDA, '00-bienvenida-1.png') });
    await p.click('[data-act="bien-siguiente"]');
    await p.fill('.producto-nombre >> nth=0', 'Bidones');
    await p.click('[data-act="bien-otro-producto"]');
    await p.fill('.producto-nombre >> nth=1', 'Pizzetas');
    await p.screenshot({ path: path.join(SALIDA, '00-bienvenida-2.png') });
    await p.click('[data-act="bien-siguiente"]');
    for (const r of ['Harina', 'Huevos', 'Envases', 'Gas']) await p.click(`[data-act="bien-rubro"][data-nombre="${r}"]`);
    await p.screenshot({ path: path.join(SALIDA, '00-bienvenida-3.png') });
    console.log('  docs/img/00-bienvenida-1..3.png');
    await nuevo.close();
  }
  const datos = JSON.stringify(Ejemplo.datos(Reglas.hoy()));
  await context.addInitScript((d) => { if (!localStorage.getItem('controlGastos.v1')) localStorage.setItem('controlGastos.v1', d); }, datos);
  const page = await context.newPage();
  const foto = async (nombre, completa) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(SALIDA, nombre + '.png'), fullPage: !!completa }); console.log('  docs/img/' + nombre + '.png'); };

  await page.goto(url);
  await foto('01-inicio');
  await page.click('[data-act="desplegar"][data-id="pizzetas"]');
  await page.locator('[data-producto="pizzetas"]').scrollIntoViewIfNeeded();
  await foto('02-por-producto');
  await page.locator('.grafico').scrollIntoViewIfNeeded();
  await foto('03-grafico');
  await page.click('[data-act="modo"][data-modo="mes"]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await foto('04-mes');
  await page.click('[data-act="modo"][data-modo="semana"]');

  await page.click('[data-act="nuevo"][data-tipo="gasto"]');
  await page.fill('#monto', '4.200');
  await page.click('#hoja [data-campo="productoId"][data-valor="pizzetas"]');
  await page.click('#hoja [data-campo="rubroId"][data-valor="harina"]');
  await foto('05-anotar-gasto');
  await page.click('#hoja [data-act="calc"]');
  for (const t of '1500+2700=') await page.click(`#hoja [data-tecla="${t}"]`);
  await foto('06-calculadora');
  await page.click('#hoja [data-act="volver-form"]');
  await page.click('#hoja [data-act="cerrar"]');

  await page.click('[data-act="nuevo"][data-tipo="venta"]');
  await page.fill('#monto', '9500');
  await page.click('#hoja [data-campo="productoId"][data-valor="pizzetas"]');
  await page.fill('#cantidad', '12');
  await foto('07-anotar-venta');
  await page.click('#hoja [data-act="cerrar"]');

  await page.click('[data-act="tab"][data-tab="insumos"]');
  await foto('08-insumos');
  await page.click('[data-act="tab"][data-tab="mas"]');
  await foto('09-mas');
  await page.locator('[data-act="guardar-copia"]').scrollIntoViewIfNeeded();
  await foto('10-copia');

  await browser.close();
  srv.close();
})();
