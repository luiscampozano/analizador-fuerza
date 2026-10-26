// FuerzaPro — interfaz principal. Todo el procesamiento ocurre en el dispositivo.
import { EJERCICIOS, POR_ID, GRUPOS, GRUPOS_MUSCULO, GRUPO_PROPIOS, agregarPropio, quitarPropio } from './ejercicios.js';
import { detectarPose, cargarModelo } from './pose.js';
import { interpolar, analizar, anguloArticular, MP, escala, marcarReps } from './fisica.js';
import { analizarSerie, perfilCargaVelocidad, sugerirCalibracion, estadisticasSerie } from './analisis.js';
import * as almacen from './almacen.js';
import { crearSeguidor, calcularTrayectoria } from './trayectoria.js';
import { revisarTecnica } from './tecnica.js';
import { agruparSesiones, tonelajeSemanal, exportarExcel } from './sesiones.js';
import * as vivo from './vivo.js';
import { prepararDibujo, generarVideo } from './render.js';
import * as hist from './historial.js';
import { abrirVideo } from './lector.js';
import * as entrenar from './entrenar.js';
import * as nutricion from './nutricion.js';
import * as perfil from './perfil.js';

const VERSION = '2.0.3';
const $ = (id) => document.getElementById(id);
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const redondear = (x, paso = 2.5) => Math.round(x / paso) * paso;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let ej = POR_ID[leer('af_ej')] || POR_ID.remo_riel;
let grupo = 'Todos';
let archivo = null;
let cancelar = false;

// ------------------------------------------------------------------ navegacion
function vista(id) {
  if (id !== 'v-vivo') vivo.detener();
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  const pestana = { 'v-resultados': 'v-form', 'v-progreso': 'v-form', 'v-vivo': 'v-form', 'v-historial': 'v-perfil', 'v-guia': 'v-perfil' }[id] || id;
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.vista === pestana));
  window.scrollTo({ top: 0 });
  if (id === 'v-historial') pintarHistorial();
  entrenar.alCambiarVista(id);
  if (id === 'v-nutricion') nutricion.pintar();
  if (id === 'v-perfil') perfil.pintar();
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
  const sub = [ej.propio ? (ej.musculo || GRUPO_PROPIOS) : ej.grupo, ej.equipo].filter(Boolean).join(' · ');
  $('ej-elegido').innerHTML = `<span class="preset-icon">${ej.icono}</span><div><strong>${esc(ej.nombre)}</strong>
    <small>${esc(sub)}</small></div><div class="ej-botones">${ej.propio ? '<button type="button" class="btn-sec peligro" id="btn-borrar-ej">Borrar</button>' : ''}<button type="button" class="btn-sec" id="btn-cambiar">Cambiar</button></div>`;
  if (ej.propio) $('btn-borrar-ej').onclick = () => {
    if (!confirm(`¿Borrar el ejercicio "${ej.nombre}"? Tu historial de ese ejercicio se conserva.`)) return;
    quitarPropio(ej.id); elegir(POR_ID.sentadilla);
  };
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
  if (grupo !== 'Todos' && !GRUPOS.includes(grupo)) grupo = 'Todos';
  const palabras = q.split(/\s+/).filter(Boolean);
  const lista = EJERCICIOS.filter((e) => {
    if (grupo !== 'Todos' && e.grupo !== grupo) return false;
    const texto = [e.nombre, e.grupo, e.equipo, e.musculo, e.en].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return palabras.every((w) => texto.includes(w));
  });
  $('lista-ej').innerHTML = lista.map((e) => `<button type="button" class="preset-card${e.id === ej.id ? ' active' : ''}" data-id="${e.id}">
    <span class="preset-icon">${e.icono}</span><span class="preset-name">${esc(e.corto)}</span><span class="preset-sub">${esc(e.equipo || e.grupo)}</span></button>`).join('')
    || '<p class="vacio">No encontré ese ejercicio. Puedes crearlo con el botón de abajo.</p>';
  $('lista-ej').querySelectorAll('.preset-card').forEach((b) => (b.onclick = () => elegir(POR_ID[b.dataset.id])));
}
function elegir(e) {
  ej = e; guardar('af_ej', e.id);
  $('selector-ej').style.display = 'none';
  pintarElegido(); pintarLista(); ajustarCampos(); actualizarMarca();
}
// ---- crear ejercicio propio
$('p-musculo').innerHTML = GRUPOS_MUSCULO.map((g) => `<option>${g}</option>`).join('');
$('btn-crear-ej').onclick = () => {
  const f = $('form-propio'), abierto = f.style.display !== 'none';
  f.style.display = abierto ? 'none' : 'block';
  if (!abierto) { $('p-nombre').value = $('buscar-ej').value.trim(); $('p-nombre').focus(); }
};
$('p-cancelar').onclick = () => { $('form-propio').style.display = 'none'; };
$('p-equipo').onchange = () => { // ayuda: con peso corporal casi siempre se mueve todo el cuerpo
  if ($('p-equipo').value === 'corporal') $('p-punto').value = 'hombros';
};
$('p-guardar').onclick = () => {
  const nombre = $('p-nombre').value.trim();
  if (nombre.length < 3) return alert('Ponle un nombre al ejercicio.');
  if (EJERCICIOS.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase())) return alert('Ya existe un ejercicio con ese nombre.');
  const nuevo = agregarPropio({
    nombre, equipo: $('p-equipo').value, musculo: $('p-musculo').value, punto: $('p-punto').value,
    sentido: $('p-sentido').value, brazos: $('p-brazos').value, ancla: $('p-ancla').value,
  });
  $('form-propio').style.display = 'none'; $('buscar-ej').value = ''; grupo = 'Todos';
  elegir(nuevo);
  aviso(`Ejercicio "${nombre}" creado. Lo encuentras en "${GRUPO_PROPIOS}".`, true);
};

// el campo de barra/carro solo aparece si el equipo lo tiene (no con mancuernas, kettlebell ni palancas sin barra)
function usaCarro() {
  return ej.perfil === 'riel' || (ej.perfil === 'libre' && (ej.carro > 0 || /barra/i.test(ej.equipo || '')));
}
function ajustarCampos() {
  const p = ej.perfil;
  $('g-incl').style.display = p === 'riel' ? '' : 'none';
  $('g-rel').style.display = p === 'polea' ? '' : 'none';
  $('g-carro').style.display = usaCarro() ? '' : 'none';
  $('lbl-peso').textContent = p === 'corporal' ? 'Lastre' : p === 'polea' ? 'Peso de la pila' : ej.carro > 0 ? 'Peso de discos' : 'Peso';
  if (ej.asistido) $('lbl-peso').textContent = 'Asistencia';
  $('lbl-carro').textContent = p === 'riel' ? 'Carro de la máquina' : 'Peso de la barra';
  $('in-incl').value = leer('af_incl_' + ej.id) || ej.alfa || 45;
  $('in-carro').value = leer('af_carro_' + ej.id) ?? ej.carro ?? 0;
  $('in-peso').value = leer('af_peso_' + ej.id) ?? (p === 'corporal' ? 0 : '');
}

