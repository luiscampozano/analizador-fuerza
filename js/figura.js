// Figuras animadas de cada ejercicio (v2.32.0): una persona estilizada, dibujada en SVG a partir de angulos de sus
// segmentos, hace el movimiento en bucle. Son 100 % propias (sin fotos de terceros), pesan muy poco y funcionan sin
// internet. miniatura(id) = cuadro fijo para listas; animacion(id) = SVG animado (SMIL) para la ficha del ejercicio.
//
// Convenciones (vista de lado, la persona mira a la derecha, y crece hacia abajo, piso en y = 0, metros):
//   tau  = inclinacion del tronco desde la vertical (0 de pie, 90 inclinado al frente, -90 acostado boca arriba)
//   pierna = [muslo, pierna] y brazo = [brazo, antebrazo]: angulo de cada segmento medido desde "hacia abajo",
//            positivo hacia el frente (90 = horizontal al frente, 180 = hacia arriba, -90 = hacia atras)
//   piernas/brazos: [cercano, lejano]; si falta el lejano, es igual al cercano
const L = { muslo: 0.43, pierna: 0.43, pie: 0.15, tronco: 0.52, cuello: 0.1, cabeza: 0.11, brazo: 0.31, antebrazo: 0.28 };
const rad = (g) => (g * Math.PI) / 180;
const seg = (p, ang, l) => [p[0] + l * Math.sin(rad(ang)), p[1] + l * Math.cos(rad(ang))];
const r2 = (x) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------- posturas base
const DE_PIE = { tau: 0, piernas: [[0, 0]], brazos: [[0, 0]], suelo: true };
const P = (o = {}) => ({ ...DE_PIE, ...o });
// interpolacion de numeros dentro de objetos y arreglos
function mezclar(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mezclar(x, b[i] ?? x, t));
  if (a && b && typeof a === 'object') { const o = { ...a }; for (const k of Object.keys(b)) o[k] = k in a ? mezclar(a[k], b[k], t) : b[k]; return o; }
  return t < 0.5 ? a : b;
}
const suave = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// ---------------------------------------------------------------- cinematica (vista de lado)
function articular(pose) {
  const H = pose.H ? [...pose.H] : [0, -0.9];
  const piernas = [pose.piernas[0], pose.piernas[1] || pose.piernas[0]];
  const brazos = [pose.brazos[0], pose.brazos[1] || pose.brazos[0]];
  const calc = (H0) => {
    const S = seg(H0, 180 - pose.tau, L.tronco); // del hombro: el tronco apunta "hacia arriba" girado tau al frente
    const cab = seg(S, 180 - pose.tau + (pose.cabeza || 0), L.cuello + L.cabeza);
    const pier = piernas.map(([m, p, pie = 90]) => { const K = seg(H0, m, L.muslo), A = seg(K, p, L.pierna); return [H0, K, A, seg(A, pie, L.pie)]; });
    const braz = brazos.map(([b, a]) => { const E = seg(S, b, L.brazo); return [S, E, seg(E, a, L.antebrazo)]; });
    return { H: H0, S, cab, pier, braz };
  };
  let j = calc(H);
  if (pose.suelo) { // los pies (el punto mas bajo de las piernas) tocan el piso
    const y = Math.max(...j.pier.flatMap((q) => [q[2][1], q[3][1]]));
    j = calc([H[0], H[1] - y]);
  }
  return j;
}

// ---------------------------------------------------------------- vista de frente (laterales, jalon, dominadas...)
// dy = cuanto baja el cuerpo; brazos = [abduccion, codo] por lado (0 abajo, 90 horizontal, 180 arriba); piernas = [abduccion]
function articularFrente(pose) {
  const y0 = -0.92 + (pose.dy || 0), hom = 0.2, cad = 0.11;
  const H = [0, y0], S = [0, y0 - L.tronco - (pose.encoger || 0)];
  const lados = [-1, 1].map((s, i) => {
    const [abd, codo = 0] = pose.brazos[i] || pose.brazos[0];
    const Sh = [s * hom, S[1]], E = seg(Sh, s * abd, L.brazo), M = seg(E, s * (abd + codo), L.antebrazo);
    const pp = pose.piernas || [[0]], [pa = 0, rod = 0] = pp[i] || pp[0];
    const Hp = [s * cad, y0], K = seg(Hp, s * pa - s * rod * 0.3, L.muslo), A = seg(K, s * pa + s * rod * 0.3, L.pierna);
    return { Sh, E, M, Hp, K, A };
  });
  return { H, S, cab: [0, S[1] - L.cuello - L.cabeza], lados };
}

