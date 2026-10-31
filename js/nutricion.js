// Pestaña Nutricion: registro de comidas por dia, metas de calorias y macros, buscador de alimentos
// (base local + base de la comunidad FuerzaPro + Open Food Facts) y escaner de codigo de barras. Todo se guarda en el
// telefono; los productos con codigo que crea el usuario pueden compartirse con la comunidad (v2.19.0).
import * as almacen from './almacen.js';
import * as nube from './nube.js';
import { ALIMENTOS } from './alimentos.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? def; } catch (e) { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nada */ } };
const COMIDAS = [['desayuno', '🌅 Desayuno'], ['almuerzo', '☀️ Almuerzo'], ['cena', '🌙 Cena'], ['snack', '🍎 Snacks']];
const OFF = 'https://world.openfoodfacts.org';
const CAMPOS = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,countries_tags';

const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const desdeISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const sumarDias = (s, n) => { const d = desdeISO(s); d.setDate(d.getDate() + n); return fechaISO(d); };
const total = (r, k) => (r.base[k] || 0) * r.gramos / 100;
const totales = (lista) => ['kcal', 'p', 'c', 'g'].reduce((o, k) => ({ ...o, [k]: lista.reduce((a, r) => a + total(r, k), 0) }), {});

let dia = fechaISO(new Date()), registros = [], metas = null;
let comidaSel = 'desayuno', elegido = null, editando = null, recientes = [], camara = null;

// ------------------------------------------------------------------ inicio
export function iniciar() {
  metas = leerLS('af_nutri_metas', null);
  $('nu-ant').onclick = () => { dia = sumarDias(dia, -1); pintar(); };
  $('nu-sig').onclick = () => { dia = sumarDias(dia, 1); pintar(); };
  $('nu-hoy').onclick = () => { dia = fechaISO(new Date()); pintar(); };
  $('nu-btn-metas').onclick = abrirMetas;
  $('nu-cerrar').onclick = cerrarHoja;
  $('nu-buscar').oninput = () => pintarResultados();
  $('nu-buscar').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarInternet(); } };
  $('nu-internet').onclick = buscarInternet;
  $('nu-escanear').onclick = escanear;
  $('nu-crear').onclick = () => formularioPropio();
  $('nu-scan-cerrar').onclick = cerrarCamara;
}

export async function pintar() {
  const hoy = fechaISO(new Date());
  $('nu-fecha').textContent = dia === hoy ? 'Hoy' : dia === sumarDias(hoy, -1) ? 'Ayer'
    : desdeISO(dia).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
  $('nu-hoy').style.visibility = dia === hoy ? 'hidden' : '';
  registros = (await almacen.leerComidas(dia)).sort((a, b) => a.creado - b.creado);
  pintarResumen(); pintarComidas(); pintarSemana();
}

function pintarResumen() {
  const t = totales(registros);
  if (!metas) {
    $('nu-resumen').innerHTML = `<div class="nu-anillo-fila"><div><div class="kpi-value">${fmt(t.kcal)}</div><div class="kpi-sub">kcal hoy</div></div></div>
      <button type="button" class="btn-sec" id="nu-config" style="width:100%;margin-top:10px">🎯 Configura tus metas de calorías y proteína</button>`;
    $('nu-config').onclick = abrirMetas;
  } else {
    const pct = Math.min(100, 100 * t.kcal / metas.kcal), resta = metas.kcal - t.kcal;
    const barra = (k, nombre, color) => {
      const m = metas[k] || 1, v = t[k];
      return `<div class="nu-macro"><div class="nu-macro-cab"><span>${nombre}</span><span><b>${fmt(v)}</b> / ${fmt(m)} g</span></div>
        <div class="nu-macro-barra"><div style="width:${Math.min(100, 100 * v / m)}%;background:${color}"></div></div></div>`;
    };
    $('nu-resumen').innerHTML = `<div class="nu-anillo-fila">
        <div class="nu-anillo" style="background:conic-gradient(${resta < 0 ? 'var(--accent-orange)' : 'var(--accent-green)'} ${pct}%, var(--bg-input) 0)"><div>
          <b>${fmt(Math.abs(resta))}</b><small>${resta < 0 ? 'kcal de más' : 'kcal restantes'}</small></div></div>
        <div class="nu-anillo-txt"><div><small>Meta</small><b>${fmt(metas.kcal)}</b></div><div><small>Comido</small><b>${fmt(t.kcal)}</b></div></div></div>
      ${barra('p', 'Proteína', 'var(--accent-blue)')}${barra('c', 'Carbohidratos', 'var(--accent-green)')}${barra('g', 'Grasa', 'var(--accent-orange)')}`;
  }
}

