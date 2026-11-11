// v2.51.0 Equipo de vóley: con los valores estándar el resultado es idéntico al de sin equipo; cada campo mueve la
// velocidad y la fuerza del remate en la dirección y la magnitud de la física; un valor fuera de rango se ignora.
// Física (js/actividad.js): balón v = vmano·(1+e)·M/(M+m), M = 4 % del peso; fuerza = m·v/tc; tc ∝ √(m/(R·P)).
// Esqueleto sintético: el mismo remate de pruebas/actividad/deportes.mjs. Uso: node pruebas/actividad/equipo_voley.mjs
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
import { EQUIPO, valoresEquipo } from '../../js/equipo.js';
const FPS = 60, px = 1000 / 1.7, torso = 0.30 * 1.7 * px;
let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
function cuerpo(f, dur) {
  const frames = [];
  for (let k = 0; k < dur * FPS; k++) {
    const t = k / FPS, j = f(t), puntos = [];
    for (let i = 0; i < 33; i++) { const p = j[i] || j[0]; puntos.push([p[0] + 1.5 * rnd(), p[1] + 1.5 * rnd(), 0.95]); }
    frames.push({ t, puntos });
  }
  return frames;
}
const rad = Math.PI / 180;
function persona({ cx = 500, hy = 600, brazoD = 0 }) {
  const hom = [cx + 10, hy - torso], cab = [cx + 25, hom[1] - 70], pl = 0.9 * px, bl = 0.6 * px;
  const pieD = [cx, hy + pl], rodD = [cx, hy + pl / 2], pieI = [cx - 10, hy + pl], rodI = [cx - 5, hy + pl / 2];
  const a = brazoD * rad, mun = [hom[0] + bl * Math.sin(a), hom[1] - bl * Math.cos(a)], cod = [(hom[0] + mun[0]) / 2, (hom[1] + mun[1]) / 2];
  const munI = [hom[0] + 20, hom[1] + 0.55 * px], codI = [hom[0] + 15, hom[1] + 0.3 * px];
  return { 0: cab, 11: hom, 12: hom, 13: codI, 14: cod, 15: munI, 16: mun, 23: [cx, hy], 24: [cx, hy], 25: rodI, 26: rodD, 27: pieI, 28: pieD,
    29: [pieI[0] - 15, pieI[1]], 30: [pieD[0] - 15, pieD[1]], 31: [pieI[0] + 25, pieI[1]], 32: [pieD[0] + 25, pieD[1]] };
}
const barrido = (u, a, b) => a + (b - a) * (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;
const T_V = 0.2, tRemates = [2, 6, 10, 14];
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
const dur = 16, frames = cuerpo(voley, dur), cfg = { altura: 1.7, peso: 75 };
const correr = (equipo) => analizarActividad(frames, dur, POR_ID.voley, equipo ? { ...cfg, equipo } : cfg);
// sin redondeo: suma de velocidades y fuerzas de todos los remates
const tot = (a) => ({ kmh: a.eventos.reduce((x, e) => x + e.kmh, 0), kg: a.eventos.reduce((x, e) => x + e.fuerza, 0), n: a.eventos.length });
let mal = 0;
const revisar = (ok, txt) => { if (!ok) mal++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${txt}`); };

const base = correr(null), b = tot(base);
revisar(b.n === tRemates.length && b.kg > 0, `base: ${b.n} remates, ${b.kmh} km/h y ${b.kg} kg sumados`);
revisar(JSON.stringify(correr(valoresEquipo('voley', {}))) === JSON.stringify(base), 'valores estándar = sin equipo (idéntico)');
const est = Object.fromEntries(EQUIPO.voley.map((c) => [c.k, c.def]));
revisar(est.diametro === 21 && est.pesoBalon === 270 && est.presion === 4.4, 'estándar: 21 cm, 270 g, 4,4 psi');

// esperado (M = 3 kg): pesoBalon m → v × 3,27/(3+m); fuerza × (m/0,27)·(v ratio)/√(m/0,27)
const M = 0.04 * 75;
const casos = [
  ['balón de 450 g', { pesoBalon: 450 }, (M + 0.27) / (M + 0.45), Math.sqrt(0.45 / 0.27) * (M + 0.27) / (M + 0.45)],
  ['balón de 150 g', { pesoBalon: 150 }, (M + 0.27) / (M + 0.15), Math.sqrt(0.15 / 0.27) * (M + 0.27) / (M + 0.15)],
  ['playa 2,85 psi', { presion: 2.85 }, 1, Math.sqrt(2.85 / 4.4)], // menos presion: contacto mas largo, menos fuerza
  ['presión 6 psi', { presion: 6 }, 1, Math.sqrt(6 / 4.4)],
  ['diámetro 24 cm', { diametro: 24 }, 1, Math.sqrt(24 / 21)],
  ['diámetro 18 cm', { diametro: 18 }, 1, Math.sqrt(18 / 21)],
];
for (const [nom, cambio, rv, rf] of casos) {
  const a = correr(valoresEquipo('voley', cambio)), x = tot(a);
  const qv = x.kmh / b.kmh, qf = x.kg / b.kg;
  // los eventos vienen redondeados a km/h y kg enteros (~50 km/h y ~31 kg por remate): ese redondeo entra en la tolerancia
  const tolV = 0.005 + b.n / b.kmh, tolF = 0.01 + b.n / b.kg;
  const ok = x.n === b.n && Math.abs(qv - rv) < tolV && Math.abs(qf - rf) < tolF && Math.sign(qf - 1) === Math.sign(rf - 1) && a.alertas.some((y) => /tu equipo/.test(y.texto));
  revisar(ok, `${nom}: velocidad ×${qv.toFixed(3)} (esperado ×${rv.toFixed(3)}), fuerza ×${qf.toFixed(3)} (esperado ×${rf.toFixed(3)})`);
}
// fuera de rango o no numérico: se usa el estándar (resultado idéntico)
for (const malo of [{ pesoBalon: 1000 }, { presion: 0 }, { diametro: 'abc' }, { presion: -3, diametro: 50, pesoBalon: '' }]) {
  revisar(JSON.stringify(correr(valoresEquipo('voley', malo))) === JSON.stringify(base), `fuera de rango ignorado: ${JSON.stringify(malo)}`);
}
if (mal) { console.log(`FALLA equipo voley (${mal})`); process.exit(1); }
console.log('OK equipo voley');