// ------------------------------------------------------------------ video
const inVideo = $('input-video');
$('btn-grabar').onclick = (e) => { e.stopPropagation(); inVideo.setAttribute('capture', 'environment'); inVideo.click(); };
$('btn-galeria').onclick = (e) => { e.stopPropagation(); inVideo.removeAttribute('capture'); inVideo.click(); };
$('dropzone').onclick = () => { if (!archivo) { inVideo.removeAttribute('capture'); inVideo.click(); } };
function ponerArchivo(f) {
  archivo = f; marca = null;
  $('file-name').textContent = `${archivo.name || 'video'} · ${fmt(archivo.size / 1048576)} MB`;
  $('drop-content').style.display = 'none'; $('file-preview').style.display = 'flex';
  $('dropzone').classList.add('has-file');
  actualizarMarca();
}
inVideo.onchange = () => { if (inVideo.files && inVideo.files[0]) ponerArchivo(inVideo.files[0]); };
$('btn-quitar').onclick = (e) => {
  e.stopPropagation(); archivo = null; marca = null; inVideo.value = '';
  $('drop-content').style.display = 'block'; $('file-preview').style.display = 'none'; $('dropzone').classList.remove('has-file');
  actualizarMarca();
};

// ---- marcar el disco para seguir la barra
let marca = null; // {x, y (0-1), t (s)}
const CON_DISCO = ['Barra', 'Barra Z', 'Smith', 'Máquina con discos'];
function actualizarMarca() {
  const b = $('btn-marca');
  b.style.display = archivo && CON_DISCO.includes(ej.equipo) ? '' : 'none';
  b.classList.toggle('hecho', !!marca);
  b.textContent = marca ? '🎯 Disco marcado ✓ (toca para cambiar)' : '🎯 Marcar el disco (trayectoria más precisa)';
}
$('btn-marca').onclick = async (e) => {
  e.stopPropagation();
  const c = $('marca-canvas');
  try {
    const fuente = await abrirVideo(archivo);
    const ini = parseFloat($('in-ini').value);
    const t = Math.min(fuente.duration - 0.05, ini > 0 ? ini : 0);
    let img = null;
    for await (const x of fuente.iterar([t])) img = x.imagen;
    if (!img) throw new Error('sin cuadro');
    c.width = fuente.videoWidth; c.height = fuente.videoHeight;
    const ctx = c.getContext('2d');
    const pintar = () => {
      ctx.drawImage(img, 0, 0, c.width, c.height);
      if (marca) {
        const r = Math.max(14, c.width * 0.035);
        ctx.lineWidth = Math.max(3, c.width * 0.006); ctx.strokeStyle = '#ffd640';
        ctx.beginPath(); ctx.arc(marca.x * c.width, marca.y * c.height, r, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(marca.x * c.width - r * 1.6, marca.y * c.height); ctx.lineTo(marca.x * c.width + r * 1.6, marca.y * c.height);
        ctx.moveTo(marca.x * c.width, marca.y * c.height - r * 1.6); ctx.lineTo(marca.x * c.width, marca.y * c.height + r * 1.6); ctx.stroke();
      }
    };
    c.onpointerdown = (ev) => {
      const r = c.getBoundingClientRect();
      marca = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, t };
      pintar();
    };
    pintar();
    $('marca-modal').style.display = 'flex';
  } catch (err) { alert('No pude mostrar el primer cuadro del video para marcar el disco.'); }
};
$('marca-quitar').onclick = () => { marca = null; $('marca-modal').style.display = 'none'; actualizarMarca(); };
$('marca-listo').onclick = () => { $('marca-modal').style.display = 'none'; actualizarMarca(); };

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
// Lee y valida los datos del formulario (los usa el analisis de videos y el modo en vivo)
function leerDatos() {
  const peso = parseFloat($('in-peso').value || '0');
  const pc = parseFloat($('in-pc').value || '0');
  const altura = parseFloat($('in-altura').value || '0');
  if (ej.perfil !== 'corporal' && !(peso > 0)) { alert('Indica el peso en kg.'); return null; }
  if (!(altura > 1 && altura < 2.4)) { alert('Revisa tu estatura (en metros, por ejemplo 1.68).'); return null; }
  if (ej.perfil === 'corporal' && !(pc > 20)) { alert('Indica tu peso corporal.'); return null; }
  const carro = usaCarro() ? parseFloat($('in-carro').value || '0') : 0;
  const alfa = ej.perfil === 'riel' ? parseFloat($('in-incl').value || '45') : 90;
  const relacion = ej.perfil === 'polea' ? parseFloat($('in-rel').value || '1') : 1;
  guardar('af_peso_' + ej.id, peso); guardar('af_carro_' + ej.id, carro); guardar('af_incl_' + ej.id, alfa);
  guardar('af_altura', altura); guardar('af_pc', pc); guardar('af_calidad', $('in-calidad').value);
  const carga = peso + carro; // lo que el usuario mueve (discos + barra/carro, pila o lastre)
  const masa = ej.perfil === 'corporal' ? Math.max(5, pc * (ej.fraccion || 1) + (ej.asistido ? -peso : peso)) : carga;
  return { peso, pc, altura, carro, alfa, relacion, carga, masa };
}

