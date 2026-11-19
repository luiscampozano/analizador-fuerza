// v2.70.0 «Cómo se hace» con el muñeco de piezas (estilo mapa de músculos): reemplaza la figurita morada.
// Usa las mismas posturas de js/figura.js y los músculos de js/tarjetas.js (los del mapa de Estadísticas).
// - icono(id): miniatura quieta en 3D para listas (se dibuja cuando aparece en pantalla y se guarda en memoria).
// - demo(caja, ej): en Analizar, el muñeco 2D moviéndose (dos vistas) + músculos + botón «Ver en 3D».
// - vista3d(caja, ej) y abrirFicha(ej): el muñeco 3D que gira solo y se gira con el dedo.
// Todo se dibuja en <canvas>, sin internet y sin librerías.
import { T, articular, articularFrente, mezclar, suave, plantillaDe, accesorios } from './figura.js';
import { POR_EJ, POR_GRUPO, NOMBRES_MUSC } from './tarjetas.js';
import { POR_ID } from './ejercicios.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const COLP = '#FF6A2B', COLS = '#8B5CF6'; // principal (naranja) y secundario (morado), como el mapa de Estadísticas
const NIV = { 2: COLP, 1: COLS };
const C = { base2: '#2B2A3A', base2L: '#211F2D', brazo2: '#3B3A52', seam: '#0B0B12', base3: '#4A4960', metal: '#AEB4C2', disco: '#3F4454', mueble: '#34344A', cable: '#8E95A5' };

// ------------------------------------------------------------------ músculos del ejercicio
const MUSC_ZONAS = { quadriceps: ['cuadriceps'], calves: ['pantorrilla'], left_soleus: ['pantorrilla'], right_soleus: ['pantorrilla'], hamstring: ['femoral'],
  gluteal: ['gluteo'], abductor: ['abductor'], abductors: ['aductor'], lower_back: ['lumbar'], upper_back: ['dorsal'], trapezius: ['trapecio', 'trapecio_cuello'],
  chest: ['pecho'], front_deltoids: ['hombro'], back_deltoids: ['hombro'], biceps: ['biceps'], triceps: ['triceps'], forearm: ['antebrazo'], abs: ['abdomen'], obliques: ['oblicuo'] };
// zona: [pieza, s0, s1, lado, umbral]; lado f = adelante, b = atrás, t = toda, l = costados, m = hacia adentro, x = hacia afuera
const ZONA = {
  cuadriceps: ['muslo', 0.12, 0.95, 'f', 0.15], femoral: ['muslo', 0.15, 0.95, 'b', 0.25], aductor: ['muslo', 0, 0.65, 'm', 0.45], abductor: ['muslo', -0.02, 0.4, 'x', 0.3],
  gluteo: ['tronco', -0.05, 0.27, 'b', -0.15], lumbar: ['tronco', 0.22, 0.55, 'b', 0.35], dorsal: ['tronco', 0.5, 0.98, 'b', -0.2], trapecio: ['tronco', 0.85, 1.12, 'b', 0.2],
  trapecio_cuello: ['cuello', 0, 0.9, 'b', 0.1], abdomen: ['tronco', 0.15, 0.62, 'f', 0.45], oblicuo: ['tronco', 0.15, 0.6, 'l', 0.6], pecho: ['tronco', 0.68, 0.95, 'f', 0.3],
  pantorrilla: ['pierna', 0, 0.6, 'b', 0.1], biceps: ['brazo', 0.2, 0.85, 'f', 0.3], triceps: ['brazo', 0.15, 0.85, 'b', 0.3], antebrazo: ['antebrazo', 0, 0.65, 't', 0], hombro: ['deltoide', 0, 1, 't', 0],
};
export function musculosDe(ej) {
  const id = (ej && ej.id) || '', def = POR_ID[id] || ej || {}, grupo = def.musculo || def.grupo;
  const m = (POR_EJ.find(([re]) => re.test(id)) || [])[1] || POR_GRUPO[grupo] || { pri: [], sec: [] };
  const zonas = {};
  m.sec.forEach((k) => (MUSC_ZONAS[k] || []).forEach((z) => (zonas[z] = Math.max(zonas[z] || 0, 1))));
  m.pri.forEach((k) => (MUSC_ZONAS[k] || []).forEach((z) => (zonas[z] = 2)));
  const nombres = (l) => [...new Set(l.map((k) => NOMBRES_MUSC[k]).filter(Boolean))];
  const pri = nombres(m.pri), sec = nombres(m.sec).filter((n) => !pri.includes(n));
  return { zonas, pri, sec };
}

