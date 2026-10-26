// Pestaña Perfil: datos del atleta, marcas de powerlifting (total y DOTS), estadisticas de entrenamiento,
// registro de peso corporal, ajustes y respaldo completo de todos los datos del telefono.
import * as almacen from './almacen.js';
import * as P from './progreso.js';
import * as nube from './nube.js';
import * as bienvenida from './bienvenida.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const leerJ = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? def; } catch (e) { return def; } };
const guardarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let deps = null; // { vista, version }

// DOTS: coeficientes oficiales (hombres / mujeres)
const DOTS = { h: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093], m: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706] };
export function dots(total, pc, sexo = 'h') {
  if (!(total > 0) || !(pc > 30)) return null;
  const k = DOTS[sexo === 'm' ? 'm' : 'h'], w = Math.min(pc, sexo === 'm' ? 150 : 210);
  return total * 500 / (k[0] + k[1] * w + k[2] * w ** 2 + k[3] * w ** 3 + k[4] * w ** 4);
}

// datos corporales compartidos con Nutricion (sexo, edad, peso, estatura)
const perfilCuerpo = () => leerJ('af_nutri_perfil', {});
function pesoActual() {
  const log = leerJ('af_peso_log', []);
  if (log.length) return log[log.length - 1].kg;
  return perfilCuerpo().peso || parseFloat(localStorage.getItem('af_pc')) || null;
}

export function iniciar(d) {
  deps = d;
  $('pf-editar').onclick = editar;
  $('pf-peso-ok').onclick = registrarPeso;
  $('pf-ir-historial').onclick = () => deps.vista('v-historial');
  $('pf-ir-guia').onclick = () => deps.vista('v-guia');
  $('pf-respaldo').onclick = exportarRespaldo;
  $('pf-restaurar').onclick = () => $('pf-archivo').click();
  $('pf-archivo').onchange = restaurar;
  $('pf-det-cerrar').onclick = () => { $('pf-modal').style.display = 'none'; };
}

// ------------------------------------------------------------------ cuenta y nube
const hace = (iso) => {
  if (!iso) return 'nunca';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? 'hace un momento' : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : new Date(iso).toLocaleDateString('es-EC');
};
export function pintarNube(est = nube.estadoActual()) {
  const cont = $('pf-nube'); if (!cont) return;
  const s = nube.sesion();
  if (!s || !s.token) {
    cont.innerHTML = `<p class="pf-nube-txt">Inicia sesión para guardar tus entrenamientos, comidas y análisis en la nube y tenerlos en cualquier teléfono. Sin cuenta la app sigue funcionando igual, solo en este teléfono.</p>
      <div id="pf-google" class="pf-google"><span class="hint">Cargando Google…</span></div>
      <button type="button" class="btn-sec pf-correo" id="pf-correo">✉️ Usar otro correo</button>
      ${est.error ? `<p class="pf-nube-error">${esc(est.error)}</p>` : ''}
      <p class="hint">Solo recibimos tu nombre, correo y foto de Google. <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>`;
    $('pf-correo').onclick = () => bienvenida.abrir('registro');
    nube.botonGoogle($('pf-google'), {
      alEntrar: () => pintar(),
      alError: (e) => { pintarNube({ ...nube.estadoActual(), error: e.message || String(e) }); },
    }).catch((e) => { const g = $('pf-google'); if (g) g.innerHTML = `<p class="pf-nube-error">${esc(e.message)}</p>`; });
    return;
  }
  const u = s.usuario || {};
  const txt = est.fase === 'sincronizando' ? '🔄 Sincronizando…' : est.error ? `⚠️ ${esc(est.error)}` : `✅ Sincronizado ${hace(est.ultima)}`;
  cont.innerHTML = `<div class="pf-nube-usuario">${u.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">` : ''}
      <div><strong>${esc(u.nombre || 'Tu cuenta')}</strong><small>${esc(u.email || '')}</small></div></div>
    <p class="pf-nube-estado${est.error ? ' error' : ''}">${txt}</p>
    <div class="pf-menu pf-nube-menu">
      <button type="button" id="pf-sync">🔄 Sincronizar ahora</button>
