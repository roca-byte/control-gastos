/* app.js — Pantallas y eventos. No calcula ni guarda nada por su cuenta: los números salen de
 * Reglas y los datos de Store. Todos los botones llevan data-act y un solo listener los atiende
 * (eventos delegados), porque la vista se redibuja entera y los botones cambian todo el tiempo.
 */
(function () {
  var R = Reglas, esc = Reglas.esc;
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  var estado = {
    tab: 'inicio',
    modo: 'semana',      // 'semana' | 'mes'
    ref: R.hoy(),        // una fecha dentro del período que se está mirando
    abiertos: {},        // productos desplegados en Inicio
    form: null           // formulario abierto en la hoja
  };

  var $ = function (sel) { return document.querySelector(sel); };

  // ---------- utilidades de pantalla ----------

  var temporizador = null;
  function avisar(texto, ms) {
    var a = $('#aviso');
    a.textContent = texto;
    a.classList.remove('oculto');
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { a.classList.add('oculto'); }, ms || 2500);
  }

  function diaCorto(f) {
    var p = f.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return DIAS[d.getDay()] + ' ' + (+p[2]) + ' ' + R.MESES_CORTOS[+p[1] - 1];
  }

  function nombreDe(lista, id) {
    var x = Store.buscar(lista, id);
    return x ? x.nombre : '—';
  }

  function rangoActual() {
    return estado.modo === 'semana' ? R.rangoSemana(estado.ref) : R.rangoMes(estado.ref);
  }

  function claseSigno(n) { return n < 0 ? 'negativo' : 'positivo'; }
  function conSigno(n) { return (n >= 0 ? '+' : '') + R.formatoPesos(n); }

  // ---------- Inicio ----------

  function pintarInicio() {
    var d = Store.datos(), rango = rangoActual(), t = R.totales(d.movimientos, rango);
    var esActual = rango.hasta >= R.hoy();
    var h = [];

    if (Store.necesitaCopia(R.hoy())) {
      h.push('<div class="alerta">Hace más de un mes que no guardás una copia de seguridad. ' +
        '<button type="button" class="enlace" data-act="tab" data-tab="mas">Guardala desde "Más"</button></div>');
    }

    h.push('<section class="tarjeta hero">',
      '<div class="modo">',
      '<button type="button" data-act="modo" data-modo="semana" aria-pressed="' + (estado.modo === 'semana') + '">Semana</button>',
      '<button type="button" data-act="modo" data-modo="mes" aria-pressed="' + (estado.modo === 'mes') + '">Mes</button>',
      '</div>',
      '<div class="navega">',
      '<button type="button" data-act="anterior" aria-label="Período anterior">‹</button>',
      '<div><div id="periodo">' + esc(R.etiquetaRango(rango)) + '</div>' +
        '<div class="sub" style="text-align:center">' + (esActual ? (estado.modo === 'semana' ? 'Esta semana' : 'Este mes') : '&nbsp;') + '</div></div>',
      '<button type="button" data-act="siguiente" aria-label="Período siguiente"' + (esActual ? ' disabled' : '') + '>›</button>',
      '</div>',
      '<dl class="cifras">',
      '<dt>Recaudado</dt><dd id="t-recaudado">' + R.formatoPesos(t.recaudado) + '</dd>',
      '<dt>Gastado</dt><dd id="t-gastado">' + R.formatoPesos(t.gastado) + '</dd>',
      '<dt class="quedo">Te quedan</dt><dd class="quedo ' + claseSigno(t.quedo) + '" id="t-quedo">' + R.formatoPesos(t.quedo) + '</dd>',
      '</dl></section>');

    h.push('<section class="tarjeta"><h2>Por producto</h2>');
    var filas = d.productos.filter(function (p) { return t.porProducto[p.id]; });
    if (!filas.length) h.push('<p class="sub">Todavía no anotaste nada en este período.</p>');
    else {
      h.push('<ul class="productos">');
      filas.forEach(function (p) {
        var x = t.porProducto[p.id], abierto = !!estado.abiertos[p.id];
        var cifra = p.id === 'general' ? '<span class="ganancia negativo">' + R.formatoPesos(-x.gastado) + '</span>'
          : '<span class="ganancia ' + claseSigno(x.ganancia) + '">' + conSigno(x.ganancia) + '</span>';
        h.push('<li data-producto="' + esc(p.id) + '">',
          '<button type="button" class="fila-producto" data-act="desplegar" data-id="' + esc(p.id) + '" aria-expanded="' + abierto + '">',
          '<span>' + esc(p.nombre) + (p.id === 'general' ? ' <span class="sub">(gastos del negocio)</span>' : '') + '</span>' + cifra + '</button>');
        if (abierto) {
          h.push('<div class="detalle">');
          if (p.id !== 'general') h.push('<div><span>Vendido' + (x.cantidad ? ' (' + x.cantidad + ' u.)' : '') + '</span><span>' + R.formatoPesos(x.vendido) + '</span></div>');
          Object.keys(x.porRubro).forEach(function (r) {
            h.push('<div><span>' + esc(nombreDe('rubros', r)) + '</span><span>−' + R.formatoPesos(x.porRubro[r]) + '</span></div>');
          });
          h.push('</div>');
        }
        h.push('</li>');
      });
      h.push('</ul>');
    }
    h.push('</section>');

    var serie = estado.modo === 'semana' ? R.serieSemanas(d.movimientos, estado.ref, 8) : R.serieMeses(d.movimientos, estado.ref, 6);
    var etiquetas = serie.map(function (p) {
      var f = p.desde.split('-');
      return estado.modo === 'semana' ? (+f[2]) + ' ' + R.MESES_CORTOS[+f[1] - 1] : R.MESES_CORTOS[+f[1] - 1];
    });
    h.push('<section class="tarjeta"><h2>' + (estado.modo === 'semana' ? 'Últimas semanas' : 'Últimos meses') + '</h2>',
      Grafico.barras(serie, etiquetas),
      '<div class="leyenda"><span class="l-recaudado">Recaudado</span><span class="l-gastado">Gastado</span></div>',
      '<div class="botones"><button type="button" class="boton" data-act="compartir">Compartir resumen</button></div>',
      '</section>');

    var movs = R.movimientosDe(d.movimientos, rango);
    h.push('<section class="tarjeta"><h2>Movimientos</h2>');
    if (!movs.length) h.push('<p class="sub">Tocá <b>+ Gasto</b> o <b>+ Venta</b> para anotar.</p>');
    else {
      h.push('<ul class="movimientos">');
      movs.forEach(function (m) {
        var que = m.tipo === 'venta' ? 'Venta · ' + nombreDe('productos', m.productoId)
          : nombreDe('rubros', m.rubroId) + ' · ' + nombreDe('productos', m.productoId);
        h.push('<li><button type="button" class="movimiento" data-act="editar" data-id="' + esc(m.id) + '">',
          '<span><span class="que">' + esc(que) + '</span>',
          '<span class="nota">' + esc(diaCorto(m.fecha)) + (m.nota ? ' · ' + esc(m.nota) : '') + '</span></span>',
          '<span class="monto ' + (m.tipo === 'venta' ? 'positivo' : 'negativo') + '">' + (m.tipo === 'venta' ? '+' : '−') + R.formatoPesos(m.monto) + '</span>',
          '</button></li>');
      });
      h.push('</ul>');
    }
    h.push('</section>');

    h.push('<div class="anotar">',
      '<button type="button" class="b-gasto" data-act="nuevo" data-tipo="gasto">+ Gasto</button>',
      '<button type="button" class="b-venta" data-act="nuevo" data-tipo="venta">+ Venta</button>',
      '</div>');
    return h.join('');
  }

  // ---------- Formulario de gasto / venta (hoja inferior) ----------

  function abrirForm(tipo, mov) {
    estado.form = mov
      ? { id: mov.id, creado: mov.creado, tipo: mov.tipo, monto: R.formatoPesos(mov.monto).replace('$ ', ''), productoId: mov.productoId,
          rubroId: mov.rubroId || null, fecha: mov.fecha, nota: mov.nota || '', cantidad: mov.cantidad ? String(mov.cantidad) : '', error: '' }
      : { tipo: tipo, monto: '', productoId: null, rubroId: null, fecha: R.hoy(), nota: '', cantidad: '', error: '' };
    pintarHoja();
    var m = $('#monto');
    if (m && !mov) m.focus();
  }

  // Lo que está escrito en los campos se pasa al estado antes de redibujar, si no se perdería.
  function leerCampos() {
    var f = estado.form;
    if (!f || !$('#monto')) return;
    f.monto = $('#monto').value;
    f.fecha = $('#fecha').value || f.fecha;
    f.nota = $('#nota').value;
    if ($('#cantidad')) f.cantidad = $('#cantidad').value;
  }

  function botonesOpcion(campo, lista, elegido) {
    return '<div class="opciones">' + lista.map(function (x) {
      return '<button type="button" data-act="elegir" data-campo="' + campo + '" data-valor="' + esc(x.id) + '" aria-pressed="' + (x.id === elegido) + '">' + esc(x.nombre) + '</button>';
    }).join('') + '</div>';
  }

  function htmlForm() {
    var f = estado.form, d = Store.datos(), esGasto = f.tipo === 'gasto';
    var productos = esGasto ? d.productos : d.productos.filter(function (p) { return p.id !== 'general'; });
    var h = ['<h2>' + (f.id ? 'Editar ' : 'Anotar ') + (esGasto ? 'gasto' : 'venta') + '</h2>',
      '<div class="campo"><label for="monto">' + (esGasto ? '¿Cuánto gastaste?' : '¿Cuánto cobraste?') + '</label>',
      '<div class="fila-monto"><input id="monto" inputmode="decimal" autocomplete="off" placeholder="$ 0" value="' + esc(f.monto) + '">',
      '<button type="button" data-act="calc" aria-label="Abrir calculadora">🧮</button></div></div>',
      '<div class="campo"><span class="etq">¿Para qué producto?</span>' + botonesOpcion('productoId', productos, f.productoId) + '</div>'];
    if (esGasto) h.push('<div class="campo"><span class="etq">¿Qué compraste?</span>' + botonesOpcion('rubroId', d.rubros, f.rubroId) + '</div>');
    h.push('<div class="chicos">',
      '<div class="campo"><label for="fecha">Fecha</label><input id="fecha" type="date" value="' + esc(f.fecha) + '"></div>',
      esGasto ? '<div></div>' : '<div class="campo"><label for="cantidad">Cantidad (opcional)</label><input id="cantidad" inputmode="numeric" value="' + esc(f.cantidad) + '"></div>',
      '</div>',
      '<div class="campo"><label for="nota">Nota (opcional)</label><input id="nota" autocomplete="off" value="' + esc(f.nota) + '"></div>');
    if (f.error) h.push('<p class="error" role="alert">' + esc(f.error) + '</p>');
    h.push('<div class="botones"><button type="button" class="boton" data-act="cerrar">Cancelar</button>',
      '<button type="button" class="boton primario" data-act="guardar">Guardar</button></div>');
    if (f.id) h.push('<div class="botones"><button type="button" class="boton peligro" data-act="borrar-mov">Borrar</button></div>');
    return h.join('');
  }

  function pintarHoja(html) {
    var hoja = $('#hoja');
    hoja.innerHTML = html || htmlForm();
    hoja.classList.remove('oculto');
    $('#fondo-hoja').classList.remove('oculto');
  }

  function cerrarHoja() {
    estado.form = null; estado.calc = null;
    $('#hoja').classList.add('oculto');
    $('#fondo-hoja').classList.add('oculto');
    $('#hoja').innerHTML = '';
  }

  function guardarForm() {
    leerCampos();
    var f = estado.form;
    var monto = R.leerMonto(f.monto);
    if (monto === null) { f.error = 'Escribí un monto, por ejemplo 1500.'; return pintarHoja(); }
    var cant = parseInt(f.cantidad, 10);
    var r = Store.guardarMovimiento({
      id: f.id, creado: f.creado, tipo: f.tipo, fecha: f.fecha, monto: monto, productoId: f.productoId,
      rubroId: f.rubroId, nota: f.nota, cantidad: cant > 0 ? cant : undefined
    });
    if (!r.ok) { f.error = r.error; return pintarHoja(); }
    // Si se anotó algo de otro período, se salta a ese período para que se vea dónde quedó.
    if (f.fecha < rangoActual().desde || f.fecha > rangoActual().hasta) estado.ref = f.fecha;
    cerrarHoja();
    pintar();
    avisar('Guardado');
  }

  // ---------- Compartir ----------

  function textoResumen() {
    var d = Store.datos(), rango = rangoActual();
    return Resumen.texto({ negocio: d.negocio, rango: rango, totales: R.totales(d.movimientos, rango), productos: d.productos, insumos: d.insumos, hoy: R.hoy() });
  }

  function compartir() {
    var t = textoResumen();
    if (navigator.share) {
      navigator.share({ text: t }).catch(function () { /* canceló: no hay nada que avisar */ });
      return;
    }
    // Sin "compartir" (por ejemplo en una compu): se copia y se pega a mano en WhatsApp.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { avisar('Copiado: pegalo en WhatsApp'); },
        function () { avisar('No se pudo copiar'); });
    } else avisar('Este celular no permite compartir desde acá');
  }

  // ---------- Insumos ----------

  var ultimoAbierto = null; // para mostrar "Deshacer" solo un rato después de tocar

  function pintarInsumos() {
    var d = Store.datos(), hoyF = R.hoy();
    var h = ['<p class="sub">Cada vez que abras un paquete nuevo (de harina, un maple de huevos…) tocá <b>Abrí uno nuevo</b>. ',
      'Con dos o más, la app calcula cuánto te dura.</p>'];
    if (!d.insumos.length) h.push('<p class="sub">No hay insumos. Agregá uno abajo.</p>');
    d.insumos.forEach(function (ins) {
      var dur = R.duracionInsumo(ins.aperturas, hoyF);
      var titulo = esc(ins.nombre) + (ins.presentacion ? ' <span class="sub">(' + esc(ins.presentacion) + ')</span>' : '');
      h.push('<section class="tarjeta insumo" data-insumo="' + esc(ins.id) + '"><h3>' + titulo + '</h3>');
      if (dur) {
        h.push('<p class="dura">Te dura unos <b>' + dur.dias + (dur.dias === 1 ? ' día' : ' días') + '</b> · Abriste el actual el ' + esc(diaCorto(dur.abierto)) + '</p>');
        h.push(dur.atrasado ? '<p class="atrasado">Ya debería estar por terminarse</p>'
          : '<p class="sub">Se terminaría el ' + esc(diaCorto(dur.terminaria)) + '</p>');
      } else if (ins.aperturas.length === 1) {
        h.push('<p class="sub">Abriste el actual el ' + esc(diaCorto(ins.aperturas[0])) + '. Todavía no hay datos: tocá cuando abras el próximo.</p>');
      } else {
        h.push('<p class="sub">Todavía no hay datos: tocá cuando abras el próximo.</p>');
      }
      h.push('<div class="botones"><button type="button" class="boton primario" data-act="abrir-insumo" data-id="' + esc(ins.id) + '">Abrí uno nuevo</button></div>');
      if (ultimoAbierto && ultimoAbierto.id === ins.id && Date.now() - ultimoAbierto.cuando < 10000) {
        h.push('<div class="botones"><button type="button" class="boton" data-act="deshacer-apertura" data-id="' + esc(ins.id) + '">Deshacer (lo toqué sin querer)</button></div>');
      }
      if (ins.aperturas.length) {
        var lista = ins.aperturas.slice().sort().reverse().slice(0, 8);
        h.push('<details class="historial"><summary>Historial</summary><ul>' + lista.map(function (f) {
          return '<li><span>' + esc(diaCorto(f)) + '</span><button type="button" data-act="borrar-apertura" data-id="' + esc(ins.id) + '" data-fecha="' + esc(f) + '">Borrar</button></li>';
        }).join('') + '</ul></details>');
      }
      h.push('<div class="botones"><button type="button" class="enlace" data-act="renombrar-item" data-lista="insumos" data-id="' + esc(ins.id) + '">Cambiar nombre</button>',
        '<button type="button" class="enlace" data-act="borrar-item" data-lista="insumos" data-id="' + esc(ins.id) + '">Borrar insumo</button></div>');
      h.push('</section>');
    });
    h.push('<div class="botones"><button type="button" class="boton" data-act="nuevo-insumo">+ Agregar insumo</button></div>');
    return h.join('');
  }

  // ---------- Más ----------

  var versionApp = 'Control de Gastos';
  // La versión sale del nombre de la caché del service worker (control-gastos-vN): así se ve
  // si el celular ya bajó la última actualización.
  if (window.caches && caches.keys) {
    caches.keys().then(function (ks) {
      var k = ks.filter(function (x) { return /^control-gastos-v\d+$/.test(x); }).sort().pop();
      if (k) { versionApp = 'Control de Gastos · versión ' + k.split('-v')[1]; if (estado.tab === 'mas') pintar(); }
    }).catch(function () {});
  }

  function listaEditable(titulo, lista, items) {
    return '<section class="tarjeta"><h2>' + titulo + '</h2><ul class="lista-edit">' + items.map(function (x) {
      var acciones = x.fijo ? '<span class="sub">fijo</span>'
        : '<button type="button" data-act="renombrar-item" data-lista="' + lista + '" data-id="' + esc(x.id) + '" aria-label="Cambiar nombre de ' + esc(x.nombre) + '">✎</button>' +
          '<button type="button" data-act="borrar-item" data-lista="' + lista + '" data-id="' + esc(x.id) + '" aria-label="Borrar ' + esc(x.nombre) + '">🗑</button>';
      return '<li><span>' + esc(x.nombre) + '</span>' + acciones + '</li>';
    }).join('') + '</ul><button type="button" class="boton" data-act="agregar-item" data-lista="' + lista + '">+ Agregar</button></section>';
  }

  function pintarMas() {
    var d = Store.datos();
    return [
      '<section class="tarjeta"><h2>Tu emprendimiento</h2>',
      '<p>' + (d.negocio ? esc(d.negocio) : '<span class="sub">Sin nombre</span>') + '</p>',
      '<button type="button" class="boton" data-act="nombrar-negocio">Cambiar el nombre</button></section>',
      '<section class="tarjeta"><h2>Herramientas</h2><div class="botones">',
      '<button type="button" class="boton" data-act="calc">🧮 Calculadora</button>',
      '<button type="button" class="boton" data-act="compartir">Compartir resumen</button></div>',
      '<p class="sub">El resumen es de la semana o el mes que estás mirando en Inicio.</p></section>',
      listaEditable('Productos', 'productos', d.productos),
      listaEditable('¿En qué se gasta?', 'rubros', d.rubros),
      '<section class="tarjeta"><h2>Copia de seguridad</h2>',
      '<p class="sub">Todo lo anotado vive en este celular. Guardá una copia de vez en cuando (por ejemplo, mandátela por WhatsApp) ',
      'para no perderlo si se rompe o se cambia el teléfono.</p>',
      '<p class="sub">Última copia: ' + (d.ultimaCopia ? esc(diaCorto(d.ultimaCopia)) : 'nunca') + '</p>',
      '<div class="botones"><button type="button" class="boton primario" data-act="guardar-copia">Guardar copia</button>',
      '<button type="button" class="boton" data-act="recuperar-copia">Recuperar copia</button></div>',
      '<input type="file" id="archivo-copia" accept=".json,application/json" class="oculto">',
      '</section>',
      '<p class="version">' + esc(versionApp) + '</p>'
    ].join('');
  }

  function guardarCopia() {
    var texto = Store.exportarCopia(), nombre = 'control-gastos-' + R.hoy() + '.json';
    var archivo = null;
    try { archivo = new File([texto], nombre, { type: 'application/json' }); } catch (e) { archivo = null; }
    // En el celular se ofrece compartir el archivo (WhatsApp, Drive, mail…); si no, se descarga.
    if (archivo && navigator.canShare && navigator.share && navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: 'Copia de Control de Gastos' }).catch(function () {});
    } else {
      var url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    pintar();
    avisar('Copia guardada');
  }

  function recuperarCopia(input) {
    var archivo = input.files && input.files[0];
    input.value = ''; // para poder elegir el mismo archivo otra vez
    if (!archivo) return;
    if (!confirm('Esto reemplaza todo lo que hay ahora. ¿Seguís?')) return;
    var lector = new FileReader();
    lector.onload = function () {
      var r = Store.restaurarCopia(String(lector.result));
      if (!r.ok) return avisar(r.error, 5000);
      pintar();
      avisar('Copia recuperada');
    };
    lector.onerror = function () { avisar('No se pudo leer el archivo', 5000); };
    lector.readAsText(archivo);
  }

  // ---------- Calculadora (en la hoja) ----------

  function abrirCalc() {
    // Desde un formulario se guarda lo escrito para volver con todo igual.
    leerCampos();
    estado.calc = { e: Calculadora.nueva(), desdeForm: !!estado.form };
    pintarCalc();
  }

  function pintarCalc() {
    var c = estado.calc;
    var teclas = ['C', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '0', ','];
    var h = ['<h2>Calculadora</h2><div class="calc-pantalla" aria-live="polite">' + esc(Calculadora.pantalla(c.e)) + '</div><div class="calc-teclas">'];
    teclas.forEach(function (t) {
      var clase = '+−×÷'.indexOf(t) >= 0 ? 'op' : t === '=' ? 'igual' : '';
      var span = t === '0' ? ' style="grid-column: span 3"' : '';
      h.push('<button type="button" class="' + clase + '" data-act="tecla" data-tecla="' + t + '"' + span + '>' + t + '</button>');
    });
    h.push('</div>');
    if (c.desdeForm) {
      h.push('<div class="botones"><button type="button" class="boton" data-act="volver-form">Volver</button>',
        '<button type="button" class="boton primario" data-act="usar-calc">Usar este número</button></div>');
    } else {
      h.push('<div class="botones"><button type="button" class="boton" data-act="cerrar">Cerrar</button></div>');
    }
    pintarHoja(h.join(''));
  }

  function pedirNombre(texto, actual) {
    var n = prompt(texto, actual || '');
    return n === null ? null : n.trim();
  }

  // ---------- Bienvenida (primera vez) ----------

  // Sugerencias para tocar en vez de escribir. Son ideas, no obligaciones: se puede escribir otra.
  var RUBROS_SUGERIDOS = ['Harina', 'Huevos', 'Azúcar', 'Levadura', 'Materia prima', 'Envases', 'Gas', 'Nafta', 'Alquiler'];

  var bien = { paso: 1, negocio: '', productos: [''], rubros: [], error: '' };

  // Lo escrito se pasa al estado antes de redibujar o cambiar de paso, si no se perdería.
  function leerBienvenida() {
    if ($('#negocio')) bien.negocio = $('#negocio').value;
    var campos = document.querySelectorAll('.producto-nombre');
    if (campos.length) bien.productos = Array.prototype.map.call(campos, function (c) { return c.value; });
  }

  function pintarBienvenida() {
    var h = ['<section class="tarjeta bien"><p class="sub">Paso ' + bien.paso + ' de 3</p>'];
    if (bien.paso === 1) {
      h.push('<h2>¡Hola! ¿Cómo se llama tu emprendimiento?</h2>',
        '<div class="campo"><label for="negocio">Nombre (opcional)</label>',
        '<input id="negocio" autocomplete="off" placeholder="Por ejemplo: La Esquina" value="' + esc(bien.negocio) + '"></div>',
        '<p class="sub">Sale arriba en la app y en el resumen que mandás por WhatsApp.</p>');
    } else if (bien.paso === 2) {
      h.push('<h2>¿Qué vendés?</h2><p class="sub">Escribí cada producto. La app te va a decir cuánto te deja cada uno.</p>');
      bien.productos.forEach(function (p, i) {
        h.push('<div class="campo fila-producto-bien"><input class="producto-nombre" autocomplete="off" aria-label="Producto ' + (i + 1) + '"' +
          ' placeholder="' + (i === 0 ? 'Por ejemplo: Pizzetas' : 'Otro producto') + '" value="' + esc(p) + '">' +
          (bien.productos.length > 1 ? '<button type="button" data-act="bien-quitar-producto" data-i="' + i + '" aria-label="Quitar">✕</button>' : '') + '</div>');
      });
      h.push('<button type="button" class="boton" data-act="bien-otro-producto">+ Otro producto</button>');
    } else {
      var todos = RUBROS_SUGERIDOS.concat(bien.rubros.filter(function (r) { return RUBROS_SUGERIDOS.indexOf(r) < 0; }));
      h.push('<h2>¿En qué gastás?</h2><p class="sub">Tocá los que uses. "Otros" ya viene incluido. Los gastos de todo el negocio van en "General".</p>',
        '<div class="opciones">' + todos.map(function (r) {
          return '<button type="button" data-act="bien-rubro" data-nombre="' + esc(r) + '" aria-pressed="' + (bien.rubros.indexOf(r) >= 0) + '">' + esc(r) + '</button>';
        }).join('') + '</div>',
        '<div class="campo" style="margin-top:14px"><label for="rubro-otro">¿Otro?</label>',
        '<div class="fila-monto"><input id="rubro-otro" autocomplete="off" placeholder="Por ejemplo: Fletes">',
        '<button type="button" data-act="bien-agregar-rubro" aria-label="Agregar">+</button></div></div>');
    }
    if (bien.error) h.push('<p class="error" role="alert">' + esc(bien.error) + '</p>');
    h.push('<div class="botones">');
    if (bien.paso > 1) h.push('<button type="button" class="boton" data-act="bien-atras">Atrás</button>');
    h.push(bien.paso < 3 ? '<button type="button" class="boton primario" data-act="bien-siguiente">Siguiente</button>'
      : '<button type="button" class="boton primario" data-act="bien-empezar">Empezar</button>');
    h.push('</div><p class="sub">Todo se puede cambiar después en "Más".</p></section>');
    return h.join('');
  }

  // ---------- Pantallas y eventos ----------

  var PANTALLAS = { inicio: pintarInicio, insumos: pintarInsumos, mas: pintarMas };

  function pintar() {
    var d = Store.datos(), nombre = d.negocio || 'Control de Gastos';
    $('.barra h1').textContent = nombre;
    document.title = nombre;
    // Hasta completar la bienvenida no hay pestañas ni botones de anotar: no hay productos todavía.
    document.body.classList.toggle('bienvenida', !d.configurado);
    if (!d.configurado) { $('#vista').innerHTML = pintarBienvenida(); return; }
    var pantalla = PANTALLAS[estado.tab] || pintarInicio;
    $('#vista').innerHTML = pantalla();
    document.querySelectorAll('.pestanas button').forEach(function (b) {
      if (b.getAttribute('data-tab') === estado.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function mover(paso) {
    var r = rangoActual();
    estado.ref = paso < 0 ? R.sumarDias(r.desde, -1) : R.sumarDias(r.hasta, 1);
    pintar();
  }

  var ACCIONES = {
    tab: function (el) { estado.tab = el.getAttribute('data-tab'); pintar(); window.scrollTo(0, 0); },
    modo: function (el) { estado.modo = el.getAttribute('data-modo'); estado.ref = R.hoy(); pintar(); },
    anterior: function () { mover(-1); },
    siguiente: function () { mover(1); },
    desplegar: function (el) { var id = el.getAttribute('data-id'); estado.abiertos[id] = !estado.abiertos[id]; pintar(); },
    nuevo: function (el) { abrirForm(el.getAttribute('data-tipo')); },
    editar: function (el) {
      var id = el.getAttribute('data-id');
      var m = Store.datos().movimientos.filter(function (x) { return x.id === id; })[0];
      if (m) abrirForm(m.tipo, m);
    },
    elegir: function (el) {
      leerCampos();
      estado.form[el.getAttribute('data-campo')] = el.getAttribute('data-valor');
      estado.form.error = '';
      pintarHoja();
    },
    guardar: guardarForm,
    'borrar-mov': function () {
      if (!confirm('¿Borrar este movimiento? No se puede deshacer.')) return;
      Store.borrarMovimiento(estado.form.id);
      cerrarHoja(); pintar(); avisar('Borrado');
    },
    cerrar: cerrarHoja,
    compartir: compartir,

    'abrir-insumo': function (el) {
      var id = el.getAttribute('data-id');
      if (!Store.abrirInsumo(id, R.hoy())) return avisar('Ya lo marcaste hoy');
      ultimoAbierto = { id: id, cuando: Date.now() };
      pintar();
      avisar('Anotado');
      // Pasados los 10 s se redibuja para que desaparezca "Deshacer".
      setTimeout(function () { if (estado.tab === 'insumos' && !estado.form && !estado.calc) pintar(); }, 10500);
    },
    'deshacer-apertura': function (el) { Store.deshacerApertura(el.getAttribute('data-id')); ultimoAbierto = null; pintar(); avisar('Deshecho'); },
    'borrar-apertura': function (el) {
      if (!confirm('¿Borrar esa fecha del historial?')) return;
      Store.borrarApertura(el.getAttribute('data-id'), el.getAttribute('data-fecha')); pintar();
    },
    'nuevo-insumo': function () {
      var nombre = pedirNombre('¿Cómo se llama el insumo? (por ejemplo: Levadura)');
      if (!nombre) return;
      var pres = pedirNombre('¿Cómo viene? (por ejemplo: 1 kg, sobre, maple). Podés dejarlo vacío.') || '';
      if (Store.agregar('insumos', { nombre: nombre, presentacion: pres })) pintar(); else avisar('No se pudo agregar');
    },

    'agregar-item': function (el) {
      var lista = el.getAttribute('data-lista');
      var nombre = pedirNombre(lista === 'productos' ? '¿Qué producto querés agregar?' : '¿Qué tipo de gasto querés agregar?');
      if (!nombre) return;
      if (Store.agregar(lista, { nombre: nombre })) { pintar(); avisar('Agregado'); } else avisar('No se pudo agregar');
    },
    'renombrar-item': function (el) {
      var lista = el.getAttribute('data-lista'), item = Store.buscar(lista, el.getAttribute('data-id'));
      if (!item) return;
      var nombre = pedirNombre('Nuevo nombre:', item.nombre);
      if (nombre === null) return;
      var campos = { nombre: nombre };
      if (lista === 'insumos') {
        var pres = pedirNombre('¿Cómo viene?', item.presentacion);
        if (pres !== null) campos.presentacion = pres;
      }
      var r = Store.renombrar(lista, item.id, campos);
      if (!r.ok) return avisar(r.error, 4000);
      pintar();
    },
    'borrar-item': function (el) {
      var lista = el.getAttribute('data-lista'), item = Store.buscar(lista, el.getAttribute('data-id'));
      if (!item || !confirm('¿Borrar "' + item.nombre + '"?')) return;
      var r = Store.borrar(lista, item.id);
      if (!r.ok) return avisar(r.error, 4000);
      pintar(); avisar('Borrado');
    },

    'nombrar-negocio': function () {
      var n = pedirNombre('¿Cómo se llama tu emprendimiento? (podés dejarlo vacío)', Store.datos().negocio);
      if (n === null) return;
      var r = Store.nombrarNegocio(n);
      if (!r.ok) return avisar(r.error, 4000);
      pintar();
    },

    'bien-siguiente': function () {
      leerBienvenida();
      if (bien.paso === 2 && !bien.productos.some(function (p) { return p.trim(); })) {
        bien.error = 'Escribí al menos un producto que vendas.';
      } else { bien.error = ''; bien.paso++; }
      pintar();
    },
    'bien-atras': function () { leerBienvenida(); bien.error = ''; bien.paso--; pintar(); },
    'bien-otro-producto': function () {
      leerBienvenida(); bien.productos.push(''); pintar();
      var c = document.querySelectorAll('.producto-nombre'); c[c.length - 1].focus();
    },
    'bien-quitar-producto': function (el) { leerBienvenida(); bien.productos.splice(+el.getAttribute('data-i'), 1); pintar(); },
    'bien-rubro': function (el) {
      var n = el.getAttribute('data-nombre'), i = bien.rubros.indexOf(n);
      if (i >= 0) bien.rubros.splice(i, 1); else bien.rubros.push(n);
      pintar();
    },
    'bien-agregar-rubro': function () {
      var n = $('#rubro-otro').value.trim();
      if (n && bien.rubros.indexOf(n) < 0) bien.rubros.push(n);
      pintar();
    },
    'bien-empezar': function () {
      // Los rubros se guardan en el orden de la pantalla, no en el orden en que se tocaron.
      var orden = RUBROS_SUGERIDOS.concat(bien.rubros);
      var rubros = orden.filter(function (r, i) { return bien.rubros.indexOf(r) >= 0 && orden.indexOf(r) === i; });
      var r = Store.configurar({ negocio: bien.negocio, productos: bien.productos, rubros: rubros });
      if (!r.ok) { bien.error = r.error; return pintar(); }
      estado.tab = 'inicio';
      pintar();
      avisar('¡Listo! Ya podés anotar');
    },

    'guardar-copia': guardarCopia,
    'recuperar-copia': function () { $('#archivo-copia').click(); },

    calc: abrirCalc,
    tecla: function (el) { estado.calc.e = Calculadora.tecla(estado.calc.e, el.getAttribute('data-tecla')); pintarCalc(); },
    'volver-form': function () { estado.calc = null; pintarHoja(); },
    'usar-calc': function () {
      var v = Calculadora.valor(estado.calc.e);
      estado.calc = null;
      if (v !== null && v > 0) estado.form.monto = String(Math.round(v));
      pintarHoja();
    }
  };

  document.addEventListener('change', function (e) {
    if (e.target.id === 'archivo-copia') recuperarCopia(e.target);
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var accion = ACCIONES[el.getAttribute('data-act')];
    if (accion) accion(el, e);
  });

  // Enter en el monto guarda: es lo que se espera con el teclado numérico abierto.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'monto') guardarForm();
    if (e.key === 'Enter' && e.target.id === 'rubro-otro') ACCIONES['bien-agregar-rubro']();
  });

  // Para que las pantallas de "Insumos" y "Más" (y la calculadora) se sumen sin tocar lo de arriba.
  window.App = { estado: estado, PANTALLAS: PANTALLAS, ACCIONES: ACCIONES, pintar: pintar, pintarHoja: pintarHoja,
    cerrarHoja: cerrarHoja, avisar: avisar, leerCampos: leerCampos, htmlForm: htmlForm, diaCorto: diaCorto,
    textoResumen: textoResumen, compartir: compartir };

  var inicio = Store.iniciar(window.localStorage);
  pintar();
  if (inicio.aviso) avisar(inicio.aviso, 8000);

  // Service worker: guarda la app en el celular para que abra sin señal. Con file:// no existe.
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }
})();
