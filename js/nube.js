// Cuenta con Google y sincronizacion con la nube (Cloudflare D1 a traves de /api).
// La app sigue funcionando sin cuenta y sin internet: todo vive en el telefono y la nube es una copia que se
// mantiene al dia en segundo plano. Se detectan los cambios comparando una huella (hash) de cada elemento con
// la que tenia en la ultima sincronizacion. Los videos no se suben (pesan demasiado).
import * as almacen from './almacen.js';
import * as hist from './historial.js';

export const CLIENTE_GOOGLE = '839266600135-40anun54d7qkappj2kv3oq7b6nf6vm9e.apps.googleusercontent.com';
const SES = 'af_sesion', EST = 'af_sync';
// ajustes que viajan a la nube (los demas, como el ultimo ejercicio elegido, son de cada telefono)
const AJUSTES = ['af_perfil', 'af_1rm_real', 'af_nutri_metas', 'af_nutri_perfil', 'af_peso_log', 'af_alimentos_propios',
  'af_discos', 'af_descanso', 'af_pc', 'af_altura', 'af_ej_propios'];
const RUTINAS = 'af_rutinas';
const LOTE = 100, LOTE_BYTES = 3_000_000, MAX_DATO = 1_400_000;
const CADA = 2 * 60 * 1000;

let estado = { fase: 'quieto', error: null, ultima: null };
let corriendo = null, otraVez = false, alCambiar = () => {}, alEstado = () => {};

const leerJ = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? def; } catch (e) { return def; } };
const guardarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

export const sesion = () => leerJ(SES, null);
export const conectado = () => !!(sesion() && sesion().token);
export const estadoActual = () => ({ ...estado, ultima: leerJ(EST, {}).ultima || null });
function ponerEstado(cambios) { estado = { ...estado, ...cambios }; try { alEstado(estadoActual()); } catch (e) { /* nada */ } }

