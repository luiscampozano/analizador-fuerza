// Motor fisico (port del motor Python validado con el remo de prueba).
// Entrada: puntos MediaPipe por cuadro. Salida: posicion, velocidad, aceleracion, fuerza, potencia y repeticiones.
import { contarPorAngulos, preferirAngulos, contarAlterno } from './conteo.js';

export const G = 9.81;

// indices MediaPipe Pose (33 puntos)
export const MP = {
  hombros: [11, 12], codos: [13, 14], manos: [15, 16], cadera: [23, 24], rodillas: [25, 26], pies: [27, 28],
  mano_i: [15, 15], mano_d: [16, 16], hombro_i: [11, 11], hombro_d: [12, 12],
  pie_i: [27, 27], pie_d: [28, 28], rodilla_i: [25, 25], rodilla_d: [26, 26],
};
const ANCLAS = { cadera: MP.cadera, hombros: MP.hombros, tobillos: MP.pies, rodillas: MP.rodillas, codos: MP.codos, ninguna: null, manos: MP.manos, puntas: [31, 32],
  hombro_i: MP.hombro_i, hombro_d: MP.hombro_d };
// Proporciones segmento/estatura para los puntos de MediaPipe (calibradas con videos reales de pie y sentado)
const SEGMENTOS = [
  { a: [23, 24], b: [25, 26], r: 0.235 }, // muslo
  { a: [25, 26], b: [27, 28], r: 0.235 }, // pierna
  { a: [11, 12], b: [23, 24], r: 0.31 },  // torso (hombros a cadera)
];

// ------------------------------------------------------------ utilidades numericas
function resolver(A, b) { // Gauss-Jordan pequeno
  const n = A.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const cacheSG = new Map();
function coefSG(ventana, orden, deriv) {
  const k = `${ventana},${orden},${deriv}`;
  if (cacheSG.has(k)) return cacheSG.get(k);
  const h = (ventana - 1) / 2, coefs = [];
  // coeficiente j = fila 'deriv' de (A^T A)^-1 A^T, por deriv!
  const ATA = Array.from({ length: orden + 1 }, (_, i) => Array.from({ length: orden + 1 }, (_, j) => {
    let s = 0; for (let x = -h; x <= h; x++) s += x ** (i + j); return s; }));
  let fact = 1; for (let i = 2; i <= deriv; i++) fact *= i;
  for (let x = -h; x <= h; x++) {
    const e = Array.from({ length: orden + 1 }, (_, i) => x ** i);
    coefs.push(resolver(ATA, e)[deriv] * fact);
  }
  cacheSG.set(k, coefs);
  return coefs;
}
export function impar(n) { n = Math.max(5, Math.round(n)); return n % 2 ? n : n + 1; }
export function savgol(y, ventana, orden, deriv = 0) {
  const n = y.length;
  ventana = Math.min(impar(ventana), n % 2 ? n : n - 1);
  if (ventana < orden + 2) return y.slice();
  const c = coefSG(ventana, orden, deriv), h = (ventana - 1) / 2, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -h; j <= h; j++) {
      let idx = i + j;
      if (idx < 0) idx = -idx; else if (idx >= n) idx = 2 * (n - 1) - idx; // espejo
      s += c[j + h] * y[idx];
    }
    out[i] = s;
  }
  return Array.from(out);
}
function percentil(arr, p) {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const i = (a.length - 1) * p / 100, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
const mediana = (a) => percentil(a, 50);

// picos con prominencia minima y distancia minima (como scipy.signal.find_peaks)
export function picos(y, prominencia, distancia) {
  const n = y.length; let cand = [];
  for (let i = 1; i < n - 1; i++) if (y[i] > y[i - 1] && y[i] >= y[i + 1]) cand.push(i);
  // distancia: conservar los mas altos
  const orden = [...cand].sort((a, b) => y[b] - y[a]), quitado = new Set();
  for (const p of orden) {
    if (quitado.has(p)) continue;
    for (const q of cand) if (q !== p && !quitado.has(q) && Math.abs(q - p) < distancia && y[q] <= y[p]) quitado.add(q);
  }
  cand = cand.filter((p) => !quitado.has(p));
  return cand.filter((p) => prominenciaDe(y, p) >= prominencia);
}
function prominenciaDe(y, p) {
  const n = y.length;
  let izq = y[p], i = p;
  while (i > 0 && y[i - 1] <= y[p]) { i--; izq = Math.min(izq, y[i]); }
  let der = y[p]; i = p;
  while (i < n - 1 && y[i + 1] <= y[p]) { i++; der = Math.min(der, y[i]); }
  return y[p] - Math.max(izq, der);
}
// Zigzag: pivotes alternos bajo/alto; un pivote se confirma cuando la señal se aleja de el al menos `h`.
export function zigzag(y, h) {
  const n = y.length, piv = [];
  if (n < 3) return piv;
  let dir = 0, ext = 0, iMin = 0, iMax = 0;
  for (let i = 1; i < n; i++) {
    if (dir === 0) {
      if (y[i] > y[iMax]) iMax = i;
      if (y[i] < y[iMin]) iMin = i;
      if (y[iMax] - y[iMin] >= h) {
        if (iMin < iMax) { piv.push({ i: iMin, tipo: 'bajo' }); dir = 1; ext = iMax; } else { piv.push({ i: iMax, tipo: 'alto' }); dir = -1; ext = iMin; }
      }
    } else if (dir === 1) {
      if (y[i] > y[ext]) ext = i;
      else if (y[ext] - y[i] >= h) { piv.push({ i: ext, tipo: 'alto' }); dir = -1; ext = i; }
    } else {
      if (y[i] < y[ext]) ext = i;
      else if (y[i] - y[ext] >= h) { piv.push({ i: ext, tipo: 'bajo' }); dir = 1; ext = i; }
    }
  }
  if (dir !== 0) piv.push({ i: ext, tipo: dir === 1 ? 'alto' : 'bajo' }); // ultimo extremo (la serie puede terminar arriba)
  return piv;
}
// Prominencia minima para contar una repeticion. Primero se usa el 35 % del rango total; pero si al inicio o al final
// del video hay movimientos grandes (acomodarse, caminar, mover la camara) ese rango se infla y una repeticion
// real con poco recorrido (p. ej. al tocar y subir) queda fuera. Por eso el umbral se baja hasta el 60 % de la
// prominencia tipica de las repeticiones claras.
export function umbralReps(s, fps) {
  const rango = percentil(s, 98) - percentil(s, 2);
  const base = Math.max(0.05, 0.35 * rango);
  const claras = picos(s, base, fps * 0.8).map((p) => prominenciaDe(s, p));
  if (claras.length < 2) return base;
  return Math.max(0.05, Math.min(base, 0.6 * mediana(claras)));
}

// ------------------------------------------------------------ puntos
// frames: [{t, puntos:[[x,y,vis]*33] | null}] en pixeles. Devuelve serie densa a fps con interpolacion.
export function interpolar(frames, fps, duracion) {
  const n = Math.max(2, Math.round(duracion * fps));
  const full = Array.from({ length: n }, () => new Array(33));
  for (let k = 0; k < 33; k++) {
    const ts = [], xs = [], ys = [], vs = [];
    for (const f of frames) if (f.puntos && f.puntos[k][2] > 0.2) {
      ts.push(f.t); xs.push(f.puntos[k][0]); ys.push(f.puntos[k][1]); vs.push(f.puntos[k][2]);
    }
    let j = 0;
    for (let i = 0; i < n; i++) {
      const t = i / fps;
      if (!ts.length) { full[i][k] = [NaN, NaN, 0]; continue; }
      while (j < ts.length - 2 && ts[j + 1] < t) j++;
      if (t <= ts[0]) { full[i][k] = [xs[0], ys[0], vs[0]]; continue; }
      if (t >= ts[ts.length - 1]) { const L = ts.length - 1; full[i][k] = [xs[L], ys[L], vs[L]]; continue; }
      const a = (t - ts[j]) / ((ts[j + 1] - ts[j]) || 1);
      full[i][k] = [xs[j] + a * (xs[j + 1] - xs[j]), ys[j] + a * (ys[j + 1] - ys[j]), vs[j] + a * (vs[j + 1] - vs[j])];
    }
  }
  return full;
}
function medio(full, par) {
  return full.map((f) => [(f[par[0]][0] + f[par[1]][0]) / 2, (f[par[0]][1] + f[par[1]][1]) / 2]);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function anguloArticular(full, cual, fps) {
  const tri = { codo: [[11, 13, 15], [12, 14, 16]], rodilla: [[23, 25, 27], [24, 26, 28]],
    cadera: [[11, 23, 25], [12, 24, 26]] }[cual];
  const ang = full.map((f) => {
    let s = 0, w = 0;
    for (const [a, b, c] of tri) {
      const v1 = [f[a][0] - f[b][0], f[a][1] - f[b][1]], v2 = [f[c][0] - f[b][0], f[c][1] - f[b][1]];
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) + 1e-9);
      const peso = (f[a][2] + f[b][2] + f[c][2]) / 3 + 1e-6;
      const g = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
      if (Number.isFinite(g)) { s += g * peso; w += peso; }
    }
    return w ? s / w : NaN;
  });
  const m = ang.filter(Number.isFinite); const prom = m.reduce((a, b) => a + b, 0) / (m.length || 1);
  return { valores: savgol(ang.map((x) => (Number.isFinite(x) ? x : prom)), fps / 4, 2), lados: tri };
}

