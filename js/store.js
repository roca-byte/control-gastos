/* Capa de datos: todo vive en el celular (localStorage), sin cuentas ni servidor.
 * Clave 'controlGastos.v1'. Cada cambio se guarda en el momento: si se cierra la app o se
 * corta la luz, no se pierde lo anotado.
 * La pantalla (app.js) nunca toca localStorage directo: pasa por acá, así las reglas de qué
 * se puede guardar o borrar están en un solo lugar y se prueban con Node.
 */
var Store = (function () {
  var R = typeof Reglas !== 'undefined' ? Reglas : require('./reglas.js');
  var CLAVE = 'controlGastos.v1';
  var APP = 'control-gastos';
  var VERSION = 1;

  var storage = null;
  var d = null;

  function fabrica() {
    return {
      version: VERSION,
      productos: [
        { id: 'bidones', nombre: 'Bidones' },
        { id: 'pizzetas', nombre: 'Pizzetas' },
        // General: gastos del negocio entero (el gas, por ejemplo). Fijo porque los totales
        // lo necesitan siempre y nunca lleva ventas.
        { id: 'general', nombre: 'General', fijo: true }
      ],
      rubros: ['Harina', 'Huevos', 'Azúcar', 'Levadura', 'Envases', 'Gas', 'Otros'].map(function (n) {
        return { id: idDe(n), nombre: n };
      }),
      movimientos: [],
      insumos: [
        { id: 'harina', nombre: 'Harina', presentacion: '1 kg', aperturas: [] },
        { id: 'huevos', nombre: 'Huevos', presentacion: 'maple', aperturas: [] },
        { id: 'azucar', nombre: 'Azúcar', presentacion: '1 kg', aperturas: [] }
      ],
      ultimaCopia: null
    };
  }

  // "Azúcar" → "azucar": un id legible ayuda a leer una copia de seguridad a mano si hace falta.
  function idDe(nombre) {
    return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  }

  function idUnico(lista, nombre) {
    var base = idDe(nombre), id = base, n = 2;
    while (lista.some(function (x) { return x.id === id; })) id = base + '-' + n++;
    return id;
  }

  function persistir() {
    try { storage.setItem(CLAVE, JSON.stringify(d)); return true; } catch (e) { return false; }
  }

  // Aplica un cambio y lo guarda; si el celular no tiene lugar, lo deshace para que la
  // pantalla no muestre algo que en realidad no quedó guardado.
  function cambiar(fn) {
    var antes = JSON.stringify(d);
    fn();
    if (persistir()) return true;
    d = JSON.parse(antes);
    return false;
  }
  var SIN_LUGAR = 'No se pudo guardar: el celular no tiene lugar libre.';

  function esValida(x) {
    return !!x && typeof x === 'object' &&
      ['productos', 'rubros', 'movimientos', 'insumos'].every(function (k) { return Array.isArray(x[k]); }) &&
      x.productos.some(function (p) { return p.id === 'general'; });
  }

  function iniciar(s) {
    storage = s || window.localStorage;
    var texto = null;
    try { texto = storage.getItem(CLAVE); } catch (e) { texto = null; }
    if (texto === null) { d = fabrica(); persistir(); return { aviso: null }; }
    var leido = null;
    try { leido = JSON.parse(texto); } catch (e) { leido = null; }
    if (esValida(leido)) { d = leido; return { aviso: null }; }
    // Datos rotos: se guarda el texto aparte (por si se puede rescatar a mano) y se arranca
    // de cero en vez de dejar la app trabada.
    try { storage.setItem(CLAVE + '.danado', texto); } catch (e) { /* sin lugar: igual seguimos */ }
    d = fabrica(); persistir();
    return { aviso: 'Los datos guardados estaban dañados y se empezó de cero. Si tenés una copia de seguridad, recuperala desde "Más".' };
  }

  function datos() { return d; }

  function buscar(lista, id) {
    for (var i = 0; i < d[lista].length; i++) if (d[lista][i].id === id) return d[lista][i];
    return null;
  }

  function validar(m) {
    if (m.tipo !== 'gasto' && m.tipo !== 'venta') return 'Elegí si es un gasto o una venta.';
    if (!Number.isInteger(m.monto) || m.monto <= 0) return 'Escribí un monto, por ejemplo 1500.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha || '')) return 'Elegí la fecha.';
    if (!buscar('productos', m.productoId)) return 'Elegí para qué producto es.';
    if (m.tipo === 'venta' && m.productoId === 'general') return 'Las ventas van a un producto, no a General.';
    if (m.tipo === 'gasto' && !buscar('rubros', m.rubroId)) return 'Elegí qué compraste.';
    return null;
  }

  function guardarMovimiento(m) {
    var error = validar(m);
    if (error) return { ok: false, error: error };
    var mov = {
      id: m.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      tipo: m.tipo, fecha: m.fecha, monto: m.monto, productoId: m.productoId, nota: (m.nota || '').trim(),
      creado: m.creado || Date.now()
    };
    if (m.tipo === 'gasto') mov.rubroId = m.rubroId;
    if (m.tipo === 'venta' && m.cantidad) mov.cantidad = m.cantidad;
    var ok = cambiar(function () {
      var i = d.movimientos.findIndex(function (x) { return x.id === mov.id; });
      if (i >= 0) d.movimientos[i] = mov; else d.movimientos.push(mov);
    });
    return ok ? { ok: true, mov: mov } : { ok: false, error: SIN_LUGAR };
  }

  function borrarMovimiento(id) {
    cambiar(function () { d.movimientos = d.movimientos.filter(function (x) { return x.id !== id; }); });
  }

  function agregar(lista, campos) {
    var nombre = (campos.nombre || '').trim();
    if (!nombre) return null;
    var item = { id: idUnico(d[lista], nombre), nombre: nombre };
    if (lista === 'insumos') { item.presentacion = (campos.presentacion || '').trim(); item.aperturas = []; }
    return cambiar(function () { d[lista].push(item); }) ? item : null;
  }

  function renombrar(lista, id, campos) {
    var item = buscar(lista, id), nombre = (campos.nombre || '').trim();
    if (!item) return { ok: false, error: 'No se encontró.' };
    if (item.fijo) return { ok: false, error: 'General no se puede cambiar.' };
    if (!nombre) return { ok: false, error: 'Escribí un nombre.' };
    var ok = cambiar(function () {
      item.nombre = nombre;
      if (lista === 'insumos' && campos.presentacion !== undefined) item.presentacion = campos.presentacion.trim();
    });
    return ok ? { ok: true } : { ok: false, error: SIN_LUGAR };
  }

  function borrar(lista, id) {
    var item = buscar(lista, id);
    if (!item) return { ok: false, error: 'No se encontró.' };
    if (item.fijo) return { ok: false, error: 'General no se puede borrar.' };
    // Borrar un producto o rubro con movimientos dejaría gastos "de nada" y totales que no
    // cierran; renombrar sí se puede.
    var campo = lista === 'productos' ? 'productoId' : lista === 'rubros' ? 'rubroId' : null;
    if (campo && d.movimientos.some(function (m) { return m[campo] === id; })) {
      return { ok: false, error: 'Tiene movimientos anotados: podés cambiarle el nombre.' };
    }
    var ok = cambiar(function () { d[lista] = d[lista].filter(function (x) { return x.id !== id; }); });
    return ok ? { ok: true } : { ok: false, error: SIN_LUGAR };
  }

  // Un toque doble el mismo día guardaría un intervalo de 0 días y bajaría el promedio.
  function abrirInsumo(id, fecha) {
    var ins = buscar('insumos', id), f = fecha || R.hoy();
    if (!ins || ins.aperturas.indexOf(f) >= 0) return false;
    return cambiar(function () { ins.aperturas.push(f); });
  }

  function deshacerApertura(id) {
    var ins = buscar('insumos', id);
    if (!ins || !ins.aperturas.length) return;
    var ultima = ins.aperturas.slice().sort().pop();
    borrarApertura(id, ultima);
  }

  function borrarApertura(id, fecha) {
    var ins = buscar('insumos', id);
    if (!ins) return;
    cambiar(function () { ins.aperturas = ins.aperturas.filter(function (f) { return f !== fecha; }); });
  }

  function exportarCopia(fecha) {
    cambiar(function () { d.ultimaCopia = fecha || R.hoy(); });
    return JSON.stringify({ app: APP, version: VERSION, datos: d }, null, 1);
  }

  function restaurarCopia(texto) {
    var x = null;
    try { x = JSON.parse(texto); } catch (e) { x = null; }
    if (!x || x.app !== APP) return { ok: false, error: 'Ese archivo no es una copia de esta app.' };
    if (x.version !== VERSION) return { ok: false, error: 'La copia es de otra versión de la app y no se puede leer.' };
    if (!esValida(x.datos)) return { ok: false, error: 'La copia está incompleta o dañada.' };
    try { storage.setItem(CLAVE + '.anterior', JSON.stringify(d)); } catch (e) { return { ok: false, error: SIN_LUGAR }; }
    var antes = d;
    d = x.datos;
    if (!persistir()) { d = antes; return { ok: false, error: SIN_LUGAR }; }
    return { ok: true };
  }

  function necesitaCopia(hoyF) {
    if (!d.movimientos.length) return false;
    // !ultimaCopia cubre null y también copias viejas o armadas a mano que no traen el campo.
    return !d.ultimaCopia || R.diasEntre(d.ultimaCopia, hoyF) > 30;
  }

  return {
    iniciar: iniciar, datos: datos, guardarMovimiento: guardarMovimiento, borrarMovimiento: borrarMovimiento,
    agregar: agregar, renombrar: renombrar, borrar: borrar,
    abrirInsumo: abrirInsumo, deshacerApertura: deshacerApertura, borrarApertura: borrarApertura,
    exportarCopia: exportarCopia, restaurarCopia: restaurarCopia, necesitaCopia: necesitaCopia,
    buscar: buscar
  };
})();

if (typeof module !== 'undefined') module.exports = Store;
