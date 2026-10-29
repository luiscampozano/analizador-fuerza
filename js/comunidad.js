// Pestaña Comunidad: perfil publico, feed (Siguiendo / Descubrir), actividad, perfiles de otros atletas,
// likes, comentarios, buscar, bloquear, reportar y moderacion. Publicar un entrenamiento es siempre una decision
// del usuario (boton "Compartir"); nada se publica solo.
import * as nube from './nube.js';
import * as bienvenida from './bienvenida.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Number.isFinite(+x) && x !== null && x !== '' ? (+x).toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const kgTxt = (x) => (Number.isFinite(+x) && x !== null ? fmt(x, Math.abs(x * 10 - Math.round(x * 10)) > 1e-6 ? 2 : x % 1 ? 1 : 0) : '—');
const leerJ = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? def; } catch (e) { return def; } };
const guardarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const COMPARTIDOS = 'af_compartidos', VISTO = 'af_actividad_visto';
const MOTIVOS = [['spam', 'Spam o publicidad'], ['ofensivo', 'Ofensivo o de odio'], ['acoso', 'Acoso o intimidación'], ['falso', 'Datos falsos o engañosos'], ['peligroso', 'Peligroso (lesiones, sustancias)'], ['otro', 'Otro motivo']];

let deps = null;          // { vista, porId, guardarRutina(nombre, ejercicios) }
let yo = null;            // { perfil, admin, googleFoto, googleNombre }
let modo = 'siguiendo', antes = null, cargando = false;

// ------------------------------------------------------------------ utilidades
function hace(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(ms).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}
const avatar = (a, cls = '') => (a && a.foto
  ? `<img class="co-av ${cls}" src="${esc(a.foto)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
  : `<span class="co-av ${cls}">${esc(((a && (a.nombre || a.alias)) || '?').trim().charAt(0).toUpperCase())}</span>`);
const durTxt = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min` : `${Math.round(min)} min`);

async function api(m, ruta, cuerpo) { return nube.api(m, '/api/comunidad/' + ruta, cuerpo); }
function error(e) { alert((e && e.message) || String(e)); }

function modal(html, { alAbrir } = {}) {
  const m = $('co-modal');
  $('co-modal-cuerpo').innerHTML = html;
  m.style.display = 'flex';
  $('co-modal-cuerpo').scrollTop = 0;
  if (alAbrir) alAbrir($('co-modal-cuerpo'));
}
const cerrarModal = () => { $('co-modal').style.display = 'none'; };
function hoja(opciones) { // menu inferior: [[icono, texto, accion, peligro]]
  const h = $('co-hoja');
  h.innerHTML = `<div class="en-hoja-caja">${opciones.map(([ic, t, , p], i) => `<button type="button" data-i="${i}" class="${p ? 'peligro' : ''}"><b>${ic}</b> ${esc(t)}</button>`).join('')}</div>`;
  h.style.display = 'flex';
  h.querySelectorAll('button').forEach((b) => (b.onclick = () => { h.style.display = 'none'; opciones[+b.dataset.i][2](); }));
}

// ------------------------------------------------------------------ inicio
export function iniciar(d) {
  deps = d;
  $('co-modal-cerrar').onclick = cerrarModal;
  $('co-hoja').onclick = (ev) => { if (ev.target.id === 'co-hoja') $('co-hoja').style.display = 'none'; };
}

// se llama al abrir la pestaña
export async function pintar() {
  const cont = $('co-contenido');
  if (!nube.conectado()) {
    yo = null;
    cont.innerHTML = `<div class="card co-bienvenida"><div class="pf-pronto-icono">👥</div><h3>Comunidad FuerzaPro</h3>
      <p>Comparte tus entrenamientos, sigue a tus amigos y a tu gimnasio y mira sus series, récords y la <b>velocidad medida por video</b>.</p>
      <p class="hint">Para entrar necesitas iniciar sesión. Tú decides qué publicas: nada es público por defecto.</p>
      <div id="co-google" class="pf-google"></div><button type="button" class="btn-sec pf-correo" id="co-correo">✉️ Usar otro correo</button></div>`;
    $('co-correo').onclick = () => bienvenida.abrir('registro');
    nube.botonGoogle($('co-google'), { alEntrar: () => pintar(), alError: error }).catch((e) => { $('co-google').innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; });
    return;
  }
  const uid = nube.sesion().usuario.id;
  if (!yo || yo.uid !== uid) {
    cont.innerHTML = '<p class="hint co-cargando">Cargando…</p>';
    try { yo = { ...(await api('GET', 'yo')), uid }; } catch (e) { cont.innerHTML = `<div class="card"><p class="pf-nube-error">${esc(e.message)}</p><button type="button" class="btn-sec" id="co-reintentar">Reintentar</button></div>`; $('co-reintentar').onclick = pintar; return; }
  }
  if (!yo.perfil) return pintarCrearPerfil();
  pintarFeed();
}