function pintarComidas() {
  $('nu-comidas').innerHTML = COMIDAS.map(([k, titulo]) => {
    const lista = registros.filter((r) => r.comida === k), t = totales(lista);
    return `<div class="nu-comida"><div class="nu-comida-cab"><strong>${titulo}</strong><span>${lista.length ? `${fmt(t.kcal)} kcal · P ${fmt(t.p)} g` : ''}</span></div>
      ${lista.map((r) => `<div class="nu-item" data-id="${r.id}" role="button"><div><b>${esc(r.nombre)}</b><small>${r.marca ? esc(r.marca) + ' · ' : ''}${fmt(r.gramos)} g · P ${fmt(total(r, 'p'), 1)} · C ${fmt(total(r, 'c'), 1)} · G ${fmt(total(r, 'g'), 1)}</small></div><span>${fmt(total(r, 'kcal'))}</span></div>`).join('')}
      <button type="button" class="nu-agregar" data-c="${k}">+ Agregar alimento</button></div>`;
  }).join('') + (registros.length ? '' : '<button type="button" class="btn-sec" id="nu-copiar" style="width:100%">📋 Copiar las comidas del día anterior</button>');
  $('nu-comidas').querySelectorAll('.nu-agregar').forEach((b) => (b.onclick = () => abrirHoja(b.dataset.c)));
  $('nu-comidas').querySelectorAll('.nu-item').forEach((x) => (x.onclick = () => editar(registros.find((r) => r.id === x.dataset.id))));
  if ($('nu-copiar')) $('nu-copiar').onclick = copiarAyer;
}

async function pintarSemana() {
  const lista = await almacen.leerComidas(sumarDias(dia, -6), dia);
  const dias = {};
  lista.forEach((r) => { (dias[r.fecha] = dias[r.fecha] || []).push(r); });
  const n = Object.keys(dias).length;
  if (n < 2) { $('nu-semana').innerHTML = ''; return; }
  const prom = (k) => Object.values(dias).reduce((a, l) => a + totales(l)[k], 0) / n;
  $('nu-semana').innerHTML = `<p class="hint">Promedio de los últimos 7 días (${n} días registrados): <b>${fmt(prom('kcal'))} kcal</b> · proteína <b>${fmt(prom('p'))} g</b> · carbohidratos ${fmt(prom('c'))} g · grasa ${fmt(prom('g'))} g${metas ? ` · ${prom('kcal') > metas.kcal * 1.05 ? 'por encima' : prom('kcal') < metas.kcal * 0.95 ? 'por debajo' : 'en línea con'} tu meta` : ''}.</p>`;
}

async function copiarAyer() {
  const ayer = await almacen.leerComidas(sumarDias(dia, -1));
  if (!ayer.length) return alert('El día anterior no tiene comidas registradas.');
  const t = Date.now();
  for (const [i, r] of ayer.entries()) await almacen.guardarComida({ ...r, id: `c-${t}-${i}`, fecha: dia, creado: t + i });
  pintar();
}

// ------------------------------------------------------------------ agregar alimentos
async function abrirHoja(comida) {
  comidaSel = comida; elegido = null; editando = null;
  $('nu-hoja-titulo').textContent = `Agregar a ${COMIDAS.find(([k]) => k === comida)[1].replace(/^\S+\s/, '')}`;
  $('nu-buscar').value = ''; $('nu-off').innerHTML = '';
  $('nu-paso-buscar').style.display = ''; $('nu-paso-cant').style.display = 'none';
  $('nu-hoja').style.display = 'flex';
  const hace30 = await almacen.leerComidas(sumarDias(fechaISO(new Date()), -30), fechaISO(new Date()));
  const vistos = new Map();
  hace30.sort((a, b) => b.creado - a.creado).forEach((r) => {
    const k = norm(r.nombre + '|' + (r.marca || ''));
    if (!vistos.has(k)) vistos.set(k, { nombre: r.nombre, marca: r.marca, ...r.base, porciones: r.porciones || [], fuente: r.fuente, codigo: r.codigo, ultimo: r.gramos });
  });
  recientes = [...vistos.values()].slice(0, 15);
  pintarResultados();
  setTimeout(() => $('nu-buscar').focus({ preventScroll: true }), 50);
}
function cerrarHoja() { $('nu-hoja').style.display = 'none'; cerrarCamara(); }

