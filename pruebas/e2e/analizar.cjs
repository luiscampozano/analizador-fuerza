// Recorrido 1: analizar una serie de sentadilla con video (Analizar → video → datos → Analizar serie → resultados)
const { abrir } = require('./comun.cjs');
(async () => {
  const { p, ok, fin, avisos } = await abrir('analizar', { af_ej: 'sentadilla', af_calidad: 'rapida' });
  try {
    await p.click('[data-vista="v-form"]');
    await p.setInputFiles('#input-video', __dirname + '/sentadilla.mp4');
    await p.fill('#in-peso', '100'); await p.fill('#in-altura', '1.68');
    await p.selectOption('#in-calidad', 'rapida').catch(() => {});
    await p.click('#btn-analizar');
    // espera los resultados; si la app muestra un error (p. ej. no pudo cargar la IA), corta enseguida
    const t0 = Date.now();
    while (!(await p.evaluate(() => document.getElementById('v-resultados').classList.contains('active') && document.getElementById('r-reps').textContent !== '--'))) {
      if (avisos.some((a) => /no pude|error/i.test(a))) throw new Error('la app avisó: ' + avisos.join(' | '));
      if (Date.now() - t0 > 240000) throw new Error('el análisis tardó más de 4 minutos'); await p.waitForTimeout(1000);
    }
    console.log(`(análisis en ${Math.round((Date.now() - t0) / 1000)} s)`);
    const reps = +(await p.textContent('#r-reps'));
    ok(reps >= 2 && reps <= 6, `cuenta las repeticiones (${reps})`);
    const hist = await p.evaluate(() => JSON.parse(localStorage.getItem('af_historial_v1') || '[]'));
    ok(hist.length === 1 && hist[0].reps === reps, 'la serie queda guardada en el historial');
    // v2.53.0 vista 3D experimental: el botón aparece, abre el muñeco y se cierra
    await p.waitForSelector('#btn-3d', { state: 'visible', timeout: 10000 });
    await p.click('#btn-3d');
    await p.waitForTimeout(800);
    const dibujado = await p.evaluate(() => { const c = document.getElementById('v3d-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    if (process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA });
    ok(dibujado > 1000, 'la vista 3D dibuja el muñeco');
    await p.click('#v3d-cerrar');
    ok(await p.evaluate(() => document.getElementById('v3d-modal').style.display === 'none'), 'la vista 3D se cierra');
  } catch (e) { ok(false, 'el recorrido se completó: ' + e.message.split('\n')[0]); }
  await fin();
})();