// ------------------------------------------------------------------ crear / editar perfil publico
function formPerfil(pf) {
  const app = leerJ('af_perfil', {});
  const tieneFotoApp = !!(app.foto && app.foto.startsWith('data:'));
  const base = pf || { alias: '', nombre: app.nombre || yo.googleNombre || '', bio: app.bio || '', gimnasio: app.gimnasio || '', categoria: app.categoria || '' };
  const sugerido = base.alias || (base.nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return `<div class="form-grid co-form">
      <div class="form-group" style="grid-column:span 2"><label for="co-alias">Nombre de usuario</label>
        <div class="input-unit co-arroba"><span>@</span><input id="co-alias" maxlength="20" autocomplete="off" autocapitalize="none" value="${esc(sugerido)}" placeholder="tu_usuario"></div></div>
      <div class="form-group" style="grid-column:span 2"><label for="co-nombre">Nombre visible</label><input id="co-nombre" maxlength="60" value="${esc(base.nombre)}"></div>
      <div class="form-group"><label for="co-gimnasio">Gimnasio</label><input id="co-gimnasio" maxlength="60" value="${esc(base.gimnasio)}" placeholder="opcional"></div>
      <div class="form-group"><label for="co-categoria">Categoría</label><input id="co-categoria" maxlength="40" value="${esc(base.categoria)}" placeholder="ej.: -83 kg"></div>
      <div class="form-group" style="grid-column:span 2"><label for="co-bio">Sobre ti</label><textarea id="co-bio" maxlength="160" rows="2" placeholder="opcional">${esc(base.bio)}</textarea></div>
      <div class="form-group" style="grid-column:span 2"><label>Foto</label><select id="co-foto">
        ${tieneFotoApp ? `<option value="app"${!pf || pf.fotoPropia ? ' selected' : ''}>La foto de mi perfil de la app</option>` : ''}
        <option value="google"${pf && !pf.fotoPropia && pf.foto ? ' selected' : ''}>La foto de mi cuenta de Google</option>
        <option value="ninguna"${pf && !pf.foto ? ' selected' : ''}>Sin foto (inicial)</option></select></div>
    </div>`;
}
function leerForm() {
  const app = leerJ('af_perfil', {}), op = $('co-foto').value;
  return {
    alias: $('co-alias').value.trim(), nombre: $('co-nombre').value.trim(), bio: $('co-bio').value.trim(),
    gimnasio: $('co-gimnasio').value.trim(), categoria: $('co-categoria').value.trim(),
    foto: op === 'app' ? app.foto : op === 'google' ? yo.googleFoto : null,
  };
}
function pintarCrearPerfil() {
  $('co-contenido').innerHTML = `<div class="card co-crear"><h3>Crea tu perfil de atleta</h3>
    <p class="hint">Es lo que verán los demás cuando compartas un entrenamiento. Puedes cambiarlo cuando quieras.</p>
    ${formPerfil(null)}
    <label class="co-acepto"><input type="checkbox" id="co-normas"> Acepto las <a href="normas.html" target="_blank" rel="noopener">normas de la comunidad</a>: respeto, nada de acoso, odio, spam ni contenido peligroso.</label>
    <button type="button" class="btn-primary" id="co-crear">Entrar a la comunidad</button></div>`;
  $('co-crear').onclick = async () => {
    if (!$('co-normas').checked) return alert('Para entrar acepta las normas de la comunidad.');
    $('co-crear').disabled = true;
    try { const r = await api('PUT', 'perfil', leerForm()); yo.perfil = r.perfil; modo = 'descubrir'; pintarFeed(); } catch (e) { error(e); } finally { const b = $('co-crear'); if (b) b.disabled = false; }
  };
}
function editarPerfil() {
  modal(`<h3 class="en-det-titulo">Editar perfil público</h3>${formPerfil(yo.perfil)}
    <button type="button" class="btn-primary" id="co-guardar" style="margin-top:12px">Guardar</button>`);
  $('co-guardar').onclick = async () => {
    try { const r = await api('PUT', 'perfil', leerForm()); yo.perfil = r.perfil; cerrarModal(); abrirPerfil(yo.perfil.alias); } catch (e) { error(e); }
  };
}

// ------------------------------------------------------------------ feed
function pintarFeed() {
  $('co-contenido').innerHTML = `<div class="co-barra">
      <div class="chips co-tabs">
        <button type="button" class="chip${modo === 'siguiendo' ? ' active' : ''}" data-m="siguiendo">Siguiendo</button>
        <button type="button" class="chip${modo === 'descubrir' ? ' active' : ''}" data-m="descubrir">Descubrir</button>
        <button type="button" class="chip${modo === 'actividad' ? ' active' : ''}" data-m="actividad">🔔 Actividad<span id="co-badge" class="co-badge" style="display:none"></span></button>
      </div>
      <div class="co-iconos">
        <button type="button" class="co-ico" id="co-buscar" aria-label="Buscar personas">🔍</button>
        ${yo.admin ? '<button type="button" class="co-ico" id="co-mod" aria-label="Moderación">🛡️</button>' : ''}
        <button type="button" class="co-ico co-yo" id="co-yo" aria-label="Mi perfil público">${avatar(yo.perfil, 'chico')}</button>
      </div></div>
    <div id="co-lista"></div><div id="co-mas"></div>`;
  $('co-contenido').querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { modo = b.dataset.m; pintarFeed(); }));
  $('co-buscar').onclick = buscar;
  $('co-yo').onclick = () => abrirPerfil(yo.perfil.alias);
  if (yo.admin) $('co-mod').onclick = moderar;
  revisarActividad();
  if (modo === 'actividad') return pintarActividad();
  antes = null; $('co-lista').innerHTML = '<p class="hint co-cargando">Cargando…</p>';
  cargarMas(true);
}

