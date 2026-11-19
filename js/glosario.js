// v2.67.0 explicaciones simples de los términos (para novatos). Junto a cada término va un botón ⓘ con
// data-term="clave"; al tocarlo se abre una ventanita abajo. Un solo escuchador para toda la app.
const T = {
  rpe: ['RPE · esfuerzo percibido', `<p>Qué tan dura fue la serie, del <b>1 al 10</b>.</p>
    <ul><li><b>10</b> = no podías hacer ni una más.</li><li><b>9</b> = te quedaba 1 repetición.</li><li><b>8</b> = te quedaban 2.</li><li><b>7 o menos</b> = te quedaban 3 o más.</li></ul>
    <p class="hint">Es opcional. Si grabas la serie, la app lo calcula sola por la velocidad (RPE = 10 − RIR).</p>`],
  rir: ['RIR · repeticiones en reserva', `<p>Cuántas repeticiones <b>más</b> podías hacer antes de no poder levantar el peso.</p>
    <ul><li><b>0</b> = llegaste al fallo.</li><li><b>1–3</b> = cerca del fallo: es lo que más ayuda a ganar fuerza y músculo.</li><li><b>4 o más</b> = la serie fue fácil.</li></ul>
    <p class="hint">La app lo estima por cuánto se frenó tu última repetición.</p>`],
  '1rm': ['1RM · tu peso máximo', `<p>El peso más alto que podrías levantar <b>una sola vez</b> con buena técnica.</p>
    <p>No hace falta probarlo: la app lo <b>estima</b> con el peso, tus repeticiones y lo que te sobró (RIR). Sirve para ver si estás más fuerte semana a semana.</p>`],
  vel: ['Velocidad (m/s)', `<p>Qué tan rápido subió la carga, en <b>metros por segundo</b>.</p>
    <ul><li>Más rápido = te sobra fuerza con ese peso.</li><li>Cuando la velocidad baja mucho, estás cerca del fallo.</li></ul>
    <p class="hint">Ejemplo: en sentadilla, 1 m/s es un peso ligero y 0,3 m/s es casi tu máximo.</p>`],
  perdida: ['Pérdida de velocidad', `<p>Cuánto más lenta fue tu repetición más lenta comparada con la más rápida.</p>
    <ul><li><b>Menos de 20 %</b>: serie fresca, buena para fuerza y potencia.</li><li><b>20–40 %</b>: serie dura, buena para músculo.</li><li><b>Más de 40 %</b>: muy cerca del fallo, mucha fatiga.</li></ul>`],
  carga: ['Carga efectiva', `<p>El peso que <b>de verdad</b> moviste.</p>
    <p>En máquinas inclinadas, poleas o con tu propio cuerpo no siempre es lo que marca la pila o los discos: la app lo corrige con el ángulo y la máquina.</p>`],
  fuerza: ['Fuerza pico', `<p>El empujón más fuerte que hiciste en la serie, en kilos. Puede ser más que la carga porque, al acelerar, empujas más que el peso que estás sosteniendo.</p>`],
  potencia: ['Potencia pico (watts)', `<p>Fuerza × velocidad: qué tan <b>explosivo</b> fuiste. Importa mucho en deportes (saltar, sprintar, lanzar).</p>
    <p class="hint">Sube si mueves el mismo peso más rápido.</p>`],
  volumen: ['Volumen', `<p>Todo el peso que moviste: <b>peso × repeticiones</b>, sumado en todas las series.</p>
    <p class="hint">Ejemplo: 3 series de 10 con 50 kg = 1.500 kg. Si sube con las semanas, estás entrenando más.</p>`],
  anterior: ['Anterior', `<p>Lo que hiciste en esa misma serie <b>la última vez</b> que hiciste este ejercicio. Úsalo para intentar superarlo: un poco más de peso o una repetición más.</p>`],
};

let caja = null;
export function abrir(k) {
  const t = T[k]; if (!t) return;
  if (caja) caja.remove();
  caja = document.createElement('div');
  caja.className = 'glo-fondo';
  caja.innerHTML = `<div class="glo-hoja" role="dialog" aria-modal="true" aria-labelledby="glo-t"><b id="glo-t">${t[0]}</b><div class="glo-txt">${t[1]}</div>
    <button type="button" class="btn-sec en-terminar glo-ok">Entendido</button></div>`;
  const cerrar = () => { if (caja) { caja.remove(); caja = null; } };
  caja.onclick = (e) => { if (e.target === caja || e.target.closest('.glo-ok')) cerrar(); };
  document.body.appendChild(caja);
  caja.querySelector('.glo-ok').focus();
}
// botón ⓘ para poner junto a un término
export const ti = (k) => `<button type="button" class="glo-i" data-term="${k}" aria-label="¿Qué es ${T[k] ? T[k][0].split(' · ')[0] : 'esto'}?">ⓘ</button>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-term]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  abrir(b.dataset.term);
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && caja) { caja.remove(); caja = null; } });
