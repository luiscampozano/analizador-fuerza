// Analisis por video de cardio, boxeo y HIIT (no son series de fuerza: no hay carga ni 1RM).
// A partir de los puntos del cuerpo que detecta la IA se miden ritmos (pasos, pedaladas, remadas, saltos, golpes) y
// alertas de tecnica. Se recomienda grabar DE LADO, con el celular fijo y el cuerpo completo.
// Las distancias en cm se estiman con la estatura (torso = 30 % de la estatura): son aproximadas.

// ---------------------------------------------------------------- que actividad mide cada ejercicio
const TIPOS = {
  correr: 'carrera', cinta: 'carrera', intervalos_carrera: 'carrera', caminar: 'caminata', caminata_inclinada: 'caminata', senderismo: 'caminata',
  bicicleta: 'bici', bicicleta_estatica: 'bici', spinning: 'bici', bicicleta_aire: 'bici',
  remo_ergometro: 'remo', ski_erg: 'ski', eliptica: 'eliptica', escaladora: 'escaladora', saltar_cuerda: 'cuerda',
  boxeo: 'boxeo', futbol: 'futbol', basquet: 'basquet', voley: 'voley', tenis: 'raqueta', natacion: 'natacion', burpees: 'burpees', jumping_jacks: 'jacks', escaladores: 'escaladores', hiit: 'generico', cuerdas_batalla: 'ondas',
};
export const tipoActividad = (ej) => (ej && TIPOS[ej.id]) || null;
// v2.35.0: deportes. Con balon se puede elegir «Análisis completo» (la IA del balón, experimental, tarda más)
export const CON_BALON = ['futbol', 'basquet', 'voley', 'raqueta'];
export const EXPERIMENTAL = ['natacion'];
export const CONSEJO = {
  carrera: 'Graba de lado, en cinta o con alguien siguiéndote, con el cuerpo completo (pies incluidos). 20-60 s bastan.',
  caminata: 'Graba de lado con el cuerpo completo. 20-60 s bastan.',
  bici: 'Graba de lado, a la altura de la cadera, con la pierna más cercana a la cámara bien visible. 20-60 s.',
  remo: 'Graba de lado, con todo el cuerpo y el carro del remo en el cuadro. 30-60 s.',
  ski: 'Graba de lado con el cuerpo completo. 30-60 s.',
  eliptica: 'Graba de lado con el cuerpo completo. 20-60 s.',
  escaladora: 'Graba de lado con el cuerpo completo. 20-60 s.',
  cuerda: 'Graba de frente o de lado con los pies a la vista. 20-60 s.',
  boxeo: 'Graba DE LADO al saco (no de frente), con el celular fijo y, si puedes, a 60 fps (precisión «Máxima»). 20-60 s.',
  burpees: 'Graba de lado con el cuerpo completo.', jacks: 'Graba de frente con el cuerpo completo.',
  escaladores: 'Graba de lado con el cuerpo completo.', generico: 'Graba con el cuerpo completo y el celular fijo.',
  ondas: 'Graba de lado o de frente con los brazos a la vista.',
  futbol: 'Graba DE LADO a la persona que patea, con el celular fijo, el cuerpo completo y el balón a la vista. Mejor a 60 fps («Máxima»).',
  basquet: 'Graba DE LADO al que lanza, con el celular fijo y el cuerpo completo (y el balón a la vista). Mejor a 60 fps.',
  voley: 'Graba DE LADO, con el celular fijo y el cuerpo completo, incluido el salto y el brazo arriba. Mejor a 60 fps.',
  raqueta: 'Graba DE LADO o desde atrás, con el celular fijo y el cuerpo completo. Mejor a 60 fps («Máxima»).',
  natacion: '🧪 Experimental. Graba desde FUERA de la piscina, de lado al nadador, con el celular fijo (sin seguirlo) y buena luz. 15-30 s.',
};

// ---------------------------------------------------------------- utilidades
const L = { hom: 11, cod: 13, mun: 15, cad: 23, rod: 25, tob: 27, tal: 29, pie: 31 }, R = { hom: 12, cod: 14, mun: 16, cad: 24, rod: 26, tob: 28, tal: 30, pie: 32 };
const ang = (a, b, c) => {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]], d = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  return d ? Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))) * 180 / Math.PI : NaN;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const pct = (a, q) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(q * (b.length - 1))] : NaN; };
const media = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
function suave(x, n) {
  const o = new Array(x.length);
  for (let i = 0; i < x.length; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - n); j <= Math.min(x.length - 1, i + n); j++) if (Number.isFinite(x[j])) { s += x[j]; c++; } o[i] = c ? s / c : NaN; }
  return o;
}
// rellena huecos cortos por interpolacion lineal (la IA pierde puntos un instante)
function rellenar(x) {
  const y = x.slice(); let i = 0;
  while (i < y.length) {
    if (Number.isFinite(y[i])) { i++; continue; }
    let j = i; while (j < y.length && !Number.isFinite(y[j])) j++;
    const a = i > 0 ? y[i - 1] : y[j], b = j < y.length ? y[j] : y[i - 1];
    for (let k = i; k < j; k++) y[k] = Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * (k - i + 1) / (j - i + 1) : NaN;
    i = j;
  }
  return y;
}
// pivotes alternos (maximos y minimos) que superan el umbral h
function zigzag(x, h) {
  const piv = []; let dir = 0, ext = null, iext = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]; if (!Number.isFinite(v)) continue;
    if (ext === null) { ext = v; iext = i; continue; }
    if (dir >= 0) { if (v > ext) { ext = v; iext = i; } else if (ext - v >= h) { piv.push({ i: iext, v: ext, tipo: 'alto' }); dir = -1; ext = v; iext = i; } }
    if (dir < 0) { if (v < ext) { ext = v; iext = i; } else if (v - ext >= h) { piv.push({ i: iext, v: ext, tipo: 'bajo' }); dir = 1; ext = v; iext = i; } }
  }
  return piv;
}
// pivotes con umbral adaptado a la amplitud tipica del movimiento (asi sirve para cualquier escala)
function pivotes(x, k = 0.45) {
  const lo = pct(x, 0.05), hi = pct(x, 0.95), r = hi - lo; if (!(r > 0)) return [];
  const p0 = zigzag(x, 0.2 * r), sw = [];
  for (let i = 1; i < p0.length; i++) sw.push(Math.abs(p0[i].v - p0[i - 1].v));
  if (!sw.length) return [];
  sw.sort((a, b) => b - a); const A = sw[Math.floor(sw.length * 0.3)] || sw[0];
  return zigzag(x, k * A);
}
// tramo activo: entre el primer y el ultimo evento (los segundos antes de empezar no bajan el ritmo)
function ritmo(tiempos, porMinuto = true) {
  if (tiempos.length < 2) return null;
  const d = tiempos[tiempos.length - 1] - tiempos[0];
  return d > 0 ? (tiempos.length - 1) / d * (porMinuto ? 60 : 1) : null;
}
// ritmo a lo largo del tiempo (ventana movil de 6 s) para la grafica y el video
function curvaRitmo(tiempos, dur, factor = 1) {
  const out = [], dif = []; for (let i = 1; i < tiempos.length; i++) dif.push(tiempos[i] - tiempos[i - 1]);
  const ventana = Math.max(6, 2.5 * (med(dif) || 0)); // movimientos lentos (burpees): ventana mas larga
  for (let t = 0; t <= dur; t += 0.5) {
    const ev = tiempos.filter((x) => x > t - ventana && x <= t);
    out.push({ t, v: ev.length >= 2 ? (ev.length - 1) / (ev[ev.length - 1] - ev[0]) * 60 * factor : null });
  }
  return out;
}

