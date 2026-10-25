// Biblioteca de ejercicios.
// perfil: riel (carga sobre un riel inclinado alfa), libre (vertical), polea (pila de placas), corporal.
// punto: lo que se sigue · ancla: parte del cuerpo que no se mueve (cancela el movimiento de la camara)
// sentido: hacia donde va la fase concentrica (cuando se vence la carga).
// mvt: velocidad media minima (m/s) con la que suele salir la ultima rep posible (aprox., literatura VBT).
// ecuacion: relacion carga-velocidad validada (solo donde existe una de referencia).
// fraccion: parte del peso corporal que se mueve (ejercicios de peso corporal).

export const EJERCICIOS = [
  // ---- maquinas guiadas
  { id: 'remo_riel', grupo: 'Máquinas guiadas', icono: '🚣', nombre: 'Remo en máquina de riel', corto: 'Remo en riel',
    perfil: 'riel', alfa: 45, punto: 'manos', ancla: 'cadera', sentido: 'arriba', mvt: 0.40, carro: 0,
    hint: 'Mide la inclinación del riel con el inclinómetro del celular para más exactitud.' },
  { id: 'prensa_45', grupo: 'Máquinas guiadas', icono: '🦵', nombre: 'Prensa 45°', corto: 'Prensa 45°',
    perfil: 'riel', alfa: 45, punto: 'pies', ancla: 'cadera', sentido: 'lejos_ancla', mvt: 0.25, carro: 0,
    hint: 'Graba de lado. El carro de la prensa también pesa (30–50 kg): ponlo en avanzados si lo sabes.' },
  { id: 'hack', grupo: 'Máquinas guiadas', icono: '🏋️', nombre: 'Hack squat / péndulo', corto: 'Hack squat',
    perfil: 'riel', alfa: 45, punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.30, carro: 0,
    hint: 'Graba de lado. Ajusta la inclinación del riel de tu máquina.' },
  { id: 'smith_sentadilla', grupo: 'Máquinas guiadas', icono: '🏗️', nombre: 'Sentadilla en Smith', corto: 'Smith sentadilla',
    perfil: 'riel', alfa: 90, punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.32, carro: 15,
    hint: 'La barra Smith suele pesar 10–20 kg (contrapesada): ajústalo en avanzados.' },
  { id: 'smith_banca', grupo: 'Máquinas guiadas', icono: '🏗️', nombre: 'Press de banca en Smith', corto: 'Smith banca',
    perfil: 'riel', alfa: 90, punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.17, carro: 15,
    hint: 'La barra Smith suele pesar 10–20 kg: ajústalo en avanzados.' },

  // ---- peso libre
  { id: 'sentadilla', grupo: 'Peso libre', icono: '🏋️', nombre: 'Sentadilla con barra', corto: 'Sentadilla',
    perfil: 'libre', punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.32, carro: 20, ecuacion: 'sentadilla',
    hint: 'Peso = discos. La barra olímpica (20 kg) ya está sumada.' },
  { id: 'sentadilla_frontal', grupo: 'Peso libre', icono: '🏋️', nombre: 'Sentadilla frontal', corto: 'Sent. frontal',
    perfil: 'libre', punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.32, carro: 20,
    hint: 'Peso = discos. La barra (20 kg) ya está sumada.' },
  { id: 'peso_muerto', grupo: 'Peso libre', icono: '⬆️', nombre: 'Peso muerto', corto: 'Peso muerto',
    perfil: 'libre', punto: 'manos', ancla: 'tobillos', sentido: 'arriba', mvt: 0.15, carro: 20,
    hint: 'Peso = discos. La barra (20 kg) ya está sumada. Con mancuernas: suma de ambas y carro 0.' },
  { id: 'peso_muerto_rumano', grupo: 'Peso libre', icono: '⬆️', nombre: 'Peso muerto rumano', corto: 'P. muerto rumano',
    perfil: 'libre', punto: 'manos', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25, carro: 20,
    hint: 'Peso = discos. La barra (20 kg) ya está sumada.' },
  { id: 'hip_thrust', grupo: 'Peso libre', icono: '🍑', nombre: 'Hip thrust', corto: 'Hip thrust',
    perfil: 'libre', punto: 'cadera', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25, carro: 20,
    hint: 'Graba de lado. Peso = discos; la barra (20 kg) ya está sumada.' },
  { id: 'zancada', grupo: 'Peso libre', icono: '🚶', nombre: 'Zancada / búlgara', corto: 'Zancada',
    perfil: 'libre', punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.30, carro: 0,
    hint: 'Pon el peso total de las mancuernas o de la barra con discos.' },
  { id: 'press_banca', grupo: 'Peso libre', icono: '🛏️', nombre: 'Press de banca', corto: 'Press banca',
    perfil: 'libre', punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.17, carro: 20, ecuacion: 'banca',
    hint: 'Peso = discos. La barra (20 kg) ya está sumada.' },
  { id: 'press_inclinado', grupo: 'Peso libre', icono: '📐', nombre: 'Press inclinado', corto: 'Press inclinado',
    perfil: 'libre', punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.17, carro: 20,
    hint: 'Peso = discos. La barra (20 kg) ya está sumada. Con mancuernas: suma de ambas y carro 0.' },
  { id: 'press_mancuernas', grupo: 'Peso libre', icono: '🛏️', nombre: 'Press con mancuernas', corto: 'Press mancuernas',
    perfil: 'libre', punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.20, carro: 0,
    hint: 'Peso = suma de las dos mancuernas.' },
  { id: 'press_militar', grupo: 'Peso libre', icono: '🙌', nombre: 'Press militar', corto: 'Press militar',
    perfil: 'libre', punto: 'manos', ancla: 'cadera', sentido: 'arriba', mvt: 0.19, carro: 20,
    hint: 'Peso = discos. La barra (20 kg) ya está sumada. Con mancuernas: suma de ambas y carro 0.' },
  { id: 'remo_barra', grupo: 'Peso libre', icono: '↗️', nombre: 'Remo con barra', corto: 'Remo barra',
    perfil: 'libre', punto: 'manos', ancla: 'tobillos', sentido: 'arriba', mvt: 0.45, carro: 20,
    hint: 'Peso = discos. La barra (20 kg) ya está sumada.' },
  { id: 'remo_mancuerna', grupo: 'Peso libre', icono: '↗️', nombre: 'Remo con mancuerna', corto: 'Remo mancuerna',
    perfil: 'libre', punto: 'manos', ancla: 'cadera', sentido: 'arriba', mvt: 0.45, carro: 0,
    hint: 'Peso = la mancuerna.' },
  { id: 'curl_alterno', grupo: 'Peso libre', icono: '💪', nombre: 'Curl alterno con mancuernas', corto: 'Curl alterno',
    perfil: 'libre', punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.25, carro: 0, alterno: true,
    hint: 'Peso = UNA mancuerna. Cada brazo se cuenta por separado. Mejor con el teléfono fijo, de frente o de lado.' },
  { id: 'curl', grupo: 'Peso libre', icono: '💪', nombre: 'Curl de bíceps', corto: 'Curl',
    perfil: 'libre', punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.25, carro: 0,
    hint: 'Peso total (barra + discos, o suma de mancuernas).' },

  // ---- poleas
  { id: 'jalon', grupo: 'Poleas', icono: '⬇️', nombre: 'Jalón al pecho', corto: 'Jalón',
    perfil: 'polea', punto: 'manos', ancla: 'cadera', sentido: 'abajo', mvt: 0.40,
    hint: 'Peso = lo que marca la pila de placas.' },
  { id: 'remo_polea', grupo: 'Poleas', icono: '↔️', nombre: 'Remo sentado en polea', corto: 'Remo polea',
    perfil: 'polea', punto: 'manos', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40,
    hint: 'Peso = lo que marca la pila. Graba de lado.' },
  { id: 'triceps_polea', grupo: 'Poleas', icono: '🔻', nombre: 'Tríceps en polea', corto: 'Tríceps polea',
    perfil: 'polea', punto: 'manos', ancla: 'hombros', sentido: 'abajo', mvt: 0.30,
    hint: 'Peso = lo que marca la pila.' },
  { id: 'curl_polea', grupo: 'Poleas', icono: '💪', nombre: 'Curl en polea baja', corto: 'Curl polea',
    perfil: 'polea', punto: 'manos', ancla: 'hombros', sentido: 'arriba', mvt: 0.25,
    hint: 'Peso = lo que marca la pila.' },
  { id: 'face_pull', grupo: 'Poleas', icono: '🎯', nombre: 'Face pull', corto: 'Face pull',
    perfil: 'polea', punto: 'manos', ancla: 'cadera', sentido: 'hacia_ancla', mvt: 0.40,
    hint: 'Peso = lo que marca la pila. Graba de lado.' },

  // ---- peso corporal
  { id: 'dominadas', grupo: 'Peso corporal', icono: '🧗', nombre: 'Dominadas', corto: 'Dominadas',
    perfil: 'corporal', punto: 'hombros', ancla: 'ninguna', sentido: 'arriba', mvt: 0.23, fraccion: 0.95,
    hint: 'Usa trípode o apoya el teléfono (cámara fija). Peso = lastre (0 si no usas).' },
  { id: 'fondos', grupo: 'Peso corporal', icono: '🤸', nombre: 'Fondos en paralelas', corto: 'Fondos',
    perfil: 'corporal', punto: 'hombros', ancla: 'ninguna', sentido: 'arriba', mvt: 0.25, fraccion: 0.95,
    hint: 'Usa trípode o apoya el teléfono (cámara fija). Peso = lastre (0 si no usas).' },
  { id: 'flexiones', grupo: 'Peso corporal', icono: '🙇', nombre: 'Flexiones de pecho', corto: 'Flexiones',
    perfil: 'corporal', punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.25, fraccion: 0.64,
    hint: 'Graba de lado. Peso = lastre en la espalda (0 si no usas).' },
  { id: 'remo_invertido', grupo: 'Peso corporal', icono: '🔄', nombre: 'Remo invertido', corto: 'Remo invertido',
    perfil: 'corporal', punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.35, fraccion: 0.60,
    hint: 'Graba de lado. Peso = lastre (0 si no usas).' },
  { id: 'sentadilla_corporal', grupo: 'Peso corporal', icono: '🧍', nombre: 'Sentadilla sin peso', corto: 'Sent. corporal',
    perfil: 'corporal', punto: 'hombros', ancla: 'tobillos', sentido: 'arriba', mvt: 0.32, fraccion: 0.88,
    hint: 'Graba de lado. Peso = lastre o chaleco (0 si no usas).' },
];

export const POR_ID = Object.fromEntries(EJERCICIOS.map((e) => [e.id, e]));
export const GRUPOS = [...new Set(EJERCICIOS.map((e) => e.grupo))];

// Relaciones carga-velocidad de referencia (%1RM a partir de la velocidad media de la fase concentrica)
export const ECUACIONES = {
  banca: { ref: 'González-Badillo y Sánchez-Medina (2010), press de banca',
    f: (v) => 8.4326 * v * v - 73.501 * v + 112.33 },
  sentadilla: { ref: 'Sánchez-Medina y col. (2017), sentadilla completa',
    f: (v) => -5.961 * v * v - 50.71 * v + 117 },
};