async function cargarMas(primera = false) {
  if (cargando) return; cargando = true;
  const lista = $('co-lista'), mas = $('co-mas');
  try {
    const r = await api('GET', `feed?modo=${modo}${antes ? '&antes=' + antes : ''}`);
    if (primera) lista.innerHTML = '';
    if (primera && !r.publicaciones.length) {
      lista.innerHTML = modo === 'siguiendo'
        ? '<div class="card co-vacio"><p><b>Tu feed está vacío.</b> Sigue a otros atletas para ver sus entrenamientos aquí, o comparte el tuyo desde Entrenar → un entrenamiento → 📣 Compartir.</p></div><div id="co-sug"></div>'
        : '<div class="card co-vacio"><p>Todavía no hay publicaciones. ¡Sé el primero en compartir un entrenamiento!</p></div>';
      if (modo === 'siguiendo') pintarSugerencias($('co-sug'));
    }
    r.publicaciones.forEach((p) => lista.insertAdjacentHTML('beforeend', tarjeta(p)));
    conectarTarjetas(lista, r.publicaciones);
    antes = r.antes;
    mas.innerHTML = antes ? '<button type="button" class="btn-sec co-mas-btn" id="co-mas-btn">Ver más</button>' : '';
    if (antes) $('co-mas-btn').onclick = () => cargarMas();
  } catch (e) {
    if (primera) lista.innerHTML = `<div class="card"><p class="pf-nube-error">${esc(e.message)}</p></div>`; else error(e);
  } finally { cargando = false; }
}

async function pintarSugerencias(cont) {
  try {
    const r = await api('GET', 'sugerencias');
    if (!r.personas.length) return;
    cont.innerHTML = `<label class="section-title" style="margin-top:16px">Atletas para seguir</label><div class="card co-personas">${r.personas.map(persona).join('')}</div>`;
    conectarPersonas(cont);
  } catch (e) { /* nada */ }
}
const persona = (a) => `<div class="co-persona" data-alias="${esc(a.alias)}">${avatar(a)}<div class="co-persona-txt"><strong>${esc(a.nombre)}</strong><small>@${esc(a.alias)}${a.gimnasio ? ' · ' + esc(a.gimnasio) : ''}</small></div>
  <button type="button" class="btn-sec co-seguir" data-id="${esc(a.id)}">Seguir</button></div>`;
function conectarPersonas(cont) {
  cont.querySelectorAll('.co-persona').forEach((el) => (el.onclick = (ev) => { if (!ev.target.closest('.co-seguir')) { cerrarModal(); abrirPerfil(el.dataset.alias); } }));
  cont.querySelectorAll('.co-seguir').forEach((b) => (b.onclick = async () => {
    const sigo = b.classList.contains('activo');
    try { await api(sigo ? 'DELETE' : 'POST', 'seguir/' + encodeURIComponent(b.dataset.id)); b.classList.toggle('activo', !sigo); b.textContent = sigo ? 'Seguir' : 'Siguiendo'; } catch (e) { error(e); }
  }));
}

