// Analisis de entrenamiento basado en velocidad (VBT): RIR, RPE, 1RM estimado y cargas sugeridas.
import { ECUACIONES } from './ejercicios.js';

const r1 = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const lim = (x, a, b) => Math.max(a, Math.min(b, x));
// Epley: 1RM = w (1 + reps/30)  <->  reps posibles a un %1RM
export const epley1RM = (w, reps) => w * (1 + reps / 30);
export const repsAPorcentaje = (pct) => Math.max(0, 30 * (100 / pct - 1));
export const cargaParaReps = (rm, reps) => rm / (1 + reps / 30);

function regresion(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (!sxx) return null;
  const b = sxy / sxx; return { b, a: my - b * mx };
}

// carga: kg que el usuario carga (discos+barra, pila, o lastre) · masaTotal: kg que se mueven en el eje
export function analizarSerie(res, ej, { carga, masaTotal, pesoCorporal, perfil }) {
  const reps = res.reps.filter((r) => !r.parcial);
  const out = { reps: res.reps.length, validas: reps.length, notas: [] };
  if (!reps.length) return out;
  const vel = reps.map((r) => r.v_media);
  const iMejor = vel.indexOf(Math.max(...vel));
  out.vMejor = vel[iMejor];
  out.vUltima = vel[vel.length - 1];
  out.perdida = 100 * (1 - out.vUltima / out.vMejor);
  out.tut = res.reps.reduce((a, r) => a + r.t_subida + r.t_bajada, 0);
  out.trabajo = res.reps.reduce((a, r) => a + Math.max(0, r.trabajo_j), 0);
  out.pPico = Math.max(...reps.map((r) => r.p_pico));
  out.fPico = Math.max(...reps.map((r) => r.f_pico));
  out.recorridoCV = (() => {
    const rc = reps.map((r) => r.recorrido_cm), m = rc.reduce((a, b) => a + b) / rc.length;
    return 100 * Math.sqrt(rc.reduce((a, b) => a + (b - m) ** 2, 0) / rc.length) / m;
  })();

  // 1) RIR por tendencia de velocidad: se extrapola la caida por rep hasta la velocidad minima (MVT)
  const desde = reps.slice(iMejor); // la 1.a rep suele ser lenta (arranca desde parado)
  let rirVel = null;
  if (desde.length >= 3) {
    const reg = regresion(desde.map((_, i) => i), desde.map((r) => r.v_media));
    if (reg && reg.b < -0.005) rirVel = lim((out.vUltima - ej.mvt) / -reg.b, 0, 12);
    else out.notas.push('La velocidad casi no bajó durante la serie: te quedaron bastantes repeticiones en reserva.');
  }
  if (rirVel === null && desde.length >= 3 && out.vUltima <= ej.mvt * 1.15) rirVel = 0;

  // 2) %1RM por ecuacion carga-velocidad de referencia (solo ejercicios con ecuacion validada)
  let pct = null;
  if (ej.ecuacion && ECUACIONES[ej.ecuacion]) {
    pct = lim(ECUACIONES[ej.ecuacion].f(out.vMejor), 30, 100);
    out.ecuacion = ECUACIONES[ej.ecuacion].ref;
  }
  let rirPct = null;
  if (pct !== null) rirPct = lim(repsAPorcentaje(pct) - reps.length, 0, 20);

  const rirs = [rirVel, rirPct].filter((x) => x !== null);
  if (rirs.length) {
    out.rir = rirs.reduce((a, b) => a + b) / rirs.length;
  } else if (out.perdida < 10) {
    out.rir = null; out.rirTexto = '≥ 5';
  }
  // por perdida de velocidad (Rodríguez-Rosell, González-Badillo): ~20 % = mitad de las reps posibles
  const pocas = reps.length < 3 && pct === null;
  if (pocas) {
    out.rir = null; out.rirTexto = '—';
    out.notas.push('Con menos de 3 repeticiones no se puede estimar el RIR ni el 1RM con confianza. Graba la serie completa.');
  }
  if (!pocas && (out.rir === undefined || out.rir === null)) {
    if (!out.rirTexto && out.perdida >= 10) {
      const frac = lim(out.perdida / 40, 0.25, 1); // 40 % de perdida ~ cerca del fallo
      out.rir = lim(reps.length * (1 / frac - 1), 0, 10);
    }
  }
  if (out.rir !== null && out.rir !== undefined) {
    out.rir = Math.round(out.rir * 2) / 2;
    out.rirTexto = out.rir >= 5 ? '≥ 5' : String(out.rir).replace('.', ',');
    out.rpe = lim(10 - out.rir, 5, 10);
  } else {
    out.rpe = pocas ? null : 5;
  }
  out.rpeTexto = out.rpe === null ? '—' : out.rpe <= 5 ? '≤ 5' : String(out.rpe).replace('.', ',');

  // 3) 1RM estimado (en las mismas unidades que la carga), combinando metodos
  const est = [];
  const rirParaRM = out.rir ?? 5;
  const masaRM = perfil === 'corporal' ? masaTotal : carga;
  if (masaRM > 0 && !pocas) {
    est.push({ metodo: 'Repeticiones + RIR (Epley)', valor: epley1RM(masaRM, reps.length + rirParaRM) });
    if (pct !== null) est.push({ metodo: 'Velocidad (' + out.ecuacion + ')', valor: masaRM / (pct / 100) });
  }
  if (est.length) {
    const vals = est.map((e) => e.valor);
    out.rm = vals.reduce((a, b) => a + b) / vals.length;
    out.rmMin = Math.min(...vals); out.rmMax = Math.max(...vals);
    out.metodos = est;
    out.pct = 100 * masaRM / out.rm;
    if (perfil === 'corporal') {
      out.rmLastre = out.rm - (masaTotal - carga); // lo que podrias colgarte como lastre en 1 rep
    }
    out.tablaCargas = [1, 2, 3, 5, 6, 8, 10, 12, 15].map((rp) => {
      let w = rp === 1 ? out.rm : cargaParaReps(out.rm, rp);
      if (perfil === 'corporal') w -= (masaTotal - carga);
      return { reps: rp, carga: Math.max(0, w) };
    });
  }

  // 4) zona e interpretacion
  const p = out.pct;
  out.zona = p === undefined ? '' : p >= 85 ? 'Fuerza máxima' : p >= 70 ? 'Fuerza–hipertrofia' : p >= 55 ? 'Hipertrofia / resistencia' : 'Velocidad / técnica';
  out.fatiga = out.perdida < 10 ? 'Muy baja' : out.perdida < 20 ? 'Baja' : out.perdida < 30 ? 'Moderada' : out.perdida < 40 ? 'Alta' : 'Muy alta';
  const rec = [];
  if (out.perdida >= 40) rec.push('Perdiste más del 40 % de velocidad: serie cerca del fallo. Bien para hipertrofia, pero exige más recuperación.');
  else if (out.perdida >= 20) rec.push('Pérdida de velocidad del 20–40 %: rango típico de hipertrofia.');
  else rec.push('Pérdida de velocidad menor al 20 %: serie de calidad, ideal para fuerza y potencia con poca fatiga.');
  if (out.rir !== null && out.rir !== undefined && out.rir >= 4) rec.push('Te quedaban varias reps. Si buscas hipertrofia puedes subir el peso o hacer más reps.');
  if (out.rir !== null && out.rir !== undefined && out.rir <= 1) rec.push('Estuviste a 0–1 rep del fallo. No conviene llegar así en todas las series.');
  if (out.recorridoCV > 12) rec.push('El recorrido varió bastante entre reps: busca un rango de movimiento más constante.');
  out.recomendaciones = rec;
  out.redondeo = (x) => r1(x, 1);
  return out;
}

// Perfil carga-velocidad con el historial: con 2+ cargas distintas se estima el 1RM en la MVT
export function perfilCargaVelocidad(historial, ej) {
  const pts = historial.filter((h) => h.ejercicio === ej.id && h.vMejor > 0 && h.carga > 0);
  const porCarga = new Map();
  for (const h of pts) porCarga.set(h.carga, Math.max(porCarga.get(h.carga) || 0, h.vMejor));
  if (porCarga.size < 2) return null;
  const cargas = [...porCarga.keys()], vels = cargas.map((c) => porCarga.get(c));
  const reg = regresion(vels, cargas); // carga = a + b * v
  if (!reg || reg.b >= 0) return null;
  const rm = reg.a + reg.b * ej.mvt;
  if (!(rm > Math.max(...cargas) * 0.9) || rm > Math.max(...cargas) * 3) return null;
  return { rm, puntos: cargas.length, cargas, vels, reg };
}