function pintarResultados() {
  const q = norm($('nu-buscar').value), pal = q.split(/\s+/).filter(Boolean);
  const pasa = (a) => pal.every((w) => norm(`${a.nombre} ${a.marca || ''} ${a.extra || ''}`).includes(w));
  const propios = leerLS('af_alimentos_propios', []);
  const item = (a, i, grupo) => `<button type="button" class="en-sel-item" data-g="${grupo}" data-i="${i}"><span>${a.fuente === 'off' ? '🏷️' : a.fuente === 'comunidad' ? '👥' : a.fuente === 'propio' ? '⭐' : '🥗'}</span>
    <span><b>${esc(a.nombre)}</b><small>${a.marca ? esc(a.marca) + ' · ' : ''}${fmt(a.kcal)} kcal · P ${fmt(a.p, 1)} · C ${fmt(a.c, 1)} · G ${fmt(a.g, 1)} por 100 g</small></span></button>`;
  const grupos = { r: recientes.filter(pasa), p: propios.filter(pasa), l: ALIMENTOS.filter(pasa) };
  $('nu-res').innerHTML = (grupos.r.length ? `<div class="en-sel-grupo">Recientes</div>${grupos.r.map((a, i) => item(a, i, 'r')).join('')}` : '')
    + (grupos.p.length ? `<div class="en-sel-grupo">Mis alimentos</div>${grupos.p.map((a, i) => item(a, i, 'p')).join('')}` : '')
    + (grupos.l.length ? `<div class="en-sel-grupo">Alimentos comunes</div>${grupos.l.map((a, i) => item(a, i, 'l')).join('')}` : '')
    + (q && !grupos.r.length && !grupos.p.length && !grupos.l.length ? '<p class="hint">No está en la lista local. Pulsa «Buscar en internet» para buscar productos con marca.</p>' : '');
  $('nu-res').querySelectorAll('.en-sel-item').forEach((b) => (b.onclick = () => elegir(grupos[b.dataset.g][+b.dataset.i])));
}

function offAAlimento(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  if (kcal == null || !Number.isFinite(+kcal)) return null;
  const sq = parseFloat(p.serving_quantity);
  return { nombre: (p.product_name_es || p.product_name || 'Producto sin nombre').trim(), marca: String(p.brands || '').split(',')[0].trim(),
    kcal: +kcal, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, g: +n.fat_100g || 0,
    porciones: sq > 0 ? [[`1 porción${p.serving_size ? ` (${p.serving_size})` : ''}`, sq]] : [], fuente: 'off', codigo: p.code,
    ecuador: (p.countries_tags || []).includes('en:ecuador') };
}
// producto de la base de la comunidad FuerzaPro (servidor propio) -> alimento de la app
const deComunidad = (x) => ({ nombre: x.nombre, marca: x.marca || '', kcal: x.kcal, p: x.p || 0, c: x.c || 0, g: x.g || 0,
  porciones: x.porcion > 0 ? [['1 porción', x.porcion]] : [], fuente: 'comunidad', codigo: x.codigo });
