// Planes de suscripcion en la app (v2.33.0). El servidor decide (GET /api/plan): mientras los limites esten apagados
// nadie tiene limites; en "prueba" solo el administrador; en "activo" todos los que tienen cuenta. Aqui se recuerda el
// ultimo estado (af_plan), se revisa antes de analizar un video y se muestra la ventana «Mejora tu plan».
import * as nube from './nube.js';

const CLAVE = 'af_plan';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } };
const guardar = (x) => { try { localStorage.setItem(CLAVE, JSON.stringify(x)); } catch (e) { /* nada */ } };
let estado = leer();
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function actualizar() {
  if (!nube.conectado()) { estado = null; guardar(null); restaurado = false; return null; }
  if (!restaurado) { restaurado = true; if (nube.esIOS()) restaurarApple(true).then((n) => { if (n) actualizar(); }).catch(() => {}); else await restaurar(true); } // app de Play o iPhone: vincula compras hechas antes o en otro telefono (v2.49.0 en iPhone sin esperar: no frena el arranque; si vinculó algo, recarga el plan)
  try { estado = await nube.api('GET', '/api/plan'); guardar(estado); } catch (e) { /* sin internet: el ultimo conocido */ }
  return estado;
}
export const actual = () => estado;
export const aplica = () => !!(estado && estado.aplica);
// permisos: pdf, videoComunidad, excel, historialDias
export const permiso = (k) => (aplica() ? estado.permisos[k] : k === 'historialDias' ? null : true);

// antes de analizar: ¿le quedan analisis este mes? (no descuenta; se descuenta cuando el analisis sale bien)
export async function puedeAnalizar() {
  await actualizar();
  if (!aplica()) return true;
  const { lim } = estado.limites.video;
  if (lim == null || estado.usos.video < lim) return true;
  mostrarMejora(`Ya usaste tus ${lim} análisis de video de este mes (plan ${estado.nombre}).`);
  return false;
}
export async function contarAnalisis() {
  if (!aplica()) return;
  try { await nube.api('POST', '/api/plan/usar', { tipo: 'video' }); estado.usos.video++; guardar(estado); } catch (e) { /* ya se mostro el aviso */ }
}

// resumen para Perfil: "Plan Gratis · 2 de 3 análisis · 5 de 10 créditos IA de nutrición"
export function resumen() {
  if (!aplica()) return null;
  const t = (k, n) => { const l = estado.limites[k]; return l.lim == null ? `${n} ilimitados` : `${estado.usos[k]} de ${l.lim} ${n}`; };
  return { plan: estado.nombre, hasta: estado.hasta, lineas: [t('video', 'análisis de video'), t('ia', 'créditos IA'), t('coach', 'entrenador IA')] };
}

