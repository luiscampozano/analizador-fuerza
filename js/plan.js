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
  if (!nube.conectado()) { estado = null; guardar(null); return null; }
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
  return { plan: estado.nombre, hasta: estado.hasta, lineas: [t('video', 'análisis de video'), t('ia', 'créditos IA de nutrición'), t('coach', 'entrenador IA')] };
}

// ventana con los planes. motivo: el texto de por que aparece (se acabo el cupo, funcion de Plus...)
const FILAS = [
  ['Análisis de video al mes', (p) => (p.video == null ? 'Ilimitado' : p.video)],
  ['Créditos IA para nutrición al mes', (p) => p.ia],
  ['Entrenador IA', (p) => `${p.coach[0]} ${({ mes: 'al mes', semana: 'por semana', dia: 'al día' })[p.coach[1]]}`],
  ['Informe PDF', (p) => (p.pdf ? '✅' : 'Muestra')],
  ['Video en la comunidad', (p) => (p.videoComunidad ? '✅' : '—')],
  ['Exportar a Excel', (p) => (p.excel ? '✅' : '—')],
  ['Historial de velocidad', (p) => (p.historialDias ? `${p.historialDias} días` : 'Todo')],
];
export function mostrarMejora(motivo = '') {
  const e = estado || {}, planes = e.planes, precios = e.precios || {};
  let caja = document.getElementById('plan-modal');
  if (!caja) { caja = document.createElement('div'); caja.id = 'plan-modal'; caja.className = 'modal plan-modal'; document.body.appendChild(caja); }
  const ids = ['gratis', 'plus', 'pro', 'promax'];
  caja.innerHTML = `<div class="plan-caja"><h3 class="en-det-titulo">⭐ Mejora tu plan</h3>
    ${motivo ? `<p class="plan-motivo">${esc(motivo)}</p>` : ''}
    ${planes ? `<div class="plan-tabla-wrap"><table class="plan-tabla"><thead><tr><th></th>${ids.map((k) => `<th class="${k === e.plan ? 'actual' : ''}">${esc(planes[k].nombre)}<small>${precios[k] ? `$${precios[k]}/mes` : 'Gratis'}</small></th>`).join('')}</tr></thead>
      <tbody>${FILAS.map(([n, f]) => `<tr><td>${n}</td>${ids.map((k) => `<td class="${k === e.plan ? 'actual' : ''}">${esc(f(planes[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
    <p class="hint">Registrar entrenamientos y comidas es gratis y sin límite. Los pagos con Google Play llegan muy pronto; plan anual = 2 meses gratis.</p>
    <button type="button" class="btn-primary" id="plan-cerrar" style="width:100%">Entendido</button></div>`;
  caja.style.display = 'flex';
  caja.onclick = (ev) => { if (ev.target === caja) caja.style.display = 'none'; };
  document.getElementById('plan-cerrar').onclick = () => { caja.style.display = 'none'; };
}

// cualquier respuesta 429/403 del servidor por limite de plan abre la ventana (lo avisa nube.js)
if (typeof window !== 'undefined') window.addEventListener('af-limite', (ev) => { actualizar(); mostrarMejora(ev.detail && ev.detail.error); });
