// v2.55.0 ¿Qué máquina es? Foto de una máquina del gimnasio -> la IA elige el ejercicio de la lista de FuerzaPro.
// Se usa dentro del buscador de ejercicios del entrenamiento (js/entrenar.js). La foto se achica aquí y no se guarda.
import * as nube from './nube.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let turno = 0; // sube cada vez que se pide o se cancela: una respuesta vieja que llega tarde se ignora
export const cancelar = () => { turno++; };
const CONF = { alta: 'Muy segura', media: 'Bastante segura', baja: 'No muy segura' };

async function reducir(archivo, lado = 768) {
  const bmp = await createImageBitmap(archivo), k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75).split(',')[1];
}

// caja: dónde se pinta; ejercicios: biblioteca (deps.ejercicios); porId: deps.porId;
// alAgregar(id, nombre): agrega el ejercicio; alVolver(): vuelve a la lista del buscador.
export async function identificar(archivo, { caja, ejercicios, porId, alAgregar, alVolver }) {
  const mio = ++turno, vigente = () => mio === turno && caja.isConnected && caja.offsetParent !== null;
  const volver = '<button type="button" class="btn-sec mq-volver">‹ Volver a la lista</button>';
  const enlazar = () => { const b = caja.querySelector('.mq-volver'); if (b) b.onclick = alVolver; };
  if (!nube.conectado()) { caja.innerHTML = `<div class="mq-caja"><p class="hint">Inicia sesión en Perfil para usar la IA que reconoce máquinas.</p>${volver}</div>`; enlazar(); return; }
  let img;
  try { img = await reducir(archivo); } catch { if (!vigente()) return; caja.innerHTML = `<div class="mq-caja"><p class="hint">No pude leer la foto. Prueba con otra.</p>${volver}</div>`; enlazar(); return; }
  if (!vigente()) return;
  const foto = 'data:image/jpeg;base64,' + img;
  caja.innerHTML = `<div class="mq-caja"><div class="mq-foto"><img src="${foto}" alt="Foto de la máquina"><div class="mq-escaner"></div></div>
    <p class="hint" style="text-align:center">🤖 Identificando la máquina… (unos segundos)</p></div>`;
  const lista = ejercicios.filter((e) => !e.cardio).map((e) => ({ id: e.id, nombre: [e.nombre, e.equipo].filter(Boolean).join(' · ') }));
  let r;
  try { r = await nube.api('POST', '/api/ia/maquina', { imagen: img, lista }); }
  catch (e) { if (!vigente()) return; caja.innerHTML = `<div class="mq-caja"><p class="hint">${esc(e.message || e)}</p>${volver}</div>`; enlazar(); return; }
  if (!vigente()) return; // la persona escribió en el buscador o lo cerró mientras la IA respondía
  const def = r.id && porId[r.id];
  const opciones = (r.otras || []).filter((id) => porId[id]);
  const chip = (id) => `<button type="button" class="mq-chip" data-ej="${esc(id)}">${esc(porId[id].nombre)}</button>`;
  caja.innerHTML = `<div class="mq-caja">
    ${def ? `<div class="mq-res mq-${esc(r.confianza)}">
      <div class="mq-cab"><img src="${foto}" alt=""><div><b>${esc(def.nombre)}</b><small>${esc(r.maquina || def.equipo || '')}${r.musculos ? ' · ' + esc(r.musculos) : ''}</small></div>
        <span class="mq-conf">${CONF[r.confianza] || CONF.baja}</span></div>
      ${(r.consejos || []).length ? `<ul>${r.consejos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    </div>
    <button type="button" class="btn-primary mq-agregar" data-ej="${esc(r.id)}">＋ Agregar «${esc(def.nombre)}»</button>`
    : `<div class="mq-foto"><img src="${foto}" alt="Foto de la máquina"></div><p class="hint">${esc(r.nota || 'No pude reconocer la máquina.')} Prueba con una foto de lado, con toda la máquina a la vista.</p>`}
    ${opciones.length ? `<p class="hint mq-otras">${def ? '¿No es esta? Quizás sea:' : 'Quizás sea:'}</p><div class="mq-chips">${opciones.map(chip).join('')}</div>` : ''}
    <div class="mq-pie">${volver}${r.quedan != null ? `<small>Te quedan ${esc(r.quedan)} usos de IA.</small>` : ''}</div>
    <p class="hint" style="margin:6px 0 0">La IA puede equivocarse: revisa que sea tu máquina. <a href="fuentes.html" target="_blank" rel="noopener">📚 Fuentes</a></p>
  </div>`;
  enlazar();
  caja.querySelectorAll('[data-ej]').forEach((b) => (b.onclick = () => alAgregar(b.dataset.ej, porId[b.dataset.ej].nombre)));
}
