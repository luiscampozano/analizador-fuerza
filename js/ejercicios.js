// Biblioteca de ejercicios.
// perfil: riel (carga sobre un riel inclinado alfa), libre (vertical), polea (pila de placas), corporal.
// punto: lo que se sigue · ancla: parte del cuerpo que no se mueve (cancela el movimiento de la camara)
// sentido: hacia donde va la fase concentrica (cuando se vence la carga): arriba, abajo, hacia_ancla, lejos_ancla.
// mvt: velocidad media minima (m/s) con la que suele salir la ultima rep posible (aprox., literatura VBT).
// ecuacion: relacion carga-velocidad validada (solo donde existe una de referencia).
// fraccion: parte del peso corporal que se mueve (ejercicios de peso corporal).
// alterno: cada brazo por separado, alternando · unilateral: toda la serie con un solo brazo (se sigue la mano que mas se mueve).
// aprox: movimiento en arco o con palancas: fuerza y potencia son aproximadas.
// en: nombres en ingles para el buscador (como aparecen en apps tipo Hevy).
// Catalogo tomado como referencia: free-exercise-db (dominio publico) y nombres habituales de apps de gimnasio.

const BARRA = 'Pon solo los discos, sin la barra: la app le suma la barra (20 kg; cámbialo en «Peso de la barra»).';
const EQ = {
  barra: { equipo: 'Barra', perfil: 'libre', carro: 20, hint: BARRA },
  ez: { equipo: 'Barra Z', perfil: 'libre', carro: 10, hint: 'Pon solo los discos: la app le suma 10 kg de la barra Z (ajústalo en «Peso de la barra»).' },
  mancuernas: { equipo: 'Mancuernas', perfil: 'libre', carro: 0, hint: 'Peso = suma de las dos mancuernas.' },
  mancuerna: { equipo: 'Mancuerna', perfil: 'libre', carro: 0, hint: 'Peso = la mancuerna.' },
  kettlebell: { equipo: 'Kettlebell', perfil: 'libre', carro: 0, hint: 'Peso = la kettlebell (o la suma si usas dos).' },
  polea: { equipo: 'Polea', perfil: 'polea', hint: 'Peso = lo que marca la pila. Si la polea es doble, cambia la relación en Ajustes avanzados.' },
  maquina: { equipo: 'Máquina de placas', perfil: 'polea', aprox: true,
    hint: 'Peso = lo que marca la pila. La máquina usa palancas o levas: fuerza y potencia son aproximadas; velocidad, reps y RIR sí sirven.' },
  palanca: { equipo: 'Máquina con discos', perfil: 'libre', carro: 0, aprox: true,
    hint: 'Peso = discos cargados. La palanca cambia la carga real: fuerza y potencia son aproximadas.' },
  riel: { equipo: 'Máquina de riel', perfil: 'riel', alfa: 45, carro: 0,
    hint: 'Mide la inclinación del riel con el inclinómetro del celular. Si sabes cuánto pesa el carro, ponlo en «Carro de la máquina».' },
  smith: { equipo: 'Smith', perfil: 'riel', alfa: 90, carro: 15, hint: 'La barra Smith suele pesar 10–20 kg (contrapesada): ajústalo en «Carro de la máquina».' },
  corporal: { equipo: 'Peso corporal', perfil: 'corporal', hint: 'Peso = lastre o chaleco (0 si no usas).' },
  cardio: { equipo: 'Cardio', perfil: 'cardio', cardio: true, hint: 'Se registra tiempo y distancia; no tiene análisis por video.' },
};
const SENT = { punto: 'hombros', ancla: 'tobillos', sentido: 'arriba' }; // el cuerpo sube y baja
const UNI_P = 'Graba de lado, desde el lado de la pierna que trabaja. Analiza cada pierna en un video aparte.';
const UNI_B = 'Analiza cada brazo en un video aparte; la app sigue la mano que se mueve. Peso = el de un solo lado.';
const MANOS = (sentido = 'arriba', ancla = 'cadera') => ({ punto: 'manos', ancla, sentido });

// E(id, grupo, equipo, icono, nombre, corto, config, alias en ingles)
const E = (id, grupo, eq, icono, nombre, corto, cfg, en = '') => ({ id, grupo, icono, nombre, corto, ...EQ[eq], ...cfg, en });