// ------------------------------------------------------------------ tarjeta de una publicacion
function resumenSerie(s) {
  return `${kgTxt(s.kg)} kg × ${s.reps ?? '—'}${s.rpe ? ` @${fmt(s.rpe, s.rpe % 1 ? 1 : 0)}` : ''}`;
}
function mejorSerie(e) {
  const v = (e.series || []).filter((s) => s.tipo !== 'calentamiento');
  return v.reduce((m, s) => (!m || (s.kg || 0) * (1 + (s.reps || 0) / 30) > (m.kg || 0) * (1 + (m.reps || 0) / 30) ? s : m), null);
}
function bloqueEntreno(d, completo = false) {
  if (!d) return '';
  const ejs = Array.isArray(d.ejercicios) ? d.ejercicios : [];
  const mostrar = completo ? ejs : ejs.slice(0, 4);
  const recs = Array.isArray(d.records) ? d.records : [];
  const nRec = recs.reduce((a, r) => a + ((r.records && r.records.length) || 0), 0);
  return `<div class="co-entreno">
    <div class="co-entreno-tit">${esc(d.titulo || 'Entrenamiento')}</div>
    <div class="co-stats">${d.duracion ? `<span><small>Duración</small>${durTxt(d.duracion)}</span>` : ''}<span><small>Volumen</small>${fmt(d.volumen)} kg</span><span><small>Series</small>${fmt(d.series)}</span>${nRec ? `<span><small>Récords</small>🏆 ${nRec}</span>` : ''}</div>
    ${recs.length ? `<div class="co-recs">${recs.slice(0, completo ? 99 : 3).map((r) => `<div>🏆 <b>${esc(r.nombre)}</b> · ${(r.records || []).map((x) => `${esc(x.tipo)}: ${esc(x.texto)}`).join(' · ')}</div>`).join('')}</div>` : ''}
    <div class="co-ejs">${mostrar.map((e) => {
      const validas = (e.series || []).filter((s) => s.tipo !== 'calentamiento');
      const vel = (e.series || []).filter((s) => s.v > 0);
      if (completo) {
        return `<div class="co-ej"><b>${esc(e.icono || '🏋️')} ${esc(e.nombre)}</b>${(e.series || []).map((s, i) => `<div class="co-serie${s.tipo === 'calentamiento' ? ' cal' : ''}"><span>${s.tipo === 'calentamiento' ? 'C' : s.tipo === 'fallo' ? 'F' : s.tipo === 'drop' ? 'D' : i + 1 - (e.series.slice(0, i).filter((x) => x.tipo === 'calentamiento').length)}</span><span>${resumenSerie(s)}</span>${s.v > 0 ? `<span class="co-vel">⚡ ${fmt(s.v, 2)} m/s</span>` : ''}</div>`).join('')}</div>`;
      }
      const m = mejorSerie(e);
      return `<div class="co-ej-linea"><span>${esc(e.icono || '🏋️')} ${validas.length} × ${esc(e.nombre)}</span><span>${m ? resumenSerie(m) : ''}${vel.length ? ` <span class="co-vel">⚡ ${fmt(Math.max(...vel.map((s) => s.v)), 2)}</span>` : ''}</span></div>`;
    }).join('')}${!completo && ejs.length > 4 ? `<div class="hint">y ${ejs.length - 4} ejercicio${ejs.length - 4 > 1 ? 's' : ''} más…</div>` : ''}</div></div>`;
}
function tarjeta(p) {
  const mia = yo && yo.perfil && p.autor.id === yo.perfil.id;
  return `<article class="card co-pub" data-id="${esc(p.id)}">
    <header class="co-pub-cab"><button type="button" class="co-autor" data-alias="${esc(p.autor.alias)}">${avatar(p.autor)}<div><strong>${esc(p.autor.nombre)}</strong><small>@${esc(p.autor.alias)} · ${hace(p.creado)}${p.editado ? ' · editado' : ''}</small></div></button>
      <button type="button" class="co-ico co-menu" aria-label="Opciones">⋯</button></header>
    ${p.texto ? `<p class="co-texto">${esc(p.texto)}</p>` : ''}
    <div class="co-abrir">${bloqueEntreno(p.datos)}</div>
    <footer class="co-pub-pie"><button type="button" class="co-like${p.meGusta ? ' activo' : ''}">${p.meGusta ? '❤️' : '🤍'} <span>${p.likes}</span></button>
      <button type="button" class="co-coment">💬 <span>${p.comentarios}</span></button>${mia ? '<span class="co-tuya">Tu publicación</span>' : ''}</footer>
  </article>`;
}
function conectarTarjetas(cont, pubs) {
  const porId = new Map(pubs.map((p) => [p.id, p]));
  cont.querySelectorAll('.co-pub:not([data-ok])').forEach((el) => {
    el.dataset.ok = '1';
    const p = porId.get(el.dataset.id); if (!p) return;
    el.querySelector('.co-autor').onclick = () => abrirPerfil(p.autor.alias);
    const ab = el.querySelector('.co-abrir'); if (ab) ab.onclick = () => abrirPublicacion(p.id);
    // dentro del detalle, el boton de comentarios solo lleva al cuadro de texto
    el.querySelector('.co-coment').onclick = () => (el.closest('#co-modal-cuerpo') && $('co-com-in') ? $('co-com-in').focus() : abrirPublicacion(p.id, true));
    el.querySelector('.co-like').onclick = (ev) => darLike(p, ev.currentTarget);
    el.querySelector('.co-menu').onclick = () => menuPublicacion(p, el);
  });
}
async function darLike(p, btn) {
  const antes = p.meGusta;
  p.meGusta = !antes; p.likes += antes ? -1 : 1; // respuesta inmediata; se corrige con la del servidor
  const pintarBtn = () => { btn.classList.toggle('activo', p.meGusta); btn.innerHTML = `${p.meGusta ? '❤️' : '🤍'} <span>${p.likes}</span>`; };
  pintarBtn();
  try { const r = await api(antes ? 'DELETE' : 'POST', `publicaciones/${p.id}/like`); p.likes = r.likes; p.meGusta = r.meGusta; } catch (e) { p.meGusta = antes; p.likes += antes ? 1 : -1; error(e); }
  pintarBtn();
}
function menuPublicacion(p, el) {
  const mia = yo.perfil && p.autor.id === yo.perfil.id;
  const op = [];
  if (p.datos && Array.isArray(p.datos.ejercicios) && p.datos.ejercicios.length) op.push(['💾', 'Guardar como rutina', () => copiarRutina(p)]);
  if (mia) {
    op.push(['✏️', 'Editar texto', async () => {
      const t = prompt('Texto de la publicación', p.texto || ''); if (t === null) return;
      try { const r = await api('POST', 'publicaciones', { ref: p.ref, texto: t, datos: p.datos }); Object.assign(p, r.publicacion); if (el) { el.outerHTML = tarjeta(p); conectarTarjetas(document, [p]); } } catch (e) { error(e); }
    }]);
    op.push(['🗑️', 'Borrar publicación', async () => {
      if (!confirm('¿Borrar esta publicación? Se borran también sus likes y comentarios.')) return;
      try { await api('DELETE', 'publicaciones/' + p.id); if (el) el.remove(); cerrarModal(); quitarCompartido(p.ref); } catch (e) { error(e); }
    }, true]);
  } else {
    op.push(['🚩', 'Reportar publicación', () => reportar('publicacion', p.id)]);
    op.push(['🚫', `Bloquear a @${p.autor.alias}`, () => bloquear(p.autor)]);
  }
  hoja(op);
}
function copiarRutina(p) {
  const n = prompt('Nombre de la rutina', `${p.datos.titulo || 'Rutina'} · @${p.autor.alias}`); if (!n || !n.trim()) return;
  deps.guardarRutina(n.trim(), p.datos.ejercicios.map((e) => ({ ej: e.ej && deps.porId[e.ej] ? e.ej : null, nombre: e.nombre,
    series: (e.series || []).map((s) => ({ tipo: s.tipo || 'normal', reps: s.reps ?? null, rpe: s.rpe ?? null })) })));
  alert(`Rutina "${n.trim()}" guardada. La encuentras en Entrenar.`);
}

