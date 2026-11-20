// Pruebas de la capa de datos (js/store.js) con un almacenamiento falso en memoria.
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../js/store.js');

function falso(inicial) {
  const m = Object.assign({}, inicial);
  return {
    m,
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
  };
}
const gasto = (extra) => Object.assign({ tipo: 'gasto', fecha: '2026-11-18', monto: 1500, productoId: 'pizzetas', rubroId: 'harina', nota: '' }, extra);

test('arranca con datos de fábrica', () => {
  const r = Store.iniciar(falso());
  assert.equal(r.aviso, null);
  const d = Store.datos();
  assert.deepEqual(d.productos.map(p => p.id), ['bidones', 'pizzetas', 'general']);
  assert.equal(d.productos[2].fijo, true);
  assert.deepEqual(d.rubros.map(p => p.nombre), ['Harina', 'Huevos', 'Azúcar', 'Levadura', 'Envases', 'Gas', 'Otros']);
  assert.deepEqual(d.insumos.map(i => i.nombre + ' (' + i.presentacion + ')'), ['Harina (1 kg)', 'Huevos (maple)', 'Azúcar (1 kg)']);
  assert.deepEqual(d.movimientos, []);
  assert.equal(d.ultimaCopia, null);
});

test('guardar, editar y borrar un gasto persiste', () => {
  const s = falso(); Store.iniciar(s);
  const r = Store.guardarMovimiento(gasto());
  assert.equal(r.ok, true); assert.ok(r.mov.id); assert.ok(r.mov.creado);
  const r2 = Store.guardarMovimiento(Object.assign({}, r.mov, { monto: 2000 }));
  assert.equal(r2.ok, true);
  Store.iniciar(s);
  assert.equal(Store.datos().movimientos.length, 1);
  assert.equal(Store.datos().movimientos[0].monto, 2000);
  Store.borrarMovimiento(r.mov.id);
  Store.iniciar(s);
  assert.equal(Store.datos().movimientos.length, 0);
});

test('validaciones', () => {
  Store.iniciar(falso());
  assert.equal(Store.guardarMovimiento(gasto({ monto: 0 })).ok, false);
  assert.equal(Store.guardarMovimiento(gasto({ monto: 10.5 })).ok, false);
  assert.equal(Store.guardarMovimiento({ tipo: 'venta', fecha: '2026-11-18', monto: 100, productoId: 'general', nota: '' }).ok, false);
  assert.equal(Store.guardarMovimiento(gasto({ rubroId: undefined })).ok, false);
  assert.equal(Store.guardarMovimiento(gasto({ productoId: 'x' })).ok, false);
  assert.equal(Store.guardarMovimiento(gasto({ tipo: 'otro' })).ok, false);
  assert.equal(Store.guardarMovimiento(gasto({ fecha: '18/11' })).ok, false);
  const e = Store.guardarMovimiento(gasto({ monto: 0 }));
  assert.equal(typeof e.error, 'string');
  assert.equal(Store.datos().movimientos.length, 0);
});

test('agregar, renombrar y borrar en las listas', () => {
  Store.iniciar(falso());
  const emp = Store.agregar('productos', { nombre: '  Empanadas ' });
  assert.equal(emp.nombre, 'Empanadas');
  assert.equal(Store.agregar('rubros', { nombre: 'Harina' }).id !== 'harina', true, 'id repetido lleva sufijo');
  assert.equal(Store.agregar('rubros', { nombre: '   ' }), null);
  const ins = Store.agregar('insumos', { nombre: 'Levadura', presentacion: 'sobre' });
  assert.deepEqual(ins.aperturas, []);
  assert.equal(Store.renombrar('productos', emp.id, { nombre: 'Empanadas fritas' }).ok, true);
  assert.equal(Store.renombrar('productos', 'general', { nombre: 'Otro' }).ok, false);
  assert.equal(Store.borrar('productos', emp.id).ok, true);
});

test('no se borra General ni lo que tiene movimientos', () => {
  Store.iniciar(falso());
  assert.equal(Store.borrar('productos', 'general').ok, false);
  Store.guardarMovimiento(gasto());
  const r = Store.borrar('rubros', 'harina');
  assert.equal(r.ok, false); assert.equal(r.error, 'Tiene movimientos anotados: podés cambiarle el nombre.');
  assert.equal(Store.borrar('productos', 'pizzetas').ok, false);
  assert.equal(Store.renombrar('rubros', 'harina', { nombre: 'Harina 000' }).ok, true);
});

