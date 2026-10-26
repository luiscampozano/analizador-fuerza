// Pestaña Entrenar: registro de entrenamientos estilo Hevy (series, peso, reps, RPE, descanso),
// rutinas, records personales, progreso por ejercicio, cargas sugeridas por RPE y calculadora de discos,
// con enlace opcional al analisis por video de cada serie e importacion desde Hevy, Strong o Excel.
import * as almacen from './almacen.js';
import { leerArchivo, convertir } from './importar.js';
import { crearExcel } from './excel.js';
import * as P from './progreso.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const kgTxt = (x) => (Number.isFinite(x) ? fmt(x, Math.abs(x * 10 - Math.round(x * 10)) > 1e-6 ? 2 : x % 1 ? 1 : 0) : '');
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const guardarLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
const leerLS = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const TIPOS = { normal: '', calentamiento: 'C', fallo: 'F', drop: 'D' };
const NOMBRE_TIPO = { normal: 'Normal', calentamiento: 'Calentamiento', fallo: 'Al fallo', drop: 'Drop set' };
const BORRADOR = 'af_entreno_activo', RUTINAS = 'af_rutinas';
const COLOR_DISCO = { 25: '#e53935', 20: '#1e63d6', 15: '#f2c200', 10: '#2e9b4a', 5: '#e8e8e8', 2.5: '#222', 1.25: '#9aa0a6', 0.5: '#b0b6bd' };

