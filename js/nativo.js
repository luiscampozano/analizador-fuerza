// v2.66.0 funciones nativas de la app de iPhone (Capacitor, versión 1.1 de la tienda).
// En la web y en Android no hace nada: allí ya funcionan navigator.vibrate y navigator.share del navegador.
// - Vibración: si el navegador no tiene navigator.vibrate (iPhone), se imita con Haptics.
// - Compartir archivos: si el navegador no comparte archivos, se usan Filesystem + Share.
// - Aviso de fin de descanso con la pantalla apagada: LocalNotifications.
// - Apple Salud: complemento propio FuerzaSalud (movil/plugins/fuerza-salud).
// Si la app instalada es la 1.0 (sin estos complementos), todo queda como antes.

const plug = (n) => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const guardar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* nada */ } };

export const esAppIOS = () => !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');

// ------------------------------------------------------------------ vibración y compartir (sin tocar el resto de la app)
export function instalar() {
  if (!esAppIOS()) return;
  const H = plug('Haptics');
  if (H && typeof navigator.vibrate !== 'function') {
    navigator.vibrate = (p) => {
      const largo = Array.isArray(p) ? p.reduce((a, x) => a + x, 0) : +p || 0;
      if (largo >= 300) H.notification({ type: 'SUCCESS' }).catch(() => {}); // fin del descanso, récord
      else H.impact({ style: largo >= 60 ? 'MEDIUM' : 'LIGHT' }).catch(() => {}); // serie hecha, toque
      return true;
    };
  }
  const S = plug('Share'), F = plug('Filesystem');
  if (S && F) {
    const nativoArchivos = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; } })();
    if (!nativoArchivos) {
      navigator.canShare = (d) => !!(d && ((d.files && d.files.length) || d.text || d.url || d.title));
      navigator.share = async (d = {}) => {
        const files = [];
        for (const f of d.files || []) {
          // por partes de 3 MB (múltiplo de 3: el base64 de cada parte se puede pegar): un video grande no llena la memoria
          const b64De = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(b); });
          const nombre = (f.name || 'fuerzapro').replace(/[^\w.\-]/g, '_'), PARTE = 3 * 1024 * 1024;
          let uri = null;
          for (let i = 0; i < Math.max(1, f.size); i += PARTE) {
            const data = await b64De(f.slice(i, i + PARTE));
            if (i === 0) uri = (await F.writeFile({ path: nombre, data, directory: 'CACHE' })).uri;
            else await F.appendFile({ path: nombre, data, directory: 'CACHE' });
          }
          files.push(uri);
        }
        try { await S.share({ title: d.title, text: d.text, url: d.url, files: files.length ? files : undefined, dialogTitle: d.title }); }
        catch (e) { const m = String(e && e.message || e); if (/cancel/i.test(m)) throw new DOMException('Compartir cancelado', 'AbortError'); throw e; }
      };
    }
  }
}

// ------------------------------------------------------------------ aviso de fin de descanso (pantalla apagada)
const ID_DESCANSO = 4101;
let programado; // undefined: al abrir la app no se sabe si quedó un aviso pendiente, así que el primer null sí lo cancela
let pedido = null; // último fin pedido (aunque los avisos estén apagados), para programarlo al activarlos
export const avisosDisponibles = () => esAppIOS() && !!plug('LocalNotifications');
export const avisosActivos = () => avisosDisponibles() && leer('af_avisos_descanso') === '1';
export async function activarAvisos() {
  const L = plug('LocalNotifications'); if (!L) return false;
  let p = await L.checkPermissions().catch(() => ({ display: 'prompt' }));
  if (p.display !== 'granted') p = await L.requestPermissions().catch(() => ({ display: 'denied' }));
  const ok = p.display === 'granted';
  guardar('af_avisos_descanso', ok ? '1' : null);
  if (ok) { programado = undefined; avisoDescanso(pedido); } // si ya hay un descanso corriendo
  return ok;
}
// si la persona quitó el permiso en Ajustes del iPhone, se apaga aquí también
export async function revisarAvisos() {
  const L = plug('LocalNotifications'); if (!L || !avisosActivos()) return;
  const p = await L.checkPermissions().catch(() => null);
  if (p && p.display !== 'granted') guardar('af_avisos_descanso', null);
}
export function desactivarAvisos() { guardar('af_avisos_descanso', null); avisoDescanso(null); }
// fin = momento (ms) en que termina el descanso, o null para quitar el aviso
export function avisoDescanso(fin) {
  const L = plug('LocalNotifications'); if (!L) return;
  pedido = fin;
  if (!avisosActivos()) fin = null;
  if (fin === programado) return;
  programado = fin;
  L.cancel({ notifications: [{ id: ID_DESCANSO }] }).catch(() => {}).finally(() => {
    if (!fin || fin <= Date.now() + 1500 || programado !== fin) return;
    L.schedule({ notifications: [{ id: ID_DESCANSO, title: '⏱️ Terminó tu descanso', body: '¡A la siguiente serie! 💪', schedule: { at: new Date(fin), allowWhileIdle: true } }] }).catch(() => {});
  });
}

// ------------------------------------------------------------------ Apple Salud
export const saludDisponible = () => esAppIOS() && !!plug('FuerzaSalud');
export const saludConectada = () => saludDisponible() && leer('af_apple_salud') === '1';
export async function conectarSalud() {
  const S = plug('FuerzaSalud'); if (!S) throw new Error('Actualiza la app desde la App Store para conectar Apple Salud.');
  const r = await S.autorizar();
  if (!r.escribir) throw new Error('Apple Salud no dio permiso para guardar entrenamientos. Actívalo en Ajustes del iPhone → Salud → Acceso a datos → FuerzaPro.');
  guardar('af_apple_salud', '1');
  return r;
}
export function desconectarSalud() { guardar('af_apple_salud', null); guardar('af_apple_salud_ultimo', null); }
export const ultimoEnvio = () => { try { return JSON.parse(leer('af_apple_salud_ultimo') || 'null'); } catch (e) { return null; } };
// en: { inicio, fin (ISO), titulo }, kcal estimadas. Devuelve true si se guardó.
export async function guardarEntreno(en, kcal) {
  if (!saludConectada()) return false;
  const inicio = new Date(en.inicio).getTime(), fin = new Date(en.fin || Date.now()).getTime();
  if (!(fin > inicio)) return false;
  try {
    await plug('FuerzaSalud').guardarEntreno({ inicio, fin, kcal: Math.round(kcal || 0), nombre: en.titulo || 'Entrenamiento' });
    guardar('af_apple_salud_ultimo', JSON.stringify({ t: Date.now(), min: Math.round((fin - inicio) / 60000), kcal: Math.round(kcal || 0) }));
    return true;
  } catch (e) {
    if (/sin_permiso/.test(String(e && e.message || e))) guardar('af_apple_salud', null); // retiró el permiso en Ajustes del iPhone
    return false;
  }
}
export async function leerCuerpo() {
  if (!saludConectada()) return {};
  try { return await plug('FuerzaSalud').leerCuerpo(); } catch (e) { return {}; }
}
