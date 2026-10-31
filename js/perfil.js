// Pestaña Perfil: datos del atleta, marcas de powerlifting (total y DOTS), estadisticas de entrenamiento,
// registro de peso corporal, ajustes y respaldo completo de todos los datos del telefono.
import * as almacen from './almacen.js';
import * as P from './progreso.js';
import * as nube from './nube.js';
import * as bienvenida from './bienvenida.js';
import * as hist from './historial.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const leerJ = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? def; } catch (e) { return def; } };
const guardarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let deps = null; // { vista, version, porId, abrirEstadisticas, abrirEjercicios, abrirProgreso, abrirSerie, alias, verPerfil }

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
  // ventanas de Perfil: Estadisticas y Ejercicios las pinta Entrenar (tiene el registro); Medidas y Ajustes, aqui
  const abrir = (id) => { $(id).style.display = 'flex'; };
  const cerrar = (id) => () => { $(id).style.display = 'none'; };
  $('pf-ajustes').onclick = () => abrir('pf-ajustes-modal');
  $('pf-ir-estad').onclick = () => deps.abrirEstadisticas();
  $('pf-ir-ejs').onclick = () => deps.abrirEjercicios();
  $('pf-ir-medidas').onclick = () => { abrir('pf-medidas'); pintarPeso(); };
  for (const id of ['pf-estad', 'pf-medidas', 'pf-ajustes-modal']) $(id + '-cerrar').onclick = cerrar(id);
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
  pintarSocial();

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
  pintarMarcas(lista, marca, pc, cuerpo);

  // estadisticas
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const mes = lista.filter((e) => new Date(e.inicio) >= inicioMes);
  const vol = (en) => en.ejercicios.reduce((a, e) => a + e.series.filter((s) => s.hecha && s.tipo !== 'calentamiento').reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
  const nAnalisis = (() => { try { return JSON.parse(localStorage.getItem('af_historial_v1') || '[]').length; } catch (e) { return 0; } })();
  $('pf-stats').innerHTML = `<div class="kpi-card"><div class="kpi-label">Entrenamientos</div><div class="kpi-value">${lista.length}</div><div class="kpi-sub">${mes.length} este mes</div></div>
    <div class="kpi-card"><div class="kpi-label">Volumen del mes</div><div class="kpi-value">${fmt(mes.reduce((a, e) => a + vol(e), 0) / 1000, 1)}</div><div class="kpi-sub">toneladas</div></div>
    <div class="kpi-card"><div class="kpi-label">Análisis de video</div><div class="kpi-value">${nAnalisis}</div><div class="kpi-sub">series medidas</div></div>`;

  pintarSemanas(lista);
  pintarVideo();
  pintarPeso();
  $('pf-version').textContent = `Versión ${deps.version}`;
}

