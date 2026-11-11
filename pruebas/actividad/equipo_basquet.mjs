// v2.51.0 Equipo del básquet (talla del balón). Comprueba: 1) con la talla estándar (7) el resultado es idéntico a
// no pasar equipo; 2) la talla cambia el filtro de tamaño de la IA del balón: un balón que se ve de 4,6 cm de radio
// (más chico que el mínimo de la talla 7, 4,8 cm, pero dentro del de la talla 5, 4,4 cm) solo se sigue si eliges
// talla 5; 3) un valor que no es una talla válida se ignora (queda la talla 7).
// Uso: node pruebas/actividad/equipo_basquet.mjs
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
import { valoresEquipo } from '../../js/equipo.js';
const FPS = 60, px = 1000 / 1.7, torso = 0.30 * 1.7 * px, rad = Math.PI / 180;
let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
// tiro sintético (igual que en deportes.mjs): la mano sale a 52° y 6 m/s cada 4 s
const ANG = 52, D = 0.6 * px, T_B = 0.2, tTiros = [2, 6, 10, 14];
function persona(mun, cod, munI, codI) {
  const cx = 500, hy = 600, hom = [cx + 10, hy - torso], cab = [cx + 25, hom[1] - 70], pl = 0.9 * px;
  const pie = [cx, hy + pl], rod = [cx, hy + pl / 2], pieI = [cx - 10, hy + pl], rodI = [cx - 5, hy + pl / 2];
  return { 0: cab, 11: hom, 12: hom, 13: codI, 14: cod, 15: munI, 16: mun, 23: [cx, hy], 24: [cx, hy], 25: rodI, 26: rod, 27: pieI, 28: pie, 29: pieI, 30: pie, 31: pieI, 32: pie };
}
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
  return persona(mun, cod, [mun[0] - 12, mun[1] + 15], [cod[0] - 10, cod[1] + 10]);
}
const dur = 16, frames = [];
for (let k = 0; k < dur * FPS; k++) {
  const t = k / FPS, j = basquet(t), puntos = [];
  for (let i = 0; i < 33; i++) { const p = j[i] || j[0]; puntos.push([p[0] + 1.5 * rnd(), p[1] + 1.5 * rnd(), 0.95]); }
  frames.push({ t, puntos });
}
// IA del balón sintética: cerca de cada tiro el balón sale de la mano a 8 m/s y 50°, con el radio (m) que se pida.
// Aquí no se mide la exactitud de la velocidad (eso lo hace deportes.mjs), solo si el balón se sigue o no.
const vB = 8;
const balonDe = (radio) => frames.map((f) => {
  const t = f.t;
  for (const t0 of tTiros) {
    const tc = t0 - T_B, dt = t - tc;
    if (dt >= -0.05 && dt < 0.5) {
      const m0 = basquet(tc)[16], d = Math.max(0, dt) * vB * px;
      return [[m0[0] + d * Math.cos(50 * rad), m0[1] - d * Math.sin(50 * rad) + 0.5 * 9.81 * Math.max(0, dt) ** 2 * px, radio * px]];
    }
  }
  return [];
});
const cfg = { altura: 1.7, peso: 75 };
const correr = (balon, equipo) => analizarActividad(frames, dur, POR_ID.basquet, { ...cfg, balon, ...(equipo ? { equipo } : {}) });
const velSalida = (a) => { const k = a.kpis.find((x) => x.label === 'Velocidad de salida'); return k ? parseFloat(String(k.valor).replace(',', '.')) : null; };
let mal = 0;
const revisar = (ok, texto) => { if (!ok) mal++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${texto}`); };

// 1) estándar = sin equipo (con y sin IA del balón)
const normal = balonDe(0.12);
for (const [nom, b] of [['sin balón', undefined], ['con balón talla 7', normal]]) {
  const a = JSON.stringify(correr(b)), e = JSON.stringify(correr(b, valoresEquipo('basquet', {}))), e7 = JSON.stringify(correr(b, valoresEquipo('basquet', { diametro: 24 })));
  revisar(a === e && a === e7, `estándar idéntico a sin equipo (${nom})`);
}
const v7 = velSalida(correr(normal));
revisar(v7 > 0, `balón talla 7 seguido con talla 7: ${v7} m/s`);

// 2) balón que se ve de radio 0,046 m: con talla 7 (mínimo 0,048) no se sigue; con talla 5 (mínimo 0,044) sí
const chico = balonDe(0.046);
const a7 = correr(chico), a5 = correr(chico, valoresEquipo('basquet', { diametro: 22 }));
revisar(velSalida(a7) == null, 'balón chico NO se sigue con talla 7');
const v5 = velSalida(a5);
revisar(v5 > 0 && v5 === v7, `balón chico SÍ se sigue con talla 5: ${v5} m/s (mismo vuelo que el de talla 7)`);
revisar(a5.equipo && a5.equipo.diametro === 22 && a5.alertas.some((x) => /talla del balón 5/.test(x.texto)), 'el informe avisa la talla elegida');
// y al revés: un balón que se ve de radio 0,29 m entra en talla 7 (máximo 0,30) pero no en talla 5 (máximo 0,275)
const grande = balonDe(0.29);
revisar(velSalida(correr(grande)) > 0 && velSalida(correr(grande, valoresEquipo('basquet', { diametro: 22 }))) == null, 'balón grande: se sigue con talla 7, no con talla 5');

// 3) fuera de rango / no válido: se ignora (queda la talla 7)
for (const malo of [30, 0, -5, '23', 'abc', null]) {
  const v = valoresEquipo('basquet', { diametro: malo });
  revisar(v.diametro === 24, `valor no válido ${JSON.stringify(malo)} → talla 7 (24 cm)`);
}
revisar(JSON.stringify(correr(chico, { diametro: 99 })) === JSON.stringify(a7), 'equipo con diámetro 99 = sin equipo');
console.log(mal ? `FALLA equipo basquet (${mal})` : 'OK equipo basquet');
if (mal) process.exit(1);
