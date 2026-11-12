// Almacen del telefono (IndexedDB) para lo que no cabe en el historial simple:
// el informe completo de cada serie (para volver a abrirla y generar el PDF) y el video con telemetria.
const DB = 'analizador-fuerza', VERSION_DB = 4;
export const MAX_VIDEOS = 15; // se conservan los videos de las ultimas 15 series (cada uno pesa 5-25 MB)
export const MAX_POSES = 60; // puntos del cuerpo de las ultimas 60 series (~150 KB c/u; ~280 KB con los puntos 3D): para corregir reps y reportar fallos

let abierta = null;
function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((ok, mal) => {
    if (!('indexedDB' in window)) return mal(new Error('sin IndexedDB'));
    const r = indexedDB.open(DB, VERSION_DB);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('informes')) db.createObjectStore('informes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('entrenos')) db.createObjectStore('entrenos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('poses')) db.createObjectStore('poses', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('comidas')) db.createObjectStore('comidas', { keyPath: 'id' }).createIndex('fecha', 'fecha');
    };
    // si otra pestaña con una version nueva necesita actualizar la base, se cierra esta conexion
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); abierta = null; }; ok(db); };
    r.onerror = () => mal(r.error);
  });
  abierta.catch(() => { abierta = null; });
  return abierta;
}
function tx(almacen, modo, fn) {
  return abrir().then((db) => new Promise((ok, mal) => {
    const t = db.transaction(almacen, modo), s = t.objectStore(almacen);
    let res;
    const req = fn(s);
    if (req) req.onsuccess = () => { res = req.result; };
    t.oncomplete = () => ok(res);
    t.onerror = () => mal(t.error);
    t.onabort = () => mal(t.error);
  }));
}

export const guardarInforme = (inf) => tx('informes', 'readwrite', (s) => s.put(inf)).catch(() => null);
export const leerInforme = (id) => tx('informes', 'readonly', (s) => s.get(id)).catch(() => null);
export const leerVideo = (id) => tx('videos', 'readonly', (s) => s.get(id)).catch(() => null);

export async function guardarVideo(id, salida) {
  try {
    await tx('videos', 'readwrite', (s) => s.put({ id, fecha: Date.now(), blob: salida.blob, tipo: salida.tipo, extension: salida.extension }));
    // limpieza: solo los mas recientes
    const todos = await tx('videos', 'readonly', (s) => s.getAll());
    const sobran = (todos || []).sort((a, b) => b.fecha - a.fecha).slice(MAX_VIDEOS);
    for (const v of sobran) await tx('videos', 'readwrite', (s) => s.delete(v.id));
    return true;
  } catch (e) { return false; } // sin espacio: el informe igual queda guardado
}

