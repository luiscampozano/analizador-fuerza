// v2.51.0 Equipo de boxeo (peso de los guantes): con el estándar (10 oz) el análisis es idéntico a antes; con guantes
// más acolchados la fuerza estimada baja un poco y con guantes finos (MMA) sube; valores fuera de rango usan el estándar.
// Modelo: F × √(1 + Δm/m_ef) × (10/oz)^0,2 (ver js/actividad.js). Uso: node pruebas/actividad/equipo_boxeo.mjs
import { readFileSync } from 'fs'; import { gunzipSync } from 'zlib';
import { analizarActividad } from '../../js/actividad.js';
import { POR_ID } from '../../js/ejercicios.js';
import { valoresEquipo } from '../../js/equipo.js';
const d = JSON.parse(gunzipSync(readFileSync(new URL('./boxeo_real.json.gz', import.meta.url))));
const frames = d.frames.map(([t, p]) => ({ t, puntos: p && p.length ? p : null }));
const cfg = { altura: 1.68, peso: 77.8 };
const correr = (guardado) => analizarActividad(frames, d.dur, POR_ID.boxeo, guardado === undefined ? cfg : { ...cfg, equipo: valoresEquipo('boxeo', guardado) });
let mal = 0;
const revisa = (ok, txt) => { console.log((ok ? 'bien  ' : 'FALLA ') + txt); if (!ok) mal++; };
const base = correr();
const fb = base.eventos.map((e) => e.fuerza);
revisa(fb.length > 0 && fb.every(Number.isFinite), `hay golpes con fuerza (${fb.length})`);
revisa(JSON.stringify(correr({})) === JSON.stringify(base), 'sin cambios = idéntico a antes');
revisa(JSON.stringify(correr({ guantes: 10 })) === JSON.stringify(base), '10 oz explícito = idéntico a antes');
// factor esperado para un recto de 77,8 kg (m_ef = 0,022 × 77,8 kg)
const esperado = (oz, clase) => { const m = 77.8 * (clase === 'recto' ? 0.022 : 0.019); return Math.sqrt(1 + (oz - 10) * 0.02835 / m) * Math.pow(10 / oz, 0.2); };
for (const [oz, dir] of [[16, -1], [20, -1], [4, 1], [6, 1], [12, -1]]) {
  const a = correr({ guantes: oz });
  revisa(a.eventos.length === base.eventos.length && a.eventos.every((e, i) => e.t === base.eventos[i].t && e.v === base.eventos[i].v), `${oz} oz: mismos golpes y velocidades`);
  const rel = a.fuerzaGolpe.max / base.fuerzaGolpe.max - 1, fRecto = esperado(oz, 'recto') - 1;
  revisa(Math.sign(rel) === dir && Math.abs(rel) < 0.2, `${oz} oz: fuerza máx. ${base.fuerzaGolpe.max} → ${a.fuerzaGolpe.max} kg (${(rel * 100).toFixed(1)} %, modelo recto ${(fRecto * 100).toFixed(1)} %)`);
  // golpe por golpe: el factor debe ser el del modelo según la clase (ambas fuerzas vienen redondeadas a kg enteros)
  const okUno = a.eventos.every((e, i) => Math.abs(e.fuerza - base.eventos[i].fuerza * esperado(oz, e.clase)) <= 0.5 * esperado(oz, e.clase) + 0.5 + 1e-9);
  revisa(okUno, `${oz} oz: cada golpe cambia según el modelo`);
}
// fuera de rango o basura: se usa el estándar
for (const g of [2, 30, -5, 'abc', '', null]) revisa(JSON.stringify(correr({ guantes: g })) === JSON.stringify(base), `guantes = ${JSON.stringify(g)} → estándar`);
console.log(mal ? `FALLA equipo boxeo (${mal})` : 'OK equipo boxeo');
