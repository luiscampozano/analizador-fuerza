// Equipo de cada deporte (v2.51.0): los valores estándar que usa la física del análisis (peso de guantes, raqueta,
// balón...). Vienen puestos con lo que ya usaba la app; un deportista avanzado puede cambiarlos y se guardan en el
// teléfono (af_equipo_<tipo>). Con los valores estándar el resultado es EXACTAMENTE el de antes.
// Campo: { k, nombre, unidad, def, min, max, paso, ayuda } o, en vez de unidad/min/max, opciones: [[valor, texto], ...]
export const EQUIPO = {
  boxeo: [],
  futbol: [],
  // diámetro = circunferencia/π con las medidas FIBA 2026 (talla 7: 750-770 mm; 6: 715-730 mm; 5: 685-700 mm). El
  // balón NBA (29,5 pulg. = 749 mm) es talla 7. El peso del balón no se pide: ningún número del básquet lo usa.
  basquet: [
    { k: 'diametro', nombre: 'Talla del balón', def: 24, opciones: [[24, '7 · 24 cm (hombres y NBA)'], [23, '6 · 23 cm (mujeres)'], [22, '5 · 22 cm (minibásquet)']],
      ayuda: 'Sirve para que la IA del balón reconozca el balón en el video. El peso del balón no cambia ningún resultado.' },
  ],
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
