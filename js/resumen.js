/* Texto del resumen para mandar por WhatsApp. Es texto plano (no HTML): por eso no se escapa.
 * Los montos van sin espacio después del "$" ("$48.000") porque en un mensaje se lee mejor y
 * WhatsApp no lo corta en dos renglones.
 */
var Resumen = (function () {
  var R = typeof Reglas !== 'undefined' ? Reglas : require('./reglas.js');

  function pesos(n) { return R.formatoPesos(n).replace('$ ', '$'); }
  function conSigno(n) { return (n >= 0 ? '+' : '') + pesos(n); }

  function texto(o) {
    var etiqueta = R.etiquetaRango(o.rango);
    var esMes = o.rango.desde === R.rangoMes(o.rango.desde).desde && o.rango.hasta === R.rangoMes(o.rango.desde).hasta;
    var t = o.totales;
    var lineas = [
      'Resumen ' + (esMes ? '' : 'semana ') + etiqueta,
      'Recaudado: ' + pesos(t.recaudado),
      'Gastado: ' + pesos(t.gastado),
      'Quedó: ' + pesos(t.quedo)
    ];
    o.productos.forEach(function (p) {
      var x = t.porProducto[p.id];
      if (!x || p.id === 'general') return;
      lineas.push('• ' + p.nombre + ': ' + conSigno(x.ganancia) + ' (vendido ' + pesos(x.vendido) + ', gastado ' + pesos(x.gastado) + ')');
    });
    if (t.porProducto.general && t.porProducto.general.gastado) lineas.push('• Gastos generales: ' + pesos(t.porProducto.general.gastado));
    var ins = [];
    o.insumos.forEach(function (i) {
      var dur = R.duracionInsumo(i.aperturas, o.hoy);
      if (dur) ins.push(i.nombre.toLowerCase() + (ins.length ? '' : ' dura') + ' ~' + dur.dias + (dur.dias === 1 ? ' día' : ' días'));
    });
    if (ins.length) lineas.push('Insumos: ' + ins.join(', '));
    return lineas.join('\n');
  }

  return { texto: texto };
})();

if (typeof module !== 'undefined') module.exports = Resumen;
