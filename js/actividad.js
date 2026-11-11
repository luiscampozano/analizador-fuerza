// Analisis por video de cardio, boxeo y HIIT (no son series de fuerza: no hay carga ni 1RM).
// A partir de los puntos del cuerpo que detecta la IA se miden ritmos (pasos, pedaladas, remadas, saltos, golpes) y
// alertas de tecnica. Se recomienda grabar DE LADO, con el celular fijo y el cuerpo completo.
// Las distancias en cm se estiman con la estatura (torso = 30 % de la estatura): son aproximadas.

import { valoresEquipo, cambiados, textoValor } from './equipo.js';

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
// v2.36.8 minA: amplitud minima real (0,08 torsos en señales normalizadas, 10° en angulos). Sin ella, con la persona
// quieta el temblor de la IA se contaba como decenas de saltos, pasos o burpees.
function pivotes(x, k = 0.45, minA = 0.08) {
  const lo = pct(x, 0.05), hi = pct(x, 0.95), r = hi - lo; if (!(r > 0) || r < minA) return [];
  const p0 = zigzag(x, 0.2 * r), sw = [];
  for (let i = 1; i < p0.length; i++) sw.push(Math.abs(p0[i].v - p0[i - 1].v));
  if (!sw.length) return [];
  sw.sort((a, b) => b - a); const A = sw[Math.floor(sw.length * 0.3)] || sw[0];
  if (A < minA) return [];
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
  // v2.51.0 equipo del deporte: sin cfg.equipo (o con los valores estándar) todo sale igual que antes
  const eq = valoresEquipo(tipo, cfg.equipo), eqCambiado = cambiados(tipo, eq);
  if (eqCambiado.length) { res.equipo = eq; bien('Calculado con tu equipo: ' + eqCambiado.map((c) => `${c.nombre.toLowerCase()} ${textoValor(c, c.valor)}`).join(' · ') + '.'); }
  const fin = (contador, unidad, evT, factor = 1) => {
    res.contador = contador; res.total = evT.length; res.unidad = unidad;
    if (!evT.length && !res.alertas.some((x) => /No encontré|No detecté/.test(x.texto))) aviso('No detecté el movimiento: revisa que se vea el cuerpo completo, de lado, y que el ejercicio sea el correcto.');
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
    // v2.36.8 cadera respecto al pie de apoyo (el mas bajo): asi no cuenta si la camara sube y baja (camara en mano)
    const cy = rellenar(suave(P.map((p) => (p ? mid(p, 23, 24)[1] - Math.max(p[27][1], p[28][1]) : NaN)), 1)), base = suave(cy, Math.round(0.6 * fr)); // poco suavizado: el rebote es rapido
    const osc = cy.map((v, i) => v - base[i]), rebote = (pct(osc, 0.97) - pct(osc, 0.03)) * mPorPx * 100;
    // inclinacion del tronco (+ = hacia adelante)
    const incl = med(P.map((p) => { if (!p) return NaN; const h = mid(p, 11, 12), c = mid(p, 23, 24); return Math.atan2((h[0] - c[0]) * avance, c[1] - h[1]) * 180 / Math.PI; }));
    // simetria: tiempo de los pasos izquierdos vs derechos
    const dIz = [], dDe = []; for (let k = 1; k < res.eventos.length; k++) (res.eventos[k].lado === 'izq' ? dIz : dDe).push(res.eventos[k].t - res.eventos[k - 1].t);
    const asim = dIz.length > 2 && dDe.length > 2 ? Math.abs(media(dIz) - media(dDe)) / ((media(dIz) + media(dDe)) / 2) * 100 : null;
    kpi('Rebote', r1(rebote), 'cm (aprox.)'); kpi('Pie al pisar', r1(sobre), 'cm delante de la cadera (aprox.)');
    kpi('Tronco', r1(incl), '° de inclinación adelante'); if (asim != null) kpi('Asimetría', r1(asim, 1), '% entre piernas');
    if (tipo === 'carrera') {
      if (Number.isFinite(cad) && cad < 155) aviso(`Cadencia baja (${r1(cad)} pasos/min). Dar pasos más cortos y rápidos (subir 5-10 %) reduce el impacto en rodillas y caderas.`); else if (Number.isFinite(cad)) bien(`Buena cadencia (${r1(cad)} pasos/min).`);
      if (rebote > 10) aviso(`Rebotas mucho (~${r1(rebote)} cm). Piensa en avanzar, no en saltar: más cadencia y menos impulso hacia arriba.`); else if (Number.isFinite(rebote) && ev.length) bien(`Rebote controlado (~${r1(rebote)} cm).`);
      if (sobre > 35) aviso(`Posible sobrezancada: el pie cae ~${r1(sobre)} cm delante de la cadera. Intenta apoyar más debajo del cuerpo.`);
    }
    if (incl > 20) aviso(`Tronco muy inclinado hacia adelante (${r1(incl)}°). Corre «alto», con una inclinación leve desde los tobillos.`);
    else if (incl < -2) aviso(`Tronco hacia atrás (${r1(incl)}°): inclínate levemente hacia adelante.`);
    if (asim != null && asim > 8) aviso(`Pasos desiguales entre piernas (${r1(asim, 1)} %). Puede ser cansancio, una molestia o la grabación.`);
    return fin('Pasos', 'pasos/min', ev);
  }

  if (tipo === 'bici' || tipo === 'eliptica' || tipo === 'escaladora') {
    const rod = serie((p) => ang(p[lado.cad], p[lado.rod], p[lado.tob]));
    const piv = pivotes(rod, 0.5, 10), altos = piv.filter((q) => q.tipo === 'alto'), ev = tiempos(altos);
    if (tipo === 'bici') {
      const rpm = ritmo(ev), abajo = med(altos.map((q) => q.v));
      const caderaMin = med(piv.filter((q) => q.tipo === 'bajo').map((q) => { const p = P[q.i]; return p ? ang(p[lado.hom], p[lado.cad], p[lado.rod]) : NaN; }));
      kpi('Cadencia', r1(rpm), 'RPM'); kpi('Pedaladas', ev.length, 'en el video');
      kpi('Rodilla abajo', r1(abajo), '° (ideal 140-150)'); kpi('Cadera arriba', r1(caderaMin), '° (ángulo más cerrado)');
      if (abajo < 135) aviso(`La rodilla queda muy doblada abajo (${r1(abajo)}°): el sillín parece BAJO. Súbelo 1-2 cm y vuelve a medir.`);
      else if (abajo > 155) aviso(`La rodilla casi se estira abajo (${r1(abajo)}°): el sillín parece ALTO. Bájalo 1 cm y vuelve a medir.`);
      else if (Number.isFinite(abajo)) bien(`Altura de sillín correcta (rodilla a ${r1(abajo)}° abajo).`);
      if (caderaMin < 40) aviso(`La cadera se cierra mucho arriba (${r1(caderaMin)}°): revisa la distancia al manillar o la altura del sillín.`);
      if (Number.isFinite(rpm) && rpm < 60) aviso(`Cadencia baja (${r1(rpm)} RPM): con menos resistencia y más RPM (80-100) cuidas las rodillas.`); else if (Number.isFinite(rpm)) bien(`Cadencia de ${r1(rpm)} RPM.`);
      return fin('Pedaladas', 'RPM', ev);
    }
    // eliptica: vueltas por minuto · escaladora: pasos por minuto (cada vuelta de una pierna = 2 pasos)
    const pasos = tipo === 'escaladora';
    kpi(pasos ? 'Ritmo' : 'Cadencia', ritmo(ev) == null ? null : r1(ritmo(ev) * (pasos ? 2 : 1)), pasos ? 'pasos por minuto' : 'vueltas por minuto');
    kpi(pasos ? 'Pasos' : 'Vueltas', ev.length * (pasos ? 2 : 1), 'en el video');
    const incl = med(P.map((p) => { if (!p) return NaN; const h = mid(p, 11, 12), c = mid(p, 23, 24); return Math.abs(Math.atan2(h[0] - c[0], c[1] - h[1]) * 180 / Math.PI); }));
    kpi('Tronco', r1(incl), '° respecto a la vertical');
    if (incl > 25) aviso(`Te apoyas mucho hacia adelante (${r1(incl)}°): suelta un poco el peso de los brazos y endereza el tronco.`); else if (ev.length) bien('Postura del tronco erguida.');
    return fin(pasos ? 'Pasos' : 'Vueltas', pasos ? 'pasos/min' : 'vueltas/min', ev, pasos ? 2 : 1);
  }

  if (tipo === 'remo') {
    const rod = serie((p) => ang(p[lado.cad], p[lado.rod], p[lado.tob]));
    const cod = serie((p) => ang(p[lado.hom], p[lado.cod], p[lado.mun]));
    const piv = pivotes(rod, 0.5, 10), ataques = piv.filter((q) => q.tipo === 'bajo'), ev = tiempos(ataques);
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
    const piv = pivotes(pies, 0.5, 0.03), altos = piv.filter((q) => q.tipo === 'alto'), ev = tiempos(altos); // saltos de 2-5 cm: minimo 0,03 torsos
    // v2.36.8 la altura con el punto MAS BAJO del pie (talon o punta): el tobillo sube al ponerse de puntas sin despegar
    const suela = rellenar(suave(P.map((p) => (p ? -Math.max(p[29][1], p[30][1], p[31][1], p[32][1]) / torsoPx : NaN)), 1));
    const alt = []; for (let k = 1; k < piv.length; k++) if (piv[k].tipo === 'alto') { const a0 = piv[k - 1].i, a1 = piv[k].i; const lo = Math.min(...suela.slice(Math.max(0, a0 - 2), a0 + 3)), hi = Math.max(...suela.slice(Math.max(0, a1 - 2), a1 + 3)); alt.push((hi - lo) * torsoPx * mPorPx * 100); }
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
    const serieV = (s, f, nn = n) => { // como serie(), pero sin puntos poco visibles y rellenando solo huecos cortos
      const x = suave(P.map((p) => { if (!visible(p, s)) return NaN; const v = f(p); return Number.isFinite(v) ? v : NaN; }), nn);
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
      // v2.36.8 velocidad: poco suavizado (0,02 s; con 0,07 s todos los golpes salian iguales: medía el largo del brazo)
      // y respecto a la cadera, en metros con la escala de cada cuadro (la camara o el cuerpo que se mueven no suman)
      const nV = Math.max(1, Math.round(0.02 * fr));
      const escB = (p) => (cfg.altura || 1.7) * 0.30 / ((dist(p[11], p[23]) + dist(p[12], p[24])) / 2 || torsoPx);
      const mx = serieV(s, (p) => (p[s.mun][0] - (p[23][0] + p[24][0]) / 2) * escB(p), nV), my = serieV(s, (p) => (p[s.mun][1] - (p[23][1] + p[24][1]) / 2) * escB(p), nV);
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
        golpes.push({ i: b, t: t[b], lado: nomLado, v: Math.min(vmax, 20), clase }); // mx/my ya estan en metros
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
    // v2.34.0 fuerza aproximada del golpe (impulso): F = k · m_ef · v; k = 129 /s calibrado con boxeadores olímpicos
    // (Walilko 2005: 2,9 kg, 9,1 m/s, 3427 N). v2.36.8: masa efectiva de aficionado ~2,2 % del peso en rectos y 1,9 % en
    // ganchos/uppercuts (los olímpicos ~4 %, pero un aficionado mete menos cuerpo en el golpe), ahora que la velocidad
    // de la mano se mide bien. Margen amplio (±35 %): técnica, guante y saco. La altura entra en la escala.
    if (cfg.peso > 0 && golpes.length) {
      const fuerza = (v, clase) => 129 * cfg.peso * (clase === 'recto' ? 0.022 : 0.019) * v / 9.81; // kg
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
    // v2.36.2 la IA a veces intercambia izquierda y derecha de un cuadro a otro (de lado se ve un brazo encima del
    // otro): la mano "salta" al otro lado del cuerpo y parece un golpe a 300 km/h. Si cruzar los lados hace que todo se
    // mueva mucho menos respecto al cuadro anterior, se cruzan (en una copia: el video usa los puntos originales).
    if (tipo !== 'natacion') {
      let prev = null;
      for (let i = 0; i < P.length; i++) {
        const p = P[i]; if (!p) continue;
        if (prev) for (const grupo of [[[13, 14], [15, 16], [17, 18], [19, 20], [21, 22]], [[25, 26], [27, 28], [29, 30], [31, 32]]]) {
          let igual = 0, cruz = 0;
          for (const [a, b] of grupo) { igual += dist(p[a], prev[a]) + dist(p[b], prev[b]); cruz += dist(p[a], prev[b]) + dist(p[b], prev[a]); }
          if (cruz < 0.5 * igual) { const q = p.slice(); for (const [a, b] of grupo) { q[a] = p[b]; q[b] = p[a]; } P[i] = q; }
        }
        prev = P[i];
      }
    }
    // v2.36.3 la IA a veces salta a OTRA persona (alguien sentado atras, el rival) por unos cuadros: esos cuadros se
    // descartan. Se sigue a la persona principal: la cadera no puede saltar mas de ~0,6 torsos por cada 1/30 s y el
    // torso no puede cambiar de tamaño mas de 35 % de un cuadro a otro.
    {
      const tam = (p) => (dist(p[11], p[23]) + dist(p[12], p[24])) / 2, cen = (p) => [(p[23][0] + p[24][0]) / 2, (p[23][1] + p[24][1]) / 2];
      const tMed = med(P.map((p) => (p ? tam(p) : NaN)));
      let ref = null, tRef = 0;
      for (let i = 0; i < P.length; i++) {
        const p = P[i]; if (!p) continue;
        const s0 = tam(p), c = cen(p);
        if (!ref) { if (Math.abs(s0 / tMed - 1) < 0.25) { ref = { s: s0, c }; tRef = t[i]; } else P[i] = null; continue; }
        const salto = dist(c, ref.c) / ref.s, pasos = Math.max(1, (t[i] - tRef) * 30);
        const perdido = t[i] - tRef > 0.4 && Math.abs(s0 / tMed - 1) < 0.3; // mucho rato sin verla: se vuelve a enganchar
        if (!perdido && (Math.abs(s0 / ref.s - 1) > 0.35 || salto > 0.6 * pasos + 0.3)) { P[i] = null; continue; }
        ref = { s: 0.7 * ref.s + 0.3 * s0, c }; tRef = t[i];
      }
      res.usables = P.filter(Boolean).length / Math.max(1, P.length);
    }
    // escala de cada cuadro (si la persona se acerca o se aleja, o hay zoom): torso = 30 % de la estatura
    const torsoI = rellenar(P.map((p) => (p ? (dist(p[11], p[23]) + dist(p[12], p[24])) / 2 : NaN)));
    const escI = (() => { const w = Math.round(0.5 * fr), o = []; for (let i = 0; i < torsoI.length; i++) o.push((cfg.altura || 1.7) * 0.30 / (med(torsoI.slice(Math.max(0, i - w), i + w + 1)) || torsoPx)); return o; })();
    const corto = Math.round(0.15 * fr), nn = Math.max(1, Math.round(0.02 * fr));
    const serieVis = (k, f) => { // solo con el punto bien visible; rellena huecos cortos
      const x = suave(P.map((p) => { if (!p || !((p[k][2] ?? 1) >= 0.4)) return NaN; const v = f(p); return Number.isFinite(v) ? v : NaN; }), nn);
      const y = rellenar(x); let i = 0;
      while (i < x.length) { if (Number.isFinite(x[i])) { i++; continue; } let j = i; while (j < x.length && !Number.isFinite(x[j])) j++; if (j - i > corto || i === 0 || j === x.length) for (let q = i; q < j; q++) y[q] = NaN; i = j; }
      return y;
    };
    const malo = (() => { // la escala cambia >20 % en 0,2 s o la cadera cruza la imagen a mas de 15 torsos por segundo
      const w = Math.max(1, Math.round(0.2 * fr)), cx = rellenar(P.map((p) => (p ? (p[23][0] + p[24][0]) / 2 : NaN))), cy = rellenar(P.map((p) => (p ? (p[23][1] + p[24][1]) / 2 : NaN)));
      return P.map((_, i) => { const j = Math.max(0, i - w); const dt = (t[i] - t[j]) || 1; return Math.abs(torsoI[i] / torsoI[j] - 1) > 0.2 || Math.hypot(cx[i] - cx[j], cy[i] - cy[j]) / torsoI[i] / dt > 15; });
    })();
    const velDe = (k, crudo = false, absoluto = false, refK = null) => { // m/s; vy + = hacia abajo
      // v2.36.2 posicion RESPECTO A LA CADERA y en metros con la
      // escala de cada cuadro: si la camara se mueve o sigue a la persona, no se suma su movimiento a la mano
      const [a, b] = refK != null ? [refK, refK] : absoluto ? [null, null] : [23, 24]; // la cadera: asi cuenta el giro del tronco (parte del golpe) pero no el movimiento de la camara
      // v2.36.3 el antebrazo (o la pierna) mide siempre lo mismo: si la muñeca aparece mucho mas lejos o cerca del codo
      // de lo normal, la IA la puso en otro lado (en la raqueta, en otra persona) y ese cuadro no se usa
      const padre = { 15: 13, 16: 14, 27: 25, 28: 26, 31: 27, 32: 28 }[k];
      const largoMed = padre != null ? med(P.map((p) => (p ? dist(p[k], p[padre]) / ((dist(p[11], p[23]) + dist(p[12], p[24])) / 2) : NaN))) : NaN;
      const bienLargo = (p) => { if (crudo || !(largoMed > 0)) return true; const r = dist(p[k], p[padre]) / ((dist(p[11], p[23]) + dist(p[12], p[24])) / 2); return r < 1.35 * largoMed && r > 0.45 * largoMed; };
      const rx = (p) => (a == null ? 0 : (p[a][0] + p[b][0]) / 2), ry = (p) => (a == null ? 0 : (p[a][1] + p[b][1]) / 2);
      let x = serieVis(k, (p) => (bienLargo(p) ? p[k][0] - rx(p) : NaN)), y = serieVis(k, (p) => (bienLargo(p) ? p[k][1] - ry(p) : NaN));
      // v2.36.3 limpieza de picos de un cuadro: si el punto se aparta mucho de la linea entre su cuadro anterior y el
      // siguiente (mas de lo que permite la aceleracion de una mano real), es un error de la IA (persona lejos, borrosa
      // o lados cruzados) y se reemplaza por el promedio de los vecinos. Dos pasadas (errores de 2 cuadros).
      if (!crudo) {
        const umbral = (i) => torsoI[i] * Math.max(0.35, 0.6 * (30 / fr) ** 2);
        for (let pasada = 0; pasada < 2; pasada++) for (const z of [x, y]) {
          const o = z.slice();
          for (let i = 1; i < z.length - 1; i++) { const m = (o[i - 1] + o[i + 1]) / 2; if (Number.isFinite(m) && Math.hypot(x[i] - (x[i - 1] + x[i + 1]) / 2, y[i] - (y[i - 1] + y[i + 1]) / 2) > umbral(i)) z[i] = m; }
        }
      }
      const v = x.map(() => NaN), vx = v.slice(), vy = v.slice();
      // v2.36.3 velocidad sobre ~1/30 s aunque el video sea de 60 o 120 fps: con mas cuadros el temblor de la IA se
      // dividia por un tiempo mas corto y la velocidad salia inflada
      const kk = crudo ? 1 : Math.max(1, Math.round(fr / 30)), h2 = Math.floor(kk / 2);
      for (let i = 1; i < x.length; i++) { const i0 = Math.max(0, i - h2 - (kk % 2)), i1 = Math.min(x.length - 1, i0 + kk); const dt = t[i1] - t[i0] || kk / fr, e = escI[i]; vx[i] = (x[i1] - x[i0]) / dt * e; vy[i] = (y[i1] - y[i0]) / dt * e; v[i] = Math.hypot(vx[i], vy[i]); }
      // imposible para una persona (la IA perdio el punto): mano > 25 m/s, pie > 32 m/s; y cuadros con la camara
      // moviendose o haciendo zoom de golpe (la IA ve borroso y los puntos saltan)
      const tope = k <= 22 ? 25 : 32; for (let i = 0; i < v.length; i++) if (v[i] > tope || malo[i]) { v[i] = vx[i] = vy[i] = NaN; }
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
    // v2.36.7 altura del salto = cuanto se despegan los PIES del piso (el pie mas bajo respecto a donde estaba antes y
    // despues del salto). Antes se media la cadera desde la sentadilla previa y salia el doble (32 cm en un salto de 10).
    // v2.36.8 el punto mas bajo de talones y puntas (en el aire el pie va en punta: el tobillo subia 8-9 cm de mas)
    const pieY = P.map((p) => { if (!p) return NaN; const ys = [29, 30, 31, 32].filter((k) => (p[k][2] ?? 1) >= 0.5).map((k) => p[k][1]); return ys.length >= 2 ? Math.max(...ys) : NaN; }); // solo puntos del pie bien vistos
    const saltoCm = (i) => {
      const r = (a, b) => pieY.slice(Math.max(0, i + Math.round(a * fr)), Math.max(0, i + Math.round(b * fr)) + 1).filter(Number.isFinite);
      const piso = med([...r(-1.0, -0.4), ...r(0.4, 1.0)]), vuelo = r(-0.35, 0.35);
      if (!Number.isFinite(piso) || !vuelo.length) return NaN;
      const alto = Math.min(...vuelo), e = escI[i] || mPorPx;
      const cm = Math.max(0, (piso - alto) * e * 100);
      return cm > 80 ? NaN : cm; // v2.36.10 mas de 80 cm en un tiro o remate no es creible: la IA perdio los pies (persona lejos, camara moviendose)
    };
    // IA del balon (analisis completo): velocidad medida justo despues del contacto, siguiendo al balon cuadro a cuadro
    const B = Array.isArray(cfg.balon) && cfg.balon.length === P.length ? cfg.balon : null;
    // v2.36.5 el detector ve muchas cosas redondas: solo cuenta lo que tiene el tamaño de un balon de ese deporte
    const RADIO = eq.diametro > 0 ? eq.diametro / 200 : { futbol: 0.11, basquet: 0.12, voley: 0.105, raqueta: 0.033 }[tipo] || 0.11; // v2.51.0 diámetro del balón (cm) del equipo
    const tamBalon = (c, j) => { const r = c[2] * (escI[j] || mPorPx); return r > RADIO * 0.4 && r < RADIO * (tipo === 'raqueta' ? 4 : 2.5); };
    const balonTras = (i, punto) => {
      if (!B) return null;
      const fin = Math.min(P.length - 1, i + Math.round(0.5 * fr)); let prev = punto, pts = [];
      for (let j = Math.max(0, i - 1); j <= fin; j++) {
        const cand = B[j]; if (!cand || !cand.length) continue;
        let mejor = null, dm = Infinity;
        for (const c of cand) { if (!tamBalon(c, j)) continue; const d = prev ? Math.hypot(c[0] - prev[0], c[1] - prev[1]) : 0; if (d < dm) { dm = d; mejor = c; } }
        if (!mejor) continue;
        if (prev && dm > Math.max(4 * (mejor[2] || 20), 60 / mPorPx * (t[j] - t[Math.max(0, i - 1)] + 0.05))) continue; // salto imposible: otra cosa
        pts.push([t[j], mejor[0], mejor[1]]); prev = mejor;
        if (pts.length >= 7) break;
      }
      const tras = pts.filter((q) => q[0] > t[i]);
      if (tras.length < 2) return null;
      // v2.36.8 se quita la caida por gravedad antes del ajuste recto (si no, el angulo de salida salia unos 4° bajo)
      const eB = escI[i] || mPorPx, t0 = tras[0][0]; for (const q of tras) q[2] -= 0.5 * 9.81 * (q[0] - t0) ** 2 / eB;
      const ajuste = (k) => { const mt = media(tras.map((q) => q[0])), mk = media(tras.map((q) => q[k])); let a = 0, b = 0; for (const q of tras) { a += (q[0] - mt) * (q[k] - mk); b += (q[0] - mt) ** 2; } return b ? a / b : NaN; };
      const vb = Math.hypot(ajuste(1), ajuste(2)) * eB;
      balonTras.ang = Math.atan2(-ajuste(2), Math.abs(ajuste(1))) * 180 / Math.PI; // + = hacia arriba
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
    if (res.usables < 0.6) aviso(`La IA perdió a la persona en el ${Math.round(100 - res.usables * 100)} % del video (estaba lejos, se confundió con otra persona o la cámara se movió). Graba más cerca, con trípode y sin gente detrás: los números serán más confiables.`);
    const avisoFps = () => { if (fr < 45) aviso('Video a menos de 60 fps: en movimientos tan rápidos la IA pierde parte del recorrido y la velocidad sale más baja. Graba a 60 fps (la app lo analiza a 60 automáticamente).'); };
    if (!cfg.peso) aviso('Pon tu peso corporal para que la estimación de fuerza sea tuya (se usó 75 kg).');

    if (tipo === 'futbol') {
      // v2.36.8 el pie que patea respecto al TOBILLO DE APOYO (quieto en el piso): se quita la camara pero no el avance
      // del cuerpo, que tambien empuja el balon (respecto a la cadera salia ~18 % bajo con carrera de aproximacion)
      const pies = [[L, 'izq', R], [R, 'der', L]].map(([s, nom, o]) => ({ s, nom, ...velDe(s.pie, false, false, o.tob), vCad: velDe(s.pie).v }));
      const vtop = pct(pies.flatMap((q) => q.v), 0.98);
      const golpes = [];
      for (const pg of pies) {
        const otro = pies.find((q) => q !== pg);
        const ok = (i) => { const p = P[i]; if (!p) return false;
          if (otro.vCad[i] > 0.6 * pg.vCad[i]) return false; // el otro pie apoyado (no es correr)
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
      // v2.51.0 equipo de tenis/pádel; con el estándar dan EXACTO 2, 0.3, 0.058, 0.75 y 0.005 (resultado de antes).
      // cabeza: la parte que suma la raqueta a la velocidad de la mano crece con el largo (68,5 cm → ×2; pádel 45,5 → ×1,66).
      // M: masa efectiva en el impacto proporcional al peso (Me = SW/R², Cross/Brody). tension: casi no cambia la salida
      // (Haake/Goodwill: 40 vs 70 lb sin diferencia medible; Brody: algo más con menos tensión → exponente 0,02) pero el
      // contacto dura ~20 % más a 40 lb que a 70 lb → tc ∝ (25/T)^0,34.
      const rq = tipo !== 'raqueta' ? null : {
        cabeza: eq.largo === 68.5 ? 2 : 1 + eq.largo / 68.5,
        M: eq.peso === 300 ? 0.3 : 0.3 * eq.peso / 300,
        m: eq.pelota === 58 ? 0.058 : eq.pelota / 1000,
        e: eq.tension === 25 ? 0.75 : 0.75 * (25 / eq.tension) ** 0.02,
        tc: eq.tension === 25 ? 0.005 : 0.005 * (25 / eq.tension) ** 0.34,
      };
      const manos = [[L, 'izq'], [R, 'der']].map(([s, nom]) => ({ s, nom, ...velDe(s.mun) }));
      const vtop = pct(manos.flatMap((q) => q.v), 0.98), golpes = [];
      for (const m of manos) {
        const ok = (i) => { const p = P[i]; if (!p) return false;
          return tipo === 'raqueta' || p[m.s.mun][1] < Math.min(p[11][1], p[12][1]); }; // voley: remate o saque, mano arriba
        for (const i of picos(m.v, Math.max(4, 0.5 * vtop), 0.8, ok)) {
          const p = P[i], arriba = p && p[m.s.mun][1] < Math.min(p[11][1], p[12][1]);
          // voley: la mano (masa efectiva ~4 % del peso) contra un balon de 270 g; raqueta (v2.36.8): la cabeza va ~2 veces
          // mas rapido que la mano y pega con ~0,3 kg efectivos a una pelota de 58 g (como un saque: no suma la pelota que
          // llega). A 30 fps la IA pierde el pico del golpe (-20 a -27 % medido): se corrige ×1,2
          const vm = m.v[i] * (fr < 45 ? 1.2 : 1);
          const c = tipo === 'voley' ? choque(vm, 0.04 * peso, 0.27, 0.5, 0.012) : choque(rq.cabeza * vm, rq.M, rq.m, rq.e, rq.tc);
          golpes.push({ i, t: t[i], lado: m.nom, k: m.s.mun, v: vm, arriba, salto: saltoCm(i), ...c });
        }
      }
      golpes.splice(0, golpes.length, ...unir(golpes, tipo === 'voley' ? 1.2 : 1.5)); // tenis: el impulso hacia atras y el golpe son un solo golpe
      if (tipo === 'raqueta' && golpes.length) { // la raqueta va en una sola mano: la que mas golpes tiene (la IA confunde los lados)
        const iz = golpes.filter((g) => g.lado === 'izq').length, dom = iz > golpes.length - iz ? 'izq' : 'der'; for (const g of golpes) g.lado = dom;
      }
      if (tipo === 'voley') {
        resumenGolpes(golpes, 'Remates', 'Velocidad del balón', 0.27, 0.012, 'Mano más rápida');
        const s = med(golpes.map((g) => g.salto));
        if (s > 5) kpi('Salto', r1(s), 'cm (aprox.)');
        if (!golpes.length) aviso('No encontré remates ni saques: la mano debe golpear por encima de la cabeza y verse completa.');
      } else {
        resumenGolpes(golpes, 'Golpes', 'Velocidad de la pelota', rq.m, rq.tc, 'Mano más rápida');
        if (golpes.length) kpi('Por arriba', golpes.filter((g) => g.arriba).length, 'remates o saques');
        if (!golpes.length) aviso('No encontré golpes: graba con el brazo de la raqueta a la vista.');
        else bien('Velocidad de la pelota estimada con la mano: la cabeza de la raqueta va ~1,5 veces más rápido que la mano.');
      }
      avisoFps();
      return fin(tipo === 'voley' ? 'Remates' : 'Golpes', 'por minuto', golpes.map((g) => g.t));
    }

    if (tipo === 'basquet') {
      // v2.36.5 tiro = la muñeca llega a su punto MAS ALTO sobre la cabeza con el codo estirado, despues de subir (al
      // menos 0,5 torsos en los 0,8 s anteriores). La velocidad de salida es la mayor velocidad hacia arriba en
      // los 0,6 s antes de ese punto (con el salto incluido: es lo que lleva el balon). Antes se exigia el codo estirado
      // justo en el instante mas rapido y en un tiro real el codo todavia esta doblado ahi.
      const manos = [[L, 'izq'], [R, 'der']].map(([s, nom]) => ({ s, nom, ...velDe(s.mun, true, true) }));
      const tiros = [], w3 = Math.round(0.3 * fr), w5 = Math.round(0.8 * fr), w35 = Math.round(0.6 * fr);
      // altura de las manos (la que se vea) para saber si subieron: la mano lejana a veces la IA casi no la ve
      const altoAmbas = P.map((p, i) => { if (!p) return NaN; const hs = [15, 16].filter((k) => (p[k][2] ?? 1) >= 0.3).map((k) => (Math.min(p[11][1], p[12][1]) - p[k][1]) / torsoI[i]); return hs.length ? Math.max(...hs) : NaN; });
      for (const m of manos) {
        const alto = P.map((p, i) => (p && (p[m.s.mun][2] ?? 1) >= 0.3 ? (Math.min(p[11][1], p[12][1]) - p[m.s.mun][1]) / torsoI[i] : NaN));
        for (let i = 1; i < P.length - 1; i++) {
          const h = alto[i], p = P[i]; if (!(h > 0.45) || !p || ang(p[m.s.hom], p[m.s.cod], p[m.s.mun]) < 135) continue;
          // postura creible: la cabeza sobre los hombros y la muñeca sobre la cabeza (descarta cuadros donde la IA se confundio)
          const hom = Math.min(p[11][1], p[12][1]); if (!(hom - p[0][1] > 0.05 * torsoI[i]) || !(p[m.s.mun][1] < p[0][1])) continue;
          let cima = true; for (let j = Math.max(0, i - w3); j <= Math.min(P.length - 1, i + w3); j++) if (alto[j] > h) { cima = false; break; }
          if (!cima) continue;
          // al tirar se sube el balon con las dos manos: la otra mano (si se ve) tambien pasa sobre los hombros cerca de ese momento
          const otra = m.s === L ? 16 : 15, vOtra = [];
          for (let j = Math.max(0, i - w5); j <= Math.min(P.length - 1, i + w3); j++) { const q = P[j]; if (q && (q[otra][2] ?? 1) >= 0.5) vOtra.push((Math.min(q[11][1], q[12][1]) - q[otra][1]) / torsoI[j]); }
          if (vOtra.length >= 3 && !(Math.max(...vOtra) > 0.2)) continue;
          const previos = altoAmbas.slice(Math.max(0, i - w5), i).filter(Number.isFinite); // con la mano que mejor se vea
          if (!previos.length || !(h - Math.min(...previos) > 0.5)) continue;
          let b = -1, vb = 0; for (let j = Math.max(1, i - w35); j <= i; j++) { const up = -m.vy[j]; if (up > vb) { vb = up; b = j; } }
          if (b < 0) b = i; // la IA no vio bien la mano subiendo: el tiro cuenta igual
          let a = b; while (a > 0 && t[b] - t[a] < 0.7 && -m.vy[a - 1] > 0.2 * vb) a--;
          const g = { i: b, cima: i, brazo: Math.atan2(p[m.s.cod][1] - p[m.s.mun][1], Math.abs(p[m.s.mun][0] - p[m.s.cod][0])) * 180 / Math.PI, t: t[b], lado: m.nom, k: m.s.mun, v: m.v[b], ang: Math.atan2(-m.vy[b], Math.abs(m.vx[b])) * 180 / Math.PI, tEmp: Math.max(0.15, Math.min(0.7, t[b] - t[a])), salto: saltoCm(i) };
          const otro = tiros.find((x) => Math.abs(x.t - g.t) < 1.5); // la otra mano en el mismo tiro: queda la mas rapida
          if (otro) { if (g.v > otro.v) Object.assign(otro, g); } else tiros.push(g);
        }
      }
      tiros.sort((a, b) => a.t - b.t);
      // v2.36.5 la velocidad de salida del balon viene sobre todo del golpe de muñeca final (centesimas de segundo): la
      // IA del cuerpo no la puede medir bien. Solo se muestra cuando la IA del balon lo sigue (velocidad y angulo reales
      // de su vuelo); con «Solo cuerpo» se dan tiros, salto y angulo del brazo.
      let medidos = 0;
      for (const g of tiros) {
        const p = P[g.i], vm = balonTras(g.i, p ? [p[g.k][0], p[g.k][1]] : null);
        if (vm) { medidos++; g.vb = vm; g.kmh = vm * 3.6; g.angB = balonTras.ang; g.kg = 0.62 * (vm / (g.tEmp || 0.3) + 9.81) / 9.81; g.medido = true; }
      }
      res.eventos = tiros.map((g) => ({ t: g.t, lado: g.lado, salto: Number.isFinite(g.salto) && g.salto > 3 ? r1(g.salto) : null, brazo: r1(g.brazo), ...(g.medido ? { v: r1(g.vb, 1), kmh: r1(g.kmh), medido: true } : {}) }));
      const iz = tiros.filter((g) => g.lado === 'izq').length;
      kpi('Tiros', tiros.length, `mano izq. ${iz} · der. ${tiros.length - iz}`);
      if (tiros.length) {
        const s = med(tiros.map((g) => g.salto)), br = med(tiros.map((g) => g.brazo)), med2 = tiros.filter((g) => g.medido);
        if (s > 5) kpi('Salto', r1(s), 'cm (aprox.)');
        kpi('Ángulo del brazo', r1(br), '° al soltar (respecto al piso)');
        if (med2.length) {
          const vs = med(med2.map((g) => g.vb)), an = med(med2.map((g) => g.angB));
          kpi('Velocidad de salida', coma(vs), 'm/s · medida con la IA del balón');
          if (Number.isFinite(an)) {
            kpi('Ángulo de salida', r1(an), '° del balón (medido)');
            if (an < 40) aviso(`El balón sale muy plano (~${r1(an)}°): con 45-55° entra más fácil en el aro.`); else if (an > 62) aviso(`El balón sale muy alto (~${r1(an)}°): lo usual es 45-55°.`); else bien(`Buen ángulo de salida del balón (~${r1(an)}°).`);
          }
        }
        if (B) { if (medidos) bien(`La IA del balón lo siguió en ${medidos} de ${tiros.length} tiros.`); else aviso('La IA del balón no lo pudo seguir al salir de la mano (muy lejos, oscuro o tapado).'); }
        else bien('Con «Completo con balón» la app mide la velocidad y el ángulo reales del balón.');
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
    const idxT = (x) => { let k = 0; while (k < t.length - 1 && t[k] < x) k++; return k; }; // indice del cuadro de ese tiempo
    const a0 = ev.length ? idxT(ev[0]) : 0, a1 = ev.length ? idxT(ev[ev.length - 1]) : P.length - 1;
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
    if (sube > 12) aviso(`La cadera sube y baja mucho (~${r1(sube)} cm): mantén la plancha firme.`); else if (ev.length) bien('Cadera estable en plancha.');
    return fin('Reps', 'por minuto', ev);
  }

  // burpees, jumping jacks, cuerdas de batalla y HIIT generico: se cuentan los ciclos de la señal mas clara
  const cand = {
    cadera: serie((p) => (mid(p, 27, 28)[1] - mid(p, 23, 24)[1]) / torsoPx),
    brazos: serie((p) => (mid(p, 11, 12)[1] - mid(p, 15, 16)[1]) / torsoPx),
    brazoI: serie((p) => (p[11][1] - p[15][1]) / torsoPx), brazoD: serie((p) => (p[12][1] - p[16][1]) / torsoPx), // v2.36.8 ondas alternas
    munecas: serie((p) => dist(p[15], p[16]) / torsoPx),
    pies: serie((p) => dist(p[27], p[28]) / torsoPx),
    rodilla: serie((p) => ang(p[lado.cad], p[lado.rod], p[lado.tob])),
  };
  const usar = { burpees: ['cadera'], jacks: ['brazos', 'pies'], ondas: ['brazos', 'brazoI', 'brazoD'], ski: ['brazos'], generico: ['cadera', 'brazos', 'munecas', 'pies', 'rodilla'] }[tipo];
  let mejor = null;
  for (const k of usar) {
    const piv = pivotes(cand[k], 0.5, k === 'rodilla' ? 10 : 0.08), altos = piv.filter((q) => q.tipo === (k === 'cadera' || k === 'rodilla' ? 'bajo' : 'alto'));
    const ev = tiempos(altos), dif = []; for (let j = 1; j < ev.length; j++) dif.push(ev[j] - ev[j - 1]);
    const cv = dif.length > 1 ? Math.sqrt(media(dif.map((d) => (d - media(dif)) ** 2))) / media(dif) : 9;
    if (!mejor || (ev.length >= 2 && cv < mejor.cv)) mejor = { ev, cv };
  }
  const ev = mejor ? mejor.ev : [];
  const nombre = { burpees: 'Burpees', jacks: 'Jumping jacks', ondas: 'Ondas', ski: 'Tirones', generico: 'Movimientos' }[tipo];
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
  // v2.36.2 el encuadre sigue a la persona SUAVEMENTE (promedio de 1,5 s): antes seguia cada cuadro y el video temblaba
  const wS = Math.round(0.75 * fps), cyS = cy.map((_, i) => { let sm = 0, n = 0; for (let j = Math.max(0, i - wS); j <= Math.min(cy.length - 1, i + wS); j++) { sm += cy[j]; n++; } return sm / n; });
  const sup = cyS.map((c) => Math.max(0, Math.min(Math.max(0, Hs - VH), c - VH * 0.48)));
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
      const R0 = a.equipo && a.equipo.diametro > 0 ? a.equipo.diametro / 200 : { futbol: 0.11, basquet: 0.12, voley: 0.105, raqueta: 0.033 }[a.tipo] || 0.11; // solo lo que tiene tamaño de balon (v2.51.0: o el del equipo)
      const bq = q && q.b && q.b.find((c) => { const r = c[2] * (a.mPorPx || 0); return r > R0 * 0.4 && r < R0 * (a.tipo === 'raqueta' ? 4 : 2.5); });
      if (bq) { const [bx, by, br] = bq; ctx.beginPath(); ctx.arc(bx * esc, by * esc - s0 + off, Math.max(18, br * esc * 1.3), 0, 7); ctx.strokeStyle = COL.cian; ctx.lineWidth = 6; ctx.stroke(); }
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
    ctx.fillText(esDep ? (a.tipo === 'basquet' ? (ultD && ultD.salto != null ? `Salto ${ultD.salto} cm` : '') : ultD && ultD.v != null ? `${queMide} ${String(ultD.v).replace('.', ',')} m/s` : '') : r && r.v ? `${Math.round(r.v)} ${a.unidad}` : '', OW - 40, VH + 88);
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
        // v2.36.8 el mismo criterio que la tarjeta «Golpe más fuerte» del informe (sin pasarse de ese valor)
        const fMax = Math.min(Math.max(...hechos.map((e) => e.fuerza ?? -1)), a.fuerzaGolpe?.max ?? Infinity);
        if (fMax > 0) { ctx.fillStyle = COL.gris; ctx.font = `600 30px ${FUENTE}`; ctx.fillText(`Más fuerte ~${fMax} kg`, OW - 40, VH + 205); }
      }
    }
    // v2.35.0 deportes: velocidad del balón y fuerza del último contacto, debajo del ritmo
    if (['futbol', 'basquet', 'voley', 'raqueta'].includes(a.tipo)) {
      const ult = hechos[hechos.length - 1];
      if (ult && ult.kmh != null) {
        ctx.textAlign = 'right'; ctx.fillStyle = COL.amarillo; ctx.font = `700 38px ${FUENTE}`;
        ctx.fillText(`${queVuela} ~${ult.kmh} km/h${ult.medido ? ' ✓' : ''}${ult.fuerza != null ? ` · ${ult.fuerza} kg` : ''}`, OW - 40, VH + 150);
        const mx = Math.max(...hechos.map((e) => e.kmh ?? -1));
        ctx.fillStyle = COL.gris; ctx.font = `600 30px ${FUENTE}`; ctx.fillText(`Máx. ~${mx} km/h`, OW - 40, VH + 205);
      } else if (a.tipo === 'basquet' && ult && ult.brazo != null) { // v2.36.6 solo cuerpo: brazo y mejor salto
        ctx.textAlign = 'right'; ctx.fillStyle = COL.amarillo; ctx.font = `700 38px ${FUENTE}`;
        ctx.fillText(`Brazo al soltar ${ult.brazo}°`, OW - 40, VH + 150);
        const sx = Math.max(...hechos.map((e) => e.salto ?? -1));
        if (sx > 0) { ctx.fillStyle = COL.gris; ctx.font = `600 30px ${FUENTE}`; ctx.fillText(`Mejor salto ${sx} cm`, OW - 40, VH + 205); }
      }
    }
    ctx.font = `600 32px ${FUENTE}`; ctx.fillStyle = COL.gris; ctx.textAlign = 'left';
    ctx.fillText(a.nombre, 40, VH + 210);
    // v2.36.6 basquet sin la IA del balon: barras con la altura del salto de cada tiro
    const porSalto = a.tipo === 'basquet' && !(a.eventos || []).some((e) => e.kmh > 0), valor = (e) => (porSalto ? e.salto : e.kmh);
    ctx.textAlign = 'center'; ctx.fillText(porSalto ? 'Altura del salto en cada tiro (cm)' : esDep ? ({ futbol: 'Velocidad del balón en cada patada', voley: 'Velocidad del balón en cada remate', raqueta: 'Velocidad de la pelota en cada golpe', basquet: 'Velocidad de salida en cada tiro' })[a.tipo] + ' (km/h)' : `Ritmo (${a.unidad})`, OW / 2, GY0 - 24);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(GX0, GY1); ctx.lineTo(GX1, GY1); ctx.stroke();
    if (esDep) { // una barra por golpe con su velocidad
      const kmax = Math.max(20, ...(a.eventos || []).map((e) => valor(e) || 0)) * 1.15;
      ctx.font = `700 26px ${FUENTE}`;
      for (const e of hechos) { const val = valor(e); if (!(val > 0)) continue; const X = gx(e.t), Y = GY1 - (GY1 - GY0) * Math.min(1, val / kmax); ctx.fillStyle = e.medido ? COL.cian : COL.violeta; ctx.fillRect(X - 12, Y, 24, GY1 - Y); ctx.fillStyle = COL.blanco; ctx.fillText(String(Math.round(val)), X, Y - 10); }
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