// ---------------------------------------------------------------- plantillas de movimiento
// Cada plantilla: { A, B } (posturas inicio/fin, ida y vuelta) o { cuadros: [..] } (ciclo), mas equipo y accesorios.
const BARRA_ESP = [[-35, 165]], BARRA_PECHO = [[45, 170]];
const T = {
  // ---- piernas
  sentadilla: { A: P({ brazos: BARRA_ESP }), B: P({ tau: 38, piernas: [[95, -38]], brazos: [[-15, 170]] }), eq: 'barra_hombros' },
  sentadilla_frontal: { A: P({ brazos: [[70, 175]] }), B: P({ tau: 20, piernas: [[100, -40]], brazos: [[85, 178]] }), eq: 'barra_mano' },
  goblet: { A: P({ brazos: [[20, 175]] }), B: P({ tau: 22, piernas: [[100, -40]], brazos: [[40, 178]] }), eq: 'mancuerna_mano' },
  sentadilla_mancuernas: { A: P(), B: P({ tau: 30, piernas: [[95, -38]], brazos: [[-10, -10]] }), eq: 'mancuernas' },
  sentadilla_libre: { A: P({ brazos: [[0, 0]] }), B: P({ tau: 30, piernas: [[95, -38]], brazos: [[90, 90]] }) },
  pistol: { A: P({ brazos: [[90, 90]] }), B: P({ tau: 30, piernas: [[110, -40], [90, 90]], brazos: [[90, 90]] }) },
  sentadilla_salto: { A: P({ tau: 30, piernas: [[95, -38]], brazos: [[-40, -40]] }), B: P({ H: [0, -1.15], suelo: false, piernas: [[5, -5, 120]], brazos: [[170, 170]] }) },
  salto_cajon: { A: P({ tau: 30, piernas: [[90, -35]], brazos: [[-40, -40]] }), B: P({ H: [0.25, -1.05], suelo: false, tau: 20, piernas: [[95, -20]], brazos: [[100, 100]] }), props: ['cajon_frente'] },
  zercher: { A: P({ brazos: [[40, 120]] }), B: P({ tau: 30, piernas: [[95, -38]], brazos: [[60, 130]] }), eq: 'barra_codos' },
  prensa: { A: P({ H: [0, -0.45], suelo: false, tau: -55, piernas: [[165, 105, 180]], brazos: [[60, 60]] }), B: P({ H: [0, -0.45], suelo: false, tau: -55, piernas: [[132, 132, 220]], brazos: [[60, 60]] }), props: ['prensa'] },
  prensa_horizontal: { A: P({ H: [0, -0.5], suelo: false, tau: -15, piernas: [[95, 95]], brazos: [[10, 10]] }), B: P({ H: [0, -0.5], suelo: false, tau: -15, piernas: [[120, 30]], brazos: [[10, 10]] }), props: ['asiento', 'placa_pies'] },
  hack: { A: P({ tau: -12, brazos: [[-20, 160]] }), B: P({ tau: -5, piernas: [[100, -30]], brazos: [[-20, 160]] }), props: ['riel_espalda'] },
  zancada: { A: P({ piernas: [[20, 5], [-15, -5]] }), B: P({ piernas: [[80, -10], [-35, -95]] }), eq: 'mancuernas' },
  zancada_barra: { A: P({ piernas: [[20, 5], [-15, -5]], brazos: BARRA_ESP }), B: P({ piernas: [[80, -10], [-35, -95]], brazos: BARRA_ESP }), eq: 'barra_hombros' },
  bulgara: { A: P({ tau: 10, piernas: [[15, 0], [-40, -110, 0]] }), B: P({ tau: 25, piernas: [[85, -15], [-10, -100, 0]] }), eq: 'mancuernas', props: ['banco_atras'] },
  bulgara_barra: { A: P({ tau: 5, piernas: [[15, 0], [-40, -110, 0]], brazos: BARRA_ESP }), B: P({ tau: 20, piernas: [[85, -15], [-10, -100, 0]], brazos: BARRA_ESP }), eq: 'barra_hombros', props: ['banco_atras'] },
  step_up: { A: P({ H: [0, -0.92], suelo: false, piernas: [[70, -20], [0, 0]] }), B: P({ H: [0.2, -1.3], suelo: false, piernas: [[5, 0], [-15, 30]] }), eq: 'mancuernas', props: ['cajon'] },
  extension: { A: P({ H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, 0]], brazos: [[30, 30]] }), B: P({ H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, 85]], brazos: [[30, 30]] }), props: ['asiento', 'rodillo_tobillo'] },
  curl_tumbado: { A: P({ H: [0, -0.62], suelo: false, tau: -95, piernas: [[85, 85]], brazos: [[160, 170]] }), B: P({ H: [0, -0.62], suelo: false, tau: -95, piernas: [[85, -20]], brazos: [[160, 170]] }), props: ['banco_largo'], boca: 'abajo' },
  curl_sentado: { A: P({ H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, 80]], brazos: [[30, 30]] }), B: P({ H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, -10]], brazos: [[30, 30]] }), props: ['asiento'] },
  curl_pie: { A: P({ tau: 10, piernas: [[0, 0], [5, 5]], brazos: [[70, 90]] }), B: P({ tau: 10, piernas: [[0, 0], [10, -110]], brazos: [[70, 90]] }) },
  pantorrilla: { A: P({ piernas: [[0, 0, 90]], brazos: BARRA_ESP }), B: P({ piernas: [[0, 0, 140]], brazos: BARRA_ESP }), eq: 'barra_hombros', props: ['escalon'] },
  pantorrilla_libre: { A: P({ piernas: [[0, 0, 90]] }), B: P({ piernas: [[0, 0, 140]] }), eq: 'mancuernas', props: ['escalon'] },
  pantorrilla_sentado: { A: P({ H: [0, -0.5], suelo: false, tau: 10, piernas: [[90, 0, 90]], brazos: [[60, 90]] }), B: P({ H: [0, -0.56], suelo: false, tau: 10, piernas: [[90, 0, 140]], brazos: [[60, 90]] }), props: ['asiento'] },
  // ---- gluteo y femoral
  peso_muerto: { mini: 0.3, A: P({ tau: 62, piernas: [[60, -25]], brazos: [[-2, -2]] }), B: P({ brazos: [[0, 0]] }), eq: 'barra_mano', props: [] },
  peso_muerto_sumo: { mini: 0.3, A: P({ tau: 45, piernas: [[75, -30]] }), B: P(), eq: 'barra_mano' },
  rumano: { A: P({ brazos: [[0, 0]] }), B: P({ tau: 80, piernas: [[20, 5]], brazos: [[-5, -5]] }), eq: 'barra_mano' },
  rumano_mancuernas: { A: P(), B: P({ tau: 80, piernas: [[20, 5]], brazos: [[-5, -5]] }), eq: 'mancuernas' },
  rumano_unipodal: { A: P({ piernas: [[0, 0], [-5, -5]] }), B: P({ tau: 85, piernas: [[15, 5], [-95, -95]], brazos: [[-5, -5]] }), eq: 'mancuerna_mano' },
  rack_pull: { mini: 0.3, A: P({ tau: 40, piernas: [[25, -5]] }), B: P(), eq: 'barra_mano', props: ['bloques'] },
  buenos_dias: { A: P({ brazos: BARRA_ESP }), B: P({ tau: 80, piernas: [[15, 0]], brazos: [[-100, 70]] }), eq: 'barra_hombros' },
  hip_thrust: { A: P({ H: [0, -0.2], suelo: false, tau: -70, piernas: [[80, 15]], brazos: [[60, 40]] }), B: P({ H: [0, -0.48], suelo: false, tau: -92, piernas: [[95, 10]], brazos: [[60, 40]] }), eq: 'barra_cadera', props: ['banco_hombros'] },
  puente: { A: P({ H: [0, -0.1], suelo: false, tau: -88, piernas: [[60, 25]], brazos: [[60, 40]] }), B: P({ H: [0, -0.38], suelo: false, tau: -115, piernas: [[85, 20]], brazos: [[60, 40]] }), eq: 'barra_cadera' },
  pull_through: { mini: 0.3, A: P({ tau: 75, piernas: [[25, 0]], brazos: [[-25, -25]] }), B: P({ brazos: [[10, 10]] }), eq: 'cable', ancla: [-0.7, -0.15] },
  patada_gluteo: { A: P({ tau: 15, piernas: [[0, 0], [10, 10]], brazos: [[80, 90]] }), B: P({ tau: 25, piernas: [[0, 0], [-50, -50]], brazos: [[80, 90]] }), eq: 'cable_pie', ancla: [0.6, -0.1] },
  hiperextension: { A: P({ H: [0, -0.9], suelo: false, tau: 140, piernas: [[-45, -45]], brazos: [[100, 160]] }), B: P({ H: [0, -0.9], suelo: false, tau: 45, piernas: [[-45, -45]], brazos: [[100, 160]] }), props: ['banco45'] },
  hiper_inversa: { A: P({ H: [0, -1.0], suelo: false, tau: 90, piernas: [[0, 0]], brazos: [[90, 90]] }), B: P({ H: [0, -1.0], suelo: false, tau: 90, piernas: [[-80, -80]], brazos: [[90, 90]] }), props: ['banco_alto'] },
  superman: { A: P({ H: [0, -0.12], suelo: false, tau: 90, piernas: [[-88, -88]], brazos: [[175, 175]] }), B: P({ H: [0, -0.12], suelo: false, tau: 75, piernas: [[-75, -75]], brazos: [[160, 160]] }) },
  swing: { mini: 0.3, A: P({ tau: 70, piernas: [[35, -10]], brazos: [[-30, -30]] }), B: P({ brazos: [[95, 95]] }), eq: 'kb' },
  // ---- pecho
  banca: { A: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[180, 180]] }), B: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[45, 170]] }), eq: 'barra_mano', props: ['banco'] },
  banca_mancuernas: { A: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[180, 180]] }), B: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[35, 175]] }), eq: 'mancuernas', props: ['banco'] },
  inclinado: { A: P({ H: [0.3, -0.5], suelo: false, tau: -55, piernas: [[85, 0]], brazos: [[150, 150]] }), B: P({ H: [0.3, -0.5], suelo: false, tau: -55, piernas: [[85, 0]], brazos: [[70, 150]] }), eq: 'barra_mano', props: ['banco_inc'] },
  inclinado_mancuernas: { A: P({ H: [0.3, -0.5], suelo: false, tau: -55, piernas: [[85, 0]], brazos: [[150, 150]] }), B: P({ H: [0.3, -0.5], suelo: false, tau: -55, piernas: [[85, 0]], brazos: [[60, 160]] }), eq: 'mancuernas', props: ['banco_inc'] },
  declinado: { A: P({ H: [0.55, -0.62], suelo: false, tau: -105, piernas: [[60, 10]], brazos: [[195, 195]] }), B: P({ H: [0.55, -0.62], suelo: false, tau: -105, piernas: [[60, 10]], brazos: [[60, 185]] }), eq: 'barra_mano', props: ['banco_dec'] },
  press_maquina: { A: P({ H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, 0]], brazos: [[60, 100]] }), B: P({ H: [0, -0.55], suelo: false, tau: -8, piernas: [[90, 0]], brazos: [[95, 95]] }), props: ['asiento', 'respaldo'], eq: 'manijas' },
  aperturas: { A: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[180, 180]] }), B: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[95, 110]] }), eq: 'mancuernas', props: ['banco'] },
  pec_deck: { frente: true, A: { dy: 0.35, brazos: [[90, 70]] }, B: { dy: 0.35, brazos: [[90, -10]] }, props: ['asiento_frente'] },
  cruce_poleas: { frente: true, A: { brazos: [[120, 0]] }, B: { brazos: [[40, 30]] }, eq: 'cables_frente' },
  pullover: { A: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[175, 175]] }), B: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[-80, -80]] }), eq: 'mancuerna_mano', props: ['banco'] },
  fondos: { A: P({ H: [0, -1.05], suelo: false, tau: 10, piernas: [[0, -60]], brazos: [[0, 0]] }), B: P({ H: [0, -0.8], suelo: false, tau: 25, piernas: [[0, -60]], brazos: [[-70, 0]] }), props: ['paralelas'] },
  flexiones: { A: P({ H: [0, -0.32], suelo: false, tau: 78, piernas: [[-102, -102, 180]], brazos: [[-12, -12]] }), B: P({ H: [0, -0.18], suelo: false, tau: 86, piernas: [[-94, -94, 180]], brazos: [[-70, 20]] }) },
  flexiones_inc: { A: P({ H: [0, -0.52], suelo: false, tau: 60, piernas: [[-120, -120, 180]], brazos: [[-25, -25]] }), B: P({ H: [0, -0.4], suelo: false, tau: 68, piernas: [[-112, -112, 180]], brazos: [[-80, 10]] }), props: ['banco_manos'] },
  flexiones_dec: { A: P({ H: [0, -0.5], suelo: false, tau: 100, piernas: [[-80, -80, 180]], brazos: [[-5, -5]] }), B: P({ H: [0, -0.35], suelo: false, tau: 105, piernas: [[-75, -75, 180]], brazos: [[-60, 25]] }), props: ['banco_pies'] },
  // ---- espalda
  dominadas: { frente: true, A: { dy: -0.35, brazos: [[165, 10]], piernas: [[0, 30]] }, B: { dy: -0.75, brazos: [[110, 90]], piernas: [[0, 30]] }, props: ['barra_fija'] },
  jalon: { frente: true, A: { dy: 0.35, brazos: [[165, 10]] }, B: { dy: 0.35, brazos: [[110, 90]] }, eq: 'barra_jalon', props: ['asiento_frente'] },
  jalon_brazos_rectos: { A: P({ tau: 25, brazos: [[150, 150]] }), B: P({ tau: 25, brazos: [[-10, -10]] }), eq: 'cable', ancla: [0.5, -2.0] },
  remo_barra: { A: P({ tau: 70, piernas: [[30, -15]], brazos: [[-20, -20]] }), B: P({ tau: 70, piernas: [[30, -15]], brazos: [[-75, 20]] }), eq: 'barra_mano' },
  remo_t: { A: P({ tau: 55, piernas: [[35, -15]], brazos: [[-10, -10]] }), B: P({ tau: 55, piernas: [[35, -15]], brazos: [[-70, 25]] }), eq: 'barra_mano' },
  remo_mancuerna: { A: P({ H: [0, -0.62], suelo: false, tau: 85, piernas: [[0, 0], [90, -90]], brazos: [[0, 0], [0, 0]] }), B: P({ H: [0, -0.62], suelo: false, tau: 85, piernas: [[0, 0], [90, -90]], brazos: [[-80, 10], [0, 0]] }), eq: 'mancuerna_mano', props: ['banco_bajo'] },
  remo_pecho: { A: P({ H: [0, -0.62], suelo: false, tau: 60, piernas: [[60, -10]], brazos: [[5, 5]] }), B: P({ H: [0, -0.62], suelo: false, tau: 60, piernas: [[60, -10]], brazos: [[-60, 30]] }), eq: 'mancuernas', props: ['banco_inc_pecho'] },
  remo_sentado: { A: P({ H: [0, -0.32], suelo: false, tau: 10, piernas: [[80, 110]], brazos: [[85, 85]] }), B: P({ H: [0, -0.32], suelo: false, tau: -10, piernas: [[80, 110]], brazos: [[-40, 85]] }), eq: 'cable', ancla: [1.1, -0.4], props: ['asiento_suelo'] },
  remo_maquina: { A: P({ H: [0, -0.55], suelo: false, tau: 5, piernas: [[90, 0]], brazos: [[85, 85]] }), B: P({ H: [0, -0.55], suelo: false, tau: -5, piernas: [[90, 0]], brazos: [[-40, 85]] }), eq: 'manijas', props: ['asiento', 'pecho_pad'] },
  remo_invertido: { A: P({ H: [0, -0.35], suelo: false, tau: -75, piernas: [[85, 85, 0]], brazos: [[180, 180]] }), B: P({ H: [0, -0.62], suelo: false, tau: -80, piernas: [[80, 80, 0]], brazos: [[110, 200]] }), eq: 'barra_mano' },
  encogimientos: { frente: true, A: { brazos: [[8, 0]] }, B: { encoger: 0.07, brazos: [[8, 0]] }, eq: 'barra_frente' },
  face_pull: { A: P({ tau: -5, brazos: [[95, 95]] }), B: P({ tau: -5, brazos: [[100, 175]] }), eq: 'cable', ancla: [0.9, -1.55] },
  muscle_up: { frente: true, A: { dy: -0.35, brazos: [[165, 10]] }, B: { dy: -1.05, brazos: [[20, 0]] }, props: ['barra_fija'] },
  // ---- hombros
  press_militar: { A: P({ brazos: BARRA_PECHO }), B: P({ brazos: [[175, 180]] }), eq: 'barra_mano' },
  press_hombro_mancuernas: { A: P({ H: [0, -0.55], suelo: false, tau: -5, piernas: [[90, 0]], brazos: [[70, 175]] }), B: P({ H: [0, -0.55], suelo: false, tau: -5, piernas: [[90, 0]], brazos: [[175, 180]] }), eq: 'mancuernas', props: ['asiento', 'respaldo'] },
  push_press: { A: P({ tau: 5, piernas: [[30, -15]], brazos: BARRA_PECHO }), B: P({ brazos: [[175, 180]] }), eq: 'barra_mano' },
  landmine: { A: P({ tau: 10, piernas: [[0, 0], [-15, -10]], brazos: [[40, 165]] }), B: P({ tau: 15, piernas: [[0, 0], [-15, -10]], brazos: [[140, 140]] }), eq: 'landmine' },
  laterales: { frente: true, A: { brazos: [[8, 0]] }, B: { brazos: [[88, 0]] }, eq: 'mancuernas_frente' },
  lateral_uno: { frente: true, A: { brazos: [[8, 0], [5, 0]] }, B: { brazos: [[8, 0], [88, 0]] }, eq: 'mancuernas_frente' },
  laterales_polea: { frente: true, A: { brazos: [[8, 0], [-10, 0]] }, B: { brazos: [[8, 0], [85, 0]] }, eq: 'cable_frente' },
  frontales: { A: P(), B: P({ brazos: [[90, 90]] }), eq: 'mancuernas' },
  pajaro: { A: P({ tau: 80, piernas: [[25, -10]], brazos: [[0, 0]] }), B: P({ tau: 80, piernas: [[25, -10]], brazos: [[-85, -85]] }), eq: 'mancuernas' },
  remo_menton: { A: P({ brazos: [[5, 5]] }), B: P({ brazos: [[-60, 160]] }), eq: 'barra_mano' },
  arnold: { A: P({ H: [0, -0.55], suelo: false, tau: -5, piernas: [[90, 0]], brazos: [[30, 175]] }), B: P({ H: [0, -0.55], suelo: false, tau: -5, piernas: [[90, 0]], brazos: [[175, 180]] }), eq: 'mancuernas', props: ['asiento', 'respaldo'] },
  // ---- brazos
  curl: { A: P({ brazos: [[0, 5]] }), B: P({ brazos: [[10, 160]] }), eq: 'barra_mano' },
  curl_mancuernas: { A: P({ brazos: [[0, 5]] }), B: P({ brazos: [[10, 160]] }), eq: 'mancuernas' },
  curl_alterno: { A: P({ brazos: [[0, 5], [10, 160]] }), B: P({ brazos: [[10, 160], [0, 5]] }), eq: 'mancuernas' },
  predicador: { A: P({ H: [0, -0.55], suelo: false, tau: 15, piernas: [[90, 0]], brazos: [[60, 80]] }), B: P({ H: [0, -0.55], suelo: false, tau: 15, piernas: [[90, 0]], brazos: [[60, 175]] }), eq: 'barra_mano', props: ['asiento', 'atril'] },
  concentrado: { A: P({ H: [0, -0.5], suelo: false, tau: 45, piernas: [[90, 0]], brazos: [[5, 5]] }), B: P({ H: [0, -0.5], suelo: false, tau: 45, piernas: [[90, 0]], brazos: [[5, 150]] }), eq: 'mancuerna_mano', props: ['asiento'] },
  curl_inclinado: { A: P({ H: [0.3, -0.5], suelo: false, tau: -40, piernas: [[85, 0]], brazos: [[-15, -15]] }), B: P({ H: [0.3, -0.5], suelo: false, tau: -40, piernas: [[85, 0]], brazos: [[-15, 140]] }), eq: 'mancuernas', props: ['banco_inc'] },
  curl_polea: { A: P({ brazos: [[0, 5]] }), B: P({ brazos: [[10, 160]] }), eq: 'cable', ancla: [0.55, -0.05] },
  curl_maquina: { A: P({ H: [0, -0.55], suelo: false, tau: 10, piernas: [[90, 0]], brazos: [[70, 80]] }), B: P({ H: [0, -0.55], suelo: false, tau: 10, piernas: [[90, 0]], brazos: [[70, 170]] }), props: ['asiento', 'atril'], eq: 'manijas' },
  triceps_polea: { A: P({ tau: 10, brazos: [[5, 120]] }), B: P({ tau: 10, brazos: [[5, 0]] }), eq: 'cable', ancla: [0.35, -2.1] },
  tras_nuca: { A: P({ brazos: [[170, 0]] }), B: P({ brazos: [[175, 175]] }), eq: 'mancuerna_mano' },
  tras_nuca_polea: { A: P({ tau: 30, piernas: [[0, 0], [-20, -10]], brazos: [[160, 15]] }), B: P({ tau: 30, piernas: [[0, 0], [-20, -10]], brazos: [[160, 160]] }), eq: 'cable', ancla: [-0.6, -0.4] },
  frances: { A: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[160, 0]] }), B: P({ H: [0.45, -0.5], suelo: false, tau: -90, piernas: [[80, 0]], brazos: [[160, 160]] }), eq: 'barra_mano', props: ['banco'] },
  patada_triceps: { A: P({ tau: 75, piernas: [[25, -10]], brazos: [[-80, 0]] }), B: P({ tau: 75, piernas: [[25, -10]], brazos: [[-80, -80]] }), eq: 'mancuerna_mano' },
  fondos_banco: { A: P({ H: [0.15, -0.5], suelo: false, tau: 0, piernas: [[85, 85, 0]], brazos: [[-10, -10]] }), B: P({ H: [0.15, -0.3], suelo: false, tau: 10, piernas: [[85, 85, 0]], brazos: [[-80, -10]] }), props: ['banco_atras_manos'] },
  muneca: { eqFijo: 'mancuerna_mano', A: P({ H: [0, -0.5], suelo: false, tau: 25, piernas: [[90, 0]], brazos: [[30, 80]] }), B: P({ H: [0, -0.5], suelo: false, tau: 25, piernas: [[90, 0]], brazos: [[30, 110]] }), eq: 'barra_mano', props: ['asiento'] },
  // ---- core
  crunch_polea: { A: P({ H: [0, -0.62], suelo: false, tau: 30, piernas: [[-90, -90, 180]], brazos: [[150, 20]] }), B: P({ H: [0, -0.5], suelo: false, tau: 95, piernas: [[-80, -80, 180]], brazos: [[150, 20]] }), eq: 'cable', ancla: [0.35, -2.0] },
  crunch_maquina: { A: P({ H: [0, -0.55], suelo: false, tau: 0, piernas: [[90, 0]], brazos: [[160, 30]] }), B: P({ H: [0, -0.55], suelo: false, tau: 50, piernas: [[90, 0]], brazos: [[160, 30]] }), props: ['asiento'] },
  abdominales: { A: P({ H: [0, -0.1], suelo: false, tau: -88, piernas: [[60, -25]], brazos: [[150, 30]] }), B: P({ H: [0, -0.1], suelo: false, tau: -20, piernas: [[60, -25]], brazos: [[150, 30]] }) },
  crunch_declinado: { A: P({ H: [0.1, -0.6], suelo: false, tau: -105, piernas: [[60, 0]], brazos: [[150, 30]] }), B: P({ H: [0.1, -0.6], suelo: false, tau: -35, piernas: [[60, 0]], brazos: [[150, 30]] }), props: ['banco_dec'] },
  colgado: { A: P({ H: [0, -1.25], suelo: false, brazos: [[180, 180]] }), B: P({ H: [0, -1.25], suelo: false, tau: -10, piernas: [[95, 95]], brazos: [[175, 175]] }), props: ['barra_fija_lado'] },
  piernas_suelo: { A: P({ H: [0, -0.1], suelo: false, tau: -90, piernas: [[85, 85, 180]], brazos: [[-90, -90]] }), B: P({ H: [0, -0.1], suelo: false, tau: -90, piernas: [[175, 175, 270]], brazos: [[-90, -90]] }) },
  rueda: { A: P({ H: [0, -0.6], suelo: false, tau: 45, piernas: [[-90, -90, 180]], brazos: [[5, 5]] }), B: P({ H: [0, -0.4], suelo: false, tau: 85, piernas: [[-60, -90, 180]], brazos: [[100, 100]] }), eq: 'rueda' },
  lenador: { A: P({ tau: 0, brazos: [[150, 150]] }), B: P({ tau: 20, piernas: [[15, -10]], brazos: [[20, 20]] }), eq: 'cable', ancla: [0.7, -2.0] },
  flexion_lateral: { frente: true, A: { brazos: [[5, 0], [5, 0]], inclinar: -12 }, B: { brazos: [[5, 0], [5, 0]], inclinar: 12 }, eq: 'mancuerna_frente' },
  // ---- potencia
  cargada: { cuadros: [P({ tau: 62, piernas: [[60, -25]] }), P({ tau: 25, piernas: [[20, -10]] }), P({ tau: -5, piernas: [[0, 0, 140]], brazos: [[-40, 90]] }), P({ tau: 15, piernas: [[60, -25]], brazos: [[60, 175]] }), P({ brazos: [[60, 175]] })], eq: 'barra_mano' },
  arranque: { cuadros: [P({ tau: 62, piernas: [[55, -25]] }), P({ tau: 15, piernas: [[15, -5]], brazos: [[-10, -10]] }), P({ tau: -5, piernas: [[0, 0, 140]], brazos: [[110, 130]] }), P({ tau: 25, piernas: [[95, -35]], brazos: [[175, 175]] }), P({ brazos: [[175, 175]] })], eq: 'barra_mano' },
  envion: { A: P({ tau: 0, piernas: [[30, -15]], brazos: BARRA_PECHO }), B: P({ piernas: [[40, -10], [-30, -60]], brazos: [[175, 180]] }), eq: 'barra_mano' },
  thruster: { A: P({ tau: 20, piernas: [[100, -40]], brazos: [[80, 175]] }), B: P({ brazos: [[175, 180]] }), eq: 'barra_mano' },
  lanzamiento: { A: P({ tau: 30, piernas: [[90, -35]], brazos: [[20, 170]] }), B: P({ brazos: [[160, 170]] }), eq: 'balon' },
  // ---- cardio (ciclos)
  correr: { cuadros: [P({ tau: 10, piernas: [[45, -30], [-30, -80]], brazos: [[-40, 60], [40, 130]] }), P({ tau: 10, piernas: [[0, 0], [10, -100]], brazos: [[0, 90], [0, 90]] }), P({ tau: 10, piernas: [[-30, -80], [45, -30]], brazos: [[40, 130], [-40, 60]] }), P({ tau: 10, piernas: [[10, -100], [0, 0]], brazos: [[0, 90], [0, 90]] })], ciclo: true, props: ['piso'] },
  caminar: { cuadros: [P({ piernas: [[25, 15], [-20, -15]], brazos: [[-20, -10], [20, 30]] }), P({ piernas: [[0, 0], [5, -30]] }), P({ piernas: [[-20, -15], [25, 15]], brazos: [[20, 30], [-20, -10]] }), P({ piernas: [[5, -30], [0, 0]] })], ciclo: true, props: ['piso'] },
  bici: { cuadros: [0, 90, 180, 270].map((g) => ({ H: [0, -0.95], suelo: false, tau: 45, cabeza: -20, brazos: [[95, 95]], piernas: [pedal(g), pedal(g + 180)] })), ciclo: true, props: ['bici'] },
  eliptica: { cuadros: [P({ tau: 5, piernas: [[25, 5], [-15, -15]], brazos: [[60, 120], [20, 90]] }), P({ tau: 5, piernas: [[-15, -15], [25, 5]], brazos: [[20, 90], [60, 120]] })], ciclo: true, props: ['eliptica'] },
  remo_ergometro: { cuadros: [{ H: [-0.3, -0.35], suelo: false, tau: 30, piernas: [[150, -10]], brazos: [[100, 100]] }, { H: [0.25, -0.35], suelo: false, tau: -20, piernas: [[90, 90]], brazos: [[-30, 90]] }], props: ['remo_maq'] },
  ski: { A: P({ brazos: [[170, 170]] }), B: P({ tau: 45, piernas: [[30, -15]], brazos: [[-20, -20]] }), eq: 'cable', ancla: [0.4, -2.2] },
  nadar: { cuadros: [0, 1, 2, 3].map((k) => ({ H: [0, -0.5], suelo: false, tau: 92, cabeza: 5, piernas: [[-88 + (k % 2 ? 10 : -10), -88], [-88 + (k % 2 ? -10 : 10), -88]], brazos: [[180 + 90 * k, 180 + 90 * k], [90 * k, 90 * k]] })), ciclo: true, mini: 1, props: ['agua'] },
  saltar_cuerda: { cuadros: [P({ piernas: [[0, 0, 120]], brazos: [[20, 60]] }), P({ H: [0, -1.02], suelo: false, piernas: [[5, -5, 120]], brazos: [[20, 60]] })], eq: 'cuerda' },
  boxeo: { cuadros: [P({ tau: 5, piernas: [[15, 0], [-15, -10]], brazos: [[60, 160], [40, 150]] }), P({ tau: 10, piernas: [[15, 0], [-15, -10]], brazos: [[90, 90], [40, 150]] }), P({ tau: 5, piernas: [[15, 0], [-15, -10]], brazos: [[60, 160], [40, 150]] }), P({ tau: 10, piernas: [[15, 0], [-15, -10]], brazos: [[60, 160], [90, 90]] })], ciclo: true, props: ['saco'] },
  burpee: { cuadros: [P({ brazos: [[0, 0]] }), P({ tau: 40, piernas: [[110, -40]], brazos: [[-10, -10]] }), P({ H: [0, -0.32], suelo: false, tau: 78, piernas: [[-102, -102, 180]], brazos: [[-12, -12]] }), P({ tau: 40, piernas: [[110, -40]], brazos: [[-10, -10]] }), P({ H: [0, -1.12], suelo: false, piernas: [[0, 0, 130]], brazos: [[175, 175]] })], ciclo: true },
  jumping_jacks: { frente: true, A: { brazos: [[10, 0]], piernas: [[3]] }, B: { dy: -0.05, brazos: [[165, 0]], piernas: [[18]] } },
  escaladores: { cuadros: [P({ H: [0, -0.42], suelo: false, tau: 70, piernas: [[60, -60, 180], [-110, -110, 180]], brazos: [[-20, -20]] }), P({ H: [0, -0.42], suelo: false, tau: 70, piernas: [[-110, -110, 180], [60, -60, 180]], brazos: [[-20, -20]] })], ciclo: true },
  cuerdas: { A: P({ tau: 20, piernas: [[60, -30]], brazos: [[100, 110], [40, 60]] }), B: P({ tau: 20, piernas: [[60, -30]], brazos: [[40, 60], [100, 110]] }), eq: 'cuerdas' },
  escaladora: { cuadros: [P({ H: [0, -1.05], suelo: false, tau: 10, piernas: [[60, -10], [0, 0]], brazos: [[60, 90]] }), P({ H: [0, -1.05], suelo: false, tau: 10, piernas: [[0, 0], [60, -10]], brazos: [[60, 90]] })], ciclo: true, props: ['escalones'] },
  // v2.35.1 deportes: una figura por deporte
  patada: { cuadros: [P({ piernas: [[0, 0], [5, 0]], brazos: [[10, 20], [-10, 0]] }), P({ tau: 5, piernas: [[-35, -110], [5, 0]], brazos: [[-40, -20], [50, 80]] }),
    P({ tau: -5, piernas: [[25, 15], [5, 0]], brazos: [[30, 50], [-30, -10]] }), P({ tau: -15, piernas: [[85, 80], [5, 0]], brazos: [[50, 80], [-50, -30]] })], ciclo: true, mini: 3, eq: 'balon_fijo', balon: [0.36, -0.11] },
  tiro: { A: P({ tau: 12, piernas: [[55, -25]], brazos: [[55, 150]] }), B: P({ H: [0, -1.02], suelo: false, piernas: [[5, -5, 125]], brazos: [[165, 175]] }), mini: 0.8, eq: 'balon' },
  remate: { cuadros: [P({ tau: 20, piernas: [[60, -30]], brazos: [[-60, -50]] }), P({ H: [0, -1.12], suelo: false, tau: -10, piernas: [[30, -40, 120]], brazos: [[150, 235], [120, 120]] }),
    P({ H: [0, -1.15], suelo: false, tau: 5, piernas: [[25, -35, 120]], brazos: [[170, 168], [60, 70]] }), P({ H: [0, -1.05], suelo: false, tau: 20, piernas: [[30, -30, 120]], brazos: [[50, 40], [20, 30]] })],
    mini: 2, eq: 'balon_fijo', balon: [0.3, -2.42] },
  raqueta: { A: P({ tau: 8, piernas: [[25, -5], [-20, -15]], brazos: [[-75, -35], [60, 100]] }), B: P({ tau: 8, piernas: [[25, -5], [-20, -15]], brazos: [[110, 150], [10, 40]] }), mini: 0.62, eq: 'raqueta' },
  deporte: { cuadros: [P({ tau: 15, piernas: [[40, -20], [-30, -70]], brazos: [[-30, 60], [60, 120]] }), P({ tau: 15, piernas: [[-30, -70], [40, -20]], brazos: [[60, 120], [-30, 60]] })], ciclo: true, eq: 'balon_piso' },
  baile: { frente: true, A: { dy: 0.02, brazos: [[150, 20], [30, 60]], piernas: [[10], [-2]] }, B: { dy: 0.02, brazos: [[30, 60], [150, 20]], piernas: [[-2], [10]] } },
  abductores: { frente: true, A: { dy: 0.35, brazos: [[20, 0]], piernas: [[20, 90]] }, B: { dy: 0.35, brazos: [[20, 0]], piernas: [[45, 90]] }, props: ['asiento_frente'] },
  aductores: { frente: true, A: { dy: 0.35, brazos: [[20, 0]], piernas: [[45, 90]] }, B: { dy: 0.35, brazos: [[20, 0]], piernas: [[12, 90]] }, props: ['asiento_frente'] },
  abduccion_polea: { frente: true, A: { brazos: [[20, 0]], piernas: [[0], [4]] }, B: { brazos: [[20, 0]], piernas: [[0], [40]] }, eq: 'cable_tobillo' },
};
function pedal(g) { const r = 0.17, c = [0.15, -0.35]; const p = [c[0] + r * Math.cos(rad(g)), c[1] + r * Math.sin(rad(g))]; return ikPierna([0, -0.95], p); }
// angulos de muslo y pierna para que el tobillo llegue a un punto (rodilla al frente)
function ikPierna(H, A) {
  const dx = A[0] - H[0], dy = A[1] - H[1], d = Math.min(Math.hypot(dx, dy), L.muslo + L.pierna - 1e-3);
  const base = Math.atan2(dx, dy) * 180 / Math.PI, alfa = Math.acos((L.muslo * L.muslo + d * d - L.pierna * L.pierna) / (2 * L.muslo * d)) * 180 / Math.PI;
  const m = base + alfa, K = seg(H, m, L.muslo);
  return [m, Math.atan2(A[0] - K[0], A[1] - K[1]) * 180 / Math.PI, 90];
}

