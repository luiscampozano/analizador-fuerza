// Informe PDF de una serie, generado en el telefono con jsPDF (sin internet ni servidores).
const BASE = new URL('../vendor/jspdf/', import.meta.url).href;
let cargado = null;
function script(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
function cargarLibreria() {
  if (!cargado) cargado = script(BASE + 'jspdf.umd.min.js').then(() => script(BASE + 'jspdf.plugin.autotable.min.js')).then(() => window.jspdf.jsPDF);
  cargado.catch(() => { cargado = null; });
  return cargado;
}

const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--');
// Las fuentes estandar del PDF no tienen algunos simbolos: se reemplazan por equivalentes
const limpio = (t) => String(t ?? '').replace(/<[^>]+>/g, '')
  .replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~').replace(/−/g, '-').replace(/±/g, '+/-')
  .replace(/✓/g, 'OK').replace(/⚠️?/g, '!').replace(/[«»]/g, '"').replace(/R²/g, 'R2').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').trim();

const C = { oscuro: [11, 11, 18], verde: [91, 63, 224], verdeClaro: [124, 92, 255], naranja: [8, 145, 178], gris: [110, 116, 128], linea: [222, 226, 232], caja: [243, 245, 248], texto: [24, 26, 32] };

async function cuadroDelVideo(video, t) {
  return new Promise((ok) => {
    const v = document.createElement('video'), url = URL.createObjectURL(video.blob);
    let listo = false;
    const fin = (x) => { if (listo) return; listo = true; URL.revokeObjectURL(url); ok(x); };
    setTimeout(() => fin(null), 8000);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    v.addEventListener('loadeddata', () => { v.currentTime = Math.min(Math.max(0, t), (v.duration || t + 1) - 0.05); }, { once: true });
    v.addEventListener('seeked', () => {
      try {
        const W = v.videoWidth, H = v.videoHeight, alto = Math.round(H * 1290 / 1920); // solo la zona del video (sin el panel de graficas)
        const c = document.createElement('canvas'); c.width = 600; c.height = Math.round(600 * alto / W);
        c.getContext('2d').drawImage(v, 0, 0, W, alto, 0, 0, c.width, c.height);
        fin({ datos: c.toDataURL('image/jpeg', 0.85), proporcion: c.height / c.width });
      } catch (e) { fin(null); }
    }, { once: true });
    v.addEventListener('error', () => fin(null), { once: true });
  });
}
function grafica(dibujar, ancho, alto) {
  const c = document.createElement('canvas'); c.dataset.ancho = ancho; c.dataset.alto = alto;
  dibujar(c);
  return c.toDataURL('image/png');
}

export async function crearPDF(inf, { video, graficas, notas, textoTrayectoria, textoCarga, version }) {
  const jsPDF = await cargarLibreria();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, M = 14, ancho = W - 2 * M;
  const { ej: e, s, datos: d } = inf, corporal = e.perfil === 'corporal';
  const fecha = new Date(inf.fecha || Date.now());
  let y = 0;

  // ---- encabezado
  doc.setFillColor(...C.oscuro); doc.rect(0, 0, W, 28, 'F');
  doc.setFillColor(...C.verdeClaro); doc.rect(0, 28, W, 1.2, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('FuerzaPro', M, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(190, 196, 206);
  doc.text('Informe de serie  ·  Ing. Luis Campozano, MBA', M, 20);
  doc.setTextColor(255, 255, 255); doc.setFontSize(9.5);
  doc.text(limpio(fecha.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), W - M, 13, { align: 'right' });
  doc.text(fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }), W - M, 20, { align: 'right' });

  // ---- ejercicio
  y = 39;
  doc.setTextColor(...C.texto); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(limpio(e.nombre), M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C.gris);
  const det = [limpio(textoCarga), e.equipo, e.grupo, d.origen === 'vivo' ? 'grabado en modo en vivo' : null,
    corporal && d.pc ? `peso corporal ${fmt(d.pc, 1)} kg` : null, e.perfil === 'riel' ? `riel a ${fmt(d.alfa)}°` : null].filter(Boolean).join('  ·  ');
  doc.text(limpio(det), M, y + 6);
  y += 12;

  // ---- imagen del video (a la derecha) y KPIs (a la izquierda)
  let img = null;
  if (video) {
    const rep = inf.reps.find((r) => r.n === (inf.stats && inf.stats.mejor)) || inf.reps[0];
    img = await cuadroDelVideo(video, rep && Number.isFinite(rep.tope) ? rep.tope : 1);
  }
  const anchoImg = img ? 62 : 0, anchoKpi = ancho - (img ? anchoImg + 6 : 0);
  if (img) {
    const altoImg = anchoImg * img.proporcion;
    doc.addImage(img.datos, 'JPEG', W - M - anchoImg, y, anchoImg, altoImg);
    doc.setFontSize(7.5); doc.setTextColor(...C.gris);
    doc.text('Rep más rápida, del video con telemetría', W - M - anchoImg / 2, y + altoImg + 4, { align: 'center' });
  }
  const kpis = [
    ['1RM ESTIMADO', s.rm ? (corporal ? `${s.rmLastre >= 0 ? '+' : ''}${fmt(s.rmLastre, 1)} kg lastre` : `${fmt(s.rm, 1)} kg`) : '--', s.pct ? `serie al ${fmt(s.pct)} % del 1RM` : ''],
    ['RPE', limpio(s.rpeTexto ?? '--'), 'esfuerzo (1-10)'],
    ['RIR', limpio(s.rirTexto ?? '--'), 'reps en reserva'],
    ['REPS', String(inf.reps.length), s.validas < inf.reps.length ? `${inf.reps.length - s.validas} parcial(es)` : 'completas'],
    ['MEJOR VELOCIDAD', `${fmt(s.vMejor, 2)} m/s`, 'media concéntrica'],
    ['PÉRDIDA DE VEL.', `${fmt(s.perdida)} %`, `fatiga ${(s.fatiga || '').toLowerCase()}`],
    ['CARGA EFECTIVA', Number.isFinite(inf.estatico) ? `${fmt(inf.estatico)} kg` : '--', e.perfil === 'riel' ? 'componente en el riel' : 'estática'],
    ['FUERZA PICO', `${fmt(s.fPico)} kg`, 'aplicada'],
    ['POTENCIA PICO', `${fmt(s.pPico)} W`, 'mecánica'],
  ];
  const cols = 3, gap = 3, bw = (anchoKpi - gap * (cols - 1)) / cols, bh = 19;
  kpis.forEach((k, i) => {
    const cx = M + (i % cols) * (bw + gap), cy = y + Math.floor(i / cols) * (bh + gap);
    doc.setFillColor(...(i === 0 ? [238, 234, 255] : C.caja)); doc.setDrawColor(...(i === 0 ? C.verde : C.linea));
    doc.roundedRect(cx, cy, bw, bh, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...C.gris); doc.text(k[0], cx + 3, cy + 5);
    doc.setFontSize(i === 0 ? 12.5 : 13); doc.setTextColor(...(i === 0 ? C.verde : C.texto)); doc.text(limpio(k[1]), cx + 3, cy + 12, { maxWidth: bw - 5 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gris); doc.text(limpio(k[2]), cx + 3, cy + 16.5, { maxWidth: bw - 5 });
  });
  let yIzq = y + 3 * (bh + gap) + 2;
  const yImgFin = img ? y + anchoImg * img.proporcion + 8 : yIzq;

  // ---- interpretacion (columna izquierda mientras haya imagen)
  const seccion = (titulo, yy, anchoS = ancho) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.verde); doc.text(titulo.toUpperCase(), M, yy);
    doc.setDrawColor(...C.linea); doc.line(M, yy + 1.6, M + anchoS, yy + 1.6);
    return yy + 6.5;
  };
  const vinetas = (lineas, yy, anchoT) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.texto);
    for (const l of lineas) {
      const partes = doc.splitTextToSize(limpio(l), anchoT - 5);
      if (yy + partes.length * 4.2 > 282) { doc.addPage(); yy = 18; }
      doc.text('•', M + 1, yy); doc.text(partes, M + 5, yy);
      yy += partes.length * 4.2 + 1.2;
    }
    return yy;
  };
  yIzq += 4;
  yIzq = seccion('Interpretación', yIzq, anchoKpi);
  const etiquetas = [s.zona, s.fatiga ? `Fatiga ${s.fatiga.toLowerCase()}` : null, s.recorridoCV <= 8 ? 'Recorrido constante' : null].filter(Boolean);
  if (etiquetas.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.naranja); doc.text(limpio(etiquetas.join('   ·   ')), M, yIzq); yIzq += 5.5;
  }
  yIzq = vinetas(notas, yIzq, anchoKpi);
  y = Math.max(yIzq, yImgFin) + 3;

  // ---- tecnica
  if (y > 250) { doc.addPage(); y = 18; }
  y = seccion('Técnica', y);
  y = vinetas(inf.tec.resumen.length ? inf.tec.resumen.map((t) => '! ' + t) : ['Sin alertas de técnica en esta serie (se revisan profundidad, cadera adelantada, balanceo y diferencia entre brazos cuando el ángulo de cámara lo permite).'], y, ancho);

  // ---- graficas
  y += 3;
  if (y > 200) { doc.addPage(); y = 18; }
  y = seccion('Gráficas', y);
  const conTray = inf.tray.caminos && inf.tray.caminos.length;
  const gw = conTray ? 108 : ancho, gh = 62;
  const vb = grafica((c) => graficas.barras(c, inf.reps.map((r) => r.v), s.mvt || e.mvt, inf.reps.map((r) => r.parcial || r.atipica)), gw * 4, gh * 4);
  doc.addImage(vb, 'PNG', M, y, gw, gh);
  doc.setFontSize(7.5); doc.setTextColor(...C.gris);
  doc.text('Velocidad media por rep (m/s). Verde: la más rápida. Naranja: MVT.', M, y + gh + 4);
  if (conTray) {
    const tw = ancho - gw - 4;
    const tr = grafica((c) => graficas.trayectoria(c, inf.tray.caminos), tw * 4, gh * 4);
    doc.addImage(tr, 'PNG', M + gw + 4, y, tw, gh);
    doc.text(limpio(`Trayectoria ${inf.tray.fuente === 'disco' ? 'del disco' : 'del punto seguido'} (cm).`), M + gw + 4, y + gh + 4, { maxWidth: tw });
  }
  y += gh + 10;
  doc.setFontSize(8.5); doc.setTextColor(...C.texto);
  const tt = doc.splitTextToSize(limpio(textoTrayectoria), ancho); doc.text(tt, M, y); y += tt.length * 4 + 3;

  // ---- tablas
  const tabla = (titulo, cabeza, cuerpo, extra = {}) => {
    if (y > 245) { doc.addPage(); y = 18; }
    y = seccion(titulo, y);
    doc.autoTable({ startY: y, head: [cabeza.map(limpio)], body: cuerpo.map((f) => f.map(limpio)), margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8.3, cellPadding: 1.6, textColor: C.texto, lineColor: C.linea, lineWidth: 0.1 },
      headStyles: { fillColor: C.oscuro, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 249, 251] }, ...extra });
    y = doc.lastAutoTable.finalY + 6;
  };
  const st = inf.stats;
  if (st) {
    const fila = (n, x, dd, u) => (x ? [n, `${fmt(x.media, dd)} ${u}`, `+/-${fmt(x.de, dd)}`, `${fmt(x.cv, 1)} %`, `${fmt(x.min, dd)} - ${fmt(x.max, dd)}`] : null);
    tabla('Estadística de la serie', ['Variable', 'Media', 'Desv. estándar', 'CV', 'Rango'], [
      fila('Velocidad media', st.vars.v, 2, 'm/s'), fila('Velocidad pico', st.vars.vp, 2, 'm/s'), fila('Recorrido', st.vars.rec, 0, 'cm'),
      fila('Fuerza pico', st.vars.f, 0, 'kg'), fila('Potencia pico', st.vars.p, 0, 'W'), fila('Tiempo de subida', st.vars.ts, 2, 's')].filter(Boolean));
    const lineas = [
      `Reps usadas: ${st.n}${st.parciales ? ` (+${st.parciales} parcial(es) o atípica(s), excluidas)` : ''}. Más rápida: rep ${st.mejor}. Más lenta: rep ${st.peor}.`,
      st.pendiente === null ? null : st.pendiente > -0.005 ? 'La velocidad se mantuvo estable de rep a rep.' : `Caída de velocidad: ${fmt(-st.pendiente, 3)} m/s por rep desde la más rápida (R2 = ${fmt(st.r2, 2)}).`,
      st.fatiga3 !== null ? `Últimas reps vs primeras: ${st.fatiga3 >= 0 ? '-' : '+'}${fmt(Math.abs(st.fatiga3), 0)} % de velocidad.` : null,
      st.trabajo ? `Trabajo mecánico total ~ ${fmt(st.trabajo / 1000, 1)} kJ. Tiempo bajo tensión ~ ${fmt(st.tut, 0)} s.` : null,
    ].filter(Boolean);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.texto);
    for (const l of lineas) { const p = doc.splitTextToSize(limpio(l), ancho); doc.text(p, M, y); y += p.length * 4; }
    y += 4;
  }
  tabla('Repetición por repetición', ['Rep', 'Recorrido', 'V. media', 'V. pico', 'Pérdida', 'F. pico', 'P. pico', 'Subida', 'Desvío', 'Técnica'],
    inf.reps.map((r) => [`${r.n}${r.lado ? (r.lado === 'der' ? ' D' : ' I') : ''}${r.parcial ? ' (parcial)' : ''}${r.atipica ? ' (atípica)' : ''}`,
      Number.isFinite(r.rec) ? `${fmt(r.rec)} cm` : '--', `${fmt(r.v, 2)}`, Number.isFinite(r.vp) ? fmt(r.vp, 2) : '--', `${fmt(r.perd)} %`,
      Number.isFinite(r.f) ? `${fmt(r.f)} kg` : '--', Number.isFinite(r.p) ? `${fmt(r.p)} W` : '--', Number.isFinite(r.ts) ? `${fmt(r.ts, 1)} s` : '--',
      Number.isFinite(r.desvio) ? `${fmt(r.desvio, 1)} cm` : '--', (r.alertas || []).filter((t) => !t.startsWith('Rep parcial')).join('; ') || 'OK']),
    { columnStyles: { 9: { cellWidth: 34 } } });
  if ((s.tablaCargas || []).length) {
    const paso = e.perfil === 'polea' ? 2.5 : e.carro === 0 && e.perfil === 'libre' ? 1 : 2.5;
    tabla('Cargas sugeridas según el 1RM estimado', ['Reps objetivo', 'Carga', '% 1RM'],
      s.tablaCargas.map((c) => [`${c.reps} ${c.reps === 1 ? 'rep' : 'reps'}`, `${corporal ? '+' : ''}${fmt(Math.round(c.carga / paso) * paso, paso % 1 ? 1 : 0)} kg${corporal ? ' lastre' : ''}`,
        `${fmt(100 / (1 + (c.reps === 1 ? 0 : c.reps) / 30))} %`]), { tableWidth: 110 });
    if (s.metodos && s.metodos.length) {
      doc.setFontSize(8); doc.setTextColor(...C.gris);
      const p = doc.splitTextToSize(limpio('1RM estimado con: ' + s.metodos.map((m) => `${m.metodo} -> ${fmt(m.valor, 1)} kg`).join('; ') + '.'), ancho);
      doc.text(p, M, y - 2); y += p.length * 3.6 + 2;
    }
  }

  // ---- metodo y pie de pagina
  if (y > 250) { doc.addPage(); y = 18; }
  y = seccion('Cómo se calculó', y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gris);
  const metodo = doc.splitTextToSize(limpio('La IA de pose (MediaPipe) ubica 33 puntos del cuerpo en cada cuadro; la estatura del usuario y las proporciones del cuerpo convierten píxeles a metros. ' +
    'La velocidad y la aceleración salen de la posición filtrada (Savitzky-Golay); la fuerza es F = m·(g·sen(inclinación) + a). El RIR se estima extrapolando la caída de velocidad hasta la velocidad mínima (MVT) ' +
    'y, cuando existe, con la relación carga-velocidad; RPE = 10 - RIR; 1RM por Epley con reps + RIR y por el perfil carga-velocidad. ' +
    'Son estimaciones a partir de video (margen aproximado de 15-20 % en velocidad y potencia); no sustituyen un encoder lineal ni una plataforma de fuerza.'), ancho);
  doc.text(metodo, M, y);

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.linea); doc.line(M, 287, W - M, 287);
    doc.setFontSize(7.5); doc.setTextColor(...C.gris);
    doc.text(limpio(`FuerzaPro ${version ? 'v' + version : ''} · Ing. Luis Campozano, MBA · fuerzapro.pages.dev`), M, 291.5);
    doc.text(`Página ${i} de ${paginas}`, W - M, 291.5, { align: 'right' });
  }
  const nombre = `informe_${e.id}_${fecha.toISOString().slice(0, 16).replace(/[-:T]/g, '')}.pdf`;
  return { blob: doc.output('blob'), nombre };
}
