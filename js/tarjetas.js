// Tarjetas para compartir un entrenamiento (como las de Hevy): imagenes 1080x1350 hechas en canvas, listas para
// descargar, compartir en redes o acompañar la publicacion en la Comunidad. Cada tarjeta solo se genera si hay datos.
import { FRENTE, ESPALDA } from './anatomia.js';
const W = 1080, H = 1350;
const C = { fondo: '#0B0B12', fondo2: '#16122B', tarjeta: '#14141F', borde: '#29293D', texto: '#F0F2F5', suave: '#8E95A5',
  morado: '#7C5CFF', amarillo: '#F2C200', cian: '#22D3EE', rojo: '#E53935', apagado: '#262638' };
const FUENTE = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DIAS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const LOGO = typeof Image !== 'undefined' ? new Image() : null;
if (LOGO) LOGO.src = new URL('../iconos/logo.png', import.meta.url).href;
const logoListo = () => new Promise((ok) => { if (!LOGO || (LOGO.complete && LOGO.naturalWidth)) return ok(); LOGO.onload = LOGO.onerror = () => ok(); setTimeout(ok, 1500); });

const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const kg = (x) => fmt(x, x % 1 ? 1 : 0);
const cuenta = (s) => s.tipo !== 'calentamiento' && s.hecha !== false;
const e1rm = (k, r) => (k > 0 && r > 0 ? (r === 1 ? k : k * (1 + r / 30)) : 0);
const diaLocal = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// ------------------------------------------------------------------ datos de la tarjeta
export function datosTarjetas(en, { lista = [], porId = {}, recs = [], alias = '' } = {}) {
  const ejs = en.ejercicios.map((e) => {
    const def = e.ej && porId[e.ej];
    const ss = e.series.filter(cuenta);
    const mejor = ss.reduce((m, s) => (e1rm(s.kg, s.reps) > e1rm(m?.kg, m?.reps) ? s : m), null);
    return { id: e.ej || '', nombre: def ? def.nombre : e.nombre || 'Ejercicio', icono: def ? def.icono : '🏋️', grupo: def ? def.musculo || def.grupo : 'Otros', series: ss, mejor,
      vel: e.series.map((s) => s.analisis && s.analisis.v).filter((v) => v > 0) };
  }).filter((e) => e.series.length);
  const series = ejs.reduce((a, e) => a + e.series.length, 0);
  const volumen = ejs.reduce((a, e) => a + e.series.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
  const reps = ejs.reduce((a, e) => a + e.series.reduce((b, s) => b + (s.reps || 0), 0), 0);
  const min = en.fin ? Math.round((new Date(en.fin) - new Date(en.inicio)) / 60000) : null;
  const grupos = {};
  ejs.forEach((e) => { grupos[e.grupo] = (grupos[e.grupo] || 0) + e.series.length; });
  const ordenados = [...lista].sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  const numero = ordenados.findIndex((x) => x.id === en.id) + 1 || ordenados.length + 1;
  const hoy = diaLocal(en.inicio);
  const dias = new Set(lista.map((x) => diaLocal(x.inicio).getTime()));
  dias.add(hoy.getTime());
  const ultimos7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(hoy); d.setDate(d.getDate() - 6 + i); return { d, ok: dias.has(d.getTime()) }; });
  const mejorDia = ejs.filter((e) => e.mejor).sort((a, b) => e1rm(b.mejor.kg, b.mejor.reps) - e1rm(a.mejor.kg, a.mejor.reps))[0] || null;
  return { titulo: en.titulo || 'Entrenamiento', fecha: new Date(en.inicio), min: min > 0 && min < 600 ? min : null, ejs, series, volumen, reps, grupos, numero,
    ultimos7, dias, recs: recs || [], mejorDia, alias };
}

