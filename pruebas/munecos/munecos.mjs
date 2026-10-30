// "Muñecos" 3D: esqueletos sinteticos que hacen cada ejercicio con un numero de reps CONOCIDO y se "filman" desde
// varios angulos de camara (lateral, diagonal, frente, desde arriba/abajo) y con camara en mano, zoom o paneo.
// Los puntos se proyectan como los daria MediaPipe (33 puntos, x/y en pixeles de un video 1080x1920, visibilidad).
// La mano/pierna del lado lejano queda "tapada": menos visibilidad y mas ruido, como en los videos reales.
// Uso: node pruebas/munecos/munecos.mjs [filtro]      (29/10/2026)
import { interpolar, analizar } from '../../js/fisica.js';
import { POR_ID } from '../../js/ejercicios.js';

// ---------------------------------------------------------------- utilidades 3D (x adelante, y arriba, z derecha)
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const rad = (g) => g * Math.PI / 180;
// direccion en el plano del cuerpo: 0° = hacia abajo, 90° = hacia adelante, 180° = arriba
const sag = (g) => [Math.sin(rad(g)), -Math.cos(rad(g)), 0];
// direccion lateral: 0° = abajo, 90° = hacia el costado (lado -1 izquierda, +1 derecha)
const lat = (g, lado) => [0, -Math.cos(rad(g)), lado * Math.sin(rad(g))];
const mix = (a, b, k) => add(mul(a, 1 - k), mul(b, k));

// medidas de una persona de 1,70 m (proporciones antropometricas)
const H = 1.7, TORSO = 0.30 * H, MUSLO = 0.245 * H, PIERNA = 0.246 * H, BRAZO = 0.186 * H, ANTEB = 0.16 * H, HOMBROS = 0.36, CADERAS = 0.24;
const LADOS = [[-1, 11, 13, 15, 23, 25, 27, 29, 31], [1, 12, 14, 16, 24, 26, 28, 30, 32]]; // izquierda = -z

// Cuerpo de pie / apoyado. p: { pelvis, tronco (inclinacion °, + adelante), brazos(lado, hombro) -> [codo, mano],
// piernas(lado, cadera) -> [rodilla, tobillo] }. Devuelve {indice: [x,y,z]}.
function armar({ pelvis, tronco = 0, troncoDir = null, brazos, piernas, pie = 90 }) {
  const j = {}, td = troncoDir || sag(180 - tronco);
  const hc = add(pelvis, mul(td, TORSO)); // centro de hombros
  for (const [lado, h, c, m, ca, r, t, tal, pt] of LADOS) {
    const hom = add(hc, [0, 0, lado * HOMBROS / 2]), cad = add(pelvis, [0, 0, lado * CADERAS / 2]);
    const [codo, mano] = brazos(lado, hom, hc), [rod, tob] = piernas(lado, cad);
    j[h] = hom; j[c] = codo; j[m] = mano; j[ca] = cad; j[r] = rod; j[t] = tob;
    j[tal] = add(tob, mul(sag(pie + 90), 0.06)); j[pt] = add(tob, mul(sag(pie), 0.15));
    for (const k of lado < 0 ? [17, 19, 21] : [18, 20, 22]) j[k] = add(mano, mul(norm(sub(mano, codo)), 0.06));
  }
  const cab = add(hc, mul(td, 0.22));
  j[0] = add(cab, mul(norm(cross(td, [0, 0, 1])), -0.09)); // nariz, un poco adelante de la cabeza
  for (let k = 1; k <= 10; k++) j[k] = add(cab, [0.05, 0.02 * ((k % 3) - 1), 0.03 * (k % 2 ? 1 : -1)]);
  return j;
}
// piernas de pie: el tobillo fijo en el suelo; muslo y pierna con angulos (° desde vertical, + adelante)
function deFrente(muslo, pierna, ancho = 0.12) {
  // devuelve pelvis y funcion piernas tal que los tobillos quedan en x=0, y=0.08
  const d = add(mul(sag(muslo), MUSLO), mul(sag(pierna), PIERNA));
  const pelvis = [-d[0], 0.08 - d[1], 0];
  return { pelvis, piernas: (lado, cad) => { const rod = add(cad, mul(sag(muslo), MUSLO)); const tob = add(rod, mul(sag(pierna), PIERNA)); return [add(rod, [0, 0, lado * (ancho - CADERAS / 2) / 2]), add(tob, [0, 0, lado * (ancho - CADERAS / 2)])]; } };
}
const brazoDos = (hom, mano, afuera, lado) => { // codo entre hombro y mano, desplazado (codos abiertos o atras)
  const m = mix(hom, mano, 0.5), d = Math.max(0, (BRAZO + ANTEB) ** 2 / 4 - (Math.hypot(...sub(mano, hom)) / 2) ** 2);
  return add(m, mul(norm(add(afuera, [0, 0, 0])), Math.sqrt(d) * 1.0));
};

