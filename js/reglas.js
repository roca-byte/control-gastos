/* Reglas puras de la app: fechas, períodos, plata, totales e insumos.
 * No tocan la pantalla ni el almacenamiento, así se prueban con Node (tests/reglas.test.js).
 * Las fechas viajan siempre como texto 'AAAA-MM-DD' en hora LOCAL: ese texto se ordena bien
 * comparándolo como string y no se corre de día como pasa con toISOString() (que usa UTC y,
 * a la noche en Argentina, ya da el día siguiente).
 */
var Reglas = (function () {
  var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  function fechaLocal(d) {
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }

  function hoy() { return fechaLocal(new Date()); }

  // Las cuentas de días se hacen en UTC a propósito: un día UTC siempre dura 24 h, así un
  // cambio de horario no hace que una semana "mida" 6,96 días.
  function aUTC(f) {
    var p = f.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function deUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate());
  }
  var DIA = 86400000;

  function sumarDias(f, n) { return deUTC(aUTC(f) + n * DIA); }

  function diasEntre(a, b) { return Math.round((aUTC(b) - aUTC(a)) / DIA); }

  function rangoSemana(f) {
    // getUTCDay: 0 = domingo. La semana del negocio arranca el lunes.
    var dia = new Date(aUTC(f)).getUTCDay();
    var desde = sumarDias(f, dia === 0 ? -6 : 1 - dia);
    return { desde: desde, hasta: sumarDias(desde, 6) };
  }

  function rangoMes(f) {
    var p = f.split('-');
    var desde = p[0] + '-' + p[1] + '-01';
    // El último día del mes es el día anterior al 1 del mes siguiente.
    var siguiente = deUTC(Date.UTC(+p[0], +p[1], 1));
    return { desde: desde, hasta: sumarDias(siguiente, -1) };
  }

  function partes(f) { var p = f.split('-'); return { a: +p[0], m: +p[1] - 1, d: +p[2] }; }

  function etiquetaRango(r) {
    var d = partes(r.desde), h = partes(r.hasta);
    if (d.d === 1 && r.hasta === rangoMes(r.desde).hasta) return MESES[d.m] + ' ' + d.a;
    if (d.m === h.m) return d.d + '–' + h.d + ' ' + MESES_CORTOS[h.m];
    return d.d + ' ' + MESES_CORTOS[d.m] + ' – ' + h.d + ' ' + MESES_CORTOS[h.m];
  }

  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  function formatoPesos(n) {
    var r = Math.round(n);
    return (r < 0 ? '−' : '') + '$ ' + miles(Math.abs(r));
  }

  // Acepta el monto como lo escribe una persona: "48.000", "$ 300", "1.500,50".
  // En Argentina el punto separa miles y la coma los decimales; se guarda en pesos enteros.
  function leerMonto(texto) {
    var t = String(texto == null ? '' : texto).replace(/\$/g, '').replace(/\s+/g, '');
    if (!/^\d[\d.]*(,\d*)?$/.test(t)) return null;
    var n = Math.round(parseFloat(t.replace(/\./g, '').replace(',', '.')));
    return n > 0 ? n : null;
  }

  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function enRango(m, r) { return m.fecha >= r.desde && m.fecha <= r.hasta; }

  // Ganancia de un producto = lo vendido menos lo gastado EN ESE producto. "General" (el gas,
  // por ejemplo) entra igual que cualquier otro en el total del negocio, pero no se reparte:
  // repartirlo a ojo daría una ganancia por producto que no es real.
  function totales(movs, r) {
    var t = { recaudado: 0, gastado: 0, quedo: 0, porProducto: {} };
    movs.forEach(function (m) {
      if (!enRango(m, r)) return;
      var p = t.porProducto[m.productoId] ||
        (t.porProducto[m.productoId] = { vendido: 0, gastado: 0, ganancia: 0, cantidad: 0, porRubro: {} });
      if (m.tipo === 'venta') {
        t.recaudado += m.monto; p.vendido += m.monto; p.cantidad += m.cantidad || 0;
      } else {
        t.gastado += m.monto; p.gastado += m.monto;
        p.porRubro[m.rubroId] = (p.porRubro[m.rubroId] || 0) + m.monto;
      }
      p.ganancia = p.vendido - p.gastado;
    });
    t.quedo = t.recaudado - t.gastado;
    return t;
  }

  function puntoSerie(movs, r) {
    var t = totales(movs, r);
    return { desde: r.desde, hasta: r.hasta, recaudado: t.recaudado, gastado: t.gastado };
  }

  function serieSemanas(movs, fechaRef, n) {
    var lunes = rangoSemana(fechaRef).desde, serie = [];
    for (var i = n - 1; i >= 0; i--) serie.push(puntoSerie(movs, rangoSemana(sumarDias(lunes, -7 * i))));
    return serie;
  }

  function serieMeses(movs, fechaRef, n) {
    var f = partes(fechaRef), serie = [];
    for (var i = n - 1; i >= 0; i--) serie.push(puntoSerie(movs, rangoMes(deUTC(Date.UTC(f.a, f.m - i, 1)))));
    return serie;
  }

  function movimientosDe(movs, r) {
    return movs.filter(function (m) { return enRango(m, r); }).sort(function (a, b) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return b.creado - a.creado;
    });
  }

  return {
    fechaLocal: fechaLocal, hoy: hoy, sumarDias: sumarDias, diasEntre: diasEntre,
    rangoSemana: rangoSemana, rangoMes: rangoMes, etiquetaRango: etiquetaRango,
    formatoPesos: formatoPesos, leerMonto: leerMonto, esc: esc,
    totales: totales, serieSemanas: serieSemanas, serieMeses: serieMeses, movimientosDe: movimientosDe,
    MESES: MESES, MESES_CORTOS: MESES_CORTOS
  };
})();

// Para las pruebas con Node. En el navegador no existe "module" y se ignora.
if (typeof module !== 'undefined') module.exports = Reglas;
