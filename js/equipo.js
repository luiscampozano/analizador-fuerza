// Equipo de cada deporte (v2.51.0): los valores estándar que usa la física del análisis (peso de guantes, raqueta,
// balón...). Vienen puestos con lo que ya usaba la app; un deportista avanzado puede cambiarlos y se guardan en el
// teléfono (af_equipo_<tipo>). Con los valores estándar el resultado es EXACTAMENTE el de antes.
// Campo: { k, nombre, unidad, def, min, max, paso, ayuda } o, en vez de unidad/min/max, opciones: [[valor, texto], ...]
export const EQUIPO = {
  boxeo: [],
  // fútbol: reglas IFAB/FIFA (talla 5: 68–70 cm, 410–450 g, 0,6–1,1 atm); el pie se mide en el video, así que el
  // calzado suma masa al golpe; la presión cambia el rebote y lo que dura el contacto
  futbol: [
    { k: 'masa', nombre: 'Peso del balón', unidad: 'g', def: 430, min: 250, max: 500, paso: 5, ayuda: 'Talla 5 (oficial): 410–450 g · talla 4: 350–390 g · talla 3: 300–320 g · fútbol sala: 400–440 g.' },
    { k: 'diametro', nombre: 'Diámetro del balón', unidad: 'cm', def: 22, min: 17, max: 24, paso: 0.1, ayuda: 'Circunferencia ÷ 3,14. Talla 5: 68–70 cm (≈22) · talla 4: 63,5–66 (≈20,5) · talla 3: 58,5–61 (≈19) · fútbol sala: 62–64 (≈20).' },
    { k: 'presion', nombre: 'Presión del balón', unidad: 'bar', def: 0.9, min: 0.4, max: 1.2, paso: 0.05, ayuda: 'Reglamento: 0,6–1,1 atm (≈ bar). Más inflado: rebota un poco más y el contacto dura menos (golpe más fuerte).' },
    { k: 'calzado', nombre: 'Peso de cada zapato', unidad: 'g', def: 220, min: 0, max: 900, paso: 10, ayuda: 'Zapatos de fútbol (pupos) de hoy: 160–250 g. 0 = descalzo. Un zapato más pesado empuja más al balón con el pie a la misma velocidad.' },
  ],
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
