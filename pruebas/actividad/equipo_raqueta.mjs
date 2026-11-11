// v2.51.0 Equipo de tenis/pádel: con el estándar el resultado es el de antes; cada campo mueve la velocidad de la pelota
// y la fuerza del impacto en la dirección y la magnitud que da la física; un valor fuera de rango se ignora.
// Usa el video real de tenis (2 golpes). Uso: node pruebas/actividad/equipo_raqueta.mjs
import { readFileSync } from 'fs'; import { gunzipSync } from 'zlib';
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
import { valoresEquipo } from '../../js/equipo.js';
const d = JSON.parse(gunzipSync(readFileSync(new URL('tenis_real.json.gz', import.meta.url))));
const frames = d.frames.map(([t, p]) => ({ t, puntos: p && p.length ? p : null }));
const cfg = { altura: 1.68, peso: 77.8 };
const correr = (equipo) => analizarActividad(frames, d.dur, POR_ID.tenis, equipo ? { ...cfg, equipo } : cfg);
const base = correr(null), sBase = JSON.stringify(base);
let mal = 0;
const chequea = (ok, txt) => { if (!ok) mal++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${txt}`); };
chequea(base.eventos.length === 2, `golpes en el video real: ${base.eventos.length} (2)`);
chequea(JSON.stringify(correr(valoresEquipo('raqueta', {}))) === sBase, 'estándar = sin equipo (idéntico)');
// suma de velocidades y fuerzas de los golpes (redondeadas por la app: se compara con ±3 %)
const tot = (a, k) => a.eventos.reduce((s, g) => s + g[k], 0);
const v0 = tot(base, 'kmh'), f0 = tot(base, 'fuerza');
// choque: vb = v·(1+e)·M/(M+m); fuerza = m·vb/tc
const vb = (cab, M, m, e) => cab * (1 + e) * M / (M + m);
const B = vb(2, 0.3, 0.058, 0.75);
const casos = [
  // [campos, razón esperada de velocidad, razón esperada de fuerza, explicación]
  [{ peso: 360 }, vb(2, 0.36, 0.058, 0.75) / B, null, 'raqueta más pesada → pelota algo más rápida'],
  [{ peso: 240 }, vb(2, 0.24, 0.058, 0.75) / B, null, 'raqueta más liviana → pelota algo más lenta'],
  [{ largo: 45.5 }, vb(1 + 45.5 / 68.5, 0.3, 0.058, 0.75) / B, null, 'pádel 45,5 cm → cabeza ×1,66 en vez de ×2'],
  [{ tension: 15 }, vb(2, 0.3, 0.058, 0.75 * (25 / 15) ** 0.02) / B, null, 'tensión baja → salida casi igual (+0,4 %), contacto más largo'],
  [{ tension: 32 }, vb(2, 0.3, 0.058, 0.75 * (25 / 32) ** 0.02) / B, null, 'tensión alta → salida casi igual, contacto más corto'],
  [{ pelota: 47 }, vb(2, 0.3, 0.047, 0.75) / B, null, 'pelota liviana → sale más rápido'],
];
for (const [campos, rv, , txt] of casos) {
  const a = correr(valoresEquipo('raqueta', campos));
  const v = tot(a, 'kmh') / v0, f = tot(a, 'fuerza') / f0;
  // fuerza esperada: m·vb/tc relativa al estándar
  const m = (campos.pelota || 58) / 58, tc = campos.tension ? (25 / campos.tension) ** 0.34 : 1, rf = m * rv / tc;
  const ok = Math.abs(v / rv - 1) < 0.03 && Math.abs(f / rf - 1) < 0.04;
  chequea(ok, `${txt}: velocidad ×${v.toFixed(3)} (esperado ${rv.toFixed(3)}), fuerza ×${f.toFixed(3)} (esperado ${rf.toFixed(3)})`);
}
// dirección de la tensión sobre la fuerza (contacto 20 % más largo a 40 lb que a 70 lb)
const fT = (T) => tot(correr(valoresEquipo('raqueta', { tension: T })), 'fuerza');
chequea(fT(15) < f0 && f0 < fT(32), 'menos tensión → fuerza media del contacto menor');
// fuera de rango o vacío: se ignora (resultado de antes)
for (const malo of [{ peso: 50 }, { largo: 200 }, { tension: 80 }, { pelota: 0 }, { diametro: 30 }, { peso: '' }, { tension: 'abc' }]) {
  chequea(JSON.stringify(correr(valoresEquipo('raqueta', malo))) === sBase, `fuera de rango se ignora: ${JSON.stringify(malo)}`);
}
if (mal) { console.log(`FALLA equipo raqueta (${mal})`); process.exit(1); }
console.log('OK equipo raqueta');