// ------------------------------------------------------------------ detalle y comentarios
async function abrirPublicacion(id, alComentar = false) {
  modal('<p class="hint co-cargando">Cargando…</p>');
  let r;
  try { r = await api('GET', 'publicaciones/' + id); } catch (e) { $('co-modal-cuerpo').innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; return; }
  const p = r.publicacion;
  const pintarC = (cs) => cs.map((c) => `<div class="co-com" data-id="${esc(c.id)}">${avatar(c.autor, 'chico')}<div class="co-com-txt"><b class="co-com-autor" data-alias="${esc(c.autor.alias)}">${esc(c.autor.nombre)}</b> <small>${hace(c.creado)}</small><p>${esc(c.texto)}</p></div>
    <button type="button" class="co-ico co-com-menu" aria-label="Opciones">⋯</button></div>`).join('');
  modal(`${tarjeta(p).replace('<div class="co-abrir">' + bloqueEntreno(p.datos) + '</div>', bloqueEntreno(p.datos, true))}
    <label class="section-title" style="margin-top:14px">Comentarios</label>
    <div id="co-coms">${r.comentarios.length ? pintarC(r.comentarios) : '<p class="hint" id="co-sin-com">Sé el primero en comentar.</p>'}</div>
    <div class="co-escribir"><textarea id="co-com-in" maxlength="500" rows="1" placeholder="Escribe un comentario…"></textarea><button type="button" class="btn-primary" id="co-com-ok">Enviar</button></div>`);
  const cuerpo = $('co-modal-cuerpo');
  conectarTarjetas(cuerpo, [p]);
  const conectarC = (cs) => {
    cuerpo.querySelectorAll('.co-com:not([data-ok])').forEach((el) => {
      el.dataset.ok = '1';
      const c = cs.find((x) => x.id === el.dataset.id); if (!c) return;
      el.querySelector('.co-com-autor').onclick = () => { cerrarModal(); abrirPerfil(c.autor.alias); };
      el.querySelector('.co-com-menu').onclick = () => {
        const mio = c.autor.id === yo.perfil.id, deMiPub = p.autor.id === yo.perfil.id;
        const op = [];
        if (mio || deMiPub) op.push(['🗑️', 'Borrar comentario', async () => { try { await api('DELETE', 'comentarios/' + c.id); el.remove(); } catch (e) { error(e); } }, true]);
        if (!mio) { op.push(['🚩', 'Reportar comentario', () => reportar('comentario', c.id)]); op.push(['🚫', `Bloquear a @${c.autor.alias}`, () => bloquear(c.autor)]); }
        hoja(op);
      };
    });
  };
  const todos = [...r.comentarios];
  conectarC(todos);
  $('co-com-ok').onclick = async () => {
    const t = $('co-com-in').value.trim(); if (!t) return;
    $('co-com-ok').disabled = true;
    try {
      const x = await api('POST', `publicaciones/${p.id}/comentarios`, { texto: t });
      todos.push(x.comentario); $('co-sin-com')?.remove();
      $('co-coms').insertAdjacentHTML('beforeend', pintarC([x.comentario])); conectarC(todos);
      $('co-com-in').value = '';
      const n = cuerpo.querySelector('.co-coment span'); if (n) n.textContent = +n.textContent + 1;
    } catch (e) { error(e); } finally { $('co-com-ok').disabled = false; }
  };
  if (alComentar) setTimeout(() => $('co-com-in')?.focus(), 150);
}

