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
// Configuración de las pruebas: el mismo negocio que el diseño (bidones y pizzetas).
const listo = () => {
  Store.configurar({ negocio: '', productos: ['Bidones', 'Pizzetas'], rubros: ['Harina', 'Huevos', 'Azúcar', 'Levadura', 'Envases', 'Gas', 'Otros'] });
  Store.agregar('insumos', { nombre: 'Harina', presentacion: '1 kg' });
  Store.agregar('insumos', { nombre: 'Huevos', presentacion: 'maple' });
};
const gasto = (extra) => Object.assign({ tipo: 'gasto', fecha: '2026-11-18', monto: 1500, productoId: 'pizzetas', rubroId: 'harina', nota: '' }, extra);

test('arranca sin configurar: solo General, sin rubros ni insumos', () => {
  const r = Store.iniciar(falso());
  assert.equal(r.aviso, null);
  const d = Store.datos();
  assert.equal(d.configurado, false);
  assert.equal(d.negocio, '');
  assert.deepEqual(d.productos.map(p => p.id), ['general']);
  assert.equal(d.productos[0].fijo, true);
  assert.deepEqual(d.rubros, []);
  assert.deepEqual(d.insumos, []);
  assert.deepEqual(d.movimientos, []);
  assert.equal(d.ultimaCopia, null);
});

test('la bienvenida configura negocio, productos y rubros', () => {
  const s = falso(); Store.iniciar(s);
  assert.equal(Store.configurar({ negocio: ' ', productos: ['  ', ''], rubros: ['Harina'] }).ok, false, 'hace falta un producto');
  const r = Store.configurar({ negocio: '  La Esquina ', productos: ['Bidones', ' Pizzetas ', '', 'bidones'], rubros: ['Harina', 'Gas'] });
  assert.equal(r.ok, true);
  Store.iniciar(s);
  const d = Store.datos();
  assert.equal(d.configurado, true);
  assert.equal(d.negocio, 'La Esquina');
  assert.deepEqual(d.productos.map(p => p.nombre), ['Bidones', 'Pizzetas', 'General'], 'sin vacíos ni repetidos, General al final');
  assert.deepEqual(d.rubros.map(p => p.nombre), ['Harina', 'Gas', 'Otros'], 'Otros siempre está');
  assert.equal(Store.configurar({ negocio: 'x', productos: ['y'], rubros: [] }).ok, false, 'solo una vez');
});

test('el nombre del negocio se cambia después', () => {
  Store.iniciar(falso()); listo();
  assert.equal(Store.nombrarNegocio('  Bidones Juan ').ok, true);
  assert.equal(Store.datos().negocio, 'Bidones Juan');
  assert.equal(Store.nombrarNegocio('').ok, true, 'vacío vale: se usa el nombre de la app');
});

test('datos de antes de la bienvenida se toman como ya configurados', () => {
  const viejo = { version: 1, productos: [{ id: 'general', nombre: 'General', fijo: true }, { id: 'bidones', nombre: 'Bidones' }], rubros: [], movimientos: [], insumos: [], ultimaCopia: null };
  Store.iniciar(falso({ 'controlGastos.v1': JSON.stringify(viejo) }));
  assert.equal(Store.datos().configurado, true);
  assert.equal(Store.datos().negocio, '');
});

test('guardar, editar y borrar un gasto persiste', () => {
  const s = falso(); Store.iniciar(s); listo();
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
  Store.iniciar(falso()); listo();
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
  Store.iniciar(falso()); listo();
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
  Store.iniciar(falso()); listo();
  assert.equal(Store.borrar('productos', 'general').ok, false);
  Store.guardarMovimiento(gasto());
  const r = Store.borrar('rubros', 'harina');
  assert.equal(r.ok, false); assert.equal(r.error, 'Tiene movimientos anotados: podés cambiarle el nombre.');
  assert.equal(Store.borrar('productos', 'pizzetas').ok, false);
  assert.equal(Store.renombrar('rubros', 'harina', { nombre: 'Harina 000' }).ok, true);
});