export const EJERCICIOS = [
  // ---------------------------------------------------------------- PIERNAS
  E('sentadilla', 'Piernas', 'barra', '🏋️', 'Sentadilla con barra', 'Sentadilla', { ...SENT, mvt: 0.32, ecuacion: 'sentadilla' }, 'back squat barbell squat'),
  E('sentadilla_frontal', 'Piernas', 'barra', '🏋️', 'Sentadilla frontal', 'Sent. frontal', { ...SENT, mvt: 0.32 }, 'front squat'),
  E('sentadilla_box', 'Piernas', 'barra', '📦', 'Sentadilla al cajón', 'Sent. al cajón', { ...SENT, mvt: 0.32 }, 'box squat'),
  E('sentadilla_pausa', 'Piernas', 'barra', '⏸️', 'Sentadilla con pausa', 'Sent. con pausa', { ...SENT, mvt: 0.32 }, 'pause squat'),
  E('sentadilla_goblet', 'Piernas', 'mancuerna', '🏆', 'Sentadilla goblet', 'Goblet', { ...SENT, mvt: 0.32, hint: 'Peso = la mancuerna o kettlebell.' }, 'goblet squat'),
  E('sentadilla_mancuernas', 'Piernas', 'mancuernas', '🏋️', 'Sentadilla con mancuernas', 'Sent. mancuernas', { ...SENT, mvt: 0.32 }, 'dumbbell squat'),
  E('sentadilla_sumo', 'Piernas', 'mancuerna', '🦵', 'Sentadilla sumo con mancuerna', 'Sent. sumo', { ...SENT, mvt: 0.32 }, 'sumo squat plie dumbbell'),
  E('smith_sentadilla', 'Piernas', 'smith', '🏗️', 'Sentadilla en Smith', 'Smith sentadilla', { ...SENT, mvt: 0.32 }, 'smith machine squat'),
  E('hack', 'Piernas', 'riel', '🏋️', 'Hack squat / péndulo', 'Hack squat', { ...SENT, mvt: 0.30, hint: 'Graba de lado. Ajusta la inclinación del riel de tu máquina.' }, 'hack squat pendulum squat'),
  E('prensa_45', 'Piernas', 'riel', '🦵', 'Prensa 45°', 'Prensa 45°', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.25,
    hint: 'Graba de lado. El carro de la prensa también pesa (30–50 kg): ponlo en «Carro de la máquina» si lo sabes.' }, 'leg press 45'),
  E('prensa_horizontal', 'Piernas', 'maquina', '🦵', 'Prensa horizontal (sentado)', 'Prensa horizontal', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.25 }, 'seated leg press horizontal'),
  E('prensa_45_unilateral', 'Piernas', 'riel', '🦵', 'Prensa 45° a una pierna', 'Prensa 1 pierna', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.25, unilateral: true,
    hint: UNI_P + ' El carro de la prensa también pesa: ponlo en «Carro de la máquina» si lo sabes.' }, 'single leg press unilateral leg press'),
  E('prensa_horizontal_unilateral', 'Piernas', 'maquina', '🦵', 'Prensa horizontal a una pierna', 'Prensa horiz. 1 pierna', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.25, unilateral: true, hint: UNI_P }, 'single leg seated leg press'),
  E('belt_squat', 'Piernas', 'palanca', '🏋️', 'Belt squat', 'Belt squat', { ...SENT, punto: 'cadera', mvt: 0.30 }, 'belt squat'),
  E('zancada', 'Piernas', 'mancuernas', '🚶', 'Zancada / búlgara', 'Zancada', { ...SENT, mvt: 0.30, hint: 'Pon el peso total de las mancuernas o de la barra con discos.' }, 'lunge bulgarian split squat'),
  E('bulgara_mancuernas', 'Piernas', 'mancuernas', '🦿', 'Sentadilla búlgara con mancuernas', 'Búlgara', { ...SENT, mvt: 0.30, hint: 'Graba de lado. Peso = suma de las dos mancuernas. Analiza cada pierna en un video aparte.' }, 'bulgarian split squat dumbbell'),
  E('bulgara_barra', 'Piernas', 'barra', '🦿', 'Sentadilla búlgara con barra', 'Búlgara barra', { ...SENT, mvt: 0.30 }, 'bulgarian split squat barbell'),
  E('zancada_barra', 'Piernas', 'barra', '🚶', 'Zancada con barra', 'Zancada barra', { ...SENT, mvt: 0.30 }, 'barbell lunge'),
  E('zancada_atras', 'Piernas', 'mancuernas', '🔙', 'Zancada hacia atrás', 'Zancada atrás', { ...SENT, mvt: 0.30 }, 'reverse lunge'),
  E('zancada_caminando', 'Piernas', 'mancuernas', '🚶', 'Zancada caminando', 'Zancada caminando', { ...SENT, mvt: 0.30, hint: 'Graba de lado y con el cuerpo completo en el cuadro durante todo el recorrido.' }, 'walking lunge'),
  E('bulgara_smith', 'Piernas', 'smith', '🦿', 'Sentadilla búlgara en Smith', 'Búlgara Smith', { ...SENT, mvt: 0.30, hint: UNI_P }, 'smith machine bulgarian split squat'),
  E('step_up', 'Piernas', 'mancuernas', '🪜', 'Subida al cajón (step-up)', 'Step-up', { ...SENT, mvt: 0.30 }, 'step up box'),
  E('extension_cuadriceps', 'Piernas', 'maquina', '🦵', 'Extensión de cuádriceps', 'Extensión cuád.', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.40,
    hint: 'Graba de lado. Peso = lo que marca la pila. Movimiento en arco: fuerza y potencia aproximadas.' }, 'leg extension'),
  E('extension_unilateral', 'Piernas', 'maquina', '🦵', 'Extensión de cuádriceps a una pierna', 'Extensión 1 pierna', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.40, unilateral: true,
    hint: UNI_P + ' Movimiento en arco: fuerza y potencia aproximadas.' }, 'single leg extension unilateral'),
  E('curl_femoral_tumbado', 'Piernas', 'maquina', '🦵', 'Curl femoral tumbado', 'Femoral tumbado', { punto: 'pies', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40,
    hint: 'Graba de lado. Peso = lo que marca la pila. Movimiento en arco: fuerza y potencia aproximadas.' }, 'lying leg curl hamstring'),
  E('curl_femoral_tumbado_unilateral', 'Piernas', 'maquina', '🦵', 'Curl femoral tumbado a una pierna', 'Femoral tumbado 1p', { punto: 'pies', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40, unilateral: true, hint: UNI_P }, 'single leg lying leg curl'),
  E('curl_femoral_sentado', 'Piernas', 'maquina', '🦵', 'Curl femoral sentado', 'Femoral sentado', { punto: 'pies', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40,
    hint: 'Graba de lado. Peso = lo que marca la pila. Movimiento en arco: fuerza y potencia aproximadas.' }, 'seated leg curl hamstring'),
  E('curl_femoral_sentado_unilateral', 'Piernas', 'maquina', '🦵', 'Curl femoral sentado a una pierna', 'Femoral sentado 1p', { punto: 'pies', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40, unilateral: true, hint: UNI_P }, 'single leg seated leg curl'),
  E('curl_femoral_pie', 'Piernas', 'maquina', '🦵', 'Curl femoral de pie (una pierna)', 'Femoral de pie', { punto: 'pies', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40, unilateral: true, hint: UNI_P }, 'standing leg curl'),
  E('abductores_maquina', 'Piernas', 'maquina', '↔️', 'Abductores en máquina', 'Abductores', { punto: 'rodillas', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.30, unilateral: true, aprox: true,
    hint: 'Graba de frente. La app sigue una rodilla. Movimiento en arco: fuerza y potencia aproximadas; reps, velocidad y RIR sí sirven.' }, 'hip abduction machine abductor'),
  E('aductores_maquina', 'Piernas', 'maquina', '↔️', 'Aductores en máquina', 'Aductores', { punto: 'rodillas', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.30, unilateral: true, aprox: true,
    hint: 'Graba de frente. La app sigue una rodilla. Movimiento en arco: fuerza y potencia aproximadas; reps, velocidad y RIR sí sirven.' }, 'hip adduction machine adductor'),
  E('pantorrilla_pie', 'Piernas', 'maquina', '🦶', 'Pantorrilla de pie', 'Pantorrilla', { punto: 'pies', ancla: 'puntas', sentido: 'arriba', mvt: 0.20,
    hint: 'Teléfono fijo (trípode), de lado. Peso = la pila, o mancuernas/barra si es libre. Recorrido corto: usa precisión Máxima.' }, 'standing calf raise'),
  E('pantorrilla_smith', 'Piernas', 'smith', '🦶', 'Pantorrilla en Smith', 'Pantorrilla Smith', { punto: 'pies', ancla: 'puntas', sentido: 'arriba', mvt: 0.20,
    hint: 'Teléfono fijo (trípode), de lado. Recorrido corto: usa precisión Máxima.' }, 'smith calf raise'),
  E('pantorrilla_sentado', 'Piernas', 'maquina', '🦶', 'Pantorrilla sentado', 'Pantorrilla sentado', { punto: 'rodillas', ancla: 'tobillos', sentido: 'arriba', mvt: 0.20,
    hint: 'Graba de lado, teléfono fijo. Peso = la pila o los discos. Recorrido corto: usa precisión Máxima.' }, 'seated calf raise'),
  E('pantorrilla_unilateral', 'Piernas', 'mancuerna', '🦶', 'Pantorrilla a una pierna con mancuerna', 'Pantorrilla 1 pierna', { punto: 'pies', ancla: 'puntas', sentido: 'arriba', mvt: 0.20,
    hint: 'Teléfono fijo (trípode), de lado. Peso = la mancuerna. Recorrido corto: usa precisión Máxima.' }, 'single leg calf raise dumbbell'),
  E('pantorrilla_prensa', 'Piernas', 'riel', '🦶', 'Pantorrilla en prensa', 'Pantorrilla prensa', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.20,
    hint: 'Graba de lado. Recorrido corto: usa precisión Máxima.' }, 'calf press leg press calf raise'),
  E('sentadilla_corporal', 'Piernas', 'corporal', '🧍', 'Sentadilla sin peso', 'Sent. corporal', { ...SENT, mvt: 0.32, fraccion: 0.88,
    hint: 'Graba de lado. Peso = lastre o chaleco (0 si no usas).' }, 'air squat bodyweight squat'),
  E('pistol', 'Piernas', 'corporal', '🦵', 'Sentadilla a una pierna (pistol)', 'Pistol', { ...SENT, mvt: 0.30, fraccion: 0.88 }, 'pistol squat single leg'),

  // ---------------------------------------------------------------- GLUTEOS Y FEMORAL (bisagra de cadera)
  E('peso_muerto', 'Glúteo y femoral', 'barra', '⬆️', 'Peso muerto', 'Peso muerto', { ...MANOS('arriba', 'tobillos'), mvt: 0.15,
    hint: BARRA + ' Con mancuernas: la suma de ambas y Barra en 0.' }, 'deadlift conventional'),
  E('peso_muerto_sumo', 'Glúteo y femoral', 'barra', '⬆️', 'Peso muerto sumo', 'P. muerto sumo', { ...MANOS('arriba', 'tobillos'), mvt: 0.15 }, 'sumo deadlift'),
  E('peso_muerto_rumano', 'Glúteo y femoral', 'barra', '⬆️', 'Peso muerto rumano', 'P. muerto rumano', { ...MANOS('arriba', 'tobillos'), mvt: 0.25 }, 'romanian deadlift rdl'),
  E('rumano_mancuernas', 'Glúteo y femoral', 'mancuernas', '⬆️', 'Peso muerto rumano con mancuernas', 'Rumano mancuernas', { ...MANOS('arriba', 'tobillos'), mvt: 0.25 }, 'dumbbell romanian deadlift rdl'),
  E('rumano_unipodal', 'Glúteo y femoral', 'mancuerna', '🦩', 'Peso muerto rumano a una pierna', 'Rumano 1 pierna', { ...MANOS('arriba', 'tobillos'), mvt: 0.25,
    hint: 'Graba de lado. Peso = la mancuerna o kettlebell (o la suma si usas dos).' }, 'single leg romanian deadlift rdl'),
  E('peso_muerto_rigido', 'Glúteo y femoral', 'barra', '⬆️', 'Peso muerto piernas rígidas', 'P. muerto rígido', { ...MANOS('arriba', 'tobillos'), mvt: 0.25 }, 'stiff leg deadlift'),
  E('peso_muerto_hex', 'Glúteo y femoral', 'barra', '⬡', 'Peso muerto con barra hexagonal', 'Barra hexagonal', { ...MANOS('arriba', 'tobillos'), mvt: 0.15, carro: 25,
    hint: 'Pon solo los discos: la app le suma 25 kg de la barra hexagonal (pésala o pregunta y ajústalo en «Peso de la barra»).' }, 'trap bar deadlift hex bar'),
  E('peso_muerto_deficit', 'Glúteo y femoral', 'barra', '⬆️', 'Peso muerto en déficit', 'P. muerto déficit', { ...MANOS('arriba', 'tobillos'), mvt: 0.15 }, 'deficit deadlift'),
  E('rack_pull', 'Glúteo y femoral', 'barra', '⬆️', 'Rack pull (desde bloques)', 'Rack pull', { ...MANOS('arriba', 'tobillos'), mvt: 0.15 }, 'rack pull block pull'),
  E('buenos_dias', 'Glúteo y femoral', 'barra', '🌅', 'Buenos días', 'Buenos días', { ...SENT, mvt: 0.30 }, 'good morning'),
  E('hip_thrust', 'Glúteo y femoral', 'barra', '🍑', 'Hip thrust', 'Hip thrust', { punto: 'cadera', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25,
    hint: 'Graba de lado. ' + BARRA }, 'hip thrust barbell'),
  E('hip_thrust_maquina', 'Glúteo y femoral', 'palanca', '🍑', 'Hip thrust en máquina', 'Hip thrust máq.', { punto: 'cadera', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25 }, 'hip thrust machine'),
  E('hip_thrust_unilateral', 'Glúteo y femoral', 'mancuerna', '🍑', 'Hip thrust a una pierna', 'Hip thrust 1 pierna', { punto: 'cadera', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25,
    hint: 'Graba de lado. Peso = la mancuerna o disco sobre la cadera (0 si es sin peso).' }, 'single leg hip thrust'),
  E('puente_gluteo', 'Glúteo y femoral', 'barra', '🍑', 'Puente de glúteo', 'Puente glúteo', { punto: 'cadera', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25 }, 'glute bridge'),
  E('pull_through', 'Glúteo y femoral', 'polea', '🍑', 'Pull-through en polea', 'Pull-through', { punto: 'cadera', ancla: 'tobillos', sentido: 'lejos_ancla', mvt: 0.30,
    hint: 'Graba de lado. Peso = lo que marca la pila.' }, 'cable pull through'),
  E('patada_gluteo_polea', 'Glúteo y femoral', 'polea', '🍑', 'Patada de glúteo en polea', 'Patada glúteo polea', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.40, unilateral: true, aprox: true,
    hint: UNI_P + ' Peso = lo que marca la pila.' }, 'cable glute kickback'),
  E('patada_gluteo_maquina', 'Glúteo y femoral', 'maquina', '🍑', 'Patada de glúteo en máquina', 'Patada glúteo máq.', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.40, unilateral: true, aprox: true, hint: UNI_P }, 'glute kickback machine'),
  E('hiperextension', 'Glúteo y femoral', 'corporal', '🔁', 'Hiperextensión (banco 45°)', 'Hiperextensión', { punto: 'hombros', ancla: 'cadera', sentido: 'arriba', mvt: 0.30, fraccion: 0.55,
    hint: 'Graba de lado. Peso = disco o mancuerna que sostienes (0 si no usas).' }, 'back extension hyperextension'),
  E('swing_kb', 'Glúteo y femoral', 'kettlebell', '🔔', 'Swing con kettlebell', 'Swing KB', { ...MANOS('arriba', 'tobillos'), mvt: 0.60, aprox: true }, 'kettlebell swing'),

  // ---------------------------------------------------------------- PECHO
  E('press_banca', 'Pecho', 'barra', '🛏️', 'Press de banca', 'Press banca', { ...MANOS('arriba', 'hombros'), mvt: 0.17, ecuacion: 'banca' }, 'bench press barbell flat'),
  E('press_banca_pausa', 'Pecho', 'barra', '⏸️', 'Press de banca con pausa', 'Banca con pausa', { ...MANOS('arriba', 'hombros'), mvt: 0.17, ecuacion: 'banca' }, 'paused bench press'),
  E('press_agarre_cerrado', 'Pecho', 'barra', '🤏', 'Press de banca agarre cerrado', 'Banca cerrado', { ...MANOS('arriba', 'hombros'), mvt: 0.17 }, 'close grip bench press'),
  E('press_inclinado', 'Pecho', 'barra', '📐', 'Press inclinado', 'Press inclinado', { ...MANOS('arriba', 'hombros'), mvt: 0.17,
    hint: BARRA + ' Con mancuernas: la suma de ambas y Barra en 0.' }, 'incline bench press barbell'),
  E('press_declinado', 'Pecho', 'barra', '📉', 'Press declinado', 'Press declinado', { ...MANOS('arriba', 'hombros'), mvt: 0.17 }, 'decline bench press'),
  E('press_mancuernas', 'Pecho', 'mancuernas', '🛏️', 'Press con mancuernas', 'Press mancuernas', { ...MANOS('arriba', 'hombros'), mvt: 0.20 }, 'dumbbell bench press'),
  E('press_mancuerna_unilateral', 'Pecho', 'mancuerna', '🏋️', 'Press con mancuerna a un brazo', 'Press 1 brazo', { ...MANOS('arriba', 'hombros'), mvt: 0.20, unilateral: true, hint: UNI_B }, 'single arm dumbbell bench press'),
  E('press_inclinado_mancuernas', 'Pecho', 'mancuernas', '📐', 'Press inclinado con mancuernas', 'Inclinado mancuernas', { ...MANOS('arriba', 'hombros'), mvt: 0.20 }, 'incline dumbbell press'),
  E('smith_banca', 'Pecho', 'smith', '🏗️', 'Press de banca en Smith', 'Smith banca', { ...MANOS('arriba', 'hombros'), mvt: 0.17 }, 'smith machine bench press'),
  E('smith_inclinado', 'Pecho', 'smith', '🏗️', 'Press inclinado en Smith', 'Smith inclinado', { ...MANOS('arriba', 'hombros'), mvt: 0.17 }, 'smith incline press'),
  E('press_pecho_maquina', 'Pecho', 'maquina', '🪑', 'Press de pecho en máquina', 'Press pecho máq.', { ...MANOS('lejos_ancla', 'hombros'), mvt: 0.25,
    hint: 'Graba de lado. Peso = lo que marca la pila (o discos cargados). Fuerza y potencia aproximadas.' }, 'chest press machine'),
  E('press_pecho_unilateral', 'Pecho', 'palanca', '🪑', 'Press de pecho iso-lateral (un brazo)', 'Press pecho 1 brazo', { ...MANOS('lejos_ancla', 'hombros'), mvt: 0.25, unilateral: true, hint: 'Graba de lado. ' + UNI_B }, 'iso-lateral chest press single arm'),
  E('aperturas_mancuernas', 'Pecho', 'mancuernas', '🦋', 'Aperturas con mancuernas', 'Aperturas', { ...MANOS('arriba', 'hombros'), mvt: 0.30, aprox: true,
    hint: 'Peso = suma de las dos mancuernas. Movimiento en arco: fuerza y potencia aproximadas.' }, 'dumbbell fly flyes'),
  E('pec_deck', 'Pecho', 'maquina', '🦋', 'Pec deck (contractor)', 'Pec deck', { ...MANOS('lejos_ancla', 'hombros'), mvt: 0.30,
    hint: 'Graba de lado. Peso = lo que marca la pila. Fuerza y potencia aproximadas.' }, 'pec deck butterfly machine fly'),
  E('cruce_poleas', 'Pecho', 'polea', '✖️', 'Cruce de poleas', 'Cruce poleas', { ...MANOS('abajo', 'hombros'), mvt: 0.30, aprox: true,
    hint: 'Peso = suma de las dos pilas. Graba de lado o de frente.' }, 'cable crossover cable fly'),
  E('pullover', 'Pecho', 'mancuerna', '🌙', 'Pullover con mancuerna', 'Pullover', { ...MANOS('arriba', 'hombros'), mvt: 0.30, aprox: true }, 'dumbbell pullover'),
  E('fondos', 'Pecho', 'corporal', '🤸', 'Fondos en paralelas', 'Fondos', { punto: 'hombros', ancla: 'ninguna', sentido: 'arriba', mvt: 0.25, fraccion: 0.95,
    hint: 'Usa trípode o apoya el teléfono (cámara fija). Peso = lastre (0 si no usas).' }, 'dips chest dip parallel bars'),
  E('flexiones', 'Pecho', 'corporal', '🙇', 'Flexiones de pecho', 'Flexiones', { ...SENT, mvt: 0.25, fraccion: 0.64,
    hint: 'Graba de lado. Peso = lastre en la espalda (0 si no usas).' }, 'push up push-up'),
  E('flexiones_inclinadas', 'Pecho', 'corporal', '🙇', 'Flexiones inclinadas (manos elevadas)', 'Flexión inclinada', { ...SENT, mvt: 0.25, fraccion: 0.45 }, 'incline push up'),
  E('flexiones_declinadas', 'Pecho', 'corporal', '🙇', 'Flexiones declinadas (pies elevados)', 'Flexión declinada', { ...SENT, mvt: 0.25, fraccion: 0.72 }, 'decline push up'),

  // ---------------------------------------------------------------- ESPALDA
  E('dominadas', 'Espalda', 'corporal', '🧗', 'Dominadas', 'Dominadas', { punto: 'hombros', ancla: 'manos', sentido: 'arriba', mvt: 0.23, fraccion: 0.95,
    hint: 'Usa trípode o apoya el teléfono (cámara fija). Peso = lastre (0 si no usas).' }, 'pull up pullup'),
  E('chin_up', 'Espalda', 'corporal', '🧗', 'Dominadas supinas (chin-up)', 'Chin-up', { punto: 'hombros', ancla: 'manos', sentido: 'arriba', mvt: 0.23, fraccion: 0.95,
    hint: 'Usa trípode o apoya el teléfono (cámara fija). Peso = lastre (0 si no usas).' }, 'chin up chinup'),
  E('dominadas_asistidas', 'Espalda', 'corporal', '🧗', 'Dominadas asistidas (máquina)', 'Dom. asistidas', { punto: 'hombros', ancla: 'manos', sentido: 'arriba', mvt: 0.23, fraccion: 0.95, asistido: true,
    hint: 'Cámara fija. Peso = la ASISTENCIA que marca la máquina (se resta de tu peso corporal).' }, 'assisted pull up machine'),
  E('jalon', 'Espalda', 'polea', '⬇️', 'Jalón al pecho', 'Jalón', { ...MANOS('abajo', 'cadera'), mvt: 0.40, hint: 'Peso = lo que marca la pila.' }, 'lat pulldown'),
  E('jalon_cerrado', 'Espalda', 'polea', '⬇️', 'Jalón agarre cerrado / neutro', 'Jalón cerrado', { ...MANOS('abajo', 'cadera'), mvt: 0.40 }, 'close grip lat pulldown v bar'),
  E('jalon_unilateral', 'Espalda', 'polea', '⬇️', 'Jalón a una mano', 'Jalón 1 mano', { ...MANOS('abajo', 'cadera'), mvt: 0.40, unilateral: true }, 'single arm lat pulldown'),
  E('jalon_unilateral_maquina', 'Espalda', 'palanca', '⬇️', 'Jalón iso-lateral (un brazo)', 'Jalón iso-lateral', { ...MANOS('abajo', 'cadera'), mvt: 0.40, unilateral: true, hint: UNI_B }, 'iso-lateral pulldown single arm machine'),
  E('jalon_brazos_rectos', 'Espalda', 'polea', '⬇️', 'Jalón con brazos rectos (pullover polea)', 'Brazos rectos', { ...MANOS('abajo', 'cadera'), mvt: 0.40, aprox: true }, 'straight arm pulldown cable pullover'),
  E('remo_barra', 'Espalda', 'barra', '↗️', 'Remo con barra', 'Remo barra', { ...MANOS('arriba', 'tobillos'), mvt: 0.45 }, 'barbell row bent over row'),
  E('remo_pendlay', 'Espalda', 'barra', '↗️', 'Remo Pendlay', 'Remo Pendlay', { ...MANOS('arriba', 'tobillos'), mvt: 0.45 }, 'pendlay row'),
  E('remo_t', 'Espalda', 'barra', '🅃', 'Remo en T', 'Remo en T', { ...MANOS('arriba', 'tobillos'), mvt: 0.45, carro: 0, aprox: true,
    hint: 'Peso = discos cargados. La barra apoyada en un extremo hace la carga aproximada.' }, 't bar row landmine row'),
  E('remo_mancuerna', 'Espalda', 'mancuerna', '↗️', 'Remo con mancuerna (un brazo)', 'Remo mancuerna', { ...MANOS('arriba', 'cadera'), mvt: 0.45, unilateral: true,
    hint: 'Peso = la mancuerna. Analiza cada brazo en un video aparte.' }, 'one arm dumbbell row'),
  E('remo_mancuernas_pecho', 'Espalda', 'mancuernas', '↗️', 'Remo con pecho apoyado', 'Remo pecho apoyado', { ...MANOS('arriba', 'cadera'), mvt: 0.45 }, 'chest supported row incline dumbbell row'),
  E('remo_riel', 'Espalda', 'riel', '🚣', 'Remo en máquina de riel', 'Remo en riel', { ...MANOS('arriba', 'cadera'), mvt: 0.40 }, 'machine row lever row'),
  E('remo_maquina', 'Espalda', 'maquina', '🚣', 'Remo sentado en máquina', 'Remo máquina', { ...MANOS('hacia_ancla', 'cadera'), mvt: 0.40,
    hint: 'Graba de lado. Peso = lo que marca la pila (o discos). Fuerza y potencia aproximadas.' }, 'seated machine row'),
  E('remo_unilateral_maquina', 'Espalda', 'palanca', '🚣', 'Remo iso-lateral (un brazo)', 'Remo iso-lateral', { ...MANOS('hacia_ancla', 'cadera'), mvt: 0.40, unilateral: true, hint: 'Graba de lado. ' + UNI_B }, 'iso-lateral row single arm machine row'),
  E('remo_polea', 'Espalda', 'polea', '↔️', 'Remo sentado en polea', 'Remo polea', { ...MANOS('hacia_ancla', 'cadera'), mvt: 0.40,
    hint: 'Peso = lo que marca la pila. Graba de lado.' }, 'seated cable row'),
  E('remo_polea_unilateral', 'Espalda', 'polea', '↔️', 'Remo en polea a una mano', 'Remo polea 1 mano', { ...MANOS('hacia_ancla', 'cadera'), mvt: 0.40, unilateral: true,
    hint: 'Peso = lo que marca la pila. Graba de lado.' }, 'single arm cable row'),
  E('remo_invertido', 'Espalda', 'corporal', '🔄', 'Remo invertido', 'Remo invertido', { ...SENT, mvt: 0.35, fraccion: 0.60,
    hint: 'Graba de lado. Peso = lastre (0 si no usas).' }, 'inverted row australian pull up'),
  E('encogimientos', 'Espalda', 'barra', '🤷', 'Encogimientos (trapecio)', 'Encogimientos', { punto: 'hombros', ancla: 'cadera', sentido: 'arriba', mvt: 0.20,
    hint: BARRA + ' Con mancuernas: suma de ambas y Barra en 0. Recorrido corto: usa precisión Máxima.' }, 'shrug barbell dumbbell'),
  E('face_pull', 'Espalda', 'polea', '🎯', 'Face pull', 'Face pull', { ...MANOS('hacia_ancla', 'cadera'), mvt: 0.40,
    hint: 'Peso = lo que marca la pila. Graba de lado.' }, 'face pull rope'),

  // ---------------------------------------------------------------- HOMBROS
  E('press_militar', 'Hombros', 'barra', '🙌', 'Press militar', 'Press militar', { ...MANOS('arriba', 'cadera'), mvt: 0.19,
    hint: BARRA + ' Con mancuernas: la suma de ambas y Barra en 0.' }, 'overhead press ohp military press'),
  E('press_hombro_mancuernas', 'Hombros', 'mancuernas', '🙌', 'Press de hombro con mancuernas', 'Press hombro manc.', { ...MANOS('arriba', 'cadera'), mvt: 0.20 }, 'dumbbell shoulder press seated'),
  E('press_hombro_unilateral', 'Hombros', 'mancuerna', '🙌', 'Press de hombro a un brazo', 'Press hombro 1 brazo', { ...MANOS('arriba', 'cadera'), mvt: 0.20, unilateral: true, hint: UNI_B }, 'single arm dumbbell shoulder press'),
  E('press_arnold', 'Hombros', 'mancuernas', '🙌', 'Press Arnold', 'Press Arnold', { ...MANOS('arriba', 'cadera'), mvt: 0.20 }, 'arnold press'),
  E('push_press', 'Hombros', 'barra', '🚀', 'Push press', 'Push press', { ...MANOS('arriba', 'tobillos'), mvt: 0.30 }, 'push press'),
  E('smith_militar', 'Hombros', 'smith', '🏗️', 'Press militar en Smith', 'Smith militar', { ...MANOS('arriba', 'cadera'), mvt: 0.19 }, 'smith overhead press'),
  E('press_hombro_maquina', 'Hombros', 'maquina', '🪑', 'Press de hombro en máquina', 'Press hombro máq.', { ...MANOS('arriba', 'cadera'), mvt: 0.22 }, 'shoulder press machine'),
  E('landmine_press', 'Hombros', 'barra', '📍', 'Press landmine', 'Landmine', { ...MANOS('arriba', 'cadera'), mvt: 0.25, carro: 0, aprox: true,
    hint: 'Peso = discos cargados. La barra apoyada en un extremo hace la carga aproximada.' }, 'landmine press'),
  E('elevaciones_laterales', 'Hombros', 'mancuernas', '🕊️', 'Elevaciones laterales', 'Laterales', { ...MANOS('arriba', 'hombros'), mvt: 0.35, aprox: true,
    hint: 'Peso = suma de las dos mancuernas. Graba de frente. Movimiento en arco: fuerza y potencia aproximadas.' }, 'lateral raise side raise'),
  E('lateral_unilateral', 'Hombros', 'mancuerna', '🕊️', 'Elevación lateral a un brazo', 'Lateral 1 brazo', { ...MANOS('arriba', 'hombros'), mvt: 0.35, aprox: true, unilateral: true,
    hint: 'Graba de frente. ' + UNI_B + ' Movimiento en arco: fuerza y potencia aproximadas.' }, 'single arm lateral raise'),
  E('laterales_polea', 'Hombros', 'polea', '🕊️', 'Elevación lateral en polea', 'Lateral polea', { ...MANOS('arriba', 'hombros'), mvt: 0.35, aprox: true, unilateral: true,
    hint: 'Peso = lo que marca la pila. Graba de frente.' }, 'cable lateral raise single arm cable lateral raise'),
  E('elevaciones_frontales', 'Hombros', 'mancuernas', '⬆️', 'Elevaciones frontales', 'Frontales', { ...MANOS('arriba', 'hombros'), mvt: 0.35, aprox: true,
    hint: 'Peso = suma de las mancuernas (o el disco). Graba de lado. Fuerza y potencia aproximadas.' }, 'front raise'),
  E('pajaro', 'Hombros', 'mancuernas', '🦅', 'Pájaro (deltoide posterior)', 'Pájaro', { ...MANOS('arriba', 'hombros'), mvt: 0.35, aprox: true }, 'rear delt fly reverse fly bent over'),
  E('reverse_pec_deck', 'Hombros', 'maquina', '🦅', 'Deltoide posterior en máquina', 'Posterior máq.', { ...MANOS('hacia_ancla', 'hombros'), mvt: 0.35 }, 'reverse pec deck rear delt machine'),
  E('remo_menton', 'Hombros', 'barra', '⤴️', 'Remo al mentón', 'Remo al mentón', { ...MANOS('arriba', 'cadera'), mvt: 0.35,
    hint: BARRA + ' Con barra Z pon 10 kg en Barra; con mancuernas, 0.' }, 'upright row'),

  // ---------------------------------------------------------------- BRAZOS
  E('curl', 'Brazos', 'barra', '💪', 'Curl de bíceps con barra', 'Curl barra', { ...MANOS('arriba', 'hombros'), mvt: 0.25,
    hint: 'Pon los discos y en «Peso de la barra» el de tu barra (20 kg olímpica, ~10 kg Z, 0 con mancuernas).' }, 'barbell curl biceps'),
  E('curl_z', 'Brazos', 'ez', '💪', 'Curl con barra Z', 'Curl barra Z', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'ez bar curl'),
  E('curl_mancuernas', 'Brazos', 'mancuernas', '💪', 'Curl con mancuernas (a la vez)', 'Curl mancuernas', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'dumbbell curl'),
  E('curl_alterno', 'Brazos', 'mancuerna', '💪', 'Curl alterno con mancuernas', 'Curl alterno', { ...MANOS('arriba', 'hombros'), mvt: 0.25, alterno: true,
    hint: 'Peso = UNA mancuerna. Cada brazo se cuenta por separado. Mejor con el teléfono fijo, de frente o de lado.' }, 'alternating dumbbell curl'),
  E('curl_martillo', 'Brazos', 'mancuernas', '🔨', 'Curl martillo', 'Curl martillo', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'hammer curl'),
  E('curl_martillo_alterno', 'Brazos', 'mancuerna', '🔨', 'Curl martillo alterno', 'Martillo alterno', { ...MANOS('arriba', 'hombros'), mvt: 0.25, alterno: true,
    hint: 'Peso = UNA mancuerna. Cada brazo se cuenta por separado.' }, 'alternating hammer curl'),
  E('curl_predicador', 'Brazos', 'ez', '🙏', 'Curl predicador (Scott)', 'Curl predicador', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'preacher curl scott'),
  E('curl_predicador_unilateral', 'Brazos', 'mancuerna', '💪', 'Curl predicador a un brazo', 'Predicador 1 brazo', { ...MANOS('arriba', 'hombros'), mvt: 0.25, unilateral: true, hint: UNI_B }, 'single arm preacher curl dumbbell'),
  E('curl_concentrado', 'Brazos', 'mancuerna', '🎯', 'Curl concentrado', 'Curl concentrado', { ...MANOS('arriba', 'hombros'), mvt: 0.25, unilateral: true,
    hint: 'Peso = la mancuerna. Analiza cada brazo en un video aparte.' }, 'concentration curl'),
  E('curl_inclinado', 'Brazos', 'mancuernas', '📐', 'Curl inclinado con mancuernas', 'Curl inclinado', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'incline dumbbell curl'),
  E('curl_polea', 'Brazos', 'polea', '💪', 'Curl en polea baja', 'Curl polea', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'cable curl bicep curl cable'),
  E('curl_polea_unilateral', 'Brazos', 'polea', '💪', 'Curl en polea a una mano', 'Curl polea 1 mano', { ...MANOS('arriba', 'hombros'), mvt: 0.25, unilateral: true, hint: UNI_B }, 'single arm cable curl'),
  E('curl_maquina', 'Brazos', 'maquina', '💪', 'Curl en máquina', 'Curl máquina', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'machine bicep curl'),
  E('triceps_polea', 'Brazos', 'polea', '🔻', 'Tríceps en polea (barra)', 'Tríceps polea', { ...MANOS('abajo', 'hombros'), mvt: 0.30 }, 'triceps pushdown cable'),
  E('triceps_cuerda', 'Brazos', 'polea', '🔻', 'Tríceps con cuerda', 'Tríceps cuerda', { ...MANOS('abajo', 'hombros'), mvt: 0.30 }, 'rope pushdown triceps'),
  E('triceps_polea_unilateral', 'Brazos', 'polea', '🔻', 'Tríceps en polea a una mano', 'Tríceps 1 mano', { ...MANOS('abajo', 'hombros'), mvt: 0.30, unilateral: true, hint: UNI_B }, 'single arm triceps pushdown cable'),
  E('triceps_tras_nuca_polea', 'Brazos', 'polea', '🔺', 'Extensión de tríceps sobre la cabeza (polea)', 'Tríceps sobre cabeza', { ...MANOS('lejos_ancla', 'hombros'), mvt: 0.30,
    hint: 'Graba de lado. Peso = lo que marca la pila.' }, 'overhead cable triceps extension'),
  E('triceps_tras_nuca', 'Brazos', 'mancuerna', '🔺', 'Extensión de tríceps tras nuca (mancuerna)', 'Tríceps tras nuca', { ...MANOS('arriba', 'hombros'), mvt: 0.30 }, 'overhead dumbbell triceps extension'),
  E('triceps_tras_nuca_unilateral', 'Brazos', 'mancuerna', '🔻', 'Extensión de tríceps tras nuca a un brazo', 'Tras nuca 1 brazo', { ...MANOS('arriba', 'hombros'), mvt: 0.30, unilateral: true, aprox: true, hint: UNI_B }, 'single arm overhead triceps extension'),
  E('press_frances', 'Brazos', 'ez', '🇫🇷', 'Press francés (rompecráneos)', 'Press francés', { ...MANOS('arriba', 'hombros'), mvt: 0.30, aprox: true }, 'skull crusher lying triceps extension'),
  E('patada_triceps', 'Brazos', 'mancuerna', '🦵', 'Patada de tríceps', 'Patada tríceps', { ...MANOS('lejos_ancla', 'hombros'), mvt: 0.30, unilateral: true, aprox: true,
    hint: 'Peso = la mancuerna. Graba de lado.' }, 'triceps kickback'),
  E('fondos_banco', 'Brazos', 'corporal', '🪑', 'Fondos en banco', 'Fondos banco', { punto: 'hombros', ancla: 'ninguna', sentido: 'arriba', mvt: 0.25, fraccion: 0.70,
    hint: 'Cámara fija. Peso = disco sobre las piernas (0 si no usas).' }, 'bench dips'),
  E('curl_muneca', 'Brazos', 'barra', '✊', 'Curl de muñeca', 'Curl muñeca', { ...MANOS('arriba', 'codos'), mvt: 0.15, carro: 20, aprox: true,
    hint: BARRA + ' Recorrido corto: usa precisión Máxima.' }, 'wrist curl forearm'),

  // ---------------------------------------------------------------- CORE
  E('crunch_polea', 'Core', 'polea', '🧎', 'Crunch en polea (de rodillas)', 'Crunch polea', { punto: 'hombros', ancla: 'rodillas', sentido: 'hacia_ancla', mvt: 0.30,
    hint: 'Graba de lado. Peso = lo que marca la pila.' }, 'cable crunch kneeling'),
  E('crunch_maquina', 'Core', 'maquina', '🧎', 'Crunch en máquina', 'Crunch máquina', { punto: 'hombros', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.30 }, 'ab crunch machine'),
  E('abdominales', 'Core', 'corporal', '🧘', 'Abdominales (sit-up)', 'Sit-up', { punto: 'hombros', ancla: 'cadera', sentido: 'arriba', mvt: 0.30, fraccion: 0.35,
    hint: 'Graba de lado. Peso = disco en el pecho (0 si no usas).' }, 'sit up situp crunch'),
  E('elevacion_piernas_colgado', 'Core', 'corporal', '🦵', 'Elevación de piernas colgado', 'Piernas colgado', { punto: 'pies', ancla: 'hombros', sentido: 'arriba', mvt: 0.30, fraccion: 0.35,
    hint: 'Graba de lado. Peso = lastre en los pies (0 si no usas).' }, 'hanging leg raise knee raise'),
  E('elevacion_piernas_suelo', 'Core', 'corporal', '🦵', 'Elevación de piernas en el suelo', 'Piernas suelo', { punto: 'pies', ancla: 'cadera', sentido: 'arriba', mvt: 0.30, fraccion: 0.30 }, 'lying leg raise'),
  E('rueda_abdominal', 'Core', 'corporal', '🛞', 'Rueda abdominal', 'Rueda abdominal', { punto: 'manos', ancla: 'rodillas', sentido: 'hacia_ancla', mvt: 0.30, fraccion: 0.50, aprox: true,
    hint: 'Graba de lado. Peso = lastre (0 si no usas).' }, 'ab wheel rollout'),
  E('lenadores', 'Core', 'polea', '🪓', 'Leñador en polea', 'Leñador', { ...MANOS('abajo', 'cadera'), mvt: 0.40, aprox: true }, 'cable woodchopper wood chop'),

  // ---------------------------------------------------------------- POTENCIA / OLIMPICOS
  E('cargada', 'Potencia', 'barra', '⚡', 'Cargada de potencia (power clean)', 'Power clean', { ...MANOS('arriba', 'tobillos'), mvt: 0.80, aprox: true }, 'power clean'),
  E('cargada_colgante', 'Potencia', 'barra', '⚡', 'Cargada colgante (hang clean)', 'Hang clean', { ...MANOS('arriba', 'tobillos'), mvt: 0.80, aprox: true }, 'hang clean'),
  E('arranque', 'Potencia', 'barra', '⚡', 'Arranque (snatch)', 'Arranque', { ...MANOS('arriba', 'tobillos'), mvt: 1.00, aprox: true }, 'snatch power snatch'),
  E('envion', 'Potencia', 'barra', '⚡', 'Envión (jerk)', 'Envión', { ...MANOS('arriba', 'tobillos'), mvt: 0.50, aprox: true }, 'jerk split jerk push jerk'),
  E('thruster', 'Potencia', 'barra', '🔥', 'Thruster', 'Thruster', { ...MANOS('arriba', 'tobillos'), mvt: 0.40,
    hint: BARRA + ' Con mancuernas: la suma de ambas y Barra en 0.' }, 'thruster'),
  E('sentadilla_salto', 'Potencia', 'corporal', '🦘', 'Sentadilla con salto', 'Sent. con salto', { punto: 'cadera', ancla: 'ninguna', sentido: 'arriba', mvt: 0.80, fraccion: 1,
    hint: 'Teléfono fijo (trípode), de lado, cuerpo completo. Peso = lastre (0 si no usas).' }, 'jump squat squat jump'),
  E('salto_cajon', 'Potencia', 'corporal', '📦', 'Salto al cajón', 'Salto cajón', { punto: 'cadera', ancla: 'ninguna', sentido: 'arriba', mvt: 0.80, fraccion: 1,
    hint: 'Teléfono fijo (trípode), de lado, cuerpo completo.' }, 'box jump'),
  E('lanzamiento_balon', 'Potencia', 'mancuerna', '🏐', 'Lanzamiento de balón medicinal', 'Balón medicinal', { ...MANOS('arriba', 'tobillos'), mvt: 1.00, aprox: true,
    hint: 'Peso = el balón. Graba de lado.' }, 'medicine ball throw slam'),
  // agregados para importar historiales de Hevy (nombres en español de la app)
  E('pantorrilla_maquina', 'Piernas', 'maquina', '🦶', 'Extensión de pantorrilla en máquina', 'Pantorrilla máquina', { punto: 'pies', ancla: 'rodillas', sentido: 'lejos_ancla', mvt: 0.20, aprox: true, hint: 'Graba de lado. Se sigue el pie.' }, 'calf extension machine calf press'),
  E('sentadilla_zercher', 'Piernas', 'barra', '🏋️', 'Sentadilla Zercher', 'Zercher', { ...SENT, mvt: 0.32 }, 'zercher squat'),
  E('zancada_curtsy', 'Piernas', 'mancuernas', '💃', 'Zancada cruzada (curtsy)', 'Curtsy', { ...SENT, mvt: 0.30 }, 'curtsy lunge'),
  E('abduccion_polea', 'Glúteo y femoral', 'polea', '↔️', 'Abducción de cadera de pie en polea', 'Abducción polea', { punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.30, unilateral: true, aprox: true }, 'standing hip abduction cable'),
  E('hiperextension_inversa', 'Glúteo y femoral', 'maquina', '🔄', 'Hiperextensión inversa', 'Hiper. inversa', { punto: 'pies', ancla: 'cadera', sentido: 'arriba', mvt: 0.30, aprox: true }, 'reverse hyperextension'),
  E('superman', 'Glúteo y femoral', 'corporal', '🦸', 'Superman', 'Superman', { punto: 'hombros', ancla: 'cadera', sentido: 'arriba', mvt: 0.30, fraccion: 0.3 }, 'superman back extension floor'),
  E('fondos_maquina', 'Brazos', 'maquina', '🪑', 'Fondos sentado en máquina', 'Fondos máquina', { ...MANOS('abajo', 'hombros'), mvt: 0.30, aprox: true }, 'seated dip machine triceps'),
  E('laterales_maquina', 'Hombros', 'maquina', '🕊️', 'Elevaciones laterales en máquina', 'Laterales máquina', { punto: 'codos', ancla: 'hombros', sentido: 'arriba', mvt: 0.35, aprox: true }, 'lateral raise machine'),
  E('pajaro_polea', 'Hombros', 'polea', '🦅', 'Pájaro en polea (deltoide posterior)', 'Pájaro polea', { ...MANOS('lejos_ancla', 'hombros'), mvt: 0.35, aprox: true }, 'rear delt fly cable reverse fly'),
  E('curl_invertido', 'Brazos', 'barra', '🔄', 'Curl invertido con barra', 'Curl invertido', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'reverse curl barbell'),
  E('curl_arana', 'Brazos', 'barra', '🕷️', 'Curl araña', 'Curl araña', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'spider curl'),
  E('curl_zottman', 'Brazos', 'mancuernas', '🔁', 'Curl Zottman', 'Curl Zottman', { ...MANOS('arriba', 'hombros'), mvt: 0.25 }, 'zottman curl'),
  E('curl_detras_espalda', 'Brazos', 'barra', '✊', 'Curl de muñeca detrás de la espalda', 'Curl muñeca atrás', { ...MANOS('arriba', 'codos'), mvt: 0.15, aprox: true }, 'behind the back wrist curl barbell'),
  E('extension_muneca', 'Brazos', 'barra', '✋', 'Extensión de muñeca', 'Ext. muñeca', { ...MANOS('arriba', 'codos'), mvt: 0.15, aprox: true }, 'wrist extension reverse wrist curl'),
  E('rodillo_antebrazo', 'Brazos', 'corporal', '🌀', 'Rodillo de antebrazos', 'Rodillo antebrazo', { ...MANOS('arriba', 'hombros'), mvt: 0.15, aprox: true, fraccion: 0.05 }, 'wrist roller forearm roller'),
  E('crunch_declinado', 'Core', 'corporal', '🧎', 'Abdominal en banco declinado', 'Abs declinado', { punto: 'hombros', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.30, fraccion: 0.35 }, 'decline crunch weighted'),
  E('flexion_lateral', 'Core', 'mancuerna', '↕️', 'Flexión lateral de tronco', 'Flexión lateral', { punto: 'manos', ancla: 'cadera', sentido: 'arriba', mvt: 0.25, aprox: true }, 'side bend dumbbell oblique'),
  E('muscle_up', 'Espalda', 'corporal', '💪', 'Muscle up', 'Muscle up', { punto: 'hombros', ancla: 'ninguna', sentido: 'arriba', mvt: 0.30, fraccion: 0.95 }, 'muscle up'),

  // ---------------------------------------------------------------- CARDIO (solo registro: tiempo y distancia, sin video)
  // medida: 'dist' (km + minutos) o 'tiempo' (solo minutos) · vel: como se muestra la velocidad
  // ('ritmo' = min/km, 'kmh' = km/h, '500' = min/500 m, '100' = min/100 m) · correr: cuenta para las marcas de Running
  ...[
    ['correr', '🏃', 'Correr (exterior)', 'dist', 'ritmo', 'running run outdoor jogging', true],
    ['cinta', '🏃', 'Correr en cinta', 'dist', 'ritmo', 'treadmill running treadmill run', true],
    ['intervalos_carrera', '⚡', 'Intervalos de carrera (sprints)', 'dist', 'ritmo', 'sprints interval running track', true],
    ['caminar', '🚶', 'Caminar', 'dist', 'ritmo', 'walking walk'],
    ['caminata_inclinada', '⛰️', 'Caminar en cinta inclinada', 'dist', 'ritmo', 'incline walk treadmill walking incline treadmill'],
    ['senderismo', '🥾', 'Senderismo', 'dist', 'ritmo', 'hiking hike trekking'],
    ['bicicleta', '🚴', 'Bicicleta (exterior)', 'dist', 'kmh', 'cycling bike ride outdoor cycling'],
    ['bicicleta_estatica', '🚲', 'Bicicleta estática', 'dist', 'kmh', 'stationary bike exercise bike recumbent bike'],
    ['spinning', '🚴', 'Spinning', 'dist', 'kmh', 'spinning indoor cycling spin class'],
    ['bicicleta_aire', '🌀', 'Bicicleta de aire (assault bike)', 'dist', 'kmh', 'assault bike air bike echo bike airdyne'],
    ['eliptica', '⭕', 'Elíptica', 'dist', 'kmh', 'elliptical trainer elliptical cross trainer'],
    ['remo_ergometro', '🚣', 'Remo ergómetro', 'dist', '500', 'rowing machine rower erg concept2 row'],
    ['ski_erg', '⛷️', 'Ski erg', 'dist', '500', 'ski erg skierg'],
    ['natacion', '🏊', 'Natación', 'dist', '100', 'swimming swim pool'],
    ['patinaje', '⛸️', 'Patinaje', 'dist', 'kmh', 'skating rollerblading inline skating ice skating'],
    ['kayak', '🛶', 'Kayak / remo en agua', 'dist', 'kmh', 'kayaking canoe paddling paddle board'],
    ['escaladora', '🪜', 'Escaladora (stair climber)', 'tiempo', '', 'stair climber stairmaster stair machine steps floors'],
    ['saltar_cuerda', '🪢', 'Saltar la cuerda', 'tiempo', '', 'jump rope skipping rope'],
    ['hiit', '🔥', 'HIIT', 'tiempo', '', 'hiit high intensity interval training circuit tabata'],
    ['cuerdas_batalla', '〰️', 'Cuerdas de batalla', 'tiempo', '', 'battle ropes'],
    ['burpees', '🤸', 'Burpees', 'tiempo', '', 'burpee burpees'],
    ['jumping_jacks', '⭐', 'Jumping jacks (saltos de tijera)', 'tiempo', '', 'jumping jacks star jumps'],
    ['escaladores', '🧗', 'Escaladores (mountain climbers)', 'tiempo', '', 'mountain climbers climbers'],
    ['boxeo', '🥊', 'Boxeo / saco', 'tiempo', '', 'boxing heavy bag kickboxing muay thai shadow boxing'],
    ['baile', '💃', 'Baile / zumba', 'tiempo', '', 'dancing dance zumba aerobics'],
    ['futbol', '⚽', 'Fútbol', 'tiempo', '', 'soccer football'],
    ['basquet', '🏀', 'Básquet', 'tiempo', '', 'basketball'],
    ['tenis', '🎾', 'Tenis / pádel', 'tiempo', '', 'tennis padel squash racquetball'],
    ['cardio_otro', '❤️', 'Otro cardio', 'tiempo', '', 'cardio other aerobic'],
  ].map(([id, icono, nombre, medida, vel, en, correr]) => E(id, 'Cardio', 'cardio', icono, nombre, nombre.length > 18 ? nombre.slice(0, 17) + '…' : nombre,
    { medida, vel, correr: !!correr }, en)),
];