// Marca reps parciales (recorrido corto) y atipicas (mucho mas rapidas y largas que el resto: error de medicion,
// movimiento de camara o un tiron). Ninguna de las dos cuenta como referencia de velocidad.
export function marcarReps(reps) {
  const medRec = mediana(reps.map((x) => x.recorrido_cm));
  reps.forEach((x) => { x.parcial = x.recorrido_cm < 0.5 * medRec; x.atipica = false; });
  const normales = reps.filter((x) => !x.parcial);
  if (normales.length >= 4) {
    const mv = mediana(normales.map((x) => x.v_media)), mr = mediana(normales.map((x) => x.recorrido_cm));
    normales.forEach((x) => { x.atipica = x.v_media > 1.5 * mv || (x.v_media > 1.3 * mv && x.recorrido_cm > 1.3 * mr); });
  } else if (normales.length === 3) {
    // con pocas reps se compara cada una contra las otras dos (p. ej. el desenganche o la camara movida contados como rep)
    normales.forEach((x) => {
      const otras = normales.filter((y) => y !== x);
      const mv = mediana(otras.map((y) => y.v_media)), mr = mediana(otras.map((y) => y.recorrido_cm));
      const sim = Math.abs(otras[0].v_media - otras[1].v_media) <= 0.25 * mv; // las otras dos se parecen entre si
      x.atipica = sim && (x.v_media > 1.6 * mv || (x.v_media > 1.35 * mv && x.recorrido_cm > 1.35 * mr));
    });
    if (normales.filter((x) => x.atipica).length > 1) normales.forEach((x) => { x.atipica = false; });
  }
  const ref = reps.filter((x) => !x.parcial && !x.atipica);
  const mejor = Math.max(...(ref.length ? ref : reps).map((x) => x.v_media));
  reps.forEach((x, k) => { x.n = k + 1; x.perdida = 100 * (1 - x.v_media / mejor); });
}

