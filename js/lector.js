// Lectura de video cuadro por cuadro.
// Principal: WebCodecs (con Mediabunny), que usa el decodificador de hardware del celular y lee H.264, HEVC (H.265),
// VP9 y AV1 en 4K/60 fps sin depender del reproductor de video. Respaldo: el reproductor <video> con busquedas.
// Ambas fuentes exponen lo mismo: videoWidth, videoHeight, duration e iterar(tiempos) -> {t, imagen}.
import { esperarCuadro } from './pose.js';

let MB = null;
async function lib() {
  if (!MB) MB = await import('../vendor/mediabunny.min.mjs');
  return MB;
}
const LADO_MAX = 1920; // resolucion de trabajo: como en la version de computadora

async function fuenteWebCodecs(archivo) {
  if (!('VideoDecoder' in window)) throw new Error('sin WebCodecs');
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await lib();
  const input = new Input({ source: new BlobSource(archivo), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('El archivo no contiene video.');
  if (!(await track.canDecode())) {
    const codec = await track.getCodec().catch(() => null);
    const hdr = await track.hasHighDynamicRange().catch(() => false);
    const e = new Error(`Este teléfono no puede decodificar el video (${codec || 'formato desconocido'}${hdr ? ', HDR' : ''}).`);
    e.noDecodificable = true;
    throw e;
  }
  const dw = await track.getDisplayWidth(), dh = await track.getDisplayHeight();
  const esc = Math.min(1, LADO_MAX / Math.max(dw, dh));
  const W = Math.round((dw * esc) / 2) * 2, H = Math.round((dh * esc) / 2) * 2;
  const t0 = await track.getFirstTimestamp().catch(() => 0);
  const fin = await track.computeDuration();
  return {
    tipo: 'webcodecs', videoWidth: W, videoHeight: H, duration: Math.max(0.1, fin - t0),
    async *iterar(tiempos) {
      const sink = new CanvasSink(track, { width: W, height: H, fit: 'fill', poolSize: 3 });
      let i = 0;
      for await (const c of sink.canvasesAtTimestamps(tiempos.map((t) => t + t0))) {
        yield { t: tiempos[i++], imagen: c ? c.canvas : null };
      }
    },
  };
}

function fuenteVideo(archivo) {
  return new Promise((ok, mal) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'position:fixed;left:-9999px;width:2px;height:2px';
    document.body.appendChild(v);
    const url = URL.createObjectURL(archivo);
    v.addEventListener('loadeddata', () => ok({
      tipo: 'video', video: v, videoWidth: v.videoWidth, videoHeight: v.videoHeight, duration: v.duration,
      async *iterar(tiempos) {
        for (const t of tiempos) { await esperarCuadro(v, Math.min(t, v.duration - 0.001)); yield { t, imagen: v }; }
      },
      cerrar() { v.remove(); URL.revokeObjectURL(url); },
    }), { once: true });
    v.addEventListener('error', () => {
      const c = v.error ? v.error.code : 0; v.remove(); URL.revokeObjectURL(url);
      mal(new Error(`El reproductor no pudo abrir el video (código ${c}).`));
    }, { once: true });
    v.src = url;
  });
}

let actual = null;
// conReproductor: salta WebCodecs y usa el reproductor <video> (respaldo si el decodificador entrega cuadros vacios)
export async function abrirVideo(archivo, { conReproductor = false } = {}) {
  if (actual && actual.cerrar) actual.cerrar();
  actual = null;
  let errorWC = null;
  if (!conReproductor) try { actual = await fuenteWebCodecs(archivo); console.info('[lector] webcodecs', actual.videoWidth, actual.videoHeight); return actual; } catch (e) { errorWC = e; console.info('[lector] respaldo <video>:', e.message); }
  try { actual = await fuenteVideo(archivo); return actual; } catch (e) {
    const detalle = errorWC && errorWC.noDecodificable ? errorWC.message : e.message;
    throw new Error(`${detalle} Prueba grabar en H.264 (en la cámara: Ajustes → Codificador de video → H.264) o en 1080p, sin HDR.`);
  }
}