// ------------------------------------------------------------------ mis marcas (récords, powerlifting, culturismo, crossfit)
const TABS_MARCAS = { rec: 'Récords', pl: 'Powerlifting', bb: 'Culturismo', cf: 'CrossFit', run: 'Running' };
let tabMarcas = localStorage.getItem('af_pf_marcas') || 'rec';
const kgF = (x) => fmt(x, x % 1 ? 1 : 0);
const fechaC = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: '2-digit' });
function pintarMarcas(lista, marca, pc, cuerpo) {
  if (!TABS_MARCAS[tabMarcas]) tabMarcas = 'rec';
  // datos por ejercicio (una sola pasada): clave -> { e (para nombre e icono), r (registros) }
  const ejs = new Map();
  for (const en of lista) for (const e of en.ejercicios) { const k = P.claveEj(e); if (!ejs.has(k)) ejs.set(k, { e }); }
  const reg = (k) => { const x = ejs.get(k); if (!x) return null; if (!x.r) x.r = P.registros(lista, k); return x.r; };
  const nombre = (k) => { const x = ejs.get(k), d = x && x.e.ej && deps.porId && deps.porId[x.e.ej]; return d ? d.nombre : x ? x.e.nombre : k; };
  const icono = (k) => { const x = ejs.get(k), d = x && x.e.ej && deps.porId && deps.porId[x.e.ej]; return d ? d.icono : '🏋️'; };
  let html = '';
  if (tabMarcas === 'rec') {
    const top = [...ejs.keys()].map((k) => [k, reg(k)]).filter(([k, r]) => r && r.maxKg && !/asistid/.test(k)).sort((a, b) => b[1].maxKg.kg - a[1].maxKg.kg).slice(0, 6); // en las asistidas el peso ayuda, no es carga
    html = top.length ? `<div class="pf-recs">${top.map(([k, r], i) => `<button type="button" class="pf-rec" data-k="${esc(k)}"><span class="pf-rec-n">${i + 1}</span><span class="pf-rec-ic">${icono(k)}</span>
        <div><strong>${esc(nombre(k))}</strong><small>${fechaC(r.maxKg.fecha)} · 1RM est. ${r.mejor ? kgF(Math.round(r.mejor.valor)) : '--'} kg</small></div>
        <b>${kgF(r.maxKg.kg)}<small> kg × ${r.maxKg.reps}</small></b></button>`).join('')}</div>
      <p class="hint">Tus levantamientos más pesados, de cualquier ejercicio. Toca uno para ver su progreso.</p>`
      : '<p class="hint" style="margin:0">Registra series con peso para ver aquí tus levantamientos más pesados.</p>';
  } else if (tabMarcas === 'pl') {
    const sbd = [['Sentadilla', marca(['sentadilla'])], ['Press banca', marca(['press_banca'])], ['Peso muerto', marca(['peso_muerto', 'peso_muerto_sumo'])]];
    const total = sbd.every(([, m]) => m) ? sbd.reduce((a, [, m]) => a + m.kg, 0) : null;
    const d = total && pc ? dots(total, pc, cuerpo.sexo) : null;
    html = `<div class="pf-sbd">${sbd.map(([n, m]) => `<div><small>${n}</small><b>${m ? fmt(m.kg, m.kg % 1 ? 1 : 0) : '--'}</b><i>${m ? (m.tipo === 'real' ? '1RM real' : '1RM est.') : 'sin datos'}</i></div>`).join('')}</div>
    <div class="pf-total"><div><small>Total</small><b>${total ? fmt(total, total % 1 ? 1 : 0) + ' kg' : '--'}</b></div><div><small>Puntos DOTS</small><b>${d ? fmt(d, 1) : '--'}</b></div><div><small>Peso corporal</small><b>${pc ? fmt(pc, 1) + ' kg' : '--'}</b></div></div>
    <p class="hint">${total ? 'Usa tu 1RM real cuando lo guardaste (en la ficha del ejercicio) y si no, el mejor 1RM estimado de tus series.' : 'Registra series de sentadilla, banca y peso muerto (o guarda tus 1RM reales) para ver tu total.'}${d ? '' : total ? ' Registra tu peso corporal para calcular los puntos DOTS.' : ''}</p>`;
  } else if (tabMarcas === 'bb') {
    // culturismo: series por semana de cada grupo (ultimas 4 semanas) y el ejercicio mas fuerte del grupo
    const GR = ['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Piernas', 'Glúteo y femoral'];
    const series = P.seriesPorGrupo(lista, deps.porId || {}, new Date(Date.now() - 28 * 86400000));
    const grupoDe = (k) => { const x = ejs.get(k), d = x && x.e.ej && deps.porId && deps.porId[x.e.ej]; return d ? d.musculo || d.grupo : null; };
    html = `<div class="pf-bb">${GR.map((g) => {
      const n = (series[g] || 0) / 4;
      let mejor = null;
      for (const k of ejs.keys()) { if (grupoDe(k) !== g) continue; const r = reg(k); if (r && r.mejor && (!mejor || r.mejor.valor > mejor[1].mejor.valor)) mejor = [k, r]; }
      return `<div class="${n >= 10 && n <= 20 ? 'ok' : n > 20 ? 'alto' : n > 0 ? 'bajo' : ''}"><small>${g}</small><b>${fmt(n, n % 1 && n < 10 ? 1 : 0)}</b><i>series/sem</i>
        ${mejor ? `<em data-k="${esc(mejor[0])}">${esc(nombre(mejor[0]))} · ${kgF(Math.round(mejor[1].mejor.valor))}</em>` : '<em>sin datos</em>'}</div>`;
    }).join('')}</div>
      <p class="hint">Promedio de series efectivas por semana en las últimas 4 semanas (lo ideal para crecer: 10 a 20, en verde) y tu ejercicio más fuerte de cada grupo (1RM est.).</p>`;
  } else if (tabMarcas === 'run') {
    // running: carreras (correr, cinta, intervalos) y minutos de todo el cardio
    const def = (e) => e.ej && deps.porId && deps.porId[e.ej];
    const ahora = new Date(), iniMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1), iniAno = new Date(ahora.getFullYear(), 0, 1);
    const carreras = []; let cardioMes = 0;
    for (const en of lista) {
      const t = new Date(en.inicio); let km = 0, min = 0;
      for (const e of en.ejercicios) {
        const d = def(e); if (!d || !d.cardio) continue;
        for (const sr of e.series) {
          if (!sr.hecha) continue;
          if (t >= iniMes) cardioMes += sr.min || 0;
          if (d.correr) { km += sr.km || 0; min += sr.min || 0; }
        }
      }
      if (km > 0 || min > 0) carreras.push({ t, km, min });
    }
    const suma = (desde) => carreras.filter((c) => c.t >= desde).reduce((a, c) => a + c.km, 0);
    const larga = carreras.reduce((m, c) => (c.km > (m ? m.km : 0) ? c : m), null);
    const rapida = carreras.filter((c) => c.km >= 1 && c.min > 0).reduce((m, c) => (!m || c.min / c.km < m.min / m.km ? c : m), null);
    const ritmo = (c) => { const sg = Math.round((c.min / c.km) * 60); return `${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, '0')}`; };
    const cel = (n, v, sub) => `<div><small>${n}</small><b>${v}</b><i>${sub}</i></div>`;
    html = carreras.length || cardioMes ? `<div class="pf-sbd pf-cf">
        ${cel('Este mes', fmt(suma(iniMes), 1), 'km corridos')}${cel('Este año', fmt(suma(iniAno), suma(iniAno) < 100 ? 1 : 0), 'km corridos')}${cel('Carreras', carreras.length, 'en total')}
        ${cel('Más larga', larga ? fmt(larga.km, 2) : '--', larga ? 'km · ' + fechaC(larga.t) : 'sin datos')}${cel('Mejor ritmo', rapida ? ritmo(rapida) : '--', rapida ? 'min/km · ' + fechaC(rapida.t) : 'sin datos')}
        ${cel('Cardio del mes', fmt(cardioMes / 60, 1), 'horas (todo)')}</div>
      <p class="hint">Carreras = correr, cinta e intervalos. El mejor ritmo cuenta solo carreras de 1 km o más. «Cardio del mes» suma todo el cardio (bici, elíptica, natación…).</p>`
      : '<p class="hint" style="margin:0">Registra cardio en Entrenar (Correr, Cinta, Bicicleta, Elíptica, Natación…) con minutos y kilómetros para ver aquí tus marcas. Si lo tenías en Hevy, vuelve a importar el archivo y se agregará.</p>';
  } else {
    // crossfit: levantamientos olimpicos y de referencia + dominadas (repeticiones)
    const LEV = [['Arranque', ['arranque']], ['Cargada', ['cargada', 'cargada_colgante']], ['Envión', ['envion']], ['Thruster', ['thruster']], ['Sentadilla frontal', ['sentadilla_frontal']]];
    let maxDom = 0;
    for (const en of lista) for (const e of en.ejercicios) if (['dominadas', 'chin_up'].includes(e.ej)) for (const sr of e.series) if (sr.hecha && sr.reps > maxDom) maxDom = sr.reps;
    const celdas = LEV.map(([n, ids]) => [n, marca(ids)]);
    html = `<div class="pf-sbd pf-cf">${celdas.map(([n, m]) => `<div><small>${n}</small><b>${m ? kgF(Math.round(m.kg * 10) / 10) : '--'}</b><i>${m ? (m.tipo === 'real' ? '1RM real' : '1RM est.') : 'sin datos'}</i></div>`).join('')}
      <div><small>Dominadas</small><b>${maxDom || '--'}</b><i>${maxDom ? 'reps máx.' : 'sin datos'}</i></div></div>
      <p class="hint">Tus marcas en los levantamientos de referencia de CrossFit. Registra arranque, cargada, envión, thruster o dominadas para completarlas.</p>`;
  }
  $('pf-pl').innerHTML = `<div class="pf-periodo pf-tabs">${Object.entries(TABS_MARCAS).map(([k, t]) => `<button type="button" data-t="${k}" class="${k === tabMarcas ? 'activo' : ''}">${t}</button>`).join('')}</div>${html}`;
  $('pf-pl').querySelectorAll('.pf-tabs button').forEach((b) => (b.onclick = () => { tabMarcas = b.dataset.t; try { localStorage.setItem('af_pf_marcas', tabMarcas); } catch (e) { /* nada */ } pintarMarcas(lista, marca, pc, cuerpo); }));
  $('pf-pl').querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { const x = ejs.get(b.dataset.k); if (x && deps.abrirProgreso) deps.abrirProgreso(x.e); }));
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

