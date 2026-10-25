// Trayectoria de la barra.
// 1) Si el usuario toca el disco en el primer cuadro, se sigue ese punto cuadro a cuadro por correlacion de
//    plantillas (ZNCC) en dos escalas. 2) Si no, se usa el punto que ya sigue la IA (manos, hombros o cadera).
import { savgol, MP } from './fisica.js';

const ANCHO_G = 240, ANCHO_F = 480; // resoluciones de trabajo (gruesa y fina)

function gris(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return g;
}
function recortar(g, w, h, cx, cy, r) {
  const n = 2 * r + 1, t = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xx = Math.min(w - 1, Math.max(0, Math.round(cx) - r + x)), yy = Math.min(h - 1, Math.max(0, Math.round(cy) - r + y));
    t[y * n + x] = g[yy * w + xx];
  }
  return t;
}
function normalizar(t) {
  let m = 0; for (const v of t) m += v; m /= t.length;
  let s = 0; const z = new Float32Array(t.length);
  for (let i = 0; i < t.length; i++) { z[i] = t[i] - m; s += z[i] * z[i]; }
  return { z, s: Math.sqrt(s) || 1 };
}
// busca la plantilla tz (lado n) alrededor de (cx, cy) dentro de +-rad; devuelve el mejor ZNCC
function buscar(g, w, h, tz, n, cx, cy, rad, paso = 1) {
  const r = (n - 1) / 2; let mejor = -2, bx = cx, by = cy;
  for (let dy = -rad; dy <= rad; dy += paso) for (let dx = -rad; dx <= rad; dx += paso) {
    const x0 = Math.round(cx + dx) - r, y0 = Math.round(cy + dy) - r;
    if (x0 < 0 || y0 < 0 || x0 + n > w || y0 + n > h) continue;
    let m = 0;
    for (let y = 0; y < n; y++) { const f = (y0 + y) * w + x0; for (let x = 0; x < n; x++) m += g[f + x]; }
    m /= n * n;
    let sxy = 0, syy = 0;
    for (let y = 0; y < n; y++) {
      const f = (y0 + y) * w + x0, ft = y * n;
      for (let x = 0; x < n; x++) { const v = g[f + x] - m; sxy += v * tz.z[ft + x]; syy += v * v; }
    }
    const c = sxy / (tz.s * (Math.sqrt(syy) || 1));
    if (c > mejor) { mejor = c; bx = cx + dx; by = cy + dy; }
  }
  return { x: bx, y: by, c: mejor };
}

