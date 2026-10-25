// Deteccion de pose en el propio celular con MediaPipe Pose Landmarker (GPU si esta disponible).
// MediaPipe: se usa la copia local si existe; si no, la oficial (jsDelivr / Google). El service worker la guarda
// en el telefono despues del primer uso, asi la app funciona sin internet.
const MP_VERSION = '0.10.32';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const GOOGLE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
let mp = null;
async function libreria() {
  if (mp) return mp;
  try { mp = await import('../vendor/mediapipe/vision_bundle.mjs'); } catch (e) { mp = await import(`${CDN}/vision_bundle.mjs`); }
  return mp;
}
async function existe(url) {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch (e) { return false; }
}

const MODELOS = {
  rapida: 'pose_landmarker_lite.task',
  normal: 'pose_landmarker_full.task',
  maxima: 'pose_landmarker_heavy.task',
};
let fileset = null;
const cache = {};
// MediaPipe exige que el reloj de los cuadros siempre avance, tambien entre un video y el siguiente
let relojMs = 0;

async function crear(calidad, delegado) {
  const { FilesetResolver, PoseLandmarker } = await libreria();
  if (!fileset) {
    const local = new URL('../vendor/mediapipe/wasm', import.meta.url).href;
    fileset = await FilesetResolver.forVisionTasks(await existe(local + '/vision_wasm_internal.js') ? local : `${CDN}/wasm`);
  }
  const nombre = MODELOS[calidad], local = new URL('../modelos/' + nombre, import.meta.url).href;
  const modelo = await existe(local) ? local : `${GOOGLE}/${nombre.replace('.task', '')}/float16/latest/${nombre}`;
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelo, delegate: delegado },
    runningMode: 'VIDEO', numPoses: 2,
    minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4, minTrackingConfidence: 0.4,
  });
}

export async function cargarModelo(calidad = 'normal') {
  if (cache[calidad]) return cache[calidad];
  let lm, delegado = 'GPU';
  try { lm = await crear(calidad, 'GPU'); } catch (e) { delegado = 'CPU'; lm = await crear(calidad, 'CPU'); }
  cache[calidad] = { lm, delegado };
  return cache[calidad];
}

export function esperarCuadro(video, t) {
  return new Promise((ok, mal) => {
    let hecho = false;
    const terminar = () => { if (!hecho) { hecho = true; ok(); } };
    const fin = setTimeout(terminar, 3000);
    const listo = () => {
      clearTimeout(fin);
      // el cuadro ya esta decodificado al llegar 'seeked'; rVFC solo ayuda si el video se esta pintando
      if ('requestVideoFrameCallback' in video) { video.requestVideoFrameCallback(terminar); setTimeout(terminar, 30); }
      else terminar();
    };
    if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) { clearTimeout(fin); terminar(); return; }
    video.addEventListener('seeked', listo, { once: true });
    video.addEventListener('error', () => { clearTimeout(fin); mal(new Error('No se pudo leer el video')); }, { once: true });
    video.currentTime = t;
  });
}

// Recorre el video a `hz` cuadros por segundo y devuelve los 33 puntos (en pixeles) de la persona principal.
// `fuente` viene de lector.js: {videoWidth, videoHeight, duration, iterar(tiempos)}.
export async function detectarPose(fuente, { calidad = 'normal', hz = 30, alAvanzar = () => {}, cancelado = () => false } = {}) {
  const { lm, delegado } = await cargarModelo(calidad);
  const W = fuente.videoWidth, H = fuente.videoHeight, dur = fuente.duration;
  const tiempos = [];
  for (let k = 0; k <= Math.floor(dur * hz); k++) tiempos.push(Math.min(k / hz, dur - 0.001));
  const total = tiempos.length;
  const frames = [];
  let centroPrev = null, k = 0;
  const base = relojMs + 1000;
  const t0 = performance.now();
  for await (const { t, imagen } of fuente.iterar(tiempos)) {
    if (cancelado()) throw new Error('cancelado');
    let puntos = null;
    if (imagen) {
      const ts = Math.max(relojMs + 1, base + Math.round(t * 1000));
      relojMs = ts;
      let r;
      try { r = lm.detectForVideo(imagen, ts); } catch (e) {
        try { lm.close(); } catch (_) { /* nada */ }
        delete cache[calidad]; // la proxima vez se crea de nuevo
        throw new Error('La IA de pose tuvo un problema. Vuelve a intentarlo.');
      }
      if (r.landmarks && r.landmarks.length) {
        // persona principal: la mas grande y, a igualdad, la mas cercana a la del cuadro anterior
        let mejor = -Infinity, cMejor = null;
        for (const l of r.landmarks) {
          const xs = l.map((p) => p.x), ys = l.map((p) => p.y);
          const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
          const c = [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length];
          const puntaje = area - (centroPrev ? 0.2 * Math.hypot(c[0] - centroPrev[0], c[1] - centroPrev[1]) : 0);
          if (puntaje > mejor) { mejor = puntaje; puntos = l; cMejor = c; }
        }
        centroPrev = cMejor;
        puntos = puntos.map((p) => [p.x * W, p.y * H, p.visibility ?? 1]);
      }
    }
    frames.push({ t, puntos });
    if (k % 5 === 0) {
      const hecho = k / total, trans = (performance.now() - t0) / 1000;
      alAvanzar(hecho, hecho > 0.05 ? Math.max(0, trans / hecho - trans) : null, delegado);
    }
    k++;
  }
  return { frames, delegado };
}