// Nombres que usa Hevy en español (cuando no coinciden con los nuestros) -> ejercicio de la biblioteca
export const ALIAS_IMPORTAR = {
  // cardio (nombres de Hevy y Strong en espanol e ingles)
  'correr': 'correr', 'running': 'correr', 'carrera': 'correr', 'trotar': 'correr', 'cinta de correr': 'cinta', 'treadmill': 'cinta', 'caminadora': 'cinta',
  'entrenador eliptico': 'eliptica', 'eliptica': 'eliptica', 'elliptical trainer': 'eliptica', 'ciclismo': 'bicicleta', 'cycling': 'bicicleta',
  'bicicleta estatica': 'bicicleta_estatica', 'stationary bike': 'bicicleta_estatica', 'bicicleta de aire': 'bicicleta_aire', 'air bike': 'bicicleta_aire',
  'maquina de remo': 'remo_ergometro', 'rowing machine': 'remo_ergometro', 'remo (maquina)': 'remo_ergometro', 'escaladora': 'escaladora',
  'maquina de escaleras': 'escaladora', 'stair machine': 'escaladora', 'stair machine (floors)': 'escaladora', 'stair machine (steps)': 'escaladora',
  'caminar': 'caminar', 'walking': 'caminar', 'caminata': 'caminar', 'saltar la cuerda': 'saltar_cuerda', 'saltar cuerda': 'saltar_cuerda', 'jump rope': 'saltar_cuerda',
  'natacion': 'natacion', 'swimming': 'natacion', 'senderismo': 'senderismo', 'hiking': 'senderismo', 'spinning': 'spinning', 'ski erg': 'ski_erg',
  'boxeo': 'boxeo', 'boxing': 'boxeo', 'hiit': 'hiit', 'burpee': 'burpees', 'burpees': 'burpees', 'jumping jack': 'jumping_jacks', 'jumping jacks': 'jumping_jacks', 'saltos de tijera': 'jumping_jacks', 'mountain climber': 'escaladores', 'mountain climbers': 'escaladores', 'escaladores': 'escaladores', 'cuerdas de batalla': 'cuerdas_batalla', 'battle ropes': 'cuerdas_batalla',

  'extension de pantorrilla (maquina)': 'pantorrilla_maquina', 'elevacion de gemelos de pie (maquina)': 'pantorrilla_pie', 'elevacion de gemelos de pie': 'pantorrilla_pie',
  'elevacion de gemelos sentado': 'pantorrilla_sentado', 'curl de muneca palmas arriba': 'curl_muneca', 'sentadilla pendulo (maquina)': 'hack',
  'sentadilla hack (maquina)': 'hack', 'sentadilla hack': 'hack', 'flexion lateral': 'flexion_lateral', 'tiron a la cara': 'face_pull',
  'aduccion de caderas': 'aductores_maquina', 'aduccion de cadera (maquina)': 'aductores_maquina', 'abduccion de caderas': 'abductores_maquina',
  'abduccion de caderas de pie': 'abduccion_polea', 'elevacion laterales (cable)': 'laterales_polea', 'elevacion laterales (mancuerna)': 'elevaciones_laterales',
  'elevacion laterales (maquina)': 'laterales_maquina', 'vuelos laterales sentado (mancuerna)': 'elevaciones_laterales', 'elevacion frontal (mancuerna)': 'elevaciones_frontales',
  'curl de biceps detras de espalda (barra)': 'curl_detras_espalda', 'maquina para fondos sentado': 'fondos_maquina', 'vuelos posteriores (cable)': 'pajaro_polea',
  'vuelos posteriores (maquina)': 'reverse_pec_deck', 'abdominal corto en banco inclinado (con peso anadido)': 'crunch_declinado', 'abdominal corto en banco inclinado': 'crunch_declinado',
  'remo sentado con cable - agarre abierto': 'remo_polea', 'remo sentado con agarre en v (cable)': 'remo_polea', 'empuje de caderas (barra)': 'hip_thrust',
  'impulso de cadera (maquina)': 'hip_thrust_maquina', 'empuje de cadera (maquina)': 'hip_thrust_maquina', 'abdominal corto con cable': 'crunch_polea',
  'abdominal corto (maquina)': 'crunch_maquina', 'levantamiento de piernas en barra': 'elevacion_piernas_colgado', 'levantamiento de rodillas en barra': 'elevacion_piernas_colgado',
  'levantamiento de rodillas tumbado': 'elevacion_piernas_suelo', 'curl invertido (barra)': 'curl_invertido', 'fondo de triceps': 'fondos',
  'fondo de triceps (con peso anadido)': 'fondos', 'remo inclinado (barra)': 'remo_barra', 'remo en punta': 'remo_t', 'remo inclinado maquina agarre abierto': 'remo_maquina',
  'remo inclinado (mancuerna)': 'remo_mancuerna', 'patada de burro (maquina)': 'patada_gluteo_maquina', 'triceps pressdown': 'triceps_polea', 'cables cruzados': 'cruce_poleas',
  'aperturas de pecho sentado (cable)': 'cruce_poleas', 'aperturas inclinadas (mancuerna)': 'aperturas_mancuernas', 'extension de muneca sentado (barra)': 'extension_muneca',
  'sentadilla delantera': 'sentadilla_frontal', 'curl arana (barra)': 'curl_arana', 'dominada (con peso anadido)': 'dominadas', 'rodillo de antebrazos': 'rodillo_antebrazo',
  'reverse hack squats good morning': 'buenos_dias', 'buen dia (barra)': 'buenos_dias', 'cable twist (down to up)': 'lenadores', 'cable twist (up to down)': 'lenadores',
  'peso muerto parcial desde el rack': 'rack_pull', 'zancada curtsy (mancuerna)': 'zancada_curtsy', 'curl zottman (mancuerna)': 'curl_zottman',
  'encogimiento de hombros (barra)': 'encogimientos', 'encogimiento de hombros (cable)': 'encogimientos', 'jalon de rodillas (banda)': 'elevacion_piernas_suelo',
  'hiperextension inversa': 'hiperextension_inversa', 'muscle up': 'muscle_up', 'abdominales toque al talon': 'abdominales', 'sit up (con peso anadido)': 'abdominales',
  'superman': 'superman', 'sentadilla zercher': 'sentadilla_zercher',
  'extension de pierna': 'extension_cuadriceps', 'extensiones a una pierna': 'extension_unilateral', 'curl de piernas acostado (maquina)': 'curl_femoral_tumbado',
  'curl de pierna sentado': 'curl_femoral_sentado', 'peso muerto (barra)': 'peso_muerto', 'aperturas (maquina)': 'pec_deck',
  'levantamiento de piernas tumbado': 'elevacion_piernas_suelo', 'curl de biceps (mancuerna)': 'curl_mancuernas', 'press de piernas': 'prensa_45',
  'pies a barra': 'elevacion_piernas_colgado', 'press de hombros sentado (barra)': 'press_militar', 'press de hombros (barra)': 'press_militar',
  'press de banca en declive (maquina)': 'press_declinado', 'press de banca en declive (barra)': 'press_declinado', 'press de banca inclinado (barra)': 'press_inclinado',
  'press de banca (mancuerna)': 'press_mancuernas', 'elevacion lateral (mancuerna)': 'elevaciones_laterales', 'sentadilla (maquina)': 'hack',
  'curl sobre cabeza (cable)': 'curl_polea', 'jalon de remo a un brazo': 'remo_polea_unilateral', 'press de hombros (maquina smith)': 'smith_militar',
};

