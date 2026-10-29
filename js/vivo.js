// Modo en vivo: camara + IA de pose en tiempo real. Cuenta reps, muestra la velocidad y avisa (pitido, vibracion y voz)
// cuando la perdida de velocidad pasa el limite elegido. La serie se graba y al terminar se analiza completa.
import { cargarModelo, detectarEnVivo } from './pose.js';
import { interpolar, analizar } from './fisica.js';

const $ = (id) => document.getElementById(id);
const LINEAS = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
let est = null; // estado de la sesion en vivo

export function detener() {
  if (!est) return;
  est.activo = false;
  try { if (est.rec && est.rec.state !== 'inactive') { est.descartar = true; est.rec.stop(); } } catch (e) { /* nada */ }
  if (est.stream) est.stream.getTracks().forEach((t) => t.stop());
  if (est.wake) est.wake.release().catch(() => {});
  if (est.audio) est.audio.close().catch(() => {});
  try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
  clearInterval(est.reloj); clearInterval(est.cuentaId);
  const v = $('vivo-video'); v.srcObject = null;
  est = null;
}

function hablar(texto, forzar = false) {
  if (!est || est.voz === 'no' || (est.voz === 'aviso' && !forzar)) return;
  try {
    const u = new SpeechSynthesisUtterance(texto);
    const voz = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
    if (voz) u.voice = voz;
    u.lang = voz ? voz.lang : 'es-ES'; u.rate = 1.1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* sin voz */ }
}
function pitar(veces = 1, frec = 880) {
  if (!est || !est.audio) return;
  const ac = est.audio;
  for (let k = 0; k < veces; k++) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + k * 0.22;
    o.frequency.value = frec; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.start(t); o.stop(t + 0.18);
  }
}

async function abrirCamara(frente) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Este navegador no permite usar la cámara. Usa Chrome actualizado.');
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false,
      video: { facingMode: frente ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
  } catch (e) {
    throw new Error(e.name === 'NotAllowedError' ? 'Necesito permiso para usar la cámara. Actívalo en los ajustes del navegador para esta página.'
      : 'No pude abrir la cámara: ' + (e.message || e.name));
  }
}

export async function abrir({ ej, datos, calidad, alTerminar }) {
  detener();
  est = { activo: true, ej, datos, alTerminar, grabando: false, frames: [], frente: false, voz: $('vivo-voz').value,
    anunciadas: 0, avisado: false, ultimoN: 0 };
  const yo = est;
  $('vivo-n').textContent = '0'; $('vivo-v').textContent = '--'; $('vivo-p').textContent = '--';
  $('vivo-aviso').style.display = 'none'; $('vivo-cuenta').style.display = 'none';
  $('vivo-accion').textContent = '▶ Empezar serie'; $('vivo-accion').disabled = true;
  $('vivo-estado').textContent = 'Abriendo la cámara…';
  const video = $('vivo-video'), lienzo = $('vivo-canvas'), ctx = lienzo.getContext('2d');

  const conectar = async () => {
    if (yo.stream) yo.stream.getTracks().forEach((t) => t.stop());
    yo.stream = await abrirCamara(yo.frente);
    video.srcObject = yo.stream;
    video.style.transform = lienzo.style.transform = yo.frente ? 'scaleX(-1)' : '';
    await video.play().catch(() => {});
  };
  await conectar();
  if (!est || est !== yo) return;
  $('vivo-estado').textContent = 'Cargando la IA de pose…';
  // en vivo se usa el modelo rapido para ir fluido en cualquier celular (el analisis final usa la precision elegida)
  const { lm } = await cargarModelo(calidad === 'maxima' ? 'normal' : 'rapida');
  if (!est || est !== yo) return;
  try { yo.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* sin bloqueo de pantalla */ }
  $('vivo-accion').disabled = false;
  $('vivo-estado').textContent = 'Colócate de lado con el cuerpo completo a la vista.';

  // bucle de deteccion: un cuadro de camara -> pose -> dibujo
  const cuadro = () => {
    if (!est || est !== yo || !yo.activo) return;
    if (video.readyState >= 2 && video.videoWidth) {
      if (lienzo.width !== video.videoWidth) { lienzo.width = video.videoWidth; lienzo.height = video.videoHeight; }
      let puntos = null;
      try { puntos = detectarEnVivo(lm, video); } catch (e) { /* cuadro perdido */ }
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      if (puntos) {
        const g = Math.max(3, lienzo.width / 220);
        ctx.lineWidth = g; ctx.strokeStyle = '#ec48c8'; ctx.lineCap = 'round';
        for (const [a, b] of LINEAS) if (puntos[a][2] > 0.4 && puntos[b][2] > 0.4) { ctx.beginPath(); ctx.moveTo(puntos[a][0], puntos[a][1]); ctx.lineTo(puntos[b][0], puntos[b][1]); ctx.stroke(); }
        ctx.fillStyle = '#5adc78';
        for (const k of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) if (puntos[k][2] > 0.4) { ctx.beginPath(); ctx.arc(puntos[k][0], puntos[k][1], g * 1.6, 0, 7); ctx.fill(); }
      }
      if (!yo.grabando && !yo.cuentaId) {
        const completo = puntos && [11, 12, 23, 24, 27, 28].filter((k) => puntos[k][2] > 0.5).length >= 4;
        $('vivo-estado').textContent = completo ? '✓ Te veo completo. Pulsa Empezar.' : 'Colócate de lado con el cuerpo completo a la vista.';
      }
      if (yo.grabando) yo.frames.push({ t: (performance.now() - yo.t0) / 1000, puntos });
    }
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(cuadro); else requestAnimationFrame(cuadro);
  };
  cuadro();

  $('vivo-camara').onclick = async () => {
    if (yo.grabando) return;
    yo.frente = !yo.frente;
    try { await conectar(); } catch (e) { alert(e.message); }
  };
  $('vivo-voz').onchange = () => { yo.voz = $('vivo-voz').value; };
  $('vivo-salir').onclick = () => { detener(); document.querySelector('.nav button[data-vista="v-form"]').click(); };
  $('vivo-accion').onclick = () => (yo.grabando ? terminar(yo) : empezar(yo));
}

