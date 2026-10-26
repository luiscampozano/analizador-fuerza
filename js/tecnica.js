// Alertas de tecnica basadas en los 33 puntos de la pose. Son avisos orientativos: dependen del angulo de camara,
// por eso cada regla primero comprueba que la vista permita medir (si no, no dice nada).
const SENTADILLA = new Set(['sentadilla', 'sentadilla_frontal', 'sentadilla_box', 'sentadilla_pausa', 'sentadilla_goblet',
  'sentadilla_mancuernas', 'sentadilla_sumo', 'smith_sentadilla', 'hack', 'belt_squat', 'sentadilla_corporal', 'thruster']);
const BISAGRA = new Set(['peso_muerto', 'peso_muerto_sumo', 'peso_muerto_hex', 'peso_muerto_deficit']);
const CURL = new Set(['curl', 'curl_z', 'curl_mancuernas', 'curl_alterno', 'curl_martillo', 'curl_martillo_alterno', 'curl_polea']);
const GRUPOS_BRAZOS = new Set(['Pecho', 'Hombros', 'Espalda', 'Brazos']);

const vis = (f, k) => f[k][2] || 0;
// lado del cuerpo mas visible (en una toma de lado, el lado lejano se ve poco)
function ladoVisible(full, i0, i1, idx) {
  let a = 0, b = 0;
  for (let i = i0; i <= i1; i++) { a += idx[0].reduce((s, k) => s + vis(full[i], k), 0); b += idx[1].reduce((s, k) => s + vis(full[i], k), 0); }
  return a >= b ? 0 : 1;
}
const cm = (px, mPx, i) => px * mPx[i] * 100;

export function revisarTecnica(full, fps, res, ej, mPx) {
  const alertas = res.reps.map(() => []);
  const n = full.length;
  const medianaLargo = (fn) => { const v = []; for (let i = 0; i < n; i += 3) { const x = fn(i); if (Number.isFinite(x)) v.push(x); } v.sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || NaN; };

  // vista de lado: ancho de hombros y de caderas en la imagen pequeno frente al largo del torso
  const anchoRel = medianaLargo((i) => {
    const f = full[i], torso = Math.hypot((f[11][0] + f[12][0] - f[23][0] - f[24][0]) / 2, (f[11][1] + f[12][1] - f[23][1] - f[24][1]) / 2);
    return (Math.abs(f[11][0] - f[12][0]) + Math.abs(f[23][0] - f[24][0])) / 2 / (torso || NaN);
  });
  const deLado = Number.isFinite(anchoRel) && anchoRel < 0.3;
  res.reps.forEach((r, k) => {
    if (r.parcial) alertas[k].push('Rep parcial: recorrido corto');
    const ini = r.inicio, tope = r.tope;
    if (tope - ini < 3) return;

    // ---- profundidad en sentadilla (cadera vs rodilla en el punto mas bajo)
    if (SENTADILLA.has(ej.id)) {
      const L = ladoVisible(full, ini, ini, [[23, 25], [24, 26]]), hip = 23 + L, rod = 25 + L;
      const f = full[ini];
      if (vis(f, hip) > 0.5 && vis(f, rod) > 0.5) {
        const muslo = Math.hypot(f[hip][0] - f[rod][0], f[hip][1] - f[rod][1]);
        const musloPie = medianaLargo((i) => Math.hypot(full[i][hip][0] - full[i][rod][0], full[i][hip][1] - full[i][rod][1]));
        // solo con la camara de lado: de frente, desde atras o en diagonal la perspectiva hace ver la cadera mas alta
        // de lo que esta. De lado los hombros (y las caderas) se superponen en la imagen.
        if (deLado && vis(f, hip) > 0.7 && vis(f, rod) > 0.7 && muslo > 0.6 * musloPie) {
          const sobre = cm(f[rod][1] - f[hip][1], mPx, ini); // > 0: cadera por encima de la rodilla
          if (sobre > 5) alertas[k].push(`Faltó profundidad (cadera ~${Math.round(sobre)} cm sobre la rodilla)`);
        }
      }
    }

    // ---- cadera que sube antes que los hombros (sentadilla y peso muerto)
    if (SENTADILLA.has(ej.id) || BISAGRA.has(ej.id)) {
      const L = ladoVisible(full, ini, tope, [[11, 23], [12, 24]]), hom = 11 + L, hip = 23 + L;
      const k40 = ini + Math.max(2, Math.round((tope - ini) * 0.4));
      const a = full[ini], b = full[Math.min(tope, k40)];
      if (vis(a, hip) > 0.5 && vis(a, hom) > 0.5) {
        const subeCadera = cm(a[hip][1] - b[hip][1], mPx, ini), subeHombro = cm(a[hom][1] - b[hom][1], mPx, ini);
        if (subeCadera > 8 && subeCadera > 1.8 * Math.max(subeHombro, 1)) alertas[k].push('La cadera subió antes que los hombros');
      }
    }

    // ---- balanceo del torso en curl (impulso)
    if (CURL.has(ej.id)) {
      const L = ladoVisible(full, ini, tope, [[11, 23], [12, 24]]), hom = 11 + L, hip = 23 + L;
      const desde = Math.max(0, ini - Math.round(0.3 * fps));
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (let i = desde; i <= tope; i++) {
        const dx = full[i][hom][0] - full[i][hip][0], dy = full[i][hom][1] - full[i][hip][1];
        if (!Number.isFinite(dx)) continue;
        minx = Math.min(minx, dx); maxx = Math.max(maxx, dx); miny = Math.min(miny, dy); maxy = Math.max(maxy, dy);
      }
      const mov = cm(Math.hypot(maxx - minx, maxy - miny), mPx, ini);
      if (mov > 10) alertas[k].push(`Balanceaste el torso (~${Math.round(mov)} cm de impulso)`);
    }

    // ---- asimetria entre brazos (ejercicios con las dos manos a la vez, vistos de frente)
    if (ej.punto === 'manos' && !ej.alterno && !ej.unilateral && GRUPOS_BRAZOS.has(ej.grupo)) {
      let vm = 0; for (let i = ini; i <= tope; i++) vm += Math.min(vis(full[i], 15), vis(full[i], 16));
      if (vm / (tope - ini + 1) > 0.7) {
        const d = (m, h) => cm(Math.hypot((full[tope][m][0] - full[tope][h][0]) - (full[ini][m][0] - full[ini][h][0]),
          (full[tope][m][1] - full[tope][h][1]) - (full[ini][m][1] - full[ini][h][1])), mPx, ini);
        const izq = d(15, 11), der = d(16, 12), dif = Math.abs(izq - der);
        if (dif > 5 && dif > 0.2 * Math.max(izq, der)) alertas[k].push(`Brazo ${izq < der ? 'izquierdo' : 'derecho'} recorrió ~${Math.round(dif)} cm menos`);
      }
    }
  });

  // resumen: cada tipo de alerta con las reps donde aparecio
  const tipos = new Map();
  alertas.forEach((as, k) => as.forEach((a) => {
    const clave = a.replace(/\s*\(.*\)$/, '').replace(/~\d+ cm/, '').replace(/\s+/g, ' ').trim();
    if (!tipos.has(clave)) tipos.set(clave, []);
    tipos.get(clave).push(res.reps[k].n || k + 1);
  }));
  const resumen = [...tipos.entries()].map(([t, reps]) => `${t}: ${reps.length === res.reps.length ? 'en todas las reps' : `rep${reps.length > 1 ? 's' : ''} ${reps.join(', ')}`}`);
  return { porRep: alertas, resumen };
}
