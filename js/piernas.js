// Ejercicios de una pierna (búlgara, zancada fija, step-up): si en el mismo video se hacen las dos piernas una tras
// otra, se detecta el cambio y la serie se parte en dos (una por pierna). (v2.26.0)
//
// En cada rep se mira el fondo (la cadera mas baja): la pierna que trabaja es la de adelante o la que esta sobre el
// cajon, y su rodilla queda MAS ALTA; la de atras baja casi hasta el piso. Se compara la altura de las dos rodillas
// medida en largos de muslo, asi vale desde cualquier angulo y distancia. Si las primeras reps son de un lado y las
// siguientes del otro (cada bloque con 2 reps o mas), hay cambio de pierna. Si alterna rep a rep (zancada alterna),
// no se parte.
const CAD_I = 23, CAD_D = 24, ROD_I = 25, ROD_D = 26, TOB_I = 27, TOB_D = 28;
export const DE_UNA_PIERNA = /^(bulgara_|zancada$|zancada_barra$|zancada_atras$|zancada_curtsy$|step_up$)/;

const ok = (p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[2] > 0.3;
const mediana = (l) => { const a = [...l].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
// Postura de las piernas en el fondo de una rep: posicion de la rodilla y el tobillo izquierdos respecto a los derechos,
// en largos de muslo (no depende de la distancia a la camara ni de si la camara se mueve). Con la misma pierna adelante
// la postura se repite; al cambiar de pierna cambia mucho. m = cuanto mas abajo esta la rodilla derecha que la izquierda.
function postura(full, fps, r) {
  // cada rep va del fondo al tope: el fondo se busca alrededor de su inicio, sin llegar al fondo de la rep siguiente
  let fondo = -1, yMax = -Infinity;
  for (let i = Math.max(0, r.inicio - Math.round(0.3 * fps)); i <= r.tope; i++) {
    const f = full[i]; if (!f || !ok(f[CAD_I]) || !ok(f[CAD_D])) continue;
    const y = (f[CAD_I][1] + f[CAD_D][1]) / 2;
    if (y > yMax) { yMax = y; fondo = i; }
  }
  if (fondo < 0) return null;
  const v = [[], [], [], [], []], w = Math.round(0.15 * fps);
  for (let i = Math.max(0, fondo - w); i <= Math.min(r.tope, fondo + w); i++) {
    const f = full[i]; if (!f || ![CAD_I, CAD_D, ROD_I, ROD_D, TOB_I, TOB_D].every((k) => ok(f[k]))) continue;
    const L = (Math.hypot(f[CAD_I][0] - f[ROD_I][0], f[CAD_I][1] - f[ROD_I][1]) + Math.hypot(f[CAD_D][0] - f[ROD_D][0], f[CAD_D][1] - f[ROD_D][1])) / 2;
    if (!(L > 0)) continue;
    v[0].push((f[ROD_I][0] - f[ROD_D][0]) / L); v[1].push((f[ROD_I][1] - f[ROD_D][1]) / L);
    v[2].push((f[TOB_I][0] - f[TOB_D][0]) / L); v[3].push((f[TOB_I][1] - f[TOB_D][1]) / L);
    v[4].push((f[ROD_D][1] - f[ROD_I][1]) / L);
  }
  if (v[0].length < 3) return null;
  const m = v.map(mediana);
  return { x: m.slice(0, 4), m: m[4] };
}
const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const media = (l) => l[0].map((_, j) => l.reduce((s, x) => s + x[j], 0) / l.length);

// Devuelve null (una sola pierna o no esta claro) o { k, lados: [ladoA, ladoB], corte (s) }:
// las reps 0..k-1 son de una pierna y k..n-1 de la otra
export function cambioDePierna(full, fps, reps) {
  const n = reps.length;
  if (n < 4) return null;
  const ps = reps.map((r) => postura(full, fps, r));
  if (ps.filter(Boolean).length < n - 1) return null; // no se ven bien las piernas
  let mejor = null;
  for (let k = 2; k <= n - 2; k++) {
    const A = ps.slice(0, k).filter(Boolean), B = ps.slice(k).filter(Boolean);
    if (A.length < 2 || B.length < 2) continue;
    const ma = media(A.map((p) => p.x)), mbb = media(B.map((p) => p.x));
    // dispersion dentro de cada bloque: la rep que mas se aparta de su grupo
    const dentro = Math.max(...A.map((p) => dist(p.x, ma)), ...B.map((p) => dist(p.x, mbb)));
    const entre = dist(ma, mbb);
    const nota = entre / (dentro + 0.1);
    if (!mejor || nota > mejor.nota) mejor = { k, nota, entre, dentro, A, B };
  }
  // cambio claro: los dos grupos difieren en mas de medio muslo y bastante mas que lo que varian por dentro
  if (!mejor || mejor.entre < 0.5 || mejor.nota < 2.5) return null;
  // que pierna es cual: la que trabaja tiene la rodilla mas alta en el fondo (se compara un grupo con el otro)
  const mA = mediana(mejor.A.map((p) => p.m)), mB = mediana(mejor.B.map((p) => p.m));
  const lados = mA > mB ? ['izquierda', 'derecha'] : ['derecha', 'izquierda'];
  const corte = ((reps[mejor.k - 1].fin + reps[mejor.k].inicio) / 2) / fps;
  return { k: mejor.k, lados, corte };
}
