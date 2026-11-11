// v2.51.0 Con los valores estándar del equipo, el análisis de cada deporte debe dar EXACTAMENTE lo mismo que sin
// equipo (como antes). Compara la salida completa (JSON) de analizarActividad sin cfg.equipo y con los valores
// estándar, con los esqueletos reales del repositorio pasados por cada deporte. Uso: node pruebas/actividad/equipo_igual.mjs
import { readFileSync } from 'fs'; import { gunzipSync } from 'zlib';
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
import { EQUIPO, valoresEquipo } from '../../js/equipo.js';
const cargar = (a) => { const d = JSON.parse(gunzipSync(readFileSync(new URL(a, import.meta.url)))); return { dur: d.dur, frames: d.frames.map(([t, p]) => ({ t, puntos: p && p.length ? p : null })) }; };
const datos = [cargar('boxeo_real.json.gz'), cargar('tenis_real.json.gz')];
let mal = 0;
for (const [id, tipo] of [['boxeo', 'boxeo'], ['tenis', 'raqueta'], ['futbol', 'futbol'], ['voley', 'voley'], ['basquet', 'basquet']]) {
  for (const [k, d] of datos.entries()) {
    const cfg = { altura: 1.68, peso: 77.8 };
    let a, b; try { a = JSON.stringify(analizarActividad(d.frames, d.dur, POR_ID[id], cfg)); } catch (e) { a = 'error ' + e.message; }
    try { b = JSON.stringify(analizarActividad(d.frames, d.dur, POR_ID[id], { ...cfg, equipo: valoresEquipo(tipo, {}) })); } catch (e) { b = 'error ' + e.message; }
    if (a !== b) { mal++; console.log('DISTINTO con valores estándar:', id, 'datos', k); }
  }
  console.log('revisado:', id, `(${(EQUIPO[tipo] || []).length} campos)`);
}
console.log(mal ? 'FALLA equipo estándar cambia el resultado' : 'OK equipo estándar = resultado de antes');