// ------------------------------------------------------------------ cuerpo en 3D a partir de las posturas 2D
// 3D: [adelante, arriba, lado]; lado + = lado cercano en la vista de perfil
function cuerpo3d(t, pose) {
  if (t.frente) {
    const j = articularFrente(pose), p = (q) => [0, -q[1], q[0]];
    const ld = j.lados.map((s) => ({ hom: p(s.Sh), codo: p(s.E), mano: p(s.M), cad: p(s.Hp), rod: p(s.K), tob: p(s.A), punta: [0.15, -s.A[1], s.A[0]] }));
    return { cad: p(j.H), hom: p(j.S), cab: p(j.cab), ld: [ld[1], ld[0]] };
  }
  const j = articular(pose), W = [0.19, -0.19], Wc = [0.1, -0.1], k = [1, -1], p = (q, z) => [q[0], -q[1], z];
  const ld = [0, 1].map((i) => ({ hom: p(j.S, W[i]), codo: p(j.braz[i][1], W[i] + k[i] * 0.02), mano: p(j.braz[i][2], W[i] + k[i] * 0.04), cad: p(j.H, Wc[i]), rod: p(j.pier[i][1], Wc[i]), tob: p(j.pier[i][2], Wc[i]), punta: p(j.pier[i][3], Wc[i]) }));
  let cad = p(j.H, 0), hom = p(j.S, 0), cab = p(j.cab, 0);
  if (t.pieFijo) { // v2.70.1 búlgara: el pie de atrás se queda apoyado en el banco (rodilla calculada)
    const alto = -Math.min(ld[0].tob[1], ld[0].punta[1]), sube = (q) => [q[0], q[1] + alto, q[2]]; // el pie de adelante toca el piso
    ld.forEach((d) => Object.keys(d).forEach((n) => (d[n] = sube(d[n])))); cad = sube(cad); hom = sube(hom); cab = sube(cab);
    const d = ld[1], [A, Pn] = t.pieFijo, H = d.cad, dx = A[0] - H[0], dy = A[1] - H[1], dist = Math.min(Math.hypot(dx, dy), 0.859) || 1e-6;
    const h = Math.sqrt(Math.max(0, 0.43 * 0.43 - (dist / 2) ** 2)), mx = H[0] + dx / 2, my = H[1] + dy / 2, nx = -dy / dist, ny = dx / dist;
    const k1 = [mx + nx * h, my + ny * h], k2 = [mx - nx * h, my - ny * h], K = k1[1] < k2[1] ? k1 : k2;
    d.rod = [K[0], K[1], d.cad[2]]; d.tob = [A[0], A[1], d.cad[2]]; d.punta = [Pn[0], Pn[1], d.cad[2]];
  }
  if (pose.abd) ld.forEach((d, i) => { // v2.70.1 abrir y cerrar las piernas sentado (máquina de aductores/abductores)
    const a = (pose.abd * Math.PI) / 180 * (i ? -1 : 1), c = Math.cos(a), s = Math.sin(a), H = d.cad;
    for (const n of ['rod', 'tob', 'punta']) { const q = d[n], dx = q[0] - H[0], dz = q[2] - H[2]; d[n] = [H[0] + dx * c - dz * s, q[1], H[2] + dx * s + dz * c]; }
  });
  return { cad, hom, cab, ld };
}
// cámara: psi = giro alrededor del eje vertical (0 de lado, 90 de frente), phi = mirar un poco desde arriba
function camara(psi, phi) {
  const cp = Math.cos(psi * Math.PI / 180), sp = Math.sin(psi * Math.PI / 180), cf = Math.cos(phi * Math.PI / 180), sf = Math.sin(phi * Math.PI / 180);
  return (q) => { const d = q[0] * sp + q[2] * cp; return [q[0] * cp - q[2] * sp, -(q[1] * cf - d * sf), d]; }; // [x, y (abajo +), profundidad (cerca +)]
}
// cortes de cada parte: [s (0 inicio, 1 final), ancho, adelante, atrás]
const FORMAS = {
  brazo: [[0, 0.072, 0.066, 0.066], [0.2, 0.066, 0.07, 0.068], [0.48, 0.058, 0.08, 0.064], [0.78, 0.047, 0.054, 0.054], [1, 0.042, 0.042, 0.044]],
  antebrazo: [[0, 0.045, 0.045, 0.045], [0.22, 0.055, 0.052, 0.05], [0.6, 0.038, 0.036, 0.036], [1, 0.03, 0.026, 0.026]],
  muslo: [[0, 0.094, 0.095, 0.095], [0.3, 0.095, 0.112, 0.094], [0.65, 0.075, 0.09, 0.074], [0.92, 0.056, 0.06, 0.052], [1, 0.054, 0.056, 0.05]],
  pierna: [[0, 0.054, 0.05, 0.05], [0.28, 0.06, 0.048, 0.08], [0.55, 0.048, 0.042, 0.058], [0.85, 0.034, 0.034, 0.034], [1, 0.032, 0.034, 0.034]],
  tronco: [[-0.04, 0.14, 0.09, 0.09], [0.08, 0.145, 0.1, 0.105], [0.3, 0.15, 0.105, 0.09], [0.55, 0.18, 0.115, 0.1], [0.78, 0.23, 0.14, 0.115], [0.94, 0.25, 0.12, 0.115], [1.03, 0.2, 0.085, 0.085], [1.1, 0.12, 0.07, 0.07]],
  cuello: [[0, 0.075, 0.06, 0.06], [1, 0.06, 0.055, 0.055]],
  pie: [[0, 0.035, 0.03, 0.035], [0.5, 0.042, 0.03, 0.03], [1, 0.03, 0.02, 0.02]],
  mano: [[0, 0.03, 0.025, 0.025], [0.6, 0.04, 0.025, 0.025], [1, 0.03, 0.02, 0.02]],
  deltoide: [[0, 0.04, 0.05, 0.05], [0.3, 0.085, 0.085, 0.085], [0.75, 0.075, 0.08, 0.075], [1, 0.03, 0.04, 0.04]],
  cabeza: [[0, 0.03, 0.03, 0.03], [0.18, 0.075, 0.08, 0.075], [0.5, 0.088, 0.095, 0.09], [0.82, 0.075, 0.08, 0.078], [1, 0.02, 0.02, 0.02]],
};
const cil = (r) => [[0, r, r, r], [1, r, r, r]];
const bola = (r) => [[0, r * 0.3, r * 0.3, r * 0.3], [0.2, r * 0.8, r * 0.8, r * 0.8], [0.5, r, r, r], [0.8, r * 0.8, r * 0.8, r * 0.8], [1, r * 0.3, r * 0.3, r * 0.3]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mas = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const pto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const n = Math.hypot(...a) || 1e-9; return a.map((x) => x / n); };
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tono = (h, k) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * k)))); return `rgb(${c})`; };
// "adelante" de cada hueso, estable aunque el hueso gire (piernas y brazos: rodilla y bíceps al frente; tronco: pecho)
function marco(nombre, u) {
  let f = /tronco|cuello|cabeza/.test(nombre) ? [u[1], -u[0], 0] : [-u[1], u[0], 0];
  f = mas(f, u, -pto(f, u));
  if (Math.hypot(...f) < 0.3) { f = mas([0, 0, 1], u, -u[2]); if (Math.hypot(...f) < 0.3) f = mas([1, 0, 0], u, -u[0]); }
  f = nrm(f); return [f, cruz(u, f)];
}
function anillo(A, u, f, s, c, n) {
  const [t, w, ad, at] = c, Cc = mas(A, u, t), o = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, cf = Math.cos(a), r = cf > 0 ? ad : at; o.push([0, 1, 2].map((k) => Cc[k] + f[k] * cf * r + s[k] * Math.sin(a) * w)); }
  return o;
}
function envolvente(P) { // casco convexo 2D
  const p = P.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// accesorios (banco, máquinas, barra fija): se leen del dibujo de figura.js y se vuelven cajas y tubos
const cacheProps = new Map();
function props3d(t) {
  if (cacheProps.has(t)) return cacheProps.get(t);
  const svg = accesorios(t), p = t.frente ? (x, y, z = 0) => [z, -y, x] : (x, y, z = 0) => [x, -y, z], cajas = [], tubos = [];
  for (const m of svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    const [x, y, w, h] = m.slice(1).map(Number), v = [];
    for (const z of [-0.2, 0.2]) for (const [a, b] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) v.push(p(a, b, z));
    cajas.push(v);
  }
  for (const m of svg.matchAll(/<path d="M([^"]+)"/g)) {
    const pts = m[1].split('L').map((q) => q.trim().split(/\s+/).map(Number));
    for (let i = 0; i < pts.length - 1; i++) tubos.push([p(...pts[i]), p(...pts[i + 1])]);
  }
  for (const m of svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)) { // ruedas de la bici
    const [cx, cy, r] = m.slice(1).map(Number);
    for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2; tubos.push([p(cx + r * Math.cos(a0), cy + r * Math.sin(a0)), p(cx + r * Math.cos(a1), cy + r * Math.sin(a1))]); }
  }
  const r = { cajas, tubos }; cacheProps.set(t, r); return r;
}

