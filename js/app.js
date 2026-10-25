// Analizador de Fuerza — interfaz principal. Todo el procesamiento ocurre en el dispositivo.
import { EJERCICIOS, POR_ID, GRUPOS } from './ejercicios.js';
import { detectarPose, cargarModelo } from './pose.js';
import { interpolar, analizar, anguloArticular, MP } from './fisica.js';
import { analizarSerie, perfilCargaVelocidad } from './analisis.js';
import { prepararDibujo, generarVideo } from './render.js';
import * as hist from './historial.js';

const VERSION = '1.1.0';
const $ = (id) => document.getElementById(id);
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const redondear = (x, paso = 2.5) => Math.round(x / paso) * paso;

let ej = POR_ID[leer('af_ej')] || POR_ID.remo_riel;
let grupo = 'Todos';
let archivo = null;
let cancelar = false;
let urlVideo = null;

// ------------------------------------------------------------------ navegacion
function vista(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.vista === id
    || (id === 'v-resultados' && b.dataset.vista === 'v-form') || (id === 'v-progreso' && b.dataset.vista === 'v-form')));
  window.scrollTo({ top: 0 });
  if (id === 'v-historial') pintarHistorial();
}
document.querySelectorAll('.nav button').forEach((b) => b.addEventListener('click', () => {
  if ($('v-progreso').classList.contains('active')) return;
  vista(b.dataset.vista);
}));
function aviso(txt, ok = false) {
  const a = $('aviso'); a.textContent = txt || ''; a.style.display = txt ? 'block' : 'none'; a.classList.toggle('ok', ok);
}