// ------------------------------------------------------------------ dibujo
function lienzo() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  return [c, c.getContext('2d')];
}
function fondo(g, transparente = false) {
  if (transparente) return;
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, C.fondo2); gr.addColorStop(0.55, C.fondo); gr.addColorStop(1, C.fondo);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.18; g.fillStyle = C.morado;
  g.beginPath(); g.arc(W * 0.9, H * 0.08, 340, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
}
function texto(g, t, x, y, { tam = 40, peso = 600, color = C.texto, alin = 'left', max = 0, base = 'alphabetic' } = {}) {
  g.font = `${peso} ${tam}px ${FUENTE}`; g.fillStyle = color; g.textAlign = alin; g.textBaseline = base;
  let s = String(t);
  if (max) while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -2) + '…';
  g.fillText(s, x, y);
  return g.measureText(s).width;
}
function caja(g, x, y, w, h, r = 28, color = C.tarjeta, borde = C.borde) {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = color; g.fill();
  if (borde) { g.lineWidth = 2; g.strokeStyle = borde; g.stroke(); }
}
function marca(g, d, { claro = true } = {}) {
  if (LOGO && LOGO.naturalWidth) g.drawImage(LOGO, 64, H - 118, 64, 64);
  texto(g, 'FuerzaPro', 142, H - 72, { tam: 38, peso: 800, color: claro ? C.texto : C.fondo });
  if (d.alias) texto(g, '@' + d.alias, W - 64, H - 72, { tam: 34, peso: 500, color: C.suave, alin: 'right' });
}
function encabezado(g, d, etiqueta) {
  texto(g, etiqueta.toUpperCase(), 64, 110, { tam: 30, peso: 700, color: C.morado });
  texto(g, d.titulo, 64, 172, { tam: 54, peso: 800, max: W - 128 });
  texto(g, d.fecha.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 64, 222, { tam: 32, peso: 500, color: C.suave });
}
function dato(g, x, y, w, valor, unidad, nombre, color = C.texto) {
  caja(g, x, y, w, 200);
  const ancho = texto(g, valor, x + 36, y + 112, { tam: 76, peso: 800, color });
  if (unidad) texto(g, unidad, x + 44 + ancho, y + 112, { tam: 34, peso: 600, color: C.suave });
  texto(g, nombre, x + 36, y + 162, { tam: 30, peso: 500, color: C.suave });
}
const durTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

// 1) Resumen
function tResumen(d) {
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, 'Entrenamiento completado');
  const w = (W - 128 - 32) / 2;
  const dur = !d.min ? ['—', ''] : d.min >= 60 ? [`${Math.floor(d.min / 60)}:${String(d.min % 60).padStart(2, '0')}`, 'h'] : [String(d.min), 'min'];
  dato(g, 64, 300, w, dur[0], dur[1], 'Duración');
  dato(g, 64 + w + 32, 300, w, kg(Math.round(d.volumen)), 'kg', 'Volumen', C.amarillo);
  dato(g, 64, 532, w, fmt(d.series), '', 'Series');
  dato(g, 64 + w + 32, 532, w, fmt(d.ejs.length), '', 'Ejercicios');
  const nRec = d.recs.reduce((a, r) => a + r.records.length, 0);
  caja(g, 64, 764, W - 128, 380, 28);
  texto(g, nRec ? `🏆 ${nRec} récord${nRec > 1 ? 's' : ''} nuevo${nRec > 1 ? 's' : ''}` : '💪 Ejercicios', 100, 836, { tam: 40, peso: 800, color: nRec ? C.amarillo : C.texto });
  d.ejs.slice(0, 5).forEach((e, i) => {
    texto(g, `${e.series.length} × ${e.nombre}`, 100, 900 + i * 50, { tam: 32, peso: 500, color: C.texto, max: W - 220 });
  });
  if (d.ejs.length > 5) texto(g, `+${d.ejs.length - 5} más`, 100, 900 + 5 * 50, { tam: 30, peso: 500, color: C.suave });
  marca(g, d); return c;
}