test('doble toque en "Abrí uno nuevo" el mismo día no duplica', () => {
  Store.iniciar(falso()); listo();
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
  assert.deepEqual(Store.datos().productos.map(p => p.id), ['general']);
});

test('copia de seguridad ida y vuelta', () => {
  const s = falso(); Store.iniciar(s); listo();
  Store.guardarMovimiento(gasto());
  const copia = Store.exportarCopia();
  assert.equal(JSON.parse(copia).app, 'control-gastos');
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
  Store.iniciar(falso()); listo();
  Store.guardarMovimiento(gasto());
  for (const t of ['hola', '{"app":"mash-check","version":1,"datos":{}}', '{"app":"control-gastos","version":99,"datos":{}}', '{"app":"control-gastos","version":1}', '{"app":"control-gastos","version":1,"datos":{"productos":[]}}']) {
    const r = Store.restaurarCopia(t);
    assert.equal(r.ok, false, t); assert.equal(typeof r.error, 'string');
    assert.equal(Store.datos().movimientos.length, 1);
  }
});

test('recordatorio de copia a los 30 días', () => {
  Store.iniciar(falso()); listo();
  assert.equal(Store.necesitaCopia('2026-11-20'), false, 'sin movimientos no molesta');
  Store.guardarMovimiento(gasto());
  assert.equal(Store.necesitaCopia('2026-11-20'), true);
  Store.marcarCopia('2026-11-10');
  assert.equal(Store.necesitaCopia('2026-11-20'), false);
  assert.equal(Store.necesitaCopia('2026-12-11'), true);
});

test('si el celular no tiene lugar, avisa y no miente', () => {
  const s = falso(); Store.iniciar(s); listo();
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  const r = Store.guardarMovimiento(gasto());
  assert.equal(r.ok, false); assert.match(r.error, /lugar/);
  assert.equal(Store.datos().movimientos.length, 0);
});

test('una copia sin "ultimaCopia" no rompe el recordatorio', () => {
  Store.iniciar(falso()); listo();
  Store.guardarMovimiento(gasto());
  const d = JSON.parse(Store.exportarCopia()).datos;
  delete d.ultimaCopia;
  assert.equal(Store.restaurarCopia(JSON.stringify({ app: 'control-gastos', version: 1, datos: d })).ok, true);
  assert.equal(Store.necesitaCopia('2026-11-20'), true);
});

test('nombres con solo símbolos o emojis no se fusionan', () => {
  Store.iniciar(falso());
  assert.equal(Store.configurar({ negocio: '', productos: ['🍕', '🥤', '🍕'], rubros: ['¿?', '!!'] }).ok, true);
  assert.deepEqual(Store.datos().productos.map(p => p.nombre), ['🍕', '🥤', 'General']);
  assert.deepEqual(Store.datos().rubros.map(p => p.nombre), ['¿?', '!!', 'Otros']);
  const ids = Store.datos().productos.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('la copia queda marcada recién cuando se guardó de verdad', () => {
  Store.iniciar(falso()); listo();
  Store.guardarMovimiento(gasto());
  Store.exportarCopia();
  assert.equal(Store.datos().ultimaCopia, null, 'armar el archivo no alcanza');
  assert.equal(Store.marcarCopia('2026-11-20').ok, true);
  assert.equal(Store.datos().ultimaCopia, '2026-11-20');
});

test('borrar avisa si no se pudo guardar', () => {
  const s = falso(); Store.iniciar(s); listo();
  const m = Store.guardarMovimiento(gasto()).mov;
  Store.abrirInsumo('harina', '2026-11-20');
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(Store.borrarMovimiento(m.id).ok, false);
  assert.equal(Store.datos().movimientos.length, 1);
  assert.equal(Store.deshacerApertura('harina').ok, false);
  assert.equal(Store.borrarApertura('harina', '2026-11-20').ok, false);
  assert.equal(Store.buscar('insumos', 'harina').aperturas.length, 1);
});

test('si el navegador bloquea el almacenamiento, arranca igual y avisa', () => {
  const bloqueado = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() {} };
  const r = Store.iniciar(bloqueado);
  assert.match(r.aviso, /no deja guardar/);
  assert.equal(Store.datos().configurado, false);
});
