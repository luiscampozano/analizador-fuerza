// v2.53.0 Vista 3D experimental: muñeco 3D girable con los puntos 3D que MediaPipe calcula en el teléfono
// (pose_world_landmarks, metros, centro en la cadera). Solo es una vista: los cálculos de la serie no la usan.
import * as almacen from './almacen.js';

const $ = (id) => document.getElementById(id);
const LINKS = [[11, 12, 'c'], [11, 13, 'i'], [13, 15, 'i'], [12, 14, 'd'], [14, 16, 'd'], [11, 23, 'i'], [12, 24, 'd'], [23, 24, 'c'],
  [23, 25, 'i'], [25, 27, 'i'], [24, 26, 'd'], [26, 28, 'd'], [27, 29, 'i'], [29, 31, 'i'], [27, 31, 'i'], [28, 30, 'd'], [30, 32, 'd'], [28, 32, 'd'], [7, 8, 'c']];
const ARTIC = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const VISTAS = { frente: [0, 0.12], lado: [Math.PI / 2, 0.15], diag: [Math.PI / 4, 0.3], arriba: [0, 1.35] };

let estado = null;

// Muestra el botón solo si la serie guardó puntos 3D (las series analizadas desde esta versión).
export async function preparar(boton, id) {
  boton.style.display = 'none'; boton.onclick = null;
  if (!id) return;
  const pose = await almacen.leerPose(id).catch(() => null);
  if (!pose || !pose.wx) return;
  boton.style.display = '';
  boton.onclick = () => abrir(pose);
}

// Suaviza (promedio de 5 cuadros), centra entre caderas y tobillos y apoya el pie más bajo en el piso.
function preparar3D(mundo) {
  return mundo.map((f, i) => {
    if (!f) return null;
    const o = [];
    for (let k = 0; k < 33; k++) {
      let x = 0, y = 0, z = 0, c = 0;
      for (let j = i - 2; j <= i + 2; j++) { const g = mundo[j]; if (g) { x += g[k][0]; y += g[k][1]; z += g[k][2]; c++; } }
      o.push([x / c, y / c, z / c]);
    }
    const piso = Math.max(o[29][1], o[30][1], o[31][1], o[32][1]);
    const cx = (o[23][0] + o[24][0] + o[27][0] + o[28][0]) / 4, cz = (o[23][2] + o[24][2] + o[27][2] + o[28][2]) / 4;
    return o.map((p) => [p[0] - cx, p[1] - piso, p[2] - cz]);
  });
}

function abrir(pose) {
  const mundo = almacen.desempacarMundo(pose);
  if (!mundo) return;
  const ts = Array.from(pose.ts), dur = pose.dur || ts[ts.length - 1] || 1;
  estado = { P: preparar3D(mundo), ts, dur, t: 0, corre: true, prev: performance.now(), yaw: VISTAS.lado[0], pitch: VISTAS.lado[1], giro: false, vista: 'lado', raf: 0, drag: null };
  $('v3d-modal').style.display = 'flex';
  marcar(); $('v3d-play').textContent = '⏸';
  estado.raf = requestAnimationFrame(dibujar);
}

function cerrar() {
  $('v3d-modal').style.display = 'none';
  if (estado) cancelAnimationFrame(estado.raf);
  estado = null;
}

function marcar() {
  document.querySelectorAll('[data-v3d]').forEach((b) => b.classList.toggle('on', !!estado && b.dataset.v3d === estado.vista && !estado.giro));
  $('v3d-giro').classList.toggle('on', !!estado && estado.giro);
}

function indice(t) { // último cuadro con tiempo <= t
  const ts = estado.ts; let lo = 0, hi = ts.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ts[m] <= t) lo = m; else hi = m - 1; }
  return lo;
}