let origen = 'video';
$('btn-analizar').onclick = () => analizarArchivo();
async function analizarArchivo() {
  if (!archivo) return alert('Primero graba o elige el video de la serie.');
  const d = leerDatos(); if (!d) return;
  const { peso, pc, altura, alfa, relacion, carga, masa } = d;
  cancelar = false; pasoActual = -1; vista('v-progreso');
  try {
    progreso(0, 0, 'Cargando la IA de pose (la primera vez descarga ~10 MB)…');
    await cargarModelo($('in-calidad').value);
    const video = await abrirVideo(archivo);
    progreso(0, 1);
    const calidad = $('in-calidad').value;
    const hz = { rapida: 15, normal: 30, maxima: 60 }[calidad] || 30;
    const seguidor = marca && CON_DISCO.includes(ej.equipo) ? crearSeguidor(video.videoWidth, video.videoHeight, marca) : null;
    const { frames, delegado } = await detectarPose(video, {
      calidad, hz, cancelado: () => cancelar, alCuadro: seguidor ? (img, t) => seguidor.procesar(img, t) : null,
      alAvanzar: (f, resta, del) => progreso(1, f, `Detectando pose (${del === 'GPU' ? 'GPU' : 'CPU'})${minutos(resta)}`),
    });
    if (frames.filter((f) => f.puntos).length < frames.length * 0.3) throw new Error('No se ve bien a la persona en el video. Graba de lado, con el cuerpo completo y buena luz.');
    progreso(2, 0.2, 'Calculando la física…');
    const fps = 60, full = interpolar(frames, fps, video.duration);
    const ini = parseFloat($('in-ini').value), fin = parseFloat($('in-fin').value);
    const res = analizar(full, fps, ej, { masa, alfa, relacion, altura, inicio: ini > 0 ? ini : null, fin: fin > 0 ? fin : null });
    if (!res.reps.length) throw new Error('No se detectaron repeticiones. Revisa que elegiste el ejercicio correcto y que se vea todo el movimiento.');
    const pcv = perfilCargaVelocidad(hist.leer(), ej);
    const serie = analizarSerie(res, ej, { carga: ej.perfil === 'corporal' ? peso : carga, masaTotal: masa, pesoCorporal: pc, perfil: ej.perfil, pcv, rmReal: entrenar.rmRealDe(ej.id) });
    const mPx = escala(full, fps, altura);
    const tray = calcularTrayectoria(full, fps, res, ej, seguidor ? seguidor.puntos : null, mPx);
    const tec = revisarTecnica(full, fps, res, ej, mPx);
    progreso(2, 1);

    const inf = crearInforme({ res, s: serie, tray, tec, pcv, datos: { carga, masa, pc, alfa, peso, relacion, calidad, origen }, fps });
    const r3 = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);
    const registro = hist.agregar({
      ejercicio: ej.id, nombre: ej.nombre, equipo: ej.equipo || '', carga: ej.perfil === 'corporal' ? peso : carga, masa, perfil: ej.perfil, alfa,
      reps: res.reps.length, repsValidas: serie.validas, vMejor: serie.vMejor, vUltima: serie.vUltima, perdida: serie.perdida, rir: serie.rir ?? null, rpe: serie.rpe,
      rm: serie.rm ?? null, rmLastre: serie.rmLastre ?? null, fPico: serie.fPico, pPico: serie.pPico,
      estatico: res.estatico, velocidades: res.reps.map((r) => +r.v_media.toFixed(3)), pesoCorporal: pc,
      desvio: r3(tray.desvioMedio, 1), alertas: tec.resumen, origen, informe: true,
      repsDet: inf.reps,
    });
    inf.id = registro.id; inf.fecha = registro.fecha;
    if (entrenar.vincular(registro)) aviso('');
    await almacen.guardarInforme(inf);
    origen = 'video';

    let salida = null;
    if ($('in-video').checked) {
      const ang = $('in-angulo').value ? anguloArticular(full, $('in-angulo').value, fps) : null;
      const puntoIdx = MP[ej.punto];
      const titulo = ej.perfil === 'riel' ? `${ej.corto} · ${fmt(carga, 1)} kg · peso efectivo (${alfa}°): ${fmt(res.estatico)} kg`
        : ej.perfil === 'corporal' ? `${ej.corto} · peso corporal ${fmt(pc, 1)} kg${peso ? (ej.asistido ? ` − asistencia ${fmt(peso, 1)} kg` : ` + lastre ${fmt(peso, 1)} kg`) : ''}`
        : `${ej.corto} · ${fmt(carga, 1)} kg${relacion !== 1 ? ` (polea ${relacion}:1)` : ''}`;
      const leyendaVel = ej.sentido === 'abajo' ? 'Velocidad de la carga (m/s)  ↑ subida  ↓ bajada' : 'Velocidad (m/s)  ↑ fase concéntrica  ↓ excéntrica';
      const dibujar = prepararDibujo(video, full, res, { puntoIdx, angulo: ang, titulo, leyendaVel, trayectoria: tray, alertas: tec.porRep });
      salida = await generarVideo(video, archivo, dibujar, {
        cancelado: () => cancelar, alAvanzar: (f) => progreso(3, f, 'Creando el video con telemetría…'),
      });
      await almacen.guardarVideo(registro.id, salida);
    }
    mostrarInforme(inf, { video: salida, nuevo: true });
  } catch (e) {
    console.error(e);
    origen = 'video';
    vista('v-form');
    if (e && e.message === 'cancelado') return;
    alert((e && e.message) || (typeof Event !== 'undefined' && e instanceof Event ? 'No pude cargar un archivo necesario para el análisis. Revisa tu conexión y vuelve a intentarlo.' : String(e)));
  }
}

// ------------------------------------------------------------------ informe de la serie
// Todo lo necesario para volver a mostrar la serie y generar el PDF, sin el video original.
function crearInforme({ res, s, tray, tec, pcv, datos, fps }) {
  const r3 = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);
  const caminos = res.reps.map((r) => {
    const pts = [], paso = Math.max(1, Math.round((r.fin - r.inicio) / 60));
    for (let i = r.inicio; i <= r.fin; i += paso) {
      if (!Number.isFinite(tray.x[i]) || !Number.isFinite(tray.x[r.inicio])) continue;
      pts.push([r3((tray.x[i] - tray.x[r.inicio]) * tray.mPx * 100, 1), r3(-(tray.y[i] - tray.y[r.inicio]) * tray.mPx * 100, 1)]);
    }
    return pts;
  }).filter((p) => p.length > 2);
  return {
    v: 2, ej: { id: ej.id, nombre: ej.nombre, corto: ej.corto, grupo: ej.grupo, equipo: ej.equipo || '', perfil: ej.perfil, mvt: ej.mvt,
      aprox: !!ej.aprox, carro: ej.carro, punto: ej.punto, sentido: ej.sentido, asistido: !!ej.asistido },
    datos, estatico: res.estatico,
    s: { rm: s.rm ?? null, rmMin: s.rmMin ?? null, rmMax: s.rmMax ?? null, pct: s.pct ?? null, rmLastre: s.rmLastre ?? null, rpeTexto: s.rpeTexto, rirTexto: s.rirTexto,
      validas: s.validas, vMejor: s.vMejor, perdida: s.perdida, fatiga: s.fatiga, zona: s.zona, recorridoCV: s.recorridoCV, fPico: s.fPico, pPico: s.pPico,
      mvt: s.mvt, mvtPersonal: !!s.mvtPersonal, tablaCargas: s.tablaCargas || [], metodos: (s.metodos || []).map((m) => ({ metodo: m.metodo, valor: m.valor })),
      recomendaciones: s.recomendaciones || [], notas: s.notas || [], ecuacion: s.ecuacion || null },
    reps: res.reps.map((r, k) => ({ n: r.n, lado: r.lado || '', parcial: !!r.parcial, atipica: !!r.atipica, rec: r3(r.recorrido_cm, 1), v: r3(r.v_media), vp: r3(r.v_pico),
      perd: r3(r.perdida, 1), f: r3(r.f_pico, 0), p: r3(r.p_pico, 0), ts: r3(r.t_subida, 2), tb: r3(r.t_bajada, 2), tope: r3(r.tope / fps, 2),
      desvio: r3(tray.porRep[k].desvio, 1), alertas: tec.porRep[k] || [] })),
    tec: { resumen: tec.resumen },
    tray: { fuente: tray.fuente, vertical: tray.vertical, desvioMedio: r3(tray.desvioMedio, 1), caminos },
    pcv: pcv ? { confianza: pcv.confianza, rm: pcv.rm ?? null, mvt: pcv.mvt, mvtPersonal: !!pcv.mvtPersonal, n: pcv.n } : null,
    stats: estadisticasSerie(res.reps),
  };
}
// Series guardadas antes de la version 1.5: se arma un informe con lo que haya en el historial
function informeDesdeRegistro(r) {
  const e = POR_ID[r.ejercicio] || { id: r.ejercicio, nombre: r.nombre || r.ejercicio, corto: r.nombre || r.ejercicio, perfil: r.perfil, mvt: 0.3, equipo: r.equipo || '' };
  const reps = (r.repsDet && r.repsDet.length ? r.repsDet : (r.velocidades || []).map((v, i) => ({ n: i + 1, v })))
    .map((x) => ({ alertas: [], ...x }));
  if (reps.length && reps.every((x) => Number.isFinite(x.rec) && Number.isFinite(x.v))) { // mismas reglas que la version actual
    const tmp = reps.map((x) => ({ recorrido_cm: x.rec, v_media: x.v }));
    marcarReps(tmp);
    reps.forEach((x, k) => { x.parcial = tmp[k].parcial; x.atipica = tmp[k].atipica; x.perd = tmp[k].perdida; });
  } else {
    const mejor = Math.max(...reps.filter((x) => !x.parcial).map((x) => x.v || 0), 0);
    reps.forEach((x) => { if (x.perd === undefined && mejor) x.perd = 100 * (1 - x.v / mejor); });
  }
  const at = reps.filter((x) => x.atipica).map((x) => x.n);
  const corporal = r.perfil === 'corporal';
  const tabla = r.rm ? [1, 2, 3, 5, 6, 8, 10, 12, 15].map((rp) => ({ reps: rp, carga: Math.max(0, (rp === 1 ? r.rm : r.rm / (1 + rp / 30)) - (corporal ? (r.masa - r.carga) : 0)) })) : [];
  const p = r.perdida;
  return {
    v: 1, id: r.id, fecha: r.fecha, antiguo: true,
    ej: { id: e.id, nombre: e.nombre, corto: e.corto, grupo: e.grupo, equipo: e.equipo || '', perfil: r.perfil || e.perfil, mvt: e.mvt, aprox: !!e.aprox, carro: e.carro, punto: e.punto, sentido: e.sentido },
    datos: { carga: r.carga, masa: r.masa, pc: r.pesoCorporal, alfa: r.alfa, peso: corporal ? r.carga : r.carga, relacion: 1, origen: r.origen || 'video' },
    estatico: r.estatico,
    s: { rm: r.rm, rmLastre: r.rmLastre, pct: r.rm ? 100 * (corporal ? r.masa : r.carga) / r.rm : null, rpeTexto: r.rpe ?? '—', rirTexto: r.rir ?? '—',
      validas: r.repsValidas ?? r.reps, vMejor: r.vMejor, perdida: p, fPico: r.fPico, pPico: r.pPico, mvt: e.mvt,
      fatiga: p < 10 ? 'Muy baja' : p < 20 ? 'Baja' : p < 30 ? 'Moderada' : p < 40 ? 'Alta' : 'Muy alta', zona: '', tablaCargas: tabla, metodos: [],
      recomendaciones: [], notas: ['Serie analizada con una versión anterior de la app: no se guardaron la interpretación completa ni el video.',
        ...(at.length ? [`Rep ${at.join(', ')} marcada${at.length > 1 ? 's' : ''} como atípica${at.length > 1 ? 's' : ''} (mucho más rápida que el resto). El RIR, el RPE y el 1RM de arriba son los que se calcularon en su momento; vuelve a analizar el video para recalcularlos.`] : [])] },
    reps, tec: { resumen: r.alertas || [] }, tray: { fuente: 'ia', vertical: false, desvioMedio: r.desvio ?? null, caminos: [] }, pcv: null,
    stats: estadisticasSerie(reps.map((x) => ({ n: x.n, parcial: x.parcial, atipica: x.atipica, v_media: x.v, v_pico: x.vp ?? x.v, recorrido_cm: x.rec ?? 0, f_pico: x.f ?? 0, p_pico: x.p ?? 0, t_subida: x.ts ?? 0 }))),
  };
}

