const { chromium } = require('playwright');
const B='http://localhost:8790', T=process.argv[2];
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
(async()=>{
  const br=await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const c=await br.newContext({viewport:{width:412,height:900},deviceScaleFactor:2, permissions:['camera']}); const p=await c.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/gsi|accounts.google|Failed to load resource|wasm|MIME|GSI/.test(m.text()))errs.push(m.text())});
  p.on('dialog', d => { console.log('dialogo:', d.message()); d.accept(); });
  // un analisis viejo en localStorage (v2.15.0) para probar la mudanza
  await p.addInitScript(()=>{ if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x','1'); localStorage.setItem('af_bienvenida','omitida'); localStorage.setItem('af_calidad','rapida');
    localStorage.setItem('af_actividades', JSON.stringify([{ id:'act-viejo', fecha:'2026-10-29T19:00:00.000Z', tipo:'cuerda', ejercicio:'saltar_cuerda', nombre:'Saltar la cuerda', dur:20, kpis:[{label:'Saltos',valor:40,sub:''}], alertas:[], eventos:[], curva:[], contador:'Saltos', total:40, unidad:'saltos/min', ritmo:120 }])); } });
  await p.goto(B+'/index.html'); await p.waitForTimeout(1500);
  // 1) desde Entrenar: fila de boxeo -> 🎥
  await p.click('#en-empezar'); await p.waitForTimeout(300);
  await p.fill('#en-buscar','boxeo'); await p.waitForTimeout(200); await p.locator('#en-sel-lista .en-sel-item').first().click(); await p.waitForTimeout(300);
  const boton=p.locator('.en-fila.en-cardio [data-acc="video"]').first();
  ok(await boton.count()===1,'fila de boxeo con botón 🎥');
  await boton.click(); await p.waitForTimeout(500);
  ok(await p.locator('#v-form').evaluate(e=>e.classList.contains('active')),'abre Analizar: '+(await p.textContent('#aviso')).slice(0,70));
  await p.setInputFiles('#input-video', T+'/sq.mp4');
  await p.evaluate(()=>{document.getElementById('in-altura').value='1.68';document.getElementById('in-calidad').value='rapida';document.getElementById('in-video').checked=false;document.getElementById('btn-analizar').click();});
  await p.waitForFunction(()=>document.getElementById('v-actividad').classList.contains('active'),null,{timeout:1500000});
  ok(true,'resultado de boxeo: '+(await p.$$eval('#act-kpis .kpi-card',x=>x.map(k=>k.innerText.replace(/\n/g,' ')).join(' | '))));
  await p.click('#act-volver'); await p.waitForTimeout(500);
  ok(await p.locator('#v-entrenar').evaluate(e=>e.classList.contains('active')),'Volver lleva al entrenamiento');
  const enlace=await p.locator('.en-analisis').count(); ok(enlace===1,'la fila muestra el resultado: '+(enlace?await p.textContent('.en-analisis'):''));
  await p.screenshot({path:T+'/act2_entreno.png'});
  // 2) historial (incluye el viejo mudado)
  await p.evaluate(()=>{document.querySelector('[data-vista="v-perfil"]').click();}); await p.waitForTimeout(500);
  await p.click('#pf-ir-historial'); await p.waitForTimeout(400); await p.click('[data-p="h-actividades"]'); await p.waitForTimeout(800);
  const n=await p.locator('#h-lista-act [data-act]').count(); ok(n===2,'historial con 2 (nuevo + mudado del 2.15.0): '+n);
  ok(await p.evaluate(()=>localStorage.getItem('af_actividades'))===null,'clave vieja borrada tras la mudanza');
  // 3) modo en vivo para cardio (camara falsa): etiquetas
  await p.evaluate(()=>{document.querySelector('[data-vista="v-form"]').click();}); await p.waitForTimeout(300);
  await p.evaluate(async()=>{ localStorage.setItem('af_ej','cinta'); });
  await p.reload(); await p.waitForTimeout(1500); await p.evaluate(()=>{document.querySelector('[data-vista="v-form"]').click();}); await p.waitForTimeout(300);
  ok(await p.locator('#btn-vivo').evaluate(e=>getComputedStyle(e).display!=='none'),'modo en vivo disponible para cinta');
  await p.click('#btn-vivo'); await p.waitForTimeout(4000);
  const etiquetas=await p.evaluate(()=>[...['vivo-n-u','vivo-v-t','vivo-v-u','vivo-p-t']].map(i=>document.getElementById(i).textContent).join(','));
  ok(etiquetas==='total,Ritmo,por min,Tiempo','etiquetas de cardio en vivo: '+etiquetas);
  ok(await p.locator('#g-vivo-limite').evaluate(e=>e.style.display==='none'),'sin aviso de pérdida de velocidad');
  await p.screenshot({path:T+'/act2_vivo.png'});
  console.log('errores',errs); await br.close();
})();