// todas las piezas (cuerpo, equipo y accesorios) de una postura
function piezas(t, pose, NC) {
  const C3 = cuerpo3d(t, pose), out = [], cajas = [];
  const pieza = (nombre, A, B, forma, extra = {}) => {
    const u0 = sub(B, A), L = Math.hypot(...u0) || 1e-6, u = u0.map((x) => x / L), [f, s] = marco(nombre, u);
    const anillos = forma.map((c) => ({ s: c[0], C: mas(A, u, c[0] * L), pts: anillo(A, u, f, s, [c[0] * L, c[1], c[2], c[3]], NC) }));
    out.push({ nombre, A, B, u, f, s, L, forma, anillos, ...extra });
  };
  const arriba = nrm(sub(C3.hom, C3.cad));
  C3.ld.forEach((d, i) => {
    const lado = { i, zs: d.cad[2] >= 0 ? 1 : -1 };
    pieza('muslo', d.cad, d.rod, FORMAS.muslo, lado);
    pieza('pierna', d.rod, d.tob, FORMAS.pierna, lado);
    pieza('pie', d.tob, d.punta, FORMAS.pie, lado);
    pieza('brazo', d.hom, d.codo, FORMAS.brazo, lado);
    pieza('antebrazo', d.codo, d.mano, FORMAS.antebrazo, lado);
    const dm = nrm(sub(d.mano, d.codo)); pieza('mano', d.mano, mas(d.mano, dm, 0.09), FORMAS.mano, lado);
    const db = nrm(sub(d.codo, d.hom)); pieza('deltoide', mas(d.hom, db, -0.07), mas(d.hom, db, 0.13), FORMAS.deltoide, lado);
  });
  pieza('tronco', C3.cad, C3.hom, FORMAS.tronco);
  pieza('cuello', C3.hom, mas(C3.hom, sub(C3.cab, C3.hom), 0.55), FORMAS.cuello);
  pieza('cabeza', mas(C3.cab, arriba, -0.11), mas(C3.cab, arriba, 0.12), FORMAS.cabeza);
  // equipo que se mueve con la persona
  const e = t.eq || '', eqp = (n, A, B, forma, color) => pieza(n, A, B, forma, { equipo: color });
  const m0 = t.frente ? C3.ld[1].mano : C3.ld[0].mano, m1 = t.frente ? C3.ld[0].mano : C3.ld[1].mano, medio = mas(m0, sub(m1, m0), 0.5);
  const barra = (c) => { eqp('barra', [c[0], c[1], -0.75], [c[0], c[1], 0.75], cil(0.014), C.metal); for (const z of [-1, 1]) eqp('disco', [c[0], c[1], z * 0.5], [c[0], c[1], z * 0.58], cil(0.2), C.disco); };
  const mancuerna = (m, eje) => { eqp('barra', mas(m, eje, -0.11), mas(m, eje, 0.11), cil(0.016), C.metal); for (const k of [-1, 1]) eqp('disco', mas(m, eje, k * 0.07), mas(m, eje, k * 0.12), cil(0.055), C.disco); };
  const cable = (a, b) => { eqp('barra', a, b, cil(0.007), C.cable); eqp('disco', mas(a, [0, 0, 1], -0.02), mas(a, [0, 0, 1], 0.02), cil(0.045), C.disco); };
  const ejeM = t.frente || t.neutro ? [1, 0, 0] : [0, 0, 1];
  if (t.uno && /^(barra_mano|barra_frente|mancuernas|mancuernas_frente|mancuerna_mano|mancuerna_frente)$/.test(e)) mancuerna(C3.ld[0].mano, ejeM); // v2.70.1 a un brazo: solo en la mano que trabaja
  else if (t.uno && e === 'barra_jalon') { const m = C3.ld[0].mano; eqp('barra', mas(m, [0, 0, 1], -0.07), mas(m, [0, 0, 1], 0.07), cil(0.02), C.metal); eqp('barra', m, [m[0], 2.3, m[2]], cil(0.007), C.cable); }
  else if (e === 'barra_mano' || e === 'barra_frente') barra([medio[0], medio[1]]);
  else if (e === 'barra_hombros') barra([C3.hom[0] - 0.05, C3.hom[1] + 0.02]);
  else if (e === 'barra_cadera') barra([C3.cad[0], C3.cad[1] + 0.12]);
  else if (e === 'barra_codos') { const c = mas(C3.ld[0].codo, sub(C3.ld[1].codo, C3.ld[0].codo), 0.5); barra([c[0], c[1]]); }
  else if (e === 'mancuernas' || e === 'mancuernas_frente') { mancuerna(m0, ejeM); mancuerna(m1, ejeM); }
  else if (e === 'mancuerna_mano') mancuerna([medio[0], medio[1], 0], [0, 1, 0]);
  else if (e === 'mancuerna_frente') mancuerna(m0, ejeM);
  else if (e === 'kb') eqp('disco', mas(m0, [0, -0.17, 0]), mas(m0, [0, -0.01, 0]), bola(0.09), C.disco);
  else if (e === 'balon') eqp('disco', mas(medio, [0, -0.06, 0]), mas(medio, [0, 0.18, 0]), bola(0.12), C.disco);
  else if (e === 'balon_piso') { const p = C3.ld[0].tob; eqp('disco', [p[0] + 0.12, 0, 0], [p[0] + 0.12, 0.22, 0], bola(0.11), C.disco); }
  else if (e === 'balon_fijo' && t.balon) eqp('disco', [t.balon[0], -t.balon[1] - 0.11, 0], [t.balon[0], -t.balon[1] + 0.11, 0], bola(0.11), C.disco);
  else if (e === 'rueda') { const c = mas(medio, [0, -0.1, 0]); eqp('disco', [c[0], c[1], -0.06], [c[0], c[1], 0.06], cil(0.1), C.disco); }
  else if (e === 'manijas') { for (const m of [m0, m1]) eqp('barra', mas(m, [0, 0, 1], -0.06), mas(m, [0, 0, 1], 0.06), cil(0.02), C.metal); }
  else if (e === 'barra_jalon') { eqp('barra', mas(m0, sub(m0, m1), 0.25), mas(m1, sub(m1, m0), 0.25), cil(0.014), C.metal); eqp('barra', medio, [medio[0], 2.3, medio[2]], cil(0.007), C.cable); }
  else if ((e === 'cable' || e === 'cable_pie') && t.ancla) { const p = e === 'cable_pie' ? C3.ld[1].tob : m0; cable([t.ancla[0], -t.ancla[1], p[2]], p); }
  else if (e === 'cable_frente') cable([0, 0.1, -0.7], m1);
  else if (e === 'cable_tobillo') cable([0, 0.05, -0.7], C3.ld[0].tob);
  else if (e === 'cables_frente') { cable([0, 1.9, -0.85], m0); cable([0, 1.9, 0.85], m1); }
  else if (e === 'landmine') eqp('barra', [-1.0, 0, 0], medio, cil(0.016), C.metal);
  const pr = props3d(t);
  for (const [a, b] of pr.tubos) eqp('mueble', a, b, cil(0.022), C.mueble);
  for (const v of pr.cajas) cajas.push(v);
  return { C3, out, cajas };
}
// ¿la cara (o el anillo) en la dirección v pertenece a la zona?
function enZona(pz, v, z) {
  const k = z[3], th = z[4];
  if (k === 't') return true;
  if (k === 'f') return pto(v, pz.f) >= th;
  if (k === 'b') return -pto(v, pz.f) >= th;
  if (k === 'l') return Math.abs(pto(v, pz.s)) >= th;
  const hacia = v[2] * (pz.zs || 1);
  return k === 'm' ? -hacia >= th : hacia >= th;
}
function nivelCara(pz, sm, v, zonas) {
  let n = 0;
  for (const [nombre, nv] of Object.entries(zonas)) {
    const z = ZONA[nombre]; if (!z || z[0] !== pz.nombre || sm < z[1] || sm > z[2] || nv <= n) continue;
    if (enZona(pz, v, z)) n = nv;
  }
  return n;
}
function sombra(g, P, cy0) { // sombra suave en el piso
  const a = P([-0.3, 0, 0]), b = P([0.3, 0, 0]), c = P([0, 0, -0.22]), d = P([0, 0, 0.22]);
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.max(Math.abs(b[0] - a[0]), Math.abs(d[0] - c[0])) / 2, ry = Math.max(3, Math.max(Math.abs(b[1] - a[1]), Math.abs(d[1] - c[1])) / 2);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, cy ?? cy0, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

// ------------------------------------------------------------------ dibujo 3D (caras con luz)
function dibujar3D(g, t, pose, psi, phi, zonas, caja, NC = 10) {
  const { out, cajas } = piezas(t, pose, NC), X = camara(psi, phi), [cx, cy, e] = caja(X), P = (q) => { const p = X(q); return [cx + p[0] * e, cy + p[1] * e, p[2]]; };
  const luz = nrm([-0.45, -0.65, 0.75]), caras = [], o0 = X([0, 0, 0]);
  const cara = (pts3, centro, color, n0) => {
    let n = n0 || cruz(sub(pts3[1], pts3[0]), sub(pts3[2], pts3[0]));
    if (Math.hypot(...n) < 1e-12 && pts3[3]) n = cruz(sub(pts3[2], pts3[1]), sub(pts3[3], pts3[1]));
    const cm = pts3.reduce((a, q) => mas(a, q, 1 / pts3.length), [0, 0, 0]);
    if (pto(n, sub(cm, centro)) < 0) n = n.map((x) => -x);
    const nn = sub(X(n), o0), nc = nrm(nn);
    if (nc[2] < -0.02) return; // de espaldas a la cámara
    const l = Math.max(0, pto(nc, luz)), p = pts3.map(P);
    caras.push({ p, z: p.reduce((a, q) => a + q[2], 0) / p.length, c: tono(color, 0.42 + 0.78 * l) });
  };
  for (const pz of out) {
    const R = pz.anillos;
    for (let j = 0; j < R.length - 1; j++) {
      const sm = (R[j].s + R[j + 1].s) / 2, ce = mas(R[j].C, R[j + 1].C).map((x) => x / 2);
      for (let i = 0; i < NC; i++) {
        const i2 = (i + 1) % NC, q = [R[j].pts[i], R[j].pts[i2], R[j + 1].pts[i2], R[j + 1].pts[i]];
        const nv = pz.equipo ? 0 : nivelCara(pz, sm, nrm(sub(q.reduce((a, x) => mas(a, x, 0.25), [0, 0, 0]), ce)), zonas);
        cara(q, ce, pz.equipo || (nv ? NIV[nv] : C.base3));
      }
    }
    cara(R[0].pts.slice(), mas(R[0].C, pz.u, 0.05), pz.equipo || C.base3);
    cara(R[R.length - 1].pts.slice(), mas(R[R.length - 1].C, pz.u, -0.05), pz.equipo || C.base3);
  }
  for (const v of cajas) {
    const ce = v.reduce((a, q) => mas(a, q, 1 / 8), [0, 0, 0]);
    for (const f of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) cara(f.map((k) => v[k]), ce, C.mueble);
  }
  sombra(g, P);
  caras.sort((a, b) => a.z - b.z);
  g.lineJoin = 'round';
  for (const c of caras) {
    g.beginPath(); c.p.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
    g.fillStyle = c.c; g.fill(); g.strokeStyle = c.c; g.lineWidth = 0.8; g.stroke();
    g.strokeStyle = 'rgba(8,8,14,.28)'; g.lineWidth = 0.7; g.stroke();
  }
}

// ------------------------------------------------------------------ dibujo 2D plano (como el mapa de músculos)
function dibujar2D(g, t, pose, psi, zonas, caja, phi = 0) {
  const NC = 16, { C3, out, cajas } = piezas(t, pose, NC), X = camara(psi, phi), [cx, cy, e] = caja(X), P = (q) => { const p = X(q); return [cx + p[0] * e, cy + p[1] * e]; };
  const zl = [0, 1].map((i) => (X(C3.ld[i].hom)[2] + X(C3.ld[i].cad)[2]) / 2), lejos = (i) => i !== undefined && zl[i] < zl[1 - i] - 1e-3;
  const vista = (d) => X(d)[2] - X([0, 0, 0])[2], capas = [];
  for (const v of cajas) capas.push({ z: v.reduce((a, q) => a + X(q)[2], 0) / 8 - 0.3, pts: envolvente(v.map(P)), c: C.mueble });
  for (const pz of out) {
    const zc = (X(pz.A)[2] + X(pz.B)[2]) / 2 + ({ deltoide: 0.02, antebrazo: 0.012, mano: 0.012, brazo: 0.01 }[pz.nombre] || 0);
    const R = pz.anillos, base = pz.equipo || (lejos(pz.i) ? C.base2L : /brazo|mano|deltoide/.test(pz.nombre) && pz.i !== undefined ? C.brazo2 : C.base2), a = pz.nombre === 'disco' && pz.forma[1][1] > 0.1 ? 0.3 : 1;
    for (let j = 0; j < R.length - 1; j++) capas.push({ z: zc + j * 1e-5, pts: envolvente(R[j].pts.concat(R[j + 1].pts).map(P)), c: base, a });
    if (pz.equipo) continue;
    for (const [nombre, nv] of Object.entries(zonas)) { // músculo: medio anillo hacia su lado, si mira a la cámara
      const z = ZONA[nombre]; if (!z || z[0] !== pz.nombre) continue;
      const fm = pz.forma.filter((c) => c[0] >= z[1] - 0.01 && c[0] <= z[2] + 0.01); if (fm.length < 2) continue;
      const k = z[3], dirs = k === 'f' ? [pz.f] : k === 'b' ? [pz.f.map((x) => -x)] : k === 'l' ? [pz.s, pz.s.map((x) => -x)] : k === 'm' || k === 'x' ? [nrm(mas([0, 0, (k === 'm' ? -1 : 1) * (pz.zs || 1)], pz.u, -pz.u[2] * (k === 'm' ? -1 : 1) * (pz.zs || 1)))] : [null];
      for (const d of dirs) {
        if (d && (Math.hypot(...d) < 0.5 || vista(d) < -0.05)) continue;
        const f2 = d || pz.f, s2 = cruz(pz.u, f2), lat = k === 'l' || k === 'm' || k === 'x';
        const cortes = fm.map((c) => anillo(pz.A, pz.u, f2, s2, [c[0] * pz.L, (lat ? (c[2] + c[3]) / 2 : c[1]) * 0.78, (lat ? c[1] : k === 'b' ? c[3] : c[2]) * 0.96, d ? 0.01 : c[3] * 0.96], NC).map(P));
        const col = lejos(pz.i) ? tono(NIV[nv], 0.72) : NIV[nv], zz = zc + (pz.nombre === 'tronco' && k === 'b' ? 0.15 : 0.0009);
        for (let j = 0; j < cortes.length - 1; j++) capas.push({ z: zz + j * 1e-6, pts: envolvente(cortes[j].concat(cortes[j + 1])), c: col });
      }
    }
  }
  sombra(g, (q) => { const p = P(q); return p; });
  capas.sort((a, b) => a.z - b.z);
  g.lineJoin = 'round'; g.lineWidth = Math.max(1.4, e * 0.007);
  for (const c of capas) {
    g.beginPath(); c.pts.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
    g.globalAlpha = c.a || 1; g.fillStyle = c.c; g.fill(); g.strokeStyle = C.seam; g.stroke(); g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ posturas en el tiempo y encuadre
const muestras = (t) => (t.cuadros ? t.cuadros : [0, 0.25, 0.5, 0.75, 1].map((k) => mezclar(t.A, t.B, k)));
function fase(ms) { const c = (ms / 3600) % 1; if (c < 0.12) return 0; if (c < 0.5) return suave((c - 0.12) / 0.38); if (c < 0.6) return 1; return 1 - suave((c - 0.6) / 0.4); }
function poseEn(t, ms) {
  if (!t.cuadros) return mezclar(t.A, t.B, fase(ms));
  const c = t.cuadros, m = c.length, tramos = t.ciclo ? m : m - 1;
  let u = (ms / (t.ciclo ? 1400 : 3600)) % 1; if (!t.ciclo) u = u < 0.5 ? u * 2 : 2 - u * 2;
  const x = Math.min(u * tramos, tramos - 1e-6), i = Math.floor(x);
  return mezclar(c[i % m], c[(i + 1) % m], suave(x - i));
}
const poseMini = (t) => (t.cuadros ? t.cuadros[t.mini ?? Math.floor(t.cuadros.length / 2)] : mezclar(t.A, t.B, t.mini ?? 0.75));
// puntos que deben entrar en el cuadro (cuerpo de todas las posturas, equipo y accesorios)
function puntos(t, poses) {
  const pts = [];
  for (const ps of poses) {
    const { C3, out, cajas } = piezas(t, ps, 4);
    pts.push(C3.cab, mas(C3.cab, [0, 0.13, 0]), C3.hom, ...C3.ld.flatMap((s) => Object.values(s)));
    for (const pz of out) if (pz.equipo) { const r = pz.forma[1][1]; pts.push(...pz.anillos.flatMap((a) => (r > 0.03 ? a.pts : [a.C]))); }
    cajas.forEach((v) => pts.push(...v));
  }
  return pts;
}
function encuadre(pts, W, H, margen = 0.08) {
  return (X) => {
    const q = pts.map(X), x0 = Math.min(...q.map((p) => p[0])) - 0.08, x1 = Math.max(...q.map((p) => p[0])) + 0.08, y0 = Math.min(...q.map((p) => p[1])) - 0.06, y1 = Math.max(...q.map((p) => p[1])) + 0.05;
    const e = Math.min(W * (1 - margen) / (x1 - x0), H * (1 - margen) / (y1 - y0));
    return [W / 2 - ((x0 + x1) / 2) * e, H / 2 - ((y0 + y1) / 2) * e, e];
  };
}
// 3D: la escala es la que cabe en cualquier ángulo, para que el muñeco no cambie de tamaño al girar
function encuadreFijo(pts, W, H, phi) {
  const f = encuadre(pts, W, H, 0.1); let e = Infinity;
  for (let p = 0; p < 360; p += 30) e = Math.min(e, f(camara(p, phi))[2]);
  return (X) => { const [cx, cy, e0] = f(X), k = e / e0; return [W / 2 + (cx - W / 2) * k, H / 2 + (cy - H / 2) * k, e]; };
}

// ------------------------------------------------------------------ lienzos y animación
const quieto = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
function preparar(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!r.width || !r.height) return null;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, W: r.width, H: r.height };
}
const vivos = new Set();
const fichaAbierta = () => { const m = document.getElementById('mu-modal'); return !!(m && m.style.display !== 'none'); };
let corriendo = false, antes = 0;
const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((ents) => { for (const en of ents) { const o = en.target._mu; if (!o) continue; if (!en.target.isConnected) { vivos.delete(o); io.unobserve(en.target); continue; } o.vis = en.isIntersecting; } arrancar(); }) : null;
function arrancar() { if (!corriendo && [...vivos].some((o) => o.vis)) { corriendo = true; requestAnimationFrame(cuadro); } }
function cuadro(ms) {
  const dt = Math.min(50, ms - antes); antes = ms;
  let alguno = false;
  for (const o of vivos) {
    if (!o.cv.isConnected) { vivos.delete(o); if (io) io.unobserve(o.cv); continue; }
    if (!o.vis || (fichaAbierta() && !o.cv.closest('#mu-modal'))) continue;
    alguno = true; o.dibujar(quieto() ? 1400 : ms, dt);
  }
  corriendo = alguno && !quieto();
  if (corriendo) requestAnimationFrame(cuadro);
}
function registrar(cv, hacer) {
  const o = { cv, vis: !io, dibujar: null };
  let ctx = null;
  o.dibujar = (ms, dt) => {
    if (!ctx || o.medir) { o.medir = false; const n = preparar(cv); if (!n) return; if (!ctx || n.W !== ctx.W || n.H !== ctx.H || !o.listo) o.listo = hacer(n); ctx = n; }
    if (!o.listo) return;
    ctx.g.clearRect(0, 0, ctx.W, ctx.H); o.listo(ctx.g, ms, dt);
  };
  cv._mu = o; vivos.add(o); if (io) io.observe(cv);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { o.medir = true; }).observe(cv);
  arrancar();
  return o;
}
function vistaPlana(cv, t, psi, zonas, phi = 0) {
  registrar(cv, ({ W, H }) => { const caja = encuadre(puntos(t, muestras(t)), W, H); return (g, ms) => dibujar2D(g, t, poseEn(t, ms), psi, zonas, caja, phi); });
}
function vistaGiro(cv, t, zonas) {
  const phi = 14, est = { giro: 35, arr: null, ult: 0 };
  cv.addEventListener('pointerdown', (e) => { est.arr = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } });
  cv.addEventListener('pointermove', (e) => { if (est.arr == null) return; est.giro += (e.clientX - est.arr) * 0.6; est.arr = e.clientX; est.ult = performance.now(); if (quieto()) cv._mu.dibujar(1400, 0); });
  const soltar = () => { est.arr = null; est.ult = performance.now(); };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
  registrar(cv, ({ W, H }) => {
    const caja = encuadreFijo(puntos(t, muestras(t)), W, H, phi);
    return (g, ms, dt) => { if (!quieto() && est.arr == null && ms - est.ult > 2500) est.giro += dt * 0.012; dibujar3D(g, t, poseEn(t, ms), est.giro, phi, zonas, caja); };
  });
}
// v2.70.1 plantillas propias del muñeco (sentado abriendo/cerrando piernas) y ajustes de las de figura.js
const SENTADO = { H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, 0]], brazos: [[30, 30]] };
const PROPIAS = {
  aductores: { A: { ...SENTADO, abd: 40 }, B: { ...SENTADO, abd: 6 }, props: ['asiento'], vistas: [[90, 'De frente', 40], [35, 'A 45°', 25]] },
  abductores: { A: { ...SENTADO, abd: 6 }, B: { ...SENTADO, abd: 40 }, props: ['asiento'], vistas: [[90, 'De frente', 40], [35, 'A 45°', 25]] },
};
const AJUSTES = {
  bulgara: { pieFijo: [[-0.6, 0.6], [-0.74, 0.52]], neutro: true }, bulgara_barra: { pieFijo: [[-0.6, 0.6], [-0.74, 0.52]] },
  sentadilla_mancuernas: { neutro: true }, zancada: { neutro: true }, step_up: { neutro: true }, pantorrilla_libre: { neutro: true }, rumano_mancuernas: { neutro: true },
};
// ejercicio a un brazo o a una pierna con plantilla de los dos lados: el lado de atrás se queda quieto
function unLado(t) {
  if (!t.A || !t.B) return t;
  const cambia = (k) => JSON.stringify(t.A[k]) !== JSON.stringify(t.B[k]), k = cambia('piernas') ? 'piernas' : cambia('brazos') ? 'brazos' : null;
  if (!k || !t.A[k] || t.A[k].length !== 1 || t.B[k].length !== 1) return t;
  // de lado se queda quieto el de atrás (índice 1); de frente el índice 0, que es el que queda atrás en 3D
  const a = t.A[k][0], b = t.B[k][0], uno = k === 'brazos';
  return t.frente ? { ...t, uno, A: { ...t.A, [k]: [a, a] }, B: { ...t.B, [k]: [a, b] } } : { ...t, uno, A: { ...t.A, [k]: [a, a] }, B: { ...t.B, [k]: [b, a] } };
}
const cachePl = new Map();
const plantilla = (id) => {
  if (!id) return null;
  if (cachePl.has(id)) return cachePl.get(id);
  const n = plantillaDe(id); let t = n ? PROPIAS[n] || T[n] || null : null;
  if (t && AJUSTES[n]) t = { ...t, ...AJUSTES[n] };
  const def = POR_ID[id];
  if (t && def && def.unilateral && !PROPIAS[n]) t = unLado(t);
  cachePl.set(id, t); return t;
};
export const tieneMuneco = (id) => !!(id && plantilla(id));

