// Objetivos de nutricion (v2.44.0): calorias y macros segun el objetivo (bajar grasa, mantener, ganar musculo o mas
// fuerza), con limites seguros. Solo calculos (sin pantalla) para poder probarlos. Mifflin-St Jeor x actividad.
export const OBJETIVOS = {
  perder: 'Bajar grasa / bajar de peso',
  mantener: 'Mantener / recomposición',
  ganar: 'Ganar músculo / subir de peso',
  fuerza: 'Levantar más peso (fuerza)',
};
const KCAL_KG = 7700; // kcal aproximadas por kg de peso corporal

export function calcularPlan({ sexo, edad, peso, altura, actividad, objetivo = 'mantener', ritmo = 'normal', pesoMeta = null }) {
  const avisos = [];
  if (!(edad >= 18)) return { bloqueado: 'Los cálculos automáticos son para mayores de 18 años. Para menores, las metas las debe poner un nutricionista o pediatra.' };
  const imc = peso / (altura / 100) ** 2;
  if (objetivo === 'perder' && imc < 18.5) return { bloqueado: 'Tu peso ya está por debajo de lo saludable para tu estatura: no sugerimos bajar más. Si quieres cambiar tu composición, elige «Mantener» o «Ganar músculo», o consulta a un profesional.' };
  const tmb = 10 * peso + 6.25 * altura - 5 * edad + (sexo === 'm' ? -161 : 5);
  const mant = tmb * actividad;
  let kcal = mant;
  if (objetivo === 'perder') {
    const deficit = Math.min(mant * (ritmo === 'suave' ? 0.15 : 0.2), 11 * peso); // como mucho ~1 % del peso por semana
    kcal = mant - deficit;
    const piso = Math.max(tmb, sexo === 'm' ? 1200 : 1500);
    if (kcal < piso) {
      kcal = piso; avisos.push('Se subió al mínimo seguro de calorías para ti: bajarás más despacio, pero sin perder músculo ni energía.');
      if (kcal >= mant) { kcal = mant; avisos[avisos.length - 1] = 'Tu mantenimiento ya está cerca del mínimo seguro: no bajes más calorías sin un profesional; mejor sube tu actividad.'; }
    }
  } else if (objetivo === 'ganar') kcal = mant * (ritmo === 'suave' ? 1.05 : 1.1);
  else if (objetivo === 'fuerza') kcal = mant * 1.05;
  kcal = Math.round(kcal / 10) * 10;
  // con sobrepeso, proteína y grasa sobre un peso de referencia (IMC 25), no sobre el peso total
  const pRef = Math.min(peso, 25 * (altura / 100) ** 2);
  const p = Math.round(pRef * ({ perder: 2.2, ganar: 1.8, fuerza: 2.0 }[objetivo] || 2.0));
  let g = Math.round(pRef * 0.9);
  if (kcal - p * 4 - g * 9 < kcal * 0.2) g = Math.round(pRef * 0.6); // que siempre queden carbohidratos
  const c = Math.max(0, Math.round((kcal - p * 4 - g * 9) / 4));
  const cambioSemana = Math.round(((kcal - mant) * 7 / KCAL_KG) * 100) / 100; // kg por semana (+ sube, - baja)
  let semanas = null;
  if (pesoMeta > 0) {
    const imcMeta = pesoMeta / (altura / 100) ** 2, falta = pesoMeta - peso;
    if (imcMeta < 18.5) avisos.push('Tu peso meta queda por debajo de un peso saludable para tu estatura. Te sugerimos una meta más alta o conversarlo con un profesional.');
    else if (Math.abs(falta) < 0.5) avisos.push('Ya estás en tu peso meta: ahora toca mantener.');
    else if (falta * cambioSemana > 0) semanas = Math.ceil(Math.abs(falta / cambioSemana));
    else avisos.push(falta < 0 ? 'Tu peso meta es menor que tu peso actual: elige «Bajar grasa» para llegar.' : 'Tu peso meta es mayor que tu peso actual: elige «Ganar músculo» para llegar.');
  }
  const cambioMes = Math.round(cambioSemana * 30 / 7 * 10) / 10; // v2.44.0 meta mensual (kg en 30 días)
  return { kcal, p, c, g, mant: Math.round(mant), tmb: Math.round(tmb), cambioSemana, cambioMes, semanas, avisos };
}