// ------------------------------------------------------------ detector por grupo: cuerpo completo (sentadilla, peso muerto)
function filtroMediana(y, ancho) {
  const h = Math.floor(ancho / 2), n = y.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = []; for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) if (Number.isFinite(y[j])) v.push(y[j]);
    v.sort((a, b) => a - b); out[i] = v.length ? v[v.length >> 1] : y[i];
  }
  return out;
}
// Altura del punto seguido sobre los tobillos, en "torsos" (escala fija para todo el video: corregirla cuadro a cuadro
// confunde agacharse con alejarse de la camara). Solo se cuenta en el tramo en que los pies estan quietos y la persona
// a la distancia de siempre: sacar la barra, devolverla o ir a apagar el celular no cuentan como reps.
export function repsCuerpo(full, fps, ej) {
  const n = full.length;
  const par = (f, ab, c) => (f[ab[0]][c] + f[ab[1]][c]) / 2;
  const P = MP[ej.punto], T0 = mediana(full.map((f) => Math.hypot(par(f, MP.hombros, 0) - par(f, MP.cadera, 0), par(f, MP.hombros, 1) - par(f, MP.cadera, 1))));
  if (!(T0 > 0)) return null;
  const k1 = 2 * Math.round(fps / 8) + 1, k2 = 2 * Math.round(fps / 12) + 1;
  const limpio = (arr) => filtroMediana(filtroMediana(arr, k1), k2);
  let h = limpio(full.map((f) => (par(f, MP.pies, 1) - par(f, P, 1)) / T0));
  h = savgol(h.map((x) => (Number.isFinite(x) ? x : 0)), fps / 4, 2);
  // tramo activo: los pies quietos en su lugar (no esta caminando hacia el rack o hacia la camara)
  const pieX = filtroMediana(full.map((f) => par(f, MP.pies, 0)), fps + 1);
  const mPie = mediana(pieX);
  // v2.18.0: la tolerancia usa el torso "real" (estatura en px), no el torso visto: de frente, con el cuerpo inclinado o
  // acostado hacia la camara el torso se ve cortito y el temblor de la camara parecia caminar. Ademas, caminar es moverse
  // rapido (mas de ~0,8 torsos en 1 s); un paneo lento de la camara o el temblor de la mano no cortan la serie.
  const Tref = Math.max(T0, 0.30 / (mediana(escala(full, fps, 1)) || Infinity));
  const w = Math.round(fps);
  const act = h.map((_, i) => Math.abs(pieX[i] - mPie) < 2.5 * Tref
    && Math.abs(pieX[i] - pieX[Math.max(0, i - w)]) < 0.8 * Tref && Math.abs(pieX[Math.min(n - 1, i + w)] - pieX[i]) < 0.8 * Tref);
  let a = 0, b = -1;
  for (let i = 0; i < n;) {
    if (!act[i]) { i++; continue; }
    let j = i; while (j + 1 < n && act[j + 1]) j++;
    if (j - i > b - a) { a = i; b = j; }
    i = j + 1;
  }
  if (b - a < fps) return null;
  const niveles = (y) => {
    const lo = percentil(y, 5), hi = percentil(y, 95), r = hi - lo;
    if (!(r > 0.05)) return null;
    // amplitud tipica de una rep: el 80 % de las subidas/bajadas que se ven (las chicas son temblor o pasos)
    const piv0 = zigzag(y, 0.12 * r);
    const sw = []; for (let q = 0; q < piv0.length - 1; q++) sw.push(Math.abs(y[piv0[q + 1].i] - y[piv0[q].i]));
    if (!sw.length) return null;
    const A = sw.length >= 3 ? percentil(sw, 80) : Math.max(...sw);
    return { A, R: percentil(y, 85) }; // R: nivel de reposo (de pie / bloqueado)
  };
  let y = h.slice(a, b + 1), nv = niveles(y);
  if (!nv) return null;
  // v2.18.1: si al final (o al inicio) la altura queda mas de 0,5 s por encima del tope, la persona se esta acercando
  // a la camara (se ve mas grande): ese tramo se corta para que la ultima rep no se una con el (muñecos 3D)
  { const sobre = (v) => v > nv.R + 0.5 * nv.A; let e = y.length; while (e > 0 && sobre(y[e - 1])) e--;
    let s0 = 0; while (s0 < e && sobre(y[s0])) s0++;
    if ((y.length - e > 0.5 * fps || s0 > 0.5 * fps) && e - s0 > fps) { b = a + e - 1; a = a + s0; y = h.slice(a, b + 1); nv = niveles(y) || nv; } }
  const { A, R } = nv;
  const piv = zigzag(y, 0.35 * A);
  const pares = [];
  const cerca = 0.35 * A; // cuanto se puede alejar del reposo
  const tope = R + 0.5 * A; // mas alto que eso no es la serie: soltar la barra, levantar los brazos, acercarse a la camara
  // subida real: desde el ultimo instante cerca del fondo hasta el pivote (no cuenta el rato quieto abajo)
  const subida = (i0, i1) => { let k = i0; for (let i = i1; i >= i0; i--) if (y[i] <= y[i0] + 0.15 * (y[i1] - y[i0])) { k = i; break; } return (i1 - k) / fps; };
  for (let q = 0; q < piv.length; q++) {
    const p = piv[q], ant = piv[q - 1], sig = piv[q + 1];
    if (ej.cuenta === 'fondos') { // rep = salir de pie, bajar y volver a quedar de pie
      if (p.tipo !== 'bajo' || !ant || !sig) continue;
      const ok = R - y[p.i] >= 0.6 * A && y[ant.i] >= R - cerca && y[sig.i] >= R - cerca && y[sig.i] <= tope
        && (sig.i - ant.i) / fps >= 1 && subida(p.i, sig.i) <= 5;
      if (ok) pares.push([a + p.i, a + sig.i]);
    } else { // rep = llegar arriba (bloqueo) desde abajo
      if (p.tipo !== 'alto' || !ant) continue;
      const ok = y[p.i] - y[ant.i] >= 0.6 * A && y[p.i] >= R - cerca && y[p.i] <= tope
        && (p.i - ant.i) / fps >= 0.4 && subida(ant.i, p.i) <= 5;
      if (ok) pares.push([a + ant.i, a + p.i]);
    }
  }
  return { pares, a, b, A, h, T0 };
}

