// Calculos de progreso a partir del registro de entrenamientos: 1RM estimado, records personales,
// cargas sugeridas por RPE (autorregulacion), calculadora de discos y resumen por grupo muscular.
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export const claveEj = (e) => (e.ej ? e.ej : 'n:' + norm(e.nombre));
const valida = (s) => s.hecha && s.tipo !== 'calentamiento' && s.kg > 0 && s.reps > 0;

// 1RM estimado (Epley). Con RPE se suman las reps en reserva (RIR = 10 - RPE).
export function e1rm(kg, reps, rpe = null) {
  if (!(kg > 0) || !(reps > 0) || reps > 15) return null;
  const total = reps + (rpe >= 5 && rpe <= 10 ? 10 - rpe : 0);
  return total <= 1 ? kg : kg * (1 + total / 30);
}
// carga para hacer `reps` repeticiones a un RPE dado, con un 1RM de referencia
export function cargaPara(rm, reps, rpe = 10) {
  if (!(rm > 0) || !(reps > 0)) return null;
  const total = reps + (rpe >= 5 && rpe <= 10 ? 10 - rpe : 0);
  return total <= 1 ? rm : rm / (1 + total / 30);
}
export const redondear = (x, paso = 2.5) => Math.round(x / paso) * paso;

// Records y evolucion de un ejercicio. `lista` va del mas reciente al mas antiguo.
export function registros(lista, clave) {
  const r = { mejor: null, maxKg: null, maxVol: null, repMax: {}, puntos: [], sesiones: [] };
  for (let i = lista.length - 1; i >= 0; i--) {
    const en = lista[i];
    const ejs = en.ejercicios.filter((e) => claveEj(e) === clave);
    if (!ejs.length) continue;
    const series = ejs.flatMap((e) => e.series).filter(valida);
    r.sesiones.push({ id: en.id, fecha: en.inicio, series: ejs.flatMap((e) => e.series).filter((s) => s.hecha) });
    if (!series.length) continue;
    let mejorHoy = 0, kgHoy = 0;
    for (const s of series) {
      const est = e1rm(s.kg, s.reps);
      if (est && (!r.mejor || est > r.mejor.valor)) r.mejor = { valor: est, kg: s.kg, reps: s.reps, fecha: en.inicio };
      if (!r.maxKg || s.kg > r.maxKg.kg) r.maxKg = { kg: s.kg, reps: s.reps, fecha: en.inicio };
      if (!r.maxVol || s.kg * s.reps > r.maxVol.vol) r.maxVol = { vol: s.kg * s.reps, kg: s.kg, reps: s.reps, fecha: en.inicio };
      for (let n = 1; n <= Math.min(10, s.reps); n++) if (!r.repMax[n] || s.kg > r.repMax[n].kg) r.repMax[n] = { kg: s.kg, reps: s.reps, fecha: en.inicio };
      if (est) mejorHoy = Math.max(mejorHoy, est);
      kgHoy = Math.max(kgHoy, s.kg);
    }
    r.puntos.push({ fecha: en.inicio, e1rm: mejorHoy || null, kg: kgHoy });
  }
  r.sesiones.reverse();
  return r;
}