function empezar(yo) {
  if (yo.cuentaId) return;
  try { yo.audio = yo.audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sin audio */ }
  let n = 5;
  const c = $('vivo-cuenta'); c.style.display = 'flex'; c.textContent = n;
  $('vivo-accion').textContent = 'Cancelar';
  $('vivo-accion').onclick = () => { clearInterval(yo.cuentaId); yo.cuentaId = null; c.style.display = 'none';
    $('vivo-accion').textContent = '▶ Empezar serie'; $('vivo-accion').onclick = () => (yo.grabando ? terminar(yo) : empezar(yo)); };
  hablar('Colócate', true);
  yo.cuentaId = setInterval(() => {
    n--;
    if (n > 0) { c.textContent = n; if (n <= 3) { pitar(1, 660); hablar(String(n)); } return; }
    clearInterval(yo.cuentaId); yo.cuentaId = null; c.style.display = 'none';
    pitar(1, 990); hablar('¡Ya!', true);
    iniciarGrabacion(yo);
  }, 1000);
}

function iniciarGrabacion(yo) {
  const tipo = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!tipo) { alert('Este navegador no puede grabar la cámara.'); return; }
  yo.partes = []; yo.tipo = tipo;
  yo.rec = new MediaRecorder(yo.stream, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
  yo.rec.ondataavailable = (e) => e.data.size && yo.partes.push(e.data);
  yo.rec.start(1000);
  yo.frames = []; yo.t0 = performance.now(); yo.grabando = true; yo.anunciadas = 0; yo.avisado = false;
  $('vivo-accion').textContent = '■ Terminar serie';
  $('vivo-accion').onclick = () => terminar(yo);
  $('vivo-estado').textContent = '● Grabando…';
  const limite = () => parseFloat($('vivo-limite').value) || 0;
  yo.reloj = setInterval(() => {
    if (!yo.grabando || yo.frames.length < 20) return;
    const dur = yo.frames[yo.frames.length - 1].t;
    let res;
    try {
      const fps = 30, full = interpolar(yo.frames, fps, dur);
      res = analizar(full, fps, yo.ej, { masa: yo.datos.masa, alfa: yo.datos.alfa, relacion: yo.datos.relacion, altura: yo.datos.altura, sinAngulos: true }); // en vivo: solo el contador principal (estable mientras crece el video)
    } catch (e) { return; }
    const reps = res.reps, n = reps.length;
    $('vivo-n').textContent = Math.max(n, yo.anunciadas); // el conteo en pantalla nunca retrocede
    if (!n) return;
    const ult = reps[n - 1];
    $('vivo-v').textContent = ult.v_media.toFixed(2);
    $('vivo-p').textContent = Math.round(Math.max(0, ult.perdida));
    if (n > yo.anunciadas) {
      yo.anunciadas = n;
      pitar(1, 880); hablar(String(n));
      if (navigator.vibrate) navigator.vibrate(60);
    }
    const lim = limite();
    if (lim && n >= 2 && !yo.avisado && ult.perdida >= lim) {
      yo.avisado = true;
      const a = $('vivo-aviso'); a.textContent = `¡PARA! Perdiste ${Math.round(ult.perdida)} % de velocidad`; a.style.display = '';
      pitar(3, 1200); if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 250]);
      hablar(`Para. Perdiste ${Math.round(ult.perdida)} por ciento`, true);
    }
  }, 400);
}

function terminar(yo) {
  if (!yo.grabando) return;
  yo.grabando = false; clearInterval(yo.reloj);
  $('vivo-accion').disabled = true; $('vivo-estado').textContent = 'Guardando la grabación…';
  yo.rec.onstop = () => {
    if (yo.descartar) return;
    const tipo = yo.tipo.split(';')[0], ext = tipo.includes('mp4') ? 'mp4' : 'webm';
    const f = new File(yo.partes, `en-vivo-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.${ext}`, { type: tipo });
    const cb = yo.alTerminar;
    detener();
    cb(f);
  };
  yo.rec.stop();
}
