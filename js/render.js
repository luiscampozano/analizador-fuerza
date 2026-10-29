// Genera el video vertical 1080x1920 con esqueleto, flecha de fuerza y graficas, directamente en el celular.
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';

const OW = 1080, OH = 1920, VH = 1290, FPS_OUT = 30;
const C = { bg: '#101218', rosa: '#ec48c8', verde: '#5adc78', blanco: '#f0f0f0', gris: '#969ba5',
  naranja: '#ff9628', azul: '#5aa0ff', rep: 'rgba(90,220,120,0.16)', parcial: 'rgba(255,190,60,0.16)' };
const LINEAS = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]];
const ART = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const FUENTE = 'system-ui, -apple-system, Roboto, "Segoe UI", sans-serif';
// logo para la marca en el panel de telemetria (se carga una vez; si aun no esta listo se dibuja solo el texto)
const LOGO = typeof Image !== 'undefined' ? new Image() : null;
if (LOGO) LOGO.src = new URL('../iconos/logo.png', import.meta.url).href;
const logoListo = () => LOGO && LOGO.complete && LOGO.naturalWidth > 0;
// marca de agua dentro del panel (nunca sobre el video): tenue detras de la grafica y firma clara a la derecha
function marca(ctx, cx, cy) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  if (logoListo()) ctx.drawImage(LOGO, cx - 250, cy - 70, 140, 140);
  ctx.fillStyle = '#ffffff'; ctx.font = `800 96px ${FUENTE}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('FuerzaPro', cx - (logoListo() ? 90 : 230), cy + 4);
  ctx.restore();
}
function firma(ctx, x, y) { // x = borde derecho, y = linea base del nombre
  ctx.save();
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 34px ${FUENTE}`;
  const ancho = ctx.measureText('FuerzaPro').width;
  const g = ctx.createLinearGradient(x - ancho, 0, x, 0); g.addColorStop(0, '#9a82ff'); g.addColorStop(1, '#22d3ee');
  ctx.fillStyle = g; ctx.fillText('FuerzaPro', x, y);
  if (logoListo()) ctx.drawImage(LOGO, x - ancho - 52, y - 36, 44, 44);
  ctx.fillStyle = 'rgba(150,155,165,0.85)'; ctx.font = `400 19px ${FUENTE}`;
  ctx.fillText('fuerzapro.pages.dev · Ing. Luis Campozano, MBA', x, y + 26);
  ctx.restore();
}

function ticks(lo, hi, n = 4) {
  const paso0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(Math.max(paso0, 1e-9)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).reduce((a, b) => (Math.abs(b - paso0) < Math.abs(a - paso0) ? b : a));
  const out = []; for (let v = Math.ceil(lo / paso) * paso; v <= hi + 1e-9; v += paso) out.push(v);
  return out;
}
function suavizar(arr, sigma) { // gaussiano simple para el recorte de camara
  const r = Math.ceil(sigma * 3), k = []; let s = 0;
  for (let i = -r; i <= r; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(w); s += w; }
  return arr.map((_, i) => { let a = 0; for (let j = -r; j <= r; j++) a += arr[Math.min(arr.length - 1, Math.max(0, i + j))] * k[j + r]; return a / s; });
}
function pastilla(ctx, x, y, w, h, texto, color, tam = 34) {
  ctx.fillStyle = 'rgba(20,20,24,0.92)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = color; ctx.font = `700 ${tam}px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + w / 2, y + h / 2 + 1);
}

