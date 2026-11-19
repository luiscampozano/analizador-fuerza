// v2.67.0 «📐 Cómo grabar» según el ejercicio (pedido de usuarios: saber el mejor ángulo antes de analizar).
// Se arma con los datos de js/ejercicios.js: grupo, unilateral y los consejos que ya dicen «Graba de frente».
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function consejo(ej) {
  if (!ej || ej.cardio) return null; // el cardio y los deportes ya traen su propio consejo
  const h = (ej.hint || '').toLowerCase(), n = (ej.nombre || '').toLowerCase(), g = ej.grupo || '';
  const frente = /graba de frente/.test(h) && !/de lado o de frente|de frente o de lado/.test(h);
  const ambos = /de lado o de frente|de frente o de lado/.test(h);
  const vista = frente ? 'frente' : ambos ? 'ambos' : 'lado';
  const piso = /flexiones|sit-up|en el suelo|rueda abdominal|plancha|remo invertido|puente de gl/.test(n);
  const acostado = !/brazos rectos/.test(n) && /banca|press inclinado|press declinado|press con mancuerna|aperturas|pullover|hip thrust|rompecr|skull|press franc/.test(n);
  const altura = piso ? 'bajo, a 30–50 cm del piso'
    : acostado ? 'a la altura del banco'
      : /dominada|jal[oó]n|fondos|press militar|press de hombro|press de pecho|pec deck|muscle up|elevaci|face pull|crunch en m/.test(n) || g === 'Hombros' || g === 'Brazos' ? 'a la altura del pecho'
        : 'a la altura de la cadera';
  const distancia = g === 'Brazos' || g === 'Hombros' ? '1,5–2,5 m' : '2–3 m';
  const ver = g === 'Piernas' || g === 'Glúteo y femoral' || g === 'Potencia' ? 'de la cabeza a los pies, con la barra o la máquina' : 'todo tu cuerpo y la carga (barra, mancuernas o el agarre)';
  const items = [];
  if (vista === 'frente') items.push('<b>De frente</b>, mirándote de cara.');
  else if (vista === 'ambos') items.push('<b>De lado (90°)</b> o <b>de frente</b>: las dos sirven.');
  else items.push(`<b>De lado (90°)</b>, mirando tu costado${ej.unilateral ? ', <b>del lado que trabaja</b>' : ''}. En diagonal (45°) también funciona.`);
  items.push(`Celular <b>${altura}</b>, fijo y ${piso || acostado ? '<b>en horizontal</b> (acostado entras completo)' : 'en vertical'}.`);
  items.push(`A <b>${distancia}</b>: que entre ${ver}.`);
  items.push(vista === 'frente' ? 'Evita grabar de lado: un brazo tapa al otro y el arco no se ve.' : 'Evita grabar de frente: la profundidad y el recorrido no se ven bien.');
  return { vista, items };
}

// dibujo visto desde arriba: tú (en el centro) y dónde va el celular
function dibujo(vista) {
  const cel = vista === 'frente' ? { x: 60, y: 98, rot: 0 } : { x: 98, y: 50, rot: 90 };
  const lin = vista === 'frente' ? '<line x1="60" y1="66" x2="60" y2="94" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="3 3"/>'
    : '<line x1="76" y1="50" x2="92" y2="50" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="3 3"/>';
  // hombros de lado a lado (la persona mira hacia abajo del dibujo)
  return `<svg class="gr-svg" viewBox="0 0 120 120" width="104" height="104" aria-hidden="true">
    <text x="60" y="13" fill="#9a9ab0" font-size="9" text-anchor="middle">visto desde arriba</text>
    <rect x="40" y="44" width="40" height="10" rx="4" fill="#cbd5e1"/><circle cx="60" cy="49" r="11" fill="#7c5cff"/>
    <path d="M56 60 L60 66 L64 60" fill="none" stroke="#9a9ab0" stroke-width="1.5"/>
    <text x="60" y="80" fill="#ececf3" font-size="9" text-anchor="middle">tú</text>${lin}
    <rect x="${cel.x - 7}" y="${cel.y - 9}" width="14" height="18" rx="3" fill="#2dd4bf" transform="rotate(${cel.rot} ${cel.x} ${cel.y})"/>
    ${vista === 'ambos' ? '<rect x="53" y="89" width="14" height="18" rx="3" fill="none" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="2 2"/>' : ''}
  </svg>`;
}

export function html(ej) {
  const c = consejo(ej); if (!c) return '';
  const nombre = (ej.corto || ej.nombre || 'este ejercicio').toLowerCase();
  return `<div class="card gr-caja"><b>📐 Cómo grabar: ${esc(nombre)}</b>
    <div class="gr-fila">${dibujo(c.vista === 'ambos' ? 'ambos' : c.vista)}<ul>${c.items.map((x) => `<li>${x}</li>`).join('')}</ul></div></div>`;
}
