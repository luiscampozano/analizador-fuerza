// v2.62.0 Permiso para los datos de salud (LOPDP del Ecuador: datos sensibles; App Store 5.1.3). Antes de usar o guardar
// datos de salud (peso, medidas, entrenamientos, comidas, alergias…) se explica qué se usa y para qué, y se pide permiso
// explícito y separado. Se puede retirar en Perfil. Clave: af_salud_permiso = fecha ISO del permiso.
const CLAVE = 'af_salud_permiso';
export function tienePermiso() { try { return !!localStorage.getItem(CLAVE); } catch { return false; } }
export function fecha() { try { return localStorage.getItem(CLAVE); } catch { return null; } }
export function retirar() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }

let abierta = null;
// Devuelve true si la persona ya aceptó o acepta ahora; false si dice «Ahora no».
export function asegurar() {
  if (tienePermiso()) return Promise.resolve(true);
  if (abierta) return abierta;
  abierta = new Promise((listo) => {
    const m = document.createElement('div');
    m.className = 'modal'; m.id = 'salud-permiso'; m.style.display = 'flex';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'salud-titulo');
    m.innerHTML = `<div class="modal-caja ia-permiso-caja">
      <h3 id="salud-titulo">❤️ Tus datos de salud</h3>
      <p>Para calcular tus métricas, FuerzaPro usa datos que la ley considera <b>sensibles</b>:</p>
      <ul>
        <li>tu <b>peso, estatura, edad y sexo</b>, y tus <b>medidas corporales</b>;</li>
        <li>tus <b>entrenamientos y análisis</b> (repeticiones, velocidad, fuerza);</li>
        <li>tus <b>comidas, metas de nutrición</b> y lo que no comes o te cae mal.</li>
      </ul>
      <p><b>Para qué:</b> calcular fuerza, RIR, 1RM, calorías y macros, y mostrarte tu progreso. Se guardan en tu teléfono y, si inicias sesión, en tu copia en la nube. <b>No se venden ni se usan para publicidad.</b>
        <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>
      <p class="hint">Puedes retirar este permiso cuando quieras en Perfil. Sin él puedes explorar la app, pero no analizar series ni registrar entrenamientos, comidas o medidas.</p>
      <button type="button" class="btn-primary" id="salud-si" style="width:100%">Acepto el uso de mis datos de salud</button>
      <button type="button" class="btn-sec" id="salud-no" style="width:100%;margin-top:8px">Ahora no</button>
    </div>`;
    document.body.appendChild(m);
    const fin = (ok) => {
      if (ok) { try { localStorage.setItem(CLAVE, new Date().toISOString()); } catch { /* sin almacenamiento: se volverá a preguntar */ } }
      m.style.display = 'none'; setTimeout(() => m.remove(), 0); abierta = null; listo(ok);
    };
    m.querySelector('#salud-si').onclick = () => fin(true);
    m.querySelector('#salud-no').onclick = () => fin(false);
    m.querySelector('#salud-si').focus();
  });
  return abierta;
}