async function comunidadGet(ruta) {
  const r = await fetch(ruta, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
let ultimaBusqueda = 0;
async function buscarInternet() {
  const q = $('nu-buscar').value.trim();
  if (q.length < 2) return alert('Escribe qué alimento o producto buscas.');
  if (!navigator.onLine) return alert('Sin conexión: solo puedes usar la lista local y tus alimentos.');
  if (Date.now() - ultimaBusqueda < 4000) return; // Open Food Facts limita las busquedas seguidas
  ultimaBusqueda = Date.now();
  $('nu-off').innerHTML = '<p class="hint">Buscando en la comunidad FuerzaPro y en Open Food Facts…</p>';
  // las dos fuentes a la vez: si una falla, se muestra la otra
  const [com, off] = await Promise.allSettled([
    comunidadGet(`/api/alimentos?q=${encodeURIComponent(q)}`).then((j) => (j.alimentos || []).map(deComunidad)),
    fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${CAMPOS}`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((j) => (j.products || []).map(offAAlimento).filter(Boolean).sort((a, b) => b.ecuador - a.ecuador)),
  ]);
  const lc = com.status === 'fulfilled' ? com.value : [], lo = off.status === 'fulfilled' ? off.value : [];
  const lista = [...lc, ...lo];
  const fila = (a, i) => `<button type="button" class="en-sel-item" data-i="${i}"><span>${a.fuente === 'comunidad' ? '👥' : '🏷️'}</span>
      <span><b>${esc(a.nombre)}</b><small>${a.marca ? esc(a.marca) + ' · ' : ''}${a.ecuador ? '🇪🇨 · ' : ''}${fmt(a.kcal)} kcal · P ${fmt(a.p, 1)} · C ${fmt(a.c, 1)} · G ${fmt(a.g, 1)} por 100 g</small></span></button>`;
  $('nu-off').innerHTML = (lc.length ? `<div class="en-sel-grupo">Comunidad FuerzaPro</div>${lc.map((a, i) => fila(a, i)).join('')}` : '')
    + (lo.length ? `<div class="en-sel-grupo">Open Food Facts</div>${lo.map((a, i) => fila(a, lc.length + i)).join('')}` : '')
    + (!lista.length ? (off.status === 'rejected' && com.status === 'rejected' ? '<p class="hint">No pude conectar. Revisa tu internet o inténtalo en un rato.</p>'
      : '<p class="hint">No encontré productos con ese nombre. Prueba otra palabra, escanea el código o créalo tú.</p>') : '');
  $('nu-off').querySelectorAll('.en-sel-item').forEach((b) => (b.onclick = () => elegir(lista[+b.dataset.i])));
}

// Orden de busqueda de un codigo: 1) mis alimentos (sin internet) 2) comunidad FuerzaPro 3) Open Food Facts 4) crearlo
async function buscarCodigo(codigo) {
  const mio = leerLS('af_alimentos_propios', []).find((x) => x.codigo === codigo);
  if (mio) { elegir(mio); return; }
  $('nu-off').innerHTML = `<p class="hint">Buscando el código ${esc(codigo)}…</p>`;
  let sinRed = 0;
  try {
    const j = await comunidadGet(`/api/alimentos/${encodeURIComponent(codigo)}`);
    if (j.alimento) { $('nu-off').innerHTML = ''; elegir(deComunidad(j.alimento)); return; }
  } catch (e) { sinRed++; }
  try {
    const r = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}`);
    const j = r.ok ? await r.json() : null;
    const a = j && j.status === 1 && j.product ? offAAlimento({ code: codigo, ...j.product }) : null;
    if (a) { $('nu-off').innerHTML = ''; elegir(a); return; }
  } catch (e) { sinRed++; }
  $('nu-off').innerHTML = '';
  if (sinRed === 2) { $('nu-off').innerHTML = '<p class="hint">No pude buscar el código: revisa tu internet. Igual puedes crearlo con la etiqueta.</p>'; }
  if (confirm(`El código ${codigo} todavía no está en ninguna base de datos. ¿Lo creas con los datos de la etiqueta?${nube.conectado() ? ' Quedará para toda la comunidad FuerzaPro.' : ''}`)) formularioPropio(codigo);
}

// ------------------------------------------------------------------ escaner de codigo de barras
async function escanear() {
  if (!('BarcodeDetector' in window)) {
    const c = prompt('Tu navegador no puede leer códigos con la cámara. Escribe el número del código de barras:');
    if (c && /^\d{6,14}$/.test(c.trim())) buscarCodigo(c.trim());
    return;
  }
  let det;
  try { det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }); } catch (e) { det = new window.BarcodeDetector(); }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
    camara = { stream, activo: true };
    const v = $('nu-video'); v.srcObject = stream; await v.play().catch(() => {});
    $('nu-scan').style.display = 'flex';
    const bucle = async () => {
      if (!camara || !camara.activo) return;
      try {
        const cods = await det.detect(v);
        if (cods.length && /^\d{6,14}$/.test(cods[0].rawValue)) {
          const c = cods[0].rawValue; cerrarCamara();
          if (navigator.vibrate) navigator.vibrate(60);
          buscarCodigo(c); return;
        }
      } catch (e) { /* cuadro sin leer */ }
      setTimeout(bucle, 250);
    };
    bucle();
  } catch (e) {
    alert(e.name === 'NotAllowedError' ? 'Necesito permiso para usar la cámara.' : 'No pude abrir la cámara.');
  }
}
function cerrarCamara() {
  if (camara) { camara.activo = false; camara.stream.getTracks().forEach((t) => t.stop()); camara = null; }
  $('nu-scan').style.display = 'none';
}

