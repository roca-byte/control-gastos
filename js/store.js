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

  // Al instalarla no trae productos de nadie: la bienvenida pregunta el nombre del negocio, qué
  // vende y en qué gasta. Así sirve igual para pizzetas que para un amigo que vende otra cosa.
  function fabrica() {
    return {
      version: VERSION,
      configurado: false,
      negocio: '',
      productos: [
        // General: gastos del negocio entero (el gas, por ejemplo). Fijo porque los totales
        // lo necesitan siempre y nunca lleva ventas.
        { id: 'general', nombre: 'General', fijo: true }
      ],
      rubros: [],
      movimientos: [],
      insumos: [],
      ultimaCopia: null
    };
  }

  // Datos guardados antes de que existiera la bienvenida: ya estaban en uso, no se pregunta nada.
  function completar(x) {
    if (x.configurado === undefined) x.configurado = true;
    if (typeof x.negocio !== 'string') x.negocio = '';
    return x;
  }

  // Lista de nombres sin vacíos ni repetidos (sin importar mayúsculas ni tildes).
  function limpiarNombres(nombres) {
    var vistos = {}, salida = [];
    (nombres || []).forEach(function (n) {
      // La comparación es por el nombre (sin mayúsculas ni tildes), no por el id: dos nombres
      // hechos solo de emojis o símbolos darían el mismo id ("item") y uno se perdería.
      var t = String(n || '').trim();
      var clave = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (t && !vistos[clave]) { vistos[clave] = true; salida.push(t); }
    });
    return salida;
  }

  function configurar(o) {
    if (d.configurado) return { ok: false, error: 'Ya está configurada: cambiá lo que necesites en "Más".' };
    var productos = limpiarNombres(o.productos);
    if (!productos.length) return { ok: false, error: 'Escribí al menos un producto que vendas.' };
    var rubros = limpiarNombres(o.rubros);
    // "Otros" siempre está: si no, un gasto raro no tendría dónde ir.
    if (!rubros.some(function (r) { return idDe(r) === 'otros'; })) rubros.push('Otros');
    var ok = cambiar(function () {
      d.negocio = String(o.negocio || '').trim();
      var lista = [];
      productos.forEach(function (n) { lista.push({ id: idUnico(lista.concat([{ id: 'general' }]), n), nombre: n }); });
      d.productos = lista.concat(d.productos.filter(function (p) { return p.id === 'general'; }));
      var rs = [];
      rubros.forEach(function (n) { rs.push({ id: idUnico(rs, n), nombre: n }); });
      d.rubros = rs;
      d.configurado = true;
    });
    return ok ? { ok: true } : { ok: false, error: SIN_LUGAR };
  }

  function nombrarNegocio(nombre) {
    var ok = cambiar(function () { d.negocio = String(nombre || '').trim(); });
    return ok ? { ok: true } : { ok: false, error: SIN_LUGAR };
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

  // Almacenamiento en memoria: si el navegador no deja guardar (incógnito, datos bloqueados) la
  // app igual funciona mientras esté abierta, y se avisa que al cerrarla se pierde todo.
  function memoria() {
    var m = {};
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }
  var BLOQUEADO = 'Este navegador no deja guardar datos (¿modo incógnito?): lo que anotes se pierde al cerrar la app.';

  function iniciar(s) {
    // Leer window.localStorage ya puede tirar error si el navegador bloquea los datos del sitio.
    try { storage = s || window.localStorage; } catch (e) { storage = null; }
    var texto = null, bloqueado = !storage;
    if (storage) { try { texto = storage.getItem(CLAVE); } catch (e) { bloqueado = true; } }
    if (bloqueado) { storage = memoria(); d = fabrica(); persistir(); return { aviso: BLOQUEADO }; }
    if (texto === null) {
      d = fabrica();
      if (persistir()) return { aviso: null };
      storage = memoria(); persistir();
      return { aviso: BLOQUEADO };
    }
    var leido = null;
    try { leido = JSON.parse(texto); } catch (e) { leido = null; }
    if (esValida(leido)) { d = completar(leido); return { aviso: null }; }
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

  function resultado(ok) { return ok ? { ok: true } : { ok: false, error: SIN_LUGAR }; }

  function borrarMovimiento(id) {
    return resultado(cambiar(function () { d.movimientos = d.movimientos.filter(function (x) { return x.id !== id; }); }));
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
    if (!ins || !ins.aperturas.length) return { ok: true };
    var ultima = ins.aperturas.slice().sort().pop();
    return borrarApertura(id, ultima);
  }

  function borrarApertura(id, fecha) {
    var ins = buscar('insumos', id);
    if (!ins) return { ok: true };
    return resultado(cambiar(function () { ins.aperturas = ins.aperturas.filter(function (f) { return f !== fecha; }); }));
  }

  // Armar el archivo no es lo mismo que guardarlo: si se cierra el "compartir" sin elegir nada,
  // no hay copia. Por eso la fecha se marca aparte, cuando la pantalla sabe que se guardó.
  function exportarCopia() {
    return JSON.stringify({ app: APP, version: VERSION, datos: d }, null, 1);
  }

  function marcarCopia(fecha) {
    return resultado(cambiar(function () { d.ultimaCopia = fecha || R.hoy(); }));
  }

  function restaurarCopia(texto) {
    var x = null;
    try { x = JSON.parse(texto); } catch (e) { x = null; }
    if (!x || x.app !== APP) return { ok: false, error: 'Ese archivo no es una copia de esta app.' };
    if (x.version !== VERSION) return { ok: false, error: 'La copia es de otra versión de la app y no se puede leer.' };
    if (!esValida(x.datos)) return { ok: false, error: 'La copia está incompleta o dañada.' };
    try { storage.setItem(CLAVE + '.anterior', JSON.stringify(d)); } catch (e) { return { ok: false, error: SIN_LUGAR }; }
    var antes = d;
    d = completar(x.datos);
    if (!persistir()) { d = antes; return { ok: false, error: SIN_LUGAR }; }
    return { ok: true };
  }

  function necesitaCopia(hoyF) {
    if (!d.movimientos.length) return false;
    // !ultimaCopia cubre null y también copias viejas o armadas a mano que no traen el campo.
    return !d.ultimaCopia || R.diasEntre(d.ultimaCopia, hoyF) > 30;
  }

  return {
    iniciar: iniciar, datos: datos, configurar: configurar, nombrarNegocio: nombrarNegocio, guardarMovimiento: guardarMovimiento, borrarMovimiento: borrarMovimiento,
    agregar: agregar, renombrar: renombrar, borrar: borrar,
    abrirInsumo: abrirInsumo, deshacerApertura: deshacerApertura, borrarApertura: borrarApertura,
    exportarCopia: exportarCopia, marcarCopia: marcarCopia, restaurarCopia: restaurarCopia, necesitaCopia: necesitaCopia,
    buscar: buscar
  };
})();

if (typeof module !== 'undefined') module.exports = Store;
