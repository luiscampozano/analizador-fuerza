// Explicacion en palabras simples de cada informe (v2.39.0). Se arma en el telefono con los numeros medidos, sin
// internet: para la persona comun que no sabe que es RIR, MVT o CV. Cada linea empieza con un emoji.
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '?');
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

// ---------------------------------------------------------------- series de pesas
export function resumenPesas(inf, cargaTexto = '') {
  const { s = {}, ej: e = {} } = inf, out = [];
  const reps = inf.corregida ? inf.corregida.real : (inf.reps || []).length;
  const corporal = e.perfil === 'corporal';
  if (!reps) return ['🤔 No encontramos repeticiones completas. Graba la serie entera, de lado y con el cuerpo completo en la imagen.'];
  out.push(`🏋️ Hiciste <b>${reps} ${reps === 1 ? 'repetición' : 'repeticiones'}</b>${cargaTexto ? ` con ${cargaTexto}` : ''}.`);

  // esfuerzo: cuantas reps le quedaban
  // en las series del historial solo se guarda el texto («2», «1,5», «≥ 5»): se recupera el numero (v2.39.1)
  const rir = Number.isFinite(s.rir) ? s.rir : /^\d/.test(String(s.rirTexto || '')) ? parseFloat(String(s.rirTexto).replace(',', '.')) : NaN;
  if (e.balistico) out.push('⚡ Es un ejercicio explosivo: lo importante es moverte rápido en cada rep, no llegar al cansancio.');
  else if (s.rirTexto === '≥ 5' || (Number.isFinite(rir) && rir >= 5)) out.push('😌 Te quedaban <b>5 o más repeticiones</b> en el tanque: fue una serie suave, de calentamiento o técnica.');
  else if (Number.isFinite(rir) && rir <= 1) out.push(`🔥 Llegaste <b>casi al límite</b> (te quedaban ${rir <= 0 ? 'cero' : 'una'} o casi ninguna). Está bien para la última serie, pero no lo hagas en todas: cansa mucho.`);
  else if (Number.isFinite(rir)) out.push(`💪 Te quedaban unas <b>${f(rir)} repeticiones</b> más: es la zona ideal para ganar fuerza y músculo sin agotarte.`);

  // cansancio dentro de la serie (perdida de velocidad)
  const p = s.perdida;
  if (Number.isFinite(p) && reps >= 3) {
    if (p < 10) out.push(`🚀 Mantuviste la velocidad de principio a fin (solo bajó ${f(p)} %): todavía tenías energía.`);
    else if (p < 25) out.push(`🙂 La velocidad bajó un <b>${f(p)} %</b> de la rep más rápida a la más lenta: cansancio normal de una buena serie.`);
    else if (p < 40) out.push(`😮‍💨 La velocidad cayó un <b>${f(p)} %</b>: te cansaste bastante en las últimas reps.`);
    else out.push(`🥵 La velocidad cayó más del 40 %: estuviste al borde de no poder más. Descansa bien (2-3 min) antes de la siguiente serie.`);
  }

  // peso maximo
  if (s.rm && !corporal && !e.balistico) out.push(`🎯 Con esta medición, el peso máximo que podrías levantar <b>una sola vez</b> estaría cerca de <b>${f(s.rm)} kg</b> (es una estimación).`);
  else if (s.rm && corporal && Number.isFinite(s.rmLastre) && !e.balistico) out.push(s.rmLastre >= 0 ? `🎯 Para hacer una sola repetición podrías colgarte unos <b>${f(s.rmLastre)} kg</b> extra (estimado).` : `🎯 Para una sola repetición necesitarías unos <b>${f(-s.rmLastre)} kg</b> de ayuda (estimado).`);

  // tecnica y control
  const avisos = (inf.tec && inf.tec.resumen) || [];
  if (avisos.length) out.push(`👀 Ojo con la técnica: ${avisos[0].charAt(0).toLowerCase() + avisos[0].slice(1).replace(/[.\s]*$/, '.')}${avisos.length > 1 ? ` (y ${avisos.length - 1} aviso${avisos.length > 2 ? 's' : ''} más en «Técnica»)` : ''}`);
  else if (Number.isFinite(s.recorridoCV) && s.recorridoCV <= 8) out.push('✅ Hiciste todas las repeticiones con el mismo recorrido: buen control.');
  else if (Number.isFinite(s.recorridoCV) && s.recorridoCV > 15) out.push('📏 El recorrido cambió bastante entre repeticiones: intenta bajar y subir siempre igual.');

  // que hacer la proxima vez
  if (!e.balistico && Number.isFinite(rir)) {
    if (rir >= 4) out.push('➡️ <b>Próxima vez:</b> sube un poco el peso (2,5 a 5 kg) o haz más repeticiones.');
    else if (rir <= 0.5) out.push('➡️ <b>Próxima vez:</b> mantén el peso o bájalo un poco y deja 1-2 repeticiones en reserva.');
    else out.push('➡️ <b>Próxima vez:</b> mantén este peso; cuando la misma serie te salga más rápida, súbelo.');
  } else if (!e.balistico && (s.rirTexto === '≥ 5')) out.push('➡️ <b>Próxima vez:</b> sube el peso para que la serie cuente más.');
  return out;
}