// ------------------------------------------------------------------ cantidad
function elegir(a, gramos = null) {
  elegido = a;
  $('nu-paso-buscar').style.display = 'none'; $('nu-paso-cant').style.display = '';
  const g0 = gramos ?? a.ultimo ?? (a.porciones && a.porciones[0] ? a.porciones[0][1] : 100);
  $('nu-cant').innerHTML = `<h3 class="en-det-titulo">${esc(a.nombre)}</h3><p class="hint" style="margin-top:2px">${a.marca ? esc(a.marca) + ' · ' : ''}${fmt(a.kcal)} kcal por 100 g${a.fuente === 'off' ? ' · datos de Open Food Facts' : a.fuente === 'comunidad' ? ' · datos de la comunidad FuerzaPro' : ''}${a.fuente === 'comunidad' && a.codigo ? ' · <button type="button" class="btn-link" id="nu-reportar">⚠️ ¿Datos incorrectos?</button>' : ''}</p>
    <div class="nu-cant-fila"><input id="nu-g" type="number" inputmode="decimal" min="0" step="any" value="${g0}"><span>gramos</span></div>
    <div class="chips">${(a.porciones || []).map(([n, g]) => `<button type="button" class="chip" data-g="${g}">${esc(n)} · ${fmt(g)} g</button>`).join('')}<button type="button" class="chip" data-g="100">100 g</button></div>
    <div id="nu-prev" class="nu-prev"></div>
    <div class="en-det-botones">${editando ? '<button type="button" class="btn-sec peligro" id="nu-borrar">Borrar</button>' : '<button type="button" class="btn-sec" id="nu-volver">‹ Volver</button>'}
      <button type="button" class="btn-sec en-terminar" id="nu-ok">${editando ? 'Guardar' : 'Agregar'}</button></div>`;
  const prev = () => {
    const g = parseFloat(($('nu-g').value || '0').replace(',', '.')) || 0, f = g / 100;
    $('nu-prev').innerHTML = `<div><b>${fmt(a.kcal * f)}</b><small>kcal</small></div><div><b>${fmt(a.p * f, 1)}</b><small>proteína</small></div><div><b>${fmt(a.c * f, 1)}</b><small>carbos</small></div><div><b>${fmt(a.g * f, 1)}</b><small>grasa</small></div>`;
  };
  $('nu-g').oninput = prev; prev();
  if ($('nu-reportar')) $('nu-reportar').onclick = async () => {
    if (!nube.conectado()) return alert('Inicia sesión (Perfil → Cuenta) para reportar un producto.');
    if (!confirm('¿Los datos no coinciden con la etiqueta? Con 3 reportes de personas distintas el producto se oculta para todos y se puede volver a crear.')) return;
    try { const r = await nube.api('POST', `/api/alimentos/${encodeURIComponent(a.codigo)}/reportar`); alert(r.oculto ? 'Gracias. El producto quedó oculto: escanéalo otra vez para crearlo con los datos correctos.' : 'Gracias por avisar.'); }
    catch (e) { alert('No pude enviar el reporte: ' + (e.message || e)); }
  };
  $('nu-cant').querySelectorAll('.chip').forEach((b) => (b.onclick = () => { $('nu-g').value = b.dataset.g; prev(); }));
  if ($('nu-volver')) $('nu-volver').onclick = () => { $('nu-paso-buscar').style.display = ''; $('nu-paso-cant').style.display = 'none'; };
  if ($('nu-borrar')) $('nu-borrar').onclick = async () => { await almacen.borrarComida(editando.id); cerrarHoja(); pintar(); };
  $('nu-ok').onclick = async () => {
    const g = parseFloat(($('nu-g').value || '').replace(',', '.'));
    if (!(g > 0)) return alert('Escribe la cantidad en gramos.');
    const reg = editando ? { ...editando, gramos: g } : { id: `c-${Date.now()}`, fecha: dia, comida: comidaSel, creado: Date.now(), nombre: a.nombre, marca: a.marca || '',
      gramos: g, base: { kcal: a.kcal, p: a.p, c: a.c, g: a.g }, porciones: a.porciones || [], fuente: a.fuente, codigo: a.codigo || null };
    await almacen.guardarComida(reg);
    cerrarHoja(); pintar();
  };
}
function editar(r) {
  editando = r; comidaSel = r.comida;
  $('nu-hoja-titulo').textContent = 'Editar';
  $('nu-hoja').style.display = 'flex';
  elegir({ nombre: r.nombre, marca: r.marca, ...r.base, porciones: r.porciones, fuente: r.fuente }, r.gramos);
}

