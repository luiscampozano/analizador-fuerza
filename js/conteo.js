// Segundo contador de repeticiones, independiente de la camara: usa angulos de las articulaciones (codo, hombro,
// cadera, rodilla, tobillo) y distancias medidas en "torsos". No cambian si la camara se mueve, se acerca o se inclina.
// Se compara con el contador principal (posicion del punto seguido) y, si no coinciden, gana el de angulos solo cuando
// su señal es claramente periodica y regular. Regla validada con validacion cruzada en el banco de 59 videos
// (29 -> ~35 exactos con videos que la regla no vio). Ver docs/DIARIO.md (29/10/2026).

const ang = (a, b, c) => {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]], d = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  return d ? Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))) * 180 / Math.PI : NaN;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const torso = (p) => (dist(p[11], p[23]) + dist(p[12], p[24])) / 2 || 1;
const LADOS = { L: { hom: 11, cod: 13, mun: 15, cad: 23, rod: 25, tob: 27, pie: 31 }, R: { hom: 12, cod: 14, mun: 16, cad: 24, rod: 26, tob: 28, pie: 32 } };
const SENALES = {
  codo: (p, s) => ang(p[s.hom], p[s.cod], p[s.mun]),
  hombro: (p, s) => ang(p[s.cad], p[s.hom], p[s.cod]),
  cadera: (p, s) => ang(p[s.hom], p[s.cad], p[s.rod]),
  rodilla: (p, s) => ang(p[s.cad], p[s.rod], p[s.tob]),
  tobillo: (p, s) => ang(p[s.rod], p[s.tob], p[s.pie]),
  munecaY: (p, s) => (p[s.mun][1] - p[s.hom][1]) / torso(p),
  munecas: (p) => dist(p[15], p[16]) / torso(p),
  rodillas: (p) => dist(p[25], p[26]) / torso(p),
  hombroCad: (p) => ((p[11][1] + p[12][1]) / 2 - (p[23][1] + p[24][1]) / 2) / torso(p),
};
const ANGULOS = new Set(['codo', 'hombro', 'cadera', 'rodilla', 'tobillo']);

// Que articulacion mueve cada ejercicio (la principal primero). Sirve para los 169 ejercicios y los creados por el
// usuario: primero por el tipo de movimiento (id), y si no, por lo que la app sigue (punto/ancla).
export function senalesDe(ej) {
  if (ej.senal) return [].concat(ej.senal);
  const id = ej.id || '';
  if (/pantorrilla/.test(id)) return ['tobillo', 'rodilla'];
  if (/encogim/.test(id)) return ['hombroCad', 'munecaY'];
  if (/apertura|pec_deck|cruce|pajaro/.test(id)) return ['munecas', 'hombro'];
  if (/^(elevaciones_laterales|lateral_unilateral|laterales_polea|laterales_maquina|elevaciones_frontales|pullover|jalon_brazos_rectos|rueda_abdominal)$/.test(id)) return ['hombro', 'munecaY'];
  if (/^(abductores_maquina|aductores_maquina)$/.test(id)) return ['rodillas', 'cadera'];
  if (/^(sentadilla_salto|salto_cajon)$/.test(id)) return ['rodilla', 'cadera'];
  if (/^(push_press|landmine_press)$/.test(id)) return ['codo', 'rodilla'];
  if (/patada_gluteo|abduccion|hiperext|crunch|abdominal|elevacion_piernas|superman|pull_through/.test(id)) return ['cadera', 'hombroCad'];
  if (/remo_barra|remo_pendlay|remo_t$|flexiones|remo_invertido|fondos|dominad|chin_up|muscle/.test(id)) return ['codo', 'hombro'];
  if (ej.punto === 'manos' && ej.ancla === 'tobillos') return ['cadera', 'rodilla']; // bisagras y olimpicos
  if ((ej.punto === 'hombros' || ej.punto === 'cadera') && ej.ancla === 'tobillos') return ['rodilla', 'cadera'];
  if (ej.punto === 'pies' || ej.punto === 'rodillas') return ['rodilla', 'cadera'];
  if (ej.punto === 'manos' || ej.punto === 'codos') return ['codo', 'munecaY'];
  return ['cadera', 'rodilla'];
}

function suave(x, n) {
  const o = new Array(x.length); let s = 0, c = 0;
  // media movil centrada (ventana 2n+1), ignorando huecos
  const val = (i) => (Number.isFinite(x[i]) ? x[i] : null);
  for (let i = 0; i < Math.min(n, x.length); i++) { const v = val(i); if (v !== null) { s += v; c++; } }
  for (let i = 0; i < x.length; i++) {
    const e = i + n; if (e < x.length) { const v = val(e); if (v !== null) { s += v; c++; } }
    const q = i - n - 1; if (q >= 0) { const v = val(q); if (v !== null) { s -= v; c--; } }
    o[i] = c ? s / c : NaN;
  }
  return o;
}
const pct = (a, q) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(q * (b.length - 1))] : NaN; };

