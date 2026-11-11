// Equipo de cada deporte (v2.51.0): los valores estándar que usa la física del análisis (peso de guantes, raqueta,
// balón...). Vienen puestos con lo que ya usaba la app; un deportista avanzado puede cambiarlos y se guardan en el
// teléfono (af_equipo_<tipo>). Con los valores estándar el resultado es EXACTAMENTE el de antes.
// Campo: { k, nombre, unidad, def, min, max, paso, ayuda } o, en vez de unidad/min/max, opciones: [[valor, texto], ...]
export const EQUIPO = {
  // 10 oz = guante olímpico con el que está calibrada la fuerza del golpe (Walilko 2005; reglamento AIBA de la época)
  boxeo: [
    { k: 'guantes', nombre: 'Peso de los guantes', unidad: 'oz', def: 10, min: 4, max: 20, paso: 2, ayuda: 'Más acolchado alarga el choque y baja el pico de fuerza; el peso del guante suma un poco. Competencia: 10-12 oz; sparring: 14-16 oz; MMA: 4-6 oz.' },
  ],
  futbol: [],
  basquet: [],
  voley: [],
  raqueta: [],
};
const valido = (c, v) => (c.opciones ? c.opciones.some((o) => o[0] === v) : Number.isFinite(v) && v >= c.min && v <= c.max);
// valores que usa el cálculo: lo guardado si es válido; si no, el estándar
export function valoresEquipo(tipo, guardado) {
  const o = {};
  for (const c of EQUIPO[tipo] || []) {
    const g = guardado && guardado[c.k], v = c.opciones ? g : g === '' || g == null ? NaN : +g;
    o[c.k] = valido(c, v) ? v : c.def;
  }
  return o;
}
// campos distintos del estándar (para avisar en el informe qué se cambió)
export function cambiados(tipo, vals) {
  return (EQUIPO[tipo] || []).filter((c) => vals && vals[c.k] !== c.def).map((c) => ({ ...c, valor: vals[c.k] }));
}
export const textoValor = (c, v) => (c.opciones ? (c.opciones.find((o) => o[0] === v) || [v, String(v)])[1] : `${String(v).replace('.', ',')} ${c.unidad}`.trim());
export const tieneEquipo = (tipo) => (EQUIPO[tipo] || []).length > 0;