// alimento propio (o producto que no esta en Open Food Facts)
function formularioPropio(codigo = null) {
  $('nu-paso-buscar').style.display = 'none'; $('nu-paso-cant').style.display = '';
  $('nu-cant').innerHTML = `<h3 class="en-det-titulo">⭐ Nuevo alimento</h3><p class="hint" style="margin-top:2px">Copia los datos de la tabla nutricional de la etiqueta${codigo ? ` (código ${esc(codigo)})` : ''}.</p>
    <button type="button" class="btn-sec" id="pa-foto" style="width:100%;margin-top:8px">📷 Leer la tabla de la etiqueta con la cámara</button>
    <input type="file" id="pa-foto-in" accept="image/*" capture="environment" hidden>
    <p class="hint" id="pa-foto-txt" style="margin:4px 0 0"></p>
    <details id="pa-foto-det" class="nu-ocr" hidden><summary>Ver lo que leyó la cámara</summary><pre id="pa-foto-ocr"></pre></details>
    <div class="form-grid" style="margin-top:8px">
      <div class="form-group full"><label for="pa-nombre">Nombre</label><input id="pa-nombre" maxlength="60" value="${esc($('nu-buscar').value.trim())}"></div>
      <div class="form-group full"><label for="pa-marca">Marca (opcional)</label><input id="pa-marca" maxlength="40" placeholder="ej.: Toni, Pronaca, La Favorita"></div>
      <div class="form-group"><label for="pa-base">Los datos son por</label><select id="pa-base"><option value="100">100 g</option><option value="porcion">porción</option></select></div>
      <div class="form-group"><label for="pa-porcion">Porción (g)</label><input id="pa-porcion" type="number" inputmode="decimal" placeholder="ej.: 30"></div>
      <div class="form-group"><label for="pa-kcal">Calorías (kcal)</label><input id="pa-kcal" type="number" inputmode="decimal"></div>
      <div class="form-group"><label for="pa-p">Proteína (g)</label><input id="pa-p" type="number" inputmode="decimal"></div>
      <div class="form-group"><label for="pa-c">Carbohidratos (g)</label><input id="pa-c" type="number" inputmode="decimal"></div>
      <div class="form-group"><label for="pa-g">Grasa (g)</label><input id="pa-g" type="number" inputmode="decimal"></div>
    </div>
    ${codigo ? (nube.conectado() ? `<label class="nu-compartir"><input type="checkbox" id="pa-compartir" checked> Compartir con la comunidad FuerzaPro: quien escanee este código lo encontrará (solo se comparten el producto y sus datos, no tu nombre).</label>`
      : '<p class="hint">Si inicias sesión (Perfil → Cuenta), los productos que crees con código se comparten con la comunidad y todos los encuentran al escanear.</p>') : ''}
    <div class="en-det-botones"><button type="button" class="btn-sec" id="nu-volver">‹ Volver</button><button type="button" class="btn-sec en-terminar" id="pa-ok">Guardar y usar</button></div>`;
  $('nu-volver').onclick = () => { $('nu-paso-buscar').style.display = ''; $('nu-paso-cant').style.display = 'none'; };
  // foto de la tabla nutricional -> numeros (OCR en el telefono). El usuario revisa antes de guardar.
  $('pa-foto').onclick = () => $('pa-foto-in').click();
  $('pa-foto-in').onchange = async () => {
    const f = $('pa-foto-in').files[0]; $('pa-foto-in').value = ''; if (!f) return;
    const b = $('pa-foto'), txt = $('pa-foto-txt'); b.disabled = true;
    const ETAPAS = { 'segunda lectura': 'Segunda lectura para completar', 'loading tesseract core': 'Preparando el lector', 'initializing tesseract': 'Preparando el lector', 'loading language traineddata': 'Cargando español', 'initializing api': 'Preparando el lector', 'recognizing text': 'Leyendo la etiqueta' };
    txt.textContent = 'Preparando el lector (la primera vez descarga ~10 MB)…';
    try {
      const { leerEtiqueta } = await import('./etiqueta.js');
      const r = await leerEtiqueta(f, (et, p) => { txt.textContent = `${ETAPAS[et] || 'Leyendo'}… ${Math.round(p * 100)} %`; });
      const calc = r.calculados || [];
      $('pa-foto-ocr').textContent = (r.texto || '').trim(); $('pa-foto-det').hidden = !r.texto; // para revisar (y mandar captura si algo sale mal)
      const poner = (id, v, k) => { if (v != null) { $(id).value = String(v); $(id).classList.add(calc.includes(k) ? 'nu-calculado' : 'nu-leido'); } };
      poner('pa-kcal', r.kcal, 'kcal'); poner('pa-p', r.p, 'p'); poner('pa-c', r.c, 'c'); poner('pa-g', r.g, 'g'); poner('pa-porcion', r.porcion, 'porcion');
      $('pa-base').value = r.por100 || !r.porcion ? '100' : 'porcion';
      const n = ['kcal', 'p', 'c', 'g'].filter((k) => r[k] != null && !calc.includes(k)).length, nc = calc.filter((k) => k !== 'porcion').length;
      const NOM = { kcal: 'las calorías', p: 'la proteína', c: 'los carbohidratos', g: 'la grasa' };
      txt.textContent = n ? `Leí ${n} de 4 datos (en violeta)${nc ? ` y calculé ${calc.map((k) => NOM[k]).join(' y ')} con los demás (en amarillo)` : ''}. Revísalos con la etiqueta antes de guardar: la lectura automática puede equivocarse.${n + nc < 4 ? ' Escribe los que falten.' : ''}`
        : 'No pude leer los números. Toma la foto de cerca, solo la tabla, derecha y con buena luz; o escríbelos a mano.';
    } catch (e) {
      txt.textContent = 'No pude leer la etiqueta: ' + (e.message || e) + ' Escribe los datos a mano.';
    } finally { b.disabled = false; }
  };
  $('pa-ok').onclick = async () => {
    const v = (id) => parseFloat(($(id).value || '0').replace(',', '.')) || 0;
    const nombre = $('pa-nombre').value.trim(), porcion = v('pa-porcion'), porPorcion = $('pa-base').value === 'porcion';
    if (!nombre) return alert('Ponle un nombre.');
    if (!(v('pa-kcal') > 0)) return alert('Escribe las calorías.');
    if (porPorcion && !(porcion > 0)) return alert('Escribe cuántos gramos tiene la porción.');
    const f = porPorcion ? 100 / porcion : 1;
    const marca = $('pa-marca').value.trim();
    const a = { nombre, marca, kcal: v('pa-kcal') * f, p: v('pa-p') * f, c: v('pa-c') * f, g: v('pa-g') * f,
      porciones: porcion > 0 ? [['1 porción', porcion]] : [], fuente: 'propio', codigo };
    const r1 = (x) => Math.round(x * 10) / 10;
    if ($('pa-compartir') && $('pa-compartir').checked) {
      $('pa-ok').disabled = true;
      try {
        await nube.api('POST', '/api/alimentos', { codigo, nombre, marca, kcal: r1(a.kcal), p: r1(a.p), c: r1(a.c), g: r1(a.g), porcion: porcion > 0 ? porcion : null });
      } catch (e) {
        $('pa-ok').disabled = false;
        // datos que no cuadran (p. ej. por porcion marcada como 100 g): se avisa para corregir antes de guardar
        if (!confirm(`${e.message || e}\n\n¿Guardarlo igual, solo en tu teléfono?`)) return;
      }
    }
    guardarLS('af_alimentos_propios', [a, ...leerLS('af_alimentos_propios', []).filter((x) => norm(x.nombre) !== norm(nombre) && (!codigo || x.codigo !== codigo))].slice(0, 200));
    elegir(a);
  };
}

