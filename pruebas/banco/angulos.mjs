// Prototipo: contar reps con señales invariantes a la camara (angulos y distancias relativas) + histeresis.
import fs from 'fs'; import zlib from 'zlib';
const B = '/home/claude/banco';
const et = JSON.parse(fs.readFileSync(B + '/etiquetas.json', 'utf8'));
const ang = (a, b, c) => { const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]]; const d = Math.hypot(...v1) * Math.hypot(...v2); return d ? Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))) * 180 / Math.PI : NaN; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// candidatos: [nombre, f(p) -> valor]   (p = puntos del cuadro)
const L = { hom: 11, cod: 13, mun: 15, cad: 23, rod: 25, tob: 27 }, R = { hom: 12, cod: 14, mun: 16, cad: 24, rod: 26, tob: 28 };
const torso = (p) => (dist(p[11], p[23]) + dist(p[12], p[24])) / 2 || 1;
let LADO = L; const lado = (f) => (p) => f(p, LADO);
const CAND = {
  codo: lado((p, s) => ang(p[s.hom], p[s.cod], p[s.mun])),
  hombro: lado((p, s) => ang(p[s.cad], p[s.hom], p[s.cod])),
  cadera: lado((p, s) => ang(p[s.hom], p[s.cad], p[s.rod])),
  rodilla: lado((p, s) => ang(p[s.cad], p[s.rod], p[s.tob])),
  munecaY: lado((p, s) => (p[s.mun][1] - p[s.hom][1]) / torso(p)),
  caderaY: (p) => ((p[23][1] + p[24][1]) / 2 - (p[27][1] + p[28][1]) / 2) / torso(p),
  hombroY: (p) => ((p[11][1] + p[12][1]) / 2 - (p[27][1] + p[28][1]) / 2) / torso(p),
  munecas: (p) => dist(p[15], p[16]) / torso(p),
};
// candidatos permitidos por tipo de ejercicio (a priori, de biomecanica)
const FAM = (id) => /sentadilla|hack|belt|prensa|bulgara|zancada|extension_cuadriceps/.test(id) ? ['rodilla', 'cadera', 'caderaY', 'hombroY']
  : /peso_muerto|rack_pull|hip_thrust|buenos/.test(id) ? ['cadera', 'hombroY', 'caderaY', 'rodilla']
  : /curl|triceps|press_frances/.test(id) ? ['codo', 'munecaY']
  : /press|fondos/.test(id) ? ['codo', 'munecaY', 'hombro']
  : /remo|jalon|dominad/.test(id) ? ['codo', 'hombro', 'munecaY']
  : /apertura|pajaro|pec|cruce/.test(id) ? ['munecas', 'hombro', 'codo']
  : /encogim/.test(id) ? ['hombroY', 'munecaY'] : Object.keys(CAND);
function suave(x, n) { const o = []; for (let i = 0; i < x.length; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - n); j <= Math.min(x.length - 1, i + n); j++) if (Number.isFinite(x[j])) { s += x[j]; c++; } o.push(c ? s / c : NaN); } return o; }
const pct = (a, q) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b[Math.floor(q * (b.length - 1))]; };
function periodo(y, t) {
  const v = y.map((a) => (Number.isFinite(a) ? a : 0.5)), m = v.reduce((a, b) => a + b, 0) / v.length, z = v.map((a) => a - m);
  const dt = (t[t.length - 1] - t[0]) / (t.length - 1), lo = Math.round(0.8 / dt), hi = Math.min(Math.round(8 / dt), Math.floor(z.length / 2));
  let best = null, c0 = z.reduce((a, b) => a + b * b, 0) || 1;
  const ac = []; for (let k = lo; k <= hi; k++) { let s = 0; for (let i = 0; i + k < z.length; i++) s += z[i] * z[i + k]; ac[k] = s / c0; }
  for (let k = lo + 1; k < hi; k++) if (ac[k] > ac[k - 1] && ac[k] >= ac[k + 1] && ac[k] > 0.15) { best = k * dt; break; }
  return best;
}
function contar(x, t, bajo = 0.3, alto = 0.7, minT = 0.6) {
  const lo = pct(x, 0.05), hi = pct(x, 0.95), r = hi - lo; if (!(r > 0)) return { n: 0, q: 0 };
  const y = x.map((v) => (v - lo) / r);
  // ciclo: empieza en un extremo (el que mas tiempo ocupa = reposo) y cuenta cada ida y vuelta
  const tiempoAlto = y.filter((v) => v > 0.5).length / y.length, inv = tiempoAlto > 0.5;
  const z = inv ? y.map((v) => 1 - v) : y; // reposo abajo
  let estado = 0, reps = [], t0 = null;
  for (let i = 0; i < z.length; i++) {
    if (!Number.isFinite(z[i])) continue;
    if (estado === 0 && z[i] > alto) { estado = 1; t0 = t[i]; }
    else if (estado === 1 && z[i] < bajo) { estado = 0; reps.push([t0, t[i]]); }
  }
  // dos "reps" mas juntas que medio periodo son la misma rep (ruido): se fusionan
  const T = periodo(z, t);
  if (T) for (let k = reps.length - 1; k > 0; k--) if (reps[k][0] - reps[k - 1][0] < 0.55 * T) { reps[k - 1][1] = reps[k][1]; reps.splice(k, 1); }
  const durs = reps.map(([a, b]) => b - a), m = durs.reduce((a, b) => a + b, 0) / (durs.length || 1);
  const cv = durs.length > 1 ? Math.sqrt(durs.reduce((a, d) => a + (d - m) ** 2, 0) / durs.length) / m : 1;
  return { n: reps.length, q: reps.length >= 2 ? 1 / (0.2 + cv) : 0, reps };
}
let ok = 0, n = 0, err = 0; const filas = [];
for (const [nom, e] of Object.entries(et)) {
  if (!e.ej || e.omitir) continue;
  const f = `${B}/kp/${nom}.json.gz`; if (!fs.existsSync(f)) continue;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const t = d.frames.map((x) => x[0]), P = d.frames.map((x) => x[1]);
  let vl = 0, vr = 0; for (const p of P) if (p && p.length > 28) { vl += p[13][2] + p[15][2] + p[25][2] + p[27][2]; vr += p[14][2] + p[16][2] + p[26][2] + p[28][2]; }
  LADO = vl >= vr ? L : R;
  const fam = FAM(e.ej); let mejor = null; const det = [];
  for (const c of fam) {
    const x = suave(P.map((p) => { try { return p && p.length > 28 ? CAND[c](p) : NaN; } catch { return NaN; } }), 4);
    const r = contar(x, t); det.push(`${c}=${r.n}`);
    if (!mejor || r.q > mejor.q) mejor = { ...r, c };
  }
  const a = mejor ? mejor.n : 0; n++; if (a === e.reps) ok++; err += Math.abs(a - e.reps);
  filas.push(`${a === e.reps ? '✓' : '✗'} ${nom.padEnd(28)} ${e.ej.padEnd(22)} real=${e.reps} app=${a} [${mejor && mejor.c}] ${det.join(' ')}`);
}
console.log(filas.join('\n')); console.log(`\nACIERTOS ${ok}/${n}  error=${err}`);