// Detector de reps por grupo. 'cuerpo': ejercicios de pie con los pies fijos en los que sube y baja todo el cuerpo
// (o la barra con el cuerpo). Se cuentan los fondos (sentadillas: cada rep pasa por abajo) o los topes (peso muerto:
// cada rep llega arriba, aunque empiece desde el piso).
const DETECTOR = {
  fondos: ['sentadilla', 'sentadilla_frontal', 'sentadilla_box', 'sentadilla_pausa', 'sentadilla_goblet', 'sentadilla_mancuernas',
    'sentadilla_sumo', 'smith_sentadilla', 'hack', 'belt_squat', 'sentadilla_corporal', 'buenos_dias'],
  topes: ['peso_muerto', 'peso_muerto_sumo', 'peso_muerto_rumano', 'rumano_mancuernas', 'peso_muerto_rigido', 'peso_muerto_hex',
    'peso_muerto_deficit'],
};
for (const [cuenta, ids] of Object.entries(DETECTOR)) for (const e of EJERCICIOS) if (ids.includes(e.id)) { e.detector = 'cuerpo'; e.cuenta = cuenta; }

export const POR_ID = Object.fromEntries(EJERCICIOS.map((e) => [e.id, e]));
export const GRUPOS = [...new Set(EJERCICIOS.map((e) => e.grupo))];