test('doble toque en "Abrí uno nuevo" el mismo día no duplica', () => {
  Store.iniciar(falso());
  const id = Store.datos().insumos[0].id;
  assert.equal(Store.abrirInsumo(id, '2026-11-20'), true);
  assert.equal(Store.abrirInsumo(id, '2026-11-20'), false);
  assert.equal(Store.datos().insumos[0].aperturas.length, 1);
  Store.abrirInsumo(id, '2026-11-12'); Store.abrirInsumo(id, '2026-11-16');
  Store.deshacerApertura(id);
  assert.deepEqual(Store.datos().insumos[0].aperturas.slice().sort(), ['2026-11-12', '2026-11-16'], 'deshacer quita la más reciente');
  Store.borrarApertura(id, '2026-11-12');
  assert.deepEqual(Store.datos().insumos[0].aperturas, ['2026-11-16']);
});

test('datos rotos: arranca vacío, guarda lo roto y avisa', () => {
  const s = falso({ 'controlGastos.v1': '{roto' });
  const r = Store.iniciar(s);
  assert.equal(typeof r.aviso, 'string'); assert.ok(r.aviso.length > 0);
  assert.equal(s.getItem('controlGastos.v1.danado'), '{roto');
  assert.equal(Store.datos().productos.length, 3);
});

test('copia de seguridad ida y vuelta', () => {
  const s = falso(); Store.iniciar(s);
  Store.guardarMovimiento(gasto());
  const copia = Store.exportarCopia('2026-11-20');
  assert.equal(JSON.parse(copia).app, 'control-gastos');
  assert.equal(Store.datos().ultimaCopia, '2026-11-20');
  Store.iniciar(falso());
  assert.equal(Store.datos().movimientos.length, 0);
  Store.iniciar(s);
  Store.borrarMovimiento(Store.datos().movimientos[0].id);
  const r = Store.restaurarCopia(copia);
  assert.equal(r.ok, true);
  assert.equal(Store.datos().movimientos.length, 1);
  assert.equal(JSON.parse(s.getItem('controlGastos.v1.anterior')).movimientos.length, 0);
});

test('archivo equivocado se rechaza y no toca nada', () => {
  Store.iniciar(falso());
  Store.guardarMovimiento(gasto());
  for (const t of ['hola', '{"app":"mash-check","version":1,"datos":{}}', '{"app":"control-gastos","version":99,"datos":{}}', '{"app":"control-gastos","version":1}', '{"app":"control-gastos","version":1,"datos":{"productos":[]}}']) {
    const r = Store.restaurarCopia(t);
    assert.equal(r.ok, false, t); assert.equal(typeof r.error, 'string');
    assert.equal(Store.datos().movimientos.length, 1);
  }
});

test('recordatorio de copia a los 30 días', () => {
  Store.iniciar(falso());
  assert.equal(Store.necesitaCopia('2026-11-20'), false, 'sin movimientos no molesta');
  Store.guardarMovimiento(gasto());
  assert.equal(Store.necesitaCopia('2026-11-20'), true);
  Store.exportarCopia('2026-11-10');
  assert.equal(Store.necesitaCopia('2026-11-20'), false);
  assert.equal(Store.necesitaCopia('2026-12-11'), true);
});

test('si el celular no tiene lugar, avisa y no miente', () => {
  const s = falso(); Store.iniciar(s);
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  const r = Store.guardarMovimiento(gasto());
  assert.equal(r.ok, false); assert.match(r.error, /lugar/);
  assert.equal(Store.datos().movimientos.length, 0);
});

test('una copia sin "ultimaCopia" no rompe el recordatorio', () => {
  Store.iniciar(falso());
  Store.guardarMovimiento(gasto());
  const d = JSON.parse(Store.exportarCopia('2026-11-20')).datos;
  delete d.ultimaCopia;
  assert.equal(Store.restaurarCopia(JSON.stringify({ app: 'control-gastos', version: 1, datos: d })).ok, true);
  assert.equal(Store.necesitaCopia('2026-11-20'), true);
});
