// Almacen del telefono (IndexedDB) para lo que no cabe en el historial simple:
// el informe completo de cada serie (para volver a abrirla y generar el PDF) y el video con telemetria.
const DB = 'analizador-fuerza', VERSION_DB = 4;
export const MAX_VIDEOS = 15; // se conservan los videos de las ultimas 15 series (cada uno pesa 5-25 MB)
export const MAX_POSES = 60; // puntos del cuerpo de las ultimas 60 series (~150 KB c/u): para corregir reps y reportar fallos

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
export function empacarPose(frames, meta) {
  const n = frames.length, xs = new Int16Array(n * 33), ys = new Int16Array(n * 33), vs = new Uint8Array(n * 33), ts = new Float32Array(n);
  frames.forEach((f, i) => {
    ts[i] = f.t;
    if (f.puntos) f.puntos.forEach((p, k) => { xs[i * 33 + k] = Math.round(p[0]); ys[i * 33 + k] = Math.round(p[1]); vs[i * 33 + k] = Math.max(1, Math.round((p[2] ?? 1) * 100)); });
  });
  return { ...meta, n, ts, xs, ys, vs };
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
    const todos = await tx('poses', 'readonly', (s) => s.getAllKeys());
    if ((todos || []).length > MAX_POSES) {
      const lista = await tx('poses', 'readonly', (s) => s.getAll());
      for (const v of lista.sort((a, b) => b.fecha - a.fecha).slice(MAX_POSES)) await tx('poses', 'readwrite', (s) => s.delete(v.id));
    }
    return true;
  } catch (e) { return false; }
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