// ---------------------------------------------------------------- que plantilla usa cada ejercicio
const MAPA = [
  [/^(sentadilla|sentadilla_box|sentadilla_pausa|smith_sentadilla|belt_squat)$/, 'sentadilla'], [/^sentadilla_frontal$/, 'sentadilla_frontal'],
  [/^(sentadilla_goblet|sentadilla_sumo)$/, 'goblet'], [/^sentadilla_mancuernas$/, 'sentadilla_mancuernas'], [/^sentadilla_corporal$/, 'sentadilla_libre'],
  [/^sentadilla_zercher$/, 'zercher'], [/^pistol$/, 'pistol'], [/^sentadilla_salto$/, 'sentadilla_salto'], [/^salto_cajon$/, 'salto_cajon'],
  [/^hack$/, 'hack'], [/^(prensa_45|prensa_45_unilateral)$/, 'prensa'], [/^prensa_horizontal/, 'prensa_horizontal'],
  [/^(zancada|zancada_atras|zancada_caminando|zancada_curtsy)$/, 'zancada'], [/^zancada_barra$/, 'zancada_barra'],
  [/^bulgara_mancuernas$/, 'bulgara'], [/^(bulgara_barra|bulgara_smith)$/, 'bulgara_barra'], [/^step_up$/, 'step_up'],
  [/^extension_(cuadriceps|unilateral)$/, 'extension'], [/^curl_femoral_tumbado/, 'curl_tumbado'], [/^curl_femoral_sentado/, 'curl_sentado'], [/^curl_femoral_pie$/, 'curl_pie'],
  [/^abductores_maquina$/, 'abductores'], [/^aductores_maquina$/, 'aductores'], [/^abduccion_polea$/, 'abduccion_polea'],
  [/^(pantorrilla_pie|pantorrilla_smith|pantorrilla_maquina)$/, 'pantorrilla'], [/^pantorrilla_unilateral$/, 'pantorrilla_libre'], [/^(pantorrilla_sentado)$/, 'pantorrilla_sentado'], [/^pantorrilla_prensa$/, 'prensa'],
  [/^(peso_muerto|peso_muerto_hex|peso_muerto_deficit)$/, 'peso_muerto'], [/^peso_muerto_sumo$/, 'peso_muerto_sumo'], [/^(peso_muerto_rumano|peso_muerto_rigido)$/, 'rumano'],
  [/^rumano_mancuernas$/, 'rumano_mancuernas'], [/^rumano_unipodal$/, 'rumano_unipodal'], [/^rack_pull$/, 'rack_pull'], [/^buenos_dias$/, 'buenos_dias'],
  [/^hip_thrust/, 'hip_thrust'], [/^puente_gluteo$/, 'puente'], [/^pull_through$/, 'pull_through'], [/^patada_gluteo/, 'patada_gluteo'],
  [/^hiperextension$/, 'hiperextension'], [/^hiperextension_inversa$/, 'hiper_inversa'], [/^superman$/, 'superman'], [/^swing_kb$/, 'swing'],
  [/^(press_banca|press_banca_pausa|press_agarre_cerrado|smith_banca)$/, 'banca'], [/^(press_mancuernas|press_mancuerna_unilateral)$/, 'banca_mancuernas'],
  [/^(press_inclinado|smith_inclinado)$/, 'inclinado'], [/^press_inclinado_mancuernas$/, 'inclinado_mancuernas'], [/^press_declinado$/, 'declinado'],
  [/^press_pecho_(maquina|unilateral)$/, 'press_maquina'], [/^aperturas_mancuernas$/, 'aperturas'], [/^pec_deck$/, 'pec_deck'], [/^cruce_poleas$/, 'cruce_poleas'],
  [/^pullover$/, 'pullover'], [/^fondos$/, 'fondos'], [/^flexiones$/, 'flexiones'], [/^flexiones_inclinadas$/, 'flexiones_inc'], [/^flexiones_declinadas$/, 'flexiones_dec'],
  [/^(dominadas|chin_up|dominadas_asistidas)$/, 'dominadas'], [/^muscle_up$/, 'muscle_up'], [/^(jalon|jalon_cerrado|jalon_unilateral|jalon_unilateral_maquina)$/, 'jalon'],
  [/^jalon_brazos_rectos$/, 'jalon_brazos_rectos'], [/^(remo_barra|remo_pendlay)$/, 'remo_barra'], [/^remo_t$/, 'remo_t'], [/^remo_mancuerna$/, 'remo_mancuerna'],
  [/^remo_mancuernas_pecho$/, 'remo_pecho'], [/^(remo_polea|remo_polea_unilateral)$/, 'remo_sentado'], [/^(remo_riel|remo_maquina|remo_unilateral_maquina)$/, 'remo_maquina'],
  [/^remo_invertido$/, 'remo_invertido'], [/^encogimientos$/, 'encogimientos'], [/^face_pull$/, 'face_pull'],
  [/^(press_militar|smith_militar)$/, 'press_militar'], [/^(press_hombro_mancuernas|press_hombro_unilateral|press_hombro_maquina)$/, 'press_hombro_mancuernas'], [/^press_arnold$/, 'arnold'],
  [/^push_press$/, 'push_press'], [/^landmine_press$/, 'landmine'], [/^(elevaciones_laterales|laterales_maquina)$/, 'laterales'], [/^lateral_unilateral$/, 'lateral_uno'],
  [/^laterales_polea$/, 'laterales_polea'], [/^elevaciones_frontales$/, 'frontales'], [/^(pajaro|pajaro_polea|reverse_pec_deck)$/, 'pajaro'], [/^remo_menton$/, 'remo_menton'],
  [/^(curl|curl_z|curl_invertido)$/, 'curl'], [/^(curl_mancuernas|curl_martillo|curl_zottman)$/, 'curl_mancuernas'], [/^(curl_alterno|curl_martillo_alterno)$/, 'curl_alterno'],
  [/^(curl_predicador|curl_predicador_unilateral|curl_arana)$/, 'predicador'], [/^curl_concentrado$/, 'concentrado'], [/^curl_inclinado$/, 'curl_inclinado'],
  [/^curl_polea/, 'curl_polea'], [/^curl_maquina$/, 'curl_maquina'], [/^(triceps_polea|triceps_cuerda|triceps_polea_unilateral)$/, 'triceps_polea'],
  [/^triceps_tras_nuca_polea$/, 'tras_nuca_polea'], [/^triceps_tras_nuca/, 'tras_nuca'], [/^press_frances$/, 'frances'], [/^patada_triceps$/, 'patada_triceps'],
  [/^(fondos_banco|fondos_maquina)$/, 'fondos_banco'], [/^(curl_muneca|extension_muneca|curl_detras_espalda|rodillo_antebrazo)$/, 'muneca'],
  [/^crunch_polea$/, 'crunch_polea'], [/^crunch_maquina$/, 'crunch_maquina'], [/^abdominales$/, 'abdominales'], [/^crunch_declinado$/, 'crunch_declinado'],
  [/^elevacion_piernas_colgado$/, 'colgado'], [/^elevacion_piernas_suelo$/, 'piernas_suelo'], [/^rueda_abdominal$/, 'rueda'], [/^lenadores$/, 'lenador'], [/^flexion_lateral$/, 'flexion_lateral'],
  [/^(cargada|cargada_colgante)$/, 'cargada'], [/^arranque$/, 'arranque'], [/^envion$/, 'envion'], [/^thruster$/, 'thruster'], [/^lanzamiento_balon$/, 'lanzamiento'],
  [/^(correr|cinta|intervalos_carrera)$/, 'correr'], [/^(caminar|caminata_inclinada|senderismo|patinaje)$/, 'caminar'], [/^(bicicleta|bicicleta_estatica|spinning|bicicleta_aire)$/, 'bici'],
  [/^eliptica$/, 'eliptica'], [/^(remo_ergometro|kayak)$/, 'remo_ergometro'], [/^ski_erg$/, 'ski'], [/^natacion$/, 'nadar'], [/^saltar_cuerda$/, 'saltar_cuerda'],
  [/^(boxeo)$/, 'boxeo'], [/^(burpees|hiit)$/, 'burpee'], [/^jumping_jacks$/, 'jumping_jacks'], [/^escaladores$/, 'escaladores'], [/^cuerdas_batalla$/, 'cuerdas'],
  [/^escaladora$/, 'escaladora'], [/^futbol$/, 'patada'], [/^basquet$/, 'tiro'], [/^voley$/, 'remate'], [/^tenis$/, 'raqueta'], [/^baile$/, 'baile'], [/^cardio_otro$/, 'correr'],
];
export function plantillaDe(id) { for (const [re, t] of MAPA) if (re.test(id || '')) return t; return null; }