// ------------------------------------------------------------ analisis principal
// Escala px -> m robusta: por cuadro se usa la mediana de los segmentos bien visibles; luego se fija una escala
// estable para el video (la mediana) que solo puede variar +-20 % si la camara se acerca o se aleja.
export function escala(full, fps, altura, lim = 1.2) {
  const porCuadro = full.map((f) => {
    const est = [];
    for (const g of SEGMENTOS) {
      const vis = Math.min(f[g.a[0]][2], f[g.a[1]][2], f[g.b[0]][2], f[g.b[1]][2]);
      if (!(vis > 0.6)) continue;
      const pa = [(f[g.a[0]][0] + f[g.a[1]][0]) / 2, (f[g.a[0]][1] + f[g.a[1]][1]) / 2];
      const pb = [(f[g.b[0]][0] + f[g.b[1]][0]) / 2, (f[g.b[0]][1] + f[g.b[1]][1]) / 2];
      const L = dist(pa, pb) / g.r;
      if (Number.isFinite(L) && L > 0) est.push(L);
    }
    return est.length ? mediana(est) : NaN;
  });
  let base = mediana(porCuadro);
  if (!Number.isFinite(base) || base <= 0) { // casi nada visible: se usa el torso aunque se vea poco
    base = mediana(full.map((f) => dist([(f[11][0] + f[12][0]) / 2, (f[11][1] + f[12][1]) / 2],
      [(f[23][0] + f[24][0]) / 2, (f[23][1] + f[24][1]) / 2]) / 0.31)) || 1000;
  }
  const lim2 = porCuadro.map((x) => (Number.isFinite(x) ? Math.min(base * lim, Math.max(base / lim, x)) : base));
  return savgol(lim2, fps, 2).map((a) => altura / Math.max(a, 1));
}

// Tamaño de la persona en la imagen por cuadro (px por unidad de estatura), con cada lado por separado (de perfil el
// lado lejano casi no se ve). Sirve para notar cuando se acerca o se aleja de la camara.
function tamanoCuerpo(full, fps) {
  const t = full.map((f) => {
    const est = [];
    for (const g of SEGMENTOS) for (const k of [0, 1]) {
      if (!(f[g.a[k]][2] > 0.5 && f[g.b[k]][2] > 0.5)) continue;
      const L = dist(f[g.a[k]], f[g.b[k]]) / g.r; if (Number.isFinite(L) && L > 0) est.push(L);
    }
    return est.length ? Math.max(...est) : NaN; // el segmento mas largo: el menos acortado por la perspectiva
  });
  return filtroMediana(t, fps + 1);
}
function congelarAcercamiento(full, fps, rel) {
  const t = tamanoCuerpo(full, fps), base = mediana(t.filter(Number.isFinite));
  if (!(base > 0)) return;
  const fuera = (i) => Number.isFinite(t[i]) && (t[i] > base * 1.35 || t[i] < base / 1.35);
  const n = rel.length, min = Math.round(0.3 * fps);
  let e = n; while (e > 0 && fuera(e - 1)) e--;
  if (n - e >= min && e > fps) for (let i = e; i < n; i++) rel[i] = rel[e - 1].slice();
  let s0 = 0; while (s0 < n && fuera(s0)) s0++;
  if (s0 >= min && s0 < n - fps) for (let i = 0; i < s0; i++) rel[i] = rel[s0].slice();
}

