// Prueba del motor de cardio/boxeo con esqueletos sinteticos de valores conocidos (sin videos).
// Uso: node pruebas/actividad/sinteticos.mjs
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
const FPS = 30, DUR = 20, H = 1000; // la persona mide ~1000 px de alto en el video, estatura 1,70 m
const px = H / 1.7; // pixeles por metro
let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
const ruido = (v) => v + 2 * rnd();
function cuerpo(f) { // f(t) -> { j: {indice: [x, y]} }
  const frames = [];
  for (let k = 0; k < DUR * FPS; k++) {
    const t = k / FPS, j = f(t), puntos = [];
    for (let i = 0; i < 33; i++) { const p = j[i] || j[0]; puntos.push([ruido(p[0]), ruido(p[1]), 0.95]); }
    frames.push({ t, puntos });
  }
  return frames;
}
const torso = 0.30 * 1.7 * px; // 153 px
// --- carrera: 170 pasos/min, rebote 8 cm, tronco 8° adelante, pie cae 25 cm delante de la cadera
function carrera(t) {
  const f = 170 / 60 / 2, w = 2 * Math.PI * f, cx = 500, hipY = 500 + 0.04 * px * Math.cos(2 * w * t);
  const lean = 8 * Math.PI / 180, sh = [cx + torso * Math.sin(lean), hipY - torso * Math.cos(lean)];
  const sw = 0.25 * px, a1 = [cx + sw * Math.sin(w * t), hipY + 0.5 * px], a2 = [cx - sw * Math.sin(w * t), hipY + 0.5 * px];
  const j = { 0: [sh[0] + 20, sh[1] - 60], 11: sh, 12: sh, 13: [sh[0], sh[1] + 70], 14: [sh[0], sh[1] + 70], 15: [sh[0] + 30, sh[1] + 120], 16: [sh[0] + 30, sh[1] + 120],
    23: [cx, hipY], 24: [cx, hipY], 25: [(cx + a1[0]) / 2 + 20, hipY + 0.25 * px], 26: [(cx + a2[0]) / 2 + 20, hipY + 0.25 * px], 27: a1, 28: a2,
    29: [a1[0] - 15, a1[1]], 30: [a2[0] - 15, a2[1]], 31: [a1[0] + 25, a1[1] + 5], 32: [a2[0] + 25, a2[1] + 5] };
  return j;
}
// --- bici: 90 RPM; el pie gira en un circulo; rodilla por cinematica inversa (muslo y pierna 0,25 m... en px)
function bici(t) {
  const w = 2 * Math.PI * 90 / 60, hip = [500, 400], crank = [560, 400 + 0.62 * px], r = 0.17 * px, th = 0.43 * px, sh = 0.43 * px;
  const pie = [crank[0] + r * Math.cos(w * t), crank[1] + r * Math.sin(w * t)];
  const d = Math.hypot(pie[0] - hip[0], pie[1] - hip[1]), a = (th * th - sh * sh + d * d) / (2 * d), h = Math.sqrt(Math.max(0, th * th - a * a));
  const ux = (pie[0] - hip[0]) / d, uy = (pie[1] - hip[1]) / d, rod = [hip[0] + a * ux + h * uy, hip[1] + a * uy - h * ux];
  const hom = [hip[0] + torso * 0.7, hip[1] - torso * 0.7];
  return { 0: [hom[0] + 30, hom[1] - 50], 11: hom, 12: hom, 13: [hom[0] + 60, hom[1] + 60], 14: [hom[0] + 60, hom[1] + 60], 15: [hom[0] + 130, hom[1] + 90], 16: [hom[0] + 130, hom[1] + 90],
    23: hip, 24: hip, 25: rod, 26: rod, 27: pie, 28: pie, 29: [pie[0] - 10, pie[1]], 30: [pie[0] - 10, pie[1]], 31: [pie[0] + 20, pie[1]], 32: [pie[0] + 20, pie[1]] };
}
// --- remo: 24 remadas/min, empuje 0,8 s y recuperacion 1,7 s (2,1 : 1)
function remo(t) {
  const T = 2.5, dr = 0.8, u = t % T; // fase
  const leg = u < dr ? Math.min(1, u / (dr * 0.7)) : 1 - (u - dr) / (T - dr); // piernas: 0 recogidas -> 1 estiradas
  const arm = u < dr ? Math.max(0, (u - dr * 0.7) / (dr * 0.3)) : Math.max(0, 1 - (u - dr) / 0.4); // brazos al final
  const pies = [800, 600], seat = [pies[0] - (0.35 + 0.5 * leg) * px, 600];
  const kAng = (60 + 110 * leg) * Math.PI / 180; // rodilla 60 -> 170
  const rod = [seat[0] + 0.43 * px * Math.cos(-(Math.PI - kAng) / 2), seat[1] - 0.43 * px * Math.sin((Math.PI - kAng) / 2)];
  const back = (-25 + 45 * (u < dr ? Math.max(0, (u - dr * 0.4) / (dr * 0.6)) : Math.max(0, 1 - (u - dr) / 0.6))) * Math.PI / 180; // -25 adelante -> +20 atras
  const hom = [seat[0] - torso * Math.sin(back), seat[1] - torso * Math.cos(back)];
  const codo = [hom[0] + 0.3 * px * (1 - arm), hom[1] + 0.25 * px * (0.4 + 0.6 * arm)], mun = [codo[0] + 0.28 * px * (1 - 1.6 * arm), codo[1] + 0.05 * px];
  return { 0: [hom[0] + 20, hom[1] - 50], 11: hom, 12: hom, 13: codo, 14: codo, 15: mun, 16: mun, 23: seat, 24: seat, 25: rod, 26: rod, 27: pies, 28: pies,
    29: [pies[0] - 10, pies[1]], 30: [pies[0] - 10, pies[1]], 31: [pies[0] + 20, pies[1] - 10], 32: [pies[0] + 20, pies[1] - 10] };
}
// --- cuerda: 120 saltos/min, 4 cm de altura
function cuerda(t) {
  const w = 2 * Math.PI * 2, y = -0.04 * px * Math.max(0, Math.sin(w * t)), cx = 500;
  return { 0: [cx, 150 + y], 11: [cx - 60, 250 + y], 12: [cx + 60, 250 + y], 13: [cx - 80, 400 + y], 14: [cx + 80, 400 + y], 15: [cx - 100, 520 + y], 16: [cx + 100, 520 + y],
    23: [cx - 40, 250 + torso + y], 24: [cx + 40, 250 + torso + y], 25: [cx - 40, 800 + y], 26: [cx + 40, 800 + y], 27: [cx - 40, 1050 + y], 28: [cx + 40, 1050 + y],
    29: [cx - 50, 1055 + y], 30: [cx + 30, 1055 + y], 31: [cx - 20, 1060 + y], 32: [cx + 60, 1060 + y] };
}
// --- boxeo: 30 golpes (15 con cada mano, alternados), 90 golpes/min, rectos
function boxeo(t) {
  const per = 60 / 90, k = Math.floor(t / per), u = (t % per) / per, ext = u < 0.4 ? Math.sin(Math.PI * u / 0.4) : 0, mano = k % 2;
  const hom = [500, 300], hom2 = [520, 300], brazo = 0.6 * px;
  const pun = (h, e) => { const largo = brazo * (0.35 + 0.65 * e); return [[h[0] + largo * 0.5, h[1] + 60 * (1 - e)], [h[0] + largo, h[1] - 40 * (1 - e)]]; };
  const [c1, m1] = pun(hom, mano === 0 ? ext : 0), [c2, m2] = pun(hom2, mano === 1 ? ext : 0);
  return { 0: [510, 230], 11: hom, 12: hom2, 13: c1, 14: c2, 15: m1, 16: m2, 23: [490, 453], 24: [510, 453], 25: [480, 700], 26: [530, 700], 27: [470, 950], 28: [540, 950],
    29: [460, 955], 30: [530, 955], 31: [490, 960], 32: [560, 960] };
}
// --- burpees: 15 por minuto (cadera baja al piso y vuelve)
function burpees(t) {
  const per = 4, u = (t % per) / per, abajo = u < 0.6 ? Math.sin(Math.PI * u / 0.6) : 0, cx = 500;
  const hipY = 403 + 400 * abajo;
  return { 0: [cx, 150 + 600 * abajo], 11: [cx - 60, 250 + 550 * abajo], 12: [cx + 60, 250 + 550 * abajo], 13: [cx - 80, 350 + 450 * abajo], 14: [cx + 80, 350 + 450 * abajo], 15: [cx - 100, 420 + 450 * abajo], 16: [cx + 100, 420 + 450 * abajo],
    23: [cx - 40, hipY], 24: [cx + 40, hipY], 25: [cx - 40, 650 + 200 * abajo], 26: [cx + 40, 650 + 200 * abajo], 27: [cx - 40, 900], 28: [cx + 40, 900], 29: [cx - 50, 905], 30: [cx + 30, 905], 31: [cx - 20, 910], 32: [cx + 60, 910] };
}
// angulo de rodilla abajo calculado con la misma geometria (referencia exacta)
const REF = {}; { let mx = 0; for (let k = 0; k < 300; k++) { const j = bici(k / 300); const a = j[23], b = j[25], c = j[27];
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]]; mx = Math.max(mx, Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / Math.hypot(...v1) / Math.hypot(...v2)) * 180 / Math.PI); } REF.rodillaBici = mx; }
const CASOS = [
  ['cinta', carrera, { Cadencia: 170, Rebote: 8, Tronco: 8, Pasos: 170 / 60 * DUR }],
  ['bicicleta_estatica', bici, { Cadencia: 90, Pedaladas: 90 / 60 * DUR, 'Rodilla abajo': REF.rodillaBici }],
  ['remo_ergometro', remo, { Ritmo: 24, Remadas: 24 / 60 * DUR }],
  ['saltar_cuerda', cuerda, { Ritmo: 120, Saltos: 120 / 60 * DUR, 'Altura de salto': 4 }],
  ['boxeo', boxeo, { Golpes: 90 / 60 * DUR, Ritmo: 90 }],
  ['burpees', burpees, { Ritmo: 15, Burpees: 15 / 60 * DUR }],
];
let fallos = 0;
for (const [id, f, esperado] of CASOS) {
  const a = analizarActividad(cuerpo(f), DUR, POR_ID[id], { altura: 1.7 });
  const linea = a.kpis.map((k) => `${k.label}=${k.valor}`).join(' · ');
  const errores = [];
  for (const [nom, v] of Object.entries(esperado)) {
    const k = a.kpis.find((x) => x.label === nom); const val = k ? parseFloat(String(k.valor)) : NaN;
    const tol = /Pasos|Pedaladas|Remadas|Saltos|Golpes|Burpees/.test(nom) ? 2 : Math.max(2, 0.08 * v);
    if (!(Math.abs(val - v) <= tol)) errores.push(`${nom}: ${val} (esperado ~${Math.round(v * 10) / 10})`);
  }
  if (errores.length) fallos++;
  console.log(`${errores.length ? 'FAIL' : 'OK  '} ${id.padEnd(20)} ${linea}${errores.length ? '\n     → ' + errores.join(' | ') : ''}`);
  for (const x of a.alertas) console.log(`       ${x.nivel === 'ok' ? '✓' : '⚠'} ${x.texto}`);
}
console.log(fallos ? `\n${fallos} caso(s) fuera de lo esperado` : '\nTodos los casos dentro de lo esperado');