// ------------------------------------------------------------------ perfiles
async function abrirPerfil(alias) {
  modal('<p class="hint co-cargando">Cargando…</p>');
  let r;
  try { r = await api('GET', 'u/' + encodeURIComponent(alias)); } catch (e) { $('co-modal-cuerpo').innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; return; }
  const pf = r.perfil;
  modal(`<div class="co-perfil">${avatar(pf, 'grande')}<div><h3>${esc(pf.nombre)}</h3><small>@${esc(pf.alias)}${pf.meSigue && !pf.esYo ? ' · te sigue' : ''}</small>
      ${pf.gimnasio || pf.categoria ? `<div class="hint">${[pf.gimnasio, pf.categoria].filter(Boolean).map(esc).join(' · ')}</div>` : ''}</div></div>
    ${pf.bio ? `<p class="co-bio">${esc(pf.bio)}</p>` : ''}
    <div class="co-cuentas"><span><b>${fmt(pf.publicaciones)}</b> entrenos</span><span><b>${fmt(pf.seguidores)}</b> seguidores</span><span><b>${fmt(pf.siguiendo)}</b> siguiendo</span></div>
    <div class="co-perfil-botones">${pf.esYo
      ? '<button type="button" class="btn-sec" id="co-editar">✏️ Editar perfil</button><button type="button" class="btn-sec" id="co-mas-yo">⋯</button>'
      : pf.bloqueado ? '<button type="button" class="btn-sec" id="co-desbloquear">Desbloquear</button>'
        : `<button type="button" class="${pf.loSigo ? 'btn-sec' : 'btn-primary'}" id="co-seguir">${pf.loSigo ? 'Siguiendo ✓' : 'Seguir'}</button><button type="button" class="btn-sec" id="co-mas-otro">⋯</button>`}</div>
    <div id="co-pubs-u"></div><div id="co-mas-u"></div>`);
  if (pf.esYo) {
    $('co-editar').onclick = editarPerfil;
    $('co-mas-yo').onclick = () => hoja([
      ['🚫', 'Personas bloqueadas', verBloqueados],
      ['📜', 'Normas de la comunidad', () => window.open('normas.html', '_blank')],
      ['🚪', 'Dejar la comunidad (borra tu perfil y publicaciones)', async () => {
        if (!confirm('¿Dejar la comunidad? Se borran tu perfil público, tus publicaciones, comentarios y likes. Tus datos de entrenamiento no se tocan.')) return;
        try { await api('DELETE', 'perfil'); guardarJ(COMPARTIDOS, {}); yo.perfil = null; cerrarModal(); pintar(); } catch (e) { error(e); }
      }, true],
    ]);
  } else if (pf.bloqueado) {
    $('co-desbloquear').onclick = async () => { try { await api('DELETE', 'bloquear/' + encodeURIComponent(pf.id)); abrirPerfil(pf.alias); } catch (e) { error(e); } };
  } else {
    $('co-seguir').onclick = async () => {
      try { await api(pf.loSigo ? 'DELETE' : 'POST', 'seguir/' + encodeURIComponent(pf.id)); abrirPerfil(pf.alias); } catch (e) { error(e); }
    };
    $('co-mas-otro').onclick = () => hoja([['🚩', 'Reportar perfil', () => reportar('usuario', pf.id)], ['🚫', `Bloquear a @${pf.alias}`, () => bloquear(pf)]]);
  }
  if (!pf.bloqueado) cargarPubsUsuario(pf.id, null);
}
async function cargarPubsUsuario(uid, desde) {
  const cont = $('co-pubs-u'), mas = $('co-mas-u'); if (!cont) return;
  try {
    const r = await api('GET', `feed?modo=usuario&u=${encodeURIComponent(uid)}${desde ? '&antes=' + desde : ''}`);
    if (!desde && !r.publicaciones.length) cont.innerHTML = '<p class="hint" style="text-align:center;margin-top:16px">Todavía no ha compartido entrenamientos.</p>';
    r.publicaciones.forEach((p) => cont.insertAdjacentHTML('beforeend', tarjeta(p)));
    conectarTarjetas(cont, r.publicaciones);
    mas.innerHTML = r.antes ? '<button type="button" class="btn-sec co-mas-btn">Ver más</button>' : '';
    if (r.antes) mas.firstChild.onclick = () => cargarPubsUsuario(uid, r.antes);
  } catch (e) { cont.innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; }
}
async function verBloqueados() {
  try {
    const r = await api('GET', 'bloqueados');
    modal(`<h3 class="en-det-titulo">Personas bloqueadas</h3>${r.personas.length ? `<div class="co-personas">${r.personas.map((a) => `<div class="co-persona">${avatar(a)}<div class="co-persona-txt"><strong>${esc(a.nombre)}</strong><small>@${esc(a.alias)}</small></div><button type="button" class="btn-sec" data-id="${esc(a.id)}">Desbloquear</button></div>`).join('')}</div>` : '<p class="hint">No has bloqueado a nadie.</p>'}`);
    $('co-modal-cuerpo').querySelectorAll('[data-id]').forEach((b) => (b.onclick = async () => { try { await api('DELETE', 'bloquear/' + encodeURIComponent(b.dataset.id)); b.closest('.co-persona').remove(); } catch (e) { error(e); } }));
  } catch (e) { error(e); }
}
async function bloquear(a) {
  if (!confirm(`¿Bloquear a @${a.alias}? No verás su contenido, no podrá ver el tuyo ni comentarte, y dejarán de seguirse.`)) return;
  try { await api('POST', 'bloquear/' + encodeURIComponent(a.id)); cerrarModal(); alert(`Bloqueaste a @${a.alias}.`); if (yo.perfil) pintarFeed(); } catch (e) { error(e); }
}
function reportar(tipo, id) {
  modal(`<h3 class="en-det-titulo">¿Por qué lo reportas?</h3><p class="hint">El reporte es anónimo. Lo revisamos y, si incumple las normas, lo quitamos.</p>
    <div class="co-motivos">${MOTIVOS.map(([k, t]) => `<label><input type="radio" name="co-motivo" value="${k}"> ${t}</label>`).join('')}</div>
    <textarea id="co-rep-det" maxlength="300" rows="2" placeholder="Detalle (opcional)"></textarea>
    <button type="button" class="btn-primary" id="co-rep-ok" style="margin-top:10px">Enviar reporte</button>`);
  $('co-rep-ok').onclick = async () => {
    const m = document.querySelector('input[name="co-motivo"]:checked'); if (!m) return alert('Elige un motivo.');
    try { await api('POST', 'reportar', { tipo, id, motivo: m.value, detalle: $('co-rep-det').value.trim() }); cerrarModal(); alert('Gracias. Recibimos tu reporte.'); } catch (e) { error(e); }
  };
}

