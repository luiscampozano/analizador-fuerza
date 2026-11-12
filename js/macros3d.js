// v2.54.0 Macros en 3D: la foto del plato con cada alimento marcado y tres columnas 3D (proteína, carbohidratos,
// grasa) divididas por color según lo que aporta cada alimento. Toca un alimento para ver solo lo suyo.
// items: [{ nombre, gramos, usar, base: { kcal, p, c, g } por 100 g, x, y (0-100 en la foto, opcional) }].
// Se dibuja con los gramos que el usuario va ajustando; solo es una vista, no cambia lo que se guarda.
const COLORES = ['#7C5CFF', '#F2C200', '#22D3EE', '#E5533D', '#3DDC97', '#FF8FB1', '#FFA94D', '#9AA5B1', '#4C8DFF', '#C084FC', '#A3E635', '#F87171'];
const MAC = [{ k: 'p', n: 'Proteína', kc: 4 }, { k: 'c', n: 'Carbos', kc: 4 }, { k: 'g', n: 'Grasa', kc: 9 }];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;

export function montar(caja, items, foto = null) {
  const conTags = foto && items.some((a) => Number.isFinite(a.x) && Number.isFinite(a.y));
  caja.innerHTML = `${foto ? `<div class="m3-foto"><img src="${foto}" alt="Foto de tu plato">${conTags ? items.map((a, i) => Number.isFinite(a.x) && Number.isFinite(a.y)
    ? `<button type="button" class="m3-tag" data-m3="${i}" aria-pressed="false" style="left:${Math.min(92, Math.max(8, a.x))}%;top:${Math.min(94, Math.max(6, a.y))}%;border-color:${COLORES[i % COLORES.length]}">${esc(a.nombre.split(' ')[0])}</button>` : '').join('') : ''}</div>` : ''}
    <canvas class="m3-canvas" role="img" aria-label="Columnas 3D de proteína, carbohidratos y grasa, divididas por alimento"></canvas>
    <div class="m3-ley">${items.map((a, i) => `<button type="button" class="m3-chip" data-m3="${i}" aria-pressed="false"><span style="background:${COLORES[i % COLORES.length]}"></span>${esc(a.nombre)}</button>`).join('')}</div>
    <div class="m3-ctrl"><button type="button" class="btn-sec m3-giro" aria-pressed="false">Girar</button><button type="button" class="btn-sec m3-kcal" aria-pressed="false">Ver en kcal</button></div>
    <p class="hint" style="margin:4px 0 0">Toca un alimento para ver solo lo que aporta; arrastra para girar. Las columnas cambian con los gramos que ajustes.</p>`;
  const c = caja.querySelector('.m3-canvas');
  const quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const e = { activo: -1, giro: !quieto, kcal: false, yaw: 0.6, pitch: 0.42, drag: null, alt: MAC.map(() => items.map(() => 0)) };
  // dibuja solo cuando algo se mueve (gira, arrastra, cambian gramos o columnas que aún crecen): no gasta batería quieto
  let raf = 0;
  const pedir = () => { if (!raf) raf = requestAnimationFrame(dibujar); };
  const marcar = () => caja.querySelectorAll('[data-m3]').forEach((b) => { const on = e.activo === +b.dataset.m3; b.classList.toggle('on', on); b.classList.toggle('off', e.activo >= 0 && !on); b.setAttribute('aria-pressed', on); });
  caja.querySelectorAll('[data-m3]').forEach((b) => (b.onclick = () => { e.activo = e.activo === +b.dataset.m3 ? -1 : +b.dataset.m3; marcar(); pedir(); }));
  const bG = caja.querySelector('.m3-giro'), bK = caja.querySelector('.m3-kcal');
  const ponerGiro = (v) => { e.giro = v; bG.classList.toggle('on', v); bG.setAttribute('aria-pressed', v); pedir(); };
  ponerGiro(e.giro);
  bG.onclick = () => ponerGiro(!e.giro);
  bK.onclick = () => { e.kcal = !e.kcal; bK.classList.toggle('on', e.kcal); bK.setAttribute('aria-pressed', e.kcal); bK.textContent = e.kcal ? 'Ver en gramos' : 'Ver en kcal'; pedir(); };
  c.addEventListener('pointerdown', (ev) => { e.drag = [ev.clientX, ev.clientY, e.yaw, e.pitch]; c.setPointerCapture(ev.pointerId); ponerGiro(false); });
  c.addEventListener('pointermove', (ev) => { if (!e.drag) return; e.yaw = e.drag[2] + (ev.clientX - e.drag[0]) * 0.01; e.pitch = Math.max(0.1, Math.min(1.2, e.drag[3] + (ev.clientY - e.drag[1]) * 0.01)); pedir(); });
  const soltar = () => (e.drag = null); c.addEventListener('pointerup', soltar); c.addEventListener('pointercancel', soltar);
  const det = caja.closest('details'); if (det) det.addEventListener('toggle', pedir);
  const lista = caja.closest('#nu-cant') || caja.parentElement; if (lista) { lista.addEventListener('input', pedir); lista.addEventListener('change', pedir); }

  const css = getComputedStyle(document.documentElement), col = (n) => css.getPropertyValue(n).trim();
  const tinta = col('--text-main') || '#fff', suave = col('--text-muted') || '#999', piso = col('--bg-card') || '#222', borde = col('--bg-dark') || '#000';
  const sombra = (h, f) => { const n = parseInt(h.slice(1), 16); return `rgb(${Math.round((n >> 16) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`; };
  const gramosMac = (a, m) => (a.usar && a.gramos > 0 ? a.base[m.k] * a.gramos / 100 : 0);

  function dibujar() {
    raf = 0;
    if (!c.isConnected || c.offsetParent === null) return; // hoja cerrada u oculta, o <details> cerrado: se reanuda al volver a verse
    let falta = false;
    const r = c.getBoundingClientRect(), dp = window.devicePixelRatio || 1;
    if (r.width > 0) {
      const w = Math.round(r.width * dp), h = Math.round(r.height * dp);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const g = c.getContext('2d'); g.clearRect(0, 0, w, h);
      if (e.giro) e.yaw += 0.006;
      const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw), cp = Math.cos(e.pitch), sp = Math.sin(e.pitch), S = Math.min(w * 0.14, h * 0.17), ox = w / 2, oy = h * 0.7;
      const P = (x, y, z) => { const X = x * cy - z * sy, Z = x * sy + z * cy; return [ox + X * S, oy + (-y * cp + Z * sp) * S, y * sp + Z * cp]; };
      const val = (a, m) => gramosMac(a, m) * (e.kcal ? m.kc : 1);
      const tot = MAC.map((m) => items.reduce((s, a) => s + val(a, m), 0));
      const maxT = Math.max(1e-6, ...tot);
      MAC.forEach((m, i) => items.forEach((a, j) => { const obj = (e.activo >= 0 && e.activo !== j ? 0 : val(a, m)) / maxT * 2.6; const d = obj - e.alt[i][j]; if (Math.abs(d) > 0.003) falta = true; e.alt[i][j] += d * 0.15; }));
      g.fillStyle = piso; g.beginPath(); [[-2.9, -0.9], [2.9, -0.9], [2.9, 0.9], [-2.9, 0.9]].forEach(([x, z], k) => { const q = P(x, 0, z); if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.fill();
      const etqs = [], xs = [-2, 0, 2], L = 0.42, orden = [0, 1, 2].sort((p, q) => P(xs[p], 0, 0)[2] - P(xs[q], 0, 0)[2]); // primero lo lejano
      for (const i of orden) {
        let y0 = 0;
        items.forEach((a, j) => {
          const hh = e.alt[i][j]; if (hh < 0.004) { y0 += Math.max(0, hh); return; }
          const y1 = y0 + hh, x = xs[i], cl = COLORES[j % COLORES.length], v = (dx, y, dz) => P(x + dx, y, dz);
          const caras = [
            { p: [v(-L, y0, -L), v(L, y0, -L), v(L, y1, -L), v(-L, y1, -L)], f: 0.75 }, { p: [v(L, y0, -L), v(L, y0, L), v(L, y1, L), v(L, y1, -L)], f: 0.6 },
            { p: [v(L, y0, L), v(-L, y0, L), v(-L, y1, L), v(L, y1, L)], f: 0.75 }, { p: [v(-L, y0, L), v(-L, y0, -L), v(-L, y1, -L), v(-L, y1, L)], f: 0.6 },
            { p: [v(-L, y1, -L), v(L, y1, -L), v(L, y1, L), v(-L, y1, L)], f: 1 }];
          caras.forEach((cf) => (cf.d = cf.p.reduce((s, q) => s + q[2], 0) / 4)); caras.sort((m, n) => m.d - n.d);
          for (const cf of caras) { g.beginPath(); cf.p.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fillStyle = sombra(cl, cf.f); g.fill(); g.strokeStyle = borde; g.lineWidth = dp; g.stroke(); }
          y0 = y1;
        });
        etqs.push([i, y0]);
      }
      // los números y nombres van al final, encima de todas las columnas
      g.textAlign = 'center';
      for (const [i, y0] of etqs) {
        const m = MAC[i], num = e.activo >= 0 && items[e.activo] ? val(items[e.activo], m) : tot[i];
        const q = P(xs[i], y0 + 0.35, 0);
        g.fillStyle = tinta; g.font = `600 ${13 * dp}px system-ui, sans-serif`; g.fillText(`${e.kcal ? Math.round(num) : r1(num)} ${e.kcal ? 'kcal' : 'g'}`, q[0], q[1]);
        const q2 = P(xs[i], 0, 0); g.fillStyle = suave; g.font = `${12 * dp}px system-ui, sans-serif`; g.fillText(m.n, q2[0], q2[1] + (L * S + 26 * dp));
      }
    }
    if (e.giro || e.drag || falta) pedir();
  }
  pedir();
}
