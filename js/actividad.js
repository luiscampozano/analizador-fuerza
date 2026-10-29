// Analisis por video de cardio, boxeo y HIIT (no son series de fuerza: no hay carga ni 1RM).
// A partir de los puntos del cuerpo que detecta la IA se miden ritmos (pasos, pedaladas, remadas, saltos, golpes) y
// alertas de tecnica. Se recomienda grabar DE LADO, con el celular fijo y el cuerpo completo.
// Las distancias en cm se estiman con la estatura (torso = 30 % de la estatura): son aproximadas.

// ---------------------------------------------------------------- que actividad mide cada ejercicio
const TIPOS = {
  correr: 'carrera', cinta: 'carrera', intervalos_carrera: 'carrera', caminar: 'caminata', caminata_inclinada: 'caminata', senderismo: 'caminata',
  bicicleta: 'bici', bicicleta_estatica: 'bici', spinning: 'bici', bicicleta_aire: 'bici',
  remo_ergometro: 'remo', ski_erg: 'ski', eliptica: 'eliptica', escaladora: 'escaladora', saltar_cuerda: 'cuerda',
  boxeo: 'boxeo', burpees: 'burpees', jumping_jacks: 'jacks', escaladores: 'escaladores', hiit: 'generico', cuerdas_batalla: 'ondas',
};
export const tipoActividad = (ej) => (ej && TIPOS[ej.id]) || null;
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
// frames: [{ t, puntos: [[x, y, vis] x 33] | null }] tal como salen de la IA · cfg: { altura (m) }
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
    res.ritmo = r1(ritmo(evT) * factor);
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
    // golpe = el brazo se estira rapido (distancia muñeca-hombro cerca del largo del brazo)
    const golpes = [];
    let guardiaBaja = 0, nGuardia = 0;
    for (const [s, nomLado] of [[L, 'izq'], [R, 'der']]) {
      const largo = pct(P.map((p) => (p ? dist(p[s.hom], p[s.cod]) + dist(p[s.cod], p[s.mun]) : NaN)), 0.9);
      const ext = serie((p) => dist(p[s.hom], p[s.mun]) / largo);
      const mx = serie((p) => p[s.mun][0]), my = serie((p) => p[s.mun][1]);
      const piv = zigzag(ext, 0.22);
      for (let k = 1; k < piv.length; k++) {
        const q = piv[k]; if (q.tipo !== 'alto' || q.v < 0.72) continue;
        const a = piv[k - 1].i, b = q.i; if (golpes.some((g) => g.lado === nomLado && Math.abs(g.i - b) < 0.18 * fr)) continue;
        let vmax = 0; for (let i = Math.max(a + 1, 1); i <= b; i++) vmax = Math.max(vmax, Math.hypot(mx[i] - mx[i - 1], my[i] - my[i - 1]) / (t[i] - t[i - 1] || 1 / fr));
        const p = P[b], codo = p ? ang(p[s.hom], p[s.cod], p[s.mun]) : NaN;
        const subida = my[a] - my[b], lateral = Math.abs(mx[b] - mx[a]);
        const clase = codo >= 150 ? 'recto' : subida > lateral * 0.8 ? 'uppercut' : 'gancho';
        golpes.push({ i: b, t: t[b], lado: nomLado, v: vmax * mPorPx, clase });
      }
    }
    // guardia: entre golpes las manos deberian estar a la altura de la cara (sobre los hombros)
    for (const p of P) { if (!p) continue; const h = Math.min(p[11][1], p[12][1]), m = Math.max(p[15][1], p[16][1]); nGuardia++; if (m > h + 0.25 * torsoPx) guardiaBaja++; }
    golpes.sort((a, b) => a.t - b.t);
    res.eventos = golpes.map((g) => ({ t: g.t, lado: g.lado, clase: g.clase }));
    const ev = golpes.map((g) => g.t), iz = golpes.filter((g) => g.lado === 'izq').length, de = golpes.length - iz;
    const vel = pct(golpes.map((g) => g.v), 0.9), cl = (c) => golpes.filter((g) => g.clase === c).length;
    kpi('Golpes', golpes.length, `izq. ${iz} · der. ${de}`); kpi('Ritmo', r1(ritmo(ev)), 'golpes por minuto');
    kpi('Mano más rápida', r1(vel, 1), 'm/s (aprox.)'); kpi('Tipos', `${cl('recto')} · ${cl('gancho')} · ${cl('uppercut')}`, 'rectos · ganchos · uppercuts (aprox.)');
    const baja = nGuardia ? guardiaBaja / nGuardia * 100 : 0; kpi('Guardia baja', r1(baja), '% del tiempo');
    if (baja > 40) aviso(`Bajas la guardia ${r1(baja)} % del tiempo: después de cada golpe regresa la mano a la cara.`); else bien('Buena guardia: las manos vuelven a la cara.');
    if (golpes.length >= 6 && Math.min(iz, de) / Math.max(iz, de) < 0.35) aviso(`Usas mucho más una mano (izq. ${iz} / der. ${de}). Combina las dos.`);
    if (fr < 45) aviso('Video a menos de 60 fps: en golpes muy rápidos la IA puede perder la mano. Para más precisión elige «Máxima» y graba a 60 fps.');
    return fin('Golpes', 'golpes/min', ev);
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
export function dibujoActividad(fuente, full, fps, a) {
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
    ctx.restore();
    // panel
    const hechos = (a.eventos || []).filter((e) => e.t <= t);
    const r = curva[Math.min(curva.length - 1, Math.round(t / 0.5))];
    ctx.fillStyle = COL.blanco; ctx.font = `800 64px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(`${a.contador}: ${hechos.length}`, 40, VH + 90);
    ctx.font = `700 44px ${FUENTE}`; ctx.fillStyle = COL.cian; ctx.textAlign = 'right';
    ctx.fillText(r && r.v ? `${Math.round(r.v)} ${a.unidad}` : '', OW - 40, VH + 88);
    if (a.tipo === 'boxeo') {
      const iz = hechos.filter((e) => e.lado === 'izq').length;
      ctx.font = `600 36px ${FUENTE}`; ctx.fillStyle = COL.gris; ctx.textAlign = 'left';
      ctx.fillText(`Izquierda ${iz} · Derecha ${hechos.length - iz}`, 40, VH + 150);
    }
    ctx.font = `600 32px ${FUENTE}`; ctx.fillStyle = COL.gris; ctx.textAlign = 'left';
    ctx.fillText(a.nombre, 40, VH + 210);
    ctx.textAlign = 'center'; ctx.fillText(`Ritmo (${a.unidad})`, OW / 2, GY0 - 24);
    // grafica del ritmo con eventos
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(GX0, GY1); ctx.lineTo(GX1, GY1); ctx.stroke();
    ctx.strokeStyle = COL.violeta; ctx.lineWidth = 5; ctx.beginPath(); let empezo = false;
    for (const c of curva) { if (c.t > t || c.v == null) { empezo = c.t > t ? empezo : false; continue; } const X = gx(c.t), Y = gy(c.v); if (!empezo) { ctx.moveTo(X, Y); empezo = true; } else ctx.lineTo(X, Y); }
    ctx.stroke();
    ctx.fillStyle = COL.verde; for (const e of hechos) { ctx.beginPath(); ctx.arc(gx(e.t), GY1 + 18, 5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = COL.blanco; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx(t), GY0); ctx.lineTo(gx(t), GY1 + 30); ctx.stroke();
    // alertas (las dos primeras)
    ctx.textAlign = 'left'; ctx.font = `600 30px ${FUENTE}`;
    (a.alertas || []).slice(0, 2).forEach((x, k) => { ctx.fillStyle = x.nivel === 'aviso' ? COL.amarillo : COL.verde; ctx.fillText((x.nivel === 'aviso' ? '⚠ ' : '✓ ') + x.texto.slice(0, 58) + (x.texto.length > 58 ? '…' : ''), 40, GY1 + 90 + k * 46); });
    ctx.fillStyle = COL.gris; ctx.font = `600 26px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText('FuerzaPro · Ing. Luis Campozano, MBA', OW - 40, 1890);
  };
}
