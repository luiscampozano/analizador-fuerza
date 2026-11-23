// Explicacion en palabras simples de cada informe (v2.39.0). Se arma en el telefono con los numeros medidos, sin
// internet: para la persona comun que no sabe que es RIR, MVT o CV. Cada linea empieza con un emoji.
import * as U from './unidades.js';
import { enIngles, t as IDI_t } from './idioma.js'; // v2.75.0 también en inglés
const L = (es, en) => (enIngles() ? en : es);
// v2.68.0 pesos en la unidad elegida (kg o lb)
const fp = (kg) => f(U.desdeKg(kg, U.global())), UN = () => U.nombre(U.global());
const f = (x, d = 0) => (Number.isFinite(x) ? (enIngles() ? x.toFixed(d) : x.toFixed(d).replace('.', ',')) : '?');
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

// ---------------------------------------------------------------- series de pesas
export function resumenPesas(inf, cargaTexto = '') {
  const { s = {}, ej: e = {} } = inf, out = [];
  const reps = inf.corregida ? inf.corregida.real : (inf.reps || []).length;
  const corporal = e.perfil === 'corporal';
  if (!reps) return [L('🤔 No encontramos repeticiones completas. Graba la serie entera, de lado y con el cuerpo completo en la imagen.', "🤔 We didn't find complete reps. Film the whole set, from the side, with your whole body in the frame.")];
  out.push(L(`🏋️ Hiciste <b>${reps} ${reps === 1 ? 'repetición' : 'repeticiones'}</b>${cargaTexto ? ` con ${cargaTexto}` : ''}.`, `🏋️ You did <b>${reps} ${reps === 1 ? 'rep' : 'reps'}</b>${cargaTexto ? ` with ${cargaTexto}` : ''}.`));

  // esfuerzo: cuantas reps le quedaban
  // en las series del historial solo se guarda el texto («2», «1,5», «≥ 5»): se recupera el numero (v2.39.1)
  const rir = Number.isFinite(s.rir) ? s.rir : /^\d/.test(String(s.rirTexto || '')) ? parseFloat(String(s.rirTexto).replace(',', '.')) : NaN;
  if (e.balistico) out.push(L('⚡ Es un ejercicio explosivo: lo importante es moverte rápido en cada rep, no llegar al cansancio.', "⚡ It's an explosive exercise: what matters is moving fast on every rep, not getting tired."));
  else if (s.rirTexto === '≥ 5' || (Number.isFinite(rir) && rir >= 5)) out.push(L('😌 Te quedaban <b>5 o más repeticiones</b> en el tanque: fue una serie suave, de calentamiento o técnica.', '😌 You had <b>5 or more reps</b> left in the tank: it was an easy, warm-up or technique set.'));
  else if (Number.isFinite(rir) && rir <= 1) out.push(L(`🔥 Llegaste <b>casi al límite</b> (te quedaban ${rir <= 0 ? 'cero' : 'una'} o casi ninguna). Está bien para la última serie, pero no lo hagas en todas: cansa mucho.`, `🔥 You went <b>almost to the limit</b> (${rir <= 0 ? 'zero' : 'one'} or almost no reps left). Fine for the last set, but not for every set: it's very tiring.`));
  else if (Number.isFinite(rir)) out.push(L(`💪 Te quedaban unas <b>${f(rir)} repeticiones</b> más: es la zona ideal para ganar fuerza y músculo sin agotarte.`, `💪 You had about <b>${f(rir)} more reps</b> left: the ideal zone to build strength and muscle without burning out.`));

  // cansancio dentro de la serie (perdida de velocidad)
  const p = s.perdida;
  if (Number.isFinite(p) && reps >= 3) {
    if (p < 10) out.push(L(`🚀 Mantuviste la velocidad de principio a fin (solo bajó ${f(p)} %): todavía tenías energía.`, `🚀 You kept your velocity from start to finish (it only dropped ${f(p)}%): you still had energy.`));
    else if (p < 25) out.push(L(`🙂 La velocidad bajó un <b>${f(p)} %</b> de la rep más rápida a la más lenta: cansancio normal de una buena serie.`, `🙂 Velocity dropped <b>${f(p)}%</b> from the fastest to the slowest rep: normal fatigue for a good set.`));
    else if (p < 40) out.push(L(`😮‍💨 La velocidad cayó un <b>${f(p)} %</b>: te cansaste bastante en las últimas reps.`, `😮‍💨 Velocity dropped <b>${f(p)}%</b>: you got quite tired in the last reps.`));
    else out.push(L(`🥵 La velocidad cayó más del 40 %: estuviste al borde de no poder más. Descansa bien (2-3 min) antes de la siguiente serie.`, `🥵 Velocity dropped more than 40%: you were on the edge of failure. Rest well (2–3 min) before the next set.`));
  }

  // peso maximo
  if (s.rm && !corporal && !e.balistico) out.push(L(`🎯 Con esta medición, el peso máximo que podrías levantar <b>una sola vez</b> estaría cerca de <b>${fp(s.rm)} ${UN()}</b> (es una estimación).`, `🎯 From this measurement, the most you could lift <b>once</b> would be around <b>${fp(s.rm)} ${UN()}</b> (an estimate).`));
  else if (s.rm && corporal && Number.isFinite(s.rmLastre) && !e.balistico) out.push(s.rmLastre >= 0 ? L(`🎯 Para hacer una sola repetición podrías colgarte unos <b>${fp(s.rmLastre)} ${UN()}</b> extra (estimado).`, `🎯 For a single rep you could add about <b>${fp(s.rmLastre)} ${UN()}</b> extra (estimate).`) : L(`🎯 Para una sola repetición necesitarías unos <b>${fp(-s.rmLastre)} ${UN()}</b> de ayuda (estimado).`, `🎯 For a single rep you would need about <b>${fp(-s.rmLastre)} ${UN()}</b> of assistance (estimate).`));

  // tecnica y control
  const avisos = (inf.tec && inf.tec.resumen) || [];
  if (avisos.length) { const a0 = enIngles() ? String(IDI_t(avisos[0])) : avisos[0]; out.push(L(`👀 Ojo con la técnica: ${a0.charAt(0).toLowerCase() + a0.slice(1).replace(/[.\s]*$/, '.')}${avisos.length > 1 ? ` (y ${avisos.length - 1} aviso${avisos.length > 2 ? 's' : ''} más en «Técnica»)` : ''}`, `👀 Watch your technique: ${a0.charAt(0).toLowerCase() + a0.slice(1).replace(/[.\s]*$/, '.')}${avisos.length > 1 ? ` (and ${avisos.length - 1} more alert${avisos.length > 2 ? 's' : ''} in «Technique»)` : ''}`)); }
  else if (Number.isFinite(s.recorridoCV) && s.recorridoCV <= 8) out.push(L('✅ Hiciste todas las repeticiones con el mismo recorrido: buen control.', '✅ All your reps had the same range of motion: good control.'));
  else if (Number.isFinite(s.recorridoCV) && s.recorridoCV > 15) out.push(L('📏 El recorrido cambió bastante entre repeticiones: intenta bajar y subir siempre igual.', '📏 Your range of motion changed a lot between reps: try to go down and up the same way every time.'));

  // que hacer la proxima vez
  if (!e.balistico && Number.isFinite(rir)) {
    if (rir >= 4) out.push(L(`➡️ <b>Próxima vez:</b> sube un poco el peso (${U.global() === 'lb' ? '5 a 10 lb' : '2,5 a 5 kg'}) o haz más repeticiones.`, `➡️ <b>Next time:</b> add a little weight (${U.global() === 'lb' ? '5 to 10 lb' : '2.5 to 5 kg'}) or do more reps.`));
    else if (rir <= 0.5) out.push(L('➡️ <b>Próxima vez:</b> mantén el peso o bájalo un poco y deja 1-2 repeticiones en reserva.', '➡️ <b>Next time:</b> keep the weight or lower it a bit and leave 1–2 reps in reserve.'));
    else out.push(L('➡️ <b>Próxima vez:</b> mantén este peso; cuando la misma serie te salga más rápida, súbelo.', '➡️ <b>Next time:</b> keep this weight; when the same set moves faster, go up.'));
  } else if (!e.balistico && (s.rirTexto === '≥ 5')) out.push(L('➡️ <b>Próxima vez:</b> sube el peso para que la serie cuente más.', '➡️ <b>Next time:</b> add weight so the set counts more.'));
  return out;
}