// ---------------------------------------------------------------- ejercicios (f: 0 reposo -> 1 extremo de la rep)
const CENTROS_EXTRA = {};
const EJ = {
  sentadilla: (f) => {
    const { pelvis, piernas } = deFrente(5 + 90 * f, -(5 + 38 * f), 0.18);
    return armar({ pelvis, tronco: 8 + 38 * f, piernas, brazos: (lado, hom) => { const mano = add(hom, [-0.06, 0.02, lado * 0.32]); return [add(hom, [-0.18, -0.2, lado * 0.2]), mano]; } });
  },
  peso_muerto: (f) => { // empieza abajo (barra en el suelo) y sube: f = 0 abajo
    const g = 1 - f, { pelvis, piernas } = deFrente(8 + 55 * g, -(4 + 22 * g), 0.14);
    return armar({ pelvis, tronco: 5 + 65 * g, piernas, brazos: (lado, hom) => { const mano = add(hom, [0.02, -(BRAZO + ANTEB), 0]); return [mix(hom, mano, 0.53), mano]; } });
  },
  peso_muerto_rumano: (f) => {
    const { pelvis, piernas } = deFrente(6 + 18 * f, -(4 + 6 * f), 0.14);
    return armar({ pelvis, tronco: 5 + 75 * f, piernas, brazos: (lado, hom) => { const mano = add(hom, [0.02, -(BRAZO + ANTEB), 0]); return [mix(hom, mano, 0.53), mano]; } });
  },
  curl_mancuernas: (f) => {
    const { pelvis, piernas } = deFrente(3, -3);
    return armar({ pelvis, tronco: 2, piernas, brazos: (lado, hom) => { const codo = add(hom, [0.02, -BRAZO, lado * 0.03]); return [codo, add(codo, mul(sag(12 + 128 * f), ANTEB))]; } });
  },
  curl_martillo: (f) => EJ.curl_mancuernas(f),
  triceps_polea: (f) => {
    const { pelvis, piernas } = deFrente(8, -6);
    return armar({ pelvis, tronco: 12, piernas, brazos: (lado, hom) => { const codo = add(hom, [0.06, -BRAZO, lado * 0.0]); return [codo, add(codo, mul(sag(130 - 120 * f), ANTEB))]; } });
  },
  press_militar: (f) => {
    const { pelvis, piernas } = deFrente(3, -3);
    return armar({ pelvis, tronco: -3, piernas, brazos: (lado, hom) => {
      const mano = add(hom, [0.08 - 0.06 * f, 0.06 + 0.5 * f, lado * 0.12]);
      return [brazoDos(hom, mano, [0.05, -0.6, lado * 1], lado), mano]; } });
  },
  elevaciones_laterales: (f) => {
    const { pelvis, piernas } = deFrente(3, -3);
    return armar({ pelvis, tronco: 5, piernas, brazos: (lado, hom) => { const a = 12 + 75 * f, codo = add(hom, mul(lat(a, lado), BRAZO)); return [codo, add(codo, mul(norm(add(lat(a, lado), [0.15, 0, 0])), ANTEB))]; } });
  },
  remo_barra: (f) => {
    const { pelvis, piernas } = deFrente(28, -14, 0.14);
    return armar({ pelvis, tronco: 50, piernas, brazos: (lado, hom) => {
      const abajo = add(hom, [0.02, -(BRAZO + ANTEB), 0]), arriba = add(hom, [-0.02, -0.33, 0]);
      const mano = mix(abajo, arriba, f); return [brazoDos(hom, mano, [-1, 0.4, lado * 0.4], lado), mano]; } });
  },
  press_banca: (f) => { // acostado boca arriba: la cabeza hacia -x, el pecho mira arriba
    const pelvis = [0.25, 0.45, 0], td = [-1, 0, 0];
    return armar({ pelvis, troncoDir: td, piernas: (lado, cad) => { const rod = add(cad, [MUSLO * 0.95, -0.05, lado * 0.12]); return [rod, add(rod, [0.05, -PIERNA, lado * 0.06])]; },
      brazos: (lado, hom) => { const mano = add(hom, [0.05, 0.1 + 0.42 * f, lado * 0.17]); return [brazoDos(hom, mano, [0.1, -0.7, lado], lado), mano]; } });
  },
  jalon: (f) => { // sentado, f = 0 brazos arriba -> 1 barra al pecho
    const pelvis = [0, 0.5, 0];
    return armar({ pelvis, tronco: -12, piernas: (lado, cad) => { const rod = add(cad, [MUSLO, 0, lado * 0.06]); return [rod, add(rod, [0, -PIERNA, 0])]; },
      brazos: (lado, hom) => { const mano = add(hom, [0.05, 0.55 - 0.5 * f, lado * (0.3 - 0.05 * f)]); return [brazoDos(hom, mano, [-0.3, -0.6, lado], lado), mano]; } });
  },
  hip_thrust: (f) => { // hombros apoyados en un banco, pies en el piso, la cadera sube
    const hom = [-0.5, 0.42, 0], tob = [0.45, 0.08, 0], cad = [0.05, 0.18 + 0.27 * f, 0];
    const td = norm(sub(hom, cad));
    return armar({ pelvis: cad, troncoDir: td, piernas: (lado) => { const t0 = add(tob, [0, 0, lado * 0.14]), c0 = add(cad, [0, 0, lado * CADERAS / 2]);
      const m = mix(c0, t0, 0.5), d = Math.sqrt(Math.max(0, MUSLO ** 2 - (Math.hypot(...sub(t0, c0)) / 2) ** 2)); return [add(m, [0.15 * d, d, 0]), t0]; },
    brazos: (lado, h) => [add(h, [0.05, -0.15, lado * 0.15]), add(h, [0.3, -0.2, lado * 0.2])] });
  },
  dominadas: (f) => { // colgado de la barra (y = 2,25), el cuerpo sube
    const sube = 0.42 * f, hy = 2.25 - BRAZO - ANTEB + 0.05 + sube, pelvis = [0, hy - TORSO, 0];
    return armar({ pelvis, tronco: -5, piernas: (lado, cad) => { const rod = add(cad, [0.05, -MUSLO, lado * 0.02]); return [rod, add(rod, [-0.1, -PIERNA, 0])]; },
      brazos: (lado, hom) => { const mano = [0.02, 2.25, lado * 0.33]; return [brazoDos(hom, mano, [0, -0.3, lado], lado), mano]; } });
  },
  flexiones: (f) => { // plancha mirando al piso, el pecho baja (f = 1 abajo)
    const manos = 0.0, alto = BRAZO + ANTEB - 0.02 - 0.36 * f, hom = [0, alto, 0], tob = [-1.35, 0.1, 0];
    const td = norm(sub(hom, tob)), pelvis = add(tob, mul(td, MUSLO + PIERNA));
    return armar({ pelvis, troncoDir: td, piernas: (lado, cad) => { const t0 = add(tob, [0, 0, lado * 0.1]); return [mix(cad, t0, 0.5), t0]; },
      brazos: (lado, h) => { const mano = [manos + 0.03, 0.02, lado * 0.3]; return [brazoDos(h, mano, [-0.2, 0.3, lado], lado), mano]; } });
  },
  extension_cuadriceps: (f) => { // sentado en la maquina
    const pelvis = [0, 0.55, 0];
    return armar({ pelvis, tronco: -15, piernas: (lado, cad) => { const rod = add(cad, [MUSLO, 0, lado * 0.04]); return [rod, add(rod, mul(sag(10 + 78 * f), PIERNA))]; },
      brazos: (lado, hom) => [add(hom, [0.02, -BRAZO, lado * 0.06]), add(hom, [0.1, -BRAZO - 0.12, lado * 0.12])] });
  },
};