// cfg: {masa (kg en el eje), alfa (grados), relacion, altura (m), inicio, fin}
export function analizar(full, fps, ej, cfg) {
  if (ej.alterno) return analizarAlterno(full, fps, ej, cfg);
  if (ej.unilateral) return analizarUnilateral(full, fps, ej, cfg);
  const n = full.length;
  const mPx = cfg.mPx || escala(full, fps, cfg.altura);

  const punto = medio(full, MP[ej.punto]);
  const anclaPar = ANCLAS[ej.ancla];
  const ancla = anclaPar ? medio(full, anclaPar) : null;
  const relPx = punto.map((p, i) => (ancla ? [p[0] - ancla[i][0], p[1] - ancla[i][1]] : [p[0], p[1]]));
  const rel = relPx.map((p, i) => [Number.isFinite(p[0]) ? p[0] * mPx[i] : 0, Number.isFinite(p[1]) ? p[1] * mPx[i] : 0]);

  // v2.18.1: caminar hacia la camara (o alejarse) al inicio o al final del video: la persona se ve cada vez mas grande o
  // mas chica. Ese tramo se "congela" para que no parezca una rep gigante que tapa a las reales (muñecos 3D)
  if (!cfg.ventanas) congelarAcercamiento(full, fps, rel); // en alternos los codos ya marcan cada rep

  // direccion principal global (autovector de la covarianza 2x2) y su sentido
  const ejePrincipal = (pts) => {
    let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const tr = (sxx + syy) / pts.length, det = (sxx * syy - sxy * sxy) / pts.length / pts.length;
    const mayor = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)); // varianza en la direccion principal
    return { d: [Math.cos(th), Math.sin(th)], m: [mx, my], v: mayor };
  };
  const glob = ejePrincipal(rel);
  let dg = glob.d;
  const haciaAncla = [-glob.m[0], -glob.m[1]];
  const ref = { arriba: [0, -1], abajo: [0, 1], hacia_ancla: haciaAncla, lejos_ancla: [-haciaAncla[0], -haciaAncla[1]] }[ej.sentido];
  if (dg[0] * ref[0] + dg[1] * ref[1] < 0) dg = [-dg[0], -dg[1]];
  const W = Math.round(1.5 * fps), dirs = new Array(n);
  for (let i = 0; i < n; i++) {
    const loc = ejePrincipal(rel.slice(Math.max(0, i - W), Math.min(n, i + W)));
    // con la carga quieta (desviacion < 3 cm) la direccion local es solo ruido: se usa la global
    let d = loc.v < 0.0009 ? dg : loc.d;
    if (d[0] * dg[0] + d[1] * dg[1] < 0) d = [-d[0], -d[1]];
    dirs[i] = d;
  }
  // sentadilla / peso muerto: la altura sobre los tobillos con escala fija (ver repsCuerpo) mide mejor que la
  // proyeccion con escala por cuadro, que confunde agacharse con alejarse de la camara
  const cuerpo = ej.detector === 'cuerpo' ? repsCuerpo(full, fps, ej) : null;
  const mMed = mediana(mPx);
  let s = cuerpo ? savgol(cuerpo.h.map((x) => x * cuerpo.T0 * mMed), fps / 2, 3)
    : savgol(rel.map((p, i) => p[0] * dirs[i][0] + p[1] * dirs[i][1]), fps / 2, 3);
  const s0 = percentil(s, 2); s = s.map((x) => x - s0);
  const v = savgol(s, fps / 2, 3, 1).map((x) => x * fps);
  const a = savgol(s, fps * 0.75, 3, 2).map((x) => x * fps * fps);

  const r = cfg.relacion || 1, sen = Math.sin(cfg.alfa * Math.PI / 180);
  const estatico = cfg.masa * sen / r;
  const fuerza = a.map((ac) => cfg.masa * (sen + (ac / r) / G) / r);
  const potencia = fuerza.map((f, i) => f * G * v[i]);

  // repeticiones
  // Cada rep es una subida (fase concentrica) de un fondo a un tope. Se buscan con un zigzag: la serie se recorre como
  // subidas y bajadas alternas y solo cuenta un cambio de direccion si el movimiento supera el recorrido minimo.
  // Asi no cuentan desenganchar/re-rackear ni el temblor, una rep luchada con estancamiento no se parte en dos, y la
  // primera y la ultima rep cuentan aunque esten al borde del video (antes se exigia bajada a los dos lados del tope).
  const i0 = cfg.inicio ? Math.round(cfg.inicio * fps) : 0, i1 = cfg.fin ? Math.round(cfg.fin * fps) : n;
  let pares;
  if (cuerpo) pares = cuerpo.pares;
  else {
    const prom = umbralReps(s, fps);
    const piv = zigzag(s, prom);
    pares = [];
    for (let q = 0; q < piv.length - 1; q++) if (piv[q].tipo === 'bajo' && piv[q + 1].tipo === 'alto') pares.push([piv[q].i, piv[q + 1].i, piv[q + 2] ? piv[q + 2].i : n - 1]);
    // v2.18.1: la ultima (o primera) rep seguida de caminar/acomodarse sin bajar: la subida sigue de largo y la rep se unia
    // con ese movimiento. Si el tope queda muy por encima de los demas, se toma el primer momento en que llego al nivel
    // de los otros topes (muñecos 3D)
    if (pares.length >= 4) {
      const topes = pares.map((p) => s[p[1]]), recs = pares.map((p) => s[p[1]] - s[p[0]]);
      const mTope = mediana(topes), mRec = mediana(recs);
      for (const p of pares) {
        if (!(s[p[1]] - mTope > 0.6 * mRec)) continue;
        let k = p[0]; while (k < p[1] && s[k] < mTope - 0.1 * mRec) k++;
        let pk = k; for (let i = k; i <= Math.min(p[1], k + Math.round(0.6 * fps)); i++) if (s[i] > s[pk]) pk = i;
        if (pk < p[1] && s[pk] - s[p[0]] > 0.5 * mRec) p[1] = pk;
      }
    }
  }
  // metricas de una rep a partir de su despegue (ini), su tope (pk) y su final (fin)
  const media = (arr) => arr.reduce((x, y) => x + y, 0) / (arr.length || 1);
  const medir = (ini, pk, fin) => {
    const seg = (arr) => arr.slice(ini, pk + 1);
    let trabajo = 0;
    for (let i = ini + 1; i <= pk; i++) trabajo += fuerza[i] * G * (s[i] - s[i - 1]);
    return {
      inicio: ini, tope: pk, fin,
      recorrido_cm: (s[pk] - s[ini]) * 100,
      t_subida: (pk - ini) / fps, t_bajada: (fin - pk) / fps,
      v_media: media(seg(v)), v_pico: Math.max(...seg(v)),
      f_media: media(seg(fuerza)), f_pico: Math.max(...seg(fuerza)),
      p_media: media(seg(potencia).map((x) => Math.max(0, x))), p_pico: Math.max(...seg(potencia)),
      trabajo_j: trabajo,
      // subida contada desde el 10 % del recorrido (no depende del temblor en reposo): para reconocer sacar la barra
      ts10: (() => { const u = s[ini] + 0.1 * (s[pk] - s[ini]); let k = pk; while (k > ini && s[k - 1] > u) k--; return (pk - k) / fps; })(),
    };
  };
  let reps = [];
  for (let q = 0; q < pares.length; q++) {
    let a = pares[q][0], pk0 = pares[q][1];
    if (cuerpo) { // los pivotes vienen de la altura del cuerpo: se ajustan al fondo y al tope de la carga
      const m = Math.round(0.3 * fps);
      for (let i = Math.max(0, a - m); i <= Math.min(pk0, a + m); i++) if (s[i] < s[a]) a = i;
      for (let i = Math.max(a, pk0 - m); i <= Math.min(n - 1, pk0 + m); i++) if (s[i] > s[pk0]) pk0 = i;
    }
    if (pk0 < i0 || pk0 >= i1 || a < i0 - Math.round(2 * fps)) continue;
    if ((pk0 - a) / fps < 0.25) continue; // mas rapido que eso no es una rep, es ruido
    const minV = s[a];
    const tol = Math.max(0.003, 0.01 * (s[pk0] - minV)); // 1 % del recorrido
    // inicio = ultimo instante en el fondo (despegue), no el primero: asi no cuenta la pausa en el piso o en el pecho
    let ini = a; for (let i = pk0; i >= a; i--) if (s[i] <= minV + tol) { ini = i; break; }
    // tope = primer instante en que llega arriba (no el final del bloqueo)
    let pk = pk0; for (let i = ini; i <= pk0; i++) if (s[i] >= s[pk0] - tol) { pk = i; break; }
    const sig = pares[q][2] ?? (pares[q + 1] ? pares[q + 1][0] : n - 1);
    const fin = Math.min(sig, i1 - 1);
    reps.push(medir(ini, pk, fin));
  }
  // al soltar o agarrar la carga las manos se mueven en otra direccion: fuera reps de borde atipicas
  // con carga nadie sube a mas de ~2 m/s de media: eso es la IA perdiendo el cuerpo un instante
  if (cuerpo) reps = reps.filter((x) => x.v_media <= 2);
  if (reps.length >= 3 && !cuerpo) {
    const ang = reps.map((x) => {
      const d = [relPx[x.tope][0] - relPx[x.inicio][0], relPx[x.tope][1] - relPx[x.inicio][1]];
      return Math.atan2(d[1], d[0]) * 180 / Math.PI;
    });
    const m = mediana(ang), mr = mediana(reps.map((x) => x.recorrido_cm));
    // atipica: otra direccion, o un recorrido mucho mayor que el resto (p. ej. pararse despues de soltar la barra)
    const atipica = reps.map((x, k) => Math.abs(((ang[k] - m + 540) % 360) - 180) > 25 || x.recorrido_cm > 1.6 * mr);
    while (reps.length >= 3 && atipica[atipica.length - 1]) { reps.pop(); atipica.pop(); }
    while (reps.length >= 3 && atipica[0]) { reps.shift(); atipica.shift(); }
  }
  if (reps.length >= 3 && !cuerpo) reps = quitarPreparacion(reps, full, fps, ej, rel, mPx, cfg.altura);
  if (reps.length) {
    marcarReps(reps);
    // desenganchar o re-rackear la barra, acomodarse en la maquina: movimientos cortos en los bordes de la serie.
    // Se marcaban como "parcial" pero se contaban; no son reps. Las parciales en medio de la serie se mantienen.
    let cambio = false;
    while (!cuerpo && reps.length > 1 && reps[0].parcial) { reps.shift(); cambio = true; }
    while (!cuerpo && reps.length > 1 && reps[reps.length - 1].parcial) { reps.pop(); cambio = true; }
    if (cambio) marcarReps(reps);
  }
  // segundo contador por angulos de las articulaciones (no depende de la camara): si su señal es claramente mas
  // confiable que la del punto seguido, sus reps reemplazan a las del contador principal (ver js/conteo.js)
  let conteo = { usado: 'principal', principal: reps.length };
  let ventanas = Array.isArray(cfg.ventanas) ? cfg.ventanas : null; // ventanas ya contadas por angulos (ejercicios alternos; [] = brazo visible sin reps)
  if (!ventanas && !cfg.sinAngulos && cfg.inicio == null && cfg.fin == null) {
    const c = contarPorAngulos(full, fps, ej, cfg.frames);
    if (c) conteo = { ...conteo, angulos: c.n, senal: c.senal };
    // v2.18.0: si el contador principal ve reps parejas (mismo recorrido, ninguna parcial), los angulos no pueden
    // quitarle reps: de frente o con paneo el angulo visto en 2D se deforma y se salta reps (muñecos 3D)
    const recs = reps.map((r) => r.recorrido_cm), mRec = mediana(recs);
    const parejas = reps.length >= 3 && recs.every((x) => Math.abs(x - mRec) <= 0.25 * mRec);
    if (c && preferirAngulos(reps.length, c) && !(parejas && c.n < reps.length)) ventanas = c.reps;
  }
  {
    if (ventanas) {
      const c = { reps: ventanas };
      reps = c.reps.map(([a0, b0], k) => {
        // dentro de la rep (reposo -> extremo -> reposo) la fase concentrica va del punto mas bajo de la carga al mas alto
        let ini = a0, pk = a0;
        if (cfg.ventanas) { // alternos: primero el punto mas alto de la ventana y luego el mas bajo ANTES de el
          for (let i = a0; i <= b0; i++) if (s[i] > s[pk]) pk = i;
          for (let i = a0; i <= pk; i++) if (s[i] < s[ini]) ini = i;
        } else {
          for (let i = a0; i <= b0; i++) if (s[i] < s[ini]) ini = i;
          pk = ini; for (let i = ini; i <= b0; i++) if (s[i] > s[pk]) pk = i;
        }
        if (pk - ini < 2) pk = Math.min(b0, ini + 2);
        const fin = c.reps[k + 1] ? c.reps[k + 1][0] : Math.min(n - 1, b0 + Math.round(0.5 * fps));
        return medir(ini, pk, Math.max(pk, fin));
      });
      marcarReps(reps);
      conteo.usado = 'angulos';
    }
  }
  const valido = new Array(n).fill(false);
  if (reps.length) {
    const ini = Math.max(0, reps[0].inicio - Math.round(0.5 * fps));
    for (let i = ini; i <= reps[reps.length - 1].fin; i++) valido[i] = true;
  }
  // calidad de la deteccion: visibilidad media (segun la IA) del punto seguido durante la serie
  let sv = 0, nv = 0;
  const desde = reps.length ? Math.max(0, reps[0].inicio - fps) : 0, hasta = reps.length ? Math.min(n - 1, reps[reps.length - 1].fin) : n - 1;
  for (let i = desde; i <= hasta; i++) for (const k of MP[ej.punto] || []) { sv += full[i][k][2] || 0; nv++; }
  const visPunto = nv ? sv / nv : 1;
  return { n, fps, s, v, a, fuerza, potencia, dirs, estatico, reps, valido, visPunto, conteo };
}

