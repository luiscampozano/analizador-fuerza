// Sesiones de entrenamiento: las series del mismo dia forman una sesion. Resumenes, progreso semanal y exportacion a Excel.
import { crearExcel } from './excel.js';

export const diaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lunes = (iso) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
// kg movidos en la serie: masa x reps validas (en peso corporal, la masa incluye la parte del cuerpo que se mueve)
export const tonelaje = (r) => (r.masa || r.carga || 0) * (r.repsValidas ?? r.reps ?? 0);

export function agruparSesiones(lista, porId) {
  const dias = new Map();
  for (const r of lista) {
    const k = diaLocal(r.fecha);
    if (!dias.has(k)) dias.set(k, []);
    dias.get(k).push(r);
  }
  return [...dias.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([dia, series]) => {
    series.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const porEj = new Map();
    for (const s of series) { if (!porEj.has(s.ejercicio)) porEj.set(s.ejercicio, []); porEj.get(s.ejercicio).push(s); }
    const ejercicios = [...porEj.entries()].map(([id, ss]) => {
      const e = porId[id] || { nombre: ss[0].nombre || id, perfil: ss[0].perfil };
      // fatiga entre series: velocidad de la mejor rep en la primera serie vs la ultima (solo si el peso no cambio mucho)
      let fatiga = null;
      if (ss.length >= 2) {
        const a = ss[0], b = ss[ss.length - 1];
        if (a.vMejor > 0 && b.vMejor > 0 && Math.abs((b.carga || 0) - (a.carga || 0)) <= Math.max(2.5, 0.05 * (a.carga || 0))) fatiga = 100 * (1 - b.vMejor / a.vMejor);
      }
      return { id, nombre: e.nombre, perfil: e.perfil, series: ss, tonelaje: ss.reduce((t, s) => t + tonelaje(s), 0),
        reps: ss.reduce((t, s) => t + (s.reps || 0), 0), mejorRM: Math.max(0, ...ss.map((s) => (e.perfil === 'corporal' ? s.rmLastre : s.rm) || 0)) || null, fatiga };
    });
    const rpes = series.map((s) => s.rpe).filter((x) => Number.isFinite(x));
    return { dia, fecha: new Date(series[0].fecha), series, ejercicios,
      tonelaje: ejercicios.reduce((t, e) => t + e.tonelaje, 0), reps: ejercicios.reduce((t, e) => t + e.reps, 0),
      rpeMedio: rpes.length ? rpes.reduce((a, b) => a + b) / rpes.length : null,
      duracionMin: (new Date(series[series.length - 1].fecha) - new Date(series[0].fecha)) / 60000 };
  });
}

export function tonelajeSemanal(lista, semanas = 8) {
  const hoy = lunes(new Date().toISOString()), out = [];
  for (let k = semanas - 1; k >= 0; k--) {
    const ini = new Date(hoy); ini.setDate(ini.getDate() - 7 * k);
    const fin = new Date(ini); fin.setDate(fin.getDate() + 7);
    const ss = lista.filter((r) => { const d = new Date(r.fecha); return d >= ini && d < fin; });
    out.push({ ini, tonelaje: ss.reduce((t, s) => t + tonelaje(s), 0), series: ss.length });
  }
  return out;
}

