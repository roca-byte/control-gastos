// Pruebas del gráfico (js/grafico.js) y del resumen para compartir (js/resumen.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/grafico.js');
const Resumen = require('../js/resumen.js');
const R = require('../js/reglas.js');

const alto = (svg, clase) => +svg.match(new RegExp('<rect[^>]*class="' + clase + '"[^>]*height="([\\d.]+)"'))[1];

test('barras: dos por período y proporcionales', () => {
  const svg = G.barras([{ desde: 'a', hasta: 'b', recaudado: 100, gastado: 50 }, { desde: 'c', hasta: 'd', recaudado: 0, gastado: 20 }], ['16 nov', '23 nov']);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 320 160"/);
  assert.equal((svg.match(/<rect[^>]*class="recaudado"/g) || []).length, 2);
  assert.equal((svg.match(/<rect[^>]*class="gastado"/g) || []).length, 2);
  assert.equal(alto(svg, 'gastado') * 2, alto(svg, 'recaudado'));
  assert.match(svg, /16 nov/);
  assert.match(svg, /<title>[^<]*\$ 100[^<]*\$ 50/);
});

test('barras vacías', () => {
  assert.match(G.barras([{ desde: 'a', hasta: 'b', recaudado: 0, gastado: 0 }], ['x']), /Todavía no hay movimientos/);
});

test('etiquetas del gráfico se escapan', () => {
  assert.doesNotMatch(G.barras([{ desde: 'a', hasta: 'b', recaudado: 1, gastado: 1 }], ['<b>']), /<b>/);
});

const M = [
  { id: '1', tipo: 'venta', fecha: '2026-11-16', monto: 30000, productoId: 'bidones', nota: '', creado: 1 },
  { id: '2', tipo: 'gasto', fecha: '2026-11-17', monto: 12000, productoId: 'bidones', rubroId: 'envases', nota: '', creado: 2 },
  { id: '3', tipo: 'venta', fecha: '2026-11-18', monto: 18000, productoId: 'pizzetas', nota: '', creado: 3 },
  { id: '4', tipo: 'gasto', fecha: '2026-11-18', monto: 9500, productoId: 'pizzetas', rubroId: 'harina', nota: '', creado: 4 },
  { id: '6', tipo: 'gasto', fecha: '2026-11-22', monto: 2000, productoId: 'general', rubroId: 'gas', nota: '', creado: 6 },
];
const PRODUCTOS = [{ id: 'bidones', nombre: 'Bidones' }, { id: 'pizzetas', nombre: 'Pizzetas' }, { id: 'general', nombre: 'General', fijo: true }];
const INSUMOS = [
  { id: 'harina', nombre: 'Harina', aperturas: ['2026-11-12', '2026-11-16'] },
  { id: 'huevos', nombre: 'Huevos', aperturas: ['2026-11-08', '2026-11-14'] },
  { id: 'azucar', nombre: 'Azúcar', aperturas: [] },
];

test('resumen de la semana igual al del diseño', () => {
  const rango = R.rangoSemana('2026-11-20');
  assert.equal(Resumen.texto({ rango, totales: R.totales(M, rango), productos: PRODUCTOS, insumos: INSUMOS, hoy: '2026-11-20' }),
    'Resumen semana 16–22 nov\nRecaudado: $48.000\nGastado: $23.500\nQuedó: $24.500\n' +
    '• Bidones: +$18.000 (vendido $30.000, gastado $12.000)\n' +
    '• Pizzetas: +$8.500 (vendido $18.000, gastado $9.500)\n' +
    '• Gastos generales: $2.000\n' +
    'Insumos: harina dura ~4 días, huevos ~6 días');
});

test('resumen del mes, pérdida y sin insumos', () => {
  const rango = R.rangoMes('2026-11-20');
  const m = [{ id: 'a', tipo: 'gasto', fecha: '2026-11-03', monto: 500, productoId: 'pizzetas', rubroId: 'harina', nota: '', creado: 1 }];
  assert.equal(Resumen.texto({ rango, totales: R.totales(m, rango), productos: PRODUCTOS, insumos: [], hoy: '2026-11-20' }),
    'Resumen noviembre 2026\nRecaudado: $0\nGastado: $500\nQuedó: −$500\n• Pizzetas: −$500 (vendido $0, gastado $500)');
});