// ---------------------------------------------------------------- ejercicios creados por el usuario (guardados en el telefono)
const CLAVE = 'af_ej_propios';
export const GRUPO_PROPIOS = 'Mis ejercicios';
export const GRUPOS_MUSCULO = ['Piernas', 'Glúteo y femoral', 'Pecho', 'Espalda', 'Hombros', 'Brazos', 'Core', 'Potencia'];

// Traduce las respuestas sencillas del formulario a la configuracion tecnica de un ejercicio
export function construirPropio(r) {
  const eq = EQ[r.equipo] || EQ.mancuernas;
  const punto = r.punto || 'manos';
  let ancla = r.ancla && r.ancla !== 'auto' ? r.ancla : null;
  if (!ancla) {
    if (punto === 'manos') ancla = 'cadera';
    else if (punto === 'pies') ancla = 'cadera';
    else ancla = eq.perfil === 'corporal' && r.sentido === 'arriba' && r.colgado ? 'ninguna' : 'tobillos';
  }
  const empuje = r.sentido === 'arriba' || r.sentido === 'lejos_ancla';
  const mvt = eq.perfil === 'corporal' ? 0.25 : punto === 'manos' ? (empuje ? 0.20 : 0.40) : 0.30;
  const id = r.id || 'propio_' + Date.now().toString(36);
  return {
    ...eq, id, grupo: GRUPO_PROPIOS, musculo: r.musculo || '', icono: r.icono || '⭐',
    nombre: r.nombre, corto: r.nombre.length > 18 ? r.nombre.slice(0, 17) + '…' : r.nombre,
    punto, ancla, sentido: r.sentido || 'arriba', mvt, fraccion: eq.perfil === 'corporal' ? (r.fraccion || 0.7) : undefined,
    alterno: r.brazos === 'alterno' || undefined, unilateral: r.brazos === 'uno' || undefined,
    hint: (eq.hint || '') + ' Ejercicio creado por ti.', en: '', propio: true, respuestas: { ...r, id },
  };
}
function leerPropios() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) { return []; }
}
function guardarPropios(lista) {
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) { /* sin almacenamiento */ }
}
function reindexar() {
  for (const k of Object.keys(POR_ID)) delete POR_ID[k];
  for (const e of EJERCICIOS) POR_ID[e.id] = e;
  GRUPOS.length = 0;
  GRUPOS.push(...new Set(EJERCICIOS.map((e) => e.grupo)));
}
export function cargarPropios() {
  for (let i = EJERCICIOS.length - 1; i >= 0; i--) if (EJERCICIOS[i].propio) EJERCICIOS.splice(i, 1);
  for (const r of leerPropios()) { try { EJERCICIOS.push(construirPropio(r)); } catch (e) { /* respuesta danada */ } }
  reindexar();
}
export function agregarPropio(respuestas) {
  const e = construirPropio(respuestas);
  const lista = leerPropios().filter((r) => r.id !== e.id);
  lista.push(e.respuestas); guardarPropios(lista); cargarPropios();
  return POR_ID[e.id];
}
export function quitarPropio(id) {
  guardarPropios(leerPropios().filter((r) => r.id !== id)); cargarPropios();
}
cargarPropios();

// Relaciones carga-velocidad de referencia (%1RM a partir de la velocidad media de la fase concentrica)
export const ECUACIONES = {
  banca: { ref: 'González-Badillo y Sánchez-Medina (2010), press de banca',
    f: (v) => 8.4326 * v * v - 73.501 * v + 112.33 },
  sentadilla: { ref: 'Sánchez-Medina y col. (2017), sentadilla completa',
    f: (v) => -5.961 * v * v - 50.71 * v + 117 },
};
