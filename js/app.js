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

    h.push('<section class="tarjeta">',
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
    return Resumen.texto({ rango: rango, totales: R.totales(d.movimientos, rango), productos: d.productos, insumos: d.insumos, hoy: R.hoy() });
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

  // ---------- Pantallas y eventos ----------

  var PANTALLAS = { inicio: pintarInicio };

  function pintar() {
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
    compartir: compartir
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var accion = ACCIONES[el.getAttribute('data-act')];
    if (accion) accion(el, e);
  });

  // Enter en el monto guarda: es lo que se espera con el teclado numérico abierto.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'monto') guardarForm();
  });

  // Para que las pantallas de "Insumos" y "Más" (y la calculadora) se sumen sin tocar lo de arriba.
  window.App = { estado: estado, PANTALLAS: PANTALLAS, ACCIONES: ACCIONES, pintar: pintar, pintarHoja: pintarHoja,
    cerrarHoja: cerrarHoja, avisar: avisar, leerCampos: leerCampos, htmlForm: htmlForm, diaCorto: diaCorto,
    textoResumen: textoResumen, compartir: compartir };

  var inicio = Store.iniciar(window.localStorage);
  pintar();
  if (inicio.aviso) avisar(inicio.aviso, 8000);
})();