// ------------------------------------------------------------------ API
async function api(metodo, ruta, cuerpo) {
  const s = sesion();
  const r = await fetch(ruta, {
    method: metodo, cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(s && s.token ? { authorization: 'Bearer ' + s.token } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch (e) { /* respuesta sin JSON */ }
  if (r.status === 401 && ruta !== '/api/auth/google') { // la sesion ya no vale
    try { localStorage.removeItem(SES); } catch (e) { /* nada */ }
    ponerEstado({ fase: 'quieto', error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
  }
  if (!r.ok) throw new Error((datos && datos.error) || `Error ${r.status} del servidor.`);
  return datos;
}

// ------------------------------------------------------------------ iniciar sesion
export async function entrarConGoogle(credencial) {
  const r = await api('POST', '/api/auth/google', { credential: credencial });
  const previa = leerJ(EST, {});
  // otra cuenta en este telefono: se empieza de cero la sincronizacion (los datos locales se suben a la nueva cuenta)
  if (previa.usuario && previa.usuario !== r.usuario.id) try { localStorage.removeItem(EST); } catch (e) { /* nada */ }
  guardarJ(SES, { token: r.token, usuario: r.usuario });
  // si el perfil no tiene nombre, se usa el de Google
  const pf = leerJ('af_perfil', {});
  if (!pf.nombre && r.usuario.nombre) guardarJ('af_perfil', { ...pf, nombre: r.usuario.nombre });
  ponerEstado({ error: null });
  sincronizar();
  return r.usuario;
}

export async function salir() {
  try { await api('POST', '/api/salir'); } catch (e) { /* aunque falle, se cierra en el telefono */ }
  try { localStorage.removeItem(SES); localStorage.removeItem(EST); } catch (e) { /* nada */ }
  ponerEstado({ fase: 'quieto', error: null });
}

export async function borrarCuenta() {
  await api('DELETE', '/api/cuenta');
  try { localStorage.removeItem(SES); localStorage.removeItem(EST); } catch (e) { /* nada */ }
  ponerEstado({ fase: 'quieto', error: null });
}

// ------------------------------------------------------------------ datos locales
// huella rapida de un texto (cyrb53)
function huella(txt) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const clave = (tipo, id) => tipo + '|' + id;

// todo lo sincronizable del telefono: Map clave -> {tipo, id, data, txt}
async function locales() {
  const m = new Map();
  const poner = (tipo, id, data) => {
    if (id === undefined || id === null || id === '') return;
    const txt = JSON.stringify(data);
    m.set(clave(tipo, String(id)), { tipo, id: String(id), data, txt });
  };
  const [entrenos, comidas, informes] = await Promise.all([almacen.todos('entrenos'), almacen.todos('comidas'), almacen.todos('informes')]);
  entrenos.forEach((x) => poner('entreno', x.id, x));
  comidas.forEach((x) => poner('comida', x.id, x));
  informes.forEach((x) => poner('informe', x.id, x));
  hist.leer().forEach((x) => poner('serie', x.id, x));
  leerJ(RUTINAS, []).forEach((x) => poner('rutina', x.id, x));
  for (const k of AJUSTES) { const v = localStorage.getItem(k); if (v !== null) poner('ajuste', k, v); }
  return m;
}

// aplica en el telefono los cambios que llegan de la nube
async function aplicar(cambios) {
  if (!cambios.length) return;
  const por = (t) => cambios.filter((c) => c.tipo === t);
  for (const [tipo, store] of [['entreno', 'entrenos'], ['comida', 'comidas'], ['informe', 'informes']]) {
    const cs = por(tipo); if (!cs.length) continue;
    const puestos = cs.filter((c) => !c.borrado && c.data && typeof c.data === 'object');
    if (puestos.length) await almacen.ponerTodos(store, puestos.map((c) => c.data));
    for (const c of cs.filter((x) => x.borrado)) {
      if (tipo === 'entreno') await almacen.borrarEntreno(c.id);
      else if (tipo === 'comida') await almacen.borrarComida(c.id);
      else await almacen.borrarSerie(c.id);
    }
  }
  const listaPor = (cs, actual) => {
    const m = new Map(actual.map((x) => [String(x.id), x]));
    for (const c of cs) { if (c.borrado) m.delete(c.id); else if (c.data && typeof c.data === 'object') m.set(c.id, c.data); }
    return [...m.values()];
  };
  const series = por('serie');
  if (series.length) {
    const l = listaPor(series, hist.leer()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    guardarJ('af_historial_v1', l);
  }
  const rut = por('rutina');
  if (rut.length) guardarJ(RUTINAS, listaPor(rut, leerJ(RUTINAS, [])));
  for (const c of por('ajuste')) {
    if (!AJUSTES.includes(c.id)) continue;
    try { if (c.borrado) localStorage.removeItem(c.id); else if (typeof c.data === 'string') localStorage.setItem(c.id, c.data); } catch (e) { /* sin espacio */ }
  }
}

// ------------------------------------------------------------------ sincronizar
// Primera vez con esta cuenta en este telefono: primero se baja todo (lo de la nube gana en los ajustes) y despues
// se sube lo que solo existe aqui. Las siguientes veces: se suben los cambios locales y se bajan los de los otros
// dispositivos en la misma peticion.
export function sincronizar() {
  if (!conectado()) return Promise.resolve(false);
  if (corriendo) { otraVez = true; return corriendo; }
  corriendo = (async () => {
    let huboCambios = false;
    try {
      do {
        otraVez = false;
        if (await ciclo()) huboCambios = true;
      } while (otraVez && conectado());
      ponerEstado({ fase: 'quieto', error: null });
    } catch (e) {
      ponerEstado({ fase: 'quieto', error: navigator.onLine === false ? 'Sin conexión: se sincroniza cuando vuelva el internet.' : (e.message || String(e)) });
    } finally {
      corriendo = null;
    }
    if (huboCambios) try { await alCambiar(); } catch (e) { console.error(e); }
    return huboCambios;
  })();
  return corriendo;
}

async function ciclo() {
  if (navigator.onLine === false) throw new Error('Sin conexión: se sincroniza cuando vuelva el internet.');
  ponerEstado({ fase: 'sincronizando', error: null });
  const usuario = sesion().usuario.id;
  let st = leerJ(EST, {});
  if (st.usuario !== usuario) st = { usuario, cursor: 0, hashes: {}, primera: true };
  let recibidos = 0;
  const guardarEstado = () => guardarJ(EST, st);

  // 1) primera vez: bajar todo antes de subir
  if (st.primera) {
    let mas = true;
    while (mas) {
      const r = await api('POST', '/api/sync', { desde: st.cursor, cambios: [] });
      await aplicar(r.cambios);
      for (const c of r.cambios) {
        const k = clave(c.tipo, c.id);
        if (c.borrado) delete st.hashes[k]; else st.hashes[k] = huella(JSON.stringify(c.data));
      }
      recibidos += r.cambios.length; st.cursor = r.cursor; mas = r.mas;
      guardarEstado();
    }
    st.primera = false; guardarEstado();
  }

  // 2) cambios locales desde la ultima vez
  const loc = await locales();
  const pendientes = [], grandes = [];
  for (const [k, x] of loc) {
    const h = huella(x.txt);
    if (st.hashes[k] === h) continue;
    if (x.txt.length > MAX_DATO) { grandes.push(x); continue; }
    pendientes.push({ k, h, cambio: { tipo: x.tipo, id: x.id, data: x.data }, bytes: x.txt.length });
  }
  for (const k of Object.keys(st.hashes)) {
    if (!loc.has(k)) { const [tipo, ...resto] = k.split('|'); pendientes.push({ k, h: null, cambio: { tipo, id: resto.join('|'), borrado: true }, bytes: 50 }); }
  }

  // 3) subir por lotes y bajar lo nuevo de otros dispositivos
  let i = 0, mas = true;
  while (i < pendientes.length || mas) {
    const lote = []; let bytes = 0;
    while (i < pendientes.length && lote.length < LOTE && (bytes + pendientes[i].bytes < LOTE_BYTES || !lote.length)) {
      bytes += pendientes[i].bytes; lote.push(pendientes[i++]);
    }
    const r = await api('POST', '/api/sync', { desde: st.cursor, cambios: lote.map((p) => p.cambio) });
    for (const p of lote) { if (p.h === null) delete st.hashes[p.k]; else st.hashes[p.k] = p.h; }
    // lo que llega de otros dispositivos (sin lo que se acaba de subir: en la nube ya quedo nuestra version)
    const subidos = new Set(lote.map((p) => p.k));
    const llegan = r.cambios.filter((c) => !subidos.has(clave(c.tipo, c.id)));
    if (llegan.length) {
      // un cambio remoto sobre algo que aun no subimos: gana el remoto (se descarta el pendiente)
      const remotos = new Set(llegan.map((c) => clave(c.tipo, c.id)));
      for (let j = i; j < pendientes.length; j++) if (remotos.has(pendientes[j].k)) { pendientes.splice(j, 1); j--; }
      await aplicar(llegan);
      for (const c of llegan) {
        const k = clave(c.tipo, c.id);
        if (c.borrado) delete st.hashes[k]; else st.hashes[k] = huella(JSON.stringify(c.data));
      }
      recibidos += llegan.length;
    }
    st.cursor = r.cursor; mas = r.mas;
    guardarEstado();
  }
  st.ultima = new Date().toISOString(); st.grandes = grandes.length;
  guardarEstado();
  return recibidos > 0;
}

// ------------------------------------------------------------------ arranque
// d: { alCambiar: async () => {} (repintar la app), alEstado: (estado) => {} }
export function iniciar(d = {}) {
  alCambiar = d.alCambiar || alCambiar;
  alEstado = d.alEstado || alEstado;
  if (conectado()) sincronizar();
  // sincronizar() no hace nada sin sesion, asi que estos avisos sirven tambien despues de iniciar sesion
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, CADA);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sincronizar(); });
  window.addEventListener('online', () => sincronizar());
}

// ------------------------------------------------------------------ boton de Google
let gsi = null;
function cargarGoogle() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(window.google);
  if (gsi) return gsi;
  gsi = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => ok(window.google);
    s.onerror = () => { gsi = null; mal(new Error('No pude cargar el inicio de sesión de Google. Revisa tu conexión.')); };
    document.head.appendChild(s);
  });
  return gsi;
}
// dibuja el boton oficial "Continuar con Google" dentro de `cont`; alEntrar(usuario) al terminar
export async function botonGoogle(cont, { alEntrar = () => {}, alError = () => {} } = {}) {
  const google = await cargarGoogle();
  google.accounts.id.initialize({
    client_id: CLIENTE_GOOGLE,
    callback: async (resp) => {
      try { alEntrar(await entrarConGoogle(resp.credential)); } catch (e) { alError(e); }
    },
    auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_prompt: true,
  });
  cont.innerHTML = '';
  google.accounts.id.renderButton(cont, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: Math.min(320, cont.clientWidth || 300) });
}