// v2.45.0 revisión semanal del nutricionista IA (sin IA): compara cómo cambió tu peso en las últimas 3 semanas con lo
// esperado para tu objetivo y sugiere subir o bajar calorías (de 100 a 150 kcal, siempre sobre el mínimo seguro).
export function ajusteSemanal({ log = [], perfil = {}, metas = null, hoy = new Date(), ultimoAjuste = null }) {
  log = Array.isArray(log) ? log : []; perfil = perfil || {};
  if (perfil.salud) return { estado: 'salud', texto: 'Por tu situación especial (embarazo, lactancia o salud), los ajustes de calorías los debe hacer tu médico o nutricionista.' };
  if (!metas || !(metas.kcal > 0) || !perfil.objetivo) return { estado: 'sin-objetivo', texto: 'Configura tu objetivo y tus metas (botón 🎯) para recibir una revisión cada semana.' };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // fecha local (Ecuador)
  const desde = new Date(hoy); desde.setHours(12, 0, 0, 0); desde.setDate(desde.getDate() - 21);
  if (ultimoAjuste) {
    const ua = new Date(ultimoAjuste + 'T12:00:00'), diasAj = (new Date(iso(hoy) + 'T12:00:00') - ua) / 86400000;
    if (diasAj >= 0 && diasAj < 7) return { estado: 'espera', texto: `Ajustaste tus calorías el ${ua.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}. Sigue pesándote: en una semana reviso cómo te va con el cambio.` };
    if (ua > desde) desde.setTime(ua.getTime()); // solo cuenta lo que pasó después del último ajuste
  }
  const pts = log.filter((x) => x && +x.kg > 0 && x.fecha && x.fecha >= iso(desde) && x.fecha <= iso(hoy))
    .map((x) => ({ d: (new Date(x.fecha + 'T12:00:00') - desde) / 86400000, kg: +x.kg })).sort((a, b) => a.d - b.d);
  const dias = pts.length ? pts[pts.length - 1].d - pts[0].d : 0;
  if (pts.length < 2 || dias < 10) return { estado: 'faltan', texto: 'Pésate 2 o 3 veces por semana (en Perfil, en ayunas) durante al menos 10 días para revisar tu avance.' };
  // pendiente por mínimos cuadrados (kg por día) para que un día de más agua no engañe
  const n = pts.length, md = pts.reduce((a, p) => a + p.d, 0) / n, mk = pts.reduce((a, p) => a + p.kg, 0) / n;
  const pend = pts.reduce((a, p) => a + (p.d - md) * (p.kg - mk), 0) / (pts.reduce((a, p) => a + (p.d - md) ** 2, 0) || 1);
  const semana = Math.round(pend * 7 * 100) / 100, peso = pts[n - 1].kg, pct = 100 * semana / peso;
  const tmb = perfil.edad > 0 && perfil.altura > 0 ? 10 * peso + 6.25 * perfil.altura - 5 * perfil.edad + (perfil.sexo === 'm' ? -161 : 5) : 0;
  const piso = Math.max(tmb, perfil.sexo === 'm' ? 1200 : 1500);
  const ritmo = Math.abs(semana) < 0.05 ? 'con tu peso estable' : `${semana > 0 ? 'subiendo' : 'bajando'} ${Math.abs(semana).toLocaleString('es-EC', { maximumFractionDigits: 2 })} kg por semana`;
  let delta = 0, texto;
  const o = perfil.objetivo;
  if (o === 'perder') {
    if (pct < -1) { delta = 150; texto = `Vas ${ritmo}: es más rápido de lo recomendable (más del 1 % de tu peso) y puedes perder músculo. Sube un poco tus calorías.`; }
    else if (semana > -0.1) { delta = -100; texto = `Vas ${ritmo}: ${semana > 0.05 ? 'estás subiendo en vez de bajar' : 'casi no estás bajando'}. Baja un poco tus calorías y revisa que estés anotando todo.`; }
    else texto = `Vas ${ritmo}: es un buen ritmo para bajar grasa sin perder músculo. ¡Sigue así!`;
  } else if (o === 'ganar') {
    if (pct > 0.5) { delta = -100; texto = `Vas ${ritmo}: es rápido y parte puede ser grasa. Baja un poco tus calorías.`; }
    else if (semana < 0.05) { delta = 150; texto = `Vas ${ritmo}: para ganar músculo necesitas subir un poco de peso. Sube tus calorías.`; }
    else texto = `Vas ${ritmo}: buen ritmo para ganar músculo. ¡Sigue así!`;
  } else {
    if (semana < -0.25) { delta = 150; texto = `Vas ${ritmo}: estás bajando sin querer y eso le quita fuerza a tus entrenamientos. Sube un poco tus calorías.`; }
    else if (semana > (o === 'fuerza' ? 0.4 : 0.25)) { delta = -100; texto = `Vas ${ritmo}: estás subiendo más de lo que buscas. Baja un poco tus calorías.`; }
    else texto = `Vas ${ritmo}: tu peso está donde debe estar para tu objetivo. ¡Sigue así!`;
  }
  let kcal = metas.kcal + delta;
  if (delta < 0 && kcal < piso) {
    if (metas.kcal - piso >= 50) { kcal = Math.round(piso / 10) * 10; delta = kcal - metas.kcal; }
    else { kcal = metas.kcal; delta = 0; texto = `Vas ${ritmo}. Ya estás en el mínimo seguro de calorías, así que no conviene comer menos: mejor sube tu actividad (caminar más, pasos diarios) y revisa que estés anotando todo.`; }
  }
  return { estado: delta ? (delta > 0 ? 'subir' : 'bajar') : 'ok', texto, semana, delta, nuevas: delta ? { ...metas, kcal, c: Math.max(0, Math.round((metas.c || 0) + delta / 4)) } : null };
}