// ---------------------------------------------------------------- cardio y deportes
const QUE = { natacion: 'brazadas', carrera: 'pasos', caminata: 'pasos', bici: 'pedaladas', cuerda: 'saltos', boxeo: 'golpes', remo: 'paladas' };
export function resumenActividad(a) {
  const out = [], ev = a.eventos || [], n = a.total ?? ev.length;
  if (!n) return ['🤔 No detectamos el movimiento. Graba con el cuerpo completo en la imagen y el celular quieto.'];
  const nombre = (a.contador || QUE[a.tipo] || 'repeticiones').toLowerCase();
  out.push(`📊 Contamos <b>${n} ${nombre}</b> en ${f(a.dur)} segundos de video${Number.isFinite(a.ritmo) ? `, a un ritmo de <b>${f(a.ritmo)} ${a.unidad}</b>` : ''}.`);

  // como cambio el ritmo: primer cuarto vs ultimo cuarto del video
  const c = (a.curva || []).filter((x) => Number.isFinite(x.v));
  if (c.length >= 6 && !ev.some((e) => e.kmh > 0)) {
    const k = Math.max(2, Math.round(c.length / 4)), ini = media(c.slice(0, k).map((x) => x.v)), fin = media(c.slice(-k).map((x) => x.v));
    const cambio = (fin - ini) / ini * 100;
    if (cambio < -25) out.push(`🐇 Empezaste muy rápido (unos ${f(ini)} ${a.unidad}) y terminaste en ${f(fin)}. No es que te cansaras tanto: saliste demasiado acelerado. Empieza más suave y mantén un ritmo parejo.`);
    else if (cambio < -10) out.push(`📉 Tu ritmo bajó de ${f(ini)} a ${f(fin)} ${a.unidad} al final: algo de cansancio, es normal.`);
    else if (cambio > 15) out.push(`📈 Fuiste de menos a más (de ${f(ini)} a ${f(fin)} ${a.unidad}): buen calentamiento y buen cierre.`);
    else out.push(`✅ Mantuviste un ritmo muy parejo de principio a fin: excelente control.`);
  }

  // deportes con golpes medidos
  const g = ev.filter((e) => e.kmh > 0);
  if (g.length) {
    const mx = Math.max(...g.map((e) => e.kmh)), pr = media(g.map((e) => e.kmh));
    out.push(`💥 Tu golpe más fuerte salió a <b>${f(mx)} km/h</b>${g.length > 1 ? ` y el promedio fue ${f(pr)} km/h` : ''}.${g.length > 2 && pr < mx * 0.75 ? ' Hay bastante diferencia entre golpes: busca repetir el movimiento del mejor.' : ''}`);
  }
  const s = ev.filter((e) => e.salto > 0);
  if (s.length) out.push(`🦘 Tu mejor salto fue de <b>${f(Math.max(...s.map((e) => e.salto)))} cm</b>.`);

  // lo que hace bien y lo que puede mejorar (de las alertas de tecnica)
  const bien = (a.alertas || []).filter((x) => x.nivel === 'ok'), mejorar = (a.alertas || []).filter((x) => x.nivel !== 'ok' && !/No detect|No encontr/.test(x.texto));
  if (bien.length) out.push(`👍 <b>Lo que haces bien:</b> ${bien[0].texto}`);
  mejorar.slice(0, 2).forEach((x) => out.push(`🛠️ <b>Para mejorar:</b> ${x.texto}`));
  if (!mejorar.length && !bien.length) out.push('🙌 No vimos nada raro en la técnica que se pueda medir con el video.');
  return out;
}
