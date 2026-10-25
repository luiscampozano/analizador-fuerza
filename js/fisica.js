// Motor fisico (port del motor Python validado con el remo de prueba).
// Entrada: puntos MediaPipe por cuadro. Salida: posicion, velocidad, aceleracion, fuerza, potencia y repeticiones.
export const G = 9.81;

// indices MediaPipe Pose (33 puntos)
export const MP = {
  hombros: [11, 12], codos: [13, 14], manos: [15, 16], cadera: [23, 24], rodillas: [25, 26], pies: [27, 28],
};
const ANCLAS = { cadera: MP.cadera, hombros: MP.hombros, tobillos: MP.pies, ninguna: null };

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
  return cand.filter((p) => {
    let izq = y[p], i = p;
    while (i > 0 && y[i - 1] <= y[p]) { i--; izq = Math.min(izq, y[i]); }
    let der = y[p]; i = p;
    while (i < n - 1 && y[i + 1] <= y[p]) { i++; der = Math.min(der, y[i]); }
    return y[p] - Math.max(izq, der) >= prominencia;
  });
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

// ------------------------------------------------------------ analisis principal
// cfg: {ejercicio, masa (kg en el eje), alfa (grados), relacion, altura (m), inicio, fin}
export function analizar(full, fps, ej, cfg) {
  const n = full.length;
  // escala: estatura en pixeles por proporciones de Drillis-Contini
  const cad = medio(full, MP.cadera), rod = medio(full, MP.rodillas), tob = medio(full, MP.pies);
  let alto = full.map((_, i) => {
    const vals = [dist(rod[i], cad[i]) / 0.245, dist(tob[i], rod[i]) / 0.246].filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b) / vals.length : NaN;
  });
  const med = mediana(alto) || 1;
  alto = savgol(alto.map((x) => (Number.isFinite(x) ? x : med)), fps, 2);
  const mPx = alto.map((a) => cfg.altura / Math.max(a, 1));

  const punto = medio(full, MP[ej.punto]);
  const anclaPar = ANCLAS[ej.ancla];
  const ancla = anclaPar ? medio(full, anclaPar) : null;
  const relPx = punto.map((p, i) => (ancla ? [p[0] - ancla[i][0], p[1] - ancla[i][1]] : [p[0], p[1]]));
  const rel = relPx.map((p, i) => [Number.isFinite(p[0]) ? p[0] * mPx[i] : 0, Number.isFinite(p[1]) ? p[1] * mPx[i] : 0]);

  // direccion principal global (autovector de la covarianza 2x2) y su sentido
  const ejePrincipal = (pts) => {
    let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { d: [Math.cos(th), Math.sin(th)], m: [mx, my] };
  };
  const glob = ejePrincipal(rel);
  let dg = glob.d;
  const haciaAncla = [-glob.m[0], -glob.m[1]];
  const ref = { arriba: [0, -1], abajo: [0, 1], hacia_ancla: haciaAncla, lejos_ancla: [-haciaAncla[0], -haciaAncla[1]] }[ej.sentido];
  if (dg[0] * ref[0] + dg[1] * ref[1] < 0) dg = [-dg[0], -dg[1]];
  const W = Math.round(1.5 * fps), dirs = new Array(n);
  for (let i = 0; i < n; i++) {
    let d = ejePrincipal(rel.slice(Math.max(0, i - W), Math.min(n, i + W))).d;
    if (d[0] * dg[0] + d[1] * dg[1] < 0) d = [-d[0], -d[1]];
    dirs[i] = d;
  }
  let s = savgol(rel.map((p, i) => p[0] * dirs[i][0] + p[1] * dirs[i][1]), fps / 2, 3);
  const s0 = percentil(s, 2); s = s.map((x) => x - s0);
  const v = savgol(s, fps / 2, 3, 1).map((x) => x * fps);
  const a = savgol(s, fps * 0.75, 3, 2).map((x) => x * fps * fps);

  const r = cfg.relacion || 1, sen = Math.sin(cfg.alfa * Math.PI / 180);
  const estatico = cfg.masa * sen / r;
  const fuerza = a.map((ac) => cfg.masa * (sen + (ac / r) / G) / r);
  const potencia = fuerza.map((f, i) => f * G * v[i]);

  // repeticiones
  const rango = percentil(s, 98) - percentil(s, 2);
  const prom = Math.max(0.05, 0.35 * rango);
  const tops = picos(s, prom, fps * 0.8), valles = picos(s.map((x) => -x), prom, fps * 0.8);
  const i0 = cfg.inicio ? Math.round(cfg.inicio * fps) : 0, i1 = cfg.fin ? Math.round(cfg.fin * fps) : n;
  let reps = [];
  for (const pk of tops) {
    if (pk < i0 || pk >= i1) continue;
    const w0 = Math.max(i0, pk - Math.round(1.6 * fps));
    let ini = w0; for (let i = w0; i <= pk; i++) if (s[i] < s[ini]) ini = i;
    const sig = valles.find((x) => x > pk);
    const fin = Math.min(sig ?? n - 1, i1 - 1);
    const con = [ini, pk + 1];
    const seg = (arr) => arr.slice(con[0], con[1]);
    const media = (arr) => arr.reduce((x, y) => x + y, 0) / (arr.length || 1);
    let trabajo = 0;
    for (let i = ini + 1; i <= pk; i++) trabajo += fuerza[i] * G * (s[i] - s[i - 1]);
    reps.push({
      inicio: ini, tope: pk, fin,
      recorrido_cm: (s[pk] - s[ini]) * 100,
      t_subida: (pk - ini) / fps, t_bajada: (fin - pk) / fps,
      v_media: media(seg(v)), v_pico: Math.max(...seg(v)),
      f_media: media(seg(fuerza)), f_pico: Math.max(...seg(fuerza)),
      p_media: media(seg(potencia).map((x) => Math.max(0, x))), p_pico: Math.max(...seg(potencia)),
      trabajo_j: trabajo,
    });
  }
  // al soltar o agarrar la carga las manos se mueven en otra direccion: fuera reps de borde atipicas
  if (reps.length >= 3) {
    const ang = reps.map((x) => {
      const d = [relPx[x.tope][0] - relPx[x.inicio][0], relPx[x.tope][1] - relPx[x.inicio][1]];
      return Math.atan2(d[1], d[0]) * 180 / Math.PI;
    });
    const m = mediana(ang);
    let desv = ang.map((g) => Math.abs(((g - m + 540) % 360) - 180));
    while (reps.length >= 3 && desv[desv.length - 1] > 10) { reps.pop(); desv.pop(); }
    while (reps.length >= 3 && desv[0] > 10) { reps.shift(); desv.shift(); }
  }
  if (reps.length) {
    const medRec = mediana(reps.map((x) => x.recorrido_cm));
    reps.forEach((x) => { x.parcial = x.recorrido_cm < 0.5 * medRec; });
    const mejor = Math.max(...reps.filter((x) => !x.parcial).map((x) => x.v_media));
    reps.forEach((x, k) => { x.n = k + 1; x.perdida = 100 * (1 - x.v_media / mejor); });
  }
  const valido = new Array(n).fill(false);
  if (reps.length) {
    const ini = Math.max(0, reps[0].inicio - Math.round(0.5 * fps));
    for (let i = ini; i <= reps[reps.length - 1].fin; i++) valido[i] = true;
  }
  return { n, fps, s, v, a, fuerza, potencia, dirs, estatico, reps, valido };
}