// ------------------------------------------------------------------ resultados
let informeActual = null, videoActual = null, vistaPrevia = 'v-form';
function textoCarga(inf) {
  const { ej: e, datos: d } = inf;
  return e.perfil === 'corporal' ? `peso corporal${d.peso ? (e.asistido ? ' − ' : ' + ') + fmt(d.peso, 1) + ' kg' : ''}` : fmt(d.carga, 1) + ' kg';
}
// notas que dependen del ejercicio y del perfil (se calculan al mostrar)
function notasInforme(inf) {
  const n = [...inf.s.recomendaciones, ...inf.s.notas];
  if (inf.ej.aprox) n.push('Este ejercicio es en arco o con palancas: la fuerza y la potencia son aproximadas. Velocidad, reps, RIR y pérdida de velocidad sí son confiables para comparar tus series.');
  if (!inf.antiguo) n.push(inf.pcv && (inf.pcv.confianza === 'alta' || inf.pcv.confianza === 'media')
    ? `Se usó tu perfil carga-velocidad personal (confianza ${inf.pcv.confianza}${inf.s.mvtPersonal ? `, tu velocidad mínima: ${fmt(inf.s.mvt, 2)} m/s` : ''}).`
    : 'Aún no había perfil carga-velocidad personal para este ejercicio: se usaron valores promedio. Mira «Historial → Progreso» para calibrarlo.');
  return n;
}
function textoTrayectoria(inf) {
  const t = inf.tray;
  return Number.isFinite(t.desvioMedio)
    ? `Desvío horizontal medio en la subida: ${fmt(t.desvioMedio, 1)} cm. ${t.desvioMedio < 4 ? 'Muy recta.' : t.desvioMedio < 8 ? 'Bastante recta.' : 'Se aleja bastante de la vertical: revisa la técnica o el ángulo de la cámara.'}`
      + (t.fuente === 'disco' ? '' : ' Para seguir la barra en sí, usa «Marcar el disco».')
    : t.vertical ? 'No se pudo medir el desvío en esta serie.' : inf.antiguo ? 'Esta serie no guardó la trayectoria.' : 'En este ejercicio el recorrido no es vertical: la trayectoria es solo informativa (no se mide desvío).';
}

