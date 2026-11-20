/* Calculadora de bolsillo: la lógica sin pantalla, así se prueba con Node.
 * Funciona como una calculadora común (de izquierda a derecha, sin "primero se multiplica"),
 * porque es lo que espera alguien que suma un ticket del súper.
 * El estado nunca se modifica: cada tecla devuelve uno nuevo. Así la pantalla puede guardar
 * el anterior sin miedo a que cambie por debajo.
 */
var Calculadora = (function () {
  // texto: lo que se está escribiendo ('' = nada todavía). acum: el resultado parcial.
  // op: la operación pendiente. listo: true justo después de '=' (un dígito arranca de cero).
  function nueva() { return { texto: '', acum: null, op: null, listo: false, error: false }; }

  function copiar(e) { return { texto: e.texto, acum: e.acum, op: e.op, listo: e.listo, error: e.error }; }

  function numeroDe(texto) { return texto === '' || texto === ',' ? 0 : parseFloat(texto.replace(',', '.')); }

  function operar(a, op, b) {
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (b === 0) return null; // dividir por cero: Error en pantalla
    return a / b;
  }

  // Redondear a 2 decimales evita que 0,1 + 0,2 muestre 0,30000000000000004.
  function redondear(n) { return Math.round(n * 100) / 100; }

  // Resuelve la operación pendiente con el número que se estaba escribiendo.
  function resolver(e) {
    if (e.op === null || e.texto === '') return;
    var r = operar(e.acum, e.op, numeroDe(e.texto));
    if (r === null) { e.error = true; return; }
    e.acum = redondear(r); e.texto = ''; e.op = null;
  }

  function tecla(anterior, t) {
    if (t === 'C') return nueva();
    if (anterior.error) return anterior;
    var e = copiar(anterior);
    if (/^[0-9]$/.test(t) || t === ',') {
      if (e.listo) { e.acum = null; e.listo = false; }
      if (t === ',' && e.texto.indexOf(',') >= 0) return e;
      if (t !== ',' && e.texto === '0') e.texto = '';
      e.texto += t;
    } else if (t === '⌫') {
      e.texto = e.texto.slice(0, -1);
    } else if (t === '=') {
      resolver(e); e.listo = !e.error;
    } else if ('+−×÷'.indexOf(t) >= 0) {
      e.listo = false;
      if (e.texto === '') {
        // Operador seguido de otro: se cambia por el último. Sin nada escrito, se opera desde 0.
        if (e.acum === null) e.acum = 0;
      } else if (e.op === null) {
        e.acum = numeroDe(e.texto); e.texto = '';
      } else {
        resolver(e);
        if (e.error) return e;
      }
      e.op = t;
    }
    return e;
  }

  function valor(e) {
    if (e.error) return null;
    if (e.texto !== '') return numeroDe(e.texto);
    return e.acum === null ? 0 : e.acum;
  }

  function formato(n) {
    var signo = n < 0 ? '-' : '', p = String(Math.abs(n)).split('.');
    return signo + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : '');
  }

  function pantalla(e) {
    if (e.error) return 'Error';
    if (e.texto !== '') {
      // Mientras se escribe se respeta lo tipeado (por ejemplo "12," sin decimales todavía).
      var p = e.texto.split(',');
      return formato(numeroDe(p[0])) + (p.length > 1 ? ',' + p[1] : '');
    }
    return formato(valor(e));
  }

  return { nueva: nueva, tecla: tecla, pantalla: pantalla, valor: valor };
})();

if (typeof module !== 'undefined') module.exports = Calculadora;