// ------------------------------------------------------------------ buscar
function buscar() {
  modal(`<h3 class="en-det-titulo">Buscar atletas</h3><input id="co-q" class="buscar" placeholder="Nombre, @usuario o gimnasio" autocomplete="off" autocapitalize="none">
    <div id="co-res" class="co-personas"></div>`);
  let t = null;
  const res = $('co-res');
  const correr = async () => {
    const q = $('co-q').value.trim();
    try {
      const r = q.length >= 2 ? await api('GET', 'buscar?q=' + encodeURIComponent(q)) : await api('GET', 'sugerencias');
      res.innerHTML = r.personas.length ? (q.length < 2 ? '<p class="hint">Sugerencias</p>' : '') + r.personas.map(persona).join('') : '<p class="hint">Sin resultados.</p>';
      conectarPersonas(res);
    } catch (e) { res.innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; }
  };
  $('co-q').oninput = () => { clearTimeout(t); t = setTimeout(correr, 300); };
  correr();
  setTimeout(() => $('co-q')?.focus(), 150);
}

// ------------------------------------------------------------------ actividad
async function revisarActividad() {
  try {
    const r = await api('GET', 'actividad');
    const visto = +(localStorage.getItem(VISTO) || 0);
    const n = r.actividad.filter((a) => a.creado > visto).length;
    const b = $('co-badge'); if (b) { b.textContent = n > 9 ? '9+' : n; b.style.display = n && modo !== 'actividad' ? '' : 'none'; }
    return r.actividad;
  } catch (e) { return null; }
}
async function pintarActividad() {
  const lista = $('co-lista');
  lista.innerHTML = '<p class="hint co-cargando">Cargando…</p>';
  const act = await revisarActividad();
  if (!act) { lista.innerHTML = '<p class="pf-nube-error">No pude cargar la actividad.</p>'; return; }
  const visto = +(localStorage.getItem(VISTO) || 0);
  try { localStorage.setItem(VISTO, String(Date.now())); } catch (e) { /* nada */ }
  if (!act.length) { lista.innerHTML = '<div class="card co-vacio"><p>Aquí verás quién le da ❤️ a tus entrenamientos, quién te comenta y quién empieza a seguirte.</p></div>'; return; }
  lista.innerHTML = `<div class="card co-act">${act.map((a, i) => `<button type="button" class="co-act-fila${a.creado > visto ? ' nueva' : ''}" data-i="${i}">${avatar(a.autor)}
    <span><b>${esc(a.autor.nombre)}</b> ${a.tipo === 'like' ? 'le dio ❤️ a tu entrenamiento' : a.tipo === 'comentario' ? `comentó: “${esc(a.texto)}”` : 'empezó a seguirte'}<small>${hace(a.creado)}</small></span></button>`).join('')}</div>`;
  lista.querySelectorAll('.co-act-fila').forEach((b) => (b.onclick = () => {
    const a = act[+b.dataset.i];
    if (a.publicacion) abrirPublicacion(a.publicacion, a.tipo === 'comentario'); else abrirPerfil(a.autor.alias);
  }));
}

// ------------------------------------------------------------------ moderacion (solo administradores)
async function moderar() {
  modal('<p class="hint co-cargando">Cargando…</p>');
  try {
    const [r, f] = await Promise.all([nube.api('GET', '/api/mod/reportes'), nube.api('GET', '/api/mod/fallos').catch(() => ({ fallos: [] }))]);
    const nombre = { publicacion: 'Publicación', comentario: 'Comentario', usuario: 'Perfil' };
    const pend = f.fallos.filter((x) => x.estado === 'pendiente');
    const fallosHtml = `<h4>🐞 Fallos de conteo reportados${pend.length ? ` · ${pend.length} pendiente${pend.length > 1 ? 's' : ''}` : ''}</h4>${f.fallos.length
      ? f.fallos.slice(0, 30).map((x) => `<div class="card co-rep"><b>${esc(x.nombre || x.ejercicio)}</b> · la app contó ${x.reps_app ?? '?'}, eran ${x.reps_real ?? '?'}
        <small class="hint"> · ${hace(x.creado)} · v${esc(x.version || '?')} · ${esc(x.estado)}${x.pose_bytes ? '' : ' · sin puntos'}</small>${x.comentario ? `<p class="co-texto">${esc(x.comentario)}</p>` : ''}</div>`).join('')
      : '<p class="hint">Sin fallos reportados.</p>'}<p class="hint">Pídele a Claude «revisa los fallos reportados» para corregirlos.</p>`;
    modal(`<h3 class="en-det-titulo">🛡️ Moderación</h3>${fallosHtml}<h4>Reportes de la comunidad</h4>${r.reportes.length ? r.reportes.map((x, i) => `<div class="card co-rep" data-i="${i}">
        <b>${nombre[x.tipo]}${x.alias ? ' de @' + esc(x.alias) : ''}</b> · ${x.n} reporte${x.n > 1 ? 's' : ''}${x.oculto ? ' · <span class="pf-nube-error">oculto</span>' : ''}
        <p class="co-texto">${esc(x.contenido || '(ya no existe)')}</p><p class="hint">${esc(x.motivos)}</p>
        <div class="co-perfil-botones">${x.tipo !== 'usuario' ? `<button type="button" class="btn-sec" data-a="${x.oculto ? 'mostrar' : 'ocultar'}">${x.oculto ? 'Mostrar' : 'Ocultar'}</button>` : ''}
          <button type="button" class="btn-sec peligro" data-a="borrar">${x.tipo === 'usuario' ? 'Sacar de la comunidad' : 'Borrar'}</button><button type="button" class="btn-sec" data-a="descartar">Descartar</button></div></div>`).join('') : '<p class="hint">No hay reportes pendientes. 🎉</p>'}`);
    $('co-modal-cuerpo').querySelectorAll('.co-rep [data-a]').forEach((b) => (b.onclick = async () => {
      const x = r.reportes[+b.closest('.co-rep').dataset.i];
      if (b.dataset.a === 'borrar' && !confirm('¿Seguro? No se puede deshacer.')) return;
      try { await nube.api('POST', '/api/mod/accion', { tipo: x.tipo, id: x.id, accion: b.dataset.a }); moderar(); } catch (e) { error(e); }
    }));
  } catch (e) { $('co-modal-cuerpo').innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; }
}