let deps = null;        // { ejercicios, porId, vista, analizar, abrirSerie }
let lista = [];         // entrenamientos guardados (mas reciente primero)
let rutinas = [];
let activo = null;      // entrenamiento (o rutina en edicion) en curso
let vistaActual = '';
let reloj = null, audio = null, ultimoKg = null;
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
function fechaTxt(iso, hora = true) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { weekday: hora ? 'short' : undefined, day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
    + (hora ? ' · ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '');
}
const diaLocal = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function anterior(e, excluir = null) {
  for (const en of lista) {
    if (en.id === excluir) continue;
    const x = en.ejercicios.find((y) => mismoEj(y, e));
    if (x) return x.series;
  }
  return null;
}
function guardarBorrador() { if (activo) guardarLS(BORRADOR, JSON.stringify(activo)); }
const serieVacia = (tipo = 'normal', obj = null) => ({ kg: null, reps: null, rpe: null, tipo, hecha: false, ...(obj ? { obj } : {}) });
function guardarRutinas() { guardarLS(RUTINAS, JSON.stringify(rutinas)); }
const ref = (e) => (activo && activo.rutina ? null : P.referencia(lista, e, e.series));

// valores sugeridos de una serie (se muestran en gris y se usan al marcar ✓ si la casilla esta vacia)
function marcadores(e, is, prev, r) {
  const s = e.series[is], p = prev[is], o = s.obj || {};
  const reps = s.reps ?? o.reps ?? (p ? p.reps : null), rpe = s.rpe ?? o.rpe ?? null;
  let kg = null, sug = false;
  if (r && reps > 0 && rpe && s.tipo !== 'calentamiento') { kg = P.redondear(P.cargaPara(r.kg, reps, rpe)); sug = true; }
  else kg = o.kg ?? (p ? p.kg : null);
  return { kg, reps: o.reps ?? (p ? p.reps : null), rpe: o.rpe ?? null, sug };
}

// ------------------------------------------------------------------ inicio
export async function iniciar(d) {
  deps = d;
  // pide al navegador no borrar los datos de la app aunque el telefono se quede sin espacio
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  try { activo = JSON.parse(leerLS(BORRADOR) || 'null'); } catch (e) { activo = null; }
  try { rutinas = JSON.parse(leerLS(RUTINAS) || '[]'); } catch (e) { rutinas = []; }
  lista = (await almacen.leerEntrenos()).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  $('en-empezar').onclick = () => empezar();
  $('en-nueva-rutina').onclick = () => editarRutina(null);
  $('en-discos').onclick = () => abrirDiscos();
  $('en-discos2').onclick = () => abrirDiscos(ultimoKg);
  $('en-importar').onclick = () => $('en-archivo').click();
  $('en-archivo').onchange = importarArchivo;
  $('en-plantilla').onclick = () => compartir(plantilla(), 'plantilla-entrenamientos.xlsx');
  $('en-exportar').onclick = () => { if (!lista.length) return alert('Todavía no hay entrenamientos.'); compartir(exportar(), `entrenamientos-${new Date().toISOString().slice(0, 10)}.xlsx`); };
  $('en-terminar').onclick = terminar;
  $('en-descartar').onclick = () => {
    if (confirm(activo.rutina ? '¿Salir sin guardar los cambios de la rutina?' : '¿Descartar este entrenamiento? Se pierde lo registrado.')) cerrarActivo();
  };
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
  if (activo && !activo.rutina) arrancarReloj();
  pintar();
}

export function alCambiarVista(id) {
  vistaActual = id;
  if (id === 'v-entrenar') pintar();
  tic();
}

// 1RM real del ejercicio (lo usa tambien el analisis por video)
export const rmRealDe = (ejId) => { const r = P.rmReal(ejId); return r ? r.kg : null; };

export function pintar() {
  $('en-inicio').style.display = activo ? 'none' : '';
  $('en-activo').style.display = activo ? '' : 'none';
  if (activo) pintarActivo(); else pintarInicio();
}

// ------------------------------------------------------------------ pantalla de inicio
function pintarInicio() {
  const lunes = new Date(); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const semana = lista.filter((e) => new Date(e.inicio) >= lunes);
  $('en-semana').innerHTML = `<div class="kpi-card"><div class="kpi-label">Esta semana</div><div class="kpi-value">${semana.length}</div><div class="kpi-sub">entrenamientos</div></div>
    <div class="kpi-card"><div class="kpi-label">Series</div><div class="kpi-value">${semana.reduce((a, e) => a + seriesHechas(e), 0)}</div><div class="kpi-sub">efectivas</div></div>
    <div class="kpi-card"><div class="kpi-label">Volumen</div><div class="kpi-value">${fmt(semana.reduce((a, e) => a + volumen(e), 0) / 1000, 1)}</div><div class="kpi-sub">toneladas</div></div>`;
  pintarRutinas(); pintarCalendario(lunes); pintarMusculos(); pintarEjercicios();
  $('en-lista').innerHTML = lista.length ? lista.slice(0, 60).map((en) => `<div class="en-tarjeta" data-id="${en.id}" role="button">
      <div class="en-tarjeta-cab"><strong>${esc(en.titulo || 'Entrenamiento')}</strong><small>${fechaTxt(en.inicio)}${en.fin ? ' · ' + duracion(new Date(en.fin) - new Date(en.inicio)) : ''}</small></div>
      <div class="en-tarjeta-datos"><span>${fmt(volumen(en))} kg</span><span>${seriesHechas(en)} series</span>${en.records ? `<span class="en-pr">🏆 ${en.records}</span>` : ''}${en.origen && en.origen !== 'app' ? `<span class="en-origen">${esc(en.origen === 'hevy' ? 'Hevy' : en.origen === 'strong' ? 'Strong' : 'Excel')}</span>` : ''}</div>
      <div class="en-tarjeta-ej">${en.ejercicios.slice(0, 5).map((e) => `${e.series.filter(cuenta).length} × ${esc(nombreEj(e))}`).join('<br>')}${en.ejercicios.length > 5 ? `<br><small>+${en.ejercicios.length - 5} más</small>` : ''}</div>
    </div>`).join('') + (lista.length > 60 ? `<p class="vacio">Mostrando los 60 más recientes de ${lista.length}.</p>` : '')
    : '<p class="vacio">Aún no registras entrenamientos. Empieza uno o importa tu historial de Hevy.</p>';
  $('en-lista').querySelectorAll('.en-tarjeta').forEach((x) => (x.onclick = () => abrirDetalle(x.dataset.id)));
}

function pintarRutinas() {
  $('en-rutinas').innerHTML = rutinas.length ? rutinas.map((r, i) => `<div class="en-rutina">
      <div class="en-rutina-txt"><strong>${esc(r.nombre)}</strong><small>${r.ejercicios.map((e) => esc(nombreEj(e))).join(' · ')}</small></div>
      <button type="button" class="btn-sec en-rut-mas" data-i="${i}" aria-label="Opciones">⋯</button>
      <button type="button" class="btn-sec en-terminar en-rut-ir" data-i="${i}">▶</button></div>`).join('')
    : '<p class="hint" style="margin:0 0 6px">Crea rutinas para tus días (Pierna, Empuje, Tirón…) o guarda cualquier entrenamiento como rutina.</p>';
  $('en-rutinas').querySelectorAll('.en-rut-ir').forEach((b) => (b.onclick = () => empezarRutina(rutinas[+b.dataset.i])));
  $('en-rutinas').querySelectorAll('.en-rut-mas').forEach((b) => (b.onclick = () => {
    const r = rutinas[+b.dataset.i];
    hoja([['▶', 'Empezar', () => empezarRutina(r)], ['✏️', 'Editar', () => editarRutina(r)],
      ['🔤', 'Renombrar', () => { const n = prompt('Nombre de la rutina', r.nombre); if (n && n.trim()) { r.nombre = n.trim(); guardarRutinas(); pintar(); } }],
      ['🗑️', 'Borrar', () => { if (confirm(`¿Borrar la rutina "${r.nombre}"?`)) { rutinas = rutinas.filter((x) => x !== r); guardarRutinas(); pintar(); } }, true]]);
  }));
}

function pintarCalendario(lunes) {
  const dias = new Set(lista.map((e) => diaLocal(new Date(e.inicio))));
  const SEM = 12, ini = new Date(lunes); ini.setDate(ini.getDate() - 7 * (SEM - 1));
  const hoy = new Date(); let celdas = '';
  for (let w = 0; w < SEM; w++) for (let d = 0; d < 7; d++) {
    const f = new Date(ini); f.setDate(ini.getDate() + w * 7 + d);
    celdas += `<span class="${f > hoy ? 'fut' : dias.has(diaLocal(f)) ? 'si' : ''}" title="${f.toLocaleDateString('es-EC')}"></span>`;
  }
  let racha = 0; // semanas seguidas con al menos un entrenamiento (la actual cuenta si ya entrenaste)
  for (let w = 0; w < 104; w++) {
    const a = new Date(lunes); a.setDate(a.getDate() - 7 * w); const b = new Date(a); b.setDate(b.getDate() + 7);
    const hay = lista.some((e) => { const t = new Date(e.inicio); return t >= a && t < b; });
    if (hay) racha++; else if (w > 0) break;
  }
  const n30 = lista.filter((e) => Date.now() - new Date(e.inicio) < 30 * 86400000).length;
  $('en-calendario').innerHTML = `<div class="en-cal">${celdas}</div>
    <p class="hint" style="margin-top:6px">🔥 Racha: <b>${racha} semana${racha === 1 ? '' : 's'}</b> · ${n30} entrenamientos en los últimos 30 días</p>`;
}

function pintarMusculos() {
  const hace7 = new Date(Date.now() - 7 * 86400000);
  const g = P.seriesPorGrupo(lista, deps.porId, hace7), filas = Object.entries(g).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(20, ...filas.map(([, n]) => n));
  $('en-musculos').innerHTML = filas.length ? filas.map(([nombre, n]) => `<div class="en-mus"><span>${esc(nombre)}</span>
      <div class="en-mus-barra"><div style="width:${100 * n / max}%" class="${n < 10 ? 'poco' : n > 20 ? 'mucho' : ''}"></div><i style="left:${100 * 10 / max}%"></i><i style="left:${100 * 20 / max}%"></i></div><b>${n}</b></div>`).join('')
    + '<p class="hint">Series efectivas en los últimos 7 días. Las marcas indican 10 y 20 series por semana, el rango habitual para crecer.</p>'
    : '<p class="hint" style="margin:0">Aquí verás cuántas series haces por grupo muscular cada semana.</p>';
}

function pintarEjercicios() {
  const vistos = new Map();
  for (const en of lista) for (const e of en.ejercicios) {
    const k = P.claveEj(e);
    if (!vistos.has(k)) vistos.set(k, { e, n: 0 });
    vistos.get(k).n++;
  }
  const filas = [...vistos.entries()].slice(0, 25);
  $('en-ejs').innerHTML = filas.length ? filas.map(([k, { e, n }]) => {
    const r = P.registros(lista, k), real = P.rmReal(k);
    return `<div class="en-ej-fila" data-k="${esc(k)}" role="button"><span class="en-ej-icono">${iconoEj(e)}</span>
      <div><strong>${esc(nombreEj(e))}</strong><small>${n} sesión${n > 1 ? 'es' : ''}${r.maxKg ? ` · máx. ${kgTxt(r.maxKg.kg)} kg × ${r.maxKg.reps}` : ''}</small></div>
      <div class="der">${real ? `<b>${kgTxt(real.kg)}</b><small>1RM real</small>` : r.mejor ? `<b>${fmt(r.mejor.valor)}</b><small>1RM est.</small>` : ''}</div></div>`;
  }).join('') : '<p class="hint" style="margin:0">Cuando registres entrenamientos, aquí verás tus récords y progreso por ejercicio.</p>';
  $('en-ejs').querySelectorAll('.en-ej-fila').forEach((x) => (x.onclick = () => abrirProgreso(vistos.get(x.dataset.k).e)));
}

// ------------------------------------------------------------------ hoja de opciones (menu inferior)
function hoja(opciones) {
  const h = $('en-hoja');
  h.innerHTML = `<div class="en-hoja-caja">${opciones.map(([ic, txt, , peligro], i) => `<button type="button" data-i="${i}" class="${peligro ? 'peligro' : ''}"><b>${ic}</b> ${txt}</button>`).join('')}</div>`;
  h.style.display = 'flex';
  h.querySelectorAll('button').forEach((b) => (b.onclick = () => { h.style.display = 'none'; opciones[+b.dataset.i][2](); }));
}

// ------------------------------------------------------------------ detalle de un entrenamiento
function abrirDetalle(id, nuevo = null) {
  const en = lista.find((x) => x.id === id); if (!en) return;
  const recs = nuevo && nuevo.length ? `<div class="en-records"><b>🏆 ¡Nuevos récords!</b>${nuevo.map((r) => `<div><strong>${esc(r.nombre)}</strong><br>${r.records.map((x) => `<span>${x.tipo}: <b>${x.texto}</b></span>`).join('<br>')}</div>`).join('')}</div>` : '';
  $('en-det-cuerpo').innerHTML = `${nuevo ? '<div class="en-ok">✅ ¡Entrenamiento guardado!</div>' + recs : ''}
    <h3 class="en-det-titulo">${esc(en.titulo || 'Entrenamiento')}</h3>
    <p class="hint" style="margin-top:2px">${fechaTxt(en.inicio)}${en.fin ? ' · ' + duracion(new Date(en.fin) - new Date(en.inicio)) : ''} · ${fmt(volumen(en))} kg · ${seriesHechas(en)} series</p>
    ${en.ejercicios.map((e) => `<div class="en-det-ej"><strong>${iconoEj(e)} ${esc(nombreEj(e))}</strong>${e.ej && deps.porId[e.ej] && norm(e.nombre) !== norm(deps.porId[e.ej].nombre) ? `<small> (${esc(e.nombre)})</small>` : ''}
      ${e.notas ? `<div class="hint" style="margin:2px 0 4px">📝 ${esc(e.notas)}</div>` : ''}
      ${e.series.map((s, i) => `<div class="en-det-serie${s.tipo === 'calentamiento' ? ' cal' : ''}"><span>${TIPOS[s.tipo] || i + 1 - e.series.slice(0, i).filter((x) => x.tipo === 'calentamiento').length}</span>
        <span>${kgTxt(s.kg) || '—'} kg × ${s.reps ?? '—'}${s.rpe ? ` @${fmt(s.rpe, s.rpe % 1 ? 1 : 0)}` : ''}</span>
        ${s.analisis ? `<button type="button" class="en-vel" data-serie="${s.analisis.id}">⚡ ${fmt(s.analisis.v, 2)} m/s</button>` : ''}</div>`).join('')}</div>`).join('')}
    <div class="en-det-botones"><button type="button" class="btn-sec" id="en-repetir">🔁 Repetir</button><button type="button" class="btn-sec" id="en-a-rutina">💾 Como rutina</button><button type="button" class="btn-sec peligro" id="en-borrar">Borrar</button></div>`;
  $('en-detalle').style.display = 'flex';
  $('en-det-cuerpo').scrollTop = 0;
  $('en-det-cuerpo').querySelectorAll('[data-serie]').forEach((b) => (b.onclick = () => { $('en-detalle').style.display = 'none'; deps.abrirSerie(b.dataset.serie); }));
  $('en-repetir').onclick = () => {
    if (activo && !confirm('Ya tienes un entrenamiento en curso. ¿Reemplazarlo?')) return;
    $('en-detalle').style.display = 'none';
    empezar({ titulo: en.titulo, ejercicios: en.ejercicios.map((e) => ({ ej: e.ej, nombre: e.nombre, notas: '', series: e.series.map((s) => serieVacia(s.tipo)) })) });
  };
  $('en-a-rutina').onclick = () => {
    const n = prompt('Nombre de la rutina', en.titulo || 'Mi rutina'); if (!n || !n.trim()) return;
    rutinas.push(rutinaDesde(n.trim(), en.ejercicios, false)); guardarRutinas();
    alert(`Rutina "${n.trim()}" guardada. La encuentras arriba en Entrenar.`); pintar();
  };
  $('en-borrar').onclick = async () => {
    if (!confirm('¿Borrar este entrenamiento?')) return;
    await almacen.borrarEntreno(en.id); lista = lista.filter((x) => x.id !== en.id);
    $('en-detalle').style.display = 'none'; pintar();
  };
}

// ------------------------------------------------------------------ rutinas
// una rutina guarda los ejercicios y, por serie, el tipo y el objetivo (kg, reps, RPE)
function rutinaDesde(nombre, ejercicios, conObjetivo, id = null) {
  return { id: id || 'r-' + Date.now(), nombre, ejercicios: ejercicios.map((e) => ({ ej: e.ej, nombre: e.nombre, notas: e.notas || '',
    series: e.series.map((s) => ({ tipo: s.tipo, kg: conObjetivo ? s.kg : null, reps: conObjetivo ? s.reps : s.reps ?? null, rpe: conObjetivo ? s.rpe : s.rpe ?? null })) })) };
}
function empezarRutina(r) {
  if (activo) return alert('Ya tienes un entrenamiento en curso. Termínalo o descártalo primero.');
  empezar({ titulo: r.nombre, rutinaId: r.id, ejercicios: r.ejercicios.map((e) => ({ ej: e.ej, nombre: e.nombre, notas: e.notas || '',
    series: e.series.map((s) => serieVacia(s.tipo, (s.kg || s.reps || s.rpe) ? { kg: s.kg, reps: s.reps, rpe: s.rpe } : null)) })) });
}
function editarRutina(r) {
  if (activo) return alert('Ya tienes un entrenamiento en curso. Termínalo o descártalo primero.');
  activo = { id: 'edit', rutina: true, rutinaId: r ? r.id : null, titulo: r ? r.nombre : '', inicio: new Date().toISOString(),
    ejercicios: r ? r.ejercicios.map((e) => ({ ej: e.ej, nombre: e.nombre, notas: e.notas || '', series: e.series.map((s) => ({ ...serieVacia(s.tipo), kg: s.kg, reps: s.reps, rpe: s.rpe })) })) : [] };
  guardarBorrador(); deps.vista('v-entrenar'); pintar();
  if (!activo.ejercicios.length) abrirSelector();
}

// ------------------------------------------------------------------ entrenamiento en curso
function empezar(base = null) {
  const h = new Date().getHours();
  activo = { id: 'e-' + Date.now(), inicio: new Date().toISOString(), origen: 'app', rutinaId: base?.rutinaId || null,
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
  const modoRutina = !!activo.rutina;
  $('en-activo').classList.toggle('modo-rutina', modoRutina);
  $('en-titulo').value = activo.titulo || '';
  $('en-titulo').placeholder = modoRutina ? 'Nombre de la rutina (ej.: Pierna A)' : 'Nombre del entrenamiento';
  $('en-terminar').textContent = modoRutina ? 'Guardar rutina' : 'Terminar';
  $('en-descartar').textContent = modoRutina ? 'Cancelar' : 'Descartar';
  $('en-rutina-aviso').style.display = modoRutina ? '' : 'none';
  $('en-ejercicios').innerHTML = activo.ejercicios.map((e, ie) => {
    const prev = modoRutina ? [] : anterior(e, activo.id) || [];
    const r = ref(e);
    let nNormal = 0;
    return `<div class="en-ej" data-ie="${ie}">
      <div class="en-ej-cab"><span class="en-ej-icono">${iconoEj(e)}</span><strong>${esc(nombreEj(e))}</strong>
        ${modoRutina ? '' : '<button type="button" class="en-mini" data-acc="progreso" title="Progreso y récords">📈</button>'}
        <button type="button" class="en-mini" data-acc="subir" title="Subir">↑</button><button type="button" class="en-mini" data-acc="quitar" title="Quitar">✕</button></div>
      ${r ? `<div class="en-ref">1RM de referencia: <b>${fmt(r.kg)} kg</b> ${r.fuente === 'hoy' ? '(calculado con tu serie de hoy)' : r.fuente === 'real' ? '(tu 1RM real)' : r.fuente === 'reciente' ? '(estimado, últimos 90 días)' : '(estimado de tu historial; puede estar desactualizado)'}. Pon reps y RPE y te sugiero el peso.</div>` : ''}
      <input class="en-nota" data-acc="nota" placeholder="Nota (opcional)" value="${esc(e.notas || '')}">
      <div class="en-fila en-fila-cab"><span>Serie</span><span>${modoRutina ? '' : 'Anterior'}</span><span>kg</span><span>Reps</span><span>RPE</span><span>✓</span><span>🎥</span></div>
      ${e.series.map((s, is) => {
        const etiqueta = TIPOS[s.tipo] || String(++nNormal);
        const p = prev[is], m = marcadores(e, is, prev, r);
        const ptxt = p && (p.kg || p.reps) ? `${kgTxt(p.kg) || 0} × ${p.reps ?? 0}${p.rpe ? ' @' + fmt(p.rpe, p.rpe % 1 ? 1 : 0) : ''}` : modoRutina ? '' : '—';
        return `<div class="en-fila${s.hecha ? ' hecha' : ''}" data-is="${is}">
          <button type="button" class="en-num t-${s.tipo}" data-acc="tipo">${etiqueta}</button>
          <button type="button" class="en-prev" data-acc="copiar">${ptxt}</button>
          <input type="number" inputmode="decimal" step="any" min="0" data-campo="kg" value="${s.kg ?? ''}" placeholder="${m.kg != null ? kgTxt(m.kg) : ''}" class="${m.sug ? 'sug' : ''}">
          <input type="number" inputmode="numeric" step="1" min="0" data-campo="reps" value="${s.reps ?? ''}" placeholder="${m.reps ?? ''}">
          <input type="number" inputmode="decimal" step="0.5" min="1" max="10" data-campo="rpe" value="${s.rpe ?? ''}" placeholder="${m.rpe ?? ''}">
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
        const fila = inp.closest('.en-fila'), is = +fila.dataset.is, s = e.series[is];
        const v = inp.value === '' ? null : parseFloat(inp.value.replace(',', '.'));
        s[inp.dataset.campo] = Number.isFinite(v) ? v : null;
        if (inp.dataset.campo === 'kg') ultimoKg = s.kg;
        if (inp.dataset.campo !== 'kg') { // al cambiar reps o RPE se recalcula el peso sugerido
          const m = marcadores(e, is, activo.rutina ? [] : anterior(e, activo.id) || [], ref(e)), k = fila.querySelector('[data-campo="kg"]');
          k.placeholder = m.kg != null ? kgTxt(m.kg) : ''; k.classList.toggle('sug', m.sug);
        }
        guardarBorrador(); tic();
      };
      if (inp.dataset.campo === 'kg') inp.onfocus = () => { ultimoKg = parseFloat(inp.value || inp.placeholder) || ultimoKg; };
    });
    caja.querySelector('[data-acc="nota"]').oninput = (ev) => { e.notas = ev.target.value; guardarBorrador(); };
    caja.querySelectorAll('button[data-acc]').forEach((b) => (b.onclick = () => accion(b.dataset.acc, ie, b.closest('.en-fila') ? +b.closest('.en-fila').dataset.is : +b.dataset.is)));
  });
}