// 2) Musculos trabajados: cuerpo de frente y de espalda con cada musculo coloreado segun las series que recibio
// (principales cuentan 1, secundarios 0.5). Si el ejercicio no esta en la tabla se usa su grupo muscular.
const M = (pri, sec = []) => ({ pri, sec });
const POR_EJ = [
  [/^pantorrilla/, M(['calves', 'left_soleus', 'right_soleus'])],
  [/^(extension_cuadriceps|extension_unilateral|sentadilla_sissy)/, M(['quadriceps'])],
  [/^curl_femoral|^buenos_dias/, M(['hamstring'], ['gluteal', 'lower_back'])],
  [/^abductores|^abduccion/, M(['abductor'], ['gluteal'])], [/^aductores/, M(['abductors'])],
  [/^(hip_thrust|puente_gluteo|patada_gluteo|pull_through)/, M(['gluteal'], ['hamstring'])],
  [/^(peso_muerto|rumano|rack_pull|swing)/, M(['hamstring', 'gluteal', 'lower_back'], ['trapezius', 'forearm', 'quadriceps'])],
  [/^(hiperextension|superman)/, M(['lower_back'], ['gluteal', 'hamstring'])],
  [/^(sentadilla|smith_sentadilla|hack|belt_squat|prensa|zancada|bulgara|step_up|pistol)/, M(['quadriceps', 'gluteal'], ['abductors', 'hamstring', 'calves'])],
  [/^(press_banca|press_pecho|press_inclinado|press_declinado|smith_banca|smith_inclinado|press_mancuerna|flexiones|fondos$)/, M(['chest'], ['triceps', 'front_deltoids'])],
  [/^(aperturas|pec_deck|cruce_poleas)/, M(['chest'], ['front_deltoids'])], [/^pullover/, M(['upper_back', 'chest'], ['triceps'])],
  [/^(press_militar|press_hombro|press_arnold|push_press|smith_militar|landmine)/, M(['front_deltoids'], ['triceps', 'trapezius'])],
  [/^(elevaciones_laterales|lateral|laterales)/, M(['front_deltoids', 'back_deltoids'], ['trapezius'])], [/^elevaciones_frontales/, M(['front_deltoids'])],
  [/^(pajaro|reverse_pec_deck|face_pull)/, M(['back_deltoids'], ['upper_back', 'trapezius'])],
  [/^(encogimientos|remo_menton)/, M(['trapezius'], ['front_deltoids'])],
  [/^(remo|jalon|dominadas|chin_up|muscle_up)/, M(['upper_back'], ['biceps', 'back_deltoids', 'forearm', 'trapezius'])],
  [/^(curl_muneca|extension_muneca|curl_detras|rodillo)/, M(['forearm'])],
  [/^curl/, M(['biceps'], ['forearm'])],
  [/^(triceps|press_frances|patada_triceps|fondos_banco|fondos_maquina|press_agarre_cerrado)/, M(['triceps'], ['chest'])],
  [/^(crunch|abdominales|elevacion_piernas|rueda|lenadores|flexion_lateral)/, M(['abs', 'obliques'])],
];
const POR_GRUPO = { Piernas: M(['quadriceps', 'calves'], ['gluteal']), 'Glúteo y femoral': M(['gluteal', 'hamstring']), Pecho: M(['chest'], ['triceps']),
  Espalda: M(['upper_back', 'trapezius'], ['biceps']), Hombros: M(['front_deltoids', 'back_deltoids']), Brazos: M(['biceps', 'triceps', 'forearm']), Core: M(['abs', 'obliques']) };
const NOMBRES_MUSC = { quadriceps: 'Cuádriceps', calves: 'Pantorrillas', left_soleus: 'Pantorrillas', right_soleus: 'Pantorrillas', hamstring: 'Femorales', gluteal: 'Glúteos',
  abductor: 'Abductores', abductors: 'Aductores', lower_back: 'Lumbares', upper_back: 'Dorsales', trapezius: 'Trapecios', chest: 'Pecho', front_deltoids: 'Hombros',
  back_deltoids: 'Deltoide posterior', biceps: 'Bíceps', triceps: 'Tríceps', forearm: 'Antebrazos', abs: 'Abdomen', obliques: 'Oblicuos' };
