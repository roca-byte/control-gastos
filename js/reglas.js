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

  return {
    fechaLocal: fechaLocal, hoy: hoy, sumarDias: sumarDias, diasEntre: diasEntre,
    rangoSemana: rangoSemana, rangoMes: rangoMes, etiquetaRango: etiquetaRango,
    formatoPesos: formatoPesos, leerMonto: leerMonto, esc: esc,
    MESES: MESES, MESES_CORTOS: MESES_CORTOS
  };
})();

// Para las pruebas con Node. En el navegador no existe "module" y se ignora.
if (typeof module !== 'undefined') module.exports = Reglas;
