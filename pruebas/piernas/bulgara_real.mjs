// Video real (Luis, 02/11/2026, v2.27.0 contó 5): sentadilla búlgara con 8 reps por pierna en el mismo video, con
// pausa para cambiar de pierna. Debe contar 16 y partir 8 + 8.
import fs from 'fs'; import zlib from 'zlib';
import { interpolar, analizar } from '../../js/fisica.js';
import { POR_ID } from '../../js/ejercicios.js';
import { cambioDePierna } from '../../js/piernas.js';
const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./bulgara_real16.json.gz', import.meta.url))));
const frames = d.frames.map(([t, puntos]) => ({ t, puntos }));
const fps = 60, full = interpolar(frames, fps, d.dur);
const res = analizar(full, fps, POR_ID.bulgara_mancuernas, { masa: 18, alfa: 90, relacion: 1, altura: 1.68, frames, pesoCorporal: 77.8 });
const c = cambioDePierna(full, fps, res.reps);
// v2.30.0: las dos piernas deben medirse parecido (antes una salia con el doble de velocidad que la otra)
const vm = (l) => l.reduce((a, r) => a + r.v_media, 0) / (l.length || 1);
const va = vm(res.reps.slice(0, 8)), vb = vm(res.reps.slice(8)), dif = Math.abs(va - vb) / Math.max(va, vb);
const ok = res.reps.length === 16 && c && c.k === 8 && dif < 0.3;
console.log(`${ok ? 'OK' : 'FALLA'} búlgara real: ${res.reps.length} reps (real 16), cambio de pierna en ${c ? c.k : '-'} (real 8), velocidad ${va.toFixed(2)} vs ${vb.toFixed(2)} m/s`);