// Movimientos de preparacion contados como rep (acomodarse en la banca, acostarse, desenganchar, pararse al final):
// ocurren al inicio o al final del video y con otra postura que la serie. Se comparan las reps de los bordes con la
// mediana de la serie y se quitan mientras no se parezcan: postura del torso distinta (sentado vs acostado), la
// carga en otra posicion respecto al cuerpo, la persona mal visible o una pausa muy larga antes/despues de la serie.
export function quitarPreparacion(reps, full, fps, ej, rel, mPx, altura = 1.7) {
  const par = (f, ab) => [(f[ab[0]][0] + f[ab[1]][0]) / 2, (f[ab[0]][1] + f[ab[1]][1]) / 2];
  const puntos = [...MP[ej.punto] || [], ...(ANCLAS[ej.ancla] || [])];
  const rasgos = reps.map((r) => {
    const f = full[r.tope], h = par(f, MP.hombros), c = par(f, MP.cadera);
    let vis = 0, nv = 0;
    for (let i = r.inicio; i <= r.tope; i++) for (const k of puntos) { vis += full[i][k][2] || 0; nv++; }
    return {
      vis: nv ? vis / nv : 1,
      torso: Math.atan2(c[1] - h[1], c[0] - h[0]) * 180 / Math.PI,
      largo: Math.hypot(c[0] - h[0], c[1] - h[1]) * mPx[r.tope],
      pos: ANCLAS[ej.ancla] ? rel[r.tope] : null,
      t: r.tope / fps,
    };
  });
  const med = (f) => mediana(rasgos.map(f).filter(Number.isFinite));
  const mVis = med((x) => x.vis), mTorso = med((x) => x.torso), mLargo = med((x) => x.largo);
  const torsoUtil = !(mLargo < 0.6 * 0.30 * altura);
  const mPos = rasgos[0].pos ? [med((x) => x.pos[0]), med((x) => x.pos[1])] : null;
  const mRec = mediana(reps.map((r) => r.recorrido_cm)) / 100;
  const pasos = rasgos.slice(1).map((x, k) => x.t - rasgos[k].t), mPaso = mediana(pasos);
  // con la barra en las manos (press, remo, curl...): el codo de cada rep llega a la misma extension; estirarse hacia la
  // barra o acomodar el agarre no llega. Y la primera "rep" lenta y sin bloqueo claro suele ser sacar la barra del rack.
  const conCodo = ej.punto === 'manos';
  const codo = conCodo ? anguloArticular(full, 'codo', fps).valores : null;
  const extCodo = conCodo ? reps.map((r) => Math.max(...codo.slice(r.inicio, r.tope + 1)) - Math.min(...codo.slice(r.inicio, r.tope + 1))) : null;
  const mExt = conCodo ? mediana(extCodo) : 0;
  const tsOtras = (k) => mediana(reps.filter((_, j) => j !== k).map((r) => r.t_subida));
  const vOtras = (k) => mediana(reps.filter((_, j) => j !== k).map((r) => r.v_media));
  let porCodo = 0;
  const fuera = (k, vecino, primera = false) => {
    const x = rasgos[k];
    if (conCodo && porCodo < 2 && mExt > 60 && extCodo[k] < 0.45 * mExt) { porCodo++; return true; } // el codo casi no se movio: no fue una rep
    // v2.18.1: con el tiempo de subida desde el 10 % (antes se medía desde el último instante "quieto", y el temblor de
    // las manos en reposo alargaba la primera rep real después de acomodarse: muñecos 3D)
    if (primera && reps.length >= 4 && reps[k].ts10 > 2.2 * mediana(reps.filter((_, j) => j !== k).map((r) => r.ts10))) return true;
    const dT = Math.abs(((x.torso - mTorso + 540) % 360) - 180);
    const ratio = x.largo / mLargo;
    const lejos = mPos && Math.hypot(x.pos[0] - mPos[0], x.pos[1] - mPos[1]) > Math.max(0.25, 0.6 * mRec);
    const pausa = Math.abs(x.t - rasgos[vecino].t) > Math.max(6, 3 * mPaso);
    const largaRep = reps[k].recorrido_cm / 100 > 1.35 * mRec; // acostarse, pararse o subir la barra al rack
    // v2.18.0: si el torso se ve muy corto (filmado de frente o acostado hacia la camara), su angulo y su largo en la
    // imagen cambian mucho con cualquier movimiento de camara: no sirven para comparar posturas (muñecos 3D)
    if (!torsoUtil) return largaRep || (mVis >= 0.6 && x.vis < 0.45) || lejos || pausa;
    return largaRep || (mVis >= 0.6 && x.vis < 0.45) || (Number.isFinite(dT) && dT > 35) || (Number.isFinite(ratio) && (ratio < 0.65 || ratio > 1.5)) || lejos || pausa;
  };
  let i0 = 0, i1 = reps.length - 1;
  while (i1 - i0 >= 1 && fuera(i0, i0 + 1, true)) i0++;
  while (i1 - i0 >= 1 && fuera(i1, i1 - 1)) i1--;
  return reps.slice(i0, i1 + 1);
}