${u.proveedor === 'correo' ? '<button type="button" id="pf-clave">🔑 Cambiar contraseña</button>' : ''}
      <button type="button" id="pf-salir">🚪 Cerrar sesión</button>
      <button type="button" id="pf-borrar-cuenta" class="peligro">🗑️ Eliminar cuenta y datos de la nube</button>
    </div>
    <p class="hint">Se sincroniza solo al abrir la app, cada 2 minutos y al salir. Los videos se quedan en el teléfono.</p>`;
  $('pf-sync').onclick = () => nube.sincronizar();
  if ($('pf-clave')) $('pf-clave').onclick = async () => {
    const actual = prompt('Contraseña actual'); if (!actual) return;
    const nueva = prompt('Nueva contraseña (mínimo 8 caracteres, con letras y números)'); if (!nueva) return;
    if (prompt('Repite la nueva contraseña') !== nueva) return alert('Las contraseñas no coinciden.');
    try { await nube.cambiarClave(actual, nueva); alert('Contraseña cambiada. Se cerró la sesión en tus otros dispositivos.'); } catch (e) { alert(e.message || String(e)); }
  };
  $('pf-salir').onclick = async () => {
    if (!confirm('¿Cerrar sesión? Tus datos se quedan en este teléfono y en la nube.')) return;
    await nube.sincronizar(); await nube.salir(); pintarNube();
  };
  $('pf-borrar-cuenta').onclick = async () => {
    if (!confirm('¿Eliminar tu cuenta? Se borran para siempre todos tus datos de la nube. Lo que está en este teléfono se queda.')) return;
    if (prompt('Para confirmar escribe ELIMINAR') !== 'ELIMINAR') return;
    try { await nube.borrarCuenta(); alert('Tu cuenta y tus datos de la nube fueron eliminados.'); } catch (e) { alert(e.message || String(e)); }
    pintarNube();
  };
}

export async function pintar() {
  pintarNube();
  const pf = leerJ('af_perfil', {}), cuerpo = perfilCuerpo(), pc = pesoActual();
  $('pf-cabecera').innerHTML = `<div class="pf-foto">${pf.foto ? `<img src="${pf.foto}" alt="">` : `<span>${esc((pf.nombre || '?').trim().charAt(0).toUpperCase() || '?')}</span>`}</div>
    <div class="pf-datos"><strong>${esc(pf.nombre || 'Tu nombre')}</strong>
      <small>${[pf.categoria, pf.gimnasio].filter(Boolean).map(esc).join(' · ') || 'Toca Editar para completar tu perfil'}</small>
      ${pf.bio ? `<p>${esc(pf.bio)}</p>` : ''}</div>`;

  const lista = (await almacen.leerEntrenos()).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  // marcas: 1RM real si lo guardaste, si no el mejor 1RM estimado del registro
  const marca = (ids) => {
    let mejor = null;
    for (const id of ids) {
      const real = P.rmReal(id);
      if (real && (!mejor || real.kg > mejor.kg)) mejor = { kg: real.kg, tipo: 'real' };
      const r = P.registros(lista, id);
      if (r.mejor && !real && (!mejor || r.mejor.valor > mejor.kg)) mejor = { kg: r.mejor.valor, tipo: 'est.' };
    }
    return mejor;
  };
  const sbd = [['Sentadilla', marca(['sentadilla'])], ['Press banca', marca(['press_banca'])], ['Peso muerto', marca(['peso_muerto', 'peso_muerto_sumo'])]];
  const total = sbd.every(([, m]) => m) ? sbd.reduce((a, [, m]) => a + m.kg, 0) : null;
  const d = total && pc ? dots(total, pc, cuerpo.sexo) : null;
  $('pf-pl').innerHTML = `<div class="pf-sbd">${sbd.map(([n, m]) => `<div><small>${n}</small><b>${m ? fmt(m.kg, m.kg % 1 ? 1 : 0) : '--'}</b><i>${m ? (m.tipo === 'real' ? '1RM real' : '1RM est.') : 'sin datos'}</i></div>`).join('')}</div>
    <div class="pf-total"><div><small>Total</small><b>${total ? fmt(total, total % 1 ? 1 : 0) + ' kg' : '--'}</b></div><div><small>Puntos DOTS</small><b>${d ? fmt(d, 1) : '--'}</b></div><div><small>Peso corporal</small><b>${pc ? fmt(pc, 1) + ' kg' : '--'}</b></div></div>
    <p class="hint">${total ? 'Usa tu 1RM real cuando lo guardaste (en Entrenar → 📈) y si no, el mejor 1RM estimado de tus series.' : 'Registra series de sentadilla, banca y peso muerto (o guarda tus 1RM reales) para ver tu total.'}${d ? '' : total ? ' Registra tu peso corporal para calcular los puntos DOTS.' : ''}</p>`;

  // estadisticas
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const mes = lista.filter((e) => new Date(e.inicio) >= inicioMes);
  const vol = (en) => en.ejercicios.reduce((a, e) => a + e.series.filter((s) => s.hecha && s.tipo !== 'calentamiento').reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
  const nAnalisis = (() => { try { return JSON.parse(localStorage.getItem('af_historial_v1') || '[]').length; } catch (e) { return 0; } })();
  $('pf-stats').innerHTML = `<div class="kpi-card"><div class="kpi-label">Entrenamientos</div><div class="kpi-value">${lista.length}</div><div class="kpi-sub">${mes.length} este mes</div></div>
    <div class="kpi-card"><div class="kpi-label">Volumen del mes</div><div class="kpi-value">${fmt(mes.reduce((a, e) => a + vol(e), 0) / 1000, 1)}</div><div class="kpi-sub">toneladas</div></div>
    <div class="kpi-card"><div class="kpi-label">Análisis de video</div><div class="kpi-value">${nAnalisis}</div><div class="kpi-sub">series medidas</div></div>`;

  pintarPeso();
  $('pf-version').textContent = `Versión ${deps.version}`;
}

// ------------------------------------------------------------------ peso corporal
function pintarPeso() {
  const log = leerJ('af_peso_log', []);
  $('pf-peso-in').placeholder = log.length ? fmt(log[log.length - 1].kg, 1) : 'ej.: 90';
  const c = $('pf-peso-graf');
  if (log.length < 2) { c.style.display = 'none'; $('pf-peso-txt').textContent = log.length ? `Último registro: ${fmt(log[0].kg, 1)} kg (${log[0].fecha}).` : 'Pésate en las mañanas, en ayunas, para ver una tendencia confiable.'; return; }
  c.style.display = '';
  const ult = log.slice(-60), a = ult[0], b = ult[ult.length - 1];
  const dias = Math.max(1, (new Date(b.fecha) - new Date(a.fecha)) / 86400000);
  $('pf-peso-txt').textContent = `${b.kg - a.kg >= 0 ? '+' : '−'}${fmt(Math.abs(b.kg - a.kg), 1)} kg en ${Math.round(dias)} días (${fmt(7 * (b.kg - a.kg) / dias, 2)} kg por semana).`;
  const dpr = window.devicePixelRatio || 1, W = c.clientWidth || 320, H = 150;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const ys = ult.map((p) => p.kg); let mn = Math.min(...ys), mx = Math.max(...ys); const pad = Math.max(0.5, (mx - mn) * 0.15); mn -= pad; mx += pad;
  const L = 36, R = 8, T = 8, B = 20, x = (i) => L + (W - L - R) * i / (ult.length - 1), y = (v) => T + (H - T - B) * (1 - (v - mn) / (mx - mn));
  g.font = '10px system-ui, sans-serif'; g.fillStyle = '#8e95a5'; g.strokeStyle = 'rgba(255,255,255,.07)';
  for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - R, y(v)); g.stroke(); g.fillText(fmt(v, 1), 2, y(v) + 3); }
  g.fillText(a.fecha.slice(5), L, H - 5); g.fillText(b.fecha.slice(5), W - R - 28, H - 5);
  g.strokeStyle = '#5aa0ff'; g.lineWidth = 2; g.beginPath(); ult.forEach((p, i) => (i ? g.lineTo(x(i), y(p.kg)) : g.moveTo(x(i), y(p.kg)))); g.stroke();
  g.fillStyle = '#5adc78'; ult.forEach((p, i) => { g.beginPath(); g.arc(x(i), y(p.kg), 2.5, 0, 7); g.fill(); });
}
function registrarPeso() {
  const kg = parseFloat(($('pf-peso-in').value || '').replace(',', '.'));
  if (!(kg > 30 && kg < 300)) return alert('Escribe tu peso en kg.');
  const log = leerJ('af_peso_log', []).filter((p) => p.fecha !== hoyISO());
  log.push({ fecha: hoyISO(), kg }); log.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  guardarJ('af_peso_log', log);
  try { localStorage.setItem('af_pc', String(kg)); } catch (e) { /* nada */ } // lo usa el analisis por video
  guardarJ('af_nutri_perfil', { ...perfilCuerpo(), peso: kg });
  $('pf-peso-in').value = '';
  pintar();
}

// ------------------------------------------------------------------ editar perfil
function editar() {
  const pf = leerJ('af_perfil', {}), c = perfilCuerpo();
  const alt = c.altura || Math.round((parseFloat(localStorage.getItem('af_altura')) || 0) * 100) || '';
  $('pf-modal-cuerpo').innerHTML = `<h3 class="en-det-titulo">Editar perfil</h3>
    <div class="pf-foto-edit"><div class="pf-foto" id="pf-foto-prev">${pf.foto ? `<img src="${pf.foto}" alt="">` : '<span>📷</span>'}</div>
      <div><button type="button" class="btn-sec" id="pf-foto-btn">Cambiar foto</button>${pf.foto ? ' <button type="button" class="btn-sec peligro" id="pf-foto-quitar">Quitar</button>' : ''}</div>
      <input type="file" id="pf-foto-in" accept="image/*" style="display:none"></div>
    <div class="form-grid">
      <div class="form-group full"><label for="pf-nombre">Nombre</label><input id="pf-nombre" maxlength="40" value="${esc(pf.nombre || '')}"></div>
      <div class="form-group"><label for="pf-gim">Gimnasio / equipo</label><input id="pf-gim" maxlength="40" value="${esc(pf.gimnasio || '')}"></div>
      <div class="form-group"><label for="pf-cat">Categoría</label><input id="pf-cat" maxlength="30" placeholder="ej.: Powerlifting −93 kg" value="${esc(pf.categoria || '')}"></div>
      <div class="form-group full"><label for="pf-bio">Sobre ti</label><input id="pf-bio" maxlength="120" placeholder="Objetivos, próxima competencia…" value="${esc(pf.bio || '')}"></div>
      <div class="form-group"><label for="pf-sexo">Sexo (para DOTS y metas)</label><select id="pf-sexo"><option value="h">Hombre</option><option value="m"${c.sexo === 'm' ? ' selected' : ''}>Mujer</option></select></div>
      <div class="form-group"><label for="pf-edad">Edad</label><input id="pf-edad" type="number" inputmode="numeric" value="${c.edad || ''}"></div>
      <div class="form-group"><label for="pf-alt">Estatura (cm)</label><input id="pf-alt" type="number" inputmode="numeric" value="${alt}"></div>
      <div class="form-group"><label for="pf-desc">Descanso por defecto</label><select id="pf-desc">${[['0', 'Sin'], ['60', '1:00'], ['90', '1:30'], ['120', '2:00'], ['180', '3:00'], ['240', '4:00'], ['300', '5:00']].map(([v, t]) => `<option value="${v}"${(localStorage.getItem('af_descanso') || '120') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="en-det-botones"><button type="button" class="btn-sec" id="pf-cancelar">Cancelar</button><button type="button" class="btn-sec en-terminar" id="pf-guardar">Guardar</button></div>`;
  $('pf-modal').style.display = 'flex';
  let foto = pf.foto || null;
  $('pf-foto-btn').onclick = () => $('pf-foto-in').click();
  if ($('pf-foto-quitar')) $('pf-foto-quitar').onclick = () => { foto = null; $('pf-foto-prev').innerHTML = '<span>📷</span>'; };
  $('pf-foto-in').onchange = async () => {
    const f = $('pf-foto-in').files[0]; if (!f) return;
    try { foto = await reducirFoto(f); $('pf-foto-prev').innerHTML = `<img src="${foto}" alt="">`; } catch (e) { alert('No pude abrir esa imagen.'); }
  };
  $('pf-cancelar').onclick = () => { $('pf-modal').style.display = 'none'; };
  $('pf-guardar').onclick = () => {
    const ok = guardarJ('af_perfil', { nombre: $('pf-nombre').value.trim(), gimnasio: $('pf-gim').value.trim(), categoria: $('pf-cat').value.trim(), bio: $('pf-bio').value.trim(), foto });
    if (!ok) return alert('No hay espacio para guardar la foto. Prueba con otra imagen.');
    const alt2 = +$('pf-alt').value;
    guardarJ('af_nutri_perfil', { ...perfilCuerpo(), sexo: $('pf-sexo').value, edad: +$('pf-edad').value || undefined, altura: alt2 || undefined });
    if (alt2 > 120 && alt2 < 240) try { localStorage.setItem('af_altura', String(alt2 / 100)); } catch (e) { /* nada */ }
    try { localStorage.setItem('af_descanso', $('pf-desc').value); } catch (e) { /* nada */ }
    $('pf-modal').style.display = 'none'; pintar();
  };
}
function reducirFoto(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image(), url = URL.createObjectURL(archivo);
    img.onload = () => {
      const lado = 256, c = document.createElement('canvas'); c.width = c.height = lado;
      const s = Math.min(img.width, img.height); // recorte cuadrado centrado
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, lado, lado);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('imagen')); };
    img.src = url;
  });
}

