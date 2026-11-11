// Equipo de cada deporte (v2.51.0): los valores estándar que usa la física del análisis (peso de guantes, raqueta,
// balón...). Vienen puestos con lo que ya usaba la app; un deportista avanzado puede cambiarlos y se guardan en el
// teléfono (af_equipo_<tipo>). Con los valores estándar el resultado es EXACTAMENTE el de antes.
// Campo: { k, nombre, unidad, def, min, max, paso, ayuda } o, en vez de unidad/min/max, opciones: [[valor, texto], ...]
export const EQUIPO = {
  boxeo: [],
  futbol: [],
  basquet: [],
  voley: [
    // reglas FIVB 2025-2028 (regla 3.1): sala 65-67 cm de circunferencia (≈ 20,7-21,3 cm de diámetro), 260-280 g,
    // 0,30-0,325 kg/cm² (4,26-4,61 psi); playa 66-68 cm (≈ 21-21,6 cm), 260-280 g, 0,175-0,225 kg/cm² (2,5-3,2 psi)
    { k: 'diametro', nombre: 'Diámetro del balón', unidad: 'cm', def: 21, min: 18, max: 24, paso: 0.1, ayuda: 'Reglamento: 20,7–21,3 cm en sala (65–67 cm de contorno); 21–21,6 cm en playa.' },
    { k: 'pesoBalon', nombre: 'Peso del balón', unidad: 'g', def: 270, min: 150, max: 450, paso: 5, ayuda: 'Reglamento: 260–280 g (sala y playa). Más pesado: sale un poco más lento pero pega más fuerte.' },
    { k: 'presion', nombre: 'Presión de inflado', unidad: 'psi', def: 4.4, min: 1.5, max: 8, paso: 0.1, ayuda: 'Sala: 4,3–4,6 psi (0,30–0,325 kg/cm²). Playa: 2,5–3,2 psi. Más presión: contacto más corto y más fuerza.' },
  ],
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
