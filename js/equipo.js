// Equipo de cada deporte (v2.51.0): los valores estándar que usa la física del análisis (peso de guantes, raqueta,
// balón...). Vienen puestos con lo que ya usaba la app; un deportista avanzado puede cambiarlos y se guardan en el
// teléfono (af_equipo_<tipo>). Con los valores estándar el resultado es EXACTAMENTE el de antes.
// Campo: { k, nombre, unidad, def, min, max, paso, ayuda } o, en vez de unidad/min/max, opciones: [[valor, texto], ...]
export const EQUIPO = {
  boxeo: [],
  futbol: [],
  basquet: [],
  voley: [],
  // tenis y pádel. Estándar = lo que usaba la física: raqueta de 300 g (0,3 kg efectivos en el impacto), 68,5 cm
  // (la cabeza va 2 veces más rápido que la mano), cuerdas a 25 kg (rebote 0,75, contacto 5 ms), pelota de 58 g y 6,6 cm
  raqueta: [
    { k: 'peso', nombre: 'Peso de la raqueta', unidad: 'g', def: 300, min: 200, max: 450, paso: 5, ayuda: 'Con cuerdas. Tenis 260–340 g; pádel 340–390 g. Más pesada = la pelota sale algo más rápido.' },
    { k: 'largo', nombre: 'Largo de la raqueta', unidad: 'cm', def: 68.5, min: 40, max: 74, paso: 0.5, ayuda: 'Tenis 68,5 cm (máx. 73,7); pádel 45,5 cm (máx.). Más larga = la cabeza va más rápido.' },
    { k: 'tension', nombre: 'Tensión de las cuerdas', unidad: 'kg', def: 25, min: 15, max: 32, paso: 0.5, ayuda: 'Tenis 22–28 kg (48–62 lb). Menos tensión = contacto más largo y fuerza media menor. En pádel (sin cuerdas) déjalo en 25.' },
    { k: 'pelota', nombre: 'Peso de la pelota', unidad: 'g', def: 58, min: 45, max: 62, paso: 0.5, ayuda: 'Reglamento ITF y FIP: 56,0–59,4 g. Pelotas de iniciación pesan menos.' },
    { k: 'diametro', nombre: 'Diámetro de la pelota', unidad: 'cm', def: 6.6, min: 5.5, max: 7.5, paso: 0.1, ayuda: 'Tenis 6,54–7,30 cm (ITF); pádel 6,35–6,77 cm (FIP). Ayuda a la IA a reconocer la pelota.' },
  ],
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