// ---------------------------------------------------------------- analisis
// frames: [{ t, puntos: [[x, y, vis] x 33] | null }] tal como salen de la IA · cfg: { altura (m), peso (kg corporal) }
export function analizarActividad(frames, dur, ej, cfg = {}) {
  const tipo = tipoActividad(ej); if (!tipo) throw new Error('Este ejercicio no tiene análisis por video.');
  const t = frames.map((f) => f.t), P = frames.map((f) => (f.puntos && f.puntos.length >= 33 ? f.puntos : null));
  const vistos = P.filter(Boolean).length / Math.max(1, P.length);
  if (vistos < 0.3) throw new Error('La IA casi no vio a la persona. Graba con el cuerpo completo, el celular fijo y buena luz.');
  const dts = []; for (let i = 1; i < t.length; i++) dts.push(t[i] - t[i - 1]);
  const fr = 1 / (med(dts) || 1 / 30), n = Math.max(1, Math.round(0.07 * fr)); // suavizado ~0,07 s
  const serie = (f) => rellenar(suave(P.map((p) => { if (!p) return NaN; try { const v = f(p); return Number.isFinite(v) ? v : NaN; } catch (e) { return NaN; } }), n));
  const torsoPx = med(P.map((p) => (p ? (dist(p[11], p[23]) + dist(p[12], p[24])) / 2 : NaN)));
  const mPorPx = ((cfg.altura || 1.7) * 0.30) / (torsoPx || 1); // metros por pixel (aprox.)
  const visib = (idx) => media(P.map((p) => (p ? media(idx.map((k) => p[k][2])) : NaN)));
  const lado = visib([25, 27, 23, 13, 15]) >= visib([26, 28, 24, 14, 16]) ? L : R; // el lado mas visible
  const mid = (p, a, b) => [(p[a][0] + p[b][0]) / 2, (p[a][1] + p[b][1]) / 2];
  const tiempos = (piv) => piv.map((q) => t[q.i]);
  const r1 = (x, d = 0) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
  const res = { tipo, ejercicio: ej.id, nombre: ej.nombre, dur, kpis: [], alertas: [], eventos: [], ok: [], mPorPx, lado: lado === L ? 'izq' : 'der' };
  const kpi = (label, valor, sub = '') => res.kpis.push({ label, valor, sub });
  const aviso = (texto) => res.alertas.push({ nivel: 'aviso', texto });
  const bien = (texto) => res.alertas.push({ nivel: 'ok', texto });
  const fin = (contador, unidad, evT, factor = 1) => {
    res.contador = contador; res.total = evT.length; res.unidad = unidad;
    const rt = ritmo(evT); res.ritmo = rt == null ? null : r1(rt * factor);
    res.curva = curvaRitmo(evT, dur, factor);
    res.activo = evT.length ? [evT[0], evT[evT.length - 1]] : [0, dur];
    if (!res.eventos.length) res.eventos = evT.map((x) => ({ t: x }));
    return res;
  };

  // direccion de avance (hacia donde apuntan los pies): +1 derecha de la imagen, -1 izquierda
  const avance = Math.sign(med(P.map((p) => (p ? ((p[31][0] - p[29][0]) + (p[32][0] - p[30][0])) / 2 : NaN)))) || 1;

  if (tipo === 'carrera' || tipo === 'caminata') {
    // cada pivote de la distancia horizontal entre tobillos = un pie adelante = un paso
    const sep = serie((p) => (p[27][0] - p[28][0]) / torsoPx);
    const piv = pivotes(sep, 0.5), ev = tiempos(piv);
    res.eventos = piv.map((q) => ({ t: t[q.i], lado: (q.tipo === 'alto') === (avance > 0) ? 'izq' : 'der' }));
    const cad = ritmo(ev);
    kpi('Cadencia', r1(cad), 'pasos por minuto'); kpi('Pasos', ev.length, 'en el video');
    // pie adelante de la cadera cuando los pies estan mas separados (cerca del apoyo)
    const adel = piv.map((q) => { const p = P[q.i]; if (!p) return NaN; const c = mid(p, 23, 24); return Math.max((p[27][0] - c[0]) * avance, (p[28][0] - c[0]) * avance) * mPorPx * 100; });
    const sobre = med(adel);
    // rebote: oscilacion vertical de la cadera (sin la tendencia lenta)
    const cy = rellenar(suave(P.map((p) => (p ? mid(p, 23, 24)[1] : NaN)), 1)), base = suave(cy, Math.round(0.6 * fr)); // poco suavizado: el rebote es rapido
    const osc = cy.map((v, i) => v - base[i]), rebote = (pct(osc, 0.97) - pct(osc, 0.03)) * mPorPx * 100;
    // inclinacion del tronco (+ = hacia adelante)
    const incl = med(P.map((p) => { if (!p) return NaN; const h = mid(p, 11, 12), c = mid(p, 23, 24); return Math.atan2((h[0] - c[0]) * avance, c[1] - h[1]) * 180 / Math.PI; }));
    // simetria: tiempo de los pasos izquierdos vs derechos
    const dIz = [], dDe = []; for (let k = 1; k < res.eventos.length; k++) (res.eventos[k].lado === 'izq' ? dIz : dDe).push(res.eventos[k].t - res.eventos[k - 1].t);
    const asim = dIz.length > 2 && dDe.length > 2 ? Math.abs(media(dIz) - media(dDe)) / ((media(dIz) + media(dDe)) / 2) * 100 : null;
    kpi('Rebote', r1(rebote), 'cm (aprox.)'); kpi('Pie al pisar', r1(sobre), 'cm delante de la cadera (aprox.)');
    kpi('Tronco', r1(incl), '° de inclinación adelante'); if (asim != null) kpi('Asimetría', r1(asim, 1), '% entre piernas');
    if (tipo === 'carrera') {
      if (cad < 155) aviso(`Cadencia baja (${r1(cad)} pasos/min). Dar pasos más cortos y rápidos (subir 5-10 %) reduce el impacto en rodillas y caderas.`); else bien(`Buena cadencia (${r1(cad)} pasos/min).`);
      if (rebote > 10) aviso(`Rebotas mucho (~${r1(rebote)} cm). Piensa en avanzar, no en saltar: más cadencia y menos impulso hacia arriba.`); else if (Number.isFinite(rebote)) bien(`Rebote controlado (~${r1(rebote)} cm).`);
      if (sobre > 35) aviso(`Posible sobrezancada: el pie cae ~${r1(sobre)} cm delante de la cadera. Intenta apoyar más debajo del cuerpo.`);
    }
    if (incl > 20) aviso(`Tronco muy inclinado hacia adelante (${r1(incl)}°). Corre «alto», con una inclinación leve desde los tobillos.`);
    else if (incl < -2) aviso(`Tronco hacia atrás (${r1(incl)}°): inclínate levemente hacia adelante.`);
    if (asim != null && asim > 8) aviso(`Pasos desiguales entre piernas (${r1(asim, 1)} %). Puede ser cansancio, una molestia o la grabación.`);
    return fin('Pasos', 'pasos/min', ev);
  }

  if (tipo === 'bici' || tipo === 'eliptica' || tipo === 'escaladora') {
    const rod = serie((p) => ang(p[lado.cad], p[lado.rod], p[lado.tob]));
    const piv = pivotes(rod, 0.5), altos = piv.filter((q) => q.tipo === 'alto'), ev = tiempos(altos);
    if (tipo === 'bici') {
      const rpm = ritmo(ev), abajo = med(altos.map((q) => q.v));
      const caderaMin = med(piv.filter((q) => q.tipo === 'bajo').map((q) => { const p = P[q.i]; return p ? ang(p[lado.hom], p[lado.cad], p[lado.rod]) : NaN; }));
      kpi('Cadencia', r1(rpm), 'RPM'); kpi('Pedaladas', ev.length, 'en el video');
      kpi('Rodilla abajo', r1(abajo), '° (ideal 140-150)'); kpi('Cadera arriba', r1(caderaMin), '° (ángulo más cerrado)');
      if (abajo < 135) aviso(`La rodilla queda muy doblada abajo (${r1(abajo)}°): el sillín parece BAJO. Súbelo 1-2 cm y vuelve a medir.`);
      else if (abajo > 155) aviso(`La rodilla casi se estira abajo (${r1(abajo)}°): el sillín parece ALTO. Bájalo 1 cm y vuelve a medir.`);
      else if (Number.isFinite(abajo)) bien(`Altura de sillín correcta (rodilla a ${r1(abajo)}° abajo).`);
      if (caderaMin < 40) aviso(`La cadera se cierra mucho arriba (${r1(caderaMin)}°): revisa la distancia al manillar o la altura del sillín.`);
      if (rpm < 60) aviso(`Cadencia baja (${r1(rpm)} RPM): con menos resistencia y más RPM (80-100) cuidas las rodillas.`); else bien(`Cadencia de ${r1(rpm)} RPM.`);
      return fin('Pedaladas', 'RPM', ev);
    }
    // eliptica: vueltas por minuto · escaladora: pasos por minuto (cada vuelta de una pierna = 2 pasos)
    const pasos = tipo === 'escaladora';
    kpi(pasos ? 'Ritmo' : 'Cadencia', r1(ritmo(ev) * (pasos ? 2 : 1)), pasos ? 'pasos por minuto' : 'vueltas por minuto');
    kpi(pasos ? 'Pasos' : 'Vueltas', ev.length * (pasos ? 2 : 1), 'en el video');
    const incl = med(P.map((p) => { if (!p) return NaN; const h = mid(p, 11, 12), c = mid(p, 23, 24); return Math.abs(Math.atan2(h[0] - c[0], c[1] - h[1]) * 180 / Math.PI); }));
    kpi('Tronco', r1(incl), '° respecto a la vertical');
    if (incl > 25) aviso(`Te apoyas mucho hacia adelante (${r1(incl)}°): suelta un poco el peso de los brazos y endereza el tronco.`); else bien('Postura del tronco erguida.');
    return fin(pasos ? 'Pasos' : 'Vueltas', pasos ? 'pasos/min' : 'vueltas/min', ev, pasos ? 2 : 1);
  }

  if (tipo === 'remo') {
    const rod = serie((p) => ang(p[lado.cad], p[lado.rod], p[lado.tob]));
    const cod = serie((p) => ang(p[lado.hom], p[lado.cod], p[lado.mun]));
    const piv = pivotes(rod, 0.5), ataques = piv.filter((q) => q.tipo === 'bajo'), ev = tiempos(ataques);
    const empuje = [], recup = [], brazos = [], atras = [];
    for (let k = 0; k < ataques.length - 1; k++) {
      const a = ataques[k].i, b = ataques[k + 1].i;
      let fin = a; for (let i = a; i < b; i++) if (cod[i] < cod[fin]) fin = i; // final: codos mas doblados (manos al cuerpo)
      empuje.push(t[fin] - t[a]); recup.push(t[b] - t[fin]);
      // al 80 % de la extension de piernas los brazos deberian seguir estirados
      const r0 = rod[a], rmax = Math.max(...rod.slice(a, b)); let k80 = a; for (let i = a; i < b; i++) if (rod[i] >= r0 + 0.8 * (rmax - r0)) { k80 = i; break; }
      brazos.push(cod[k80]);
      const p = P[fin]; if (p) { const h = mid(p, 11, 12), c = mid(p, 23, 24), haciaPies = Math.sign(mid(p, 27, 28)[0] - c[0]) || 1; atras.push(Math.atan2((c[0] - h[0]) * haciaPies, c[1] - h[1]) * 180 / Math.PI); }
    }
    const spm = ritmo(ev), rel = med(recup) / med(empuje), codo80 = med(brazos), lay = med(atras);
    kpi('Ritmo', r1(spm), 'remadas por minuto'); kpi('Remadas', ev.length, 'en el video');
    kpi('Recuperación : empuje', Number.isFinite(rel) ? `${r1(rel, 1)} : 1` : '--', 'ideal ~2 : 1'); kpi('Codo al empujar', r1(codo80), '° (ideal > 150)');
    kpi('Inclinación al final', r1(lay), '° hacia atrás (ideal 10-30)');
    if (rel < 1.5) aviso(`Vuelves muy rápido (${r1(rel, 1)} : 1). Empuja fuerte y regresa el doble de lento (2 : 1).`); else if (Number.isFinite(rel)) bien(`Buen ritmo empuje/recuperación (${r1(rel, 1)} : 1).`);
    if (codo80 < 140) aviso(`Doblas los brazos antes de terminar de empujar con las piernas (codo a ${r1(codo80)}°). Orden: piernas → espalda → brazos.`); else if (Number.isFinite(codo80)) bien('Buena secuencia: piernas primero, brazos al final.');
    if (lay > 35) aviso(`Te echas muy atrás al final (${r1(lay)}°): basta con 10-30°.`); else if (lay < 5) aviso(`Casi no inclinas el tronco al final (${r1(lay)}°): llevarlo 10-30° atrás suma potencia.`);
    return fin('Remadas', 'remadas/min', ev);
  }

  if (tipo === 'cuerda') {
    const pies = rellenar(suave(P.map((p) => (p ? -mid(p, 27, 28)[1] / torsoPx : NaN)), 1)); // sube al saltar (poco suavizado: el salto es corto)
    const piv = pivotes(pies, 0.5), altos = piv.filter((q) => q.tipo === 'alto'), ev = tiempos(altos);
    const alt = []; for (let k = 1; k < piv.length; k++) if (piv[k].tipo === 'alto') alt.push((piv[k].v - piv[k - 1].v) * torsoPx * mPorPx * 100);
    const h = med(alt);
    kpi('Ritmo', r1(ritmo(ev)), 'saltos por minuto'); kpi('Saltos', ev.length, 'en el video'); kpi('Altura de salto', r1(h, 1), 'cm (aprox.)');
    if (h > 8) aviso(`Saltas más alto de lo necesario (~${r1(h, 1)} cm): con 2-5 cm basta y gastas menos energía.`); else if (Number.isFinite(h)) bien(`Saltos bajos y eficientes (~${r1(h, 1)} cm).`);
    return fin('Saltos', 'saltos/min', ev);
  }

  if (tipo === 'boxeo') {
    // golpe = el brazo se estira rapido (distancia muñeca-hombro cerca del largo del brazo) A LA ALTURA DEL TORSO.
    // Solo se usan puntos de la mano que la IA ve bien (la mano lejana suele quedar tapada por el cuerpo): asi no se
    // inventan golpes ni se cuenta como "guardia baja" una mano que no se ve. Brazos colgando (caminar, acomodarse)
    // no cuentan: la muñeca queda muy por debajo del hombro. Calibrado con video real (29/10/2026).
    const golpes = [];
    let guardiaBaja = 0, nGuardia = 0;
    const visible = (p, s) => p && (p[s.mun][2] ?? 1) >= 0.5 && (p[s.cod][2] ?? 1) >= 0.3;
    const corto = Math.round(0.15 * fr);
    const serieV = (s, f) => { // como serie(), pero sin puntos poco visibles y rellenando solo huecos cortos
      const x = suave(P.map((p) => { if (!visible(p, s)) return NaN; const v = f(p); return Number.isFinite(v) ? v : NaN; }), n);
      const y = rellenar(x); let i = 0;
      while (i < x.length) { if (Number.isFinite(x[i])) { i++; continue; } let j = i; while (j < x.length && !Number.isFinite(x[j])) j++; if (j - i > corto || i === 0 || j === x.length) for (let k = i; k < j; k++) y[k] = NaN; i = j; }
      return y;
    };
    for (const [s, nomLado] of [[L, 'izq'], [R, 'der']]) {
      const altura = (p) => (p[s.mun][1] - Math.min(p[11][1], p[12][1])) / torsoPx; // + = muñeca bajo los hombros
      const arriba = (p) => visible(p, s) && altura(p) <= 0.6;
      // largo del brazo medido solo con la mano a la altura del torso (al caminar el brazo cuelga y se ve mas largo)
      const largo = pct(P.map((p) => (arriba(p) ? dist(p[s.hom], p[s.cod]) + dist(p[s.cod], p[s.mun]) : NaN)), 0.9);
      if (!(largo > 0)) continue;
      const alt = serieV(s, altura);
      const extTodo = serieV(s, (p) => dist(p[s.hom], p[s.mun]) / largo);
      const ext = extTodo.map((v, i) => (alt[i] <= 0.6 ? v : NaN)); // brazo colgando (caminar, acomodarse): no es golpe
      const mx = serieV(s, (p) => p[s.mun][0]), my = serieV(s, (p) => p[s.mun][1]);
      const piv = zigzag(ext, 0.10);
      for (let k = 0; k < piv.length; k++) {
        const q = piv[k]; if (q.tipo !== 'alto' || q.v < 0.62) continue;
        const b = q.i; let a = k ? piv[k - 1].i : Math.max(0, b - Math.round(0.3 * fr));
        if (!(alt[b] <= 0.6)) continue;
        if (golpes.some((g) => g.lado === nomLado && Math.abs(g.i - b) < 0.2 * fr)) continue;
        let vmax = 0; for (let i = Math.max(a + 1, 1); i <= b; i++) { const v = Math.hypot(mx[i] - mx[i - 1], my[i] - my[i - 1]) / (t[i] - t[i - 1] || 1 / fr); if (Number.isFinite(v)) vmax = Math.max(vmax, v); }
        const p = P[b], codo = p ? ang(p[s.hom], p[s.cod], p[s.mun]) : NaN;
        const subida = my[a] - my[b], lateral = Math.abs(mx[b] - mx[a]);
        const clase = codo >= 150 ? 'recto' : subida > lateral * 0.8 ? 'uppercut' : 'gancho';
        golpes.push({ i: b, t: t[b], lado: nomLado, v: vmax * mPorPx, clase });
      }
      // guardia: con el brazo recogido (sin golpear), la mano deberia estar cerca de la cara, no a la altura del pecho
      for (let i = 0; i < P.length; i++) { if (!Number.isFinite(alt[i]) || !(extTodo[i] < 0.6)) continue; nGuardia++; if (alt[i] > 0.35) guardiaBaja++; }
    }
    golpes.sort((a, b) => a.t - b.t);
    res.eventos = golpes.map((g) => ({ t: g.t, lado: g.lado, clase: g.clase, v: r1(g.v, 1) }));
    const ev = golpes.map((g) => g.t), iz = golpes.filter((g) => g.lado === 'izq').length, de = golpes.length - iz;
    const vel = pct(golpes.map((g) => g.v), 0.9), cl = (c) => golpes.filter((g) => g.clase === c).length;
    kpi('Golpes', golpes.length, `izq. ${iz} · der. ${de}`); kpi('Ritmo', r1(ritmo(ev)), 'golpes por minuto');
    kpi('Mano más rápida', r1(vel, 1), 'm/s (aprox.)'); kpi('Tipos', `${cl('recto')} · ${cl('gancho')} · ${cl('uppercut')}`, 'rectos · ganchos · uppercuts (aprox.)');
    // v2.34.0 fuerza aproximada del golpe (impulso): F = k · m_ef · v. Masa efectiva ~4 % del peso corporal (puño + brazo
    // + parte del cuerpo que acompaña); k = 129 /s calibrado con boxeadores olímpicos (Walilko 2005: 2,9 kg, 9,1 m/s,
    // 3427 N). Margen amplio (±35 %): depende de la técnica, el guante y lo duro del saco. La altura entra en la escala.
    if (cfg.peso > 0 && golpes.length) {
      const fuerza = (v, clase) => 129 * cfg.peso * (clase === 'recto' ? 0.04 : 0.035) * v / 9.81; // kg
      for (const g of golpes) g.fuerza = fuerza(g.v, g.clase);
      const fMax = pct(golpes.map((g) => g.fuerza), 0.9), fMed = med(golpes.map((g) => g.fuerza));
      res.fuerzaGolpe = { max: r1(fMax), media: r1(fMed), newton: r1(fMax * 9.81) };
      res.eventos = golpes.map((g) => ({ t: g.t, lado: g.lado, clase: g.clase, v: r1(g.v, 1), fuerza: r1(g.fuerza) }));
      kpi('Golpe más fuerte', r1(fMax), `kg aprox. (±35 %) · ${r1(fMax * 9.81 / 10) * 10} N · típico ${r1(fMed)} kg`);
      bien(`Fuerza estimada con la velocidad de tu mano y tu peso: tu golpe más fuerte equivale a ~${r1(fMax)} kg (±35 %). Es la fuerza si impacta un saco; al aire es solo referencia.`);
    }
    const baja = nGuardia ? guardiaBaja / nGuardia * 100 : 0; kpi('Guardia baja', r1(baja), '% del tiempo');
    if (baja > 40) aviso(`Bajas la guardia ${r1(baja)} % del tiempo: después de cada golpe regresa la mano a la cara.`); else bien('Buena guardia: las manos vuelven a la cara.');
    if (golpes.length >= 6 && Math.min(iz, de) / Math.max(iz, de) < 0.35) aviso(`Usas mucho más una mano (izq. ${iz} / der. ${de}). Combina las dos.`);
    if (fr < 45) aviso('Video a menos de 60 fps: en golpes muy rápidos la IA puede perder la mano. Graba a 60 fps (la app lo analiza a 60 automáticamente).');
    return fin('Golpes', 'golpes/min', ev);
  }

  // ---------------------------------------------------------------- deportes (v2.35.0)
  // Velocidad del pie o la mano en el instante del contacto y, con fisica de choque, una estimacion de la velocidad del
  // balon y de la fuerza media del impacto. Con «Análisis completo» (cfg.balon) la velocidad del balon se MIDE con la
  // IA que lo detecta en cada cuadro. Todo es aproximado: video 2D, la escala sale de la estatura.
  if (['futbol', 'basquet', 'voley', 'raqueta', 'natacion'].includes(tipo)) {
    const corto = Math.round(0.15 * fr), nn = Math.max(1, Math.round(0.02 * fr));
    const serieVis = (k, f) => { // solo con el punto bien visible; rellena huecos cortos
      const x = suave(P.map((p) => { if (!p || !((p[k][2] ?? 1) >= 0.4)) return NaN; const v = f(p); return Number.isFinite(v) ? v : NaN; }), nn);
      const y = rellenar(x); let i = 0;
      while (i < x.length) { if (Number.isFinite(x[i])) { i++; continue; } let j = i; while (j < x.length && !Number.isFinite(x[j])) j++; if (j - i > corto || i === 0 || j === x.length) for (let q = i; q < j; q++) y[q] = NaN; i = j; }
      return y;
    };
    const velDe = (k, crudo = false) => { // m/s; vy + = hacia abajo
      const x = serieVis(k, (p) => p[k][0]), y = serieVis(k, (p) => p[k][1]);
      const v = x.map(() => NaN), vx = v.slice(), vy = v.slice();
      for (let i = 1; i < x.length; i++) { const dt = t[i] - t[i - 1] || 1 / fr; vx[i] = (x[i] - x[i - 1]) / dt * mPorPx; vy[i] = (y[i] - y[i - 1]) / dt * mPorPx; v[i] = Math.hypot(vx[i], vy[i]); }
      // v2.35.4: mediana de 3 cuadros: un salto de un solo cuadro (la IA tiembla o confunde la mano) no es un golpe
      const m3 = (a) => a.map((_, i) => { const w = [a[i - 1], a[i], a[i + 1]].filter(Number.isFinite); return w.length === 3 ? w.sort((p, q) => p - q)[1] : NaN; });
      return crudo ? { v, vx, vy, x, y } : { v: m3(v), vx: m3(vx), vy: m3(vy), x, y };
    };
    // maximos locales de v por encima de vmin, separados al menos sep segundos (se queda el mas alto)
    const picos = (v, vmin, sep, ok = () => true) => {
      const out = [];
      for (let i = 1; i < v.length - 1; i++) {
        if (!(v[i] >= vmin) || !(v[i] >= v[i - 1]) || !(v[i] >= v[i + 1]) || !ok(i)) continue;
        const u = out[out.length - 1];
        if (u != null && t[i] - t[u] < sep) { if (v[i] > v[u]) out[out.length - 1] = i; continue; }
        out.push(i);
      }
      return out;
    };
    const peso = cfg.peso > 0 ? cfg.peso : 75;
    // choque: el pie/mano (masa efectiva M, a velocidad v) golpea un balon quieto (masa m); e = rebote. Fuerza media
    // del impacto = cantidad de movimiento del balon / tiempo de contacto. Devuelve km/h y kg.
    const choque = (v, M, m, e, tc) => { const vb = v * (1 + e) * M / (M + m); return { vb, kmh: vb * 3.6, kg: m * vb / tc / 9.81 }; };
    const caderaY = serie((p) => (p[23][1] + p[24][1]) / 2);
    const saltoCm = (i) => { // cuanto sube la cadera respecto a estar de pie (ventana de 2 s alrededor)
      const a = Math.max(0, i - Math.round(1.2 * fr)), b = Math.min(P.length - 1, i + Math.round(0.8 * fr));
      const tramo = caderaY.slice(a, b + 1), base = pct(tramo, 0.8), alto = Math.min(...tramo.filter(Number.isFinite));
      return Number.isFinite(base - alto) ? (base - alto) * mPorPx * 100 : NaN;
    };
    // IA del balon (analisis completo): velocidad medida justo despues del contacto, siguiendo al balon cuadro a cuadro
    const B = Array.isArray(cfg.balon) && cfg.balon.length === P.length ? cfg.balon : null;
    const balonTras = (i, punto) => {
      if (!B) return null;
      const fin = Math.min(P.length - 1, i + Math.round(0.4 * fr)); let prev = punto, pts = [];
      for (let j = Math.max(0, i - 1); j <= fin; j++) {
        const cand = B[j]; if (!cand || !cand.length) continue;
        let mejor = null, dm = Infinity;
        for (const c of cand) { const d = prev ? Math.hypot(c[0] - prev[0], c[1] - prev[1]) : 0; if (d < dm) { dm = d; mejor = c; } }
        if (prev && dm > Math.max(4 * (mejor[2] || 20), 60 / mPorPx * (t[j] - t[Math.max(0, i - 1)] + 0.05))) continue; // salto imposible: otra cosa
        pts.push([t[j], mejor[0], mejor[1]]); prev = mejor;
        if (pts.length >= 7) break;
      }
      const tras = pts.filter((q) => q[0] > t[i]);
      if (tras.length < 2) return null;
      const ajuste = (k) => { const mt = media(tras.map((q) => q[0])), mk = media(tras.map((q) => q[k])); let a = 0, b = 0; for (const q of tras) { a += (q[0] - mt) * (q[k] - mk); b += (q[0] - mt) ** 2; } return b ? a / b : NaN; };
      const vb = Math.hypot(ajuste(1), ajuste(2)) * mPorPx;
      return vb > 1 && vb < 60 ? vb : null;
    };
    const coma = (x, d = 1) => String(r1(x, d)).replace('.', ',');
    // v2.35.4: un mismo golpe puede salir en las dos manos (o pies): de lado la IA confunde izquierda y derecha. Se deja
    // uno por movimiento (el mas rapido) si estan a menos de sep segundos.
    const unir = (lista, sep) => { const out = []; for (const g of lista.sort((a, b) => a.t - b.t)) { const u = out[out.length - 1]; if (u && g.t - u.t < sep) { if (g.v > u.v) out[out.length - 1] = g; } else out.push(g); } return out; };
    const resumenGolpes = (golpes, nombre, unidad, mB, tc, quePega) => {
      // velocidad medida del balon (si la IA lo vio) reemplaza a la estimada; la fuerza se recalcula con ella
      let medidos = 0;
      for (const g of golpes) {
        const p = P[g.i], pto = p ? [p[g.k][0], p[g.k][1]] : null, vm = balonTras(g.i, pto);
        if (vm) { medidos++; g.vb = vm; g.kmh = vm * 3.6; g.kg = mB * vm / tc / 9.81; g.medido = true; }
      }
      res.eventos = golpes.map((g) => ({ t: g.t, lado: g.lado, v: r1(g.v, 1), kmh: r1(g.kmh), fuerza: r1(g.kg), medido: !!g.medido }));
      const iz = golpes.filter((g) => g.lado === 'izq').length;
      kpi(nombre, golpes.length, `izq. ${iz} · der. ${golpes.length - iz}`);
      if (!golpes.length) return;
      const mejor = golpes.reduce((a, g) => (g.kmh > a.kmh ? g : a));
      kpi(quePega, coma(Math.max(...golpes.map((g) => g.v))), 'm/s en el contacto (aprox.)');
      kpi(unidad, r1(mejor.kmh), mejor.medido ? 'km/h · medida con la IA del balón' : 'km/h · estimada (±30 %)');
      kpi('Fuerza del impacto', r1(mejor.kg), `kg aprox. · ${r1(mejor.kg * 9.81 / 10) * 10} N (fuerza media del contacto)`);
      res.fuerzaGolpe = { max: r1(mejor.kg), media: r1(med(golpes.map((g) => g.kg))), newton: r1(mejor.kg * 9.81) };
      if (B) { if (medidos) bien(`La IA del balón lo siguió en ${medidos} de ${golpes.length}: esas velocidades son medidas, no estimadas.`); else aviso('La IA del balón no lo pudo seguir después del contacto (muy lejos, borroso o tapado). Se muestran valores estimados.'); }
    };
    const avisoFps = () => { if (fr < 45) aviso('Video a menos de 60 fps: en movimientos tan rápidos la IA pierde parte del recorrido y la velocidad sale más baja. Graba a 60 fps (la app lo analiza a 60 automáticamente).'); };
    if (!cfg.peso) aviso('Pon tu peso corporal para que la estimación de fuerza sea tuya (se usó 75 kg).');

    if (tipo === 'futbol') {
      const pies = [[L, 'izq'], [R, 'der']].map(([s, nom]) => ({ s, nom, ...velDe(s.pie) }));
      const vtop = pct(pies.flatMap((q) => q.v), 0.995);
      const golpes = [];
      for (const pg of pies) {
        const otro = pies.find((q) => q !== pg);
        const ok = (i) => { const p = P[i]; if (!p) return false;
          if (otro.v[i] > 0.6 * pg.v[i]) return false; // el otro pie apoyado (no es correr)
          if (!(p[pg.s.pie][1] > (p[23][1] + p[24][1]) / 2)) return false; // el pie por debajo de la cadera
          return !(ang(p[pg.s.cad], p[pg.s.rod], p[pg.s.tob]) < 120); }; // rodilla casi estirada al pegarle
        for (const i of picos(pg.v, Math.max(5, 0.55 * vtop), 1.0, ok)) {
          const c = choque(pg.v[i], 0.028 * peso, 0.43, 0.5, 0.009); // balon 430 g; contacto ~9 ms
          golpes.push({ i, t: t[i], lado: pg.nom, k: pg.s.pie, v: pg.v[i], ...c, kmh: c.kmh });
        }
      }
      golpes.splice(0, golpes.length, ...unir(golpes, 1.0));
      resumenGolpes(golpes, 'Patadas', 'Velocidad del balón', 0.43, 0.009, 'Pie más rápido');
      if (!golpes.length) aviso('No encontré patadas. Graba de lado, con el pie y el balón a la vista y el celular fijo.');
      else bien('Velocidad del balón: con el pie a esa velocidad, un balón sale ~1,25 veces más rápido (choque pie-balón).');
      avisoFps();
      return fin('Patadas', 'por minuto', golpes.map((g) => g.t));
    }

    if (tipo === 'voley' || tipo === 'raqueta') {
      const manos = [[L, 'izq'], [R, 'der']].map(([s, nom]) => ({ s, nom, ...velDe(s.mun) }));
      const vtop = pct(manos.flatMap((q) => q.v), 0.995), golpes = [];
      for (const m of manos) {
        const ok = (i) => { const p = P[i]; if (!p) return false;
          return tipo === 'raqueta' || p[m.s.mun][1] < Math.min(p[11][1], p[12][1]); }; // voley: remate o saque, mano arriba
        for (const i of picos(m.v, Math.max(4, 0.5 * vtop), 0.8, ok)) {
          const p = P[i], arriba = p && p[m.s.mun][1] < Math.min(p[11][1], p[12][1]);
          // voley: la mano (masa efectiva ~4 % del peso) contra un balon de 270 g; raqueta: la cabeza va ~1,5 veces
          // mas rapido que la mano y pega con ~0,6 kg efectivos a una pelota de 58 g
          const c = tipo === 'voley' ? choque(m.v[i], 0.04 * peso, 0.27, 0.5, 0.012) : choque(1.5 * m.v[i], 0.6, 0.058, 0.75, 0.005);
          golpes.push({ i, t: t[i], lado: m.nom, k: m.s.mun, v: m.v[i], arriba, salto: saltoCm(i), ...c });
        }
      }
      golpes.splice(0, golpes.length, ...unir(golpes, tipo === 'voley' ? 1.2 : 0.9));
      if (tipo === 'voley') {
        resumenGolpes(golpes, 'Remates', 'Velocidad del balón', 0.27, 0.012, 'Mano más rápida');
        const s = med(golpes.map((g) => g.salto));
        if (s > 5) kpi('Salto', r1(s), 'cm (aprox.)');
        if (!golpes.length) aviso('No encontré remates ni saques: la mano debe golpear por encima de la cabeza y verse completa.');
      } else {
        resumenGolpes(golpes, 'Golpes', 'Velocidad de la pelota', 0.058, 0.005, 'Mano más rápida');
        if (golpes.length) kpi('Por arriba', golpes.filter((g) => g.arriba).length, 'remates o saques');
        if (!golpes.length) aviso('No encontré golpes: graba con el brazo de la raqueta a la vista.');
        else bien('Velocidad de la pelota estimada con la mano: la cabeza de la raqueta va ~1,5 veces más rápido que la mano.');
      }
      avisoFps();
      return fin(tipo === 'voley' ? 'Remates' : 'Golpes', 'por minuto', golpes.map((g) => g.t));
    }

    if (tipo === 'basquet') {
      // tiro: la mano sube rapido por encima de los hombros y el codo se estira al soltar el balon (sin mediana: al
      // soltar el balon la mano frena de golpe y la mediana borraria el pico)
      const manos = [[L, 'izq'], [R, 'der']].map(([s, nom]) => ({ s, nom, ...velDe(s.mun, true) }));
      const tiros = [];
      for (const m of manos) {
        const sube = m.vy.map((x) => -x), top = pct(sube, 0.995);
        const ok = (i) => { const p = P[i]; return p && p[m.s.mun][1] < Math.min(p[11][1], p[12][1]) && !(ang(p[m.s.hom], p[m.s.cod], p[m.s.mun]) < 130); };
        for (const i of picos(sube, Math.max(2.5, 0.5 * top), 1.5, ok)) {
          if (tiros.some((x) => Math.abs(x.t - t[i]) < 0.5)) { const x = tiros.find((y) => Math.abs(y.t - t[i]) < 0.5); if (m.v[i] > x.v) Object.assign(x, { i, t: t[i], lado: m.nom, k: m.s.mun, v: m.v[i], ang: Math.atan2(-m.vy[i], Math.abs(m.vx[i])) * 180 / Math.PI }); continue; }
          // empuje: desde que la mano empieza a subir hasta soltar el balon
          let a = i; while (a > 0 && t[i] - t[a] < 0.7 && sube[a - 1] > 0.2 * sube[i]) a--;
          const tEmp = Math.max(0.15, Math.min(0.7, t[i] - t[a]));
          tiros.push({ i, t: t[i], lado: m.nom, k: m.s.mun, v: m.v[i], ang: Math.atan2(-m.vy[i], Math.abs(m.vx[i])) * 180 / Math.PI, tEmp, salto: saltoCm(i) });
        }
      }
      tiros.sort((a, b) => a.t - b.t);
      for (const g of tiros) { g.kmh = g.v * 3.6; g.vb = g.v; g.kg = 0.62 * (g.v / (g.tEmp || 0.3) + 9.81) / 9.81; } // balon 620 g
      // con la IA del balon: velocidad medida al salir de la mano (el empuje dura tEmp)
      let medidos = 0;
      for (const g of tiros) { const p = P[g.i], vm = balonTras(g.i, p ? [p[g.k][0], p[g.k][1]] : null); if (vm) { medidos++; g.vb = vm; g.kmh = vm * 3.6; g.kg = 0.62 * (vm / (g.tEmp || 0.3) + 9.81) / 9.81; g.medido = true; } }
      res.eventos = tiros.map((g) => ({ t: g.t, lado: g.lado, v: r1(g.vb, 1), kmh: r1(g.kmh), fuerza: r1(g.kg, 1), medido: !!g.medido }));
      const iz = tiros.filter((g) => g.lado === 'izq').length;
      kpi('Tiros', tiros.length, `mano izq. ${iz} · der. ${tiros.length - iz}`);
      if (tiros.length) {
        const vs = med(tiros.map((g) => g.vb)), an = med(tiros.map((g) => g.ang)), s = med(tiros.map((g) => g.salto));
        kpi('Velocidad de salida', coma(vs), medidos ? 'm/s · medida con la IA del balón' : 'm/s de la mano al soltar (aprox.)');
        kpi('Ángulo de salida', r1(an), '° (aprox.)');
        if (s > 5) kpi('Salto', r1(s), 'cm (aprox.)');
        kpi('Fuerza de empuje', coma(med(tiros.map((g) => g.kg))), 'kg sobre el balón (aprox.)');
        res.fuerzaGolpe = { max: r1(Math.max(...tiros.map((g) => g.kg)), 1), media: r1(med(tiros.map((g) => g.kg)), 1) };
        if (an < 40) aviso(`Sueltas el balón muy plano (~${r1(an)}°): con 45-55° entra más fácil en el aro.`); else if (an > 62) aviso(`Sueltas el balón muy alto (~${r1(an)}°): lo usual es 45-55°.`); else bien(`Buen ángulo de salida (~${r1(an)}°).`);
        if (B) { if (medidos) bien(`La IA del balón lo siguió en ${medidos} de ${tiros.length} tiros.`); else aviso('La IA del balón no lo pudo seguir al salir de la mano. Se usó la velocidad de la mano.'); }
      } else aviso('No encontré tiros: la mano debe subir por encima de la cabeza al soltar el balón y verse completa.');
      avisoFps();
      return fin('Tiros', 'por minuto', tiros.map((g) => g.t));
    }

    // natacion (experimental): grabando desde fuera de la piscina, de lado. Cada ciclo = el brazo que mejor se ve
    // va adelante y vuelve. Velocidad = avance de la cadera (celular fijo).
    const brazo = visib([11, 13, 15]) >= visib([12, 14, 16]) ? L : R;
    const sep = serie((p) => (p[brazo.mun][0] - p[brazo.hom][0]) / torsoPx);
    const haciaCabeza = Math.sign(med(P.map((p) => (p ? p[0][0] - (p[23][0] + p[24][0]) / 2 : NaN)))) || 1; // hacia donde nada
    const piv = pivotes(sep, 0.5), ev = tiempos(piv.filter((q) => q.tipo === (haciaCabeza > 0 ? 'alto' : 'bajo')));
    const ciclos = ev.length, rt = ritmo(ev);
    const cx = serie((p) => (p[23][0] + p[24][0]) / 2);
    const a0 = ev.length ? Math.max(0, Math.round(ev[0] * fr)) : 0, a1 = ev.length ? Math.min(P.length - 1, Math.round(ev[ev.length - 1] * fr)) : P.length - 1;
    const vNado = a1 > a0 ? Math.abs(cx[a1] - cx[a0]) * mPorPx / (t[a1] - t[a0]) : NaN;
    kpi('Ciclos de brazada', ciclos, 'en el video'); kpi('Ritmo', r1(rt), 'ciclos por minuto');
    if (vNado > 0.2 && vNado < 3) {
      kpi('Velocidad', coma(vNado, 2), 'm/s (aprox.)');
      kpi('Ritmo por 100 m', `${Math.floor(100 / vNado / 60)}:${String(Math.round(100 / vNado % 60)).padStart(2, '0')}`, 'min (aprox.)');
      if (rt) kpi('Avance por ciclo', coma(vNado / (rt / 60), 2), 'm (más = brazada más eficiente)');
    }
    aviso('🧪 Experimental: el agua tapa parte del cuerpo y la IA puede perder los brazos. Tómalo como referencia.');
    return fin('Ciclos', 'ciclos/min', ev);
  }

  if (tipo === 'escaladores') {
    const sep = serie((p) => (p[25][0] - p[26][0]) / torsoPx);
    const ev = tiempos(pivotes(sep, 0.5));
    kpi('Ritmo', r1(ritmo(ev)), 'por minuto'); kpi('Repeticiones', ev.length, 'cada rodilla al pecho');
    const cad = serie((p) => mid(p, 23, 24)[1]), sube = (pct(cad, 0.9) - pct(cad, 0.1)) * mPorPx * 100;
    kpi('Movimiento de cadera', r1(sube), 'cm (aprox.)');
    if (sube > 12) aviso(`La cadera sube y baja mucho (~${r1(sube)} cm): mantén la plancha firme.`); else bien('Cadera estable en plancha.');
    return fin('Reps', 'por minuto', ev);
  }

  // burpees, jumping jacks, cuerdas de batalla y HIIT generico: se cuentan los ciclos de la señal mas clara
  const cand = {
    cadera: serie((p) => (mid(p, 27, 28)[1] - mid(p, 23, 24)[1]) / torsoPx),
    brazos: serie((p) => (mid(p, 11, 12)[1] - mid(p, 15, 16)[1]) / torsoPx),
    munecas: serie((p) => dist(p[15], p[16]) / torsoPx),
    pies: serie((p) => dist(p[27], p[28]) / torsoPx),
    rodilla: serie((p) => ang(p[lado.cad], p[lado.rod], p[lado.tob])),
  };
  const usar = { burpees: ['cadera'], jacks: ['brazos', 'pies'], ondas: ['brazos'], generico: Object.keys(cand) }[tipo];
  let mejor = null;
  for (const k of usar) {
    const piv = pivotes(cand[k], 0.5), altos = piv.filter((q) => q.tipo === (k === 'cadera' || k === 'rodilla' ? 'bajo' : 'alto'));
    const ev = tiempos(altos), dif = []; for (let j = 1; j < ev.length; j++) dif.push(ev[j] - ev[j - 1]);
    const cv = dif.length > 1 ? Math.sqrt(media(dif.map((d) => (d - media(dif)) ** 2))) / media(dif) : 9;
    if (!mejor || (ev.length >= 2 && cv < mejor.cv)) mejor = { ev, cv };
  }
  const ev = mejor ? mejor.ev : [];
  const nombre = { burpees: 'Burpees', jacks: 'Jumping jacks', ondas: 'Ondas', generico: 'Movimientos' }[tipo];
  kpi('Ritmo', r1(ritmo(ev)), 'por minuto'); kpi(nombre, ev.length, 'en el video');
  if (mejor && mejor.cv < 0.25 && ev.length >= 4) bien('Ritmo constante.'); else if (ev.length >= 4) aviso('El ritmo cambia bastante a lo largo del video (cansancio o pausas).');
  return fin(nombre, 'por minuto', ev);
}

