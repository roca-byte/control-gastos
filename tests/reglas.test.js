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