// Records nuevos de un entrenamiento recien terminado, comparado con todo lo anterior.
export function recordsNuevos(entreno, previos, nombre) {
  const out = [];
  for (const e of entreno.ejercicios) {
    const series = e.series.filter(valida); if (!series.length) continue;
    const r = registros(previos, claveEj(e));
    if (!r.puntos.length) continue; // primera vez: no se cuenta como record
    const mejor = (f) => series.reduce((m, s) => (f(s) > f(m) ? s : m), series[0]);
    const sE = mejor((s) => e1rm(s.kg, s.reps) || 0), sK = mejor((s) => s.kg), sV = mejor((s) => s.kg * s.reps);
    const lista = [];
    if (r.mejor && e1rm(sE.kg, sE.reps) > r.mejor.valor + 0.01) lista.push({ tipo: '1RM estimado', texto: `${fmt1(e1rm(sE.kg, sE.reps))} kg (${fmt1(sE.kg)} × ${sE.reps})` });
    if (r.maxKg && sK.kg > r.maxKg.kg + 0.01) lista.push({ tipo: 'Peso máximo', texto: `${fmt1(sK.kg)} kg × ${sK.reps}` });
    if (r.maxVol && sV.kg * sV.reps > r.maxVol.vol + 0.01) lista.push({ tipo: 'Mejor serie (volumen)', texto: `${fmt1(sV.kg)} kg × ${sV.reps}` });
    for (const s of series) if (s.reps <= 10 && r.repMax[s.reps] && s.kg > r.repMax[s.reps].kg + 0.01 && !lista.some((x) => x.tipo === `${s.reps}RM`)) lista.push({ tipo: `${s.reps}RM`, texto: `${fmt1(s.kg)} kg` });
    if (lista.length) out.push({ nombre: nombre(e), records: lista });
  }
  return out;
}
const fmt1 = (x) => (Math.round(x * 10) / 10).toLocaleString('es-EC');

// 1RM real (marca de competencia o de prueba) guardado por el usuario
const CLAVE_RM = 'af_1rm_real';
function leerRM() { try { return JSON.parse(localStorage.getItem(CLAVE_RM) || '{}'); } catch (e) { return {}; } }
export function rmReal(clave) { const x = leerRM()[clave]; return x && x.kg > 0 ? x : null; }
export function guardarRmReal(clave, kg) {
  const t = leerRM();
  if (kg > 0) t[clave] = { kg, fecha: new Date().toISOString() }; else delete t[clave];
  try { localStorage.setItem(CLAVE_RM, JSON.stringify(t)); } catch (e) { /* nada */ }
}

// 1RM de referencia para sugerir cargas: el de hoy (si ya hiciste una serie con RPE), tu 1RM real,
// o el mejor 1RM estimado de los ultimos 90 dias.
export function referencia(lista, e, seriesHoy = []) {
  let hoy = 0;
  for (const s of seriesHoy) if (s.hecha && s.tipo !== 'calentamiento' && s.rpe) hoy = Math.max(hoy, e1rm(s.kg, s.reps, s.rpe) || 0);
  if (hoy) return { kg: hoy, fuente: 'hoy' };
  const real = rmReal(claveEj(e));
  if (real) return { kg: real.kg, fuente: 'real' };
  const desde = Date.now() - 90 * 86400000;
  const r = registros(lista.filter((en) => new Date(en.inicio).getTime() >= desde), claveEj(e));
  if (r.mejor) return { kg: r.mejor.valor, fuente: 'reciente' };
  const t = registros(lista, claveEj(e)); // sin datos recientes: el mejor de todo el historial
  return t.mejor ? { kg: t.mejor.valor, fuente: 'historial' } : null;
}

// Calculadora de discos: que poner en cada lado de la barra
export const DISCOS = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
export function discos(objetivo, barra, disponibles = DISCOS) {
  let resto = (objetivo - barra) / 2;
  const lado = [];
  if (resto < 0) return { lado, total: barra, exacto: Math.abs(objetivo - barra) < 0.01 };
  for (const p of [...disponibles].sort((a, b) => b - a)) while (resto >= p - 1e-9) { lado.push(p); resto -= p; }
  const total = barra + 2 * lado.reduce((a, b) => a + b, 0);
  return { lado, total, exacto: Math.abs(total - objetivo) < 0.01 };
}

// Series efectivas por grupo muscular desde una fecha
export function seriesPorGrupo(lista, porId, desde) {
  const out = {};
  for (const en of lista) {
    if (new Date(en.inicio) < desde) continue;
    for (const e of en.ejercicios) {
      const g = (e.ej && porId[e.ej] && (porId[e.ej].musculo || porId[e.ej].grupo)) || 'Otros';
      out[g] = (out[g] || 0) + e.series.filter((s) => s.hecha && s.tipo !== 'calentamiento').length;
    }
  }
  return out;
}
