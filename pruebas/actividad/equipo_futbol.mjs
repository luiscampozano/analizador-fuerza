// v2.51.0 Equipo de fútbol: cada campo mueve la velocidad del balón y la fuerza del impacto en la dirección y magnitud
// que da la física (choque pie-balón). Con los valores estándar, igual que sin equipo; fuera de rango se ignora.
// Usa la patada sintética de deportes.mjs. Uso: node pruebas/actividad/equipo_futbol.mjs
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
import { valoresEquipo } from '../../js/equipo.js';
const FPS = 60, px = 1000 / 1.7, torso = 0.30 * 1.7 * px, rad = Math.PI / 180;
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
// persona de lado; la pierna derecha patea (igual que deportes.mjs)
function persona(piernaD) {
  const cx = 500, hy = 600, hom = [cx + 10, hy - torso], cab = [cx + 25, hom[1] - 70], pl = 0.9 * px;
  const pieD = [cx + pl * Math.sin(piernaD * rad), hy + pl * Math.cos(piernaD * rad)], rodD = [(cx + pieD[0]) / 2, (hy + pieD[1]) / 2];
  const pieI = [cx - 10, hy + pl], rodI = [cx - 5, hy + pl / 2], mun = [hom[0], hom[1] + 0.6 * px], cod = [hom[0], hom[1] + 0.3 * px];
  const munI = [hom[0] + 20, hom[1] + 0.55 * px], codI = [hom[0] + 15, hom[1] + 0.3 * px];
  return { 0: cab, 11: hom, 12: hom, 13: codI, 14: cod, 15: munI, 16: mun, 23: [cx, hy], 24: [cx, hy], 25: rodI, 26: rodD, 27: pieI, 28: pieD,
    29: [pieI[0] - 15, pieI[1]], 30: [pieD[0] - 15, pieD[1]], 31: [pieI[0] + 25, pieI[1]], 32: [pieD[0] + 25, pieD[1]] };
}
const barrido = (u, a, b) => a + (b - a) * (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;
const T_P = 0.25, tPatadas = [1.5, 4.5, 7.5, 10.5, 13.5];
function futbol(t) {
  let ang = 0;
  for (const t0 of tPatadas) {
    const u = (t - (t0 - T_P / 2)) / T_P;
    if (u > -2 && u < 0) ang = barrido(u + 2, 0, -60);
    if (u >= 0 && u <= 1) ang = barrido(u, -60, 40);
    if (u > 1 && u < 4) ang = barrido((u - 1) / 3, 40, 0);
  }
  return persona(ang);
}
const DUR = 16, frames = cuerpo(futbol, DUR), PESO = 75;
const correr = (equipo) => analizarActividad(frames, DUR, POR_ID.futbol, { altura: 1.7, peso: PESO, ...(equipo === undefined ? {} : { equipo }) });
const suma = (a, k) => a.eventos.reduce((x, e) => x + e[k], 0);
let fallos = 0;
const ok = (cond, txt) => { if (!cond) fallos++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${txt}`); };

const base = correr(), sB = JSON.stringify(base);
ok(base.eventos.length === 5, `patadas sin equipo: ${base.eventos.length}`);
ok(JSON.stringify(correr(valoresEquipo('futbol', {}))) === sB, 'estándar = sin equipo');
ok(JSON.stringify(correr({ masa: 430, diametro: 22, presion: 0.9, calzado: 220 })) === sB, 'valores estándar escritos = sin equipo');
const txt = (a) => JSON.stringify(a);
ok(/~1,25 veces/.test(sB), 'texto estándar «~1,25 veces» sin cambiar');

// física de referencia (independiente del código): vb = v·(1+e)·M/(M+m); F = m·vb/tc
const M0 = 0.028 * PESO, m0 = 0.43, e0 = 0.5, tc0 = 0.009;
const eBote = (bar) => { const C = 2.76e-4 * bar * 1e5 + 6.6; return Math.sqrt((2 * C + 1 - Math.sqrt(8 * C + 1)) / (2 * C)); };
const caso = (nombre, cambio, { M = M0, m = m0, e = e0, tc = tc0 }, dirV, dirF) => {
  const a = correr(valoresEquipo('futbol', cambio));
  const rV = suma(a, 'kmh') / suma(base, 'kmh'), rF = suma(a, 'fuerza') / suma(base, 'fuerza');
  const eV = ((1 + e) * M / (M + m)) / ((1 + e0) * M0 / (M0 + m0)), eF = eV * (m / m0) * (tc0 / tc);
  const signo = (r) => (r > 1.002 ? 1 : r < 0.998 ? -1 : 0);
  const bienV = Math.abs(rV - eV) < 0.02 && signo(rV) === dirV, bienF = Math.abs(rF - eF) < 0.03 && signo(rF) === dirF;
  ok(bienV && bienF && a.eventos.length === 5,
    `${nombre.padEnd(22)} velocidad ×${rV.toFixed(3)} (física ×${eV.toFixed(3)}) · fuerza ×${rF.toFixed(3)} (física ×${eF.toFixed(3)})`);
  return a;
};
// balón más pesado: sale más lento; el contacto dura más (√m) pero empuja más masa: la fuerza sube un poco
caso('balón 450 g', { masa: 450 }, { m: 0.45, tc: tc0 * Math.sqrt(450 / 430) }, -1, 1);
// talla 3 (310 g, 19 cm): sale más rápido; menos masa: menos fuerza
caso('talla 3 (310 g, 19 cm)', { masa: 310, diametro: 19 }, { m: 0.31, tc: tc0 * Math.sqrt((310 / 430) * (22 / 19)) }, 1, -1);
// diámetro menor: misma velocidad, resorte más blando: contacto más largo y fuerza media menor
caso('diámetro 20 cm', { diametro: 20 }, { tc: tc0 * Math.sqrt(22 / 20) }, 0, -1);
// poco inflado: rebota menos y el contacto es más largo
const pBaja = caso('presión 0,5 bar', { presion: 0.5 }, { e: 0.5 * eBote(0.5) / eBote(0.9), tc: tc0 * Math.sqrt(0.9 / 0.5) }, -1, -1);
// zapato pesado: con el pie a la misma velocidad el balón sale más rápido
const zap = caso('zapato 600 g', { calzado: 600 }, { M: M0 + 0.38 }, 1, 1);
caso('descalzo', { calzado: 0 }, { M: M0 - 0.22 }, -1, -1);
const rz = (1.5 * (M0 + 0.38) / (M0 + 0.38 + m0)).toFixed(2).replace('.', ',');
ok(txt(zap).includes(`~${rz} veces`) && !/~1,25 veces/.test(txt(zap)), `texto con zapato 600 g: «~${rz} veces»`);
ok(!/~1,25 veces/.test(txt(pBaja)), 'texto con presión baja ya no dice 1,25');
// fuera de rango o basura: se ignora (queda el estándar)
ok(JSON.stringify(correr(valoresEquipo('futbol', { masa: 1000, diametro: 5, presion: 'abc', calzado: -3 }))) === sB, 'fuera de rango = estándar');
ok(JSON.stringify(correr(valoresEquipo('futbol', { masa: '', presion: null }))) === sB, 'vacío = estándar');
console.log(fallos ? `\n${fallos} FALLA(S) equipo futbol` : '\nOK equipo futbol');
if (fallos) process.exit(1);