// ---------------------------------------------------------------- cardio y deportes
const QUE = { natacion: 'brazadas', carrera: 'pasos', caminata: 'pasos', bici: 'pedaladas', cuerda: 'saltos', boxeo: 'golpes', remo: 'paladas' };
const QUE_EN = { brazadas: 'strokes', pasos: 'steps', pedaladas: 'pedal strokes', saltos: 'jumps', golpes: 'punches', paladas: 'strokes', repeticiones: 'reps', patadas: 'kicks', tiros: 'shots', remates: 'spikes' };
export function resumenActividad(a) {
  const out = [], ev = a.eventos || [], n = a.total ?? ev.length;
  if (!n) return [L('🤔 No detectamos el movimiento. Graba con el cuerpo completo en la imagen y el celular quieto.', "🤔 We didn't detect the movement. Film with your whole body in the frame and the phone still.")];
  const nombre0 = (a.contador || QUE[a.tipo] || 'repeticiones').toLowerCase(), nombre = enIngles() ? QUE_EN[nombre0] || IDI_t(nombre0) : nombre0, uni = IDI_t(a.unidad);
  out.push(L(`📊 Contamos <b>${n} ${nombre}</b> en ${f(a.dur)} segundos de video${Number.isFinite(a.ritmo) ? `, a un ritmo de <b>${f(a.ritmo)} ${a.unidad}</b>` : ''}.`, `📊 We counted <b>${n} ${nombre}</b> in ${f(a.dur)} seconds of video${Number.isFinite(a.ritmo) ? `, at a pace of <b>${f(a.ritmo)} ${uni}</b>` : ''}.`));

  // como cambio el ritmo: primer cuarto vs ultimo cuarto del video
  const c = (a.curva || []).filter((x) => Number.isFinite(x.v));
  if (c.length >= 6 && !ev.some((e) => e.kmh > 0)) {
    const k = Math.max(2, Math.round(c.length / 4)), ini = media(c.slice(0, k).map((x) => x.v)), fin = media(c.slice(-k).map((x) => x.v));
    const cambio = (fin - ini) / ini * 100;
    if (cambio < -25) out.push(L(`🐇 Empezaste muy rápido (unos ${f(ini)} ${a.unidad}) y terminaste en ${f(fin)}. No es que te cansaras tanto: saliste demasiado acelerado. Empieza más suave y mantén un ritmo parejo.`, `🐇 You started very fast (about ${f(ini)} ${uni}) and finished at ${f(fin)}. It's not that you got that tired: you went out too fast. Start easier and keep a steady pace.`));
    else if (cambio < -10) out.push(L(`📉 Tu ritmo bajó de ${f(ini)} a ${f(fin)} ${a.unidad} al final: algo de cansancio, es normal.`, `📉 Your pace dropped from ${f(ini)} to ${f(fin)} ${uni} at the end: some fatigue, that's normal.`));
    else if (cambio > 15) out.push(L(`📈 Fuiste de menos a más (de ${f(ini)} a ${f(fin)} ${a.unidad}): buen calentamiento y buen cierre.`, `📈 You built up (from ${f(ini)} to ${f(fin)} ${uni}): good warm-up and strong finish.`));
    else out.push(L(`✅ Mantuviste un ritmo muy parejo de principio a fin: excelente control.`, `✅ You kept a very even pace from start to finish: excellent control.`));
  }

  // deportes con golpes medidos
  const g = ev.filter((e) => e.kmh > 0);
  if (g.length) {
    const mx = Math.max(...g.map((e) => e.kmh)), pr = media(g.map((e) => e.kmh));
    out.push(L(`💥 Tu golpe más fuerte salió a <b>${f(mx)} km/h</b>${g.length > 1 ? ` y el promedio fue ${f(pr)} km/h` : ''}.${g.length > 2 && pr < mx * 0.75 ? ' Hay bastante diferencia entre golpes: busca repetir el movimiento del mejor.' : ''}`, `💥 Your hardest hit reached <b>${f(mx)} km/h</b>${g.length > 1 ? ` and the average was ${f(pr)} km/h` : ''}.${g.length > 2 && pr < mx * 0.75 ? ' There is a big difference between hits: try to repeat the motion of your best one.' : ''}`));
  }
  const s = ev.filter((e) => e.salto > 0);
  if (s.length) out.push(L(`🦘 Tu mejor salto fue de <b>${f(Math.max(...s.map((e) => e.salto)))} cm</b>.`, `🦘 Your best jump was <b>${f(Math.max(...s.map((e) => e.salto)))} cm</b>.`));

  // lo que hace bien y lo que puede mejorar (de las alertas de tecnica)
  const bien = (a.alertas || []).filter((x) => x.nivel === 'ok'), mejorar = (a.alertas || []).filter((x) => x.nivel !== 'ok' && !/No detect|No encontr/.test(x.texto));
  if (bien.length) out.push(L(`👍 <b>Lo que haces bien:</b> ${bien[0].texto}`, `👍 <b>What you do well:</b> ${IDI_t(bien[0].texto)}`));
  mejorar.slice(0, 2).forEach((x) => out.push(L(`🛠️ <b>Para mejorar:</b> ${x.texto}`, `🛠️ <b>To improve:</b> ${IDI_t(x.texto)}`)));
  if (!mejorar.length && !bien.length) out.push(L('🙌 No vimos nada raro en la técnica que se pueda medir con el video.', '🙌 We saw nothing unusual in your technique that the video can measure.'));
  return out;
}
