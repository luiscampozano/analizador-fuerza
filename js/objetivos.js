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
  const tmb = 10 * peso + 6.25 * altura - 5 * edad + (sexo === 'm' ? -161 : 5);
  const mant = tmb * actividad;
  let kcal = mant;
  if (objetivo === 'perder') {
    const deficit = Math.min(mant * (ritmo === 'suave' ? 0.15 : 0.2), 11 * peso); // como mucho ~1 % del peso por semana
    kcal = mant - deficit;
    const piso = Math.max(tmb, sexo === 'm' ? 1200 : 1500);
    if (kcal < piso) { kcal = piso; avisos.push('Se subió al mínimo seguro de calorías para ti: bajarás más despacio, pero sin perder músculo ni energía.'); }
  } else if (objetivo === 'ganar') kcal = mant * (ritmo === 'suave' ? 1.05 : 1.1);
  else if (objetivo === 'fuerza') kcal = mant * 1.05;
  kcal = Math.round(kcal / 10) * 10;
  const p = Math.round(peso * ({ perder: 2.2, ganar: 1.8, fuerza: 2.0 }[objetivo] || 2.0));
  const g = Math.round(peso * 0.9);
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
  return { kcal, p, c, g, mant: Math.round(mant), tmb: Math.round(tmb), cambioSemana, semanas, avisos };
}
