// Pruebas de la calculadora (js/calculadora.js). Correr con:  node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calculadora.js');
const run = s => [...s].reduce((e, t) => C.tecla(e, t), C.nueva());

test('suma de un ticket', () => assert.equal(C.pantalla(run('1500+2300+800=')), '4.600'));
test('izquierda a derecha', () => assert.equal(C.pantalla(run('2+3×4=')), '20'));
test('decimales con coma', () => assert.equal(C.pantalla(run('10÷4=')), '2,5'));
test('cambiar de operador', () => assert.equal(C.pantalla(run('8+−3=')), '5'));
test('borrar', () => { assert.equal(C.pantalla(run('123⌫')), '12'); assert.equal(C.pantalla(run('12+3C')), '0'); });
test('dividir por cero', () => {
  const e = run('5÷0='); assert.equal(C.pantalla(e), 'Error'); assert.equal(C.valor(e), null);
  assert.equal(C.pantalla(C.tecla(e, 'C')), '0');
});
test('valor para pasar al monto', () => assert.equal(C.valor(run('1500+2300=')), 3800));
test('= repetido no hace nada y no muta el estado', () => {
  const e = run('2+3='); assert.equal(C.pantalla(C.tecla(e, '=')), '5');
  const e2 = run('7'); C.tecla(e2, '1'); assert.equal(C.pantalla(e2), '7');
});
test('se puede seguir operando con el resultado y escribir número nuevo', () => {
  assert.equal(C.pantalla(run('2+3=×2=')), '10');
  assert.equal(C.pantalla(run('2+3=9')), '9');
});
test('mientras se escribe muestra miles y coma', () => assert.equal(C.pantalla(run('1234,5')), '1.234,5'));