// ---------------------------------------------------------------- dibujo
const COL = { cuerpo: '#8B6CFF', lejos: '#5B49B8', equipo: '#22D3EE', accesorio: '#4A4A66', cabeza: '#B9A8FF' };
const linea = (pts) => 'M' + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L');
function geometria(t, pose) {
  if (t.frente) {
    const j = articularFrente(pose), inc = pose.inclinar || 0, rot = (p) => { // inclinacion lateral del tronco (flexion lateral)
      if (!inc) return p; const c = Math.cos(rad(inc)), s = Math.sin(rad(inc)), o = j.H; const dx = p[0] - o[0], dy = p[1] - o[1]; return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c]; };
    const [a, b] = j.lados;
    return {
      lejos: '',
      cuerpo: [linea([a.A, a.K, a.Hp, b.Hp, b.K, b.A]), linea([rot(a.E), rot(a.Sh), rot(b.Sh), rot(b.E)]), linea([rot(a.E), rot(a.M)]), linea([rot(b.E), rot(b.M)]), linea([j.H, rot(j.S)])].join(''),
      cab: rot(j.cab), manos: [rot(a.M), rot(b.M)], pies: [a.A, b.A], hombros: [rot(a.Sh), rot(b.Sh)], cadera: j.H,
    };
  }
  const j = articular(pose);
  const lejos = linea(j.pier[1]) + linea(j.braz[1]);
  const cuerpo = linea(j.pier[0]) + linea([j.H, j.S]) + linea(j.braz[0]);
  return { lejos, cuerpo, cab: j.cab, manos: [j.braz[0][2], j.braz[1][2]], pies: [j.pier[0][2], j.pier[1][2]], hombros: [j.S, j.S], cadera: j.H, codos: [j.braz[0][1], j.braz[1][1]] };
}
// equipo que se mueve con la persona: devuelve [{tipo:'c', x, y, r} | {tipo:'l', d}]
function equipo(t, g) {
  const m = g.manos[0], m2 = g.manos[1], e = t.eqFijo || t.eq, out = [];
  const disco = (p, r) => out.push({ tipo: 'c', x: p[0], y: p[1], r });
  if (e === 'barra_mano' || e === 'barra_frente') disco(e === 'barra_frente' ? [(m[0] + m2[0]) / 2, m[1]] : m, 0.2);
  else if (e === 'barra_hombros') disco([g.hombros[0][0] - 0.05, g.hombros[0][1] + 0.02], 0.2);
  else if (e === 'barra_cadera') disco([g.cadera[0], g.cadera[1] - 0.12], 0.2);
  else if (e === 'barra_codos') disco(g.codos ? g.codos[0] : m, 0.2);
  else if (e === 'mancuernas' || e === 'mancuernas_frente') { disco(m, 0.07); if (e === 'mancuernas_frente') disco(m2, 0.07); }
  else if (e === 'mancuerna_mano' || e === 'mancuerna_frente') disco(m, 0.08);
  else if (e === 'kb') disco([m[0], m[1] + 0.08], 0.09);
  else if (e === 'balon') disco([m[0], m[1] - 0.06], 0.12);
  else if (e === 'rueda') disco([m[0], m[1] + 0.1], 0.1);
  else if (e === 'manijas') disco(m, 0.04);
  else if (e === 'barra_jalon') out.push({ tipo: 'l', d: linea([[m[0] - 0.1, m[1]], [m2[0] + 0.1, m2[1]]]) }, { tipo: 'l', d: linea([[0, -2.3], [(m[0] + m2[0]) / 2, m[1]]]) });
  else if (e === 'cable' || e === 'cable_pie') { const p = e === 'cable_pie' ? g.pies[1] : m; out.push({ tipo: 'l', d: linea([t.ancla, p]) }); disco(t.ancla, 0.05); }
  else if (e === 'cable_frente') out.push({ tipo: 'l', d: linea([[-0.7, -0.1], m2]) });
  else if (e === 'cable_tobillo') out.push({ tipo: 'l', d: linea([[-0.7, -0.05], g.pies[1]]) });
  else if (e === 'cables_frente') out.push({ tipo: 'l', d: linea([[-0.85, -1.9], m]) }, { tipo: 'l', d: linea([[0.85, -1.9], m2]) });
  else if (e === 'landmine') out.push({ tipo: 'l', d: linea([[-1.0, 0], m]) });
  else if (e === 'cuerda') out.push({ tipo: 'l', d: `M${r2(m[0])} ${r2(m[1])}Q${r2(m[0] + 0.25)} ${r2(g.pies[0][1] + 0.1)} ${r2(m[0] + 0.5)} ${r2(m[1])}` });
  else if (e === 'cuerdas') out.push({ tipo: 'l', d: `M${r2(m[0])} ${r2(m[1])}Q${r2(m[0] + 0.4)} ${r2(m[1] + 0.3)} ${r2(m[0] + 0.8)} 0` });
  else if (e === 'balon_piso') disco([g.pies[0][0] + 0.12, -0.11], 0.11);
  else if (e === 'balon_fijo') disco(t.balon, 0.11);
  else if (e === 'raqueta') { // mango en la direccion del antebrazo y la cabeza ovalada
    const c = g.codos ? g.codos[0] : g.hombros[0], d = Math.hypot(m[0] - c[0], m[1] - c[1]) || 1, u = [(m[0] - c[0]) / d, (m[1] - c[1]) / d];
    const f = [m[0] + 0.25 * u[0], m[1] + 0.25 * u[1]]; out.push({ tipo: 'l', d: linea([m, f]) }); disco([f[0] + 0.12 * u[0], f[1] + 0.12 * u[1]], 0.12);
  }
  return out;
}
// accesorios fijos (banco, barra fija, maquinas)
function accesorios(t) {
  const r = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.03"/>`, l = (pts) => `<path d="${linea(pts)}" fill="none"/>`;
  const A = {
    banco: r(-0.6, -0.5, 1.15, 0.08) + l([[-0.5, -0.42], [-0.5, 0]]) + l([[0.45, -0.42], [0.45, 0]]),
    banco_largo: r(-0.75, -0.62, 1.6, 0.08) + l([[-0.6, -0.54], [-0.6, 0]]) + l([[0.7, -0.54], [0.7, 0]]),
    banco_inc: l([[0.3, -0.5], [-0.15, -1.15]]) + r(0.1, -0.5, 0.4, 0.07) + l([[0.2, -0.45], [0.2, 0]]),
    banco_dec: l([[0.55, -0.62], [-0.2, -0.38]]) + l([[0.2, -0.55], [0.2, 0]]),
    banco_atras: r(-0.95, -0.5, 0.5, 0.08) + l([[-0.7, -0.42], [-0.7, 0]]),
    banco_hombros: r(-0.85, -0.45, 0.45, 0.08) + l([[-0.62, -0.37], [-0.62, 0]]),
    banco_bajo: r(-0.1, -0.5, 1.0, 0.08) + l([[0.0, -0.42], [0.0, 0]]) + l([[0.8, -0.42], [0.8, 0]]),
    banco_manos: r(0.55, -0.45, 0.45, 0.08) + l([[0.78, -0.37], [0.78, 0]]),
    banco_pies: r(-1.25, -0.45, 0.45, 0.08) + l([[-1.0, -0.37], [-1.0, 0]]),
    banco_atras_manos: r(-0.35, -0.5, 0.4, 0.08) + l([[-0.15, -0.42], [-0.15, 0]]),
    banco_alto: r(-0.55, -1.0, 0.6, 0.08) + l([[-0.3, -0.92], [-0.3, 0]]),
    banco_inc_pecho: l([[0.35, -0.5], [0.85, -1.2]]) + l([[0.5, -0.6], [0.5, 0]]),
    banco45: l([[-0.2, -0.95], [0.25, -0.5]]) + l([[0.0, -0.75], [0.0, 0]]) + l([[-0.55, -0.2], [-0.35, 0]]),
    asiento: r(-0.25, -0.55, 0.45, 0.07) + l([[0, -0.48], [0, 0]]),
    respaldo: l([[-0.25, -0.55], [-0.35, -1.2]]),
    asiento_frente: r(-0.3, -0.58, 0.6, 0.06) + l([[0, -0.52], [0, 0]]),
    asiento_suelo: r(-0.35, -0.32, 0.5, 0.06),
    rodillo_tobillo: '', atril: l([[0.05, -0.75], [0.35, -1.05]]) + l([[0.2, -0.88], [0.2, 0]]),
    pecho_pad: r(0.3, -1.25, 0.06, 0.35),
    prensa: l([[-0.55, -0.45], [-0.9, -0.95]]) + r(-0.55, -0.48, 0.4, 0.06) + l([[0.55, -1.6], [1.05, -0.9]]),
    placa_pies: l([[0.85, -0.9], [0.85, -0.25]]), riel_espalda: l([[-0.3, -1.6], [-0.05, 0]]),
    cajon: r(0.0, -0.45, 0.55, 0.45), cajon_frente: r(0.1, -0.5, 0.55, 0.5), bloques: r(-0.05, -0.45, 0.3, 0.45), escalon: r(-0.1, -0.08, 0.35, 0.08),
    paralelas: l([[-0.3, -1.05], [0.3, -1.05]]) + l([[0.25, -1.05], [0.25, 0]]),
    barra_fija: l([[-0.75, -2.08], [0.75, -2.08]]), barra_fija_lado: l([[-0.4, -2.4], [0.4, -2.4]]),
    bici: '<circle cx="-0.55" cy="-0.33" r="0.33" fill="none"/><circle cx="0.75" cy="-0.33" r="0.33" fill="none"/>' + l([[-0.55, -0.33], [0.15, -0.35], [0.0, -0.95]]) + l([[0.15, -0.35], [0.6, -1.15], [0.75, -0.33]]),
    eliptica: l([[-0.6, 0], [0.8, 0]]) + l([[0.7, 0], [0.55, -1.4]]),
    remo_maq: l([[-0.9, -0.28], [1.2, -0.28]]) + l([[1.1, -0.28], [1.1, -0.6]]),
    piso: l([[-1.0, 0], [1.0, 0]]), agua: l([[-1.2, -0.6], [1.2, -0.6]]),
    saco: '<rect x="0.75" y="-1.75" width="0.32" height="0.95" rx="0.12"/>' + l([[0.91, -1.75], [0.91, -2.2]]),
    escalones: r(0.1, -0.2, 0.6, 0.2) + r(0.4, -0.4, 0.3, 0.2),
  };
  return (t.props || []).map((k) => A[k] || '').join('');
}