function mostrarInforme(inf, { video = null, nuevo = false, desde = 'v-form' } = {}) {
  informeActual = inf; videoActual = video; vistaPrevia = desde;
  const { ej: e, s, datos: d } = inf, corporal = e.perfil === 'corporal';
  $('btn-nueva').textContent = nuevo ? '← Nueva serie' : '← Volver';
  $('r-guardado').textContent = nuevo ? '✓ Guardado en historial' : 'Serie del historial';
  $('r-titulo').textContent = `${e.nombre} · ${textoCarga(inf)} · ${new Date(inf.fecha || Date.now()).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}`;
  if (s.rm) {
    if (corporal) {
      $('r-rm').innerHTML = `${s.rmLastre >= 0 ? '+' : ''}${fmt(s.rmLastre, 1)} <small>kg de lastre</small>`;
      $('r-rm-sub').textContent = `para 1 repetición · masa total que moverías ≈ ${fmt(s.rm)} kg`;
    } else {
      $('r-rm').innerHTML = `${fmt(s.rm, 1)} <small>kg</small>`;
      $('r-rm-sub').textContent = (s.rmMax && Math.round(s.rmMax - s.rmMin) >= 1 ? `rango ${fmt(s.rmMin)}–${fmt(s.rmMax)} kg · ` : '') + (s.pct ? `esta serie fue al ${fmt(s.pct)} % de tu 1RM` : '') +
        (e.perfil === 'riel' ? ` · en el riel equivale a ${fmt(s.rm * Math.sin((d.alfa || 90) * Math.PI / 180))} kg` : '');
    }
  } else { $('r-rm').textContent = '--'; $('r-rm-sub').textContent = ''; }
  $('r-rpe').textContent = s.rpeTexto ?? '--'; $('r-rir').textContent = s.rirTexto ?? '--';
  $('r-reps').textContent = inf.reps.length;
  $('r-reps-sub').textContent = s.validas < inf.reps.length ? `${inf.reps.length - s.validas} parcial(es)` : 'completas';
  $('r-vel').textContent = fmt(s.vMejor, 2);
  $('r-perd').textContent = fmt(s.perdida) + ' %'; $('r-fatiga').textContent = 'fatiga ' + (s.fatiga || '').toLowerCase();
  $('r-est').innerHTML = Number.isFinite(inf.estatico) ? `${fmt(inf.estatico)} <small>kg</small>` : '--';
  $('r-est-sub').textContent = e.perfil === 'riel' ? `en el riel a ${d.alfa}°` : corporal ? 'de tu cuerpo + lastre' : 'carga vertical';
  $('r-fpico').textContent = fmt(s.fPico); $('r-ppico').textContent = fmt(s.pPico);

  // video
  if (video) {
    $('sec-video').style.display = ''; $('r-sin-video').style.display = 'none';
    const url = URL.createObjectURL(video.blob);
    $('r-video').src = url;
    $('btn-descargar').href = url;
    $('btn-descargar').download = `fuerza_${e.id}_${new Date(inf.fecha || Date.now()).toISOString().slice(0, 16).replace(/[-:T]/g, '')}.${video.extension}`;
    const f = new File([video.blob], $('btn-descargar').download, { type: video.tipo });
    $('btn-compartir').style.display = navigator.canShare && navigator.canShare({ files: [f] }) ? '' : 'none';
    $('btn-compartir').onclick = () => navigator.share({ files: [f], title: 'FuerzaPro' }).catch(() => {});
  } else {
    $('sec-video').style.display = 'none';
    $('r-sin-video').style.display = nuevo ? 'none' : '';
    $('r-sin-video').textContent = inf.antiguo ? 'Esta serie se analizó con una versión anterior: el video no se guardó.'
      : `El video de esta serie ya no está guardado (se conservan los de las últimas ${almacen.MAX_VIDEOS} series).`;
  }

  // interpretacion
  $('r-etiquetas').innerHTML = [
    s.zona && `<span class="etiqueta naranja">${s.zona}</span>`,
    s.fatiga && `<span class="etiqueta azul">Fatiga ${s.fatiga.toLowerCase()}</span>`,
    s.recorridoCV <= 8 ? '<span class="etiqueta verde">Recorrido constante</span>' : '',
  ].filter(Boolean).join('');
  $('r-recom').innerHTML = notasInforme(inf).map((t) => `<li>${t}</li>`).join('');

  // tecnica
  $('r-tecnica').innerHTML = inf.tec.resumen.length
    ? `<ul class="tec-lista">${inf.tec.resumen.map((t) => `<li>⚠ ${esc(t)}</li>`).join('')}</ul><p class="hint">Avisos orientativos según los puntos de tu cuerpo; dependen del ángulo de la cámara.</p>`
    : '<p class="tec-ok" style="margin:0">✓ Sin alertas de técnica en esta serie.</p><p class="hint">Se revisan profundidad, cadera adelantada, balanceo y diferencia entre brazos cuando el ángulo de la cámara lo permite.</p>';
  // trayectoria
  $('sec-tray').style.display = inf.tray.caminos.length || !inf.antiguo ? '' : 'none';
  $('r-tray-fuente').textContent = inf.tray.fuente === 'disco' ? '· del disco' : `· de ${{ manos: 'las manos', hombros: 'los hombros', cadera: 'la cadera', pies: 'los pies' }[e.punto] || 'la carga'}`;
  $('r-tray-txt').textContent = textoTrayectoria(inf);

  // cargas sugeridas
  const paso = e.perfil === 'polea' ? 2.5 : e.carro === 0 && e.perfil === 'libre' ? 1 : 2.5;
  $('r-cargas').innerHTML = (s.tablaCargas || []).map((c) => `<tr><td>${c.reps} ${c.reps === 1 ? 'rep' : 'reps'}</td>
    <td><b>${corporal ? '+' : ''}${fmt(redondear(c.carga, paso), paso < 1 ? 1 : paso % 1 ? 1 : 0)} kg</b>${corporal ? ' lastre' : ''}</td>
    <td>${fmt(100 / (1 + (c.reps === 1 ? 0 : c.reps) / 30))} %</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>';
  $('r-metodos').textContent = s.metodos && s.metodos.length ? 'Estimado con: ' + s.metodos.map((m) => `${m.metodo} → ${fmt(m.valor, 1)} kg`).join(' · ') + '.' : '';

  // estadistica
  const st = inf.stats;
  const filaSt = (nombre, x, d2, u) => x ? `<tr><td>${nombre}</td><td>${fmt(x.media, d2)} ${u}</td><td>±${fmt(x.de, d2)}</td><td>${fmt(x.cv, 1)} %</td><td>${fmt(x.min, d2)}–${fmt(x.max, d2)}</td></tr>` : '';
  $('r-stats').innerHTML = st ? filaSt('Velocidad media', st.vars.v, 2, 'm/s') + filaSt('Velocidad pico', st.vars.vp, 2, 'm/s') + filaSt('Recorrido', st.vars.rec, 0, 'cm')
    + filaSt('Fuerza pico', st.vars.f, 0, 'kg') + filaSt('Potencia pico', st.vars.p, 0, 'W') + filaSt('Tiempo de subida', st.vars.ts, 2, 's') : '<tr><td colspan="5">—</td></tr>';
  $('r-stats-txt').innerHTML = st ? [
    `Reps usadas: <b>${st.n}</b>${st.parciales ? ` (+${st.parciales} parcial${st.parciales > 1 ? 'es' : ''} o atípica${st.parciales > 1 ? 's' : ''}, excluida${st.parciales > 1 ? 's' : ''})` : ''} · más rápida: rep <b>${st.mejor}</b> · más lenta: rep <b>${st.peor}</b>.`,
    st.pendiente === null ? '' : st.pendiente > -0.005 ? 'La velocidad se mantuvo estable de rep a rep (sin tendencia de caída).' : `La velocidad cayó <b>${fmt(-st.pendiente, 3)} m/s por rep</b> desde la más rápida (ajuste R² = ${fmt(st.r2, 2)}${st.r2 >= 0.7 ? ', tendencia clara' : ', tendencia irregular'}).`,
    st.fatiga3 !== null ? `Promedio de las últimas reps vs las primeras: <b>${st.fatiga3 >= 0 ? '−' : '+'}${fmt(Math.abs(st.fatiga3), 0)} %</b>.` : '',
    st.trabajo ? `Trabajo mecánico total ≈ <b>${fmt(st.trabajo / 1000, 1)} kJ</b> · tiempo bajo tensión ≈ <b>${fmt(st.tut, 0)} s</b>.` : '',
    'CV = coeficiente de variación (cuánto cambian las reps entre sí). Menos de 10 % es una serie muy consistente.',
  ].filter(Boolean).join('<br>') : '';

  // tabla de reps
  $('r-tabla').innerHTML = inf.reps.map((r) => `<tr><td><b>${r.n}</b>${r.lado ? ` <small>${r.lado === 'der' ? 'der.' : 'izq.'}</small>` : ''}${r.parcial ? ' <small>(parcial)</small>' : ''}${r.atipica ? ' <small>(atípica)</small>' : ''}</td>
    <td>${Number.isFinite(r.rec) ? fmt(r.rec) + ' cm' : '--'}</td><td class="${Math.round(r.perd) === 0 ? 'badge-fastest' : ''}">${fmt(r.v, 2)}</td>
    <td>${fmt(r.perd)} %</td><td>${Number.isFinite(r.f) ? fmt(r.f) + ' kg' : '--'}</td><td>${Number.isFinite(r.p) ? fmt(r.p) + ' W' : '--'}</td><td>${Number.isFinite(r.ts) ? fmt(r.ts, 1) + ' s' : '--'}</td>
    <td>${Number.isFinite(r.desvio) ? fmt(r.desvio, 1) + ' cm' : '--'}</td>
    <td class="tec">${(r.alertas || []).filter((t) => !t.startsWith('Rep parcial')).map(esc).join('<br>') || '✓'}</td></tr>`).join('');
  vista('v-resultados');
  graficaBarras($('g-vel'), inf.reps.map((r) => r.v), s.mvt || e.mvt, inf.reps.map((r) => r.parcial || r.atipica));
  graficaTrayectoria($('g-tray'), inf.tray.caminos);
}
$('btn-nueva').onclick = () => {
  if ($('btn-nueva').textContent.includes('Nueva')) { $('btn-quitar').click(); vista('v-form'); } else vista(vistaPrevia);
};
async function abrirSerie(id, desde) {
  const r = hist.leer().find((x) => x.id === id); if (!r) return;
  const inf = (await almacen.leerInforme(id)) || informeDesdeRegistro(r);
  inf.id = id; inf.fecha = r.fecha;
  const video = await almacen.leerVideo(id);
  mostrarInforme(inf, { video, desde });
}
$('btn-pdf').onclick = async () => {
  if (!informeActual) return;
  const b = $('btn-pdf'), txt = b.textContent;
  b.disabled = true; b.textContent = 'Generando PDF…';
  try {
    const { crearPDF } = await import('./pdf.js');
    const { blob, nombre } = await crearPDF(informeActual, { video: videoActual, graficas: { barras: graficaBarras, trayectoria: graficaTrayectoria }, notas: notasInforme(informeActual),
      textoTrayectoria: textoTrayectoria(informeActual), textoCarga: textoCarga(informeActual), version: VERSION });
    const f = new File([blob], nombre, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: nombre }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    descargarBlob(blob, nombre);
  } catch (e) { console.error(e); alert('No pude crear el PDF: ' + (e.message || e)); }
  finally { b.disabled = false; b.textContent = txt; }
};

// ------------------------------------------------------------------ graficas (canvas)
function lienzo(c) {
  // en el PDF se dibuja en un lienzo fuera de pantalla con tamano fijo y fondo propio
  const fijo = c.dataset && c.dataset.ancho;
  const dpr = fijo ? 2 : window.devicePixelRatio || 1;
  const w = fijo ? +c.dataset.ancho : c.clientWidth || 340, h = fijo ? +c.dataset.alto : c.clientHeight || 190;
  c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (fijo) { ctx.fillStyle = '#141821'; ctx.fillRect(0, 0, w, h); }
  ctx.font = '11px system-ui, Roboto, sans-serif'; return { ctx, w, h };
}
function graficaBarras(c, vals, mvt, parcial) {
  const { ctx, w, h } = lienzo(c);
  const top = Math.max(...vals, mvt) * 1.15, x0 = 34, y0 = h - 22, alto = y0 - 10, ancho = (w - x0 - 6) / vals.length;
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'right';
  for (let k = 0; k <= 4; k++) { const v = top * k / 4, y = y0 - alto * v / top;
    ctx.fillText(v.toFixed(2), x0 - 6, y + 4); ctx.strokeStyle = '#262c3d'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const mejor = Math.max(...vals.filter((v, i) => !parcial[i]), 0);
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

function graficaTrayectoria(c, caminos) {
  const { ctx, w, h } = lienzo(c);
  const colores = ['#5adc78', '#5aa0ff', '#ff9628', '#ec48c8', '#ffd640', '#7fe0e0', '#c99bff', '#ff7b7b'];
  caminos = caminos || [];
  if (!caminos.length) { ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'center'; ctx.fillText('Sin datos de trayectoria', w / 2, h / 2); return; }
  const todos = caminos.flat();
  const ymin = Math.min(0, ...todos.map((p) => p[1])), ymax = Math.max(...todos.map((p) => p[1]));
  const xmax = Math.max(10, ...todos.map((p) => Math.abs(p[0])));
  const altoCm = ymax - ymin || 1, esc = Math.min((h - 30) / altoCm, (w / 2 - 30) / xmax);
  const cx = w / 2, by = h - 18 + ymin * esc;
  ctx.strokeStyle = '#262c3d'; ctx.lineWidth = 1;
  for (let x = -Math.floor(xmax / 5) * 5; x <= xmax; x += 5) { ctx.beginPath(); ctx.moveTo(cx + x * esc, 6); ctx.lineTo(cx + x * esc, h - 16); ctx.stroke(); }
  ctx.setLineDash([6, 5]); ctx.strokeStyle = '#8e95a5'; ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(cx, h - 16); ctx.stroke(); ctx.setLineDash([]);
  caminos.forEach((pts, k) => {
    ctx.strokeStyle = colores[k % colores.length]; ctx.lineWidth = 2.5; ctx.beginPath();
    pts.forEach((p, j) => { const X = cx + p[0] * esc, Y = by - p[1] * esc; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
  });
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'center'; ctx.fillText('← cm horizontales · cada color es una rep →', cx, h - 3);
  ctx.textAlign = 'left'; ctx.fillText(`${Math.round(ymax)} cm`, 4, by - ymax * esc + 4);
}
function graficaPerfil(c, p, e) {
  const { ctx, w, h } = lienzo(c);
  if (!p || p.n < 1) { ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'center'; ctx.fillText('Aún no hay series de este ejercicio', w / 2, h / 2); return; }
  const vmax = Math.max(...p.vels, p.v0 && p.confianza !== 'baja' ? Math.min(p.v0, Math.max(...p.vels) * 1.6) : 0) * 1.1;
  const cmax = Math.max(...p.cargas, p.rm || 0) * 1.1;
  const x0 = 44, y0 = h - 26, aw = w - x0 - 10, ah = y0 - 12;
  const X = (v) => x0 + aw * v / vmax, Y = (c2) => y0 - ah * c2 / cmax;
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'right';
  for (let k = 0; k <= 4; k++) { const c2 = cmax * k / 4, y = Y(c2); ctx.fillText(Math.round(c2), x0 - 6, y + 4);
    ctx.strokeStyle = '#262c3d'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.textAlign = 'center';
  for (let k = 0; k <= 4; k++) { const v = vmax * k / 4; ctx.fillText(v.toFixed(2), X(v), h - 10); }
  ctx.fillText('velocidad de la rep más rápida (m/s) →', x0 + aw / 2, h - 0.5 + 0);
  if (p.a !== undefined) {
    ctx.strokeStyle = p.confianza === 'baja' ? '#6b5a2a' : '#ff9628'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(X(p.mvt), Y(p.a + p.b * p.mvt)); const vf = Math.min(vmax, p.v0); ctx.lineTo(X(vf), Y(Math.max(0, p.a + p.b * vf))); ctx.stroke();
  }
  ctx.fillStyle = '#5aa0ff'; p.cargas.forEach((c2, i) => { ctx.beginPath(); ctx.arc(X(p.vels[i]), Y(c2), 5, 0, 7); ctx.fill(); });
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ff7b7b'; ctx.beginPath(); ctx.moveTo(X(p.mvt), 8); ctx.lineTo(X(p.mvt), y0); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#ff7b7b'; ctx.textAlign = 'left'; ctx.fillText(`MVT ${p.mvt.toFixed(2)}`, X(p.mvt) + 4, 16);
  if (p.rm && p.confianza !== 'baja') { ctx.fillStyle = '#5adc78'; ctx.beginPath(); ctx.arc(X(p.mvt), Y(p.rm), 6, 0, 7); ctx.fill();
    ctx.fillText(`1RM ≈ ${Math.round(p.rm)} kg`, X(p.mvt) + 8, Y(p.rm) + 4); }
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'left'; ctx.fillText(e.perfil === 'corporal' ? 'kg (cuerpo + lastre)' : 'kg', x0 + 4, 10);
}
function graficaSemanas(c, semanas) {
  const { ctx, w, h } = lienzo(c);
  const top = Math.max(1, ...semanas.map((s) => s.tonelaje)) * 1.15, x0 = 46, y0 = h - 22, alto = y0 - 10, ancho = (w - x0 - 6) / semanas.length;
  ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'right';
  for (let k = 0; k <= 3; k++) { const v = top * k / 3, y = y0 - alto * v / top;
    ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + ' t' : Math.round(v), x0 - 6, y + 4); ctx.strokeStyle = '#262c3d'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w, y); ctx.stroke(); }
  semanas.forEach((s, i) => {
    const bh = alto * s.tonelaje / top, x = x0 + i * ancho + ancho * 0.18;
    ctx.fillStyle = i === semanas.length - 1 ? '#5adc78' : '#5aa0ff';
    if (bh > 0) { ctx.beginPath(); ctx.roundRect(x, y0 - bh, ancho * 0.64, bh, 4); ctx.fill(); }
    ctx.fillStyle = '#8e95a5'; ctx.textAlign = 'center';
    ctx.fillText(s.ini.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }).replace('.', ''), x + ancho * 0.32, h - 6);
  });
}

// ------------------------------------------------------------------ historial
let pestana = 'h-sesiones';
document.querySelectorAll('#h-pestanas .chip').forEach((b) => (b.onclick = () => {
  pestana = b.dataset.p;
  document.querySelectorAll('#h-pestanas .chip').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.h-panel').forEach((x) => (x.style.display = x.id === pestana ? '' : 'none'));
  pintarHistorial();
}));
const nombreDe = (r) => (POR_ID[r.ejercicio] || {}).nombre || r.nombre || r.ejercicio;
function pintarHistorial() {
  const lista = hist.leer();
  if (pestana === 'h-sesiones') {
    graficaSemanas($('g-semana'), tonelajeSemanal(lista));
    const ses = agruparSesiones(lista, POR_ID);
    $('h-lista-ses').innerHTML = ses.length ? ses.map((s) => `<div class="sesion">
      <div class="sesion-cab"><strong>${s.fecha.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <small>${s.series.length} series · ${s.reps} reps</small></div>
      <small>${fmt(s.tonelaje)} kg movidos${s.rpeMedio ? ` · RPE medio ${fmt(s.rpeMedio, 1)}` : ''}${s.duracionMin >= 5 ? ` · ${Math.round(s.duracionMin)} min` : ''}</small>
      ${s.ejercicios.map((e) => `<div class="sesion-ej"><b>${esc(e.nombre)}</b>
        ${e.series.map((r, k) => `<div class="serie" data-abrir="${r.id}" role="button"><span>${k + 1}. ${e.perfil === 'corporal' ? (r.carga ? '+' + fmt(r.carga, 1) + ' kg' : 'corporal') : fmt(r.carga, 1) + ' kg'} × ${r.reps}</span>
          <span>${fmt(r.vMejor, 2)} m/s · −${fmt(r.perdida)} % · RPE ${r.rpe ?? '--'}${(r.alertas || []).length ? ' · ⚠' : ''}</span></div>`).join('')}
        ${e.fatiga !== null ? `<div class="fatiga">Tu rep más rápida cayó ${fmt(e.fatiga)} % de la 1.ª a la última serie${e.fatiga > 15 ? ': fatiga acumulada alta.' : '.'}</div>` : ''}
      </div>`).join('')}
    </div>`).join('') : '<p class="vacio">Todavía no hay sesiones. Analiza tu primer video y aparecerá aquí.</p>';
    $('h-lista-ses').querySelectorAll('[data-abrir]').forEach((x) => (x.onclick = () => abrirSerie(x.dataset.abrir, 'v-historial')));
    return;
  }
  if (pestana === 'h-progreso') {
    const usados = [...new Set(lista.map((r) => r.ejercicio))].filter((id) => POR_ID[id]);
    const sel = $('h-ej'), previo = sel.value;
    sel.innerHTML = usados.length ? usados.map((id) => `<option value="${id}">${esc(POR_ID[id].nombre)}</option>`).join('') : '<option>Sin series todavía</option>';
    if (usados.includes(previo)) sel.value = previo; else if (usados.includes(ej.id)) sel.value = ej.id;
    const e = POR_ID[sel.value];
    const delEj = lista.filter((r) => e && r.ejercicio === e.id && r.rm);
    const corporal = e && e.perfil === 'corporal';
    graficaLinea($('g-hist'), delEj.map((r) => ({ x: new Date(r.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }),
      y: corporal ? r.rmLastre : r.rm })), corporal ? '1RM estimado (kg de lastre)' : '1RM estimado (kg)');
    const p = e ? perfilCargaVelocidad(lista, e) : null;
    graficaPerfil($('g-perfil'), p, e || ej);
    const ultimoRM = delEj.length ? (corporal ? delEj[delEj.length - 1].rm : delEj[delEj.length - 1].rm) : null;
    const cal = sugerirCalibracion(p && p.rm && p.confianza !== 'baja' ? p.rm : ultimoRM);
    const guia = cal ? `Para ${p && p.confianza === 'alta' ? 'mantenerlo al día' : 'calibrarlo'}: haz series de 2–3 reps <b>lo más rápido posible</b> con ${cal.map((c) => `${fmt(c.carga, 1)} kg (~${c.pct} %)`).join(', ')}${corporal ? ' de masa total (cuerpo + lastre)' : ''}.` : 'Para calibrarlo: haz series de 2–3 reps lo más rápido posible con 3 pesos distintos (ligero, medio y pesado).';
    const mvtTxt = p ? (p.mvtPersonal ? `Tu velocidad mínima (MVT): <b>${fmt(p.mvt, 2)} m/s</b>, medida en ${p.nFinales} series llevadas cerca del fallo.`
      : `Velocidad mínima (MVT): ${fmt(p.mvt, 2)} m/s (valor promedio). Se personaliza cuando tengas 2 series llevadas cerca del fallo (≥30 % de pérdida y 4+ reps).`) : '';
    $('h-perfil').innerHTML = !p || p.n < 2
      ? `Necesitas series con al menos 2 pesos distintos de este ejercicio. ${guia}`
      : p.confianza === 'baja' ? `Perfil con confianza baja${p.motivo ? ': ' + p.motivo : '.'} ${guia}<br>${mvtTxt}`
      : `<b>1RM ≈ ${fmt(p.rm, 1)} kg</b> · confianza <b>${p.confianza}</b> (${p.n} pesos${p.n >= 3 ? `, ajuste R² ${fmt(p.r2, 2)}` : ''}). Desde ahora tus series de este ejercicio usan este perfil para el 1RM y el RIR.<br>${mvtTxt}<br>${guia}`;
    return;
  }
  $('h-lista').innerHTML = lista.length ? [...lista].reverse().map((r) => {
    const x = POR_ID[r.ejercicio] || { nombre: nombreDe(r), perfil: r.perfil };
    return `<div class="historial-item" data-abrir="${r.id}" role="button"><div><strong>${esc(x.nombre)}</strong>
      <small class="ver">Toca para ver el análisis completo</small>
      <small>${new Date(r.fecha).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })} · ${x.perfil === 'corporal' ? (r.carga ? '+' + fmt(r.carga, 1) + ' kg' : 'peso corporal') : fmt(r.carga, 1) + ' kg'} × ${r.reps} · RPE ${r.rpe ?? '--'}${r.origen === 'vivo' ? ' · en vivo' : ''}</small></div>
      <div class="der"><b>${r.rm ? fmt(x.perfil === 'corporal' ? r.rmLastre : r.rm, 0) + ' kg' : '--'}</b><small>1RM est.</small>
      <button type="button" class="btn-sec peligro" data-borrar="${r.id}" style="padding:3px 8px;margin-top:4px;font-size:11px">Borrar</button></div></div>`;
  }).join('') : '<p class="vacio">Todavía no hay series. Analiza tu primer video y aparecerá aquí.</p>';
  $('h-lista').querySelectorAll('[data-borrar]').forEach((b) => (b.onclick = (ev) => {
    ev.stopPropagation();
    if (confirm('¿Borrar esta serie del historial? También se borran su informe y su video.')) { hist.borrar(b.dataset.borrar); almacen.borrarSerie(b.dataset.borrar); pintarHistorial(); }
  }));
  $('h-lista').querySelectorAll('[data-abrir]').forEach((x) => (x.onclick = () => abrirSerie(x.dataset.abrir, 'v-historial')));
}
$('h-ej').onchange = pintarHistorial;
function descargarBlob(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('h-exportar').onclick = () => descargarBlob(hist.exportar(), `analizador-fuerza-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
$('h-excel').onclick = async () => {
  const lista = hist.leer();
  if (!lista.length) return alert('Todavía no hay series para exportar.');
  const nombre = `analizador-fuerza-${new Date().toISOString().slice(0, 10)}.xlsx`, blob = exportarExcel(lista, POR_ID);
  const f = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'FuerzaPro' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  descargarBlob(blob, nombre);
};
$('h-importar').onclick = () => $('h-archivo').click();
$('h-archivo').onchange = async () => {
  const f = $('h-archivo').files[0]; if (!f) return;
  try { const n = await hist.importar(f); alert(`Se restauraron ${n} series.`); pintarHistorial(); }
  catch (e) { alert('Ese archivo no es una copia de seguridad válida.'); }
  $('h-archivo').value = '';
};

// ------------------------------------------------------------------ modo en vivo
$('btn-vivo').onclick = (e) => {
  e.stopPropagation();
  const d = leerDatos(); if (!d) return;
  vista('v-vivo');
  vivo.abrir({ ej, datos: d, calidad: $('in-calidad').value, alTerminar: (archivoGrabado) => {
    vista('v-form');
    ponerArchivo(archivoGrabado);
    origen = 'vivo';
    analizarArchivo();
  } }).catch((err) => { vista('v-form'); alert(err.message || String(err)); });
};

// ------------------------------------------------------------------ enlace con la pestaña Entrenar
// Una serie del entrenamiento pide su analisis: se elige el ejercicio y se pone el peso (sin la barra).
function analizarDesdeEntreno({ ej: id, kg, serie, nombre }) {
  if (!POR_ID[id]) return;
  elegir(POR_ID[id]);
  if (kg > 0) {
    const carro = usaCarro() ? parseFloat($('in-carro').value || '0') : 0;
    const peso = Math.round((kg - carro) * 100) / 100;
    $('in-peso').value = peso > 0 ? peso : kg;
  }
  vista('v-form');
  aviso(`🎥 Serie ${serie} de ${nombre}${kg > 0 ? ` (${fmt(kg, kg % 1 ? 1 : 0)} kg en total)` : ''}: graba o elige el video y pulsa Analizar. El resultado se guarda en tu entrenamiento.`, true);
}

// ------------------------------------------------------------------ inicio
(function iniciar() {
  if (leer('af_altura')) $('in-altura').value = leer('af_altura');
  if (leer('af_pc')) $('in-pc').value = leer('af_pc');
  if (leer('af_calidad')) $('in-calidad').value = leer('af_calidad');
  $('buscar-ej').oninput = pintarLista;
  pintarElegido(); pintarLista(); ajustarCampos();
  $('version').textContent = `Versión ${VERSION}`;
  nutricion.iniciar();
  perfil.iniciar({ vista, version: VERSION });
  document.querySelectorAll('[data-volver]').forEach((b) => (b.onclick = () => vista(b.dataset.volver)));
  entrenar.iniciar({ ejercicios: EJERCICIOS, porId: POR_ID, vista, analizar: analizarDesdeEntreno, abrirSerie: (id) => abrirSerie(id, 'v-entrenar') }).then(() => entrenar.alCambiarVista('v-entrenar'));
  // la app se mudo a Cloudflare: en la direccion vieja se indica como llevarse los datos
  if (location.hostname.endsWith('github.io')) {
    const a = $('aviso');
    a.innerHTML = '📦 <b>FuerzaPro se mudó a <a href="https://fuerzapro.pages.dev" style="color:inherit">fuerzapro.pages.dev</a></b>. Para llevar tus datos: aquí ve a Perfil → 💾 Guardar respaldo; luego abre la nueva dirección, instálala y usa Perfil → ♻️ Restaurar.';
    a.style.display = 'block'; a.classList.add('ok');
  }
  if (!('VideoEncoder' in window) && !('MediaRecorder' in window)) aviso('Tu navegador no puede crear el video con telemetría, pero sí el análisis. Usa Chrome actualizado.');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
