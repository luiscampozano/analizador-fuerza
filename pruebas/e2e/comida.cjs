// Recorrido 3: anotar una comida (Nutrición → Desayuno → buscar «arroz» → 1 taza → Agregar → kcal del día)
const { abrir } = require('./comun.cjs');
(async () => {
  const { p, ok, fin } = await abrir('comida');
  try {
    await p.click('[data-vista="v-nutricion"]'); await p.click('#nu-comidas .nu-agregar[data-c="desayuno"]');
    await p.fill('#nu-buscar', 'arroz'); await p.waitForFunction(() => /Arroz blanco/.test(document.getElementById('nu-res').textContent));
    await p.click('#nu-res .en-sel-item >> nth=0'); await p.waitForSelector('#nu-g', { state: 'visible' });
    const g = +(await p.inputValue('#nu-g'));
    await p.click('#nu-ok'); await p.waitForFunction(() => getComputedStyle(document.getElementById('nu-hoja')).display === 'none' && /Arroz blanco/.test(document.getElementById('nu-comidas').textContent));
    const kcal = async () => { const m = (await p.textContent('#nu-resumen')).match(/(\d[\d.]*)\s*kcal/); return m ? +m[1].replace('.', '') : -1; };
    const k1 = await kcal();
    ok(g > 0 && Math.abs(k1 - Math.round(130 * g / 100)) <= 1, `suma las calorías del día (${g} g de arroz = ${k1} kcal)`);
    ok(/Arroz blanco/.test(await p.textContent('#nu-comidas')), 'el alimento aparece en el desayuno');
    await p.waitForTimeout(800); await p.reload(); await p.waitForTimeout(1500); await p.click('[data-vista="v-nutricion"]');
    await p.waitForFunction(() => /kcal/.test(document.getElementById('nu-resumen').textContent)).catch(() => {});
    ok((await kcal()) === k1, 'sigue guardado después de cerrar y abrir la app');
  } catch (e) { ok(false, 'el recorrido se completó: ' + e.message.split('\n')[0]); }
  await fin();
})();