function autocorr(z, fps) {
  const paso = Math.max(1, Math.round(fps / 30)); // a 30 Hz basta
  const v = []; for (let i = 0; i < z.length; i += paso) v.push(Number.isFinite(z[i]) ? z[i] : 0.5);
  const dt = paso / fps, m = v.reduce((a, b) => a + b, 0) / (v.length || 1), w = v.map((a) => a - m);
  const c0 = w.reduce((a, b) => a + b * b, 0) || 1, lo = Math.round(0.8 / dt), hi = Math.min(Math.round(8 / dt), Math.floor(w.length / 2));
  const ac = [];
  for (let k = lo; k <= hi; k++) { let s = 0; for (let i = 0; i + k < w.length; i++) s += w[i] * w[i + k]; ac[k] = s / c0; }
  for (let k = lo + 1; k < hi; k++) if (ac[k] > ac[k - 1] && ac[k] >= ac[k + 1] && ac[k] > 0.1) return { T: k * dt, ac: ac[k] };
  return { T: null, ac: 0 };
}

// Conteo con histeresis sobre el % del recorrido: una rep = salir del reposo (pasar el 70 %) y volver (bajar del 30 %)
function contarHisteresis(x, fps) {
  const lo = pct(x, 0.05), hi = pct(x, 0.95), r = hi - lo;
  if (!(r > 0)) return { n: 0, reps: [], ac: 0 };
  const y = x.map((v) => (v - lo) / r);
  const inv = y.filter((v) => v > 0.5).length / y.length > 0.5, z = inv ? y.map((v) => 1 - v) : y; // reposo abajo
  let estado = 0, i0 = 0; const reps = [];
  for (let i = 0; i < z.length; i++) {
    if (!Number.isFinite(z[i])) continue;
    if (estado === 0 && z[i] > 0.7) { estado = 1; i0 = i; } else if (estado === 1 && z[i] < 0.3) { estado = 0; reps.push([i0, i]); }
  }
  // el comienzo real de cada rep: el ultimo instante en reposo antes de pasar el 70 %
  for (const q of reps) { let k = q[0]; while (k > 0 && z[k - 1] > 0.3 && z[k - 1] <= z[k] + 1e-9) k--; q[0] = k; }
  const { T, ac } = autocorr(z, fps);
  const d = reps.map(([a, b]) => (b - a) / fps), md = d.reduce((a, b) => a + b, 0) / (d.length || 1);
  const cv = d.length > 1 ? Math.sqrt(d.reduce((a, q) => a + (q - md) ** 2, 0) / d.length) / md : null;
  const activo = reps.length ? (reps[reps.length - 1][1] - reps[0][0]) / fps : 0;
  return { n: reps.length, reps, T, ac, cv, nT: T ? activo / T : null, rango: r };
}

// Zigzag con umbral relativo a la amplitud tipica de una rep (segundo contador sobre la misma señal)
function zig(x, h) {
  const piv = []; let dir = 0, ext = null;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]; if (!Number.isFinite(v)) continue;
    if (ext === null) { ext = v; continue; }
    if (dir >= 0) { if (v > ext) ext = v; else if (ext - v >= h) { piv.push([ext, 1]); dir = -1; ext = v; } }
    if (dir < 0) { if (v < ext) ext = v; else if (v - ext >= h) { piv.push([ext, -1]); dir = 1; ext = v; } }
  }
  return piv;
}
function contarZigzag(x) {
  const f = x.filter(Number.isFinite).sort((a, b) => a - b); if (f.length < 10) return 0;
  const r = f[Math.floor(0.95 * (f.length - 1))] - f[Math.floor(0.05 * (f.length - 1))]; if (!(r > 0)) return 0;
  const p0 = zig(x, 0.2 * r), sw = [];
  for (let i = 1; i < p0.length; i++) sw.push(Math.abs(p0[i][0] - p0[i - 1][0]));
  if (!sw.length) return 0;
  sw.sort((a, b) => b - a); const A = sw[Math.floor(sw.length * 0.25)] || sw[0];
  const reposoAlto = f[Math.floor(f.length / 2)] > (f[0] + f[f.length - 1]) / 2;
  return zig(x, 0.75 * A).filter((q) => (reposoAlto ? q[1] === -1 : q[1] === 1)).length;
}