function cargaMuscular(d) {
  const c = {};
  for (const e of d.ejs) {
    const m = (POR_EJ.find(([re]) => re.test(e.id || '')) || [])[1] || POR_GRUPO[e.grupo];
    if (!m) continue;
    m.pri.forEach((k) => { c[k] = (c[k] || 0) + e.series.length; });
    m.sec.forEach((k) => { c[k] = (c[k] || 0) + 0.5 * e.series.length; });
  }
  return c;
}
function cuerpo(g, poligonos, x0, y0, esc, carga, max) {
  for (const [musculo, polys] of poligonos) {
    const n = (carga[musculo] || 0) / max;
    const neutro = musculo === 'head' || musculo === 'neck' || musculo === 'knees';
    g.fillStyle = neutro ? '#2B2B3E' : n > 0 ? `rgba(${Math.round(124 + 118 * (1 - n))},${Math.round(92 + 70 * (1 - n))},255,${0.55 + 0.45 * n})` : '#34344A';
    g.strokeStyle = C.fondo; g.lineWidth = 2; g.lineJoin = 'round';
    for (const p of polys) {
      g.beginPath(); g.moveTo(x0 + p[0] * esc, y0 + p[1] * esc);
      for (let k = 2; k < p.length; k += 2) g.lineTo(x0 + p[k] * esc, y0 + p[k + 1] * esc);
      g.closePath(); g.fill(); g.stroke();
    }
  }
}
function tMusculos(d) {
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, 'Músculos trabajados');
  const carga = cargaMuscular(d);
  const max = Math.max(...Object.values(carga), 1);
  const esc = 4.1; // lienzo de 100x200 -> 410x820
  cuerpo(g, FRENTE, 64 + 20, 270, esc, carga, max);
  cuerpo(g, ESPALDA, W - 64 - 20 - 100 * esc, 270, esc, carga, max);
  texto(g, 'Frente', 64 + 20 + 50 * esc, 1120, { tam: 28, color: C.suave, alin: 'center' });
  texto(g, 'Espalda', W - 64 - 20 - 50 * esc, 1120, { tam: 28, color: C.suave, alin: 'center' });
  const vistos = {};
  Object.entries(carga).forEach(([k, v]) => { const n = NOMBRES_MUSC[k]; if (n) vistos[n] = Math.max(vistos[n] || 0, v); });
  const top = Object.entries(vistos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  texto(g, top.join(' · '), W / 2, 1185, { tam: 36, peso: 800, color: C.amarillo, alin: 'center', max: W - 128 });
  marca(g, d); return c;
}

// 3) Constancia: ultimos 7 dias y numero de entreno
function tSemana(d) {
  const [c, g] = lienzo(); fondo(g);
  texto(g, '¡Bien hecho!', W / 2, 250, { tam: 92, peso: 900, alin: 'center' });
  texto(g, `Este es tu entreno número ${fmt(d.numero)}`, W / 2, 330, { tam: 42, peso: 500, color: C.suave, alin: 'center' });
  texto(g, fmt(d.numero), W / 2, 640, { tam: 300, peso: 900, color: C.morado, alin: 'center' });
  caja(g, 64, 760, W - 128, 260, 130);
  const paso = (W - 128 - 80) / 7;
  d.ultimos7.forEach((x, i) => {
    const cx = 104 + paso * i + paso / 2;
    const dia = DIAS[(x.d.getDay() + 6) % 7];
    texto(g, dia, cx, 830, { tam: 30, peso: 600, color: C.suave, alin: 'center' });
    g.beginPath(); g.arc(cx, 920, 40, 0, Math.PI * 2); g.fillStyle = x.ok ? C.morado : C.apagado; g.fill();
    if (x.ok) { g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 16, 920); g.lineTo(cx - 4, 934); g.lineTo(cx + 18, 906); g.stroke(); }
  });
  const n = d.ultimos7.filter((x) => x.ok).length;
  texto(g, `Has entrenado ${n} ${n === 1 ? 'vez' : 'veces'} en los últimos 7 días`, W / 2, 1110, { tam: 38, peso: 600, alin: 'center' });
  marca(g, d); return c;
}

