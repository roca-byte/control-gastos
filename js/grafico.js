/* Gráfico de barras en SVG, armado como texto: sin librerías, así la app sigue sin depender
 * de nada y funciona sin conexión. Por cada semana (o mes) van dos barras: lo recaudado y lo
 * gastado. Los colores salen del CSS (clases "recaudado" y "gastado").
 */
var Grafico = (function () {
  var R = typeof Reglas !== 'undefined' ? Reglas : require('./reglas.js');
  var ANCHO = 320, ALTO = 160, ARRIBA = 12, BASE = 132, IZQ = 10;

  function n1(x) { return Math.round(x * 10) / 10; }

  function barras(serie, etiquetas) {
    var max = 0;
    serie.forEach(function (p) { max = Math.max(max, p.recaudado, p.gastado); });
    var abre = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ANCHO + ' ' + ALTO + '" role="img" class="grafico">';
    if (max === 0) {
      return abre + '<text x="' + ANCHO / 2 + '" y="' + ALTO / 2 + '" text-anchor="middle" class="vacio">Todavía no hay movimientos</text></svg>';
    }
    var paso = (ANCHO - IZQ * 2) / serie.length, ancho = Math.min(16, paso * 0.32);
    var alto = BASE - ARRIBA, partes = [abre, '<line x1="' + IZQ + '" y1="' + BASE + '" x2="' + (ANCHO - IZQ) + '" y2="' + BASE + '" class="eje"/>'];
    serie.forEach(function (p, i) {
      var centro = IZQ + paso * i + paso / 2;
      var hR = n1(p.recaudado / max * alto), hG = n1(p.gastado / max * alto);
      // <title> hace que un lector de pantalla (o un toque largo) diga los montos exactos.
      partes.push('<g><title>' + R.esc(etiquetas[i]) + ': recaudado ' + R.formatoPesos(p.recaudado) +
        ', gastado ' + R.formatoPesos(p.gastado) + '</title>' +
        '<rect class="recaudado" x="' + n1(centro - ancho - 1) + '" y="' + n1(BASE - hR) + '" width="' + n1(ancho) + '" height="' + hR + '" rx="2"/>' +
        '<rect class="gastado" x="' + n1(centro + 1) + '" y="' + n1(BASE - hG) + '" width="' + n1(ancho) + '" height="' + hG + '" rx="2"/>' +
        '<text x="' + n1(centro) + '" y="' + (ALTO - 8) + '" text-anchor="middle" class="etiqueta">' + R.esc(etiquetas[i]) + '</text></g>');
    });
    partes.push('</svg>');
    return partes.join('');
  }

  return { barras: barras };
})();

if (typeof module !== 'undefined') module.exports = Grafico;
