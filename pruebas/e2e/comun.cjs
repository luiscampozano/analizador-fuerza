// Recorridos automáticos (E2E) de FuerzaPro: abren la app en Chromium como un usuario real (412 px de ancho, sin cuenta)
// y recorren los flujos más importantes. Sirven la carpeta del repo en un puerto libre y cortan todo acceso a internet
// (la app debe funcionar sola). Uso: node pruebas/e2e/<recorrido>.cjs   (requiere Playwright y Chromium)
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '../..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.task': 'application/octet-stream', '.tflite': 'application/octet-stream', '.onnx': 'application/octet-stream', '.woff2': 'font/woff2' };
function servir() {
  const srv = http.createServer((req, res) => {
    let f = decodeURIComponent(req.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const ruta = path.join(RAIZ, path.normalize(f).replace(/^(\.\.[/\\])+/, ''));
    if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(ruta)] || 'application/octet-stream' }); fs.createReadStream(ruta).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
async function abrir(nombre, prep = {}) {
  const { chromium } = require('playwright');
  const srv = await servir(), base = `http://127.0.0.1:${srv.address().port}`;
  const nav = await chromium.launch(), ctx = await nav.newContext({ viewport: { width: 412, height: 915 } });
  // sin internet: solo el servidor local (las llamadas a /api/ fallan como sin conexión, igual que en el gimnasio).
  // Excepción: la IA de pose de MediaPipe (programa y modelo), que la app descarga la primera vez, igual que un usuario real.
  const permitido = (u) => (u.href.startsWith(base) && !u.pathname.startsWith('/api/')) || u.href.startsWith('https://storage.googleapis.com/mediapipe-models/') || u.href.startsWith('https://cdn.jsdelivr.net/npm/@mediapipe/');
  await ctx.route((u) => !permitido(u), (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const avisos = []; p.on('dialog', (d) => { avisos.push(d.message()); d.accept(); });
  await p.addInitScript((prep) => { localStorage.setItem('af_bienvenida', 'omitida'); localStorage.setItem('af_tour', '1'); for (const [k, v] of Object.entries(prep)) localStorage.setItem(k, v); }, prep);
  await p.goto(base + '/index.html'); await p.waitForTimeout(1200);
  let fallos = 0;
  const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALLA ') + txt); if (!cond) fallos++; };
  const fin = async () => {
    ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
    await nav.close(); srv.close();
    console.log(fallos ? `FALLA recorrido ${nombre} (${fallos})` : `OK recorrido ${nombre}`); process.exit(fallos ? 1 : 0);
  };
  return { p, base, ok, fin, avisos };
}
module.exports = { abrir };
