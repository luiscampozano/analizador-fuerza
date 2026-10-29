// Service worker: la app funciona sin internet despues de la primera visita.
const VERSION = 'af-2.10.0';
const EXTERNOS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];
const BASE = ['./', 'index.html', 'style.css', 'manifest.json', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/logo.png', 'iconos/favicon.png',
  'js/app.js', 'js/ejercicios.js', 'js/fisica.js', 'js/analisis.js', 'js/pose.js', 'js/render.js', 'js/historial.js', 'js/lector.js',
  'js/excel.js', 'js/sesiones.js', 'js/trayectoria.js', 'js/tecnica.js', 'js/vivo.js', 'js/almacen.js', 'js/pdf.js', 'js/entrenar.js', 'js/importar.js', 'js/progreso.js', 'js/nutricion.js', 'js/alimentos.js', 'js/perfil.js', 'js/nube.js', 'js/comunidad.js', 'js/bienvenida.js', 'js/tarjetas.js', 'js/anatomia.js', 'js/atras.js', 'privacidad.html', 'normas.html',
  'vendor/jspdf/jspdf.umd.min.js', 'vendor/jspdf/jspdf.plugin.autotable.min.js',
  'vendor/mp4-muxer.mjs'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return; // la nube siempre por red, nunca del cache
  const externo = EXTERNOS.includes(url.hostname);
  if (url.origin !== location.origin && !externo) return;
  const pesado = externo || url.pathname.includes('/modelos/') || url.pathname.includes('/vendor/');
  if (pesado) { // modelos y librerias: del cache si ya estan (no cambian)
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
      return resp;
    })));
    return;
  }
  // el resto: red primero (para recibir mejoras), cache si no hay conexion
  e.respondWith(fetch(e.request).then((resp) => {
    if (resp.ok) { const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
    return resp;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