// ------------------------------------------------------------------ v2.20.0: seguidores, ultimas 12 semanas y analisis de video
// seguidores / siguiendo de la Comunidad (si tiene cuenta y perfil publico). Se recuerdan para mostrarlos sin internet.
async function pintarSocial() {
  const cont = $('pf-social'); if (!cont) return;
  const dibujar = (x) => {
    if (!x) { cont.innerHTML = ''; return; }
    cont.innerHTML = `<button type="button" data-a="1"><b>${fmt(x.seguidores)}</b> seguidores</button><button type="button" data-a="1"><b>${fmt(x.siguiendo)}</b> siguiendo</button><button type="button" data-a="1"><b>${fmt(x.publicaciones)}</b> publicados</button>`;
    cont.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => deps.verPerfil(x.alias)));
  };
  if (!nube.conectado()) { dibujar(null); return; }
  dibujar(leerJ('af_pf_social', null));
  try {
    const alias = await deps.alias(); if (!alias) { dibujar(null); return; }
    const r = await nube.api('GET', '/api/comunidad/u/' + encodeURIComponent(alias));
    const x = { alias, seguidores: r.perfil.seguidores, siguiendo: r.perfil.siguiendo, publicaciones: r.perfil.publicaciones };
    guardarJ('af_pf_social', x); dibujar(x);
  } catch (e) { /* sin internet: se queda lo recordado */ }
}