// Puntos del cuerpo detectados por la IA (sin imagen): x, y en pixeles y visibilidad en centesimas, cuadro por cuadro.
// Permiten volver a calcular la serie al corregir las reps y, si el usuario lo reporta, reproducir el fallo exacto.
// v2.53.0 puntos 3D que se guardan (los que dibuja la vista 3D): nariz, orejas, hombros a pies
const P3 = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
export function empacarPose(frames, meta) {
  const n = frames.length, xs = new Int16Array(n * 33), ys = new Int16Array(n * 33), vs = new Uint8Array(n * 33), ts = new Float32Array(n);
  frames.forEach((f, i) => {
    ts[i] = f.t;
    if (f.puntos) f.puntos.forEach((p, k) => { xs[i * 33 + k] = Math.round(p[0]); ys[i * 33 + k] = Math.round(p[1]); vs[i * 33 + k] = Math.max(1, Math.round((p[2] ?? 1) * 100)); });
  });
  // v2.53.0 puntos 3D (vista 3D experimental) en milímetros; las series viejas no los tienen
  if (!frames.some((f) => f.mundo)) return { ...meta, n, ts, xs, ys, vs };
  const m = P3.length, wx = new Int16Array(n * m), wy = new Int16Array(n * m), wz = new Int16Array(n * m), wv = new Uint8Array(n);
  frames.forEach((f, i) => {
    if (!f.mundo || !f.puntos) return;
    wv[i] = 1;
    P3.forEach((k, j) => { const p = f.mundo[k]; wx[i * m + j] = Math.round(p[0] * 1000); wy[i * m + j] = Math.round(p[1] * 1000); wz[i * m + j] = Math.round(p[2] * 1000); });
  });
  return { ...meta, n, ts, xs, ys, vs, wx, wy, wz, wv };
}
// Solo los puntos 3D: [[x, y, z] * 33] en metros (los que no se guardan quedan en 0), o null en los cuadros sin persona.
// null si la serie no los guardó.
export function desempacarMundo(p) {
  if (!p || !p.wx || !p.wv) return null;
  const m = P3.length, out = [];
  for (let i = 0; i < p.n; i++) {
    if (!p.wv[i]) { out.push(null); continue; }
    const q = Array.from({ length: 33 }, () => [0, 0, 0]);
    P3.forEach((k, j) => { q[k] = [p.wx[i * m + j] / 1000, p.wy[i * m + j] / 1000, p.wz[i * m + j] / 1000]; });
    out.push(q);
  }
  return out;
}
export function desempacarPose(p) {
  const frames = [];
  for (let i = 0; i < p.n; i++) {
    if (!p.vs[i * 33] && !p.vs[i * 33 + 11] && !p.vs[i * 33 + 23]) { frames.push({ t: p.ts[i], puntos: null }); continue; }
    const puntos = [];
    for (let k = 0; k < 33; k++) puntos.push([p.xs[i * 33 + k], p.ys[i * 33 + k], p.vs[i * 33 + k] / 100]);
    frames.push({ t: p.ts[i], puntos });
  }
  return frames;
}
export async function guardarPose(id, frames, meta) {
  try {
    await tx('poses', 'readwrite', (s) => s.put({ id, fecha: Date.now(), ...empacarPose(frames, meta) }));
    limpiarPoses().catch(() => {}); // v2.53.0 sin esperar: la app no se detiene mientras borra las poses viejas
    return true;
  } catch (e) { return false; }
}
async function limpiarPoses() {
  const todos = await tx('poses', 'readonly', (s) => s.getAllKeys());
  if ((todos || []).length > MAX_POSES) {
    const lista = await tx('poses', 'readonly', (s) => s.getAll());
    for (const v of lista.sort((a, b) => b.fecha - a.fecha).slice(MAX_POSES)) await tx('poses', 'readwrite', (s) => s.delete(v.id));
  }
}
export const leerPose = (id) => tx('poses', 'readonly', (s) => s.get(id)).catch(() => null);

export async function borrarSerie(id) {
  try {
    await tx('poses', 'readwrite', (s) => s.delete(id)).catch(() => null);
    await tx('informes', 'readwrite', (s) => s.delete(id));
    await tx('videos', 'readwrite', (s) => s.delete(id));
  } catch (e) { /* nada */ }
}

// entrenamientos registrados (pestaña Entrenar)
export const guardarEntreno = (e) => tx('entrenos', 'readwrite', (s) => s.put(e));
export const borrarEntreno = (id) => tx('entrenos', 'readwrite', (s) => s.delete(id)).catch(() => null);
export const leerEntrenos = () => tx('entrenos', 'readonly', (s) => s.getAll()).then((x) => x || []).catch(() => []);
export function guardarEntrenos(lista) {
  return abrir().then((db) => new Promise((ok, mal) => {
    const t = db.transaction('entrenos', 'readwrite'), s = t.objectStore('entrenos');
    lista.forEach((e) => s.put(e));
    t.oncomplete = () => ok(lista.length); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
  }));
}

// registro de comidas (pestaña Nutricion); fecha = 'AAAA-MM-DD'
export const guardarComida = (c) => tx('comidas', 'readwrite', (s) => s.put(c));
export const borrarComida = (id) => tx('comidas', 'readwrite', (s) => s.delete(id)).catch(() => null);
export const leerComidas = (desde, hasta = desde) => tx('comidas', 'readonly', (s) => s.index('fecha').getAll(IDBKeyRange.bound(desde, hasta)))
  .then((x) => x || []).catch(() => []);

// respaldo completo: leer o reemplazar todo el contenido de un almacen
export const todos = (almacen) => tx(almacen, 'readonly', (s) => s.getAll()).then((x) => x || []).catch(() => []);
export function ponerTodos(almacen, lista) {
  return abrir().then((db) => new Promise((ok, mal) => {
    const t = db.transaction(almacen, 'readwrite'), s = t.objectStore(almacen);
    lista.forEach((e) => s.put(e));
    t.oncomplete = () => ok(lista.length); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
  }));
}

export async function idsConVideo() {
  try { return new Set(await tx('videos', 'readonly', (s) => s.getAllKeys())); } catch (e) { return new Set(); }
}