// frames: puntos crudos de la IA por cuadro [{ t, puntos }] (como salen de la deteccion, ~30 por segundo; asi se
// valido: los puntos poco visibles se usan tal cual, sin interpolar). Si no hay, se usan los interpolados (full).
// Devuelve el conteo por angulos (reps en indices de full) y sus medidas de calidad.
export function contarPorAngulos(full, fps, ej, frames = null) {
  let P, tiempos;
  if (frames && frames.length > 10) { P = frames.map((f) => f.puntos); tiempos = frames.map((f) => f.t); }
  else { const paso = Math.max(1, Math.round(fps / 30)); P = []; tiempos = []; for (let i = 0; i < full.length; i += paso) { P.push(full[i]); tiempos.push(i / fps); } }
  const ok = (p) => p && p.length >= 33;
  let vl = 0, vr = 0;
  for (const p of P) if (ok(p)) { vl += (p[13][2] || 0) + (p[15][2] || 0) + (p[25][2] || 0) + (p[27][2] || 0); vr += (p[14][2] || 0) + (p[16][2] || 0) + (p[26][2] || 0) + (p[28][2] || 0); }
  const lado = vl >= vr ? LADOS.L : LADOS.R;
  const nom = senalesDe(ej)[0], f = SENALES[nom]; if (!f || P.length < 10) return null;
  const crudo = P.map((p) => { if (!ok(p)) return NaN; try { const v = f(p, lado); return Number.isFinite(v) ? v : NaN; } catch (e) { return NaN; } });
  const dts = []; for (let i = 1; i < tiempos.length; i++) dts.push(tiempos[i] - tiempos[i - 1]);
  dts.sort((a, b) => a - b); const fr = 1 / (dts[Math.floor(dts.length / 2)] || 1 / 30);
  const x = suave(crudo, 4);
  const h = contarHisteresis(x, fr);
  const aFull = (k) => Math.max(0, Math.min(full.length - 1, Math.round(tiempos[Math.min(k, tiempos.length - 1)] * fps)));
  h.reps = h.reps.map(([a, b]) => [aFull(a), aFull(b)]);
  return { senal: nom, ...h, zig: contarZigzag(x), esAngulo: ANGULOS.has(nom) };
}

// Regla: ¿usar el conteo por angulos en vez del principal?
export function preferirAngulos(nPrincipal, c) {
  if (!c || c.n === nPrincipal || c.n < 1) return false;
  const cv = c.cv ?? 0.5;
  if (c.n === c.zig && cv < 0.55) return true; // dos contadores distintos sobre la señal de angulo coinciden
  return c.ac > 0.3 && c.nT != null && Math.abs(c.nT + 1 - c.n) <= 1 && (c.cv ?? 1) < 0.35; // muy periodica y regular
}

// Ejercicios alternos (curl alterno, martillo alterno): cada brazo se cuenta por su angulo de codo, usando solo los
// cuadros donde la IA ve bien ese codo y esa muñeca. Una rep = brazo estirado -> doblado -> estirado otra vez.
// Devuelve, por brazo, las ventanas [inicio, fin] en indices de full (null si la IA casi no ve ese brazo).
export function contarAlterno(full, fps, frames = null) {
  let P, tiempos;
  if (frames && frames.length > 10) { P = frames.map((f) => f.puntos); tiempos = frames.map((f) => f.t); }
  else { const paso = Math.max(1, Math.round(fps / 30)); P = []; tiempos = []; for (let i = 0; i < full.length; i += paso) { P.push(full[i]); tiempos.push(i / fps); } }
  const ok = (p) => p && p.length >= 33;
  const aFull = (k) => Math.max(0, Math.min(full.length - 1, Math.round(tiempos[Math.min(k, tiempos.length - 1)] * fps)));
  const out = {};
  for (const [nom, s] of [['izq', LADOS.L], ['der', LADOS.R]]) {
    const crudo = P.map((p) => (ok(p) && (p[s.mun][2] ?? 1) >= 0.5 && (p[s.cod][2] ?? 1) >= 0.5 ? ang(p[s.hom], p[s.cod], p[s.mun]) : NaN));
    const x = suave(crudo, 2);
    const vistos = x.filter(Number.isFinite).length;
    const lo = pct(x, 0.05), hi = pct(x, 0.95);
    if (vistos < Math.max(15, 0.25 * x.length)) { out[nom] = null; continue; } // la IA casi no ve este brazo: no se juzga
    if (!(hi - lo >= 45)) { out[nom] = []; continue; } // brazo visible que no se dobla: no hizo reps
    const bajo = lo + 0.35 * (hi - lo), alto = lo + 0.7 * (hi - lo); // angulo chico = codo doblado
    let estado = 'nada', i0 = 0, ult = -1; const reps = [];
    for (let i = 0; i < x.length; i++) {
      const v = x[i]; if (!Number.isFinite(v)) continue;
      if (ult >= 0 && tiempos[i] - tiempos[ult] > 0.4) estado = 'nada'; // la IA perdio el brazo: no se une lo de antes con lo de despues
      ult = i;
      if (estado !== 'doblado' && v >= alto) { estado = 'estirado'; i0 = i; }
      else if (estado === 'estirado' && v <= bajo) estado = 'doblado';
      else if (estado === 'doblado' && v >= alto) { reps.push([aFull(i0), aFull(i)]); estado = 'estirado'; i0 = i; }
    }
    out[nom] = reps;
  }
  return out;
}
