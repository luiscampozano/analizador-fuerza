// Robustez: se alteran los puntos de cada video (camara girada, mas lejos, temblor, paneo, mas rapido/lento)
// y se mide cuantas veces el conteo sigue siendo correcto. Compara el contador viejo (sin angulos) con el nuevo.
import fs from 'fs'; import zlib from 'zlib';
const R0 = '/home/claude/repo-fuerza/js';
const { interpolar, analizar } = await import(`${R0}/fisica.js`);
const { POR_ID } = await import(`${R0}/ejercicios.js`);
const et = JSON.parse(fs.readFileSync('etiquetas.json', 'utf8'));
let semilla = 7; const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const VAR = {
  original: (fr) => fr,
  girada_8: (fr, W, H) => fr.map(([t, p]) => [t, p && p.map(([x, y, v]) => { const a = 8 * Math.PI / 180, cx = W / 2, cy = H / 2; return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a), v]; })]),
  lejos_60: (fr, W, H) => fr.map(([t, p]) => [t, p && p.map(([x, y, v]) => [W / 2 + (x - W / 2) * 0.6, H / 2 + (y - H / 2) * 0.6, v])]),
  temblor_4px: (fr) => fr.map(([t, p]) => [t, p && p.map(([x, y, v]) => [x + 4 * gauss(), y + 4 * gauss(), v])]),
  paneo: (fr, W) => fr.map(([t, p]) => { const dx = 0.06 * W * Math.sin(t * 0.7), dy = 0.03 * W * Math.sin(t * 0.45); return [t, p && p.map(([x, y, v]) => [x + dx, y + dy, v])]; }),
  rapido_125: (fr) => fr.map(([t, p]) => [t / 1.25, p]),
  lento_080: (fr) => fr.map(([t, p]) => [t / 0.8, p]),
};
const res = {};
for (const [nom, e] of Object.entries(et)) {
  if (!e.ej || e.omitir || !fs.existsSync(`kp/${nom}.json.gz`)) continue;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(`kp/${nom}.json.gz`))), ej = POR_ID[e.ej];
  const masa = ej.perfil === 'corporal' ? Math.max(5, 77.8 * (ej.fraccion || 1)) : e.kg || 60;
  for (const [vn, f] of Object.entries(VAR)) {
    const fr = f(d.frames, d.W, d.H), dur = vn === 'rapido_125' ? d.dur / 1.25 : vn === 'lento_080' ? d.dur / 0.8 : d.dur;
    const frames = fr.map(([t, p]) => ({ t, puntos: p })), full = interpolar(frames, 60, dur);
    for (const [modo, extra] of [['viejo', { sinAngulos: true }], ['nuevo', { frames }]]) {
      let n = -1; try { n = analizar(full, 60, ej, { masa, alfa: ej.perfil === 'riel' ? 45 : 90, relacion: 1, altura: 1.68, ...extra }).reps.length; } catch (err) {}
      const k = `${vn}|${modo}`; res[k] = res[k] || [0, 0]; res[k][1]++; if (n === e.reps) res[k][0]++;
    }
  }
}
for (const vn of Object.keys(VAR)) console.log(vn.padEnd(12), 'viejo', res[`${vn}|viejo`].join('/'), '  nuevo', res[`${vn}|nuevo`].join('/'));