// ---------------------------------------------------------------- video con telemetria
const OW = 1080, VH = 1290;
const COL = { bg: '#101218', rosa: '#ec48c8', verde: '#5adc78', cian: '#22d3ee', blanco: '#f0f0f0', gris: '#969ba5', amarillo: '#f2c200', violeta: '#7c5cff' };
const LINEAS = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const FUENTE = 'system-ui, -apple-system, Roboto, "Segoe UI", sans-serif';
// full: puntos interpolados por cuadro (fps). Devuelve dibujar(ctx, t, imagen) para generarVideo.
export function dibujoActividad(fuente, full, fps, a, balon = null) {
  const W = fuente.videoWidth, H = fuente.videoHeight, esc = OW / W, Hs = H * esc;
  const off = Hs < VH ? (VH - Hs) / 2 : 0;
  const cy = full.map((f) => { const ys = [11, 12, 23, 24].map((k) => f[k][1]).filter(Number.isFinite); return ys.length ? ys.reduce((x, y) => x + y) / ys.length * esc : Hs / 2; });
  const sup = cy.map((c) => Math.max(0, Math.min(Math.max(0, Hs - VH), c - VH * 0.48)));
  const curva = a.curva || [], vmax = Math.max(10, ...curva.map((c) => c.v || 0)) * 1.15;
  const GX0 = 90, GX1 = 1000, GY0 = VH + 330, GY1 = VH + 560;
  const gx = (t) => GX0 + (GX1 - GX0) * t / (a.dur || 1), gy = (v) => GY1 - (GY1 - GY0) * Math.min(1, v / vmax);
  return function dibujar(ctx, t, imagen) {
    const i = Math.max(0, Math.min(full.length - 1, Math.round(t * fps)));
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, OW, 1920);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, OW, VH); ctx.clip();
    const s0 = sup[i];
    if (imagen) ctx.drawImage(imagen, 0, -s0 + off, OW, Hs);
    const P = (k) => [full[i][k][0] * esc, full[i][k][1] * esc - s0 + off, full[i][k][2]];
    ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = COL.rosa;
    for (const [x, y] of LINEAS) { const p = P(x), q = P(y); if (p[2] > 0.3 && q[2] > 0.3) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } }
    for (const k of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p = P(k); if (p[2] > 0.3) { ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, 7); ctx.fillStyle = COL.verde; ctx.fill(); } }
    // destello en el instante de cada evento (paso, golpe, salto...)
    const reciente = (a.eventos || []).filter((e) => e.t <= t && t - e.t < 0.25);
    if (reciente.length && a.tipo === 'boxeo') for (const e of reciente) { const p = P(e.lado === 'izq' ? 15 : 16); ctx.beginPath(); ctx.arc(p[0], p[1], 34, 0, 7); ctx.strokeStyle = COL.amarillo; ctx.lineWidth = 8; ctx.stroke(); }
    // v2.35.0 analisis completo: el balon que vio la IA en este cuadro
    if (balon && balon.length) {
      const dtB = balon.length > 1 ? (balon[balon.length - 1].t - balon[0].t) / (balon.length - 1) : 1;
      const q = balon[Math.max(0, Math.min(balon.length - 1, Math.round((t - balon[0].t) / dtB)))];
      if (q && q.b && q.b[0]) { const [bx, by, br] = q.b[0]; ctx.beginPath(); ctx.arc(bx * esc, by * esc - s0 + off, Math.max(18, br * esc * 1.3), 0, 7); ctx.strokeStyle = COL.cian; ctx.lineWidth = 6; ctx.stroke(); }
    }
    ctx.restore();
    // panel
    const hechos = (a.eventos || []).filter((e) => e.t <= t);
    const r = curva[Math.min(curva.length - 1, Math.round(t / 0.5))];
    ctx.fillStyle = COL.blanco; ctx.font = `800 64px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(`${a.contador}: ${hechos.length}`, 40, VH + 90);
    // v2.35.4 deportes con balon: el ritmo (golpes por minuto) no tiene sentido; se muestra la velocidad del pie o la mano
    const esDep = ['futbol', 'basquet', 'voley', 'raqueta'].includes(a.tipo), ultD = esDep ? hechos[hechos.length - 1] : null;
    const queMide = a.tipo === 'futbol' ? 'Pie' : 'Mano', queVuela = a.tipo === 'raqueta' ? 'Pelota' : a.tipo === 'basquet' ? 'Salida' : 'Balón';
    ctx.font = `700 44px ${FUENTE}`; ctx.fillStyle = COL.cian; ctx.textAlign = 'right';
    ctx.fillText(esDep ? (ultD && ultD.v != null && a.tipo !== 'basquet' ? `${queMide} ${String(ultD.v).replace('.', ',')} m/s` : '') : r && r.v ? `${Math.round(r.v)} ${a.unidad}` : '', OW - 40, VH + 88);
    if (a.tipo === 'boxeo') {
      const iz = hechos.filter((e) => e.lado === 'izq').length;
      ctx.font = `600 36px ${FUENTE}`; ctx.fillStyle = COL.gris; ctx.textAlign = 'left';
      ctx.fillText(`Izquierda ${iz} · Derecha ${hechos.length - iz}`, 40, VH + 150);
      // v2.34.1: velocidad y fuerza del ultimo golpe (y la maxima hasta ahora), debajo del ritmo
      const ult = hechos[hechos.length - 1];
      if (ult && ult.v != null) {
        const coma = (x) => String(x).replace('.', ',');
        ctx.textAlign = 'right'; ctx.fillStyle = COL.amarillo; ctx.font = `700 38px ${FUENTE}`;
        ctx.fillText(ult.fuerza != null ? `Golpe ~${ult.fuerza} kg · ${coma(ult.v)} m/s` : `Golpe ${coma(ult.v)} m/s`, OW - 40, VH + 150);
        const fMax = Math.max(...hechos.map((e) => e.fuerza ?? -1));
        if (fMax > 0) { ctx.fillStyle = COL.gris; ctx.font = `600 30px ${FUENTE}`; ctx.fillText(`Máx. ~${fMax} kg`, OW - 40, VH + 205); }
      }
    }
    // v2.35.0 deportes: velocidad del balón y fuerza del último contacto, debajo del ritmo
    if (['futbol', 'basquet', 'voley', 'raqueta'].includes(a.tipo)) {
      const ult = hechos[hechos.length - 1];
      if (ult && ult.kmh != null) {
        ctx.textAlign = 'right'; ctx.fillStyle = COL.amarillo; ctx.font = `700 38px ${FUENTE}`;
        ctx.fillText(`${queVuela} ~${ult.kmh} km/h${ult.medido ? ' ✓' : ''} · ${ult.fuerza} kg`, OW - 40, VH + 150);
        const mx = Math.max(...hechos.map((e) => e.kmh ?? -1));
        ctx.fillStyle = COL.gris; ctx.font = `600 30px ${FUENTE}`; ctx.fillText(`Máx. ~${mx} km/h`, OW - 40, VH + 205);
      }
    }
    ctx.font = `600 32px ${FUENTE}`; ctx.fillStyle = COL.gris; ctx.textAlign = 'left';
    ctx.fillText(a.nombre, 40, VH + 210);
    ctx.textAlign = 'center'; ctx.fillText(esDep ? ({ futbol: 'Velocidad del balón en cada patada', voley: 'Velocidad del balón en cada remate', raqueta: 'Velocidad de la pelota en cada golpe', basquet: 'Velocidad de salida en cada tiro' })[a.tipo] + ' (km/h)' : `Ritmo (${a.unidad})`, OW / 2, GY0 - 24);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(GX0, GY1); ctx.lineTo(GX1, GY1); ctx.stroke();
    if (esDep) { // una barra por golpe con su velocidad
      const kmax = Math.max(20, ...(a.eventos || []).map((e) => e.kmh || 0)) * 1.15;
      ctx.font = `700 26px ${FUENTE}`;
      for (const e of hechos) { if (!(e.kmh > 0)) continue; const X = gx(e.t), Y = GY1 - (GY1 - GY0) * Math.min(1, e.kmh / kmax); ctx.fillStyle = e.medido ? COL.cian : COL.violeta; ctx.fillRect(X - 12, Y, 24, GY1 - Y); ctx.fillStyle = COL.blanco; ctx.fillText(String(Math.round(e.kmh)), X, Y - 10); }
    } else {
    // grafica del ritmo con eventos
    ctx.strokeStyle = COL.violeta; ctx.lineWidth = 5; ctx.beginPath(); let empezo = false;
    for (const c of curva) { if (c.t > t || c.v == null) { empezo = c.t > t ? empezo : false; continue; } const X = gx(c.t), Y = gy(c.v); if (!empezo) { ctx.moveTo(X, Y); empezo = true; } else ctx.lineTo(X, Y); }
    ctx.stroke();
    }
    ctx.fillStyle = COL.verde; for (const e of hechos) { ctx.beginPath(); ctx.arc(gx(e.t), GY1 + 18, 5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = COL.blanco; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx(t), GY0); ctx.lineTo(gx(t), GY1 + 30); ctx.stroke();
    // alertas (las dos primeras)
    ctx.textAlign = 'left'; ctx.font = `600 30px ${FUENTE}`;
    (a.alertas || []).slice(0, 2).forEach((x, k) => { ctx.fillStyle = x.nivel === 'aviso' ? COL.amarillo : COL.verde; ctx.fillText((x.nivel === 'aviso' ? '⚠ ' : '✓ ') + x.texto.slice(0, 58) + (x.texto.length > 58 ? '…' : ''), 40, GY1 + 90 + k * 46); });
    ctx.fillStyle = COL.gris; ctx.font = `600 26px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText('FuerzaPro · Ing. Luis Campozano, MBA', OW - 40, 1890);
  };
}
