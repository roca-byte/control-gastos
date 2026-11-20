/* Servidor local para tools/demo.js y tools/video.js.
 * Sirve la carpeta del repo bajo /control-gastos/, igual que GitHub Pages. La app no tiene
 * backend: los datos viven en el navegador de la grabación (un perfil nuevo cada vez).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function servidor() {
  return http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
    if (!p.startsWith('/control-gastos/')) { res.writeHead(404); return res.end(); }
    p = p.slice('/control-gastos'.length);
    if (p.endsWith('/')) p += 'index.html';
    const archivo = path.join(RAIZ, p);
    // RAIZ + separador: si no, una carpeta vecina como 'control-gastos-viejo' también pasaría.
    if (!archivo.startsWith(RAIZ + path.sep) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

// Arranca en un puerto libre y devuelve la URL de la app.
function arrancar() {
  return new Promise((ok) => {
    const srv = servidor().listen(0, () => ok({ srv, url: `http://localhost:${srv.address().port}/control-gastos/` }));
  });
}

module.exports = { servidor, arrancar, RAIZ };