// ------------------------------------------------------------------ miniaturas para listas
const cacheMini = new Map(), cola = [];
let colaActiva = false;
function mini(id) {
  if (cacheMini.has(id)) return cacheMini.get(id);
  const t = plantilla(id); if (!t) return '';
  const S = 112, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d'), pose = poseMini(t), { zonas } = musculosDe({ id });
  const pts = puntos(t, [pose]), caja = (X) => { const [cx, cy, e] = encuadre(pts, S, S, 0.04)(X); return [cx, cy, e]; };
  try { dibujar3D(g, t, pose, 32, 10, zonas, caja, 8); } catch (e) { /* nada */ }
  const url = cv.toDataURL('image/png'); cacheMini.set(id, url); return url;
}
function atenderCola() {
  colaActiva = true;
  const fin = performance.now() + 12;
  while (cola.length && performance.now() < fin) { const im = cola.shift(); if (im.isConnected && !im.getAttribute('src')) im.src = mini(im.dataset.mu); }
  if (cola.length) requestAnimationFrame(atenderCola); else colaActiva = false;
}
const ioMini = typeof IntersectionObserver === 'function' ? new IntersectionObserver((ents) => {
  for (const en of ents) { if (!en.target.isConnected) { ioMini.unobserve(en.target); continue; } if (en.isIntersecting) { ioMini.unobserve(en.target); cola.push(en.target); } }
  if (cola.length && !colaActiva) requestAnimationFrame(atenderCola);
}, { rootMargin: '200px' }) : null;
function vigilar(raiz) {
  raiz.querySelectorAll('img[data-mu]:not([src])').forEach((im) => {
    if (cacheMini.has(im.dataset.mu)) im.src = cacheMini.get(im.dataset.mu);
    else if (ioMini) ioMini.observe(im); else im.src = mini(im.dataset.mu);
  });
}
if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
  const mo = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) vigilar(n.matches && n.matches('img[data-mu]') ? n.parentNode || n : n); });
  const empezar = () => { mo.observe(document.body, { childList: true, subtree: true }); vigilar(document.body); };
  if (document.body) empezar(); else document.addEventListener('DOMContentLoaded', empezar);
}
// icono para listas: el muñeco si el ejercicio lo tiene; si no, el emoji de siempre
export const icono = (id, emoji = '🏋️') => (tieneMuneco(id) ? `<span class="fig-mini"><img class="mu-mini" data-mu="${esc(id)}" alt=""></span>` : emoji);