const cache = new Map();
// cuadros (posturas) de la animacion: ida y vuelta entre A y B, o ciclo entre "cuadros"
function posturas(t, n) {
  if (t.cuadros) {
    const c = t.cuadros, out = [], m = c.length, tramos = t.ciclo ? m : m - 1;
    for (let k = 0; k < n; k++) {
      const u = (k / n) * tramos, i = Math.floor(u), f = suave(u - i);
      out.push(mezclar(c[i % m], c[(i + 1) % m], f));
    }
    if (!t.ciclo) for (let k = n - 1; k >= 0; k--) out.push(out[k]); // vuelve al inicio
    return out;
  }
  const out = [];
  for (let k = 0; k < n; k++) out.push(mezclar(t.A, t.B, suave(k / (n - 1))));
  for (let k = n - 2; k > 0; k--) out.push(out[k]);
  return out;
}
function armar(id, animada) {
  const nombre = plantillaDe(id), t = nombre && T[nombre];
  if (!t) return null;
  // miniatura: la postura que mejor muestra el ejercicio (a 65 % del movimiento, o la indicada en la plantilla)
  const ps = animada ? posturas(t, 10) : [t.cuadros ? t.cuadros[t.mini ?? Math.floor(t.cuadros.length / 2)] : mezclar(t.A, t.B, t.mini ?? 0.65)];
  const gs = ps.map((p) => geometria(t, p));
  // caja: todos los puntos de todos los cuadros (cuerpo + equipo + accesorios aproximados)
  const xs = [], ys = [];
  for (const g of gs) for (const d of [g.cuerpo, g.lejos]) for (const m of d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) { xs.push(+m[1]); ys.push(+m[2]); }
  for (const g of gs) { xs.push(g.cab[0]); ys.push(g.cab[1] - L.cabeza); }
  const ac = accesorios(t);
  for (const m of ac.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) { xs.push(+m[1]); ys.push(+m[2]); }
  for (const g of gs) for (const e of equipo(t, g)) if (e.tipo === 'c') { xs.push(e.x - e.r, e.x + e.r); ys.push(e.y - e.r, e.y + e.r); }
  ys.push(0);
  let x0 = Math.min(...xs) - 0.25, x1 = Math.max(...xs) + 0.25, y0 = Math.min(...ys) - 0.25, y1 = Math.max(...ys) + 0.08;
  const lado = Math.max(x1 - x0, y1 - y0); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - lado / 2; y0 = cy - lado / 2;
  const vb = `${r2(x0)} ${r2(y0)} ${r2(lado)} ${r2(lado)}`, ancho = r2(lado * 0.045);
  const fijo = gs[0];
  const dur = t.ciclo ? '1.1s' : t.cuadros ? '3.2s' : '2.4s';
  const anim = (attr, vals) => (animada ? `<animate attributeName="${attr}" dur="${dur}" repeatCount="indefinite" values="${vals.join(';')}"/>` : '');
  const eqs = gs.map((g) => equipo(t, g)), f0 = 0;
  const eqSvg = (eqs[f0] || []).map((e, k) => (e.tipo === 'c'
    ? `<circle cx="${r2(e.x)}" cy="${r2(e.y)}" r="${e.r}" fill="none" stroke="${COL.equipo}" stroke-width="${ancho * 0.8}">${anim('cx', eqs.map((q) => r2(q[k].x)))}${anim('cy', eqs.map((q) => r2(q[k].y)))}</circle>`
    : `<path d="${e.d}" fill="none" stroke="${COL.equipo}" stroke-width="${ancho * 0.45}">${anim('d', eqs.map((q) => q[k].d))}</path>`)).join('');
  const g0 = animada ? gs[0] : fijo;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="fig-ej" role="img" aria-label="Demostración del ejercicio">`
    + `<g fill="${COL.accesorio}" stroke="${COL.accesorio}" stroke-width="${ancho * 0.7}" stroke-linecap="round" opacity="0.9">${ac}</g>`
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="${g0.lejos}" stroke="${COL.lejos}" stroke-width="${ancho}">${anim('d', gs.map((g) => g.lejos))}</path>`
    + `<path d="${g0.cuerpo}" stroke="${COL.cuerpo}" stroke-width="${ancho * 1.15}">${anim('d', gs.map((g) => g.cuerpo))}</path></g>`
    + `<circle cx="${r2(g0.cab[0])}" cy="${r2(g0.cab[1])}" r="${L.cabeza}" fill="${COL.cabeza}">${anim('cx', gs.map((g) => r2(g.cab[0])))}${anim('cy', gs.map((g) => r2(g.cab[1])))}</circle>`
    + eqSvg + '</svg>';
}
// SVG fijo (listas) y animado (ficha del ejercicio). null si el ejercicio no tiene figura (p. ej. uno creado por el usuario)
export function miniatura(id) { const k = 'm' + id; if (!cache.has(k)) cache.set(k, armar(id, false)); return cache.get(k); }
export function animacion(id) { const k = 'a' + id; if (!cache.has(k)) cache.set(k, armar(id, true)); return cache.get(k); }
export const tieneFigura = (id) => !!plantillaDe(id);
// icono para listas: la figura si el ejercicio la tiene; si no, el emoji de siempre
export const icono = (id, emoji = '🏋️') => { const m = id && miniatura(id); return m ? `<span class="fig-mini">${m}</span>` : emoji; };