// ---------------------------------------------------------------- mas familias (zancadas, prensa, polea, olimpicos, core)
// rodilla/codo por cinematica inversa: dos segmentos que unen a con c, doblados hacia `pref`
function ik(a, c, L1, L2, pref) {
  const v = sub(c, a), d = Math.min(Math.hypot(...v), L1 + L2 - 1e-4), u = norm(v);
  const largo = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - largo * largo));
  const p = norm(sub(pref, mul(u, dot(pref, u))));
  return add(add(a, mul(u, largo)), mul(p, h));
}
const colgando = (lado, hom) => [add(hom, [0.01, -BRAZO, 0]), add(hom, [0.02, -(BRAZO + ANTEB), 0])];
const mover = (j, d, idx = null) => { const o = {}; for (const k in j) o[k] = idx && !idx.includes(+k) ? j[k] : add(j[k], d); return o; };
const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const zancadaCon = (f, delante, detras, yArriba, yAbajo, tronco) => {
  const pelvis = [0, yArriba - (yArriba - yAbajo) * f, 0];
  return armar({ pelvis, tronco, brazos: colgando, pie: 90, piernas: (lado, cad) => {
    const tob = add(lado < 0 ? delante : detras, [0, 0, lado * 0.1]);
    return [ik(cad, tob, MUSLO, PIERNA, [1, 0, 0]), tob]; } });
};
const POSTURA_PM = (g) => { const { pelvis, piernas } = deFrente(8 + 55 * g, -(4 + 22 * g), 0.14); return { pelvis, piernas, tronco: 5 + 65 * g }; };
const POSTURA_DIP = (d) => { const { pelvis, piernas } = deFrente(8 + 40 * d, -(4 + 20 * d), 0.16); return { pelvis, piernas, tronco: 5 + 10 * d }; };
Object.assign(EJ, {
  zancada: (f) => zancadaCon(f, [0.32, 0.08, 0], [-0.36, 0.1, 0], 0.82, 0.44, 4),
  bulgara_mancuernas: (f) => zancadaCon(f, [0.3, 0.08, 0], [-0.62, 0.48, 0], 0.82, 0.46, 10),
  prensa_45: (f) => { // sentado reclinado; los pies empujan la plataforma en una linea a 45°
    const pelvis = [0, 0.5, 0], d = 0.8 - 0.4 * f;
    return armar({ pelvis, troncoDir: norm([-1, 1, 0]), brazos: (lado, hom) => [add(hom, [0.15, -0.2, lado * 0.1]), add(pelvis, [0.05, 0.05, lado * 0.3])],
      piernas: (lado, cad) => { const tob = add(cad, [d * Math.SQRT1_2, d * Math.SQRT1_2, lado * 0.06]); return [ik(cad, tob, MUSLO, PIERNA, [-0.4, 1, 0]), tob]; } });
  },
  curl_femoral_sentado: (f) => {
    const pelvis = [0, 0.55, 0];
    return armar({ pelvis, tronco: -8, brazos: (lado, hom) => [add(hom, [0.05, -BRAZO, lado * 0.08]), add(hom, [0.25, -BRAZO - 0.05, lado * 0.12])],
      piernas: (lado, cad) => { const rod = add(cad, [MUSLO, 0, lado * 0.04]); return [rod, add(rod, mul(sag(85 - 105 * f), PIERNA))]; } });
  },
  remo_polea: (f) => {
    const pelvis = [0, 0.45, 0];
    return armar({ pelvis, tronco: 18 - 25 * f, piernas: (lado, cad) => { const tob = add(cad, [0.78, -0.02, lado * 0.06]); return [ik(cad, tob, MUSLO, PIERNA, [0, 1, 0]), tob]; },
      brazos: (lado, hom) => { const mano = mix(add(hom, [0.52, -0.12, lado * 0.12]), add(hom, [0.12, -0.3, lado * 0.16]), f); return [ik(hom, mano, BRAZO, ANTEB, [-1, -0.3, lado * 0.4]), mano]; } });
  },
  face_pull: (f) => {
    const { pelvis, piernas } = deFrente(4, -4);
    return armar({ pelvis, tronco: -4, piernas, brazos: (lado, hom) => { const mano = mix(add(hom, [0.53, 0.04, lado * 0.1]), add(hom, [0.12, 0.17, lado * 0.26]), f); return [ik(hom, mano, BRAZO, ANTEB, [-0.6, 0.5, lado]), mano]; } });
  },
  cruce_poleas: (f) => {
    const { pelvis, piernas } = deFrente(8, -6);
    return armar({ pelvis, tronco: 15, piernas, brazos: (lado, hom) => {
      const mano = mix(add(hom, mul(norm([0.25, 0.1, lado * 1]), BRAZO + ANTEB - 0.05)), add(hom, [0.45, -0.25, -lado * 0.1]), f);
      return [ik(hom, mano, BRAZO, ANTEB, [-0.3, 0.3, lado]), mano]; } });
  },
  cargada: (f) => { // del piso a la posicion de rack (barra sobre los hombros) con una flexion para recibir
    let P, k = 0;
    if (f <= 0.7) P = POSTURA_PM(1 - f / 0.7); else { k = (f - 0.7) / 0.3; P = POSTURA_DIP(0.5 * Math.sin(Math.PI * k)); }
    return armar({ ...P, brazos: (lado, hom) => { const cuelga = add(hom, [0.03, -(BRAZO + ANTEB), lado * 0.04]), rack = add(hom, [0.13, 0.02, lado * 0.02]);
      const mano = mix(cuelga, rack, smooth(k)); return [ik(hom, mano, BRAZO, ANTEB, [1, -0.4, lado * 0.3]), mano]; } });
  },
  push_press: (f) => {
    const P = POSTURA_DIP(0.45 * Math.sin(Math.PI * Math.min(1, f / 0.3))), k = smooth((f - 0.15) / 0.85);
    return armar({ ...P, brazos: (lado, hom) => { const mano = add(hom, [0.13 - 0.14 * k, 0.02 + 0.5 * k, lado * (0.06 + 0.06 * k)]); return [ik(hom, mano, BRAZO, ANTEB, [0.6, -0.6, lado * 0.6]), mano]; } });
  },
  abdominales: (f) => { // acostado boca arriba, rodillas dobladas, el tronco sube (encogimiento/sit-up)
    const a = rad(5 + 55 * f), td = [-Math.cos(a), Math.sin(a), 0], nf = cross(td, [0, 0, 1]), pelvis = [0, 0.12, 0];
    return armar({ pelvis, troncoDir: td, piernas: (lado, cad) => { const tob = add(cad, [0.62, -0.04, lado * 0.08]); return [ik(cad, tob, MUSLO, PIERNA, [0, 1, 0]), tob]; },
      brazos: (lado, hom, hc) => [add(add(hom, mul(nf, 0.12)), mul(td, -0.1)), add(hc, add(mul(nf, 0.12), [0, 0, -lado * 0.06]))] });
  },
  elevacion_piernas_colgado: (f) => {
    const pelvis = [0, 2.25 - BRAZO - ANTEB + 0.05 - TORSO, 0];
    return armar({ pelvis, tronco: -3 - 10 * f, brazos: (lado, hom) => { const mano = [0.02, 2.25, lado * 0.28]; return [mix(hom, mano, 0.53), mano]; },
      piernas: (lado, cad) => { const rod = add(cad, mul(sag(5 + 85 * f), MUSLO)); return [rod, add(rod, mul(sag(5 + 80 * f), PIERNA))]; } });
  },
  pantorrilla_pie: (f) => { const { pelvis, piernas } = deFrente(2, -2); return mover(armar({ pelvis, tronco: 2, piernas, brazos: colgando }), [0, 0.08 * f, 0], [...Array(31).keys()]); },
  encogimientos: (f) => { const { pelvis, piernas } = deFrente(3, -3); return mover(armar({ pelvis, tronco: 3, piernas, brazos: colgando }), [0, 0.07 * f, 0], [...Array(23).keys()]); },
  fondos: (f) => { // manos en las paralelas (y = 1,25), el cuerpo baja
    const hy = 1.25 + BRAZO + ANTEB - 0.06 - 0.3 * f, tronco = 8 + 18 * f, td = sag(180 - tronco), pelvis = sub([0.0, hy, 0], mul(td, TORSO));
    return armar({ pelvis, tronco, brazos: (lado, hom) => { const mano = [0.04, 1.25, lado * 0.25]; return [ik(hom, mano, BRAZO, ANTEB, [-1, 0, lado * 0.2]), mano]; },
      piernas: (lado, cad) => { const rod = add(cad, mul(sag(10), MUSLO)); return [rod, add(rod, mul(sag(-70), PIERNA))]; } });
  },
  remo_mancuerna: (f) => { // una mano y una rodilla en el banco; rema el brazo derecho
    const { pelvis, piernas } = deFrente(22, -12, 0.2);
    return armar({ pelvis, tronco: 72, piernas, brazos: (lado, hom) => {
      if (lado < 0) { const mano = add(hom, [0.15, -0.5, 0]); return [mix(hom, mano, 0.5), mano]; }
      const mano = mix(add(hom, [0.03, -(BRAZO + ANTEB) + 0.02, 0.02]), add(hom, [-0.2, -0.3, 0.05]), f); return [ik(hom, mano, BRAZO, ANTEB, [-1, 0.6, 0.2]), mano]; } });
  },
});
Object.assign(CENTROS_EXTRA, { prensa_45: [0.2, 0.7, 0], curl_femoral_sentado: [0.2, 0.6, 0], remo_polea: [0.2, 0.6, 0], abdominales: [0.1, 0.3, 0],
  elevacion_piernas_colgado: [0, 1.4, 0], fondos: [0, 1.2, 0], remo_mancuerna: [0, 0.7, 0], bulgara_mancuernas: [-0.1, 0.8, 0] });

