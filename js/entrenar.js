// Pestaña Entrenar: registro de entrenamientos estilo Hevy (series, peso, reps, RPE, descanso),
// con enlace opcional al analisis por video de cada serie e importacion desde Hevy, Strong o Excel.
import * as almacen from './almacen.js';
import { leerArchivo, convertir } from './importar.js';
import { crearExcel } from './excel.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const kgTxt = (x) => (Number.isFinite(x) ? fmt(x, x % 1 ? 1 : 0) : '');
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const guardarLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
const leerLS = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const TIPOS = { normal: '', calentamiento: 'C', fallo: 'F', drop: 'D' };
const NOMBRE_TIPO = { normal: 'Normal', calentamiento: 'Calentamiento', fallo: 'Al fallo', drop: 'Drop set' };
const BORRADOR = 'af_entreno_activo';

let deps = null;        // { ejercicios, porId, vista, analizar, abrirSerie }
let lista = [];         // entrenamientos guardados (mas reciente primero)
let activo = null;      // entrenamiento en curso
let vistaActual = '';
let reloj = null, audio = null;
export let enlacePendiente = null; // serie que espera su analisis por video

// ------------------------------------------------------------------ utilidades de datos
const nombreEj = (e) => (e.ej && deps.porId[e.ej] ? deps.porId[e.ej].nombre : e.nombre);
const iconoEj = (e) => (e.ej && deps.porId[e.ej] ? deps.porId[e.ej].icono : '🏋️');
const mismoEj = (a, b) => (a.ej && b.ej ? a.ej === b.ej : norm(a.nombre) === norm(b.nombre));
const cuenta = (s) => s.hecha && s.tipo !== 'calentamiento';
const volumen = (en) => en.ejercicios.reduce((a, e) => a + e.series.filter(cuenta).reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
const seriesHechas = (en) => en.ejercicios.reduce((a, e) => a + e.series.filter(cuenta).length, 0);
function duracion(ms) {
  if (!(ms > 0)) return '';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}
const reloj2 = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function fechaTxt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
    + ' · ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}
function anterior(e, excluir = null) {
  for (const en of lista) {
    if (en.id === excluir) continue;
    const x = en.ejercicios.find((y) => mismoEj(y, e));
    if (x) return x.series;
  }
  return null;
}
function guardarBorrador() { if (activo) guardarLS(BORRADOR, JSON.stringify(activo)); }
const serieVacia = (tipo = 'normal') => ({ kg: null, reps: null, rpe: null, tipo, hecha: false });

// ------------------------------------------------------------------ inicio
export async function iniciar(d) {
  deps = d;
  // pide al navegador no borrar los datos de la app aunque el telefono se quede sin espacio
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  try { activo = JSON.parse(leerLS(BORRADOR) || 'null'); } catch (e) { activo = null; }
  lista = (await almacen.leerEntrenos()).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  $('en-empezar').onclick = () => empezar();
  $('en-importar').onclick = () => $('en-archivo').click();
  $('en-archivo').onchange = importarArchivo;
  $('en-plantilla').onclick = () => compartir(plantilla(), 'plantilla-entrenamientos.xlsx');
  $('en-exportar').onclick = () => { if (!lista.length) return alert('Todavía no hay entrenamientos.'); compartir(exportar(), `entrenamientos-${new Date().toISOString().slice(0, 10)}.xlsx`); };
  $('en-terminar').onclick = terminar;
  $('en-descartar').onclick = () => { if (confirm('¿Descartar este entrenamiento? Se pierde lo registrado.')) cerrarActivo(); };
  $('en-agregar').onclick = () => abrirSelector();
  $('en-titulo').oninput = () => { activo.titulo = $('en-titulo').value; guardarBorrador(); };
  $('en-descanso').value = leerLS('af_descanso') || '120';
  $('en-descanso').onchange = () => guardarLS('af_descanso', $('en-descanso').value);
  $('en-barra').onclick = () => deps.vista('v-entrenar');
  $('en-buscar').oninput = pintarSelector;
  $('en-sel-cerrar').onclick = () => { $('en-selector').style.display = 'none'; };
  $('en-det-cerrar').onclick = () => { $('en-detalle').style.display = 'none'; };
  $('en-hoja').onclick = (ev) => { if (ev.target.id === 'en-hoja') $('en-hoja').style.display = 'none'; };
  $('desc-menos').onclick = () => ajustarDescanso(-15);
  $('desc-mas').onclick = () => ajustarDescanso(15);
  $('desc-saltar').onclick = () => { if (activo) { activo.descanso = null; guardarBorrador(); tic(); } };
  if (activo) arrancarReloj();
  pintar();
}

export function alCambiarVista(id) {
  vistaActual = id;
  if (id === 'v-entrenar') pintar();
  tic();
}

export function pintar() {
  $('en-inicio').style.display = activo ? 'none' : '';
  $('en-activo').style.display = activo ? '' : 'none';
  if (activo) pintarActivo(); else pintarInicio();
}

// ------------------------------------------------------------------ pantalla de inicio e historial
function pintarInicio() {
  const lunes = new Date(); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const semana = lista.filter((e) => new Date(e.inicio) >= lunes);
  $('en-semana').innerHTML = `<div class="kpi-card"><div class="kpi-label">Esta semana</div><div class="kpi-value">${semana.length}</div><div class="kpi-sub">entrenamientos</div></div>
    <div class="kpi-card"><div class="kpi-label">Series</div><div class="kpi-value">${semana.reduce((a, e) => a + seriesHechas(e), 0)}</div><div class="kpi-sub">efectivas</div></div>
    <div class="kpi-card"><div class="kpi-label">Volumen</div><div class="kpi-value">${fmt(semana.reduce((a, e) => a + volumen(e), 0) / 1000, 1)}</div><div class="kpi-sub">toneladas</div></div>`;
  $('en-lista').innerHTML = lista.length ? lista.slice(0, 60).map((en) => `<div class="en-tarjeta" data-id="${en.id}" role="button">
      <div class="en-tarjeta-cab"><strong>${esc(en.titulo || 'Entrenamiento')}</strong><small>${fechaTxt(en.inicio)}${en.fin ? ' · ' + duracion(new Date(en.fin) - new Date(en.inicio)) : ''}</small></div>
      <div class="en-tarjeta-datos"><span>${fmt(volumen(en))} kg</span><span>${seriesHechas(en)} series</span>${en.origen && en.origen !== 'app' ? `<span class="en-origen">${esc(en.origen === 'hevy' ? 'Hevy' : en.origen === 'strong' ? 'Strong' : 'Excel')}</span>` : ''}</div>
      <div class="en-tarjeta-ej">${en.ejercicios.slice(0, 5).map((e) => `${e.series.filter(cuenta).length} × ${esc(nombreEj(e))}`).join('<br>')}${en.ejercicios.length > 5 ? `<br><small>+${en.ejercicios.length - 5} más</small>` : ''}</div>
    </div>`).join('') + (lista.length > 60 ? `<p class="vacio">Mostrando los 60 más recientes de ${lista.length}.</p>` : '')
    : '<p class="vacio">Aún no registras entrenamientos. Empieza uno o importa tu historial de Hevy.</p>';
  $('en-lista').querySelectorAll('.en-tarjeta').forEach((x) => (x.onclick = () => abrirDetalle(x.dataset.id)));
}

function abrirDetalle(id, nuevo = false) {
  const en = lista.find((x) => x.id === id); if (!en) return;
  $('en-det-cuerpo').innerHTML = `${nuevo ? '<div class="en-ok">✅ ¡Entrenamiento guardado!</div>' : ''}
    <h3 class="en-det-titulo">${esc(en.titulo || 'Entrenamiento')}</h3>
    <p class="hint" style="margin-top:2px">${fechaTxt(en.inicio)}${en.fin ? ' · ' + duracion(new Date(en.fin) - new Date(en.inicio)) : ''} · ${fmt(volumen(en))} kg · ${seriesHechas(en)} series</p>
    ${en.ejercicios.map((e) => `<div class="en-det-ej"><strong>${iconoEj(e)} ${esc(nombreEj(e))}</strong>${e.ej && deps.porId[e.ej] && norm(e.nombre) !== norm(deps.porId[e.ej].nombre) ? `<small> (${esc(e.nombre)})</small>` : ''}
      ${e.series.map((s, i) => `<div class="en-det-serie${s.tipo === 'calentamiento' ? ' cal' : ''}"><span>${TIPOS[s.tipo] || i + 1 - e.series.slice(0, i).filter((x) => x.tipo === 'calentamiento').length}</span>
        <span>${kgTxt(s.kg) || '—'} kg × ${s.reps ?? '—'}${s.rpe ? ` @${fmt(s.rpe, s.rpe % 1 ? 1 : 0)}` : ''}</span>
        ${s.analisis ? `<button type="button" class="en-vel" data-serie="${s.analisis.id}">⚡ ${fmt(s.analisis.v, 2)} m/s</button>` : ''}</div>`).join('')}</div>`).join('')}
    <div class="en-det-botones"><button type="button" class="btn-sec" id="en-repetir">🔁 Repetir</button><button type="button" class="btn-sec peligro" id="en-borrar">Borrar</button></div>`;
  $('en-detalle').style.display = 'flex';
  $('en-det-cuerpo').querySelectorAll('[data-serie]').forEach((b) => (b.onclick = () => { $('en-detalle').style.display = 'none'; deps.abrirSerie(b.dataset.serie); }));
  $('en-repetir').onclick = () => {
    if (activo && !confirm('Ya tienes un entrenamiento en curso. ¿Reemplazarlo?')) return;
    $('en-detalle').style.display = 'none';
    empezar({ titulo: en.titulo, ejercicios: en.ejercicios.map((e) => ({ ej: e.ej, nombre: e.nombre, notas: '', series: e.series.map((s) => serieVacia(s.tipo)) })) });
  };
  $('en-borrar').onclick = async () => {
    if (!confirm('¿Borrar este entrenamiento?')) return;
    await almacen.borrarEntreno(en.id); lista = lista.filter((x) => x.id !== en.id);
    $('en-detalle').style.display = 'none'; pintar();
  };
}

// ------------------------------------------------------------------ entrenamiento en curso
function empezar(base = null) {
  const h = new Date().getHours();
  activo = { id: 'e-' + Date.now(), inicio: new Date().toISOString(), origen: 'app',
    titulo: base?.titulo || (h < 12 ? 'Entrenamiento de la mañana' : h < 19 ? 'Entrenamiento de la tarde' : 'Entrenamiento de la noche'),
    ejercicios: base?.ejercicios || [], descanso: null };
  guardarBorrador(); arrancarReloj();
  deps.vista('v-entrenar'); pintar();
  if (!activo.ejercicios.length) abrirSelector();
}
function cerrarActivo() {
  activo = null; enlacePendiente = null;
  try { localStorage.removeItem(BORRADOR); } catch (e) { /* nada */ }
  clearInterval(reloj); reloj = null; tic(); pintar();
}

function pintarActivo() {
  $('en-titulo').value = activo.titulo || '';
  $('en-ejercicios').innerHTML = activo.ejercicios.map((e, ie) => {
    const prev = anterior(e, activo.id) || [];
    let nNormal = 0;
    return `<div class="en-ej" data-ie="${ie}">
      <div class="en-ej-cab"><span class="en-ej-icono">${iconoEj(e)}</span><strong>${esc(nombreEj(e))}</strong>
        <button type="button" class="en-mini" data-acc="subir" title="Subir">↑</button><button type="button" class="en-mini" data-acc="quitar" title="Quitar">✕</button></div>
      <input class="en-nota" data-acc="nota" placeholder="Nota (opcional)" value="${esc(e.notas || '')}">
      <div class="en-fila en-fila-cab"><span>Serie</span><span>Anterior</span><span>kg</span><span>Reps</span><span>RPE</span><span>✓</span><span>🎥</span></div>
      ${e.series.map((s, is) => {
        const etiqueta = TIPOS[s.tipo] || String(++nNormal);
        const p = prev[is];
        const ptxt = p && (p.kg || p.reps) ? `${kgTxt(p.kg) || 0} × ${p.reps ?? 0}` : '—';
        return `<div class="en-fila${s.hecha ? ' hecha' : ''}" data-is="${is}">
          <button type="button" class="en-num t-${s.tipo}" data-acc="tipo">${etiqueta}</button>
          <button type="button" class="en-prev" data-acc="copiar">${ptxt}</button>
          <input type="number" inputmode="decimal" step="any" min="0" data-campo="kg" value="${s.kg ?? ''}" placeholder="${p && p.kg != null ? kgTxt(p.kg) : ''}">
          <input type="number" inputmode="numeric" step="1" min="0" data-campo="reps" value="${s.reps ?? ''}" placeholder="${p && p.reps != null ? p.reps : ''}">
          <input type="number" inputmode="decimal" step="0.5" min="1" max="10" data-campo="rpe" value="${s.rpe ?? ''}" placeholder="${p && p.rpe ? p.rpe : ''}">
          <button type="button" class="en-check" data-acc="hecha">✓</button>
          <button type="button" class="en-video${s.analisis ? ' con' : ''}" data-acc="video" title="Analizar con video">${s.analisis ? '⚡' : '🎥'}</button>
        </div>${s.analisis ? `<button type="button" class="en-analisis" data-acc="ver" data-is="${is}">⚡ ${fmt(s.analisis.v, 2)} m/s${s.analisis.rpe ? ` · RPE ${fmt(s.analisis.rpe, 1)}` : ''}${s.analisis.rm ? ` · 1RM ≈ ${fmt(s.analisis.rm)} kg` : ''} · ver análisis</button>` : ''}`;
      }).join('')}
      <button type="button" class="btn-sec en-mas-serie" data-acc="serie">+ Agregar serie</button>
    </div>`;
  }).join('') || '<p class="vacio">Agrega tu primer ejercicio.</p>';
  enlazarEventos();
  tic();
}

function enlazarEventos() {
  $('en-ejercicios').querySelectorAll('.en-ej').forEach((caja) => {
    const ie = +caja.dataset.ie, e = activo.ejercicios[ie];
    caja.querySelectorAll('input[data-campo]').forEach((inp) => {
      inp.oninput = () => {
        const s = e.series[+inp.closest('.en-fila').dataset.is], v = inp.value === '' ? null : parseFloat(inp.value.replace(',', '.'));
        s[inp.dataset.campo] = Number.isFinite(v) ? v : null;
        guardarBorrador(); tic();
      };
    });
    caja.querySelector('[data-acc="nota"]').oninput = (ev) => { e.notas = ev.target.value; guardarBorrador(); };
    caja.querySelectorAll('button[data-acc]').forEach((b) => (b.onclick = () => accion(b.dataset.acc, ie, b.closest('.en-fila') ? +b.closest('.en-fila').dataset.is : +b.dataset.is)));
  });
}

function accion(acc, ie, is) {
  const e = activo.ejercicios[ie], s = e && e.series[is];
  const prev = (anterior(e, activo.id) || [])[is];
  if (acc === 'quitar') { if (!confirm(`¿Quitar ${nombreEj(e)} del entrenamiento?`)) return; activo.ejercicios.splice(ie, 1); }
  else if (acc === 'subir') { if (ie === 0) return; activo.ejercicios.splice(ie - 1, 0, activo.ejercicios.splice(ie, 1)[0]); }
  else if (acc === 'serie') { const u = e.series[e.series.length - 1]; e.series.push({ ...serieVacia(u && u.tipo !== 'calentamiento' ? u.tipo : 'normal'), kg: u ? u.kg : null, reps: u ? u.reps : null }); }
  else if (acc === 'copiar') { if (!prev) return; s.kg = prev.kg; s.reps = prev.reps; if (prev.rpe) s.rpe = prev.rpe; }
  else if (acc === 'tipo') return elegirTipo(e, is);
  else if (acc === 'hecha') {
    s.hecha = !s.hecha;
    if (s.hecha) {
      if (s.kg == null && prev && prev.kg != null) s.kg = prev.kg;
      if (s.reps == null && prev && prev.reps != null) s.reps = prev.reps;
      if (!(s.reps > 0) && !(s.kg > 0)) { s.hecha = false; alert('Escribe el peso y las repeticiones de la serie.'); return; }
      iniciarDescanso();
      if (navigator.vibrate) navigator.vibrate(40);
    }
  } else if (acc === 'video') {
    if (s.analisis) return deps.abrirSerie(s.analisis.id);
    if (!e.ej || !deps.porId[e.ej]) return alert('Este ejercicio no está en la biblioteca de análisis por video. Elige uno de la lista para poder analizarlo.');
    const kg = s.kg ?? (prev ? prev.kg : null);
    enlacePendiente = { entreno: activo.id, ie, is, ej: e.ej };
    deps.analizar({ ej: e.ej, kg, serie: is + 1, nombre: nombreEj(e) });
    return;
  } else if (acc === 'ver') { if (s.analisis) deps.abrirSerie(s.analisis.id); return; }
  guardarBorrador(); pintarActivo();
}

function elegirTipo(e, is) {
  const hoja = $('en-hoja');
  hoja.innerHTML = `<div class="en-hoja-caja">${Object.keys(NOMBRE_TIPO).map((t) => `<button type="button" data-t="${t}" class="${e.series[is].tipo === t ? 'activo' : ''}"><b class="en-num t-${t}">${TIPOS[t] || '1'}</b> ${NOMBRE_TIPO[t]}</button>`).join('')}
    <button type="button" data-t="borrar" class="peligro">🗑️ Borrar serie</button></div>`;
  hoja.style.display = 'flex';
  hoja.querySelectorAll('button').forEach((b) => (b.onclick = () => {
    if (b.dataset.t === 'borrar') e.series.splice(is, 1); else e.series[is].tipo = b.dataset.t;
    hoja.style.display = 'none'; guardarBorrador(); pintarActivo();
  }));
}

// ------------------------------------------------------------------ selector de ejercicios
function abrirSelector() {
  $('en-buscar').value = ''; $('en-selector').style.display = 'flex'; pintarSelector();
  setTimeout(() => $('en-buscar').focus({ preventScroll: true }), 50);
}
function recientes() {
  const vistos = [], claves = new Set();
  for (const en of lista) for (const e of en.ejercicios) {
    const k = e.ej || 'n:' + norm(e.nombre);
    if (!claves.has(k)) { claves.add(k); vistos.push({ ej: e.ej, nombre: e.nombre }); }
    if (vistos.length >= 10) return vistos;
  }
  return vistos;
}
function pintarSelector() {
  const q = norm($('en-buscar').value), pal = q.split(/\s+/).filter(Boolean);
  const pasa = (texto) => pal.every((w) => norm(texto).includes(w));
  const rec = recientes().filter((r) => pasa(r.ej && deps.porId[r.ej] ? `${deps.porId[r.ej].nombre} ${deps.porId[r.ej].en}` : r.nombre));
  const bib = deps.ejercicios.filter((e) => pasa([e.nombre, e.grupo, e.equipo, e.musculo, e.en].join(' ')));
  const item = (ej, nombre, sub, icono) => `<button type="button" class="en-sel-item" data-ej="${ej || ''}" data-nombre="${esc(nombre)}"><span>${icono}</span><span><b>${esc(nombre)}</b><small>${esc(sub)}</small></span></button>`;
  $('en-sel-lista').innerHTML = (rec.length ? `<div class="en-sel-grupo">Recientes</div>${rec.map((r) => {
    const x = r.ej && deps.porId[r.ej]; return item(r.ej, x ? x.nombre : r.nombre, x ? x.equipo || x.grupo : 'Sin análisis por video', x ? x.icono : '🏋️');
  }).join('')}` : '')
    + `<div class="en-sel-grupo">Biblioteca</div>${bib.map((e) => item(e.id, e.nombre, [e.grupo, e.equipo].filter(Boolean).join(' · '), e.icono)).join('')}`
    + (q ? `<button type="button" class="en-sel-item nuevo" data-ej="" data-nombre="${esc($('en-buscar').value.trim())}"><span>➕</span><span><b>Usar «${esc($('en-buscar').value.trim())}»</b><small>Ejercicio nuevo (solo registro, sin análisis por video)</small></span></button>` : '');
  $('en-sel-lista').querySelectorAll('.en-sel-item').forEach((b) => (b.onclick = () => agregarEjercicio(b.dataset.ej || null, b.dataset.nombre)));
}
function agregarEjercicio(ej, nombre) {
  const e = { ej, nombre: ej && deps.porId[ej] ? deps.porId[ej].nombre : nombre, notas: '', series: [] };
  const prev = anterior(e, activo.id);
  e.series = prev && prev.length ? prev.map((s) => serieVacia(s.tipo)) : [serieVacia(), serieVacia(), serieVacia()];
  activo.ejercicios.push(e);
  $('en-selector').style.display = 'none';
  guardarBorrador(); pintarActivo();
  setTimeout(() => { const c = $('en-ejercicios').lastElementChild; if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}

// ------------------------------------------------------------------ descanso y reloj
function iniciarDescanso() {
  const seg = parseInt($('en-descanso').value, 10) || 0;
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* sin audio */ }
  activo.descanso = seg ? { fin: Date.now() + seg * 1000, total: seg } : null;
}
function ajustarDescanso(d) {
  if (!activo || !activo.descanso) return;
  activo.descanso.fin += d * 1000; activo.descanso.total = Math.max(15, activo.descanso.total + d);
  guardarBorrador(); tic();
}
function pitido() {
  if (!audio) return;
  for (let k = 0; k < 3; k++) {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + k * 0.25;
    o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  }
}
function arrancarReloj() { clearInterval(reloj); reloj = setInterval(tic, 1000); }
function tic() {
  const barra = $('en-barra'), desc = $('en-desc');
  if (!activo) { barra.style.display = 'none'; desc.style.display = 'none'; return; }
  const trans = reloj2((Date.now() - new Date(activo.inicio)) / 1000);
  let resta = null;
  if (activo.descanso) {
    resta = Math.ceil((activo.descanso.fin - Date.now()) / 1000);
    if (resta <= 0) {
      activo.descanso = null; guardarBorrador(); resta = null;
      pitido(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }
  $('en-tiempo').textContent = trans;
  $('en-vol').textContent = `${fmt(volumen(activo))} kg`;
  $('en-nser').textContent = seriesHechas(activo);
  desc.style.display = resta !== null && vistaActual === 'v-entrenar' ? 'flex' : 'none';
  if (resta !== null) {
    $('desc-txt').textContent = reloj2(resta);
    $('desc-barra').style.width = `${Math.max(0, Math.min(100, 100 * resta / activo.descanso.total))}%`;
  }
  barra.style.display = vistaActual !== 'v-entrenar' ? 'flex' : 'none';
  barra.innerHTML = `<span>🏋️ <b>${esc(activo.titulo || 'Entrenamiento')}</b> · ${trans}${resta !== null ? ` · descanso <b>${reloj2(resta)}</b>` : ''}</span><b class="en-volver">Volver ›</b>`;
}

async function terminar() {
  const sinMarcar = activo.ejercicios.reduce((a, e) => a + e.series.filter((s) => !s.hecha && (s.kg > 0 || s.reps > 0)).length, 0);
  if (sinMarcar) {
    if (confirm(`Tienes ${sinMarcar} serie${sinMarcar > 1 ? 's' : ''} con datos sin marcar ✓.\n\nAceptar = marcarlas como hechas\nCancelar = descartarlas`))
      activo.ejercicios.forEach((e) => e.series.forEach((s) => { if (!s.hecha && (s.kg > 0 || s.reps > 0)) s.hecha = true; }));
  }
  const ejercicios = activo.ejercicios.map((e) => ({ ...e, series: e.series.filter((s) => s.hecha) })).filter((e) => e.series.length);
  if (!ejercicios.length) {
    if (confirm('No hay ninguna serie hecha. ¿Descartar el entrenamiento?')) cerrarActivo();
    return;
  }
  const en = { id: activo.id, titulo: activo.titulo || 'Entrenamiento', inicio: activo.inicio, fin: new Date().toISOString(), origen: 'app', ejercicios };
  try { await almacen.guardarEntreno(en); } catch (e) { alert('No pude guardar el entrenamiento: ' + (e.message || e)); return; }
  lista = [en, ...lista.filter((x) => x.id !== en.id)].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  cerrarActivo();
  abrirDetalle(en.id, true);
}

// el analisis por video de una serie termino: se guarda en esa serie del entrenamiento
export function vincular(registro) {
  const p = enlacePendiente; enlacePendiente = null;
  if (!p || !activo || activo.id !== p.entreno || registro.ejercicio !== p.ej) return false;
  const e = activo.ejercicios[p.ie], s = e && e.series[p.is];
  if (!s) return false;
  s.analisis = { id: registro.id, v: registro.vMejor, rpe: registro.rpe ?? null, rm: registro.rm ?? null };
  if (s.kg == null) s.kg = registro.carga;
  if (s.reps == null) s.reps = registro.repsValidas ?? registro.reps;
  if (s.rpe == null && registro.rpe) s.rpe = registro.rpe;
  guardarBorrador();
  return true;
}

// ------------------------------------------------------------------ importar y exportar
async function importarArchivo() {
  const f = $('en-archivo').files[0]; $('en-archivo').value = '';
  if (!f) return;
  try {
    const tablas = await leerArchivo(f);
    const r = convertir(tablas, deps.ejercicios, { unidad: $('en-unidad').value });
    const minuto = (iso) => Math.floor(new Date(iso).getTime() / 60000);
    const existentes = new Set(lista.map((e) => `${minuto(e.inicio)}|${norm(e.titulo)}`));
    const nuevos = r.entrenos.filter((e) => !existentes.has(`${minuto(e.inicio)}|${norm(e.titulo)}`) || lista.some((x) => x.id === e.id));
    if (!nuevos.length) return alert(r.entrenos.length ? 'Esos entrenamientos ya estaban importados.' : 'No encontré series con peso o repeticiones en el archivo.');
    const desde = new Date(nuevos[nuevos.length - 1].inicio).toLocaleDateString('es-EC'), hasta = new Date(nuevos[0].inicio).toLocaleDateString('es-EC');
    const fuente = r.origen === 'hevy' ? 'Hevy' : r.origen === 'strong' ? 'Strong' : 'Excel/CSV';
    const sp = r.sinPareja.length ? `\n\n${r.sinPareja.length} ejercicio${r.sinPareja.length > 1 ? 's' : ''} no está${r.sinPareja.length > 1 ? 'n' : ''} en la biblioteca (se guardan con su nombre, sin análisis por video): ${r.sinPareja.slice(0, 8).join(', ')}${r.sinPareja.length > 8 ? '…' : ''}` : '';
    if (!confirm(`Archivo de ${fuente}: ${nuevos.length} entrenamientos (${desde} – ${hasta}), ${nuevos.reduce((a, e) => a + e.ejercicios.reduce((b, x) => b + x.series.length, 0), 0)} series.${r.lb ? '\nPesos convertidos de libras a kg.' : ''}${sp}\n\n¿Importar?`)) return;
    await almacen.guardarEntrenos(nuevos);
    const ids = new Set(nuevos.map((e) => e.id));
    lista = [...nuevos, ...lista.filter((x) => !ids.has(x.id))].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
    pintar();
    alert(`Listo: se importaron ${nuevos.length} entrenamientos.`);
  } catch (e) {
    console.error(e);
    alert(e.message || 'No pude leer ese archivo.');
  }
}
const COLS = [{ titulo: 'Fecha', ancho: 17 }, { titulo: 'Entrenamiento', ancho: 26 }, { titulo: 'Ejercicio', ancho: 30 }, { titulo: 'Serie', ancho: 7, decimales: 0 },
  { titulo: 'Tipo', ancho: 14 }, { titulo: 'Peso (kg)', ancho: 10, decimales: 1 }, { titulo: 'Reps', ancho: 7, decimales: 0 }, { titulo: 'RPE', ancho: 7, decimales: 1 }];
function exportar() {
  const filas = [...lista].reverse().flatMap((en) => en.ejercicios.flatMap((e) => e.series.map((s, i) => [new Date(en.inicio), en.titulo, nombreEj(e), i + 1,
    NOMBRE_TIPO[s.tipo] || 'Normal', s.kg, s.reps, s.rpe, s.analisis ? s.analisis.v : null, s.analisis ? s.analisis.rm : null])));
  return crearExcel([{ nombre: 'Entrenamientos', columnas: [...COLS, { titulo: 'Vel. video (m/s)', ancho: 15, decimales: 2 }, { titulo: '1RM video (kg)', ancho: 14, decimales: 1 }], filas }]);
}
function plantilla() {
  const d = new Date(); d.setHours(18, 0, 0, 0);
  return crearExcel([{ nombre: 'Entrenamientos', columnas: COLS, filas: [
    [d, 'Pierna', 'Sentadilla con barra', 1, 'Calentamiento', 60, 8, null], [d, 'Pierna', 'Sentadilla con barra', 2, 'Normal', 140, 5, 8],
    [d, 'Pierna', 'Sentadilla con barra', 3, 'Normal', 140, 5, 8.5], [d, 'Pierna', 'Peso muerto rumano', 1, 'Normal', 100, 8, 7]] }]);
}
async function compartir(blob, nombre) {
  const f = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Analizador de Fuerza' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