// ventana con los planes. motivo: el texto de por que aparece (se acabo el cupo, funcion de Plus...)
const FILAS = [
  ['Análisis de video al mes', (p) => (p.video == null ? 'Ilimitado' : p.video)],
  ['Créditos IA al mes (nutrición y explicaciones)', (p) => p.ia],
  ['Entrenador IA', (p) => `${p.coach[0]} ${({ mes: 'al mes', semana: 'por semana', dia: 'al día' })[p.coach[1]]}`],
  ['Informe PDF', (p) => (p.pdf ? '✅' : 'Muestra')],
  ['Video en la comunidad', (p) => (p.videoComunidad ? '✅' : '—')],
  ['Exportar a Excel', (p) => (p.excel ? '✅' : '—')],
  ['Historial de velocidad', (p) => (p.historialDias ? `${p.historialDias} días` : 'Todo')],
];
let publicos = null; // v2.54.1 tabla de planes sin sesión (GET /api/planes)
export function mostrarMejora(motivo = '') {
  const e = estado || {}, planes = e.planes || (publicos && publicos.planes), precios = e.precios || (publicos && publicos.precios) || {};
  if (!planes && !publicos) fetch('/api/planes', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (d && d.planes) { publicos = d; const c = document.getElementById('plan-modal'); if (c && c.style.display !== 'none') mostrarMejora(motivo); } }).catch(() => {});
  let caja = document.getElementById('plan-modal');
  if (!caja) { caja = document.createElement('div'); caja.id = 'plan-modal'; caja.className = 'modal plan-modal'; document.body.appendChild(caja); }
  const ids = ['gratis', 'plus', 'pro', 'promax'];
  caja.innerHTML = `<div class="plan-caja"><h3 class="en-det-titulo">⭐ Mejora tu plan</h3>
    ${motivo ? `<p class="plan-motivo">${esc(motivo)}</p>` : ''}
    ${planes ? `<div class="plan-tabla-wrap"><table class="plan-tabla"><thead><tr><th></th>${ids.map((k) => `<th class="${k === e.plan ? 'actual' : ''}">${esc(planes[k].nombre)}<small>${nube.esIOS() ? '' : precios[k] ? `$${precios[k]}/mes` : 'Gratis'}</small></th>`).join('')}</tr></thead>
      <tbody>${FILAS.map(([n, f]) => `<tr><td>${n}</td>${ids.map((k) => `<td class="${k === e.plan ? 'actual' : ''}">${esc(f(planes[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
    <div id="plan-compra" class="plan-compra"></div>
    <p class="hint">Registrar entrenamientos y comidas es gratis y sin límite.${nube.esIOS() ? ' Se cobra a tu cuenta de Apple al confirmar la compra. La suscripción se renueva sola por el mismo periodo y precio, salvo que la canceles al menos 24 horas antes de que termine; cancelas cuando quieras en Ajustes → tu nombre → Suscripciones.' : ' Plan anual = 2 meses gratis. Se cobra con Google Play y se renueva solo; cancelas cuando quieras en Play Store → Pagos y suscripciones.'}</p>
    <button type="button" class="btn-primary" id="plan-cerrar" style="width:100%">Cerrar</button></div>`;
  caja.style.display = 'flex';
  caja.onclick = (ev) => { if (ev.target === caja) caja.style.display = 'none'; };
  document.getElementById('plan-cerrar').onclick = () => { caja.style.display = 'none'; };
  pintarCompra();
}

// ================================================================== COBRO CON GOOGLE PLAY (v2.37.0)
// Solo funciona dentro de la app instalada desde Google Play (Digital Goods API). Cada plan es una suscripcion de Play
// con su id (plus_mensual, pro_anual...). El servidor verifica cada compra con Google antes de activar el plan.
const PLAY = 'https://play.google.com/billing';
const SKUS = ['plus_mensual', 'plus_anual', 'pro_mensual', 'pro_anual', 'promax_mensual', 'promax_anual'];
let servicio, detalles = null, restaurado = false;
async function play() {
  if (servicio !== undefined) return servicio;
  servicio = null;
  if (typeof window !== 'undefined' && 'getDigitalGoodsService' in window) { try { servicio = (await window.getDigitalGoodsService(PLAY)) || null; } catch (e) { servicio = null; } }
  return servicio;
}
async function leerPrecios() {
  if (detalles) return detalles;
  const s = await play(); if (!s) return null;
  try { const l = await s.getDetails(SKUS); detalles = {}; for (const d of l) detalles[d.itemId] = d; } catch (e) { detalles = null; }
  return detalles;
}
const precioTxt = (d) => { try { return new Intl.NumberFormat('es-EC', { style: 'currency', currency: d.price.currency }).format(+d.price.value); } catch (e) { return `$${d.price.value}`; } };
function mensaje(t, error) { const m = document.getElementById('plan-compra-msg'); if (m) { m.textContent = t || ''; m.className = 'plan-compra-msg' + (error ? ' mal' : ''); } }
const usar = (r) => { if (r && r.planes) { estado = r; guardar(r); } };

export async function comprar(sku) {
  const s = await play(); if (!s) return;
  let resp;
  try {
    const pedido = new PaymentRequest([{ supportedMethods: PLAY, data: { sku } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }); // Play usa su propio precio
    resp = await pedido.show();
  } catch (e) { return; } // cancelo la compra
  mensaje('Verificando tu compra…');
  try {
    const r = await nube.api('POST', '/api/plan/compra', { token: resp.details.purchaseToken });
    await resp.complete(r.ok || r.pendiente ? 'success' : 'fail');
    usar(r);
    mensaje(r.pendiente ? r.error : r.ok ? `¡Listo! Ya tienes el plan ${r.nombre}. Gracias por apoyar FuerzaPro.` : 'Google Play no aprobó la compra.', !r.ok && !r.pendiente);
    window.dispatchEvent(new CustomEvent('af-plan'));
    if (r.ok) setTimeout(() => mostrarMejora(), 1500);
  } catch (e) {
    try { await resp.complete('fail'); } catch (x) { /* nada */ }
    mensaje(e.message + ' Si te cobraron, toca «Restaurar compras».', true);
  }
}
// manda a verificar las suscripciones activas de esta cuenta de Google Play (compra nueva en otro telefono, reinstalar…)
export async function restaurar(silencioso = false) {
  const s = await play();
  if (!s || !nube.conectado()) return 0;
  let lista = [], n = 0;
  try { lista = await s.listPurchases(); } catch (e) { return 0; }
  for (const p of lista) {
    if (!SKUS.includes(p.itemId)) continue;
    try { const r = await nube.api('POST', '/api/plan/compra', { token: p.purchaseToken }); usar(r); if (r.ok) n++; } catch (e) { if (!silencioso) mensaje(e.message, true); }
  }
  return n;
}
async function pintarCompra() {
  const caja = document.getElementById('plan-compra');
  if (!caja) return;
  if (nube.esIOS()) return pintarApple(caja); // v2.49.0
  if (!nube.conectado()) { caja.innerHTML = '<p class="plan-compra-msg">Inicia sesión en Perfil para suscribirte (tu plan queda en tu cuenta).</p>'; return; }
  const precios = await leerPrecios();
  if (!precios || !Object.keys(precios).length) {
    caja.innerHTML = '<p class="plan-compra-msg">Para suscribirte usa la app de FuerzaPro instalada desde Google Play.</p>'; return;
  }
  const e = estado || {}, nombres = { plus: 'Plus', pro: 'Pro', promax: 'Pro Max' };
  const boton = (sku, txt) => { const d = precios[sku]; if (!d) return '';
    const prueba = d.freeTrialPeriod ? ' · 7 días gratis' : '';
    return `<button type="button" class="btn-sec plan-comprar" data-sku="${sku}">${txt} ${esc(precioTxt(d))}${prueba}</button>`; };
  caja.innerHTML = ['plus', 'pro', 'promax'].map((k) => `<div class="plan-fila${k === e.plan ? ' actual' : ''}"><b>${nombres[k]}${k === e.plan ? ' ✓' : ''}</b>
      <div>${boton(k + '_mensual', 'Mensual')}${boton(k + '_anual', 'Anual')}</div></div>`).join('')
    + `<p id="plan-compra-msg" class="plan-compra-msg"></p>
    <div class="plan-compra-pie"><button type="button" class="btn-sec" id="plan-restaurar">Restaurar compras</button>
      <a class="btn-sec" href="https://play.google.com/store/account/subscriptions?package=com.fuerzapro.app" target="_blank" rel="noopener">Administrar suscripción</a></div>`;
  caja.querySelectorAll('.plan-comprar').forEach((b) => { b.onclick = () => comprar(b.dataset.sku); });
  document.getElementById('plan-restaurar').onclick = async () => {
    mensaje('Buscando tus compras en Google Play…');
    const n = await restaurar();
    if (n) { mensaje(`Compra restaurada: plan ${estado.nombre}.`); window.dispatchEvent(new CustomEvent('af-plan')); } else if (!document.querySelector('#plan-compra-msg.mal')) mensaje('No encontré suscripciones activas en esta cuenta de Google Play.');
  };
}

// ================================================================== COBRO CON APPLE EN IPHONE (v2.49.0)
// Solo en la app de iPhone (Capacitor): plugin nativo @capgo/native-purchases (StoreKit 2), los mismos 6 planes que en
// Google Play. Precios en la moneda de cada persona (los da Apple). El servidor verifica cada compra con Apple
// (POST /api/plan/compra-apple) y recien entonces se cierra la transaccion en el iPhone.
const tienda = () => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases) || null;
const ADMINISTRAR = 'https://apps.apple.com/account/subscriptions';
const EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
let productosApple = null;
// UUID fijo por cuenta para ligar la compra a la cuenta de FuerzaPro (misma receta que cuentaApple en _worker.js)
async function cuentaApple() {
  const s = nube.sesion(), id = s && s.usuario && s.usuario.id;
  if (!id) return undefined;
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fuerzapro:' + id))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
async function leerProductosApple() {
  if (productosApple) return productosApple;
  const t = tienda(); if (!t) return null;
  try { const r = await t.getProducts({ productIdentifiers: SKUS, productType: 'subs' }); productosApple = {}; for (const p of (r && r.products) || []) productosApple[p.identifier] = p; } catch (e) { productosApple = null; }
  return productosApple;
}
const errorTxt = (e) => String((e && (e.message || e.errorMessage || e.code)) || e || '');
async function verificarApple(transactionId) {
  const r = await nube.api('POST', '/api/plan/compra-apple', { transactionId: String(transactionId) });
  usar(r);
  return r;
}
async function comprarApple(sku) {
  const t = tienda(); if (!t) return;
  if (!nube.conectado()) { mensaje('Inicia sesión en Perfil para suscribirte (tu plan queda en tu cuenta).', true); return; }
  let tx;
  mensaje('Abriendo el App Store…');
  try {
    tx = await t.purchaseProduct({ productIdentifier: sku, productType: 'subs', quantity: 1, appAccountToken: await cuentaApple(), autoAcknowledgePurchases: false });
  } catch (e) {
    const m = errorTxt(e);
    if (/cancel/i.test(m)) { mensaje(''); return; } // cerro la ventana de Apple
    if (/pending/i.test(m)) { mensaje('La compra quedó pendiente de aprobación (por ejemplo, «Pedir permiso para comprar» de En familia). Cuando se apruebe, toca «Restaurar compras».'); return; }
    mensaje('No se pudo completar la compra con Apple. ' + m, true); return;
  }
  if (!tx || !tx.transactionId) { mensaje('Apple no devolvió la compra. Toca «Restaurar compras».', true); return; }
  mensaje('Verificando tu compra…');
  try {
    const r = await verificarApple(tx.transactionId);
    if (r.ok) { try { await t.acknowledgePurchase({ purchaseToken: String(tx.transactionId) }); } catch (x) { /* ya cerrada */ } }
    mensaje(r.ok ? `¡Listo! Ya tienes el plan ${r.nombre}. Gracias por apoyar FuerzaPro.` : 'Apple no aprobó la compra.', !r.ok);
    window.dispatchEvent(new CustomEvent('af-plan'));
    if (r.ok) setTimeout(() => mostrarMejora(), 1500);
  } catch (e) { mensaje(e.message + ' Si te cobraron, toca «Restaurar compras».', true); }
}
// manda a verificar las suscripciones vigentes de este Apple ID. pedirApple=true (boton) sincroniza antes con Apple
export async function restaurarApple(silencioso = false, pedirApple = false) {
  const t = tienda();
  if (!t || !nube.conectado()) return 0;
  if (pedirApple) { try { await t.restorePurchases(); } catch (e) { /* puede pedir la contraseña; si cancela, se usa lo que ya tiene el iPhone */ } }
  let lista = [], n = 0;
  try { lista = ((await t.getPurchases({ productType: 'subs' })) || {}).purchases || []; } catch (e) { return 0; }
  const vigentes = lista.filter((p) => SKUS.includes(p.productIdentifier) && p.isActive !== false && !p.isUpgraded && !p.revocationDate
    && (!p.expirationDate || Date.parse(p.expirationDate) > Date.now() - 16 * 864e5)).slice(0, 3); // incluye periodo de gracia (el servidor decide)
  for (const p of vigentes) {
    try {
      const r = await verificarApple(p.transactionId);
      if (r.ok) { n++; try { await t.acknowledgePurchase({ purchaseToken: String(p.transactionId) }); } catch (x) { /* ya cerrada */ } }
    } catch (e) { if (!silencioso) mensaje(e.message, true); }
  }
  return n;
}
async function pintarApple(caja) {
  const legal = `<p class="hint">Suscripciones de renovación automática. <a href="${EULA}" target="_blank" rel="noopener">Términos de uso (EULA)</a> · <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>`;
  if (!tienda()) { caja.innerHTML = '<p class="plan-compra-msg">Actualiza la app de FuerzaPro desde el App Store para suscribirte.</p>'; return; }
  if (!nube.conectado()) { caja.innerHTML = '<p class="plan-compra-msg">Inicia sesión en Perfil para suscribirte (tu plan queda en tu cuenta).</p>' + legal; return; }
  caja.innerHTML = '<p class="plan-compra-msg">Cargando precios del App Store…</p>';
  const productos = await leerProductosApple();
  if (!productos || !Object.keys(productos).length) {
    caja.innerHTML = '<p class="plan-compra-msg">No pude cargar las suscripciones del App Store. Revisa tu conexión e inténtalo de nuevo.</p>' + legal; productosApple = null; return;
  }
  const e = estado || {}, nombres = { plus: 'Plus', pro: 'Pro', promax: 'Pro Max' };
  const boton = (sku, txt, per) => { const d = productos[sku]; if (!d) return '';
    return `<button type="button" class="btn-sec plan-comprar" data-sku="${sku}">${txt} · ${esc(d.priceString)}/${per}</button>`; };
  caja.innerHTML = ['plus', 'pro', 'promax'].map((k) => `<div class="plan-fila${k === e.plan ? ' actual' : ''}"><b>${nombres[k]}${k === e.plan ? ' ✓' : ''}</b>
      <div>${boton(k + '_mensual', 'Mensual', 'mes')}${boton(k + '_anual', 'Anual', 'año')}</div></div>${k === 'pro' && productos.pro_mensual ? '<p class="hint">Pro mensual: prueba gratis de 7 días para nuevos suscriptores.</p>' : ''}`).join('')
    + `<p id="plan-compra-msg" class="plan-compra-msg"></p>
    <div class="plan-compra-pie"><button type="button" class="btn-sec" id="plan-restaurar">Restaurar compras</button>
      <a class="btn-sec" id="plan-administrar" href="${ADMINISTRAR}" target="_blank" rel="noopener">Administrar suscripción</a></div>` + legal;
  caja.querySelectorAll('.plan-comprar').forEach((b) => { b.onclick = () => comprarApple(b.dataset.sku); });
  document.getElementById('plan-administrar').onclick = async (ev) => { // hoja nativa de Apple; si falla, el enlace
    const t = tienda(); if (!t || !t.manageSubscriptions) return;
    ev.preventDefault();
    try { await t.manageSubscriptions(); } catch (x) { window.open(ADMINISTRAR, '_blank'); }
  };
  document.getElementById('plan-restaurar').onclick = async () => {
    mensaje('Buscando tus compras en el App Store…');
    const n = await restaurarApple(false, true);
    if (n) { mensaje(`Compra restaurada: plan ${estado.nombre}.`); window.dispatchEvent(new CustomEvent('af-plan')); } else if (!document.querySelector('#plan-compra-msg.mal')) mensaje('No encontré suscripciones activas en tu cuenta de Apple.');
  };
}

// cualquier respuesta 429/403 del servidor por limite de plan abre la ventana (lo avisa nube.js)
if (typeof window !== 'undefined') window.addEventListener('af-limite', (ev) => { actualizar(); mostrarMejora(ev.detail && ev.detail.error); });