// Ejercicios alternos (curl alterno): cada brazo se analiza por separado y luego se unen las repeticiones en orden.
function analizarAlterno(full, fps, ej, cfg) {
  const mPx = escala(full, fps, cfg.altura);
  // Contador por angulo de codo de cada brazo (v2.17.0): una rep = ese codo se estira, se dobla y se vuelve a estirar.
  // Probado con muñecos sinteticos (pruebas/alterno) y con el video real del banco. Si la IA casi no ve un brazo,
  // ese brazo se cuenta como antes (por la posicion de la mano).
  const libre = cfg.inicio == null && cfg.fin == null;
  const c = libre ? contarAlterno(full, fps, cfg.frames) : { izq: null, der: null };
  const lados = [
    analizar(full, fps, { ...ej, alterno: false, punto: 'mano_i', ancla: 'hombro_i' }, { ...cfg, mPx, sinAngulos: true, ventanas: c.izq }),
    analizar(full, fps, { ...ej, alterno: false, punto: 'mano_d', ancla: 'hombro_d' }, { ...cfg, mPx, sinAngulos: true, ventanas: c.der }),
  ];
  const n = full.length, base = lados[0];
  // una rep del codo debe coincidir con una subida real de la mano (si la mano no sube, fue la IA confundida)
  const real = (r, k) => (k === 0 ? !c.izq : !c.der) || r.v_media > 0.1;
  const reps = [...lados[0].reps.filter((r) => real(r, 0)).map((r) => ({ ...r, lado: 'izq' })), ...lados[1].reps.filter((r) => real(r, 1)).map((r) => ({ ...r, lado: 'der' }))]
    .sort((a, b) => a.tope - b.tope);
  const conteo = { usado: c.izq || c.der ? 'angulos' : 'principal', principal: lados[0].conteo.principal + lados[1].conteo.principal, angulos: reps.length, senal: 'codo (cada brazo)' };
  // serie mostrada en el video: en cada instante, el brazo que se esta moviendo mas
  const elegir = (i) => (Math.abs(lados[1].v[i] || 0) > Math.abs(lados[0].v[i] || 0) ? 1 : 0);
  const out = { n, fps, estatico: base.estatico, reps, valido: new Array(n).fill(false),
    s: [], v: [], a: [], fuerza: [], potencia: [], dirs: [], ladoActivo: [] };
  for (let i = 0; i < n; i++) {
    const L = lados[elegir(i)];
    for (const k of ['s', 'v', 'a', 'fuerza', 'potencia', 'dirs']) out[k].push(L[k][i]);
    out.ladoActivo.push(elegir(i));
    out.valido[i] = lados[0].valido[i] || lados[1].valido[i];
  }
  if (reps.length) marcarReps(reps);
  if (conteo) out.conteo = conteo;
  return out;
}

