/* Graba el video de demostración: docs/video/control-gastos-demo.mp4
 *
 * Uso:  node tools/video.js   (necesita Playwright y ffmpeg)
 * Recorre la app en un celular con los datos INVENTADOS de tools/ejemplo.js: anotar un gasto y
 * una venta, ver la semana y la ganancia por producto, el gráfico y el mes, "Abrí uno nuevo" en
 * un insumo, la calculadora, compartir el resumen, la copia de seguridad y el uso sin señal.
 * Lleva carteles que explican cada paso, un círculo en cada toque y placas de apertura y cierre.
 * Volver a correrlo cada vez que cambie algo visible de la app.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { arrancar, RAIZ } = require('./servidor');
const Ejemplo = require('./ejemplo');
const Reglas = require('../js/reglas.js');

const SALIDA = path.join(RAIZ, 'docs', 'video');

// Se inyecta en la página: carteles, placa, visor del mensaje y marca de toques. Vive fuera de
// #vista (que la app redibuja entera), así sobrevive a cada pantalla nueva.
function preparar() {
  const css = document.createElement('style');
  css.textContent = `
    #v-cartel { position: fixed; left: 12px; right: 12px; top: 12px; z-index: 99; padding: 12px 16px; pointer-events: none;
      background: rgba(20, 26, 51, .94); color: #fff; border-radius: 14px; font: 600 17px/1.35 "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 6px 24px rgba(0,0,0,.25); transition: opacity .35s, transform .35s; }
    #v-cartel.oculto { opacity: 0; transform: translateY(-14px); }
    #v-cartel small { display: block; font-weight: 400; font-size: 14px; opacity: .85; margin-top: 2px; }
    #v-placa { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; text-align: center; padding: 24px; background: #1d3fd8; color: #fff;
      font-family: "Segoe UI", Roboto, sans-serif; transition: opacity .6s; }
    #v-placa.oculto { opacity: 0; pointer-events: none; }
    #v-placa img { width: 112px; height: 112px; border-radius: 24px; }
    #v-placa h1 { margin: 0; font-size: 34px; line-height: 1.15; }
    #v-placa p { margin: 0; font-size: 18px; opacity: .92; max-width: 310px; line-height: 1.4; }
    #v-placa b { color: #ffd23f; }
    #v-visor { position: fixed; inset: 0; z-index: 97; background: #0b141a; padding: 130px 14px 40px; transition: opacity .5s; }
    #v-visor.oculto { opacity: 0; pointer-events: none; }
    #v-visor .burbuja { background: #005c4b; color: #e9edef; border-radius: 10px 0 10px 10px; padding: 10px 12px; margin-left: 30px;
      white-space: pre-wrap; font: 15px/1.45 "Segoe UI", Roboto, sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
    .v-toque { position: fixed; z-index: 98; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(255, 210, 63, .35); border: 3px solid #ffd23f; pointer-events: none; animation: v-toque .6s ease-out forwards; }
    @keyframes v-toque { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }`;
  document.head.appendChild(css);
  const crear = (id) => { const e = document.createElement('div'); e.id = id; e.className = 'oculto'; document.body.appendChild(e); return e; };
  const cartel = crear('v-cartel'), placa = crear('v-placa'), visor = crear('v-visor');
  document.addEventListener('pointerdown', (e) => {
    const t = document.createElement('div');
    t.className = 'v-toque'; t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 700);
  }, true);
  window.vCartel = (titulo, detalle) => {
    if (!titulo) { cartel.classList.add('oculto'); return; }
    cartel.innerHTML = titulo + (detalle ? '<small>' + detalle + '</small>' : '');
    cartel.classList.remove('oculto');
  };
  window.vPlaca = (html) => { if (html) { placa.innerHTML = html; placa.classList.remove('oculto'); } else placa.classList.add('oculto'); };
  window.vVisor = (texto) => {
    if (!texto) { visor.classList.add('oculto'); return; }
    visor.innerHTML = '<div class="burbuja"></div>';
    visor.firstChild.textContent = texto;
    visor.classList.remove('oculto');
  };
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-video-'));
  const { srv, url } = await arrancar();
  const browser = await chromium.launch();
  // Con service worker: al final se corta la red y la app tiene que seguir abriendo.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'es-AR', colorScheme: 'light' });
  const datos = JSON.stringify(Ejemplo.datos(Reglas.hoy()));
  await ctx.addInitScript((d) => {
    if (!localStorage.getItem('controlGastos.v1')) localStorage.setItem('controlGastos.v1', d);
    // En la compu no hay "compartir" del celular: se simula para que el video muestre el mensaje.
    navigator.share = (o) => { if (o.text && window.vVisor) window.vVisor(o.text); return Promise.resolve(); };
    navigator.canShare = () => false;
  }, datos);
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { throw e; });

  // Grabación: capturas seguidas a resolución doble, cada una con su hora. (La grabación propia
  // de Playwright da cuadros de 390 px, que en un celular se ven borrosos.)
  const cuadros = [];
  let grabando = false;
  async function grabar() {
    while (grabando) {
      const t = Date.now() / 1000;
      const archivo = path.join(carpeta, 'c' + String(cuadros.length).padStart(5, '0') + '.jpg');
      try {
        await page.screenshot({ path: archivo, type: 'jpeg', quality: 88, animations: 'allow', caret: 'initial' });
        cuadros.push({ archivo, t });
      } catch (e) { /* la página se está redibujando: se saltea el cuadro */ }
    }
  }

  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('#t-recaudado');
  await page.evaluate(preparar);

  const espera = (ms) => page.waitForTimeout(ms);
  const cartel = async (t, d, ms) => { await page.evaluate(([a, b]) => window.vCartel(a, b), [t, d || '']); await espera(ms || 2800); };
  const sinCartel = () => page.evaluate(() => window.vCartel(''));
  const placa = async (html, ms) => { await page.evaluate((h) => window.vPlaca(h), html); await espera(ms); };
  const tocar = async (sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.tap(sel); await espera(550); };
  const escribir = async (sel, texto) => { await page.locator(sel).pressSequentially(texto, { delay: 110 }); await espera(300); };
  const ver = async (sel) => {
    await page.locator(sel).first().evaluate((e) => {
      const r = e.getBoundingClientRect();
      window.scrollTo({ top: scrollY + r.top - 110, behavior: 'smooth' });
    });
    await espera(900);
  };
  const icono = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(RAIZ, 'icons', 'icon.svg')).toString('base64');

  grabando = true;
  const grabacion = grabar();

  await placa(`<img src="${icono}" alt=""><h1>Control de Gastos</h1><p>Anotá lo que gastás y lo que cobrás, y mirá <b>cuánto te deja cada producto</b>.</p>`, 3200);
  await placa('', 700);

  await cartel('Así va la semana', 'Lo que entró, lo que salió y lo que te queda');
  await cartel('Cuánto deja cada producto', 'Bidones y pizzetas, cada uno con su ganancia', 2400);
  await sinCartel();

  // Anotar un gasto
  await cartel('Anotar un gasto', 'Tocá + Gasto', 1800);
  await tocar('[data-act="nuevo"][data-tipo="gasto"]');
  await cartel('¿Cuánto gastaste?', 'Con o sin puntos, es lo mismo', 1200);
  await escribir('#monto', '4.200');
  await cartel('¿Para qué producto y qué compraste?', 'Un toque en cada uno', 900);
  await tocar('#hoja [data-campo="productoId"][data-valor="pizzetas"]');
  await tocar('#hoja [data-campo="rubroId"][data-valor="harina"]');
  await tocar('#hoja [data-act="guardar"]');
  await cartel('¡Listo! Ya cuenta en la semana', '', 2200);

  // Anotar una venta usando la calculadora
  await cartel('Anotar una venta', 'Y si tenés que sumar, la calculadora está a mano', 1800);
  await tocar('[data-act="nuevo"][data-tipo="venta"]');
  await tocar('#hoja [data-act="calc"]');
  for (const t of '6000+3500=') { await page.tap(`#hoja [data-tecla="${t}"]`); await espera(230); }
  await espera(600);
  await tocar('#hoja [data-act="usar-calc"]');
  await tocar('#hoja [data-campo="productoId"][data-valor="pizzetas"]');
  await escribir('#cantidad', '12');
  await tocar('#hoja [data-act="guardar"]');
  await sinCartel();
  await espera(800);

  // Detalle de producto y gráfico
  await cartel('Tocá un producto', 'Ves en qué se fue la plata', 1500);
  await tocar('[data-act="desplegar"][data-id="pizzetas"]');
  await espera(1600);
  await ver('.grafico');
  await cartel('Semana a semana', 'Verde lo que entró, naranja lo que salió', 3000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await espera(700);
  await cartel('¿Y el mes entero?', 'Tocá Mes', 1200);
  await tocar('[data-act="modo"][data-modo="mes"]');
  await espera(1800);
  await tocar('[data-act="modo"][data-modo="semana"]');

  // Compartir resumen
  await cartel('Mandá el resumen por WhatsApp', 'Tocá Compartir resumen', 1500);
  await tocar('[data-act="compartir"]');
  await cartel('Así llega el mensaje', '', 3800);
  await page.evaluate(() => window.vVisor(''));
  await page.evaluate(() => window.scrollTo(0, 0));
  await espera(600);

  // Insumos
  await cartel('¿Cuánto te dura la harina?', 'En Insumos', 1500);
  await tocar('[data-act="tab"][data-tab="insumos"]');
  await cartel('Cada vez que abrís uno nuevo, un toque', 'La app calcula cuánto te dura', 1800);
  await tocar('[data-insumo="harina"] [data-act="abrir-insumo"]');
  await espera(2400);

  // Copia de seguridad
  await cartel('No pierdas nada', 'En Más: Guardar copia, y mandátela por WhatsApp', 1500);
  await tocar('[data-act="tab"][data-tab="mas"]');
  await ver('[data-act="guardar-copia"]');
  await espera(2500);

  // Sin señal
  await cartel('Funciona sin internet', 'Los datos quedan en tu celular', 1200);
  await ctx.setOffline(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await tocar('[data-act="tab"][data-tab="inicio"]');
  await espera(2400);
  await sinCartel();

  await placa(`<img src="${icono}" alt=""><h1>Control de Gastos</h1><p>Sin cuentas, sin internet, <b>gratis</b>.<br>Se instala desde el navegador.</p>`, 3500);

  grabando = false;
  await grabacion;
  const fin = Date.now() / 1000;
  await ctx.close();
  await browser.close();
  srv.close();

  // Lista de cuadros con cuánto dura cada uno en pantalla (hasta que llega el siguiente).
  const lista = path.join(carpeta, 'lista.txt');
  fs.writeFileSync(lista, cuadros.map((c, i) => {
    const hasta = i + 1 < cuadros.length ? cuadros[i + 1].t : fin;
    return "file '" + c.archivo + "'\nduration " + Math.max(0.04, hasta - c.t).toFixed(3);
  }).join('\n') + "\nfile '" + cuadros[cuadros.length - 1].archivo + "'\n");

  // Cuadros → MP4 (H.264, yuv420p) a 25 cuadros por segundo: se ve en WhatsApp y en cualquier
  // celular. El ancho y el alto tienen que ser pares para H.264.
  const mp4 = path.join(SALIDA, 'control-gastos-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', 'fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-movflags', '+faststart', '-an', mp4]);
  fs.rmSync(carpeta, { recursive: true, force: true });
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
  console.log('Cuadros:', cuadros.length);
  console.log('Video:', path.relative(RAIZ, mp4), Math.round(fs.statSync(mp4).size / 1024) + ' KB,', Math.round(dur) + ' s');
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