// ---------------------------------------------------------------- variantes con pasos (zancadas reales) y cambio de pierna
// zancada con paso: un pie da el paso adelante, la cadera baja y se vuelve. s1 = paso (0..1), s2 = profundidad (0..1)
function zancadaPaso(s1, s2, ladoDelante, x0 = 0, atrasX = null, adelanteX = null) {
  const pelvis = [x0 + 0.3 * s1, 0.89 - 0.05 * s1 - 0.39 * s2, 0];
  return armar({ pelvis, tronco: 6, brazos: colgando, pie: 90, piernas: (lado, cad) => {
    const tob = lado === ladoDelante ? [adelanteX ?? (x0 + 0.6 * s1), 0.08 + 0.1 * Math.sin(Math.PI * s1) * (1 - s2), lado * 0.1] : [atrasX ?? x0, 0.08 + 0.06 * s2, lado * 0.1];
    return [ik(cad, tob, MUSLO, PIERNA, [1, 0, 0]), tob]; } });
}
Object.assign(EJ, {
  // pierna derecha e izquierda alternadas: paso adelante, bajar, subir y volver al inicio
  'zancada@alterna': (f, e = {}) => { const lado = (e.k ?? 0) % 2 ? 1 : -1; return zancadaPaso(smooth(f / 0.4), smooth((f - 0.4) / 0.6), lado); },
  // zancadas caminando: cada rep avanza 0,6 m; al subir el pie de atras se junta adelante
  zancada_caminando: (f, e = {}) => {
    const lado = (e.k ?? 0) % 2 ? 1 : -1;
    if (!(e.u > 0)) return zancadaPaso(0, 0, lado, 0.6 * (e.hechas ?? 0));
    const base = 0.6 * e.k;
    if (e.u < 0.5) return zancadaPaso(smooth(f / 0.4), smooth((f - 0.4) / 0.6), lado, base);
    const junta = smooth((0.4 - f) / 0.4); // de pie: el pie de atras avanza hasta el de adelante
    return zancadaPaso(1, smooth((f - 0.4) / 0.6), lado, base + 0.3 * junta, base + 0.6 * junta, base + 0.6);
  },
  // bulgara: 3 reps con la pierna izquierda adelante y 3 con la derecha (cambia de pierna a mitad del video)
  'bulgara_mancuernas@2piernas': (f, e = {}) => {
    const der = (e.hechas ?? 0) >= 3 && !((e.k ?? 0) < 3 && e.u > 0);
    const pelvis = [0, 0.82 - 0.36 * f, 0];
    return armar({ pelvis, tronco: 10, brazos: colgando, pie: 90, piernas: (lado, cad) => {
      const delante = der ? lado > 0 : lado < 0, tob = delante ? [0.3, 0.08, lado * 0.1] : [-0.62, 0.48, lado * 0.1];
      return [ik(cad, tob, MUSLO, PIERNA, [1, 0, 0]), tob]; } });
  },
});

