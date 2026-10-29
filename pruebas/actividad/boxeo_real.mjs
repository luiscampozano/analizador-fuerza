// Prueba con un video REAL de boxeo de Luis (solo los puntos del esqueleto, sin imagen): 29/10/2026.
// Golpes contados a mano cuadro por cuadro entre 0 y 9,7 s; despues camina hacia la camara con los brazos colgando
// (eso NO debe contar). Uso: node pruebas/actividad/boxeo_real.mjs
import fs from 'fs'; import zlib from 'zlib';
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./boxeo_real.json.gz', import.meta.url))));
const frames = d.frames.map(([t, p]) => ({ t, puntos: p && p.length ? p : null }));
const a = analizarActividad(frames, d.dur, POR_ID.boxeo, { altura: 1.68 });
const reales = [0.2, 0.6, 1.15, 1.5, 2.0, 2.3, 2.8, 3.3, 3.8, 4.1, 5.25, 5.75, 6.2, 6.75, 7.05, 7.45, 8.05, 8.45, 8.75, 9.1, 9.55];
const ev = a.eventos.map((e) => e.t);
const aciertos = reales.filter((m) => ev.some((e) => Math.abs(e - m) < 0.25)).length;
const despues = ev.filter((e) => e > 9.8).length;
const guardia = a.kpis.find((k) => k.label === 'Guardia baja').valor;
console.log(`golpes ${ev.length} · aciertos ${aciertos}/${reales.length} · al caminar ${despues} · guardia baja ${guardia} %`);
const ok = aciertos >= 18 && ev.length <= reales.length + 2 && despues === 0 && guardia < 50;
console.log(ok ? 'OK boxeo real' : 'FAIL boxeo real');
