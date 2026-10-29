// Curl alterno con "muñecos" sinteticos (esqueletos de valores conocidos, sin videos): 29/10/2026.
// Cada caso simula un problema real de grabacion y dice cuantas reps hay de verdad.
// Uso: node pruebas/alterno/sinteticos.mjs
import { interpolar, analizar } from '../../js/fisica.js';
import { POR_ID } from '../../js/ejercicios.js';
const FPS = 30;
let semilla = 7; const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647 - 0.5);
// persona de frente-diagonal, ~1000 px de alto. Cada brazo hace un curl de 1,6 s y luego espera al otro.
function muneco(t, o) {
  const per = 1.6 + o.pausa, ciclo = Math.floor(t / per), u = (t % per) / per, activo = ciclo % 2 === 0 ? 'izq' : 'der';
  const fase = u < 1.6 / per ? Math.sin(Math.PI * (u * per / 1.6)) : 0; // 0 estirado -> 1 arriba -> 0
  const listo = t < o.reps * per; // despues de las reps los brazos quedan colgando
  const dx = (o.camara || 0) * Math.sin(2 * Math.PI * 0.7 * t), dy = (o.camara || 0) * 0.6 * Math.cos(2 * Math.PI * 0.5 * t); // camara en mano
  const brazo = (hx, lado) => {
    const h = [hx + dx, 300 + dy], c = [hx + dx + (lado === 'izq' ? -10 : 10), 470 + dy];
    const a = (listo && activo === lado ? fase : 0) * 125 * Math.PI / 180; // el antebrazo gira 125°
    const m = [c[0] + 150 * Math.sin(a) * 0.5, c[1] + 150 * Math.cos(a)];
    return [h, c, m];
  };
  const [h1, c1, m1] = brazo(440, 'izq'), [h2, c2, m2] = brazo(560, 'der');
  const j = { 0: [500 + dx, 230 + dy], 11: h1, 12: h2, 13: c1, 14: c2, 15: m1, 16: m2, 23: [460 + dx, 560 + dy], 24: [540 + dx, 560 + dy],
    25: [455 + dx, 780 + dy], 26: [545 + dx, 780 + dy], 27: [450 + dx, 990 + dy], 28: [550 + dx, 990 + dy], 29: [440 + dx, 1000 + dy], 30: [560 + dx, 1000 + dy], 31: [470 + dx, 1010 + dy], 32: [530 + dx, 1010 + dy] };
  return j;
}
function frames(o) {
  const out = [];
  for (let k = 0; k < o.dur * FPS; k++) {
    const t = k / FPS, j = muneco(t, o), puntos = [];
    for (let i = 0; i < 33; i++) {
      const p = j[i] || j[0]; let vis = 0.95, r = 2;
      if (o.tapado && (i === 14 || i === 16)) { vis = 0.15; r = 25; } // la mano lejana queda detras del cuerpo
      puntos.push([p[0] + r * rnd(), p[1] + r * rnd(), vis]);
    }
    out.push({ t, puntos });
  }
  return out;
}
const CASOS = [
  { nombre: 'limpio, 6 por brazo', reps: 12, pausa: 0.4, dur: 28, real: 12 },
  { nombre: 'cámara en mano (se mueve 40 px)', reps: 12, pausa: 0.4, dur: 28, camara: 40, real: 12 },
  { nombre: 'pausas largas entre brazos', reps: 8, pausa: 1.5, dur: 28, real: 8 },
  { nombre: 'mano lejana tapada (la IA no la ve bien)', reps: 12, pausa: 0.4, dur: 28, tapado: true, real: [6, 12] },
];
let fallos = 0;
for (const c of CASOS) {
  const fr = frames(c), fps = 60, full = interpolar(fr, fps, c.dur);
  const res = analizar(full, fps, POR_ID.curl_alterno, { masa: 12, alfa: 90, relacion: 1, altura: 1.7, frames: fr });
  const n = res.reps.length, izq = res.reps.filter((r) => r.lado === 'izq').length;
  const ok = Array.isArray(c.real) ? n >= c.real[0] && n <= c.real[1] : n === c.real;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.nombre}: app ${n} (izq ${izq} · der ${n - izq}) · real ${Array.isArray(c.real) ? c.real.join('-') : c.real}` +
    (res.conteo ? ` · contador ${res.conteo.usado} (posición ${res.conteo.principal}, codos ${res.conteo.angulos})` : ''));
}
console.log(fallos ? `${fallos} caso(s) fuera de lo esperado` : 'Todos los casos dentro de lo esperado');