EJ.zancada_caminando.sigue = true;
// ---------------------------------------------------------------- camara
let semilla = 11; const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647 - 0.5);
function ruidoSuave(n, paso) { // caminata aleatoria suave (temblor de la mano)
  const out = []; let v = 0, x = 0; for (let i = 0; i < n; i++) { v = 0.9 * v + paso * rnd(); x = 0.98 * x + v; out.push(x); } return out;
}
const CAMARAS = {
  lateral: { yaw: 90 }, 'diagonal 60°': { yaw: 60 }, 'diagonal 45°': { yaw: 45 }, 'casi de frente 20°': { yaw: 20 }, frente: { yaw: 0 },
  'diagonal atrás 135°': { yaw: 135 }, 'lado contrario': { yaw: -90 },
};
const ALTURAS = { 'a la altura del pecho': 0, 'desde arriba': 22, 'desde abajo': -12 };
const MOVIMIENTOS = { fija: {}, 'en mano': { temblor: 1 }, 'zoom/caminar': { zoom: 0.25 }, paneo: { paneo: 20 } };

// Guion de la toma: segmentos de quieto, reps (con su duracion, profundidad y pausas), movimientos chicos de
// acomodarse y caminar. Siempre hay exactamente `reps` reps completas.
const ESCENAS = {
  limpia: (reps) => [{ q: 2 }, ...Array.from({ length: reps }, () => ({ rep: 2.6 })), { q: 2 }],
  'ritmo irregular': (reps) => {
    const g = [{ q: 1.5 }];
    for (let k = 0; k < reps; k++) g.push({ rep: (1.8 + 0.25 * k) * (1 + 0.4 * rnd()), amp: 0.85 + 0.3 * Math.abs(rnd()), arriba: Math.max(0, 0.8 * rnd() + 0.2), abajo: k === reps - 1 ? 1.2 : Math.max(0, 0.6 * rnd()) });
    return [...g, { q: 1.5 }];
  },
  'pocas reps': () => [{ q: 1.2 }, { mini: 1, amp: 0.3 }, { q: 1 }, { rep: 2.6 }, { q: 0.4 }, { rep: 3.4, arriba: 0.6 }, { q: 1 }, { mini: 0.8, amp: 0.25 }, { q: 1.5 }],
  acomodarse: (reps) => [{ q: 1 }, { camina: 1.6, d: 0.7 }, { q: 0.6 }, { mini: 1.2, amp: 0.3 }, { q: 0.5 }, { mini: 1, amp: 0.25 }, { q: 0.8 },
    ...Array.from({ length: reps }, () => ({ rep: 2.4 })), { q: 0.8 }, { mini: 1, amp: 0.3 }, { camina: 2.5, d: 1.3, haciaCamara: true }, { q: 1 }],
};
function guion(segs, fps) { // -> por cuadro: f (0..1), desplazamiento del cuerpo, rep en curso (k) y avance dentro de ella (u)
  const out = []; let ox = 0, oz = 0, k = -1, hechas = 0;
  const em = (f, extra = {}) => out.push({ f, ox, oz, k, u: 0, hechas, ...extra });
  for (const g of segs) {
    if (g.q) for (let i = 0; i < g.q * fps; i++) em(0);
    else if (g.mini) for (let i = 0; i < g.mini * fps; i++) em(g.amp * Math.sin(Math.PI * i / (g.mini * fps)) ** 2);
    else if (g.camina) { const n = g.camina * fps; for (let i = 0; i < n; i++) { const q = (i + 1) / n; out.push({ f: 0.05 * Math.abs(Math.sin(6 * q)), ox: ox + (g.haciaCamara ? 0 : g.d * q), oz: oz + (g.haciaCamara ? g.d * q : 0), hacia: !!g.haciaCamara, k, u: 0, hechas }); }
      if (g.haciaCamara) oz += g.d; else ox += g.d; }
    else if (g.rep) {
      k++;
      const amp = g.amp || 1, sub = 0.4 * g.rep, baj = 0.6 * g.rep, tot = (sub + (g.arriba || 0) + baj) * fps; let i0 = 0; // subir/bajar (sin pausas)
      for (let i = 0; i < sub * fps; i++, i0++) em(amp * Math.sin(Math.PI / 2 * i / (sub * fps)) ** 2, { u: i0 / tot });
      for (let i = 0; i < (g.arriba || 0) * fps; i++, i0++) em(amp, { u: i0 / tot });
      for (let i = 0; i < baj * fps; i++, i0++) em(amp * Math.cos(Math.PI / 2 * i / (baj * fps)) ** 2, { u: i0 / tot });
      hechas++;
      for (let i = 0; i < (g.abajo || 0) * fps; i++) em(0);
    }
  }
  return out;
}
function filmar(fn, { reps, yaw, pitch, mov, fps = 30, centro, escena = 'limpia', id = '' }) {
  // semilla fija por toma: cada toma sale igual siempre (se puede repetir una sola para revisarla)
  semilla = 1 + [...`${id}|${escena}|${yaw}|${pitch}|${JSON.stringify(mov)}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483646, 7);
  const G = guion(ESCENAS[escena](reps), fps), n = G.length, dur = n / fps;
  const tY = ruidoSuave(n, mov.temblor ? 0.06 : 0), tP = ruidoSuave(n, mov.temblor ? 0.05 : 0), tX = ruidoSuave(n, mov.temblor ? 0.004 : 0), tYy = ruidoSuave(n, mov.temblor ? 0.004 : 0);
  const D0 = 3.4, F = 1100 * D0 / H, frames = []; let sigue = 0;
  for (let k = 0; k < n; k++) {
    const t = k / fps, f = G[k].f;
    const j0 = fn(f, G[k]), j = {};
    const ycam = rad(yaw), haciaCam = [Math.cos(ycam), 0, Math.sin(ycam)], lado = [-Math.sin(ycam), 0, Math.cos(ycam)];
    for (const key in j0) j[key] = add(j0[key], add(mul(lado, G[k].ox), mul(haciaCam, G[k].oz)));
    // camara
    const yw = rad(yaw + (mov.paneo ? mov.paneo * (t / dur - 0.5) : 0) + tY[k] * 3), pt = rad(pitch + tP[k] * 3);
    const D = D0 * (mov.zoom ? 1 + mov.zoom * Math.sin(2 * Math.PI * t / dur) : 1);
    // si la persona avanza (zancadas caminando), quien graba la sigue con un poco de retraso
    if (fn.sigue) sigue = sigue + 0.05 * ((j[23][0] + j[24][0]) / 2 - sigue);
    const tgt = add(centro, [tX[k] + (fn.sigue ? sigue : 0), tYy[k], 0]);
    const cam = add(tgt, mul([Math.cos(yw) * Math.cos(pt), Math.sin(pt), Math.sin(yw) * Math.cos(pt)], D));
    const fw = norm(sub(tgt, cam)), der = norm(cross(fw, [0, 1, 0])), arr = cross(der, fw);
    const prof = (p) => dot(sub(p, cam), fw), pc = prof(mix(j[23], j[24], 0.5));
    const puntos = [];
    for (let i = 0; i < 33; i++) {
      const p = j[i] || j[0], v = sub(p, cam), zc = dot(v, fw);
      let vis = 0.95, r = 2;
      const tapado = i >= 11 && prof(p) > pc + 0.07; // detras del cuerpo
      if (tapado) { vis = 0.25 + 0.3 * Math.abs(rnd()) * 2; r = 9; }
      puntos.push([540 + F * dot(v, der) / zc + r * rnd(), 960 - F * dot(v, arr) / zc + r * rnd(), vis]);
    }
    frames.push({ t, puntos: rnd() < -0.49 ? null : puntos }); // ~1 % de cuadros perdidos
  }
  return { frames, dur };
}

// ---------------------------------------------------------------- corrida
const CENTROS = { ...CENTROS_EXTRA, press_banca: [0, 0.6, 0], dominadas: [0, 1.4, 0], flexiones: [-0.6, 0.35, 0], hip_thrust: [0, 0.4, 0], extension_cuadriceps: [0.2, 0.6, 0], jalon: [0, 0.9, 0] };
export { EJ, filmar, CAMARAS, CENTROS, ESCENAS };
const principal = import.meta.url === `file://${process.argv[1]}`;
const filtro = principal ? process.argv[2] || '' : '\u0000';
const REPS = 6, tabla = {}; let total = 0, bien = 0;
for (const id of Object.keys(EJ)) {
  if (!principal || (filtro && !id.includes(filtro))) continue;
  const ej = POR_ID[id.split('@')[0]]; if (!ej) { console.log('no existe', id); continue; }
  tabla[id] = [];
  for (const esc of Object.keys(ESCENAS)) for (const [nc, c] of Object.entries(CAMARAS)) for (const [na, pitch] of Object.entries(ALTURAS)) for (const [nm, mov] of Object.entries(MOVIMIENTOS)) {
    if (na !== 'a la altura del pecho' && nm !== 'fija') continue; // alturas solo con camara fija (menos combinaciones)
    if (esc !== 'limpia' && (na !== 'a la altura del pecho' || nm === 'paneo')) continue;
    const { frames, dur } = filmar(EJ[id], { reps: REPS, yaw: c.yaw, pitch, mov, escena: esc, id, centro: CENTROS[id.split('@')[0]] || [0, 0.95, 0] });
    const meta = esc === 'pocas reps' ? 2 : REPS; // reps reales de la toma
    let n = -1, err = '';
    try {
      const fps = 60, full = interpolar(frames, fps, dur);
      const masa = ej.perfil === 'corporal' ? 70 : 40;
      const res = analizar(full, fps, ej, { masa, alfa: ej.perfil === 'riel' ? 45 : 90, relacion: 1, altura: H, frames, pesoCorporal: 70 });
      n = res.reps.length;
      if (process.env.DET) console.log(`${id} | ${esc} | ${nc} | ${nm} -> ${n}/${meta}  conteo=${JSON.stringify(res.conteo)} t=[${res.reps.map((r) => (r.tope / fps).toFixed(1)).join(' ')}]`);
    } catch (e) { err = e.message; }
    total++; if (n === meta) bien++;
    tabla[id].push({ cam: `${esc} · ${nc} · ${na} · ${nm}`, esc, n, meta, err });
  }
}
for (const [id, filas] of Object.entries(tabla)) {
  const ok = filas.filter((x) => x.n === x.meta).length;
  console.log(`\n${ok === filas.length ? '✓' : '✗'} ${id}: ${ok}/${filas.length} tomas exactas`);
  for (const x of filas) if (x.n !== x.meta) console.log(`    ${x.cam}: app ${x.n} (real ${x.meta})${x.err ? ' (' + x.err.slice(0, 60) + ')' : ''}`);
}
if (principal) console.log(`\nTOTAL ${bien}/${total} tomas exactas`);
