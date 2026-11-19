// v2.67.0 kilos o libras. Los datos SIEMPRE se guardan en kg; las libras solo se usan al mostrar y al escribir.
// - af_unidades: unidad por defecto ('kg' | 'lb'), en Perfil → ⚙️ Ajustes.
// - af_unidad_ej: unidad recordada por ejercicio ({ id: 'lb' }), p. ej. mancuernas en libras y barra en kilos.
// - af_unidad_resumen: unidad elegida para el resumen y las tarjetas al terminar (si la persona pidió recordarla).
export const LB = 0.45359237; // kg en una libra (exacto)
const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const guardar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* nada */ } };
const leerJ = (k) => { try { const o = JSON.parse(leer(k) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };

export const global = () => (leer('af_unidades') === 'lb' ? 'lb' : 'kg');
export const ponerGlobal = (u) => guardar('af_unidades', u === 'lb' ? 'lb' : null);
export const delEjercicio = (id) => { const u = id ? leerJ('af_unidad_ej')[id] : null; return u === 'lb' || u === 'kg' ? u : global(); };
export function recordarEjercicio(id, u) { if (!id) return; const m = leerJ('af_unidad_ej'); m[id] = u; guardar('af_unidad_ej', JSON.stringify(m)); } // sin id (ejercicio propio): solo ese entreno
export const resumenGuardado = () => { const u = leer('af_unidad_resumen'); return u === 'lb' || u === 'kg' ? u : null; };
export const guardarResumen = (u) => guardar('af_unidad_resumen', u);

// número de kg a la unidad u (sin redondear) y de vuelta
export const desdeKg = (kg, u) => (u === 'lb' ? kg / LB : kg);
export const aKg = (v, u) => (u === 'lb' ? v * LB : v);
// valor para mostrar en un campo: libras con 1 decimal como máximo (45 lb → 20,41 kg guardados → vuelve a 45)
export function paraCampo(kg, u) {
  if (!Number.isFinite(kg)) return '';
  const v = desdeKg(kg, u);
  return String(Math.round(v * (u === 'lb' ? 10 : 100)) / (u === 'lb' ? 10 : 100));
}
export const nombre = (u) => (u === 'lb' ? 'lb' : 'kg');
// número escrito en español (1.020,5) → 1020.5
export const numEs = (t) => parseFloat(String(t || '').replace(/\./g, '').replace(',', '.'));
// textos ya armados en kg (récords: «102,5 kg (90 × 5)», «90 kg × 5») pasados a libras
export function textoEn(txt, u) {
  if (u !== 'lb' || !txt) return txt;
  return String(txt).replace(/(\d[\d.]*(?:,\d+)?)(\s?kg| ×)/g, (m0, n, suf) => {
    const v = Math.round(desdeKg(numEs(n), 'lb') * 10) / 10;
    return `${v.toLocaleString('es-EC', { maximumFractionDigits: 1 })}${suf.trim() === 'kg' ? ' lb' : suf}`;
  });
}