function accion(acc, ie, is) {
  const e = activo.ejercicios[ie], s = e && e.series[is];
  const prevs = activo.rutina ? [] : anterior(e, activo.id) || [], prev = prevs[is];
  if (acc === 'quitar') { if (!confirm(`¿Quitar ${nombreEj(e)}?`)) return; activo.ejercicios.splice(ie, 1); }
  else if (acc === 'subir') { if (ie === 0) return; activo.ejercicios.splice(ie - 1, 0, activo.ejercicios.splice(ie, 1)[0]); }
  else if (acc === 'progreso') return abrirProgreso(e);
  else if (acc === 'serie') {
    const u = e.series[e.series.length - 1];
    e.series.push({ ...serieVacia(u && u.tipo !== 'calentamiento' ? u.tipo : 'normal', u && u.obj ? { ...u.obj } : null), kg: u ? u.kg : null, reps: u ? u.reps : null, rpe: activo.rutina && u ? u.rpe : null });
  } else if (acc === 'copiar') { if (!prev) return; s.kg = prev.kg; s.reps = prev.reps; if (prev.rpe) s.rpe = prev.rpe; }
  else if (acc === 'tipo') return elegirTipo(e, is);
  else if (acc === 'hecha') {
    s.hecha = !s.hecha;
    if (s.hecha) {
      const m = marcadores(e, is, prevs, ref(e));
      if (s.kg == null && m.kg != null) s.kg = m.kg;
      if (s.reps == null && m.reps != null) s.reps = m.reps;
      if (s.rpe == null && s.obj && s.obj.rpe) s.rpe = s.obj.rpe;
      if (!(s.reps > 0) && !(s.kg > 0)) { s.hecha = false; alert('Escribe el peso y las repeticiones de la serie.'); return; }
      iniciarDescanso();
      if (navigator.vibrate) navigator.vibrate(40);
    }
  } else if (acc === 'video') {
    if (s.analisis) return deps.abrirSerie(s.analisis.id);
    if (!e.ej || !deps.porId[e.ej]) return alert('Este ejercicio no está en la biblioteca de análisis por video. Elige uno de la lista para poder analizarlo.');
    const kg = s.kg ?? marcadores(e, is, prevs, ref(e)).kg;
    enlacePendiente = { entreno: activo.id, ie, is, ej: e.ej };
    deps.analizar({ ej: e.ej, kg, serie: is + 1, nombre: nombreEj(e) });
    return;
  } else if (acc === 'ver') { if (s.analisis) deps.abrirSerie(s.analisis.id); return; }
  guardarBorrador(); pintarActivo();
}

