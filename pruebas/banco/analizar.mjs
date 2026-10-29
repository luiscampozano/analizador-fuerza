// Corre el pipeline de la app (interpolar -> analizar -> analizarSerie) sobre los puntos guardados.
// Uso: node analizar.mjs etiquetas.json [filtro]   -> tabla y resumen de aciertos
import fs from 'fs';
import zlib from 'zlib';
const R = process.env.APP || '/home/claude/af-web/js'; for (const k of (process.env.FLAGS || '').split(',').filter(Boolean)) globalThis['__' + k] = true;
const { interpolar, analizar } = await import(`${R}/fisica.js`);
const { analizarSerie } = await import(`${R}/analisis.js`);
const { POR_ID } = await import(`${R}/ejercicios.js`);

const etiquetas = JSON.parse(fs.readFileSync(process.argv[2] || '/home/claude/banco/etiquetas.json', 'utf8'));
const filtro = process.argv[3] || '';
let ok = 0, n = 0;
const filas = [];
for (const [nombre, e] of Object.entries(etiquetas)) {
  if (filtro && !nombre.includes(filtro)) continue;
  if (!e.ej || e.omitir) continue;
  const f = `/home/claude/banco/kp/${nombre}.json.gz`;
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const frames = d.frames.map(([t, p]) => ({ t, puntos: p }));
  const ej = POR_ID[e.ej];
  if (!ej) { filas.push(`${nombre}  ejercicio desconocido ${e.ej}`); continue; }
  const carga = e.kg || 60, pc = 77.8;
  const masa = ej.perfil === 'corporal' ? Math.max(5, pc * (ej.fraccion || 1)) : carga;
  let reps = 0, txt = '';
  try {
    const fps = 60, full = interpolar(frames, fps, d.dur);
    const res = analizar(full, fps, ej, { masa, alfa: ej.perfil === 'riel' ? 45 : 90, relacion: 1, altura: 1.68, frames });
    reps = res.reps.length;
    const s = reps ? analizarSerie(res, ej, { carga, masaTotal: masa, pesoCorporal: pc, perfil: ej.perfil }) : null;
    txt = `v=[${res.reps.map((r) => r.v_media.toFixed(2)).join(' ')}] t=[${res.reps.map((r) => (r.inicio / fps).toFixed(1)).join(' ')}]` + (s ? ` rm=${s.rm?.toFixed?.(0) ?? '-'} rir=${s.rir ?? '-'} vis=${s.visPunto?.toFixed?.(2) ?? res.visPunto?.toFixed?.(2) ?? '-'}` : '');
  } catch (err) { txt = 'ERROR ' + err.message; }
  const bien = e.reps == null ? null : reps === e.reps;
  if (bien != null) { n++; if (bien) ok++; }
  filas.push(`${bien == null ? '?' : bien ? '✓' : '✗'} ${nombre.padEnd(28)} ${e.ej.padEnd(22)} real=${e.reps ?? '?'} app=${reps}  ${txt}`);
}
console.log(filas.join('\n'));
console.log(`\nACIERTOS ${ok}/${n}`);