// 4) Records
function tRecords(d) {
  if (!d.recs.length) return null;
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, '🏆 Nuevos récords');
  let y = 300;
  for (const r of d.recs.slice(0, 5)) {
    const filas = r.records.slice(0, 3), h = 90 + filas.length * 52;
    if (y + h > H - 160) break;
    caja(g, 64, y, W - 128, h);
    texto(g, r.nombre, 100, y + 60, { tam: 38, peso: 800, max: W - 200 });
    filas.forEach((x, i) => { texto(g, x.tipo, 100, y + 112 + i * 52, { tam: 30, peso: 500, color: C.suave }); texto(g, x.texto, W - 100, y + 112 + i * 52, { tam: 32, peso: 800, color: C.amarillo, alin: 'right' }); });
    y += h + 24;
  }
  marca(g, d); return c;
}

// 5) Lista de ejercicios con su mejor serie
function tEjercicios(d) {
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, 'Ejercicios');
  const filas = d.ejs.slice(0, 8), alto = Math.min(110, (H - 460) / Math.max(filas.length, 1));
  filas.forEach((e, i) => {
    const y = 290 + i * alto;
    caja(g, 64, y, W - 128, alto - 16, 22);
    texto(g, e.nombre, 100, y + alto / 2 + 4, { tam: 34, peso: 700, max: W - 520 });
    const m = e.mejor;
    texto(g, `${e.series.length} series${m && m.kg ? ` · ${kg(m.kg)} kg × ${m.reps ?? '—'}` : m && m.reps ? ` · ${m.reps} reps` : ''}`, W - 100, y + alto / 2 + 4, { tam: 30, peso: 600, color: C.suave, alin: 'right' });
  });
  if (d.ejs.length > 8) texto(g, `+${d.ejs.length - 8} ejercicios más`, 64, 290 + 8 * alto + 30, { tam: 30, color: C.suave });
  marca(g, d); return c;
}

// 6) Mejor levantamiento del dia
function tMejor(d) {
  const m = d.mejorDia; if (!m || !(m.mejor.kg > 0)) return null;
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, 'Levantamiento del día');
  texto(g, m.nombre, W / 2, 420, { tam: 50, peso: 800, alin: 'center', max: W - 128 });
  texto(g, `${kg(m.mejor.kg)}`, W / 2, 700, { tam: 260, peso: 900, color: C.amarillo, alin: 'center' });
  texto(g, `kg × ${m.mejor.reps} ${m.mejor.reps === 1 ? 'rep' : 'reps'}`, W / 2, 790, { tam: 60, peso: 700, alin: 'center' });
  caja(g, 200, 880, W - 400, 170, 85);
  texto(g, `1RM estimado ≈ ${kg(Math.round(e1rm(m.mejor.kg, m.mejor.reps) * 2) / 2)} kg`, W / 2, 984, { tam: 44, peso: 700, color: C.cian, alin: 'center' });
  marca(g, d); return c;
}

// 7) Volumen con una comparacion divertida: se elige el objeto que da entre 1 y 6 unidades y se dibujan grandes
const COSAS = [[7000, '🦖', 'Tiranosaurios rex', 'Tiranosaurio rex'], [6000, '🐘', 'elefantes africanos', 'elefante africano'], [3000, '🦛', 'hipopótamos', 'hipopótamo'],
  [1300, '🚗', 'autos compactos', 'auto compacto'], [700, '🐂', 'toros', 'toro'], [450, '🐻‍❄️', 'osos polares', 'oso polar'], [250, '🦍', 'gorilas', 'gorila'],
  [120, '🐼', 'pandas', 'panda'], [60, '🐕', 'perros grandes', 'perro grande'], [5, '🐈', 'gatos', 'gato']];