function dibujar(ahora) {
  const e = estado; if (!e) return;
  const dt = Math.min(0.1, (ahora - e.prev) / 1000); e.prev = ahora;
  if (e.corre) { e.t = (e.t + dt) % e.dur; $('v3d-t').value = Math.round(e.t / e.dur * 1000); }
  if (e.giro) e.yaw += 0.012;
  const c = $('v3d-canvas'), r = c.getBoundingClientRect(), dp = window.devicePixelRatio || 1;
  const w = Math.round(r.width * dp), h = Math.round(r.height * dp);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'), css = getComputedStyle(document.documentElement);
  const color = (n) => css.getPropertyValue(n).trim();
  g.clearRect(0, 0, w, h);
  const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw), cp = Math.cos(e.pitch), sp = Math.sin(e.pitch), S = h * 0.42, ox = w / 2, oy = h * 0.86;
  const pr = (p) => { const x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy; const y2 = p[1] * cp - z * sp, z2 = p[1] * sp + z * cp; const k = 3 / (3 + z2); return [ox + x * S * k, oy + y2 * S * k, z2]; };
  g.strokeStyle = color('--border-color'); g.lineWidth = dp;
  for (let q = -0.6; q <= 0.61; q += 0.2) {
    for (const [a, b] of [[[q, 0, -0.6], [q, 0, 0.6]], [[-0.6, 0, q], [0.6, 0, q]]]) { const A = pr(a), B = pr(b); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
  }
  const p = e.P[indice(e.t)];
  if (p) {
    const Q = p.map(pr);
    const segs = LINKS.map(([a, b, l]) => ({ a, b, l, z: (Q[a][2] + Q[b][2]) / 2 })).sort((m, n) => n.z - m.z);
    g.lineCap = 'round';
    const col = { i: color('--accent-blue'), d: color('--accent-orange'), c: color('--text-muted') };
    for (const s of segs) { g.strokeStyle = col[s.l]; g.lineWidth = (s.l === 'c' ? 4 : 6) * dp; g.beginPath(); g.moveTo(Q[s.a][0], Q[s.a][1]); g.lineTo(Q[s.b][0], Q[s.b][1]); g.stroke(); }
    g.fillStyle = color('--text-main');
    for (const k of ARTIC) { g.beginPath(); g.arc(Q[k][0], Q[k][1], (k === 0 ? 7 : 3.5) * dp, 0, 7); g.fill(); }
  }
  e.raf = requestAnimationFrame(dibujar);
}

export function iniciar() {
  const c = $('v3d-canvas');
  $('v3d-cerrar').onclick = cerrar;
  $('v3d-play').onclick = () => { if (!estado) return; estado.corre = !estado.corre; $('v3d-play').textContent = estado.corre ? '⏸' : '▶'; };
  $('v3d-giro').onclick = () => { if (!estado) return; estado.giro = !estado.giro; estado.vista = ''; marcar(); };
  document.querySelectorAll('[data-v3d]').forEach((b) => { b.onclick = () => { if (!estado) return; estado.vista = b.dataset.v3d; [estado.yaw, estado.pitch] = VISTAS[estado.vista]; estado.giro = false; marcar(); }; });
  $('v3d-t').oninput = () => { if (!estado) return; estado.t = $('v3d-t').value / 1000 * estado.dur; estado.corre = false; $('v3d-play').textContent = '▶'; };
  c.addEventListener('pointerdown', (ev) => { if (!estado) return; estado.drag = [ev.clientX, ev.clientY, estado.yaw, estado.pitch]; c.setPointerCapture(ev.pointerId); estado.giro = false; estado.vista = ''; marcar(); });
  c.addEventListener('pointermove', (ev) => { const d = estado && estado.drag; if (!d) return; estado.yaw = d[2] + (ev.clientX - d[0]) * 0.01; estado.pitch = Math.max(-0.2, Math.min(1.45, d[3] + (ev.clientY - d[1]) * 0.01)); });
  const soltar = () => { if (estado) estado.drag = null; };
  c.addEventListener('pointerup', soltar); c.addEventListener('pointercancel', soltar);
}