// W, H: tamano de la fuente · marca: {x, y} normalizados (0-1) y t (s) del cuadro donde se toco
export function crearSeguidor(W, H, marca) {
  const hg = Math.round(H * ANCHO_G / W), hf = Math.round(H * ANCHO_F / W);
  const cg = new OffscreenCanvasOr(ANCHO_G, hg), cf = new OffscreenCanvasOr(ANCHO_F, hf);
  const xg = cg.getContext('2d', { willReadFrequently: true }), xf = cf.getContext('2d', { willReadFrequently: true });
  const rg = 8, rf = 16; // radios de plantilla (17 px y 33 px)
  let tg = null, tf = null, pos = null, perdidos = 0;
  const puntos = [];
  return {
    puntos,
    procesar(imagen, t) {
      if (!imagen || t < marca.t - 1e-3) return;
      xg.drawImage(imagen, 0, 0, ANCHO_G, hg); xf.drawImage(imagen, 0, 0, ANCHO_F, hf);
      const gg = gris(xg, ANCHO_G, hg), gf = gris(xf, ANCHO_F, hf);
      if (!pos) { // primer cuadro: la plantilla es lo que toco el usuario
        pos = { x: marca.x * ANCHO_F, y: marca.y * hf };
        tg = recortar(gg, ANCHO_G, hg, pos.x / 2, pos.y / 2, rg); tf = recortar(gf, ANCHO_F, hf, pos.x, pos.y, rf);
        puntos.push({ t, x: pos.x / ANCHO_F * W, y: pos.y / hf * H, c: 1 });
        return;
      }
      const ng = normalizar(tg), nf = normalizar(tf);
      const rad = perdidos ? 30 : 18;
      const a = buscar(gg, ANCHO_G, hg, ng, 2 * rg + 1, pos.x / 2, pos.y / 2, rad);
      const b = buscar(gf, ANCHO_F, hf, nf, 2 * rf + 1, a.x * 2, a.y * 2, 3);
      if (b.c < 0.45) { perdidos++; puntos.push({ t, x: NaN, y: NaN, c: b.c }); return; }
      perdidos = 0; pos = { x: b.x, y: b.y };
      // la plantilla se actualiza despacio (cambios de luz, el disco gira un poco)
      const ag = recortar(gg, ANCHO_G, hg, pos.x / 2, pos.y / 2, rg), af = recortar(gf, ANCHO_F, hf, pos.x, pos.y, rf);
      for (let i = 0; i < tg.length; i++) tg[i] = 0.85 * tg[i] + 0.15 * ag[i];
      for (let i = 0; i < tf.length; i++) tf[i] = 0.85 * tf[i] + 0.15 * af[i];
      puntos.push({ t, x: pos.x / ANCHO_F * W, y: pos.y / hf * H, c: b.c });
    },
  };
}
function OffscreenCanvasOr(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// El desvio horizontal solo tiene sentido si la barra debe ir vertical (sentadillas, pesos muertos, presses, remo con barra)
const GRUPOS_V = new Set(['Piernas', 'Glúteo y femoral', 'Pecho', 'Hombros', 'Espalda', 'Potencia']);
export const esVertical = (ej) => ej.perfil === 'libre' && ej.sentido === 'arriba' && !ej.aprox && GRUPOS_V.has(ej.grupo);

// Serie densa (n cuadros a fps) de la trayectoria en pixeles de la fuente + metricas por rep.
// seguido: puntos del seguidor (o null) · mPx: metros por pixel por cuadro (de escala())
export function calcularTrayectoria(full, fps, res, ej, seguido, mPx) {
  const n = full.length;
  let xs = new Array(n).fill(NaN), ys = new Array(n).fill(NaN), fuente = 'ia';
  const buenos = seguido ? seguido.filter((p) => Number.isFinite(p.x)) : [];
  if (buenos.length > 0.5 * (seguido ? seguido.length : 0) && buenos.length > fps / 4) {
    fuente = 'disco';
    let j = 0;
    for (let i = 0; i < n; i++) {
      const t = i / fps;
      if (t < buenos[0].t || t > buenos[buenos.length - 1].t) continue;
      while (j < buenos.length - 2 && buenos[j + 1].t < t) j++;
      const a = buenos[j], b = buenos[j + 1] || a, f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
      if (b.t - a.t > 0.6) continue; // hueco largo: el disco se perdio
      xs[i] = a.x + f * (b.x - a.x); ys[i] = a.y + f * (b.y - a.y);
    }
  } else {
    const par = res.ladoActivo ? null : MP[ej.punto] || MP.manos;
    for (let i = 0; i < n; i++) {
      const pr = par || [[15, 15], [16, 16]][res.ladoActivo[i]];
      xs[i] = (full[i][pr[0]][0] + full[i][pr[1]][0]) / 2; ys[i] = (full[i][pr[0]][1] + full[i][pr[1]][1]) / 2;
    }
  }
  // suavizado (solo en tramos continuos)
  const sx = suavizarTramos(xs, fps), sy = suavizarTramos(ys, fps);
  const vertical = esVertical(ej);
  const porRep = res.reps.map((r) => {
    const ini = r.inicio, tope = r.tope;
    if (!vertical || !Number.isFinite(sx[ini]) || !Number.isFinite(sx[tope])) return { desvio: null };
    let maxDx = 0, minX = Infinity, maxX = -Infinity;
    for (let i = ini; i <= tope; i++) {
      if (!Number.isFinite(sx[i])) continue;
      maxDx = Math.max(maxDx, Math.abs(sx[i] - sx[ini]) * mPx[i]);
      minX = Math.min(minX, sx[i]); maxX = Math.max(maxX, sx[i]);
    }
    const vert = Math.abs(sy[tope] - sy[ini]) * mPx[tope];
    return { desvio: maxDx * 100, ancho: (maxX - minX) * mPx[tope] * 100, vertical: vert * 100 };
  });
  const desvios = porRep.map((p) => p.desvio).filter(Number.isFinite);
  const mm = [...mPx].sort((a, b) => a - b)[Math.floor(mPx.length / 2)];
  return { x: sx, y: sy, fuente, porRep, mPx: mm, vertical, desvioMedio: desvios.length ? desvios.reduce((a, b) => a + b) / desvios.length : null };
}
function suavizarTramos(arr, fps) {
  const out = arr.slice(); let i = 0;
  while (i < arr.length) {
    if (!Number.isFinite(arr[i])) { i++; continue; }
    let j = i; while (j < arr.length && Number.isFinite(arr[j])) j++;
    if (j - i > 9) { const s = savgol(arr.slice(i, j), Math.min(fps / 4, (j - i) - 2), 2); for (let k = i; k < j; k++) out[k] = s[k - i]; }
    i = j;
  }
  return out;
}
