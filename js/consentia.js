// v2.54.3 Permiso para las funciones con IA (App Store 5.1.2(i)): antes de enviar por primera vez una foto, un texto o
// datos a Anthropic (Claude), se explica qué se envía y para qué, y se pide permiso explícito. Se puede retirar en Perfil.
const CLAVE = 'af_ia_permiso';

export function tienePermiso() { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } }
export function retirar() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }

let abierta = null;
// Devuelve true si la persona ya aceptó o acepta ahora; false si dice «Ahora no».
export function asegurar() {
  if (tienePermiso()) return Promise.resolve(true);
  if (abierta) return abierta;
  abierta = new Promise((listo) => {
    const m = document.createElement('div');
    m.className = 'modal'; m.id = 'ia-permiso'; m.style.display = 'flex';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'ia-permiso-titulo');
    m.innerHTML = `<div class="modal-caja ia-permiso-caja">
      <h3 id="ia-permiso-titulo">🤖 Funciones con inteligencia artificial</h3>
      <p>Para responderte, FuerzaPro envía a <b>Anthropic</b>, la empresa que hace la IA <b>Claude</b>, solo lo necesario:</p>
      <ul>
        <li>la <b>foto</b> de tu plato, de la etiqueta o de una máquina del gimnasio, o el <b>texto</b> que escribes;</li>
        <li>para el entrenador IA y el menú del nutricionista: un resumen de tus <b>entrenamientos, comidas, metas y perfil</b> (edad, sexo, peso, estatura, objetivo y, en el menú, tus gustos y lo que evitas);</li>
        <li>para la explicación de una serie: los <b>números medidos</b> de esa serie y, si la pides con fotos, hasta 4 imágenes del video.</li>
      </ul>
      <p>Se usa solo para darte la respuesta. FuerzaPro no guarda esas fotos ni las publica, y no se usan para publicidad. Según sus condiciones comerciales, Anthropic no usa estos datos para entrenar sus modelos.
        <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>
      <p class="hint">Puedes retirar este permiso cuando quieras en Perfil. Sin él, todo lo demás de la app sigue funcionando.</p>
      <button type="button" class="btn-primary" id="ia-permiso-si" style="width:100%">Acepto y continuar</button>
      <button type="button" class="btn-sec" id="ia-permiso-cerrar" style="width:100%;margin-top:8px">Ahora no</button>
    </div>`;
    document.body.appendChild(m);
    const fin = (ok) => {
      if (ok) { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: se volverá a preguntar */ } }
      m.style.display = 'none'; setTimeout(() => m.remove(), 0); abierta = null; listo(ok);
    };
    m.querySelector('#ia-permiso-si').onclick = () => fin(true);
    m.querySelector('#ia-permiso-cerrar').onclick = () => fin(false);
    m.querySelector('#ia-permiso-si').focus();
  });
  return abierta;
}
