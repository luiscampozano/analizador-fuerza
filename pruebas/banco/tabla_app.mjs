// Tabla con el codigo real de la app: contador principal (sin angulos) + contador por angulos
import fs from 'fs'; import zlib from 'zlib';
const R0 = process.env.APP || '/home/claude/repo-fuerza/js';
const { interpolar, analizar } = await import(`${R0}/fisica.js`);
const { contarPorAngulos } = await import(`${R0}/conteo.js`);
const { POR_ID } = await import(`${R0}/ejercicios.js`);
const et = JSON.parse(fs.readFileSync('etiquetas.json', 'utf8')); const out = [];
for (const [nom, e] of Object.entries(et)) {
  if (!e.ej || e.omitir || !fs.existsSync(`kp/${nom}.json.gz`)) continue;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(`kp/${nom}.json.gz`)));
  const fps = 60, full = interpolar(d.frames.map(([t, p]) => ({ t, puntos: p })), fps, d.dur), ej = POR_ID[e.ej];
  const carga = e.kg || 60, masa = ej.perfil === 'corporal' ? Math.max(5, 77.8 * (ej.fraccion || 1)) : carga;
  const actual = analizar(full, fps, ej, { masa, alfa: ej.perfil === 'riel' ? 45 : 90, relacion: 1, altura: 1.68, sinAngulos: true }).reps.length;
  const frames = d.frames.map(([t, p]) => ({ t, puntos: p })); const c = contarPorAngulos(full, fps, ej, frames);
  out.push({ nom, ej: e.ej, real: e.reps, actual, alterno: !!ej.alterno, c: c && { n: c.n, zig: c.zig, ac: c.ac, cv: c.cv, nT: c.nT, senal: c.senal } });
}
fs.writeFileSync('exp/tabla_app.json', JSON.stringify(out)); console.log(out.length);