export function exportarExcel(lista, porId) {
  const nombre = (r) => (porId[r.ejercicio] || {}).nombre || r.nombre || r.ejercicio;
  const ordenadas = [...lista].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const series = {
    nombre: 'Series',
    columnas: [{ titulo: 'Fecha', ancho: 17 }, { titulo: 'Ejercicio', ancho: 30 }, { titulo: 'Carga (kg)', ancho: 11, decimales: 1 },
      { titulo: 'Masa movida (kg)', ancho: 15, decimales: 1 }, { titulo: 'Reps', ancho: 7, decimales: 0 }, { titulo: 'Mejor vel. (m/s)', ancho: 14, decimales: 2 },
      { titulo: 'Última vel. (m/s)', ancho: 15, decimales: 2 }, { titulo: 'Pérdida vel. (%)', ancho: 14, decimales: 1 }, { titulo: 'RIR', ancho: 7, decimales: 1 },
      { titulo: 'RPE', ancho: 7, decimales: 1 }, { titulo: '1RM est. (kg)', ancho: 13, decimales: 1 }, { titulo: 'Fuerza pico (kg)', ancho: 15, decimales: 0 },
      { titulo: 'Potencia pico (W)', ancho: 16, decimales: 0 }, { titulo: 'Tonelaje (kg)', ancho: 13, decimales: 0 }, { titulo: 'Desvío barra (cm)', ancho: 16, decimales: 1 },
      { titulo: 'Alertas de técnica', ancho: 40 }, { titulo: 'Origen', ancho: 9 }],
    filas: ordenadas.map((r) => [new Date(r.fecha), nombre(r), r.carga, r.masa, r.reps, r.vMejor, r.vUltima ?? (r.velocidades || []).slice(-1)[0],
      r.perdida, r.rir, r.rpe, r.perfil === 'corporal' ? r.rmLastre : r.rm, r.fPico, r.pPico, tonelaje(r), r.desvio,
      (r.alertas || []).join(' · '), r.origen === 'vivo' ? 'En vivo' : 'Video']),
  };
  const reps = {
    nombre: 'Repeticiones',
    columnas: [{ titulo: 'Fecha', ancho: 17 }, { titulo: 'Ejercicio', ancho: 30 }, { titulo: 'Carga (kg)', ancho: 11, decimales: 1 }, { titulo: 'Rep', ancho: 6, decimales: 0 },
      { titulo: 'Lado', ancho: 6 }, { titulo: 'Recorrido (cm)', ancho: 14, decimales: 1 }, { titulo: 'Vel. media (m/s)', ancho: 15, decimales: 2 },
      { titulo: 'Vel. pico (m/s)', ancho: 14, decimales: 2 }, { titulo: 'Pérdida (%)', ancho: 11, decimales: 1 }, { titulo: 'Fuerza pico (kg)', ancho: 15, decimales: 0 },
      { titulo: 'Potencia pico (W)', ancho: 16, decimales: 0 }, { titulo: 'Subida (s)', ancho: 10, decimales: 2 }, { titulo: 'Desvío (cm)', ancho: 11, decimales: 1 },
      { titulo: 'Parcial', ancho: 8 }, { titulo: 'Alertas', ancho: 40 }],
    filas: ordenadas.flatMap((r) => (r.repsDet && r.repsDet.length ? r.repsDet : (r.velocidades || []).map((v, i) => ({ n: i + 1, v })))
      .map((x) => [new Date(r.fecha), nombre(r), r.carga, x.n, x.lado === 'der' ? 'Der.' : x.lado === 'izq' ? 'Izq.' : '', x.rec, x.v, x.vp, x.perd,
        x.f, x.p, x.ts, x.desvio, x.parcial ? 'Sí' : '', (x.alertas || []).join(' · ')])),
  };
  const ses = agruparSesiones(lista, porId).reverse();
  const sesiones = {
    nombre: 'Sesiones',
    columnas: [{ titulo: 'Día', ancho: 12 }, { titulo: 'Ejercicio', ancho: 30 }, { titulo: 'Series', ancho: 8, decimales: 0 }, { titulo: 'Reps', ancho: 7, decimales: 0 },
      { titulo: 'Tonelaje (kg)', ancho: 13, decimales: 0 }, { titulo: 'Mejor 1RM est. (kg)', ancho: 18, decimales: 1 }, { titulo: 'Caída de vel. 1.ª→última serie (%)', ancho: 30, decimales: 1 }],
    filas: ses.flatMap((s) => s.ejercicios.map((e) => [s.dia, e.nombre, e.series.length, e.reps, e.tonelaje, e.mejorRM, e.fatiga])),
  };
  return crearExcel([sesiones, series, reps]);
}
