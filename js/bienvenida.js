// Pantalla de bienvenida: aparece la primera vez que se abre la app sin sesion. Permite entrar con Google,
// crear una cuenta o ingresar con cualquier correo, o explorar sin cuenta (todo queda solo en el telefono).
import * as nube from './nube.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VISTA = 'af_bienvenida';
let alTerminar = () => {};

export function iniciar(d = {}) {
  alTerminar = d.alTerminar || alTerminar;
  let vista = null;
  try { vista = localStorage.getItem(VISTA); } catch (e) { /* nada */ }
  if (!nube.conectado() && !vista) abrir();
}

// modo: 'inicio' | 'registro' | 'ingreso'
export function abrir(modo = 'inicio') {
  const b = $('bienvenida');
  b.style.display = 'flex';
  document.body.classList.add('sin-scroll');
  if (modo === 'inicio') pintarInicio(); else pintarCorreo(modo);
}
function cerrar(omitida = false) {
  try { localStorage.setItem(VISTA, omitida ? 'omitida' : 'cuenta'); } catch (e) { /* nada */ }
  $('bienvenida').style.display = 'none';
  document.body.classList.remove('sin-scroll');
  alTerminar();
}
const legal = '<p class="bv-legal">Al continuar aceptas la <a href="privacidad.html" target="_blank" rel="noopener">política de privacidad</a> y las <a href="normas.html" target="_blank" rel="noopener">normas de la comunidad</a>.</p>';

function pintarInicio() {
  $('bv-caja').innerHTML = `<div class="bv-marca"><img src="iconos/logo.png" alt=""><h1>FuerzaPro</h1><p>Entrena con datos. Mide tu fuerza con la cámara.</p></div>
    <ul class="bv-lista">
      <li><span>🎥</span><div><b>Analiza tus series con video</b><small>Velocidad de la barra, RPE, RIR y 1RM estimado con la cámara del celular.</small></div></li>
      <li><span>🏋️</span><div><b>Registra tus entrenamientos</b><small>Rutinas, récords y progreso. Importa tu historial de Hevy o Strong.</small></div></li>
      <li><span>🥗</span><div><b>Cuenta calorías y macros</b><small>Busca alimentos o escanea el código de barras.</small></div></li>
      <li><span>👥</span><div><b>Comparte con tu comunidad</b><small>Sigue a tus amigos y a tu gimnasio.</small></div></li>
    </ul>
    <div class="bv-botones">
      <div id="bv-google" class="pf-google"><span class="hint">Cargando Google…</span></div>
      <button type="button" class="btn-sec bv-correo" id="bv-correo">✉️ Continuar con correo</button>
      <p class="pf-nube-error" id="bv-error" style="display:none"></p>
      <button type="button" class="bv-omitir" id="bv-omitir">Explorar sin cuenta</button>
    </div>${legal}`;
  $('bv-correo').onclick = () => pintarCorreo('registro');
  $('bv-omitir').onclick = () => {
    if (confirm('Sin cuenta, tus datos se guardan solo en este teléfono y no podrás usar la Comunidad. Puedes crear tu cuenta después en Perfil. ¿Continuar?')) cerrar(true);
  };
  const err = (e) => { const p = $('bv-error'); if (p) { p.textContent = e.message || String(e); p.style.display = ''; } };
  nube.botonGoogle($('bv-google'), { alEntrar: () => cerrar(), alError: err })
    .catch((e) => { const g = $('bv-google'); if (g) g.innerHTML = ''; err(e); });
}

function pintarCorreo(modo) {
  const reg = modo === 'registro';
  $('bv-caja').innerHTML = `<button type="button" class="bv-atras" id="bv-atras">‹ Volver</button>
    <div class="bv-marca chica"><img src="iconos/logo.png" alt=""><h2>${reg ? 'Crea tu cuenta' : 'Ingresa a tu cuenta'}</h2></div>
    <div class="chips bv-tabs"><button type="button" class="chip${reg ? ' active' : ''}" data-m="registro">Crear cuenta</button><button type="button" class="chip${reg ? '' : ' active'}" data-m="ingreso">Ya tengo cuenta</button></div>
    <form id="bv-form" class="bv-form" novalidate>
      ${reg ? '<label>Nombre<input id="bv-nombre" autocomplete="name" maxlength="120" required></label>' : ''}
      <label>Correo<input id="bv-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" maxlength="200" required></label>
      <label>Contraseña<div class="bv-clave"><input id="bv-clave" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" maxlength="200" required><button type="button" id="bv-ver" aria-label="Mostrar contraseña">👁️</button></div></label>
      ${reg ? '<small class="hint">Mínimo 8 caracteres, con letras y números.</small>' : '<button type="button" class="bv-olvide" id="bv-olvide">¿Olvidaste tu contraseña?</button>'}
      <p class="pf-nube-error" id="bv-error" style="display:none"></p>
      <button type="submit" class="btn-primary" id="bv-enviar">${reg ? 'Crear cuenta' : 'Ingresar'}</button>
    </form>${legal}`;
  $('bv-atras').onclick = pintarInicio;
  $('bv-caja').querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => pintarCorreo(b.dataset.m)));
  $('bv-ver').onclick = () => { const i = $('bv-clave'); i.type = i.type === 'password' ? 'text' : 'password'; };
  if (!reg) $('bv-olvide').onclick = () => alert('Por ahora la recuperación es manual: escríbenos a campozanoluis1@gmail.com desde el correo de tu cuenta y te ayudamos a restablecerla.');
  setTimeout(() => (reg ? $('bv-nombre') : $('bv-email'))?.focus(), 100);
  $('bv-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('bv-error'); err.style.display = 'none';
    const email = $('bv-email').value.trim(), clave = $('bv-clave').value, nombre = reg ? $('bv-nombre').value.trim() : '';
    const mal = reg && !nombre ? 'Escribe tu nombre.' : !/^\S+@\S+\.\S+$/.test(email) ? 'Escribe un correo válido.'
      : reg && (clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) ? 'La contraseña debe tener al menos 8 caracteres, con letras y números.'
        : !clave ? 'Escribe tu contraseña.' : null;
    if (mal) { err.textContent = mal; err.style.display = ''; return; }
    const btn = $('bv-enviar'); btn.disabled = true; btn.textContent = reg ? 'Creando…' : 'Ingresando…';
    try {
      await nube.entrarConCorreo(modo, { email, clave, nombre });
      cerrar();
    } catch (e) {
      err.innerHTML = esc(e.message || String(e)); err.style.display = '';
      btn.disabled = false; btn.textContent = reg ? 'Crear cuenta' : 'Ingresar';
    }
  };
}
