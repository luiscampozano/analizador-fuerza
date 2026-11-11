// Equipo de cada deporte (v2.51.0): los valores estándar que usa la física del análisis (peso de guantes, raqueta,
// balón...). Vienen puestos con lo que ya usaba la app; un deportista avanzado puede cambiarlos y se guardan en el
// teléfono (af_equipo_<tipo>). Con los valores estándar el resultado es EXACTAMENTE el de antes.
// Campo: { k, nombre, unidad, def, min, max, paso, ayuda } o, en vez de unidad/min/max, opciones: [[valor, texto], ...]
export const EQUIPO = {
  // 10 oz = guante olímpico con el que está calibrada la fuerza del golpe (Walilko 2005; reglamento AIBA de la época)
  boxeo: [
    { k: 'guantes', nombre: 'Peso de los guantes', unidad: 'oz', def: 10, min: 4, max: 20, paso: 2, ayuda: 'El acolchado baja el pico de fuerza y el peso del guante suma masa: el efecto neto es de pocos %. Competencia: 10–12 oz; sparring: 14–16 oz; MMA: 4–6 oz.' },
  ],
  // fútbol: reglas IFAB/FIFA (talla 5: 68–70 cm, 410–450 g, 0,6–1,1 atm); el pie se mide en el video, así que el
  // calzado suma masa al golpe; la presión cambia el rebote y lo que dura el contacto
  futbol: [
    { k: 'masa', nombre: 'Peso del balón', unidad: 'g', def: 430, min: 250, max: 500, paso: 5, ayuda: 'Talla 5 (oficial): 410–450 g · talla 4: 350–390 g · talla 3: 300–320 g · fútbol sala: 400–440 g.' },
    { k: 'diametro', nombre: 'Diámetro del balón', unidad: 'cm', def: 22, min: 17, max: 24, paso: 0.1, ayuda: 'Circunferencia ÷ 3,14. Talla 5: 68–70 cm (≈22) · talla 4: 63,5–66 (≈20,5) · talla 3: 58,5–61 (≈19) · fútbol sala: 62–64 (≈20).' },
    { k: 'presion', nombre: 'Presión del balón', unidad: 'bar', def: 0.9, min: 0.4, max: 1.2, paso: 0.05, ayuda: 'Reglamento: 0,6–1,1 atm (≈ bar). Más inflado: rebota un poco más y el contacto dura menos (golpe más fuerte).' },
    { k: 'calzado', nombre: 'Peso de cada zapato', unidad: 'g', def: 220, min: 0, max: 900, paso: 10, ayuda: 'Zapatos de fútbol de hoy: 160–250 g. 0 = descalzo. Un zapato más pesado empuja más al balón con el pie a la misma velocidad.' },
  ],
  // diámetro = circunferencia/π con las medidas FIBA 2026 (talla 7: 750-770 mm; 6: 715-730 mm; 5: 685-700 mm). El
  // balón NBA (29,5 pulg. = 749 mm) es talla 7. El peso del balón no se pide: ningún número del básquet lo usa.
  basquet: [
    { k: 'diametro', nombre: 'Talla del balón', def: 24, opciones: [[24, '7 · 24 cm (hombres y NBA)'], [23, '6 · 23 cm (mujeres)'], [22, '5 · 22 cm (minibásquet)']],
      ayuda: 'Sirve para que la IA del balón reconozca el balón en el video. El peso del balón no cambia ningún resultado.' },
  ],
  voley: [
    // reglas FIVB 2025-2028 (regla 3.1): sala 65-67 cm de circunferencia (≈ 20,7-21,3 cm de diámetro), 260-280 g,
    // 0,30-0,325 kg/cm² (4,26-4,61 psi); playa 66-68 cm (≈ 21-21,6 cm), 260-280 g, 0,175-0,225 kg/cm² (2,5-3,2 psi)
    { k: 'diametro', nombre: 'Diámetro del balón', unidad: 'cm', def: 21, min: 18, max: 24, paso: 0.1, ayuda: 'Reglamento: 20,7–21,3 cm en sala (65–67 cm de contorno); 21–21,6 cm en playa.' },
    { k: 'pesoBalon', nombre: 'Peso del balón', unidad: 'g', def: 270, min: 150, max: 450, paso: 5, ayuda: 'Reglamento: 260–280 g (sala y playa). Más pesado: sale un poco más lento pero pega más fuerte.' },
    { k: 'presion', nombre: 'Presión de inflado', unidad: 'psi', def: 4.4, min: 1.5, max: 8, paso: 0.1, ayuda: 'Sala: 4,3–4,6 psi (0,30–0,325 kg/cm²). Playa: 2,5–3,2 psi. Más presión: contacto más corto y más fuerza.' },
  ],
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
