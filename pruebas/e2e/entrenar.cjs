// Recorrido 2: registrar un entrenamiento (Entrenar → empezar → Press de banca 80 kg × 8 → Terminar → Guardar)
const { abrir } = require('./comun.cjs');
(async () => {
  const { p, ok, fin } = await abrir('entrenar');
  try {
    await p.click('[data-vista="v-entrenar"]'); await p.click('#en-empezar');
    await p.fill('#en-buscar', 'press banca'); await p.click('#en-sel-lista .en-sel-item >> nth=0');
    const f = '.en-fila[data-is="0"]';
    await p.fill(f + ' [data-campo="kg"]', '80'); await p.fill(f + ' [data-campo="reps"]', '8'); await p.click(f + ' [data-acc="hecha"]');
    ok((await p.textContent('#en-nser')).trim() === '1' && /640/.test(await p.textContent('#en-vol')), 'la serie marcada suma 1 serie y 640 kg');
    await p.click('#en-terminar'); await p.click('#en-guardar-ok');
    await p.waitForFunction(() => getComputedStyle(document.getElementById('en-inicio')).display !== 'none');
    ok(/Press de banca/.test(await p.textContent('#en-lista')), 'el entrenamiento aparece en la lista');
    await p.reload(); await p.waitForTimeout(1200); await p.click('[data-vista="v-entrenar"]');
    ok(/Press de banca/.test(await p.textContent('#en-lista')), 'sigue guardado después de cerrar y abrir la app');
    ok(/1 día/.test(await p.textContent('#en-calendario')), 'el calendario marca el día entrenado');
  } catch (e) { ok(false, 'el recorrido se completó: ' + e.message.split('\n')[0]); }
  await fin();
})();