export function prepararDibujo(fuente, full, res, opciones) {
  const { fps, fuerza, v, potencia, reps, valido, estatico, dirs } = res;
  const n = full.length, W = fuente.videoWidth, H = fuente.videoHeight;
  const esc = OW / W, Hs = H * esc;
  const cy = suavizar(full.map((f) => {
    const ys = [11, 12, 23, 24, 15, 16].map((k) => f[k][1]).filter(Number.isFinite);
    return ys.length ? (ys.reduce((a, b) => a + b) / ys.length) * esc : Hs / 2;
  }), fps * 0.7);
  const sup = cy.map((c) => Math.max(0, Math.min(Math.max(0, Hs - VH), c - VH * 0.48)));
  const idxValidos = valido.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const ultimo = idxValidos.length ? idxValidos[idxValidos.length - 1] : -1;
  const fv = fuerza.filter((x, i) => valido[i] && Number.isFinite(x)).sort((a, b) => a - b);
  const pc = (p) => fv[Math.floor((fv.length - 1) * p)];
  let lo = fv.length ? Math.min(pc(0.01), estatico) : estatico * 0.6, hi = fv.length ? Math.max(pc(0.99), estatico) : estatico * 1.4;
  const pad = 0.12 * (hi - lo + 1); lo -= pad; hi += pad;
  const vv = v.filter((x, i) => valido[i]).map(Math.abs).sort((a, b) => a - b);
  const VMAX = Math.max(0.3, (vv[Math.floor((vv.length - 1) * 0.99)] || 1) * 1.1);
  const TMAX = n / fps;
  const GX0 = 120, GX1 = 1040, FG0 = VH + 250, FG1 = VH + 450, VG0 = VH + 500, VG1 = VH + 610;
  const gx = (t) => GX0 + (GX1 - GX0) * t / TMAX;
  const fy = (x) => FG1 - (FG1 - FG0) * (Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo);
  const vy = (x) => (VG0 + VG1) / 2 - (VG1 - VG0) / 2 * Math.min(VMAX, Math.max(-VMAX, x)) / VMAX;
  const repN = new Array(n).fill(0); reps.forEach((r, k) => { for (let i = r.tope; i < n; i++) repN[i] = k + 1; });

  return function dibujar(ctx, t, imagen) {
    const i = Math.max(0, Math.min(n - 1, Math.round(t * fps)));
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, OW, OH);
    // video recortado siguiendo al atleta
    const s0 = sup[i], yOff = Hs < VH ? (VH - Hs) / 2 : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, OW, VH); ctx.clip();
    if (imagen) ctx.drawImage(imagen, 0, -s0 + yOff, OW, Hs);
    const P = (k) => [full[i][k][0] * esc, full[i][k][1] * esc - s0 + yOff, full[i][k][2]];
    ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = C.rosa;
    for (const [a, b] of LINEAS) {
      const pa = P(a), pb = P(b);
      if (pa[2] > 0.3 && pb[2] > 0.3) { ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); }
    }
    for (const k of ART) {
      const p = P(k); if (!(p[2] > 0.3)) continue;
      ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, 7); ctx.fillStyle = C.verde; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#141414'; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = C.rosa;
    }
    const vivo = valido[i] && Number.isFinite(fuerza[i]);
    const pt = (res.ladoActivo ? (res.puntosLado || [[15, 15], [16, 16]])[res.ladoActivo[i]] : opciones.puntoIdx).map(P);
    const base = [(pt[0][0] + pt[1][0]) / 2, (pt[0][1] + pt[1][1]) / 2];
    if (vivo) {
      const L = 60 + 220 * Math.max(fuerza[i], 0) / Math.max(hi, 1);
      const d = dirs[i], punta = [base[0] + d[0] * L, base[1] + d[1] * L];
      ctx.strokeStyle = C.naranja; ctx.fillStyle = C.naranja; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(punta[0], punta[1]); ctx.stroke();
      const ang = Math.atan2(d[1], d[0]);
      ctx.beginPath(); ctx.moveTo(punta[0] + Math.cos(ang) * 22, punta[1] + Math.sin(ang) * 22);
      ctx.lineTo(punta[0] + Math.cos(ang + 2.4) * 30, punta[1] + Math.sin(ang + 2.4) * 30);
      ctx.lineTo(punta[0] + Math.cos(ang - 2.4) * 30, punta[1] + Math.sin(ang - 2.4) * 30); ctx.fill();
      pastilla(ctx, Math.min(OW - 195, punta[0] + 16), punta[1] - 24, 175, 50, `${Math.round(fuerza[i])} kg`, C.naranja);
    }
    // trayectoria de la barra: estela de los ultimos ~2.5 s y linea vertical de referencia desde el inicio de la rep
    const tr = opciones.trayectoria;
    if (tr) {
      const Q = (k) => [tr.x[k] * esc, tr.y[k] * esc - s0 + yOff];
      const desde = Math.max(0, i - Math.round(2.5 * fps));
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let k = desde + 1; k <= i; k++) {
        if (!Number.isFinite(tr.x[k]) || !Number.isFinite(tr.x[k - 1])) continue;
        const a0 = Q(k - 1), a1 = Q(k), alfa = 0.25 + 0.75 * (k - desde) / Math.max(1, i - desde);
        ctx.strokeStyle = `rgba(255,214,64,${alfa.toFixed(2)})`; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      }
      const rAct = reps.find((r) => r.inicio <= i && i <= r.fin);
      if (rAct && Number.isFinite(tr.x[rAct.inicio])) {
        const q0 = Q(rAct.inicio); ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(q0[0], q0[1] + 40); ctx.lineTo(q0[0], q0[1] - 420); ctx.stroke(); ctx.setLineDash([]);
      }
      if (Number.isFinite(tr.x[i]) && tr.fuente === 'disco') {
        const q = Q(i); ctx.strokeStyle = '#ffd640'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(q[0], q[1], 16, 0, 7); ctx.stroke();
      }
    }
    // alerta de tecnica de la rep en curso (se mantiene hasta que empieza la siguiente)
    if (opciones.alertas) {
      let k = -1; reps.forEach((r, j) => { if (r.inicio <= i) k = j; });
      const al = k >= 0 ? opciones.alertas[k].filter((t) => !t.startsWith('Rep parcial')) : [];
      if (al.length && i <= (reps[k + 1] ? reps[k + 1].inicio : reps[k].fin + fps)) {
        ctx.font = `700 30px ${FUENTE}`;
        const txt = `⚠ Rep ${k + 1}: ${al[0]}`, w = Math.min(OW - 60, ctx.measureText(txt).width + 44);
        ctx.fillStyle = 'rgba(40,20,0,0.88)'; ctx.beginPath(); ctx.roundRect((OW - w) / 2, 24, w, 58, 14); ctx.fill();
        ctx.strokeStyle = C.naranja; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffd2a6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, OW / 2, 54, OW - 90);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }
    if (opciones.angulo) {
      const lado = opciones.angulo.lados[full[i][opciones.angulo.lados[0][1]][2] >= full[i][opciones.angulo.lados[1][1]][2] ? 0 : 1];
      const j = P(lado[1]);
      pastilla(ctx, j[0] - 140, j[1] - 30, 115, 50, `${Math.round(opciones.angulo.valores[i])}°`, C.blanco);
    }
    ctx.restore();

    // panel inferior
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = C.blanco; ctx.font = `800 56px ${FUENTE}`; ctx.fillText(`Reps: ${opciones.repsTotal > reps.length && reps.length && i >= reps[reps.length - 1].fin ? opciones.repsTotal : repN[i]}`, 40, VH + 75); // si corregiste a mas reps, al final se ve tu total
    ctx.fillStyle = C.gris; ctx.font = `400 25px ${FUENTE}`; ctx.fillText(opciones.titulo, 40, VH + 118);
    ctx.textAlign = 'right';
    if (vivo) {
      ctx.fillStyle = C.naranja; ctx.font = `700 36px ${FUENTE}`; ctx.fillText(`Fuerza: ${Math.round(fuerza[i])} kg`, OW - 40, VH + 60);
      ctx.fillStyle = C.azul; ctx.font = `500 29px ${FUENTE}`; ctx.fillText(`Velocidad: ${v[i] >= 0 ? '+' : ''}${v[i].toFixed(2)} m/s`, OW - 40, VH + 102);
      ctx.fillStyle = C.verde; ctx.fillText(`Potencia: ${Math.round(Math.max(0, potencia[i]))} W`, OW - 40, VH + 142);
    } else if (repN[i] && i > ultimo) {
      ctx.fillStyle = C.gris; ctx.font = `700 34px ${FUENTE}`; ctx.fillText('Serie terminada', OW - 40, VH + 60);
    }
    ctx.textAlign = 'left';
    reps.forEach((r, k) => {
      if (r.inicio > i) return;
      const x0 = gx(r.inicio / fps), x1 = gx(Math.min(r.tope, i) / fps);
      ctx.fillStyle = r.parcial ? C.parcial : C.rep; ctx.fillRect(x0, FG0, x1 - x0, FG1 - FG0);
      if (r.tope <= i) {
        const y = r.lado === 'der' ? FG0 - 34 : FG0 - 8; // en ejercicios alternos, un brazo arriba y otro abajo
        const txt = r.lado ? `${k + 1}${r.lado === 'der' ? 'D' : 'I'}` : String(k + 1);
        ctx.fillStyle = C.verde; ctx.font = `600 24px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText(txt, (x0 + x1) / 2, y); ctx.textAlign = 'left';
      }
    });
    marca(ctx, (GX0 + GX1) / 2, (FG0 + VG1) / 2);
    ctx.fillStyle = C.blanco; ctx.font = `500 28px ${FUENTE}`; ctx.fillText('Fuerza aplicada (kg)', GX0, VH + 208);
    ctx.font = `400 23px ${FUENTE}`;
    for (const val of ticks(lo, hi)) {
      const y = fy(val); ctx.strokeStyle = '#32363e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GX0, y); ctx.lineTo(GX1, y); ctx.stroke();
      ctx.fillStyle = C.gris; ctx.textAlign = 'right'; ctx.fillText(String(Math.round(val)), GX0 - 12, y + 8);
    }
    ctx.textAlign = 'left';
    const ys = fy(estatico); ctx.setLineDash([10, 9]); ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(GX0, ys); ctx.lineTo(GX1, ys); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.gris; ctx.textAlign = 'right'; ctx.fillText('estático', GX1, ys - 6); ctx.textAlign = 'left';
    const hasta = idxValidos.filter((k) => k <= i);
    const trazo = (fn, color, ancho) => {
      if (hasta.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.beginPath();
      hasta.forEach((k, j) => { const x = gx(k / fps), y = fn(k); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    };
    trazo((k) => fy(fuerza[k]), C.naranja, 4);
    trazo((k) => vy(v[k]), C.azul, 3);
    if (vivo) { ctx.fillStyle = C.naranja; ctx.beginPath(); ctx.arc(gx(i / fps), fy(fuerza[i]), 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.blanco; ctx.font = `400 23px ${FUENTE}`;
    ctx.fillText(opciones.leyendaVel, GX0, VG0 - 14);
    ctx.strokeStyle = '#464a52'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(GX0, vy(0)); ctx.lineTo(GX1, vy(0)); ctx.stroke();
    ctx.fillStyle = C.gris; ctx.textAlign = 'center';
    const paso = TMAX > 12 ? 5 : 2;
    for (let tt = 0; tt <= TMAX + 1e-9; tt += paso) ctx.fillText(`${tt} s`, gx(tt), OH - 22);
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#dcdcdc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx(i / fps), FG0); ctx.lineTo(gx(i / fps), VG1); ctx.stroke();
    firma(ctx, OW - 40, VH + 196);
  };
}

async function elegirCodec() {
  if (!('VideoEncoder' in window)) return null;
  const base = { width: OW, height: OH, bitrate: 8_000_000, framerate: FPS_OUT };
  for (const [codec, mux] of [['avc1.640028', 'avc'], ['avc1.4d0028', 'avc'], ['avc1.42e028', 'avc'], ['vp09.00.40.08', 'vp9']]) {
    try { if ((await VideoEncoder.isConfigSupported({ ...base, codec })).supported) return { ...base, codec, mux }; } catch (e) { /* sigue */ }
  }
  return null;
}

async function prepararAudio(archivo, duracion) {
  try {
    if (!('AudioEncoder' in window)) return null;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ac.decodeAudioData(await archivo.arrayBuffer());
    ac.close();
    const sr = buf.sampleRate, ch = Math.min(2, buf.numberOfChannels);
    for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: 128000 };
      if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { buf, cfg, mux, duracion };
    }
  } catch (e) { /* video sin audio o formato no soportado */ }
  return null;
}

// Devuelve {blob, tipo, extension}
export async function generarVideo(fuente, archivo, dibujar, { alAvanzar = () => {}, cancelado = () => false } = {}) {
  const lienzo = document.createElement('canvas'); lienzo.width = OW; lienzo.height = OH;
  const ctx = lienzo.getContext('2d');
  const dur = fuente.duration, total = Math.floor(dur * FPS_OUT);
  const codec = await elegirCodec();
  if (!codec) {
    if (!fuente.video) throw new Error('Este navegador no puede crear el video.');
    return grabarEnTiempoReal(fuente.video, dibujar, lienzo, ctx, alAvanzar);
  }
  const audio = await prepararAudio(archivo, dur);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(), fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: codec.mux, width: OW, height: OH, frameRate: FPS_OUT },
    ...(audio ? { audio: { codec: audio.mux, sampleRate: audio.cfg.sampleRate, numberOfChannels: audio.cfg.numberOfChannels } } : {}),
  });
  let error = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { error = e; } });
  enc.configure(codec);
  const tiempos = Array.from({ length: total }, (_, k) => Math.min(k / FPS_OUT, dur - 0.001));
  let k = 0, ultima = null;
  for await (const { imagen } of fuente.iterar(tiempos)) {
    if (cancelado()) throw new Error('cancelado');
    if (error) throw error;
    const t = k / FPS_OUT;
    if (imagen) ultima = imagen;
    dibujar(ctx, t, imagen || ultima);
    const fr = new VideoFrame(lienzo, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / FPS_OUT) });
    enc.encode(fr, { keyFrame: k % (FPS_OUT * 2) === 0 });
    fr.close();
    while (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    if (k % 6 === 0) alAvanzar(k / total);
    k++;
  }
  await enc.flush(); enc.close();
  if (audio) {
    try {
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: () => {} });
      aenc.configure(audio.cfg);
      const { buf } = audio, ch = audio.cfg.numberOfChannels, bloque = 4096;
      const largo = Math.min(buf.length, Math.floor(total / FPS_OUT * buf.sampleRate));
      for (let off = 0; off < largo; off += bloque) {
        const m = Math.min(bloque, largo - off), datos = new Float32Array(m * ch);
        for (let c = 0; c < ch; c++) datos.set(buf.getChannelData(c).subarray(off, off + m), c * m);
        aenc.encode(new AudioData({ format: 'f32-planar', sampleRate: buf.sampleRate, numberOfFrames: m,
          numberOfChannels: ch, timestamp: Math.round(off / buf.sampleRate * 1e6), data: datos }));
      }
      await aenc.flush(); aenc.close();
    } catch (e) { /* sin audio */ }
  }
  muxer.finalize();
  alAvanzar(1);
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), tipo: 'video/mp4', extension: 'mp4' };
}

// Respaldo para navegadores sin WebCodecs: reproduce el video y graba el lienzo en tiempo real
async function grabarEnTiempoReal(video, dibujar, lienzo, ctx, alAvanzar) {
  const tipo = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
  const rec = new MediaRecorder(lienzo.captureStream(FPS_OUT), { mimeType: tipo, videoBitsPerSecond: 8_000_000 });
  const partes = []; rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const listo = new Promise((ok) => { rec.onstop = ok; });
  video.currentTime = 0; await new Promise((ok) => video.addEventListener('seeked', ok, { once: true }));
  rec.start(500);
  const pintar = () => { dibujar(ctx, video.currentTime, video); alAvanzar(video.currentTime / video.duration);
    if (!video.ended && !video.paused) video.requestVideoFrameCallback(pintar); };
  video.muted = true; await video.play(); video.requestVideoFrameCallback(pintar);
  await new Promise((ok) => video.addEventListener('ended', ok, { once: true }));
  dibujar(ctx, video.duration, video); rec.stop(); await listo;
  const ext = tipo.includes('mp4') ? 'mp4' : 'webm';
  return { blob: new Blob(partes, { type: tipo.split(';')[0] }), tipo: tipo.split(';')[0], extension: ext };
}