// ------------------------------------------------------------------ cajas de la app
function chips({ pri, sec }) {
  return `<div class="mu-chips">${pri.map((n) => `<b class="mu-p">${esc(n)}</b>`).join('')}${sec.map((n) => `<b class="mu-s">${esc(n)}</b>`).join('')}</div>`;
}
const LEYENDA = '<div class="mu-ley"><span><i class="mu-p"></i>Principal</span><span><i class="mu-s"></i>Secundario</span></div>';
// segunda vista del 2D: de frente si está de pie; a 45° si está acostado o en el suelo (de frente no se entiende)
function vistas2d(t) {
  if (t.vistas) return t.vistas;
  if (t.frente) return [[90, 'De frente'], [0, 'De lado']];
  const p = t.A || t.cuadros[0], acostado = Math.abs(p.tau || 0) > 50 || p.suelo === false;
  return [[0, 'De lado'], acostado ? [45, 'A 45°'] : [90, 'De frente']];
}
// Analizar: muñeco 2D moviéndose (dos vistas), músculos y botón para la ficha 3D. Devuelve false si no hay muñeco.
export function demo(caja, ej) {
  const t = ej && plantilla(ej.id);
  if (!t) { caja.innerHTML = ''; return false; }
  const m = musculosDe(ej), vs = vistas2d(t);
  caja.innerHTML = `<div class="mu-caja"><b class="mu-tit">📖 Cómo se hace</b>
    <div class="mu-vistas">${vs.map(([, n]) => `<div class="mu-v"><canvas role="img" aria-label="${esc(ej.nombre || '')}, ${n}"></canvas><span>${n}</span></div>`).join('')}</div>
    ${m.pri.length ? LEYENDA : ''}${chips(m)}<button type="button" class="btn-sec mu-ver">🔄 Ver en 3D</button></div>`;
  caja.querySelectorAll('canvas').forEach((cv, i) => vistaPlana(cv, t, vs[i][0], m.zonas, vs[i][2] || 0));
  caja.querySelector('.mu-ver').onclick = () => abrirFicha(ej);
  return true;
}
// muñeco 3D que gira (ficha del ejercicio)
export function vista3d(caja, ej, conMusculos = true) {
  const t = ej && plantilla(ej.id);
  if (!t) { caja.innerHTML = ''; return false; }
  const m = musculosDe(ej);
  caja.innerHTML = `<div class="mu-3d"><canvas role="img" aria-label="${esc(ej.nombre || 'Ejercicio')} en 3D"></canvas></div><p class="mu-gira">☝️ Gira solo; arrástralo para verlo desde otro lado</p>${conMusculos && m.pri.length ? LEYENDA + chips(m) : ''}`;
  vistaGiro(caja.querySelector('canvas'), t, m.zonas);
  return true;
}
export function abrirFicha(ej) {
  const md = document.getElementById('mu-modal'); if (!md) return;
  const def = POR_ID[ej.id] || ej;
  document.getElementById('mu-titulo').textContent = def.nombre || ej.nombre || 'Ejercicio';
  document.getElementById('mu-sub').textContent = [def.equipo, def.grupo].filter(Boolean).join(' · ');
  volverA = document.activeElement;
  md.style.display = 'flex';
  vista3d(document.getElementById('mu-cuerpo'), def);
  const pasos = def.pasos || [];
  document.getElementById('mu-pasos').innerHTML = pasos.length ? `<ol class="mu-pasos">${pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''; // etapa 3: pasos de cada ejercicio
  document.getElementById('mu-cerrar').focus();
}
let volverA = null;
if (typeof document !== 'undefined') {
  const iniciar = () => {
    const b = document.getElementById('mu-cerrar'), md = document.getElementById('mu-modal');
    if (!b || !md) return;
    b.onclick = () => { md.style.display = 'none'; document.getElementById('mu-cuerpo').innerHTML = ''; if (volverA && volverA.isConnected) try { volverA.focus(); } catch (e) { /* nada */ } arrancar(); };
    md.addEventListener('click', (e) => { if (e.target === md) b.click(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && md.style.display !== 'none') b.click(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
}
export const miniaturaURL = (id) => (tieneMuneco(id) ? mini(id) : ''); // imagen fija (también para pruebas)