// ------------------------------------------------------------------ ejercicios
function pintarElegido() {
  $('ej-elegido').innerHTML = `<span class="preset-icon">${ej.icono}</span><div><strong>${ej.nombre}</strong>
    <small>${ej.grupo}</small></div><button type="button" class="btn-sec" id="btn-cambiar">Cambiar</button>`;
  $('btn-cambiar').onclick = () => {
    const abierto = $('selector-ej').style.display !== 'none';
    $('selector-ej').style.display = abierto ? 'none' : 'block';
    if (!abierto) $('buscar-ej').focus({ preventScroll: true });
  };
  $('hint-ej').textContent = ej.hint;
}
function pintarLista() {
  const q = $('buscar-ej').value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  $('chips-grupo').innerHTML = ['Todos', ...GRUPOS].map((g) => `<button type="button" class="chip${g === grupo ? ' active' : ''}" data-g="${g}">${g}</button>`).join('');
  $('chips-grupo').querySelectorAll('.chip').forEach((c) => (c.onclick = () => { grupo = c.dataset.g; pintarLista(); }));
  const lista = EJERCICIOS.filter((e) => (grupo === 'Todos' || e.grupo === grupo)
    && (!q || (e.nombre + ' ' + e.grupo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
  $('lista-ej').innerHTML = lista.map((e) => `<button type="button" class="preset-card${e.id === ej.id ? ' active' : ''}" data-id="${e.id}">
    <span class="preset-icon">${e.icono}</span><span class="preset-name">${e.corto}</span><span class="preset-sub">${e.grupo}</span></button>`).join('')
    || '<p class="vacio">No encontré ese ejercicio. Si es en arco (máquina de palanca, laterales) todavía no está soportado.</p>';
  $('lista-ej').querySelectorAll('.preset-card').forEach((b) => (b.onclick = () => elegir(POR_ID[b.dataset.id])));
}
function elegir(e) {
  ej = e; guardar('af_ej', e.id);
  $('selector-ej').style.display = 'none';
  pintarElegido(); pintarLista(); ajustarCampos();
}
function ajustarCampos() {
  const p = ej.perfil;
  $('g-incl').style.display = p === 'riel' ? '' : 'none';
  $('g-rel').style.display = p === 'polea' ? '' : 'none';
  $('g-carro').style.display = p === 'riel' || p === 'libre' ? '' : 'none';
  $('lbl-peso').textContent = p === 'corporal' ? 'Lastre' : p === 'polea' ? 'Peso de la pila' : ej.carro === 20 ? 'Peso de discos' : 'Peso';
  $('lbl-carro').textContent = p === 'riel' ? 'Carro / barra de la máquina' : 'Barra';
  $('in-incl').value = leer('af_incl_' + ej.id) || ej.alfa || 45;
  $('in-carro').value = leer('af_carro_' + ej.id) ?? ej.carro ?? 0;
  $('in-peso').value = leer('af_peso_' + ej.id) ?? (p === 'corporal' ? 0 : '');
}

// ------------------------------------------------------------------ video
const inVideo = $('input-video');
$('btn-grabar').onclick = (e) => { e.stopPropagation(); inVideo.setAttribute('capture', 'environment'); inVideo.click(); };
$('btn-galeria').onclick = (e) => { e.stopPropagation(); inVideo.removeAttribute('capture'); inVideo.click(); };
$('dropzone').onclick = () => { if (!archivo) { inVideo.removeAttribute('capture'); inVideo.click(); } };
inVideo.onchange = () => {
  if (!inVideo.files || !inVideo.files[0]) return;
  archivo = inVideo.files[0];
  $('file-name').textContent = `${archivo.name || 'video'} · ${fmt(archivo.size / 1048576)} MB`;
  $('drop-content').style.display = 'none'; $('file-preview').style.display = 'flex';
  $('dropzone').classList.add('has-file');
};
$('btn-quitar').onclick = (e) => {
  e.stopPropagation(); archivo = null; inVideo.value = '';
  $('drop-content').style.display = 'block'; $('file-preview').style.display = 'none'; $('dropzone').classList.remove('has-file');
};

// Cada analisis usa un reproductor nuevo: reutilizar el anterior provocaba un error falso al cambiar de video
function cargarVideo(file) {
  const viejo = $('video-trabajo');
  const v = viejo.cloneNode(false);
  viejo.removeAttribute('src'); viejo.load(); viejo.replaceWith(v);
  if (urlVideo) URL.revokeObjectURL(urlVideo);
  urlVideo = URL.createObjectURL(file);
  return new Promise((ok, mal) => {
    v.addEventListener('loadeddata', () => ok(v), { once: true });
    v.addEventListener('error', () => {
      const c = v.error ? v.error.code : 0;
      mal(new Error(c === 4
        ? 'Chrome no puede leer el formato de este video. En la cámara desactiva HDR / 10-bit / LOG y vuelve a grabar.'
        : `No se pudo abrir el video (código ${c}). Cierra y vuelve a abrir la app e inténtalo de nuevo.`));
    }, { once: true });
    v.src = urlVideo; v.load();
  });
}

// ------------------------------------------------------------------ progreso
let pasoActual = -1;
function progreso(paso, frac, msg) {
  const pesos = [0.08, 0.55, 0.04, 0.33], base = pesos.slice(0, paso).reduce((a, b) => a + b, 0);
  const total = Math.round(100 * (base + pesos[paso] * Math.min(1, frac)));
  $('p-barra').style.width = total + '%'; $('p-pct').textContent = total + '%';
  if (msg) $('p-msg').textContent = msg;
  if (paso !== pasoActual) {
    for (let i = 0; i < 4; i++) {
      $('paso-' + i).classList.toggle('active', i === paso); $('paso-' + i).classList.toggle('hecho', i < paso);
    }
    pasoActual = paso;
  }
}
$('btn-cancelar').onclick = () => { cancelar = true; };
const minutos = (s) => (s === null ? '' : s < 60 ? ` · faltan ~${Math.ceil(s)} s` : ` · faltan ~${Math.ceil(s / 60)} min`);

// ------------------------------------------------------------------ analisis
$('btn-analizar').onclick = async () => {
  if (!archivo) return alert('Primero graba o elige el video de la serie.');
  const peso = parseFloat($('in-peso').value || '0');
  const pc = parseFloat($('in-pc').value || '0');
  const altura = parseFloat($('in-altura').value || '0');
  if (ej.perfil !== 'corporal' && !(peso > 0)) return alert('Indica el peso en kg.');
  if (!(altura > 1 && altura < 2.4)) return alert('Revisa tu estatura (en metros, por ejemplo 1.68).');
  if (ej.perfil === 'corporal' && !(pc > 20)) return alert('Indica tu peso corporal.');
  const carro = ej.perfil === 'riel' || ej.perfil === 'libre' ? parseFloat($('in-carro').value || '0') : 0;
  const alfa = ej.perfil === 'riel' ? parseFloat($('in-incl').value || '45') : 90;
  const relacion = ej.perfil === 'polea' ? parseFloat($('in-rel').value || '1') : 1;
  guardar('af_peso_' + ej.id, peso); guardar('af_carro_' + ej.id, carro); guardar('af_incl_' + ej.id, alfa);
  guardar('af_altura', altura); guardar('af_pc', pc); guardar('af_calidad', $('in-calidad').value);

  const carga = peso + carro; // lo que el usuario mueve (discos + barra/carro, pila o lastre)
  const masa = ej.perfil === 'corporal' ? pc * (ej.fraccion || 1) + peso : carga;
  cancelar = false; pasoActual = -1; vista('v-progreso');
  try {
    progreso(0, 0, 'Cargando la IA de pose (la primera vez descarga ~10 MB)…');
    await cargarModelo($('in-calidad').value);
    const video = await cargarVideo(archivo);
    progreso(0, 1);
    const calidad = $('in-calidad').value;
    const hz = { rapida: 15, normal: 30, maxima: 60 }[calidad] || 30;
    const { frames, delegado } = await detectarPose(video, {
      calidad, hz, cancelado: () => cancelar,
      alAvanzar: (f, resta, del) => progreso(1, f, `Detectando pose (${del === 'GPU' ? 'GPU' : 'CPU'})${minutos(resta)}`),
    });
    if (frames.filter((f) => f.puntos).length < frames.length * 0.3) throw new Error('No se ve bien a la persona en el video. Graba de lado, con el cuerpo completo y buena luz.');
    progreso(2, 0.2, 'Calculando la física…');
    const fps = 60, full = interpolar(frames, fps, video.duration);
    const ini = parseFloat($('in-ini').value), fin = parseFloat($('in-fin').value);
    const res = analizar(full, fps, ej, { masa, alfa, relacion, altura, inicio: ini > 0 ? ini : null, fin: fin > 0 ? fin : null });
    if (!res.reps.length) throw new Error('No se detectaron repeticiones. Revisa que elegiste el ejercicio correcto y que se vea todo el movimiento.');
    const serie = analizarSerie(res, ej, { carga: ej.perfil === 'corporal' ? peso : carga, masaTotal: masa, pesoCorporal: pc, perfil: ej.perfil });
    progreso(2, 1);

    const registro = {
      ejercicio: ej.id, carga: ej.perfil === 'corporal' ? peso : carga, masa, perfil: ej.perfil, alfa,
      reps: res.reps.length, vMejor: serie.vMejor, perdida: serie.perdida, rir: serie.rir ?? null, rpe: serie.rpe,
      rm: serie.rm ?? null, rmLastre: serie.rmLastre ?? null, fPico: serie.fPico, pPico: serie.pPico,
      estatico: res.estatico, velocidades: res.reps.map((r) => +r.v_media.toFixed(3)), pesoCorporal: pc,
    };
    hist.agregar(registro);

    let salida = null;
    if ($('in-video').checked) {
      const ang = $('in-angulo').value ? anguloArticular(full, $('in-angulo').value, fps) : null;
      const puntoIdx = MP[ej.punto];
      const titulo = ej.perfil === 'riel' ? `${ej.corto} · ${fmt(carga, 1)} kg · peso efectivo (${alfa}°): ${fmt(res.estatico)} kg`
        : ej.perfil === 'corporal' ? `${ej.corto} · peso corporal ${fmt(pc, 1)} kg${peso ? ` + lastre ${fmt(peso, 1)} kg` : ''}`
        : `${ej.corto} · ${fmt(carga, 1)} kg${relacion !== 1 ? ` (polea ${relacion}:1)` : ''}`;
      const leyendaVel = ej.sentido === 'abajo' ? 'Velocidad de la carga (m/s)  ↑ subida  ↓ bajada' : 'Velocidad (m/s)  ↑ fase concéntrica  ↓ excéntrica';
      const dibujar = prepararDibujo(video, full, res, { puntoIdx, angulo: ang, titulo, leyendaVel });
      salida = await generarVideo(video, archivo, dibujar, {
        cancelado: () => cancelar, alAvanzar: (f) => progreso(3, f, 'Creando el video con telemetría…'),
      });
    }
    mostrar(res, serie, { carga, masa, pc, alfa, salida, peso });
  } catch (e) {
    console.error(e);
    vista('v-form');
    if (e.message !== 'cancelado') alert(e.message || String(e));
  }
};

// ------------------------------------------------------------------ resultados
let salidaActual = null;
function mostrar(res, s, { carga, masa, pc, alfa, salida, peso }) {
  salidaActual = salida;
  const corporal = ej.perfil === 'corporal';
  $('r-titulo').textContent = `${ej.nombre} · ${corporal ? `peso corporal${peso ? ' + ' + fmt(peso, 1) + ' kg' : ''}` : fmt(carga, 1) + ' kg'} · ${new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}`;
  if (s.rm) {
    if (corporal) {
      $('r-rm').innerHTML = `${s.rmLastre >= 0 ? '+' : ''}${fmt(s.rmLastre, 1)} <small>kg de lastre</small>`;
      $('r-rm-sub').textContent = `para 1 repetición · masa total que moverías ≈ ${fmt(s.rm)} kg`;
    } else {
      $('r-rm').innerHTML = `${fmt(s.rm, 1)} <small>kg</small>`;
      $('r-rm-sub').textContent = (Math.round(s.rmMax - s.rmMin) >= 1 ? `rango ${fmt(s.rmMin)}–${fmt(s.rmMax)} kg · ` : '') + `esta serie fue al ${fmt(s.pct)} % de tu 1RM` +
        (ej.perfil === 'riel' ? ` · en el riel equivale a ${fmt(s.rm * Math.sin(alfa * Math.PI / 180))} kg` : '');
    }
  } else { $('r-rm').textContent = '--'; $('r-rm-sub').textContent = ''; }
  $('r-rpe').textContent = s.rpeTexto; $('r-rir').textContent = s.rirTexto || '--';
  $('r-reps').textContent = res.reps.length;
  $('r-reps-sub').textContent = s.validas < res.reps.length ? `${res.reps.length - s.validas} parcial(es)` : 'completas';
  $('r-vel').textContent = fmt(s.vMejor, 2);
  $('r-perd').textContent = fmt(s.perdida) + ' %'; $('r-fatiga').textContent = 'fatiga ' + s.fatiga.toLowerCase();
  $('r-est').innerHTML = `${fmt(res.estatico)} <small>kg</small>`;
  $('r-est-sub').textContent = ej.perfil === 'riel' ? `en el riel a ${alfa}°` : corporal ? 'de tu cuerpo + lastre' : 'carga vertical';
  $('r-fpico').textContent = fmt(s.fPico); $('r-ppico').textContent = fmt(s.pPico);

  // video
  if (salida) {
    $('sec-video').style.display = '';
    const url = URL.createObjectURL(salida.blob);
    $('r-video').src = url;
    $('btn-descargar').href = url;
    $('btn-descargar').download = `fuerza_${ej.id}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.${salida.extension}`;
    const f = new File([salida.blob], $('btn-descargar').download, { type: salida.tipo });
    $('btn-compartir').style.display = navigator.canShare && navigator.canShare({ files: [f] }) ? '' : 'none';
    $('btn-compartir').onclick = () => navigator.share({ files: [f], title: 'Analizador de Fuerza' }).catch(() => {});
  } else $('sec-video').style.display = 'none';

  // interpretacion
  $('r-etiquetas').innerHTML = [
    s.zona && `<span class="etiqueta naranja">${s.zona}</span>`,
    `<span class="etiqueta azul">Fatiga ${s.fatiga.toLowerCase()}</span>`,
    s.recorridoCV <= 8 ? '<span class="etiqueta verde">Recorrido constante</span>' : '',
  ].filter(Boolean).join('');
  $('r-recom').innerHTML = [...s.recomendaciones, ...s.notas].map((t) => `<li>${t}</li>`).join('');

  // cargas sugeridas
  const paso = ej.perfil === 'polea' ? 2.5 : ej.carro === 0 && ej.perfil === 'libre' ? 1 : 2.5;
  $('r-cargas').innerHTML = (s.tablaCargas || []).map((c) => `<tr><td>${c.reps} ${c.reps === 1 ? 'rep' : 'reps'}</td>
    <td><b>${corporal ? '+' : ''}${fmt(redondear(c.carga, paso), paso < 1 ? 1 : paso % 1 ? 1 : 0)} kg</b>${corporal ? ' lastre' : ''}</td>
    <td>${fmt(100 / (1 + (c.reps === 1 ? 0 : c.reps) / 30))} %</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>';
  $('r-metodos').textContent = s.metodos ? 'Estimado con: ' + s.metodos.map((m) => `${m.metodo} → ${fmt(m.valor, 1)} kg`).join(' · ') + '.' : '';

  // tabla de reps
  $('r-tabla').innerHTML = res.reps.map((r) => `<tr><td><b>${r.n}</b>${r.parcial ? ' <small>(parcial)</small>' : ''}</td>
    <td>${fmt(r.recorrido_cm)} cm</td><td class="${Math.round(r.perdida) === 0 ? 'badge-fastest' : ''}">${fmt(r.v_media, 2)}</td>
    <td>${fmt(r.perdida)} %</td><td>${fmt(r.f_pico)} kg</td><td>${fmt(r.p_pico)} W</td><td>${fmt(r.t_subida, 1)} s</td></tr>`).join('');
  vista('v-resultados');
  graficaBarras($('g-vel'), res.reps.map((r) => r.v_media), ej.mvt, res.reps.map((r) => r.parcial));
}
$('btn-nueva').onclick = () => { $('btn-quitar').click(); vista('v-form'); };

// ------------------------------------------------------------------ graficas (canvas)
function lienzo(c) {
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 340, h = c.clientHeight || 190;
  c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h); ctx.font = '11px system-ui, Roboto, sans-serif'; return { ctx, w, h };
}
function graficaBarras(c, vals, mvt, parcial) {
  const { ctx, w, h } = lienzo(c);
  const top = Math.max(...vals, mvt) * 1.15, x0 = 34, y0 = h - 22, alto = y0 - 10, ancho = (w - x0 - 6) / vals.length;
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'right';
  for (let k = 0; k <= 4; k++) { const v = top * k / 4, y = y0 - alto * v / top;
    ctx.fillText(v.toFixed(2), x0 - 6, y + 4); ctx.strokeStyle = '#262c3d'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const mejor = Math.max(...vals);
  vals.forEach((v, i) => {
    const bh = alto * v / top, x = x0 + i * ancho + ancho * 0.18;
    ctx.fillStyle = parcial[i] ? '#6b5a2a' : v === mejor ? '#5adc78' : '#5aa0ff';
    ctx.beginPath(); ctx.roundRect(x, y0 - bh, ancho * 0.64, bh, 4); ctx.fill();
    ctx.fillStyle = '#f0f2f5'; ctx.textAlign = 'center'; ctx.fillText(v.toFixed(2), x + ancho * 0.32, y0 - bh - 4);
    ctx.fillStyle = '#8e95a5'; ctx.fillText(String(i + 1), x + ancho * 0.32, h - 6);
  });
  const ym = y0 - alto * mvt / top; ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ff9628'; ctx.beginPath(); ctx.moveTo(x0, ym); ctx.lineTo(w, ym); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#ff9628'; ctx.textAlign = 'left'; ctx.fillText('MVT', x0 + 4, ym - 4);
}
function graficaLinea(c, puntos, etiqueta) {
  const { ctx, w, h } = lienzo(c);
  if (puntos.length < 1) { ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'center'; ctx.fillText('Aún no hay series de este ejercicio', w / 2, h / 2); return; }
  const ys = puntos.map((p) => p.y), lo = Math.min(...ys) * 0.95, hi = Math.max(...ys) * 1.05 || 1;
  const x0 = 40, y0 = h - 22, ah = y0 - 12, aw = w - x0 - 10;
  const X = (i) => x0 + (puntos.length === 1 ? aw / 2 : aw * i / (puntos.length - 1)), Y = (v) => y0 - ah * (v - lo) / ((hi - lo) || 1);
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'right';
  for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, y = Y(v); ctx.fillText(Math.round(v), x0 - 6, y + 4);
    ctx.strokeStyle = '#262c3d'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = '#ff9628'; ctx.lineWidth = 2.5; ctx.beginPath();
  puntos.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p.y)) : ctx.moveTo(X(i), Y(p.y)))); ctx.stroke();
  ctx.fillStyle = '#ff9628'; puntos.forEach((p, i) => { ctx.beginPath(); ctx.arc(X(i), Y(p.y), 3.5, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'center';
  [0, puntos.length - 1].forEach((i) => ctx.fillText(puntos[i].x, X(i), h - 6));
  ctx.textAlign = 'left'; ctx.fillText(etiqueta, x0 + 4, 12);
}

// ------------------------------------------------------------------ historial
function pintarHistorial() {
  const lista = hist.leer();
  const usados = [...new Set(lista.map((r) => r.ejercicio))].filter((id) => POR_ID[id]);
  const sel = $('h-ej'), previo = sel.value;
  sel.innerHTML = usados.length ? usados.map((id) => `<option value="${id}">${POR_ID[id].nombre}</option>`).join('') : '<option>Sin series todavía</option>';
  if (usados.includes(previo)) sel.value = previo; else if (usados.includes(ej.id)) sel.value = ej.id;
  const e = POR_ID[sel.value];
  const delEj = lista.filter((r) => e && r.ejercicio === e.id && r.rm);
  const corporal = e && e.perfil === 'corporal';
  graficaLinea($('g-hist'), delEj.map((r) => ({ x: new Date(r.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }),
    y: corporal ? r.rmLastre : r.rm })), corporal ? '1RM estimado (kg de lastre)' : '1RM estimado (kg)');
  const perfil = e ? perfilCargaVelocidad(lista, e) : null;
  $('h-perfil').textContent = perfil
    ? `Perfil carga-velocidad con ${perfil.puntos} cargas distintas: 1RM ≈ ${fmt(perfil.rm, 1)} kg (cuando tu velocidad llegaría a ${e.mvt} m/s).`
    : 'Graba series con 2 o más pesos distintos del mismo ejercicio para obtener tu perfil carga-velocidad, la estimación de 1RM más confiable.';
  $('h-lista').innerHTML = lista.length ? [...lista].reverse().map((r) => {
    const x = POR_ID[r.ejercicio] || { nombre: r.ejercicio, perfil: '' };
    return `<div class="historial-item"><div><strong>${x.nombre}</strong>
      <small>${new Date(r.fecha).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })} · ${x.perfil === 'corporal' ? (r.carga ? '+' + fmt(r.carga, 1) + ' kg' : 'peso corporal') : fmt(r.carga, 1) + ' kg'} × ${r.reps} · RPE ${r.rpe ?? '--'}</small></div>
      <div class="der"><b>${r.rm ? fmt(x.perfil === 'corporal' ? r.rmLastre : r.rm, 0) + ' kg' : '--'}</b><small>1RM est.</small>
      <button type="button" class="btn-sec peligro" data-borrar="${r.id}" style="padding:3px 8px;margin-top:4px;font-size:11px">Borrar</button></div></div>`;
  }).join('') : '<p class="vacio">Todavía no hay series. Analiza tu primer video y aparecerá aquí.</p>';
  $('h-lista').querySelectorAll('[data-borrar]').forEach((b) => (b.onclick = () => {
    if (confirm('¿Borrar esta serie del historial?')) { hist.borrar(b.dataset.borrar); pintarHistorial(); }
  }));
}
$('h-ej').onchange = pintarHistorial;
function descargarBlob(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('h-exportar').onclick = () => descargarBlob(hist.exportar(), `analizador-fuerza-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
$('h-csv').onclick = () => descargarBlob(hist.aCSV(), `analizador-fuerza-historial-${new Date().toISOString().slice(0, 10)}.csv`);
$('h-importar').onclick = () => $('h-archivo').click();
$('h-archivo').onchange = async () => {
  const f = $('h-archivo').files[0]; if (!f) return;
  try { const n = await hist.importar(f); alert(`Se restauraron ${n} series.`); pintarHistorial(); }
  catch (e) { alert('Ese archivo no es una copia de seguridad válida.'); }
  $('h-archivo').value = '';
};

// ------------------------------------------------------------------ inicio
(function iniciar() {
  if (leer('af_altura')) $('in-altura').value = leer('af_altura');
  if (leer('af_pc')) $('in-pc').value = leer('af_pc');
  if (leer('af_calidad')) $('in-calidad').value = leer('af_calidad');
  $('buscar-ej').oninput = pintarLista;
  pintarElegido(); pintarLista(); ajustarCampos();
  $('version').textContent = `Versión ${VERSION}`;
  if (!('VideoEncoder' in window) && !('MediaRecorder' in window)) aviso('Tu navegador no puede crear el video con telemetría, pero sí el análisis. Usa Chrome actualizado.');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