// ------------------------------------------------------------------ respaldo completo
const ALMACENES = ['entrenos', 'comidas', 'informes'];
async function exportarRespaldo() {
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('af_')) ls[k] = localStorage.getItem(k); }
  const datos = { app: 'analizador-fuerza', tipo: 'respaldo', version: 2, fecha: new Date().toISOString(), localStorage: ls };
  for (const a of ALMACENES) datos[a] = await almacen.todos(a);
  const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' });
  const nombre = `respaldo-fuerzapro-${hoyISO()}.json`, f = new File([blob], nombre, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Respaldo FuerzaPro' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function restaurar() {
  const f = $('pf-archivo').files[0]; $('pf-archivo').value = '';
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (e) { return alert('Ese archivo no es un respaldo válido.'); }
  if (!d || d.app !== 'analizador-fuerza' || d.tipo !== 'respaldo') return alert('Ese archivo no es un respaldo de FuerzaPro.');
  const n = (d.entrenos || []).length, c = (d.comidas || []).length;
  if (!confirm(`Respaldo del ${new Date(d.fecha).toLocaleDateString('es-EC')}: ${n} entrenamientos, ${c} comidas registradas y tus ajustes.\n\nSe combina con lo que ya tienes (lo del respaldo reemplaza lo que tenga el mismo registro). ¿Restaurar?`)) return;
  try {
    for (const [k, v] of Object.entries(d.localStorage || {})) {
      if (!k.startsWith('af_')) continue;
      if (k === 'af_historial_v1' || k === 'af_rutinas') { // listas: se combinan por id para no perder lo nuevo
        const actual = JSON.parse(localStorage.getItem(k) || '[]'), viene = JSON.parse(v || '[]');
        const ids = new Set(viene.map((x) => x.id));
        localStorage.setItem(k, JSON.stringify([...actual.filter((x) => !ids.has(x.id)), ...viene]));
      } else localStorage.setItem(k, v);
    }
    for (const a of ALMACENES) if (Array.isArray(d[a]) && d[a].length) await almacen.ponerTodos(a, d[a]);
    alert('Respaldo restaurado. La app se recargará.');
    location.reload();
  } catch (e) { alert('No pude restaurar todo: ' + (e.message || e)); }
}