const METRICAS = { dur: ['Duración', 'h'], vol: ['Volumen', 't'], ser: ['Series', 'series'], vel: ['⚡ Velocidad', 'm/s'] };
let metrica = localStorage.getItem('af_pf_sem') || 'dur';
const lunesDe = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
let ultimaLista = [];
function pintarSemanas(lista = ultimaLista) {
  ultimaLista = lista;
  if (!METRICAS[metrica]) metrica = 'dur';
  const L0 = lunesDe(new Date()), N = 12;
  const sem = Array.from({ length: N }, (_, i) => { const d = new Date(L0); d.setDate(d.getDate() - 7 * (N - 1 - i)); return { ini: d, dur: 0, vol: 0, ser: 0, vels: [] }; });
  const idx = (f) => { const k = N - 1 - Math.round((L0 - lunesDe(new Date(f))) / (7 * 86400000)); return k >= 0 && k < N ? k : -1; };
  for (const en of lista) {
    const k = idx(en.inicio); if (k < 0) continue;
    if (en.fin) sem[k].dur += Math.min(4, Math.max(0, (new Date(en.fin) - new Date(en.inicio)) / 3600000)); // max 4 h (si se olvido terminar)
    for (const e of en.ejercicios) for (const sr of e.series) if (sr.hecha && sr.tipo !== 'calentamiento') { sem[k].ser++; sem[k].vol += (sr.kg || 0) * (sr.reps || 0) / 1000; }
  }
  for (const r of hist.leer()) { const k = idx(r.fecha); if (k >= 0 && r.vMejor > 0) sem[k].vels.push(r.vMejor); }
  const val = (w) => (metrica === 'vel' ? (w.vels.length ? w.vels.reduce((a, b) => a + b, 0) / w.vels.length : null) : w[metrica]);
  const vals = sem.map(val);
  $('pf-sem-chips').innerHTML = Object.entries(METRICAS).map(([k, [n]]) => `<button type="button" class="chip${k === metrica ? ' active' : ''}" data-m="${k}">${n}</button>`).join('');
  $('pf-sem-chips').querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { metrica = b.dataset.m; try { localStorage.setItem('af_pf_sem', metrica); } catch (e) { /* nada */ } pintarSemanas(); }));
  const dec = metrica === 'vel' ? 2 : metrica === 'ser' ? 0 : 1, uni = METRICAS[metrica][1];
  const conDato = vals.filter((v) => v != null && v > 0), prom = conDato.length ? conDato.reduce((a, b) => a + b, 0) / conDato.length : null;
  const hoy = vals[N - 1];
  $('pf-sem-txt').textContent = !conDato.length
    ? (metrica === 'vel' ? 'Analiza series con video (⚡) para ver aquí cómo evoluciona tu velocidad.' : 'Registra entrenamientos para ver tu progreso semana a semana.')
    : `Esta semana: ${hoy != null ? fmt(hoy, dec) : '--'} ${uni} · promedio: ${fmt(prom, dec)} ${uni} por semana${metrica === 'vel' ? ' (mejor rep de cada serie con video; mezcla ejercicios: compara mejor abajo, por ejercicio)' : ''}.`;
  dibujarSemanas($('pf-sem'), sem, vals, metrica === 'vel', dec);
}
function dibujarSemanas(c, sem, vals, linea, dec) {
  const dpr = window.devicePixelRatio || 1, W = c.clientWidth || 340, H = 160;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const L = 30, B = 20, T = 14, mx = Math.max(...vals.filter((v) => v != null), 0) * 1.15 || 1, n = vals.length, paso = (W - L - 6) / n;
  const y = (v) => T + (H - T - B) * (1 - v / mx), xc = (i) => L + paso * (i + 0.5);
  g.font = '10px system-ui, sans-serif'; g.fillStyle = '#8e95a5'; g.strokeStyle = 'rgba(255,255,255,.07)';
  for (let k = 0; k <= 2; k++) { const v = mx * k / 2; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - 6, y(v)); g.stroke(); g.fillText(fmt(v, linea ? 1 : v >= 10 ? 0 : 1), 2, y(v) + 3); }
  g.textAlign = 'center';
  sem.forEach((w, i) => { if (i % 3 === 2 || i === n - 1) g.fillText(i === n - 1 ? 'esta' : w.ini.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }).replace('.', ''), xc(i), H - 5); });
  if (linea) {
    g.strokeStyle = '#22D3EE'; g.lineWidth = 2; g.beginPath(); let ab = false;
    vals.forEach((v, i) => { if (v == null) return; if (!ab) { g.moveTo(xc(i), y(v)); ab = true; } else g.lineTo(xc(i), y(v)); }); g.stroke();
    vals.forEach((v, i) => { if (v == null) return; g.fillStyle = i === n - 1 ? '#7C5CFF' : '#22D3EE'; g.beginPath(); g.arc(xc(i), y(v), 3.5, 0, 7); g.fill(); });
  } else {
    vals.forEach((v, i) => { if (!(v > 0)) return; g.fillStyle = i === n - 1 ? '#7C5CFF' : 'rgba(124,92,255,.45)'; const h = y(0) - y(v); g.beginPath(); g.roundRect ? g.roundRect(xc(i) - paso * 0.32, y(v), paso * 0.64, h, 3) : g.rect(xc(i) - paso * 0.32, y(v), paso * 0.64, h); g.fill(); });
  }
  const u = vals[n - 1]; if (u != null && u > 0) { g.fillStyle = '#f0f2f5'; g.font = 'bold 11px system-ui, sans-serif'; g.fillText(fmt(u, dec), xc(n - 1), y(u) - 5); }
}

