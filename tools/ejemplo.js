/* Datos de ejemplo INVENTADOS para las capturas y el video. No son de ningún negocio real y la
 * app no los usa: solo los cargan tools/demo.js y tools/video.js en un navegador de prueba.
 * Se arman relativos a "hoy" para que las capturas siempre muestren la semana actual con datos.
 */
const Reglas = require('../js/reglas.js');

function datos(hoy) {
  const lunes = Reglas.rangoSemana(hoy).desde;
  const movimientos = [];
  let n = 0;
  const mov = (tipo, dias, monto, productoId, rubroId, nota, cantidad) => {
    const fecha = Reglas.sumarDias(lunes, dias);
    if (fecha > hoy) return; // nada en el futuro
    const m = { id: 'ej' + (++n), tipo, fecha, monto, productoId, nota: nota || '', creado: n };
    if (rubroId) m.rubroId = rubroId;
    if (cantidad) m.cantidad = cantidad;
    movimientos.push(m);
  };
  // Siete semanas hacia atrás, con algo de variación para que el gráfico tenga forma.
  const ritmo = [0.7, 0.85, 0.8, 1, 0.9, 1.1, 1.05];
  ritmo.forEach((r, i) => {
    const base = -7 * (7 - i);
    mov('venta', base + 1, Math.round(26000 * r / 100) * 100, 'bidones', null, '', Math.round(10 * r));
    mov('venta', base + 4, Math.round(15000 * r / 100) * 100, 'bidones', null, '', Math.round(6 * r));
    mov('gasto', base + 1, Math.round(16000 * r / 100) * 100, 'bidones', 'envases', 'Recarga de bidones');
    mov('venta', base + 3, Math.round(21000 * r / 100) * 100, 'pizzetas', null, '', Math.round(30 * r));
    mov('gasto', base + 2, 4200, 'pizzetas', 'harina', '');
    mov('gasto', base + 2, 3600, 'pizzetas', 'huevos', '');
    mov('gasto', base + 5, 2500, 'general', 'gas', 'Garrafa');
  });
  // Semana actual
  mov('venta', 0, 30000, 'bidones', null, 'Pedido del club', 12);
  mov('gasto', 0, 12000, 'bidones', 'envases', 'Recarga de bidones');
  mov('gasto', 1, 4200, 'pizzetas', 'harina', '5 kg de harina');
  mov('venta', 2, 18000, 'pizzetas', null, '', 24);
  mov('gasto', 2, 3600, 'pizzetas', 'huevos', '');
  mov('gasto', 3, 1700, 'pizzetas', 'azucar', '');
  mov('gasto', 3, 2500, 'general', 'gas', 'Garrafa');
  mov('venta', 4, 9500, 'pizzetas', null, 'Feria', 12);

  const abrir = (cada, veces) => Array.from({ length: veces }, (_, i) => Reglas.sumarDias(hoy, -cada * (veces - 1 - i) - 1));
  return {
    version: 1,
    productos: [{ id: 'bidones', nombre: 'Bidones' }, { id: 'pizzetas', nombre: 'Pizzetas' }, { id: 'general', nombre: 'General', fijo: true }],
    rubros: ['Harina', 'Huevos', 'Azúcar', 'Levadura', 'Envases', 'Gas', 'Otros'].map((nombre) => ({
      id: nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), nombre })),
    movimientos,
    insumos: [
      { id: 'harina', nombre: 'Harina', presentacion: '1 kg', aperturas: abrir(4, 4) },
      { id: 'huevos', nombre: 'Huevos', presentacion: 'maple', aperturas: abrir(6, 3) },
      { id: 'azucar', nombre: 'Azúcar', presentacion: '1 kg', aperturas: [Reglas.sumarDias(hoy, -3)] },
    ],
    ultimaCopia: Reglas.sumarDias(hoy, -5),
  };
}

module.exports = { datos };
