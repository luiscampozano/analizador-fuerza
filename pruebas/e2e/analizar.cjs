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
    // v2.55.1 corregir el peso después de analizar: se recalcula la serie con los puntos guardados
    await p.evaluate(() => { window.prompt = () => '50'; });
    await p.click('#btn-peso');
    await p.waitForFunction(() => (JSON.parse(localStorage.getItem('af_historial_v1') || '[]')[0] || {}).carga === 50, null, { timeout: 15000 }).catch(() => {});
    const h2 = await p.evaluate(() => JSON.parse(localStorage.getItem('af_historial_v1') || '[]'));
    ok(h2.length === 1 && h2[0].carga === 50 && h2[0].reps === reps, 'corregir el peso recalcula la serie (100 → 50 kg)');
    ok(!hist[0].rm || !h2[0].rm || h2[0].rm < hist[0].rm, `el 1RM baja con menos peso (${hist[0].rm} → ${h2[0].rm})`);
    // v2.53.0 vista 3D experimental: el botón aparece, abre el muñeco y se cierra
    await p.waitForSelector('#btn-3d', { state: 'visible', timeout: 10000 });
    await p.click('#btn-3d');
    await p.waitForTimeout(800);
    const dibujado = await p.evaluate(() => { const c = document.getElementById('v3d-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    if (process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA });
    ok(dibujado > 1000, 'la vista 3D dibuja el muñeco');
    await p.click('#v3d-cerrar');
    ok(await p.evaluate(() => document.getElementById('v3d-modal').style.display === 'none'), 'la vista 3D se cierra');
    // v2.64.0 «Analizar de nuevo · gratis»: 1 vez por video, vuelve al formulario con el mismo video
    await p.evaluate(() => document.getElementById('r-reanalizar').scrollIntoView({ block: 'center' }));
    if (process.env.CAPTURA2) await p.screenshot({ path: process.env.CAPTURA2 });
    ok(await p.isVisible('#r-reanalizar [data-reanalizar]'), 'aparece «Analizar de nuevo · gratis»');
    await p.click('#r-reanalizar [data-reanalizar]');
    ok(await p.evaluate(() => document.getElementById('v-form').classList.contains('active')), 're-analizar vuelve al formulario con el video cargado');
    await p.click('#btn-analizar');
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('af_historial_v1') || '[]').length === 2 && document.getElementById('v-resultados').classList.contains('active'), null, { timeout: 240000 });
    ok(!(await p.isVisible('#r-reanalizar')), 'después del re-análisis gratis ya no se ofrece otra vez');
  } catch (e) { ok(false, 'el recorrido se completó: ' + e.message.split('\n')[0]); }
  await fin();
})();