// ------------------------------------------------------------------ metas
function abrirMetas() {
  const m = metas || {}, perfil = leerLS('af_nutri_perfil', {});
  const pc = perfil.peso || parseFloat(localStorage.getItem('af_pc')) || '', alt = perfil.altura || Math.round((parseFloat(localStorage.getItem('af_altura')) || 0) * 100) || '';
  $('nu-hoja-titulo').textContent = '🎯 Metas diarias';
  $('nu-paso-buscar').style.display = 'none'; $('nu-paso-cant').style.display = '';
  $('nu-hoja').style.display = 'flex';
  $('nu-cant').innerHTML = `<p class="hint" style="margin-top:0">Calcula una meta orientativa con tus datos o escribe la tuya (por ejemplo, la de tu nutricionista).</p>
    <div class="form-grid">
      <div class="form-group"><label for="mt-sexo">Sexo</label><select id="mt-sexo"><option value="h">Hombre</option><option value="m"${perfil.sexo === 'm' ? ' selected' : ''}>Mujer</option></select></div>
      <div class="form-group"><label for="mt-edad">Edad</label><input id="mt-edad" type="number" inputmode="numeric" value="${perfil.edad || ''}"></div>
      <div class="form-group"><label for="mt-peso">Peso (kg)</label><input id="mt-peso" type="number" inputmode="decimal" value="${pc}"></div>
      <div class="form-group"><label for="mt-alt">Estatura (cm)</label><input id="mt-alt" type="number" inputmode="numeric" value="${alt}"></div>
      <div class="form-group"><label for="mt-act">Actividad</label><select id="mt-act">
        <option value="1.375">Entreno 1–3 días</option><option value="1.55" selected>Entreno 3–5 días</option><option value="1.725">Entreno 6–7 días o trabajo físico</option></select></div>
      <div class="form-group"><label for="mt-obj">Objetivo</label><select id="mt-obj">
        <option value="perder">Bajar grasa</option><option value="mantener" selected>Mantener / recomposición</option><option value="ganar">Ganar músculo</option></select></div>
    </div>
    <button type="button" class="btn-sec" id="mt-calc" style="width:100%;margin:6px 0 12px">🧮 Calcular sugerencia</button>
    <div class="form-grid">
      <div class="form-group"><label for="mt-kcal">Calorías (kcal)</label><input id="mt-kcal" type="number" inputmode="numeric" value="${m.kcal || ''}"></div>
      <div class="form-group"><label for="mt-p">Proteína (g)</label><input id="mt-p" type="number" inputmode="numeric" value="${m.p || ''}"></div>
      <div class="form-group"><label for="mt-c">Carbohidratos (g)</label><input id="mt-c" type="number" inputmode="numeric" value="${m.c || ''}"></div>
      <div class="form-group"><label for="mt-g">Grasa (g)</label><input id="mt-g" type="number" inputmode="numeric" value="${m.g || ''}"></div>
    </div>
    <p class="hint" id="mt-nota">Fórmula Mifflin-St Jeor × actividad. Proteína 1,8–2,2 g por kg, grasa ~0,9 g por kg y el resto carbohidratos. Es una estimación: ajústala según cómo cambie tu peso en 2–3 semanas.</p>
    <div class="en-det-botones"><button type="button" class="btn-sec" id="mt-cancelar">Cancelar</button><button type="button" class="btn-sec en-terminar" id="mt-ok">Guardar metas</button></div>`;
  $('mt-calc').onclick = () => {
    const sexo = $('mt-sexo').value, edad = +$('mt-edad').value, peso = +$('mt-peso').value, alt = +$('mt-alt').value;
    if (!(edad > 10 && peso > 30 && alt > 120)) return alert('Completa edad, peso y estatura.');
    guardarLS('af_nutri_perfil', { sexo, edad, peso, altura: alt });
    const r = calcularMetas({ sexo, edad, peso, altura: alt, actividad: +$('mt-act').value, objetivo: $('mt-obj').value });
    $('mt-kcal').value = r.kcal; $('mt-p').value = r.p; $('mt-c').value = r.c; $('mt-g').value = r.g;
    $('mt-nota').innerHTML = `Mantenimiento estimado: <b>${fmt(r.mant)} kcal</b>. ${$('mt-obj').value === 'perder' ? 'Déficit de ~20 %.' : $('mt-obj').value === 'ganar' ? 'Superávit de ~10 %.' : ''} Es una estimación: ajústala según cómo cambie tu peso en 2–3 semanas.`;
  };
  $('mt-cancelar').onclick = cerrarHoja;
  $('mt-ok').onclick = () => {
    const v = (id) => Math.round(+$(id).value || 0);
    if (!(v('mt-kcal') > 500)) return alert('Escribe tu meta de calorías (o pulsa Calcular).');
    metas = { kcal: v('mt-kcal'), p: v('mt-p'), c: v('mt-c'), g: v('mt-g') };
    guardarLS('af_nutri_metas', metas); cerrarHoja(); pintar();
  };
}

export function calcularMetas({ sexo, edad, peso, altura, actividad, objetivo }) {
  const tmb = 10 * peso + 6.25 * altura - 5 * edad + (sexo === 'm' ? -161 : 5);
  const mant = tmb * actividad;
  const kcal = Math.round((objetivo === 'perder' ? mant * 0.8 : objetivo === 'ganar' ? mant * 1.1 : mant) / 10) * 10;
  const p = Math.round(peso * (objetivo === 'perder' ? 2.2 : objetivo === 'ganar' ? 1.8 : 2.0));
  const g = Math.round(peso * 0.9);
  const c = Math.max(0, Math.round((kcal - p * 4 - g * 9) / 4));
  return { kcal, p, c, g, mant: Math.round(mant) };
}