// Ejercicios a un brazo (remo con mancuerna, curl concentrado...): se sigue solo la mano que mas se mueve.
// Con el promedio de las dos manos, la mano quieta reduciria el recorrido y la velocidad a la mitad.
function analizarUnilateral(full, fps, ej, cfg) {
  const mPx = cfg.mPx || escala(full, fps, cfg.altura);
  const anclaPar = ANCLAS[ej.ancla];
  // cuanto se mueve de verdad cada lado: se suaviza (el temblor de un punto tapado no cuenta como movimiento)
  // y se pondera por la visibilidad (un pie o mano que la IA casi no ve no se elige)
  const rango = (idx) => {
    const ys = [], xs = []; let vis = 0;
    for (const f of full) {
      const p = f[idx]; if (!p || !Number.isFinite(p[0])) continue;
      let ax = 0, ay = 0;
      if (anclaPar) { const a0 = f[anclaPar[0]], a1 = f[anclaPar[1]]; if (!a0 || !a1) continue; ax = (a0[0] + a1[0]) / 2; ay = (a0[1] + a1[1]) / 2; }
      xs.push(p[0] - ax); ys.push(p[1] - ay); vis += p[2] || 0;
    }
    if (xs.length < 10) return 0;
    const sx = savgol(xs, fps * 0.6, 2), sy = savgol(ys, fps * 0.6, 2);
    const v = vis / xs.length;
    return Math.hypot(percentil(sx, 95) - percentil(sx, 5), percentil(sy, 95) - percentil(sy, 5)) * v * v;
  };
  // a un brazo se sigue una mano; a una pierna, un pie o una rodilla (el lado que mas se mueve)
  const lados = { pies: ['pie_i', 'pie_d'], rodillas: ['rodilla_i', 'rodilla_d'] }[ej.punto] || ['mano_i', 'mano_d'];
  const lado = rango(MP[lados[1]][0]) > rango(MP[lados[0]][0]) ? 1 : 0;
  const res = analizar(full, fps, { ...ej, unilateral: false, punto: lados[lado] }, { ...cfg, mPx });
  res.ladoActivo = new Array(res.n).fill(lado);
  res.puntosLado = [MP[lados[0]], MP[lados[1]]];
  res.lado = lado ? 'der' : 'izq';
  return res;
}
