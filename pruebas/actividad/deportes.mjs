// Prueba de los deportes (v2.35.0) con esqueletos sinteticos de velocidad conocida: patada, remate de voley, golpe de
// raqueta, tiro de basquet y natacion vista desde fuera de la piscina. Tambien prueba la IA del balon con un balon
// sintetico de velocidad conocida. Uso: node pruebas/actividad/deportes.mjs
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
const FPS = 60, px = 1000 / 1.7, torso = 0.30 * 1.7 * px; // la persona mide ~1000 px (1,70 m)
let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
function cuerpo(f, dur, vis = () => 0.95) {
  const frames = [];
  for (let k = 0; k < dur * FPS; k++) {
    const t = k / FPS, j = f(t), puntos = [];
    for (let i = 0; i < 33; i++) { const p = j[i] || j[0]; puntos.push([p[0] + 1.5 * rnd(), p[1] + 1.5 * rnd(), vis(i)]); }
    frames.push({ t, puntos });
  }
  return frames;
}
const rad = Math.PI / 180;
// persona de pie, de lado, mirando a la derecha; cadera en (cx, hy). piernaD/brazoD: angulos (desde la vertical hacia
// abajo, + hacia adelante) de la pierna y el brazo derechos; brazoD se mide desde la vertical HACIA ARRIBA si arriba=true
function persona({ cx = 500, hy = 600, piernaD = 0, brazoD = null, arriba = false, munD = null, codD = null }) {
  const hom = [cx + 10, hy - torso], cab = [cx + 25, hom[1] - 70], pl = 0.9 * px, bl = 0.6 * px;
  const pieD = [cx + pl * Math.sin(piernaD * rad), hy + pl * Math.cos(piernaD * rad)], rodD = [(cx + pieD[0]) / 2, (hy + pieD[1]) / 2];
  const pieI = [cx - 10, hy + pl], rodI = [cx - 5, hy + pl / 2];
  let mun = munD, cod = codD;
  if (!mun) {
    const a = (brazoD ?? 0) * rad;
    mun = arriba ? [hom[0] + bl * Math.sin(a), hom[1] - bl * Math.cos(a)] : [hom[0] + bl * Math.sin(a), hom[1] + bl * Math.cos(a)];
    cod = [(hom[0] + mun[0]) / 2, (hom[1] + mun[1]) / 2];
  }
  const munI = [hom[0] + 20, hom[1] + 0.55 * px], codI = [hom[0] + 15, hom[1] + 0.3 * px];
  return { 0: cab, 11: hom, 12: hom, 13: codI, 14: cod, 15: munI, 16: mun, 23: [cx, hy], 24: [cx, hy], 25: rodI, 26: rodD, 27: pieI, 28: pieD,
    29: [pieI[0] - 15, pieI[1]], 30: [pieD[0] - 15, pieD[1]], 31: [pieI[0] + 25, pieI[1]], 32: [pieD[0] + 25, pieD[1]] };
}
// movimiento con perfil seno: de a a b en T s; velocidad maxima = (b-a)·π/(2T)
const barrido = (u, a, b) => a + (b - a) * (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;

// --- futbol: patada con la pierna derecha cada 3 s; la pierna (0,9 m) va de -60° a +40° en 0,25 s
const T_P = 0.25, vPie = 0.9 * (100 * rad) * Math.PI / (2 * T_P); // 9,87 m/s
const tPatadas = [1.5, 4.5, 7.5, 10.5, 13.5];
function futbol(t) {
  let ang = 0;
  for (const t0 of tPatadas) {
    const u = (t - (t0 - T_P / 2)) / T_P;
    if (u > -2 && u < 0) ang = barrido(u + 2, 0, -60) * 1; // echa la pierna atras (lento)
    if (u >= 0 && u <= 1) ang = barrido(u, -60, 40);
    if (u > 1 && u < 4) ang = barrido((u - 1) / 3, 40, 0); // vuelve (lento)
  }
  return persona({ piernaD: ang });
}
// --- voley: remate cada 4 s: el brazo (0,6 m) pasa de -90° a +45° (desde la vertical hacia arriba) en 0,2 s, saltando 40 cm
const T_V = 0.2, vMano = 0.6 * (135 * rad) * Math.PI / (2 * T_V); // 12,7 m/s
const tRemates = [2, 6, 10, 14];
function voley(t) {
  let a = -150, hy = 600;
  for (const t0 of tRemates) {
    const u = (t - (t0 - T_V / 2)) / T_V;
    if (u > -3 && u < 0) a = barrido((u + 3) / 3, -150, -90);
    if (u >= 0 && u <= 1) a = barrido(u, -90, 45);
    if (u > 1 && u < 5) a = barrido((u - 1) / 4, 45, 150);
    const d = t - t0; if (Math.abs(d) < 0.4) hy = 600 - 0.40 * px * Math.cos(Math.PI * d / 0.8);
  }
  return persona({ brazoD: a, arriba: true, hy });
}
// --- raqueta: golpe de derecha cada 2,5 s: el brazo va de -80° a +60° (desde la vertical hacia abajo) en 0,18 s
const T_R = 0.18, vRaq = 0.6 * (140 * rad) * Math.PI / (2 * T_R); // 12,2 m/s
const tGolpes = [1.5, 4, 6.5, 9, 11.5, 14];
function raqueta(t) {
  let a = 0;
  for (const t0 of tGolpes) {
    const u = (t - (t0 - T_R / 2)) / T_R;
    if (u > -4 && u < 0) a = barrido((u + 4) / 4, 0, -80);
    if (u >= 0 && u <= 1) a = barrido(u, -80, 60);
    if (u > 1 && u < 6) a = barrido((u - 1) / 5, 60, 0);
  }
  return persona({ brazoD: a });
}
// --- basquet: tiro cada 4 s; la mano sale a 52° y 6 m/s (acelera parejo 0,6 m en 0,2 s)
const ANG = 52, D = 0.6 * px, T_B = 0.2, vTiro = 2 * 0.6 / T_B; // 6 m/s
const tTiros = [2, 6, 10, 14];
function basquet(t) {
  const hom = [510, 600 - torso], ini = [hom[0] + 0.12 * px, hom[1] - 0.05 * px];
  let mun = [hom[0] + 20, hom[1] + 0.55 * px], cod = [hom[0] + 15, hom[1] + 0.3 * px];
  const dir = [Math.cos(ANG * rad), -Math.sin(ANG * rad)], rel = [ini[0] + D * dir[0], ini[1] + D * dir[1]];
  for (const t0 of tTiros) {
    const u = (t - (t0 - T_B)) / T_B;
    if (u > -3 && u < 0) { const k = (u + 3) / 3; mun = [mun[0] + (ini[0] - mun[0]) * k, mun[1] + (ini[1] - mun[1]) * k]; cod = [hom[0] + 0.25 * px, hom[1] + 0.05 * px]; }
    if (u >= 0 && u <= 1) { mun = [ini[0] + D * u * u * dir[0], ini[1] + D * u * u * dir[1]]; cod = [(hom[0] + mun[0]) / 2 + 0.12 * px * (1 - u), (hom[1] + mun[1]) / 2 + 0.1 * px * (1 - u)]; }
    if (u > 1 && u < 2.5) { mun = rel; cod = [(hom[0] + rel[0]) / 2, (hom[1] + rel[1]) / 2]; }
    if (u >= 2.5 && u < 10) { const k = (u - 2.5) / 7.5, baja = [hom[0] + 20, hom[1] + 0.55 * px]; mun = [rel[0] + (baja[0] - rel[0]) * k, rel[1] + (baja[1] - rel[1]) * k]; cod = [hom[0] + 15, hom[1] + 0.3 * px]; }
  }
  return persona({ munD: mun, codD: cod });
}
// --- natacion: nadador horizontal que avanza a 1,0 m/s hacia la derecha, 40 ciclos/min (el brazo izquierdo gira)
const V_N = 1.0, CPM = 40;
function natacion(t) {
  const cx = 300 + V_N * px * t, y = 500, w = 2 * Math.PI * CPM / 60, hom = [cx + torso, y], bl = 0.6 * px;
  const mun = [hom[0] + bl * Math.cos(w * t), y + bl * Math.sin(w * t)], cod = [(hom[0] + mun[0]) / 2, (hom[1] + mun[1]) / 2];
  const pie = [cx - 0.9 * px, y + 10 * Math.sin(8 * t)];
  return { 0: [hom[0] + 70, y - 10], 11: hom, 12: hom, 13: cod, 14: cod, 15: mun, 16: mun, 23: [cx, y], 24: [cx, y], 25: [cx - 0.45 * px, y], 26: [cx - 0.45 * px, y],
    27: pie, 28: pie, 29: pie, 30: pie, 31: pie, 32: pie };
}

const casos = [
  ['futbol', futbol, 16, { Patadas: tPatadas.length, 'Pie más rápido': vPie, 'Velocidad del balón': null }],
  ['voley', voley, 16, { Remates: tRemates.length, 'Mano más rápida': vMano, Salto: 40 }],
  ['tenis', raqueta, 16, { Golpes: tGolpes.length, 'Mano más rápida': vRaq }],
  ['basquet', basquet, 16, { Tiros: tTiros.length, 'Velocidad de salida': vTiro, 'Ángulo de salida': ANG }],
  ['natacion', natacion, 8, { 'Ciclos de brazada': CPM / 60 * 8, Velocidad: V_N }],
];
let fallos = 0;
const num = (v) => parseFloat(String(v).replace(',', '.'));
for (const [id, f, dur, esperado] of casos) {
  const vis = id === 'natacion' ? (i) => ([12, 14, 16].includes(i) ? 0.2 : 0.95) : undefined;
  const a = analizarActividad(cuerpo(f, dur, vis), dur, POR_ID[id], { altura: 1.7, peso: 75 });
  const errores = [];
  for (const [nom, v] of Object.entries(esperado)) {
    const k = a.kpis.find((x) => x.label === nom); const val = k ? num(k.valor) : NaN;
    if (v == null) { if (!(val > 0)) errores.push(`${nom}: falta`); continue; }
    const tol = /Patadas|Remates|Golpes|Tiros|Ciclos/.test(nom) ? 1 : /Ángulo|Salto/.test(nom) ? Math.max(3, 0.1 * v) : 0.18 * v;
    const tolF = tol;
    if (!(Math.abs(val - v) <= tolF)) errores.push(`${nom}: ${val} (esperado ~${Math.round(v * 10) / 10})`);
  }
  if (errores.length) fallos++;
  console.log(`${errores.length ? 'FAIL' : 'OK  '} ${id.padEnd(9)} ${a.kpis.map((k) => `${k.label}=${k.valor}`).join(' · ')}${errores.length ? '\n     → ' + errores.join(' | ') : ''}`);
}

// --- IA del balon: patada con un balon que sale a 25 m/s (90 km/h) justo despues del contacto
{
  const dur = 4, fr = cuerpo((t) => futbol(t + 0), dur), vB = 25;
  const balon = fr.map((f) => {
    const t = f.t, tc = tPatadas[0]; // contacto en el pico de velocidad del pie
    const pie0 = futbol(tc)[32];
    if (t < tc) return [[pie0[0] + 15, pie0[1] - 5, 22]];
    const d = (t - tc) * vB * px; return t - tc < 0.5 ? [[pie0[0] + 15 + d * Math.cos(10 * rad), pie0[1] - 5 - d * Math.sin(10 * rad), 22], [100, 100, 20]] : [];
  });
  const a = analizarActividad(fr, dur, POR_ID.futbol, { altura: 1.7, peso: 75, balon });
  const k = a.kpis.find((x) => x.label === 'Velocidad del balón'), val = k ? num(k.valor) : NaN;
  const ok = Math.abs(val - vB * 3.6) <= 0.12 * vB * 3.6 && /medida/.test(k.sub);
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} balón IA  medida ${val} km/h (real ${vB * 3.6}) · ${k && k.sub}`);
}

// --- video REAL de tenis de Luis (3/11/2026, 30 fps): 2 golpes de derecha. Antes contaba 4 (cada golpe salía en las
// dos manos porque de lado la IA confunde izquierda y derecha).
{
  const fs = await import('fs'), zlib = await import('zlib');
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./tenis_real.json.gz', import.meta.url))));
  const fr = d.frames.map(([t, p]) => ({ t, puntos: p && p.length ? p : null }));
  const a = analizarActividad(fr, d.dur, POR_ID.tenis, { altura: 1.68, peso: 77.8 });
  const n = a.kpis.find((k) => k.label === 'Golpes').valor, ok = n === 2;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} tenis real  golpes ${n} (real 2)`);
}
console.log(fallos ? `\n${fallos} caso(s) fuera de lo esperado` : '\nTodos los deportes dentro de lo esperado');