function elegirTipo(e, is) {
  const op = Object.keys(NOMBRE_TIPO).map((t) => [`<span class="en-num t-${t}">${TIPOS[t] || '1'}</span>`, NOMBRE_TIPO[t] + (e.series[is].tipo === t ? ' ✓' : ''),
    () => { e.series[is].tipo = t; guardarBorrador(); pintarActivo(); }]);
  op.push(['🗑️', 'Borrar serie', () => { e.series.splice(is, 1); guardarBorrador(); pintarActivo(); }, true]);
  hoja(op);
}

// ------------------------------------------------------------------ selector de ejercicios
function abrirSelector() {
  $('en-buscar').value = ''; $('en-selector').style.display = 'flex'; pintarSelector();
  setTimeout(() => $('en-buscar').focus({ preventScroll: true }), 50);
}
function recientes() {
  const vistos = [], claves = new Set();
  for (const en of lista) for (const e of en.ejercicios) {
    const k = P.claveEj(e);
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
  const prev = activo.rutina ? null : anterior(e, activo.id);
  e.series = prev && prev.length ? prev.map((s) => serieVacia(s.tipo)) : [serieVacia(), serieVacia(), serieVacia()];
  activo.ejercicios.push(e);
  $('en-selector').style.display = 'none';
  guardarBorrador(); pintarActivo();
  setTimeout(() => { const c = $('en-ejercicios').lastElementChild; if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}

// ------------------------------------------------------------------ progreso de un ejercicio
function abrirProgreso(e) {
  const k = P.claveEj(e), r = P.registros(lista, k), real = P.rmReal(k), rf = P.referencia(lista, { ...e, series: [] });
  const repMax = Object.entries(r.repMax).map(([n, x]) => `<tr><td><b>${n}RM</b></td><td>${kgTxt(x.kg)} kg</td><td>${fechaTxt(x.fecha, false)}</td></tr>`).join('');
  const base = real ? real.kg : r.mejor ? r.mejor.valor : null;
  const tablaRPE = base ? `<table class="tabla en-tabla"><thead><tr><th>Reps</th><th>@7</th><th>@8</th><th>@9</th><th>@10</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6, 8, 10].map((n) => `<tr><td><b>${n}</b></td>${[7, 8, 9, 10].map((rpe) => `<td>${kgTxt(P.redondear(P.cargaPara(base, n, rpe)))}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="hint">Cargas (kg) según tu ${real ? '1RM real' : '1RM estimado'} de ${fmt(base)} kg, redondeadas a 2,5 kg. RPE 8 = te quedaban 2 reps.</p>` : '';
  $('en-det-cuerpo').innerHTML = `<h3 class="en-det-titulo">${iconoEj(e)} ${esc(nombreEj(e))}</h3>
    <div class="en-rm-real"><label for="en-rm-in">Mi 1RM real (kg)</label>
      <div><input id="en-rm-in" type="number" inputmode="decimal" step="any" min="0" value="${real ? real.kg : ''}" placeholder="${r.mejor ? fmt(r.mejor.valor) : 'ej.: 200'}">
      <button type="button" class="btn-sec" id="en-rm-ok">Guardar</button></div>
      <small>${real ? `Guardado el ${fechaTxt(real.fecha, false)}. ` : ''}Tu marca de competencia o de prueba. La app la usa para sugerirte cargas y para calibrar el análisis por video (útil si eres más explosivo que el promedio). Déjalo vacío para usar el estimado.</small></div>
    <div class="kpi-grid tres en-kpis">
      <div class="kpi-card"><div class="kpi-label">1RM estimado</div><div class="kpi-value">${r.mejor ? fmt(r.mejor.valor) : '--'}</div><div class="kpi-sub">${r.mejor ? `${kgTxt(r.mejor.kg)} × ${r.mejor.reps}` : 'sin datos'}</div></div>
      <div class="kpi-card"><div class="kpi-label">Peso máximo</div><div class="kpi-value">${r.maxKg ? kgTxt(r.maxKg.kg) : '--'}</div><div class="kpi-sub">${r.maxKg ? `× ${r.maxKg.reps} reps` : ''}</div></div>
      <div class="kpi-card"><div class="kpi-label">Mejor serie</div><div class="kpi-value">${r.maxVol ? fmt(r.maxVol.vol) : '--'}</div><div class="kpi-sub">${r.maxVol ? `${kgTxt(r.maxVol.kg)} × ${r.maxVol.reps} (kg)` : ''}</div></div></div>
    ${r.puntos.length > 1 ? '<label class="section-title" style="margin-top:12px">1RM estimado por sesión</label><canvas id="en-graf" class="en-graf"></canvas>' : ''}
    ${repMax ? `<label class="section-title" style="margin-top:12px">Récords por repeticiones</label><table class="tabla en-tabla"><tbody>${repMax}</tbody></table>` : ''}
    ${tablaRPE ? `<label class="section-title" style="margin-top:12px">Tabla de cargas por RPE</label>${tablaRPE}` : ''}
    ${r.sesiones.length ? `<label class="section-title" style="margin-top:12px">Últimas sesiones</label>${r.sesiones.slice(0, 8).map((x) => `<div class="en-det-serie"><span style="width:auto;min-width:70px;text-align:left">${fechaTxt(x.fecha, false)}</span><span>${x.series.filter((s) => s.tipo !== 'calentamiento').map((s) => `${kgTxt(s.kg)}×${s.reps ?? '—'}${s.rpe ? '@' + fmt(s.rpe, s.rpe % 1 ? 1 : 0) : ''}`).join(', ') || '—'}</span></div>`).join('')}` : ''}
    ${!r.puntos.length && !rf ? '<p class="vacio">Todavía no hay series de este ejercicio.</p>' : ''}`;
  $('en-detalle').style.display = 'flex';
  $('en-det-cuerpo').scrollTop = 0;
  $('en-rm-ok').onclick = () => {
    const v = parseFloat(($('en-rm-in').value || '').replace(',', '.'));
    P.guardarRmReal(k, v > 0 ? v : 0);
    abrirProgreso(e); if (activo) pintarActivo(); else pintar();
  };
  if (r.puntos.length > 1) grafica($('en-graf'), r.puntos.filter((p) => p.e1rm).slice(-40), real ? real.kg : null);
}

function grafica(c, puntos, linea) {
  const dpr = window.devicePixelRatio || 1, W = c.clientWidth || 320, H = 170;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const ys = puntos.map((p) => p.e1rm).concat(linea ? [linea] : []);
  let mn = Math.min(...ys), mx = Math.max(...ys); const pad = Math.max(2, (mx - mn) * 0.12); mn -= pad; mx += pad;
  const L = 38, R = 8, T = 10, B = 22, x = (i) => L + (W - L - R) * (puntos.length > 1 ? i / (puntos.length - 1) : 0.5), y = (v) => T + (H - T - B) * (1 - (v - mn) / (mx - mn));
  g.font = '10px system-ui, sans-serif'; g.fillStyle = '#8e95a5'; g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
  for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - R, y(v)); g.stroke(); g.fillText(Math.round(v), 4, y(v) + 3); }
  const f = (p) => new Date(p.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
  g.fillText(f(puntos[0]), L, H - 6); const t = f(puntos[puntos.length - 1]); g.fillText(t, W - R - g.measureText(t).width, H - 6);
  if (linea) { g.strokeStyle = '#ff9628'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(L, y(linea)); g.lineTo(W - R, y(linea)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff9628'; g.fillText('1RM real', W - R - 44, y(linea) - 4); }
  g.strokeStyle = '#5aa0ff'; g.lineWidth = 2; g.beginPath(); puntos.forEach((p, i) => (i ? g.lineTo(x(i), y(p.e1rm)) : g.moveTo(x(i), y(p.e1rm)))); g.stroke();
  g.fillStyle = '#5adc78'; puntos.forEach((p, i) => { g.beginPath(); g.arc(x(i), y(p.e1rm), 3, 0, 7); g.fill(); });
}

// ------------------------------------------------------------------ calculadora de discos
function abrirDiscos(kg = null) {
  const cfg = (() => { try { return JSON.parse(leerLS('af_discos') || 'null') || {}; } catch (e) { return {}; } })();
  const barra = cfg.barra ?? 20, disp = cfg.disp || [25, 20, 15, 10, 5, 2.5, 1.25];
  $('en-det-cuerpo').innerHTML = `<h3 class="en-det-titulo">🧮 Calculadora de discos</h3>
    <div class="form-grid" style="margin-top:10px">
      <div class="form-group"><label for="dc-obj">Peso total (kg)</label><input id="dc-obj" type="number" inputmode="decimal" step="any" value="${kg > 0 ? kg : ''}" placeholder="ej.: 182,5"></div>
      <div class="form-group"><label for="dc-barra">Barra (kg)</label><select id="dc-barra">${[20, 15, 10, 25, 0].map((b) => `<option value="${b}"${b === barra ? ' selected' : ''}>${b ? b + ' kg' : 'Sin barra'}</option>`).join('')}</select></div>
    </div>
    <div class="en-dc-disp">${P.DISCOS.map((p) => `<label><input type="checkbox" value="${p}"${disp.includes(p) ? ' checked' : ''}> ${kgTxt(p)}</label>`).join('')}</div>
    <div id="dc-res" class="en-dc-res"></div>`;
  $('en-detalle').style.display = 'flex';
  const calc = () => {
    const obj = parseFloat(($('dc-obj').value || '').replace(',', '.')), b = parseFloat($('dc-barra').value);
    const d = [...document.querySelectorAll('.en-dc-disp input:checked')].map((x) => parseFloat(x.value));
    guardarLS('af_discos', JSON.stringify({ barra: b, disp: d }));
    if (!(obj > 0)) { $('dc-res').innerHTML = '<p class="hint">Escribe el peso total que quieres levantar.</p>'; return; }
    const r = P.discos(obj, b, d);
    if (obj < b) { $('dc-res').innerHTML = '<p class="hint">El peso es menor que la barra.</p>'; return; }
    const alto = (p) => Math.round(34 + 66 * Math.min(1, p / 25));
    $('dc-res').innerHTML = `<div class="en-dc-barra"><span class="en-dc-eje"></span>${r.lado.map((p) => `<span class="en-dc-disco" style="height:${alto(p)}px;background:${COLOR_DISCO[p] || '#888'};color:${[5, 15].includes(p) ? '#111' : '#fff'}">${kgTxt(p)}</span>`).join('')}<span class="en-dc-tope"></span></div>
      <p style="margin:10px 0 0">Por lado: <b>${r.lado.length ? r.lado.map(kgTxt).join(' + ') : 'nada'}</b>${r.lado.length ? ` (= ${kgTxt(r.lado.reduce((a, x) => a + x, 0))} kg)` : ''}</p>
      ${r.exacto ? '' : `<p class="hint" style="color:var(--accent-orange)">Con esos discos no llega exacto: queda en ${kgTxt(r.total)} kg.</p>`}`;
  };
  $('dc-obj').oninput = calc; $('dc-barra').onchange = calc;
  document.querySelectorAll('.en-dc-disp input').forEach((x) => (x.onchange = calc));
  calc();
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
  if (!activo || activo.rutina) { barra.style.display = activo && vistaActual !== 'v-entrenar' ? 'flex' : 'none'; desc.style.display = 'none';
    if (activo) barra.innerHTML = `<span>✏️ Editando rutina <b>${esc(activo.titulo || '')}</b></span><b class="en-volver">Volver ›</b>`; return; }
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
  if (activo.rutina) return guardarRutinaEditada();
  const sinMarcar = activo.ejercicios.reduce((a, e) => a + e.series.filter((s) => !s.hecha && (s.kg > 0 || s.reps > 0)).length, 0);
  if (sinMarcar) {
    if (confirm(`Tienes ${sinMarcar} serie${sinMarcar > 1 ? 's' : ''} con datos sin marcar ✓.\n\nAceptar = marcarlas como hechas\nCancelar = descartarlas`))
      activo.ejercicios.forEach((e) => e.series.forEach((s) => { if (!s.hecha && (s.kg > 0 || s.reps > 0)) s.hecha = true; }));
  }
  const ejercicios = activo.ejercicios.map((e) => ({ ...e, series: e.series.filter((s) => s.hecha).map(({ obj, ...s }) => s) })).filter((e) => e.series.length);
  if (!ejercicios.length) {
    if (confirm('No hay ninguna serie hecha. ¿Descartar el entrenamiento?')) cerrarActivo();
    return;
  }
  const en = { id: activo.id, titulo: activo.titulo || 'Entrenamiento', inicio: activo.inicio, fin: new Date().toISOString(), origen: 'app', ejercicios };
  const recs = P.recordsNuevos(en, lista.filter((x) => x.id !== en.id), nombreEj);
  const nRec = recs.reduce((a, r) => a + r.records.length, 0);
  if (nRec) en.records = nRec;
  try { await almacen.guardarEntreno(en); } catch (e) { alert('No pude guardar el entrenamiento: ' + (e.message || e)); return; }
  lista = [en, ...lista.filter((x) => x.id !== en.id)].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  cerrarActivo();
  abrirDetalle(en.id, recs);
  if (nRec && navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 160]);
}

function guardarRutinaEditada() {
  const nombre = (activo.titulo || '').trim();
  if (!nombre) { alert('Ponle un nombre a la rutina (arriba).'); $('en-titulo').focus(); return; }
  if (!activo.ejercicios.length) return alert('Agrega al menos un ejercicio.');
  const r = rutinaDesde(nombre, activo.ejercicios, true, activo.rutinaId);
  const i = rutinas.findIndex((x) => x.id === r.id);
  if (i >= 0) rutinas[i] = r; else rutinas.push(r);
  guardarRutinas(); cerrarActivo();
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