// ------------------------------------------------------------------ compartir un entrenamiento
// en: entrenamiento guardado · recs: records de ese dia (progreso.recordsNuevos)
export const compartido = (id) => leerJ(COMPARTIDOS, {})[id] || null;
function quitarCompartido(ref) { const c = leerJ(COMPARTIDOS, {}); delete c[ref]; guardarJ(COMPARTIDOS, c); }

export function resumen(en, recs = []) {
  const cuenta = (s) => s.tipo !== 'calentamiento';
  const num = (x) => (Number.isFinite(+x) && x !== null && x !== '' ? +x : null);
  const ejercicios = en.ejercicios.slice(0, 30).map((e) => {
    const def = e.ej && deps.porId[e.ej];
    return { ej: e.ej || null, nombre: String(def ? def.nombre : e.nombre || 'Ejercicio').slice(0, 80), icono: def ? def.icono : '🏋️',
      series: e.series.slice(0, 40).map((s) => ({ kg: num(s.kg), reps: num(s.reps), rpe: num(s.rpe), tipo: s.tipo || 'normal',
        ...(s.analisis && s.analisis.v ? { v: Math.round(s.analisis.v * 100) / 100 } : {}) })) };
  });
  const series = en.ejercicios.reduce((a, e) => a + e.series.filter(cuenta).length, 0);
  const volumen = en.ejercicios.reduce((a, e) => a + e.series.filter(cuenta).reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
  const duracion = en.fin ? Math.max(0, Math.round((new Date(en.fin) - new Date(en.inicio)) / 60000)) : null;
  return { v: 1, titulo: String(en.titulo || 'Entrenamiento').slice(0, 80), inicio: en.inicio, duracion: duracion && duracion < 600 ? duracion : null,
    volumen: Math.round(volumen), series, ejercicios,
    records: (recs || []).slice(0, 20).map((r) => ({ nombre: String(r.nombre).slice(0, 80), records: r.records.slice(0, 6).map((x) => ({ tipo: x.tipo, texto: x.texto })) })) };
}

export async function compartir(en, recs) {
  if (!nube.conectado()) {
    if (confirm('Para compartir en la comunidad necesitas iniciar sesión. ¿Ir a la Comunidad?')) deps.vista('v-comunidad');
    return;
  }
  const uid = nube.sesion().usuario.id;
  try { if (!yo || yo.uid !== uid) yo = { ...(await api('GET', 'yo')), uid }; } catch (e) { return error(e); }
  if (!yo.perfil) {
    if (confirm('Primero crea tu perfil de la comunidad (1 minuto). ¿Ir ahora?')) deps.vista('v-comunidad');
    return;
  }
  const datos = resumen(en, recs), previo = compartido(en.id);
  modal(`<h3 class="en-det-titulo">📣 ${previo ? 'Actualizar publicación' : 'Compartir en la comunidad'}</h3>
    <textarea id="co-pub-txt" maxlength="1000" rows="3" placeholder="¿Cómo te fue? (opcional)">${esc(previo && previo.texto ? previo.texto : en.descripcion || '')}</textarea>
    <p class="hint">Así lo verán tus seguidores y la pestaña Descubrir:</p>
    <div class="co-previa">${bloqueEntreno(datos)}</div>
    <button type="button" class="btn-primary" id="co-publicar" style="margin-top:12px">${previo ? 'Actualizar' : 'Publicar'}</button>`);
  $('co-publicar').onclick = async () => {
    $('co-publicar').disabled = true;
    try {
      const texto = $('co-pub-txt').value.trim();
      const r = await api('POST', 'publicaciones', { ref: en.id, texto, datos });
      const c = leerJ(COMPARTIDOS, {}); c[en.id] = { id: r.publicacion.id, texto, fecha: Date.now() }; guardarJ(COMPARTIDOS, c);
      cerrarModal();
      alert(previo ? 'Publicación actualizada.' : '¡Publicado! Tus seguidores ya lo pueden ver.');
    } catch (e) { error(e); const b = $('co-publicar'); if (b) b.disabled = false; }
  };
}

// al cerrar sesion se olvida el perfil cargado
export function olvidar() { yo = null; try { localStorage.removeItem('af_co_alias'); } catch (e) { /* nada */ } }
// alias publico para firmar las tarjetas; se recuerda en el telefono para no pedirlo al servidor cada vez
export async function aliasPropio() {
  if (yo && yo.perfil) { try { localStorage.setItem('af_co_alias', yo.perfil.alias); } catch (e) { /* nada */ } return yo.perfil.alias; }
  try { const a = localStorage.getItem('af_co_alias'); if (a) return a; } catch (e) { /* nada */ }
  if (!nube.conectado()) return '';
  try { const uid = nube.sesion().usuario.id; yo = { ...(await api('GET', 'yo')), uid }; return yo.perfil ? aliasPropio() : ''; } catch (e) { return ''; }
}