function emoji(g, e, x, y, tam) { g.font = `${tam}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x, y); }
function tVolumen(d) {
  if (!(d.volumen > 0)) return null;
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, 'Volumen total');
  texto(g, kg(Math.round(d.volumen)), W / 2, 470, { tam: 170, peso: 900, color: C.amarillo, alin: 'center' });
  texto(g, 'kg levantados hoy', W / 2, 540, { tam: 44, peso: 600, alin: 'center' });
  const [peso, ico, plural, singular] = COSAS.find(([p]) => d.volumen / p >= 1 && d.volumen / p <= 6) || COSAS.find(([p]) => d.volumen / p >= 1) || COSAS[COSAS.length - 1];
  const n = d.volumen / peso, enteros = Math.floor(n), resto = n - enteros, cuantos = Math.min(6, Math.ceil(n));
  caja(g, 64, 610, W - 128, 560, 36, '#17142A', '#3A2F7A');
  texto(g, 'ES COMO LEVANTAR', W / 2, 680, { tam: 30, peso: 700, color: C.morado, alin: 'center' });
  const tam = cuantos <= 2 ? 230 : cuantos <= 3 ? 190 : 150, por = cuantos <= 3 ? cuantos : Math.ceil(cuantos / 2), filas = Math.ceil(cuantos / por);
  for (let k = 0; k < cuantos; k++) {
    const fila = Math.floor(k / por), col = k % por, enFila = Math.min(por, cuantos - fila * por);
    const x = W / 2 + (col - (enFila - 1) / 2) * (tam * 1.15), y = 690 + (filas === 1 ? 210 : 140 + fila * tam * 1.05);
    const parcial = k === enteros && resto > 0.05 && n <= 6;
    g.save();
    if (parcial) { g.beginPath(); g.rect(x - tam / 2, y - tam / 2 - 10, tam * resto, tam + 20); g.clip(); }
    emoji(g, ico, x, y, tam);
    g.restore();
    if (parcial) { g.save(); g.globalAlpha = 0.18; emoji(g, ico, x, y, tam); g.restore(); }
  }
  const nTxt = fmt(n, n < 10 ? 1 : 0);
  texto(g, `${nTxt} ${Math.abs(n - 1) < 0.05 ? singular : plural}`, W / 2, 1125, { tam: 52, peso: 900, alin: 'center', max: W - 180 });
  texto(g, `${fmt(d.series)} series · ${fmt(d.reps)} reps`, W / 2, 1225, { tam: 32, peso: 500, color: C.suave, alin: 'center' });
  marca(g, d); return c;
}

// 8) Velocidad medida con video (lo propio de FuerzaPro)
function tVelocidad(d) {
  const conVel = d.ejs.filter((e) => e.vel.length);
  if (!conVel.length) return null;
  const [c, g] = lienzo(); fondo(g); encabezado(g, d, '⚡ Velocidad de la barra');
  const barras = conVel.flatMap((e) => e.vel.map((v) => ({ v, n: e.nombre }))).slice(0, 12);
  const max = Math.max(...barras.map((b) => b.v), 0.5);
  const x0 = 120, y0 = 1060, ancho = (W - 240) / barras.length;
  barras.forEach((b, i) => {
    const h = 560 * b.v / max, x = x0 + i * ancho + ancho * 0.15;
    const gr = g.createLinearGradient(0, y0 - h, 0, y0); gr.addColorStop(0, C.cian); gr.addColorStop(1, C.morado);
    g.fillStyle = gr; g.beginPath(); g.roundRect(x, y0 - h, ancho * 0.7, h, 14); g.fill();
    texto(g, fmt(b.v, 2), x + ancho * 0.35, y0 - h - 18, { tam: 26, peso: 700, alin: 'center' });
  });
  texto(g, conVel.map((e) => e.nombre).slice(0, 2).join(' · '), W / 2, 1130, { tam: 32, peso: 600, color: C.suave, alin: 'center', max: W - 128 });
  texto(g, 'm/s media por serie, medida con la cámara', W / 2, 1180, { tam: 28, color: C.suave, alin: 'center' });
  marca(g, d); return c;
}

// 9) Calendario del mes
function tMes(d) {
  const [c, g] = lienzo(); fondo(g);
  const f = d.fecha, y = f.getFullYear(), m = f.getMonth();
  texto(g, 'CONSTANCIA', 64, 110, { tam: 30, peso: 700, color: C.morado });
  texto(g, `${MESES[m][0].toUpperCase()}${MESES[m].slice(1)} ${y}`, 64, 180, { tam: 60, peso: 800 });
  const primero = new Date(y, m, 1), diasMes = new Date(y, m + 1, 0).getDate(), off = (primero.getDay() + 6) % 7;
  const celda = (W - 128) / 7;
  DIAS.forEach((t, i) => texto(g, t, 64 + celda * i + celda / 2, 290, { tam: 30, peso: 600, color: C.suave, alin: 'center' }));
  let n = 0;
  for (let k = 1; k <= diasMes; k++) {
    const p = off + k - 1, cx = 64 + (p % 7) * celda + celda / 2, cy = 370 + Math.floor(p / 7) * 130;
    const ok = d.dias.has(new Date(y, m, k).getTime()); if (ok) n++;
    g.beginPath(); g.arc(cx, cy, 50, 0, Math.PI * 2); g.fillStyle = ok ? C.morado : C.tarjeta; g.fill();
    texto(g, String(k), cx, cy + 12, { tam: 34, peso: ok ? 800 : 500, color: ok ? '#fff' : C.suave, alin: 'center' });
  }
  texto(g, `${n} ${n === 1 ? 'día entrenado' : 'días entrenados'} este mes`, W / 2, 1190, { tam: 44, peso: 700, alin: 'center' });
  marca(g, d); return c;
}

// 10) Sticker transparente para poner encima de una foto (historias)
function tSticker(d) {
  const [c, g] = lienzo(); fondo(g, true);
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18;
  texto(g, d.titulo, W / 2, 520, { tam: 64, peso: 900, alin: 'center', max: W - 100 });
  const cols = [[d.min ? durTxt(d.min) : '—', 'Duración'], [`${kg(Math.round(d.volumen))} kg`, 'Volumen'], [fmt(d.series), 'Series']];
  cols.forEach(([v, n], i) => {
    const x = W / 6 + i * W / 3;
    texto(g, v, x, 680, { tam: 54, peso: 800, alin: 'center' });
    texto(g, n, x, 735, { tam: 30, peso: 600, alin: 'center', color: '#E6E6EE' });
  });
  if (LOGO && LOGO.naturalWidth) g.drawImage(LOGO, W / 2 - 150, 800, 56, 56);
  texto(g, 'FuerzaPro', W / 2 - 80, 842, { tam: 40, peso: 800 });
  g.shadowBlur = 0; return c;
}

const TIPOS = [
  ['semana', 'Entreno número', tSemana], ['resumen', 'Resumen', tResumen], ['musculos', 'Músculos', tMusculos], ['records', 'Récords', tRecords],
  ['mejor', 'Mejor levantamiento', tMejor], ['volumen', 'Volumen', tVolumen], ['velocidad', 'Velocidad', tVelocidad], ['ejercicios', 'Ejercicios', tEjercicios],
  ['mes', 'Calendario', tMes], ['sticker', 'Sticker transparente', tSticker],
];

// Devuelve [{id, nombre, canvas}] solo con las tarjetas que tienen datos
export async function generar(en, opciones) {
  await logoListo();
  const d = datosTarjetas(en, opciones);
  return TIPOS.map(([id, nombre, f]) => { try { const canvas = f(d); return canvas ? { id, nombre, canvas } : null; } catch (e) { return null; } }).filter(Boolean);
}
export const aBlob = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
