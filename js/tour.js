// Tour de bienvenida (v2.41.0): la primera vez que se abre la app, burbujas que señalan cada pestaña y explican para qué
// sirve. Se puede saltar y volver a ver desde Perfil → Más → «Ver el tour de la app».
const CLAVE = 'af_tour';
const PASOS = [
  { titulo: '👋 ¡Bienvenido a FuerzaPro!', texto: 'Te muestro la app en 30 segundos.' },
  { sel: '.nav [data-vista="v-entrenar"]', titulo: '🏋️ Entrenar', texto: 'Arma tus rutinas, anota series y pesos con cronómetro de descanso y mira tus récords y tu progreso.' },
  { sel: '.nav [data-vista="v-form"]', titulo: '⚡ Analizar', texto: 'Elige el ejercicio, graba tu serie de lado con el cuerpo completo y la IA cuenta tus repeticiones, mide tu velocidad y tu fuerza. Al final tienes informe, video con telemetría y PDF.' },
  { sel: '.nav [data-vista="v-nutricion"]', titulo: '🥗 Nutrición', texto: 'Metas de calorías y macros. Agrega comida con una foto del plato (IA), el código de barras o el buscador.' },
  { sel: '.nav [data-vista="v-comunidad"]', titulo: '👥 Comunidad', texto: 'Comparte tus análisis y entrenamientos, sigue a otros atletas y comenta.' },
  { sel: '.nav [data-vista="v-perfil"]', titulo: '👤 Perfil', texto: 'Tu cuenta, tu plan y tus datos (toca «Editar» para poner tu peso y estatura). En ⚙️ Ajustes están la guía y «Enviar comentario» si algo falla o tienes ideas.' },
  { titulo: '✅ ¡Listo!', texto: 'Consejo: pon tu peso y estatura en Perfil para que la fuerza y las calorías salgan exactas. ¡A entrenar!' },
];

export function yaVisto() { try { return !!localStorage.getItem(CLAVE); } catch (e) { return true; } }

export function iniciar(forzar = false) {
  if (!forzar && yaVisto()) return;
  let i = 0;
  const capa = document.createElement('div'); capa.className = 'tour';
  capa.innerHTML = '<div class="tour-luz"></div><div class="tour-caja" role="dialog" aria-live="polite"></div>';
  document.body.append(capa);
  const luz = capa.querySelector('.tour-luz'), caja = capa.querySelector('.tour-caja');
  const fin = () => { try { localStorage.setItem(CLAVE, '1'); } catch (e) { /* nada */ } capa.remove(); removeEventListener('resize', pintar); };
  function pintar() {
    const p = PASOS[i], el = p.sel && document.querySelector(p.sel), r = el && el.getBoundingClientRect();
    caja.innerHTML = `<b>${p.titulo}</b><p>${p.texto}</p><div class="tour-pie"><small>${i + 1} de ${PASOS.length}</small>
      <span>${i < PASOS.length - 1 ? '<button type="button" class="btn-sec" data-t="saltar">Saltar</button>' : ''}
      <button type="button" class="btn-primary" data-t="sig">${i === 0 ? 'Empezar' : i === PASOS.length - 1 ? 'Empezar a usar' : 'Siguiente'}</button></span></div>`;
    if (r && r.width) {
      const m = 6; luz.style.cssText = `display:block;left:${r.left - m}px;top:${r.top - m}px;width:${r.width + 2 * m}px;height:${r.height + 2 * m}px`;
      caja.className = 'tour-caja abajo';
      caja.style.bottom = `${innerHeight - r.top + 18}px`; caja.style.top = 'auto';
    } else {
      luz.style.cssText = 'display:block;left:50%;top:50%;width:0;height:0';
      caja.className = 'tour-caja centro'; caja.style.top = ''; caja.style.bottom = '';
    }
    caja.querySelector('[data-t="sig"]').onclick = () => { if (++i >= PASOS.length) fin(); else pintar(); };
    const s = caja.querySelector('[data-t="saltar"]'); if (s) s.onclick = fin;
  }
  addEventListener('resize', pintar);
  pintar();
}