// Analisis de video: lo que nos diferencia de otras apps. Por ejercicio se compara la velocidad CON LA MISMA CARGA
// (la velocidad depende del peso): si con el mismo peso subes mas rapido, estas mas fuerte.
function pintarVideo() {
  const cont = $('pf-video'); if (!cont) return;
  const h = hist.leer().filter((r) => r.vMejor > 0 && r.ejercicio).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!h.length) {
    cont.innerHTML = `<p class="hint" style="margin:0 0 10px">Graba una serie y la IA mide tus reps, tu velocidad, el RIR y tu 1RM. Con el tiempo verás aquí si subes el mismo peso más rápido (= más fuerza).</p>
      <button type="button" class="btn-primary" id="pf-video-ir">⚡ Analizar mi primera serie</button>`;
    $('pf-video-ir').onclick = () => deps.vista('v-form'); return;
  }
  const ahora = Date.now(), dia = 86400000;
  const rango = (a, b) => h.filter((r) => { const t = ahora - new Date(r.fecha); return t >= a * dia && t < b * dia; });
  const media = (l) => (l.length ? l.reduce((x, r) => x + r.vMejor, 0) / l.length : null);
  const mes = rango(0, 30), antes = rango(30, 60), vm = media(mes), va = media(antes);
  // por ejercicio
  const grupos = new Map();
  for (const r of h) { if (!grupos.has(r.ejercicio)) grupos.set(r.ejercicio, []); grupos.get(r.ejercicio).push(r); }
  const filas = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length || (a[1][a[1].length - 1].fecha < b[1][b[1].length - 1].fecha ? 1 : -1)).slice(0, 5).map(([id, l]) => {
    const d = deps.porId && deps.porId[id], nombre = d ? d.nombre : l[0].nombre, icono = d ? d.icono : '🏋️';
    const kg = (r) => (Number.isFinite(r.carga) ? Math.round(r.carga * 2) / 2 : null);
    const cuenta = new Map(); for (const r of l) { const k = kg(r); if (k != null) cuenta.set(k, (cuenta.get(k) || 0) + 1); }
    const [carga, n] = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || [null, 0];
    let cambio = '';
    if (n >= 2) {
      const misma = l.filter((r) => kg(r) === carga), v0 = misma[0].vMejor, v1 = misma[misma.length - 1].vMejor, pct = (v1 / v0 - 1) * 100;
      cambio = `<span class="pf-vid-cambio ${pct >= 3 ? 'sube' : pct <= -3 ? 'baja' : ''}">${pct >= 0 ? '▲' : '▼'} ${fmt(Math.abs(pct))} %<small>con ${kgF(carga)} kg</small></span>`;
    }
    const ult = l[l.length - 1], ult12 = l.slice(-12).map((r) => r.vMejor);
    const mn = Math.min(...ult12), mxv = Math.max(...ult12), sp = ult12.length > 1 ? ult12.map((v, i) => `${(i / (ult12.length - 1) * 70).toFixed(1)},${(22 - (mxv > mn ? (v - mn) / (mxv - mn) : 0.5) * 18).toFixed(1)}`).join(' ') : '';
    return `<button type="button" class="pf-vid" data-id="${esc(ult.id)}"><span class="pf-rec-ic">${icono}</span>
      <div><strong>${esc(nombre)}</strong><small>${l.length} ${l.length === 1 ? 'serie' : 'series'} · última ${fmt(ult.vMejor, 2)} m/s${kg(ult) != null ? ` con ${kgF(kg(ult))} kg` : ''}</small></div>
      ${sp ? `<svg viewBox="0 0 70 24" class="pf-vid-sp" aria-hidden="true"><polyline points="${sp}"/></svg>` : ''}${cambio}</button>`;
  }).join('');
  const dif = vm && va ? (vm / va - 1) * 100 : null;
  cont.innerHTML = `<div class="pf-vid-kpis"><div><b>${h.length}</b><small>series medidas</small></div><div><b>${mes.length}</b><small>últimos 30 días</small></div>
      <div><b>${vm ? fmt(vm, 2) : '--'}</b><small>m/s promedio (30 días)${dif != null ? ` · <i class="${dif >= 0 ? 'sube' : 'baja'}">${dif >= 0 ? '+' : ''}${fmt(dif)} %</i>` : ''}</small></div></div>
    <div class="pf-vids">${filas}</div>
    <p class="hint">La flecha compara tu primera y tu última serie con el peso que más usas: si subes el mismo peso más rápido, estás más fuerte. Toca un ejercicio para ver su última serie.</p>
    <button type="button" class="btn-sec" id="pf-video-todo" style="width:100%">Ver todas las series analizadas</button>`;
  cont.querySelectorAll('.pf-vid').forEach((b) => (b.onclick = () => deps.abrirSerie(b.dataset.id)));
  $('pf-video-todo').onclick = () => deps.vista('v-historial');
}
