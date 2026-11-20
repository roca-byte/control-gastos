// Pruebas de las reglas (js/reglas.js). Correr con:  node --test tests/
// No necesitan navegador: reglas.js son funciones puras.
const test = require('node:test');
const assert = require('node:assert/strict');
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
  assert.match(R.hoy(), /^\d{4}-\d{2}-\d{2}$/);
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

const M = [
  { id: '1', tipo: 'venta', fecha: '2026-11-16', monto: 30000, productoId: 'bidones', cantidad: 10, nota: '', creado: 1 },
  { id: '2', tipo: 'gasto', fecha: '2026-11-17', monto: 12000, productoId: 'bidones', rubroId: 'envases', nota: '', creado: 2 },
  { id: '3', tipo: 'venta', fecha: '2026-11-18', monto: 18000, productoId: 'pizzetas', nota: '', creado: 3 },
  { id: '4', tipo: 'gasto', fecha: '2026-11-18', monto: 6000, productoId: 'pizzetas', rubroId: 'harina', nota: '', creado: 4 },
  { id: '5', tipo: 'gasto', fecha: '2026-11-19', monto: 3500, productoId: 'pizzetas', rubroId: 'huevos', nota: '', creado: 5 },
  { id: '6', tipo: 'gasto', fecha: '2026-11-22', monto: 2000, productoId: 'general', rubroId: 'gas', nota: '', creado: 6 },
  { id: '7', tipo: 'venta', fecha: '2026-11-23', monto: 999, productoId: 'bidones', nota: '', creado: 7 },
];

test('totales de la semana, por producto, General solo en el total', () => {
  const t = R.totales(M, R.rangoSemana('2026-11-20'));
  assert.equal(t.recaudado, 48000); assert.equal(t.gastado, 23500); assert.equal(t.quedo, 24500);
  assert.deepEqual(t.porProducto.bidones, { vendido: 30000, gastado: 12000, ganancia: 18000, cantidad: 10, porRubro: { envases: 12000 } });
  assert.equal(t.porProducto.pizzetas.ganancia, 8500);
  assert.deepEqual(t.porProducto.pizzetas.porRubro, { harina: 6000, huevos: 3500 });
  assert.equal(t.porProducto.general.gastado, 2000);
  assert.equal(t.porProducto.general.vendido, 0);
});

test('período vacío da ceros', () => {
  assert.deepEqual(R.totales(M, R.rangoSemana('2026-10-01')), { recaudado: 0, gastado: 0, quedo: 0, porProducto: {} });
});

test('serie de semanas, de la más vieja a la actual', () => {
  const s = R.serieSemanas(M, '2026-11-23', 2);
  assert.deepEqual(s.map(x => x.desde), ['2026-11-16', '2026-11-23']);
  assert.equal(s[0].recaudado, 48000); assert.equal(s[0].gastado, 23500); assert.equal(s[1].recaudado, 999);
});

test('serie de meses cruzando año', () => {
  assert.deepEqual(R.serieMeses([], '2027-01-15', 3).map(x => x.desde), ['2026-11-01', '2026-12-01', '2027-01-01']);
});

test('movimiento del domingo 3-ene cuenta en la semana del 28-dic y en enero', () => {
  const m = [{ id: 'a', tipo: 'venta', fecha: '2027-01-03', monto: 100, productoId: 'bidones', nota: '', creado: 1 }];
  assert.equal(R.totales(m, R.rangoSemana('2026-12-28')).recaudado, 100);
  assert.equal(R.totales(m, R.rangoMes('2027-01-03')).recaudado, 100);
  assert.equal(R.totales(m, R.rangoMes('2026-12-28')).recaudado, 0);
});

test('lista del período ordenada, la más nueva arriba', () => {
  assert.deepEqual(R.movimientosDe(M, R.rangoSemana('2026-11-20')).map(x => x.id), ['6', '5', '4', '3', '2', '1']);
});

test('duración de insumos', () => {
  assert.equal(R.duracionInsumo([], '2026-11-20'), null);
  assert.equal(R.duracionInsumo(['2026-11-16'], '2026-11-20'), null);
  assert.deepEqual(R.duracionInsumo(['2026-11-12', '2026-11-16'], '2026-11-18'),
    { dias: 4, abierto: '2026-11-16', terminaria: '2026-11-20', atrasado: false });
  // solo cuentan las últimas 4 aperturas: el intervalo viejo de 30 días no pesa
  const a = ['2026-09-01', '2026-10-01', '2026-10-05', '2026-10-08', '2026-10-13'];
  assert.equal(R.duracionInsumo(a, '2026-10-14').dias, 4); // (4+3+5)/3
  assert.equal(R.duracionInsumo(['2026-11-16', '2026-11-12'], '2026-11-21').atrasado, true);
  assert.equal(R.duracionInsumo(['2026-11-16', '2026-11-12'], '2026-11-20').atrasado, false);
  const orig = ['2026-11-16', '2026-11-12']; R.duracionInsumo(orig, '2026-11-20');
  assert.deepEqual(orig, ['2026-11-16', '2026-11-12'], 'no reordena el arreglo guardado');
});
