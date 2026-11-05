// FuerzaPro · servidor (Cloudflare Pages, modo avanzado).
// Solo atiende /api/*; el resto de la app son archivos estaticos (env.ASSETS).
// Datos en Cloudflare D1 (binding DB). Inicio de sesion con Google (ID token verificado aqui).
//
//   POST   /api/auth/google  {credential}            -> {token, usuario}
//   POST   /api/auth/correo  {modo: registro|ingreso, email, clave, nombre} -> {token, usuario}
//   POST   /api/auth/clave   {actual, nueva}          -> {ok}   (cambiar contrasena, cuentas con correo)
//   GET    /api/yo                                    -> {usuario}
//   POST   /api/sync         {desde, cambios:[...]}   -> {cambios, cursor, mas}
//   POST   /api/salir                                 -> {ok}
//   DELETE /api/cuenta                                -> {ok}   (borra la cuenta y todos sus datos)
//   /api/comunidad/*  perfiles publicos, publicaciones, seguir, likes, comentarios, bloquear, reportar
//   /api/mod/*        moderacion (solo correos en ADMIN_EMAILS)
//   GET /api/foto/:usuario                            -> foto del perfil publico (sin sesion)

const DIA = 86400000;
const SESION_DIAS = 180;
const MAX_CAMBIOS = 200;          // por peticion
const MAX_DATO = 1_500_000;       // bytes por elemento (D1 admite ~2 MB por valor)
const MAX_CUERPO = 8_000_000;     // bytes por peticion
const LOTE_BAJADA = 500;
const TIPOS = new Set(['entreno', 'comida', 'informe', 'serie', 'rutina', 'ajuste']);
const EMISORES = new Set(['accounts.google.com', 'https://accounts.google.com']);

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url);
    } catch (e) {
      if (e instanceof Respuesta) return e.r;
      console.error(e && e.stack || e);
      return json({ error: 'Error del servidor. Inténtalo más tarde.' }, 500);
    }
  },
};

class Respuesta { constructor(r) { this.r = r; } }
const fallo = (msg, status = 400, extra = {}) => new Respuesta(json({ error: msg, ...extra }, status));
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

async function api(req, env, url) {
  const ruta = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  if (m !== 'GET' && m !== 'DELETE') {
    // solo peticiones de la propia app (evita que otra web use la sesion: el token va en un header, pero por si acaso)
    const origen = req.headers.get('origin');
    if (origen && origen !== url.origin) throw fallo('Origen no permitido.', 403);
  }
  if (ruta === '/api/auth/google' && m === 'POST') return entrarGoogle(req, env);
  if (ruta === '/api/auth/correo' && m === 'POST') return entrarCorreo(req, env);
  if (ruta === '/api/salir' && m === 'POST') return salir(req, env);
  if (ruta.startsWith('/api/foto/') && m === 'GET') return foto(env, decodeURIComponent(ruta.slice(10)));
  if (/^\/api\/img\/pub\/p[A-Za-z0-9_-]{6,40}$/.test(ruta) && m === 'GET') return imagenPub(env, ruta.slice(13));
  if (/^\/api\/vid\/pub\/p[A-Za-z0-9_-]{6,40}$/.test(ruta) && m === 'GET') return videoPub(req, env, ruta.slice(13));
  if (ruta.startsWith('/api/alimentos') && m === 'GET') return leerAlimentos(env, ruta.slice(14), url); // publico: sin sesion
  const u = await sesion(req, env);
  if (ruta === '/api/alimentos' && m === 'POST') return crearAlimento(req, env, u);
  if (ruta === '/api/ia/plato' && m === 'POST') return fotoPlato(req, env, u);
  if (ruta === '/api/ia/texto' && m === 'POST') return comidaTexto(req, env, u);
  if (ruta === '/api/ia/etiqueta' && m === 'POST') return etiquetaIA(req, env, u);
  if (ruta === '/api/ia/entrenador' && m === 'POST') return entrenadorIA(req, env, u);
  if (/^\/api\/alimentos\/\d{6,14}\/reportar$/.test(ruta) && m === 'POST') return reportarAlimento(env, u, ruta.split('/')[3]);
  if (ruta.startsWith('/api/comunidad/')) return comunidad(req, env, u, ruta.slice(15), m, url);
  if (ruta.startsWith('/api/mod/')) return moderacion(req, env, u, ruta.slice(9), m);
  if (ruta === '/api/yo' && m === 'GET') return json({ usuario: publico(u) });
  if (ruta === '/api/plan' && m === 'GET') return json(await estadoPlan(env, u));
  if (ruta === '/api/plan/usar' && m === 'POST') return usarPlan(req, env, u);
  if (ruta === '/api/plan/compra' && m === 'POST') return compraPlay(req, env, u);
  if (ruta === '/api/auth/clave' && m === 'POST') return cambiarClave(req, env, u);
  if (ruta === '/api/sync' && m === 'POST') return sincronizar(req, env, u);
  if (ruta === '/api/cuenta' && m === 'DELETE') return borrarCuenta(env, u);
  if (ruta === '/api/fallos' && m === 'POST') return reportarFallo(req, env, u);
  throw fallo('No encontrado.', 404);
}

const publico = (u) => ({ id: u.id, email: u.email, nombre: u.nombre, foto: u.foto, creado: u.creado, proveedor: String(u.id).startsWith('c_') ? 'correo' : 'google' });

async function leerJSON(req) {
  const largo = +(req.headers.get('content-length') || 0);
  if (largo > MAX_CUERPO) throw fallo('Demasiados datos en una sola petición.', 413);
  const txt = await req.text();
  if (txt.length > MAX_CUERPO) throw fallo('Demasiados datos en una sola petición.', 413);
  try { return JSON.parse(txt || '{}'); } catch (e) { throw fallo('JSON inválido.'); }
}

// ------------------------------------------------------------------ sesiones
function aleatorio(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256(txt) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function tokenDe(req) {
  const a = req.headers.get('authorization') || '';
  return a.startsWith('Bearer ') ? a.slice(7).trim() : null;
}
async function sesion(req, env) {
  const t = tokenDe(req);
  if (!t) throw fallo('Inicia sesión.', 401);
  const fila = await env.DB.prepare(
    'SELECT u.*, s.expira FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.token_hash = ?1',
  ).bind(await sha256(t)).first();
  if (!fila || fila.expira < Date.now()) throw fallo('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  return fila;
}
async function salir(req, env) {
  const t = tokenDe(req);
  if (t) await env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?1').bind(await sha256(t)).run();
  return json({ ok: true });
}

// ------------------------------------------------------------------ Google
let jwks = null, jwksHasta = 0;
async function clavesGoogle(env) {
  if (env.JWKS_PRUEBA) return JSON.parse(env.JWKS_PRUEBA).keys; // solo para pruebas locales
  if (jwks && Date.now() < jwksHasta) return jwks;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw fallo('No pude contactar a Google. Inténtalo de nuevo.', 502);
  const edad = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  jwks = (await r.json()).keys;
  jwksHasta = Date.now() + Math.min(6 * 3600, edad ? +edad[1] : 3600) * 1000;
  return jwks;
}
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export async function verificarGoogle(credencial, env) {
  const partes = String(credencial || '').split('.');
  if (partes.length !== 3) throw fallo('Credencial de Google inválida.', 401);
  let cab, datos;
  try {
    cab = JSON.parse(new TextDecoder().decode(b64url(partes[0])));
    datos = JSON.parse(new TextDecoder().decode(b64url(partes[1])));
  } catch (e) { throw fallo('Credencial de Google inválida.', 401); }
  if (cab.alg !== 'RS256') throw fallo('Credencial de Google inválida.', 401);
  const clave = (await clavesGoogle(env)).find((k) => k.kid === cab.kid);
  if (!clave) { jwks = null; throw fallo('Credencial de Google inválida (clave desconocida). Inténtalo de nuevo.', 401); }
  const pub = await crypto.subtle.importKey('jwk', clave, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pub, b64url(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
  if (!ok) throw fallo('Credencial de Google inválida.', 401);
  const ahora = Date.now() / 1000;
  if (datos.aud !== env.GOOGLE_CLIENT_ID) throw fallo('Credencial de Google para otra aplicación.', 401);
  if (!EMISORES.has(datos.iss)) throw fallo('Credencial de Google inválida.', 401);
  if (!(datos.exp > ahora - 60)) throw fallo('La credencial de Google expiró. Vuelve a intentarlo.', 401);
  if (datos.email && datos.email_verified === false) throw fallo('Tu correo de Google no está verificado.', 401);
  if (!datos.sub) throw fallo('Credencial de Google inválida.', 401);
  return datos;
}

async function entrarGoogle(req, env) {
  const { credential } = await leerJSON(req);
  const g = await verificarGoogle(credential, env);
  const ahora = Date.now(), token = aleatorio();
  const recorta = (s, n) => (s ? String(s).slice(0, n) : null);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO usuarios (id, email, nombre, foto, creado, visto, seq) VALUES (?1, ?2, ?3, ?4, ?5, ?5, 0)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, nombre = excluded.nombre, foto = excluded.foto, visto = excluded.visto`)
      .bind(g.sub, recorta(g.email, 200), recorta(g.name, 120), recorta(g.picture, 500), ahora),
    env.DB.prepare('INSERT INTO sesiones (token_hash, usuario, creado, expira) VALUES (?1, ?2, ?3, ?4)')
      .bind(await sha256(token), g.sub, ahora, ahora + SESION_DIAS * DIA),
    env.DB.prepare('DELETE FROM sesiones WHERE usuario = ?1 AND expira < ?2').bind(g.sub, ahora),
  ]);
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?1').bind(g.sub).first();
  return json({ token, usuario: publico(u) });
}

// ------------------------------------------------------------------ correo y contrasena
// La contrasena nunca se guarda: solo su derivacion PBKDF2-SHA256 (100 000 iteraciones, sal aleatoria por cuenta).
// Tras 5 intentos fallidos el correo queda bloqueado 15 minutos. Los ids de estas cuentas empiezan con "c_".
const ITER = 100000, MAX_FALLOS = 5, BLOQUEO_MS = 15 * 60000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function derivar(clave, salHex, iter = ITER) {
  const sal = Uint8Array.from(salHex.match(/../g).map((h) => parseInt(h, 16)));
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, k, 256));
}
function igual(a, b) { // comparacion en tiempo constante
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const correoValido = (e) => /^[^\s@<>"']{1,64}@[^\s@<>"']+\.[a-z]{2,}$/i.test(e) && e.length <= 200;
function claveValida(c) {
  if (typeof c !== 'string' || c.length < 8) throw fallo('La contraseña debe tener al menos 8 caracteres.');
  if (c.length > 200) throw fallo('La contraseña es demasiado larga.');
  if (!/[a-zA-Z]/.test(c) || !/[0-9]/.test(c)) throw fallo('La contraseña debe tener letras y números.');
}
async function nuevaSesion(env, uid) {
  const ahora = Date.now(), token = aleatorio();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sesiones (token_hash, usuario, creado, expira) VALUES (?1, ?2, ?3, ?4)').bind(await sha256(token), uid, ahora, ahora + SESION_DIAS * DIA),
    env.DB.prepare('DELETE FROM sesiones WHERE usuario = ?1 AND expira < ?2').bind(uid, ahora),
    env.DB.prepare('UPDATE usuarios SET visto = ?2 WHERE id = ?1').bind(uid, ahora),
  ]);
  return token;
}
async function entrarCorreo(req, env) {
  const d = await leerJSON(req);
  const email = String(d.email || '').trim().toLowerCase();
  if (!correoValido(email)) throw fallo('Escribe un correo válido.');
  const DB = env.DB, ahora = Date.now();
  if (d.modo === 'registro') {
    claveValida(d.clave);
    const nombre = String(d.nombre || '').trim().slice(0, 120);
    if (!nombre) throw fallo('Escribe tu nombre.');
    const existe = await DB.prepare('SELECT id FROM usuarios WHERE lower(email) = ?1').bind(email).first();
    if (existe) throw fallo(String(existe.id).startsWith('c_') ? 'Ya existe una cuenta con ese correo. Toca «Ingresar».' : 'Ese correo ya está registrado con Google. Usa «Continuar con Google».', 409);
    const uid = 'c_' + aleatorio(12), sal = hex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derivar(d.clave, sal);
    try {
      await DB.batch([
        DB.prepare('INSERT INTO usuarios (id, email, nombre, foto, creado, visto, seq) VALUES (?1, ?2, ?3, NULL, ?4, ?4, 0)').bind(uid, email, nombre, ahora),
        DB.prepare('INSERT INTO credenciales (email, usuario, hash, sal, iter, creado, fallos, bloqueado_hasta) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0)').bind(email, uid, hash, sal, ITER, ahora),
      ]);
    } catch (e) {
      if (/UNIQUE/i.test(String(e && e.message))) throw fallo('Ya existe una cuenta con ese correo. Toca «Ingresar».', 409);
      throw e;
    }
    const token = await nuevaSesion(env, uid);
    const u = await DB.prepare('SELECT * FROM usuarios WHERE id = ?1').bind(uid).first();
    return json({ token, usuario: publico(u), nueva: true });
  }
  if (d.modo === 'ingreso') {
    if (typeof d.clave !== 'string' || !d.clave) throw fallo('Escribe tu contraseña.');
    const c = await DB.prepare('SELECT * FROM credenciales WHERE email = ?1').bind(email).first();
    const malo = 'Correo o contraseña incorrectos.';
    if (!c) {
      const g = await DB.prepare('SELECT id FROM usuarios WHERE lower(email) = ?1').bind(email).first();
      if (g) throw fallo('Ese correo entra con Google. Usa «Continuar con Google».', 401);
      await derivar(d.clave, '00'.repeat(16)); // mismo tiempo de respuesta exista o no la cuenta
      throw fallo(malo, 401);
    }
    if (c.bloqueado_hasta > ahora) throw fallo(`Demasiados intentos. Espera ${Math.ceil((c.bloqueado_hasta - ahora) / 60000)} min e inténtalo de nuevo.`, 429);
    const ok = igual(await derivar(d.clave, c.sal, c.iter), c.hash);
    if (!ok) {
      const fallos = c.fallos + 1;
      await DB.prepare('UPDATE credenciales SET fallos = ?2, bloqueado_hasta = ?3 WHERE email = ?1')
        .bind(email, fallos >= MAX_FALLOS ? 0 : fallos, fallos >= MAX_FALLOS ? ahora + BLOQUEO_MS : 0).run();
      throw fallo(fallos >= MAX_FALLOS ? 'Demasiados intentos. Espera 15 min e inténtalo de nuevo.' : malo, fallos >= MAX_FALLOS ? 429 : 401);
    }
    if (c.fallos) await DB.prepare('UPDATE credenciales SET fallos = 0, bloqueado_hasta = 0 WHERE email = ?1').bind(email).run();
    const token = await nuevaSesion(env, c.usuario);
    const u = await DB.prepare('SELECT * FROM usuarios WHERE id = ?1').bind(c.usuario).first();
    return json({ token, usuario: publico(u) });
  }
  throw fallo('Modo inválido.');
}
async function cambiarClave(req, env, u) {
  const d = await leerJSON(req);
  const c = await env.DB.prepare('SELECT * FROM credenciales WHERE usuario = ?1').bind(u.id).first();
  if (!c) throw fallo('Tu cuenta entra con Google: la contraseña se cambia en tu cuenta de Google.');
  if (!igual(await derivar(String(d.actual || ''), c.sal, c.iter), c.hash)) throw fallo('La contraseña actual no es correcta.', 401);
  claveValida(d.nueva);
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.batch([
    env.DB.prepare('UPDATE credenciales SET hash = ?2, sal = ?3, iter = ?4, fallos = 0, bloqueado_hasta = 0 WHERE usuario = ?1').bind(u.id, await derivar(d.nueva, sal), sal, ITER),
    // se cierran las demas sesiones (la actual sigue)
    env.DB.prepare('DELETE FROM sesiones WHERE usuario = ?1 AND token_hash <> ?2').bind(u.id, await sha256(tokenDe(req))),
  ]);
  return json({ ok: true });
}

// ------------------------------------------------------------------ sincronizacion
// Cada elemento (usuario, tipo, id) guarda su ultima version y un numero de secuencia por usuario.
// El cliente envia sus cambios y recibe los de otros dispositivos con seq > desde. Todo va en un lote
// transaccional: se reserva un rango de seq, se guardan los cambios y se leen los demas (sin los propios).
async function sincronizar(req, env, u) {
  const { desde = 0, cambios = [] } = await leerJSON(req);
  if (!Array.isArray(cambios) || cambios.length > MAX_CAMBIOS) throw fallo(`Envía como máximo ${MAX_CAMBIOS} cambios por vez.`);
  const vistos = new Map();
  for (const c of cambios) {
    if (!c || !TIPOS.has(c.tipo) || typeof c.id !== 'string' || !c.id || c.id.length > 200) throw fallo('Cambio inválido.');
    const borrado = c.borrado ? 1 : 0;
    const data = borrado ? null : JSON.stringify(c.data ?? null);
    if (data && data.length > MAX_DATO) throw fallo(`Un elemento (${c.tipo}) es demasiado grande para la nube.`, 413);
    vistos.set(c.tipo + '\u0000' + c.id, { tipo: c.tipo, id: c.id, data, borrado });
  }
  const lista = [...vistos.values()], n = lista.length;
  const d = Math.max(0, Math.floor(+desde) || 0), ahora = Date.now();
  const DB = env.DB, sentencias = [];
  if (n) {
    sentencias.push(DB.prepare('UPDATE usuarios SET seq = seq + ?2, visto = ?3 WHERE id = ?1').bind(u.id, n, ahora));
    sentencias.push(DB.prepare(`INSERT INTO items (usuario, tipo, id, data, borrado, seq, actualizado)
      SELECT ?1, json_extract(j.value, '$.tipo'), json_extract(j.value, '$.id'), json_extract(j.value, '$.data'),
        json_extract(j.value, '$.borrado'), (SELECT seq FROM usuarios WHERE id = ?1) - ?3 + j.key + 1, ?4
      FROM json_each(?2) j WHERE true
      ON CONFLICT(usuario, tipo, id) DO UPDATE SET data = excluded.data, borrado = excluded.borrado, seq = excluded.seq, actualizado = excluded.actualizado`)
      .bind(u.id, JSON.stringify(lista), n, ahora));
  }
  sentencias.push(DB.prepare(`SELECT tipo, id, data, borrado, seq FROM items
    WHERE usuario = ?1 AND seq > ?2 AND seq <= (SELECT seq FROM usuarios WHERE id = ?1) - ?3 ORDER BY seq LIMIT ?4`)
    .bind(u.id, d, n, LOTE_BAJADA + 1));
  sentencias.push(DB.prepare('SELECT seq FROM usuarios WHERE id = ?1').bind(u.id));
  const res = await DB.batch(sentencias);
  const filas = res[res.length - 2].results || [];
  const tope = res[res.length - 1].results[0].seq;
  const mas = filas.length > LOTE_BAJADA;
  if (mas) filas.length = LOTE_BAJADA;
  return json({
    cambios: filas.map((f) => ({ tipo: f.tipo, id: f.id, borrado: !!f.borrado, data: f.borrado ? null : JSON.parse(f.data) })),
    cursor: mas ? filas[filas.length - 1].seq : tope,
    mas,
  });
}

async function borrarCuenta(env, u) {
  const ids = await idsPublicaciones(env, u.id);
  await env.DB.batch([
    ...borrarComunidad(env, u.id),
    env.DB.prepare('DELETE FROM items WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM fallos WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM uso_ia WHERE usuario = ?1').bind(u.id),
    ...(await tablasPlan(env) ? [env.DB.prepare('DELETE FROM uso_plan WHERE usuario = ?1').bind(u.id), env.DB.prepare('DELETE FROM planes WHERE usuario = ?1').bind(u.id)] : []),
    ...(await tablaCompras(env) ? [env.DB.prepare('DELETE FROM compras WHERE usuario = ?1').bind(u.id)] : []), // la suscripcion de Play queda libre para otra cuenta
    env.DB.prepare('UPDATE alimentos SET usuario = NULL WHERE usuario = ?1').bind(u.id), // el producto queda para todos, sin autor
    env.DB.prepare('DELETE FROM sesiones WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM credenciales WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ?1').bind(u.id),
  ]);
  await borrarImagenes(env, ids);
  return json({ ok: true });
}

// ================================================================== COMUNIDAD
// Lo publico es solo lo que el usuario decide compartir (un resumen del entrenamiento). Para ver hace falta sesion;
// para publicar, dar like, comentar o seguir hace falta ademas un perfil publico con nombre de usuario (alias).
const RESERVADOS = new Set(['admin', 'administrador', 'fuerzapro', 'soporte', 'moderador', 'moderacion', 'api', 'ayuda', 'oficial', 'root']);
const LOTE_FEED = 20;
const OCULTAR_CON = 3;           // reportes de personas distintas para ocultar algo hasta que se revise
const MOTIVOS = new Set(['spam', 'ofensivo', 'acoso', 'falso', 'peligroso', 'otro']);

const texto = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '');
function fotoDe(f) {
  if (f.pf_foto && f.pf_foto.startsWith('data:')) return `/api/foto/${encodeURIComponent(f.pf_usuario)}?v=${f.pf_actualizado || 0}`;
  return f.pf_foto || f.g_foto || null;
}
const autor = (f) => ({ id: f.pf_usuario, alias: f.pf_alias, nombre: f.pf_nombre, foto: fotoDe(f) });
// columnas del autor (perfil publico + foto de Google como respaldo); `x` es la columna con el id del usuario
const COLS_AUTOR = (x) => `pf.usuario AS pf_usuario, pf.alias AS pf_alias, pf.nombre AS pf_nombre, pf.foto AS pf_foto, pf.actualizado AS pf_actualizado, ug.foto AS g_foto
  FROM perfiles pf JOIN usuarios ug ON ug.id = pf.usuario`;
// ninguno de los dos bloqueo al otro (?1 = yo)
const SIN_BLOQUEO = (x) => `NOT EXISTS (SELECT 1 FROM bloqueos b WHERE (b.usuario = ?1 AND b.bloqueado = ${x}) OR (b.usuario = ${x} AND b.bloqueado = ?1))`;

async function miPerfil(env, u) {
  return env.DB.prepare('SELECT * FROM perfiles WHERE usuario = ?1').bind(u.id).first();
}
async function requierePerfil(env, u) {
  const pf = await miPerfil(env, u);
  if (!pf) throw fallo('Primero crea tu perfil de la comunidad.', 403);
  return pf;
}
const esAdmin = (env, u) => !!u.email && !String(u.id).startsWith('c_') && String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((x) => x.trim()).includes(String(u.email).toLowerCase());

async function foto(env, usuario) {
  const f = await env.DB.prepare('SELECT foto FROM perfiles WHERE usuario = ?1').bind(usuario).first();
  const m = f && f.foto && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(f.foto);
  if (!m) return new Response('', { status: 404 });
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
}

// ---------------- imagen de una publicacion (Cloudflare R2, binding IMAGENES; v2.24.0)
// Una imagen por publicacion (la tarjeta del entreno o una foto), JPEG reducida en el telefono. Se guarda como
// pub/<id>.jpg; en datos.img queda la hora de subida (sirve para que el navegador no muestre una version vieja).
const MAX_IMG = 700_000; // caracteres base64 (~520 KB)
const claveImg = (id) => `pub/${id}.jpg`;
async function imagenPub(env, id) {
  if (!env.IMAGENES) return new Response('', { status: 404 });
  const p = await env.DB.prepare('SELECT oculto FROM publicaciones WHERE id = ?1').bind(id).first();
  if (!p || p.oculto) return new Response('', { status: 404 });
  const obj = await env.IMAGENES.get(claveImg(id));
  if (!obj) return new Response('', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff' } });
}
// ---------------- video del analizador en una publicacion (v2.25.0)
// Sin limite de duracion: el telefono lo comprime (720p) y lo sube por partes de ~8 MB (multipart de R2), asi no
// choca con el maximo de 100 MB por peticion del plan gratis. Se ve durante 1 año; despues el servidor ya no lo
// entrega y la regla de ciclo de vida del bucket (prefijo vid/, 365 dias) lo borra de R2.
const claveVid = (id) => `vid/${id}`;
const VIDA_VIDEO = 365 * 86400000, MAX_PARTE = 12_000_000, MAX_PARTES = 400;
async function videoPub(req, env, id) {
  const no = () => new Response('', { status: 404 });
  if (!env.IMAGENES) return no();
  const p = await env.DB.prepare("SELECT oculto, json_extract(datos, '$.video.t') AS t FROM publicaciones WHERE id = ?1").bind(id).first();
  if (!p || p.oculto || !p.t || Date.now() - p.t > VIDA_VIDEO) return no();
  // rangos (bytes=inicio-fin): el reproductor los pide para empezar rapido y para adelantar
  const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  let range;
  if (rg && (rg[1] || rg[2])) range = rg[1] === '' ? { suffix: +rg[2] } : rg[2] === '' ? { offset: +rg[1] } : { offset: +rg[1], length: Math.max(1, +rg[2] - +rg[1] + 1) };
  let obj;
  try { obj = await env.IMAGENES.get(claveVid(id), range ? { range } : {}); } catch (e) { return new Response('', { status: 416 }); }
  if (!obj) return no();
  const h = { 'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' };
  if (!range) return new Response(obj.body, { headers: { ...h, 'content-length': String(obj.size) } });
  const total = obj.size, r = obj.range || range;
  const ini = r.offset != null ? r.offset : Math.max(0, total - r.suffix), largo = Math.min(r.length != null ? r.length : total - ini, total - ini);
  return new Response(obj.body, { status: 206, headers: { ...h, 'content-range': `bytes ${ini}-${ini + largo - 1}/${total}`, 'content-length': String(largo) } });
}
// borra de R2 las imagenes y videos de esas publicaciones (si falla, no impide borrar lo demas)
async function borrarImagenes(env, ids) {
  if (!env.IMAGENES || !ids.length) return;
  const claves = ids.flatMap((id) => [claveImg(id), claveVid(id)]);
  try { for (let i = 0; i < claves.length; i += 1000) await env.IMAGENES.delete(claves.slice(i, i + 1000)); } catch (e) { console.error('r2 borrar', e); }
}
const idsPublicaciones = async (env, uid) => ((await env.DB.prepare('SELECT id FROM publicaciones WHERE usuario = ?1').bind(uid).all()).results || []).map((f) => f.id);

function publicacionJSON(f) {
  let datos = null;
  try { datos = JSON.parse(f.datos || 'null'); } catch (e) { /* nada */ }
  return { id: f.id, ref: f.ref, autor: autor(f), texto: f.texto || '', datos, creado: f.creado, editado: f.editado || null,
    likes: f.n_likes || 0, comentarios: f.n_coment || 0, meGusta: !!f.me_gusta };
}
const SELECT_PUB = `SELECT p.id, p.ref, p.texto, p.datos, p.creado, p.editado, ${COLS_AUTOR()}
  JOIN publicaciones p ON p.usuario = pf.usuario`;
const EXTRAS_PUB = `, (SELECT count(*) FROM likes l WHERE l.publicacion = p.id) AS n_likes,
  (SELECT count(*) FROM comentarios c WHERE c.publicacion = p.id AND c.oculto = 0) AS n_coment,
  EXISTS (SELECT 1 FROM likes l WHERE l.publicacion = p.id AND l.usuario = ?1) AS me_gusta`;
const consultaPub = (filtro) => SELECT_PUB.replace(' FROM perfiles', EXTRAS_PUB + ' FROM perfiles') + ` WHERE p.oculto = 0 AND ${SIN_BLOQUEO('p.usuario')} AND ${filtro}`;

async function comunidad(req, env, u, r, m, url) {
  const DB = env.DB, ahora = Date.now();
  const partes = r.split('/').map(decodeURIComponent);
  const q = (k) => url.searchParams.get(k);

  // ---------------- mi perfil publico
  if (r === 'yo' && m === 'GET') {
    const pf = await miPerfil(env, u);
    return json({ perfil: pf ? perfilJSON(pf, u) : null, admin: esAdmin(env, u), googleFoto: u.foto || null, googleNombre: u.nombre || null });
  }
  if (r === 'perfil' && m === 'PUT') {
    const d = await leerJSON(req);
    const alias = texto(d.alias, 30).toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_.]{3,20}$/.test(alias) || /^[._]|[._]$|\.\./.test(alias)) throw fallo('El nombre de usuario debe tener de 3 a 20 letras, números, punto o guion bajo (sin espacios ni tildes).');
    if (RESERVADOS.has(alias)) throw fallo('Ese nombre de usuario está reservado.');
    const nombre = texto(d.nombre, 60);
    if (nombre.length < 1) throw fallo('Escribe tu nombre.');
    let fotoN = null;
    if (typeof d.foto === 'string' && d.foto) {
      if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.foto) && d.foto.length <= 150000) fotoN = d.foto;
      else if (/^https:\/\/[^\s"'<>]{5,500}$/.test(d.foto)) fotoN = d.foto;
      else throw fallo('La foto no es válida (máximo ~100 KB).');
    }
    try {
      await DB.prepare(`INSERT INTO perfiles (usuario, alias, nombre, foto, bio, gimnasio, categoria, creado, actualizado)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
        ON CONFLICT(usuario) DO UPDATE SET alias = excluded.alias, nombre = excluded.nombre, foto = excluded.foto, bio = excluded.bio,
          gimnasio = excluded.gimnasio, categoria = excluded.categoria, actualizado = excluded.actualizado`)
        .bind(u.id, alias, nombre, fotoN, texto(d.bio, 160), texto(d.gimnasio, 60), texto(d.categoria, 40), ahora).run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e && e.message))) throw fallo('Ese nombre de usuario ya está ocupado. Prueba otro.', 409);
      throw e;
    }
    return json({ perfil: perfilJSON(await miPerfil(env, u), u) });
  }
  if (r === 'perfil' && m === 'DELETE') { // dejar la comunidad (la cuenta y la sincronizacion siguen)
    const ids = await idsPublicaciones(env, u.id);
    await DB.batch(borrarComunidad(env, u.id));
    await borrarImagenes(env, ids);
    return json({ ok: true });
  }

  // ---------------- feed
  if (r === 'feed' && m === 'GET') {
    const modo = q('modo') || 'siguiendo';
    const antes = Math.floor(+q('antes')) || 9e15;
    let filtro, args = [u.id, antes, LOTE_FEED + 1];
    if (modo === 'siguiendo') filtro = '(p.usuario = ?1 OR p.usuario IN (SELECT seguido FROM seguidores WHERE seguidor = ?1))';
    else if (modo === 'descubrir') filtro = '1';
    else if (modo === 'usuario') { filtro = 'p.usuario = ?4'; args.push(texto(q('u'), 200)); }
    else throw fallo('Modo inválido.');
    const res = await DB.prepare(consultaPub(filtro) + ' AND p.creado < ?2 ORDER BY p.creado DESC LIMIT ?3').bind(...args).all();
    const filas = res.results || [], mas = filas.length > LOTE_FEED;
    if (mas) filas.length = LOTE_FEED;
    return json({ publicaciones: filas.map(publicacionJSON), antes: mas ? filas[filas.length - 1].creado : null });
  }

  // ---------------- publicaciones
  if (r === 'publicaciones' && m === 'POST') {
    await requierePerfil(env, u);
    const d = await leerJSON(req);
    const ref = texto(d.ref, 120);
    if (!ref) throw fallo('Falta el entrenamiento a publicar.');
    if (d.datos && typeof d.datos === 'object') { delete d.datos.img; delete d.datos.video; } // solo el servidor marca imagen y video
    const datos = JSON.stringify(d.datos ?? null);
    if (!d.datos || typeof d.datos !== 'object' || datos.length > 40000) throw fallo('El resumen del entrenamiento es inválido o demasiado grande.');
    const recientes = await DB.prepare('SELECT count(*) AS n FROM publicaciones WHERE usuario = ?1 AND creado > ?2').bind(u.id, ahora - 3600000).first();
    if (recientes.n >= 15) throw fallo('Publicaste mucho en la última hora. Espera un poco.', 429);
    const previa = await DB.prepare('SELECT id FROM publicaciones WHERE usuario = ?1 AND ref = ?2').bind(u.id, ref).first();
    const id = previa ? previa.id : 'p' + aleatorio(12);
    if (previa) await DB.prepare(`UPDATE publicaciones SET texto = ?2, editado = ?4,
      datos = json_patch(?3, json_object('img', json_extract(datos, '$.img'), 'video', json(json_extract(datos, '$.video')))) WHERE id = ?1`).bind(id, texto(d.texto, 1000), datos, ahora).run();
    else await DB.prepare('INSERT INTO publicaciones (id, usuario, ref, texto, datos, creado) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(id, u.id, ref, texto(d.texto, 1000), datos, ahora).run();
    const f = await DB.prepare(consultaPub('p.id = ?2')).bind(u.id, id).first();
    return json({ publicacion: publicacionJSON(f), nueva: !previa });
  }
  if (partes[0] === 'publicaciones' && partes[2] === 'imagen' && partes.length === 3 && (m === 'PUT' || m === 'DELETE')) {
    if (!env.IMAGENES) throw fallo('Las imágenes en la comunidad estarán disponibles muy pronto.', 503);
    const id = partes[1];
    const p = await DB.prepare('SELECT usuario FROM publicaciones WHERE id = ?1').bind(id).first();
    if (!p) throw fallo('Esta publicación ya no está disponible.', 404);
    if (p.usuario !== u.id) throw fallo('Solo puedes cambiar la imagen de tus publicaciones.', 403);
    if (m === 'DELETE') {
      await env.IMAGENES.delete(claveImg(id));
      await DB.prepare("UPDATE publicaciones SET datos = json_remove(datos, '$.img') WHERE id = ?1").bind(id).run();
      return json({ ok: true });
    }
    const img = (await leerJSON(req)).imagen;
    // solo JPEG (empieza con /9j/ en base64) y de tamano razonable
    if (typeof img !== 'string' || !img.startsWith('/9j/') || img.length > MAX_IMG || !/^[A-Za-z0-9+/=]+$/.test(img)) throw fallo('La imagen no es válida o es muy grande (máximo ~500 KB).');
    const bytes = Uint8Array.from(atob(img), (c) => c.charCodeAt(0));
    await env.IMAGENES.put(claveImg(id), bytes, { httpMetadata: { contentType: 'image/jpeg' } });
    await DB.prepare("UPDATE publicaciones SET datos = json_set(coalesce(datos, '{}'), '$.img', ?2) WHERE id = ?1").bind(id, ahora).run();
    return json({ img: ahora });
  }
  if (partes[0] === 'publicaciones' && partes[2] === 'video' && partes.length === 4) {
    if (!env.IMAGENES) throw fallo('Los videos en la comunidad estarán disponibles muy pronto.', 503);
    const id = partes[1], paso = partes[3], R2 = env.IMAGENES;
    const p = await DB.prepare('SELECT usuario FROM publicaciones WHERE id = ?1').bind(id).first();
    if (!p) throw fallo('Esta publicación ya no está disponible.', 404);
    if (p.usuario !== u.id) throw fallo('Solo puedes cambiar el video de tus publicaciones.', 403);
    if (paso === 'inicio' && m === 'POST') {
      const pl = await planDe(env, u);
      if (pl.aplica && !PLANES[pl.plan].videoComunidad) throw fallo('Publicar videos en la comunidad es parte de Plus. Puedes publicar con texto e imagen.', 403, { plan: pl.plan, limite: 'videoComunidad' });
      const tipo = (await leerJSON(req)).tipo === 'video/webm' ? 'video/webm' : 'video/mp4';
      const sub = await R2.createMultipartUpload(claveVid(id), { httpMetadata: { contentType: tipo } });
      return json({ uploadId: sub.uploadId });
    }
    const uploadId = texto(q('uploadId'), 1000);
    if (!uploadId) throw fallo('Falta el identificador de la subida.');
    const sub = R2.resumeMultipartUpload(claveVid(id), uploadId);
    if (paso === 'parte' && m === 'PUT') {
      const n = Math.floor(+q('n'));
      if (!(n >= 1 && n <= MAX_PARTES)) throw fallo('Parte inválida.');
      const largo = +(req.headers.get('content-length') || 0);
      if (largo > MAX_PARTE) throw fallo('Parte demasiado grande.', 413);
      const datos = await req.arrayBuffer();
      if (!datos.byteLength || datos.byteLength > MAX_PARTE) throw fallo('Parte vacía o demasiado grande.', 413);
      const r = await sub.uploadPart(n, datos);
      return json({ n: r.partNumber, etag: r.etag });
    }
    if (paso === 'fin' && m === 'POST') {
      const partes_ = (await leerJSON(req)).partes;
      if (!Array.isArray(partes_) || !partes_.length || partes_.length > MAX_PARTES) throw fallo('Faltan las partes del video.');
      await sub.complete(partes_.map((x) => ({ partNumber: Math.floor(+x.n), etag: texto(x.etag, 200) })));
      const t = Date.now();
      await DB.prepare("UPDATE publicaciones SET datos = json_set(coalesce(datos, '{}'), '$.video', json_object('t', ?2)) WHERE id = ?1").bind(id, t).run();
      return json({ video: { t } });
    }
    if (paso === 'cancelar' && m === 'POST') { try { await sub.abort(); } catch (e) { /* ya no existe */ } return json({ ok: true }); }
    throw fallo('No encontrado.', 404);
  }
  if (partes[0] === 'publicaciones' && partes[2] === 'video' && partes.length === 3 && m === 'DELETE') {
    const id = partes[1];
    const p = await DB.prepare('SELECT usuario FROM publicaciones WHERE id = ?1').bind(id).first();
    if (!p) return json({ ok: true });
    if (p.usuario !== u.id && !esAdmin(env, u)) throw fallo('Solo puedes quitar el video de tus publicaciones.', 403);
    if (env.IMAGENES) await env.IMAGENES.delete(claveVid(id));
    await DB.prepare("UPDATE publicaciones SET datos = json_remove(datos, '$.video') WHERE id = ?1").bind(id).run();
    return json({ ok: true });
  }
  if (partes[0] === 'publicaciones' && partes[1] && partes.length === 2) {
    const id = partes[1];
    if (m === 'GET') {
      const f = await DB.prepare(consultaPub('p.id = ?2')).bind(u.id, id).first();
      if (!f) throw fallo('Esta publicación ya no está disponible.', 404);
      const cs = await DB.prepare(`SELECT c.id, c.texto, c.creado, ${COLS_AUTOR()} JOIN comentarios c ON c.usuario = pf.usuario
        WHERE c.publicacion = ?2 AND c.oculto = 0 AND ${SIN_BLOQUEO('c.usuario')} ORDER BY c.creado LIMIT 300`).bind(u.id, id).all();
      return json({ publicacion: publicacionJSON(f), comentarios: (cs.results || []).map((c) => ({ id: c.id, texto: c.texto, creado: c.creado, autor: autor(c) })) });
    }
    if (m === 'DELETE') {
      const p = await DB.prepare('SELECT usuario FROM publicaciones WHERE id = ?1').bind(id).first();
      if (!p) return json({ ok: true });
      if (p.usuario !== u.id && !esAdmin(env, u)) throw fallo('Solo puedes borrar tus publicaciones.', 403);
      await DB.batch(borrarPublicacion(env, id));
      await borrarImagenes(env, [id]);
      return json({ ok: true });
    }
  }
  if (partes[0] === 'publicaciones' && partes[2] === 'like' && partes.length === 3) {
    const id = partes[1];
    if (m === 'POST') {
      await requierePerfil(env, u);
      const p = await DB.prepare(`SELECT p.usuario FROM publicaciones p WHERE p.id = ?2 AND p.oculto = 0 AND ${SIN_BLOQUEO('p.usuario')}`).bind(u.id, id).first();
      if (!p) throw fallo('Esta publicación ya no está disponible.', 404);
      await DB.prepare('INSERT OR IGNORE INTO likes (publicacion, usuario, creado) VALUES (?1, ?2, ?3)').bind(id, u.id, ahora).run();
    } else if (m === 'DELETE') {
      await DB.prepare('DELETE FROM likes WHERE publicacion = ?1 AND usuario = ?2').bind(id, u.id).run();
    } else throw fallo('Método no permitido.', 405);
    const n = await DB.prepare('SELECT count(*) AS n FROM likes WHERE publicacion = ?1').bind(id).first();
    return json({ likes: n.n, meGusta: m === 'POST' });
  }
  if (partes[0] === 'publicaciones' && partes[2] === 'comentarios' && partes.length === 3 && m === 'POST') {
    await requierePerfil(env, u);
    const id = partes[1];
    const p = await DB.prepare(`SELECT p.usuario FROM publicaciones p WHERE p.id = ?2 AND p.oculto = 0 AND ${SIN_BLOQUEO('p.usuario')}`).bind(u.id, id).first();
    if (!p) throw fallo('Esta publicación ya no está disponible.', 404);
    const t = texto((await leerJSON(req)).texto, 500);
    if (!t) throw fallo('Escribe un comentario.');
    const rec = await DB.prepare('SELECT count(*) AS n FROM comentarios WHERE usuario = ?1 AND creado > ?2').bind(u.id, ahora - 60000).first();
    if (rec.n >= 8) throw fallo('Estás comentando muy rápido. Espera un momento.', 429);
    const cid = 'c' + aleatorio(12);
    await DB.prepare('INSERT INTO comentarios (id, publicacion, usuario, texto, creado) VALUES (?1, ?2, ?3, ?4, ?5)').bind(cid, id, u.id, t, ahora).run();
    const pf = await miPerfil(env, u);
    return json({ comentario: { id: cid, texto: t, creado: ahora, autor: autor({ pf_usuario: u.id, pf_alias: pf.alias, pf_nombre: pf.nombre, pf_foto: pf.foto, pf_actualizado: pf.actualizado, g_foto: u.foto }) } });
  }
  if (partes[0] === 'comentarios' && partes[1] && partes.length === 2 && m === 'DELETE') {
    const c = await DB.prepare('SELECT c.usuario, p.usuario AS dueno FROM comentarios c JOIN publicaciones p ON p.id = c.publicacion WHERE c.id = ?1').bind(partes[1]).first();
    if (!c) return json({ ok: true });
    if (c.usuario !== u.id && c.dueno !== u.id && !esAdmin(env, u)) throw fallo('No puedes borrar este comentario.', 403);
    await DB.batch([DB.prepare('DELETE FROM comentarios WHERE id = ?1').bind(partes[1]), DB.prepare("DELETE FROM reportes WHERE objeto_tipo = 'comentario' AND objeto_id = ?1").bind(partes[1])]);
    return json({ ok: true });
  }

  // ---------------- personas
  if (partes[0] === 'u' && partes[1] && partes.length === 2 && m === 'GET') {
    const f = await DB.prepare(`SELECT pf.*, ug.foto AS g_foto,
        (SELECT count(*) FROM seguidores s WHERE s.seguido = pf.usuario) AS n_seguidores,
        (SELECT count(*) FROM seguidores s WHERE s.seguidor = pf.usuario) AS n_siguiendo,
        (SELECT count(*) FROM publicaciones p WHERE p.usuario = pf.usuario AND p.oculto = 0) AS n_pub,
        EXISTS (SELECT 1 FROM seguidores s WHERE s.seguidor = ?1 AND s.seguido = pf.usuario) AS lo_sigo,
        EXISTS (SELECT 1 FROM seguidores s WHERE s.seguidor = pf.usuario AND s.seguido = ?1) AS me_sigue,
        EXISTS (SELECT 1 FROM bloqueos b WHERE b.usuario = ?1 AND b.bloqueado = pf.usuario) AS lo_bloqueo,
        EXISTS (SELECT 1 FROM bloqueos b WHERE b.usuario = pf.usuario AND b.bloqueado = ?1) AS me_bloqueo
      FROM perfiles pf JOIN usuarios ug ON ug.id = pf.usuario WHERE pf.alias = ?2 OR pf.usuario = ?2`).bind(u.id, partes[1]).first();
    if (!f || f.me_bloqueo) throw fallo('No encontré a esa persona.', 404);
    return json({ perfil: { ...perfilJSON(f, { foto: f.g_foto }), seguidores: f.n_seguidores, siguiendo: f.n_siguiendo, publicaciones: f.n_pub,
      loSigo: !!f.lo_sigo, meSigue: !!f.me_sigue, bloqueado: !!f.lo_bloqueo, esYo: f.usuario === u.id } });
  }
  if (r === 'buscar' && m === 'GET') {
    const t = texto(q('q'), 40).toLowerCase().replace(/^@/, '');
    if (t.length < 2) return json({ personas: [] });
    const like = t.replace(/[\\%_]/g, (c) => '\\' + c);
    const res = await DB.prepare(`SELECT pf.bio, pf.gimnasio, ${COLS_AUTOR()}
      WHERE pf.usuario <> ?1 AND (pf.alias LIKE ?2 ESCAPE '\\' OR lower(pf.nombre) LIKE ?3 ESCAPE '\\' OR lower(pf.gimnasio) LIKE ?3 ESCAPE '\\') AND ${SIN_BLOQUEO('pf.usuario')}
      ORDER BY (pf.alias LIKE ?2 ESCAPE '\\') DESC, pf.alias LIMIT 25`).bind(u.id, like + '%', '%' + like + '%').all();
    return json({ personas: (res.results || []).map((f) => ({ ...autor(f), gimnasio: f.gimnasio || '' })) });
  }
  if (r === 'sugerencias' && m === 'GET') { // gente activa que aun no sigues
    const res = await DB.prepare(`SELECT pf.gimnasio, ${COLS_AUTOR()}
      WHERE pf.usuario <> ?1 AND pf.usuario NOT IN (SELECT seguido FROM seguidores WHERE seguidor = ?1) AND ${SIN_BLOQUEO('pf.usuario')}
      ORDER BY (SELECT max(creado) FROM publicaciones p WHERE p.usuario = pf.usuario AND p.oculto = 0) DESC NULLS LAST LIMIT 10`).bind(u.id).all();
    return json({ personas: (res.results || []).map((f) => ({ ...autor(f), gimnasio: f.gimnasio || '' })) });
  }
  if (partes[0] === 'seguir' && partes[1] && partes.length === 2) {
    const otro = partes[1];
    if (m === 'POST') {
      await requierePerfil(env, u);
      if (otro === u.id) throw fallo('No puedes seguirte a ti mismo.');
      const ok = await DB.prepare(`SELECT 1 AS ok FROM perfiles pf WHERE pf.usuario = ?2 AND ${SIN_BLOQUEO('pf.usuario')}`).bind(u.id, otro).first();
      if (!ok) throw fallo('No encontré a esa persona.', 404);
      await DB.prepare('INSERT OR IGNORE INTO seguidores (seguidor, seguido, creado) VALUES (?1, ?2, ?3)').bind(u.id, otro, ahora).run();
    } else if (m === 'DELETE') {
      await DB.prepare('DELETE FROM seguidores WHERE seguidor = ?1 AND seguido = ?2').bind(u.id, otro).run();
    } else throw fallo('Método no permitido.', 405);
    return json({ loSigo: m === 'POST' });
  }
  if (partes[0] === 'bloquear' && partes[1] && partes.length === 2) {
    const otro = partes[1];
    if (otro === u.id) throw fallo('No puedes bloquearte a ti mismo.');
    if (m === 'POST') {
      // bloquear corta el seguimiento en los dos sentidos
      await DB.batch([
        DB.prepare('INSERT OR IGNORE INTO bloqueos (usuario, bloqueado, creado) VALUES (?1, ?2, ?3)').bind(u.id, otro, ahora),
        DB.prepare('DELETE FROM seguidores WHERE (seguidor = ?1 AND seguido = ?2) OR (seguidor = ?2 AND seguido = ?1)').bind(u.id, otro),
      ]);
    } else if (m === 'DELETE') {
      await DB.prepare('DELETE FROM bloqueos WHERE usuario = ?1 AND bloqueado = ?2').bind(u.id, otro).run();
    } else throw fallo('Método no permitido.', 405);
    return json({ bloqueado: m === 'POST' });
  }
  if (r === 'bloqueados' && m === 'GET') {
    const res = await DB.prepare(`SELECT ${COLS_AUTOR()} JOIN bloqueos b ON b.bloqueado = pf.usuario WHERE b.usuario = ?1 ORDER BY b.creado DESC`).bind(u.id).all();
    return json({ personas: (res.results || []).map(autor) });
  }
  if (r === 'reportar' && m === 'POST') {
    const d = await leerJSON(req);
    const tipo = d.tipo, id = texto(d.id, 200), motivo = MOTIVOS.has(d.motivo) ? d.motivo : 'otro';
    if (!['publicacion', 'comentario', 'usuario'].includes(tipo) || !id) throw fallo('Reporte inválido.');
    await DB.prepare(`INSERT INTO reportes (usuario, objeto_tipo, objeto_id, motivo, creado) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(usuario, objeto_tipo, objeto_id) DO UPDATE SET motivo = excluded.motivo, creado = excluded.creado, estado = 'pendiente'`)
      .bind(u.id, tipo, id, motivo + (d.detalle ? ': ' + texto(d.detalle, 300) : ''), ahora).run();
    // con varios reportes de personas distintas se oculta hasta que lo revise un moderador
    if (tipo !== 'usuario') {
      const n = await DB.prepare("SELECT count(DISTINCT usuario) AS n FROM reportes WHERE objeto_tipo = ?1 AND objeto_id = ?2 AND estado = 'pendiente'").bind(tipo, id).first();
      if (n.n >= OCULTAR_CON) await DB.prepare(`UPDATE ${tipo === 'publicacion' ? 'publicaciones' : 'comentarios'} SET oculto = 1 WHERE id = ?1 AND oculto = 0`).bind(id).run();
    }
    return json({ ok: true });
  }

  // ---------------- actividad (likes, comentarios y seguidores nuevos)
  if (r === 'actividad' && m === 'GET') {
    const res = await DB.prepare(`SELECT a.tipo, a.creado, a.pub, a.texto, ${COLS_AUTOR()}
      JOIN (
        SELECT 'like' AS tipo, l.creado, l.usuario AS actor, l.publicacion AS pub, NULL AS texto FROM likes l JOIN publicaciones p ON p.id = l.publicacion WHERE p.usuario = ?1 AND l.usuario <> ?1
        UNION ALL SELECT 'comentario', c.creado, c.usuario, c.publicacion, substr(c.texto, 1, 90) FROM comentarios c JOIN publicaciones p ON p.id = c.publicacion WHERE p.usuario = ?1 AND c.usuario <> ?1 AND c.oculto = 0
        UNION ALL SELECT 'seguir', s.creado, s.seguidor, NULL, NULL FROM seguidores s WHERE s.seguido = ?1
      ) a ON a.actor = pf.usuario
      WHERE ${SIN_BLOQUEO('pf.usuario')} ORDER BY a.creado DESC LIMIT 50`).bind(u.id).all();
    return json({ actividad: (res.results || []).map((f) => ({ tipo: f.tipo, creado: f.creado, publicacion: f.pub, texto: f.texto, autor: autor(f) })) });
  }
  throw fallo('No encontrado.', 404);
}

function perfilJSON(pf, u) {
  return { id: pf.usuario, alias: pf.alias, nombre: pf.nombre, bio: pf.bio || '', gimnasio: pf.gimnasio || '', categoria: pf.categoria || '',
    foto: fotoDe({ pf_usuario: pf.usuario, pf_foto: pf.foto, pf_actualizado: pf.actualizado, g_foto: u && u.foto }), fotoPropia: !!(pf.foto && pf.foto.startsWith('data:')), creado: pf.creado };
}

function borrarPublicacion(env, id) {
  const DB = env.DB;
  return [
    DB.prepare('DELETE FROM likes WHERE publicacion = ?1').bind(id),
    DB.prepare("DELETE FROM reportes WHERE objeto_tipo = 'comentario' AND objeto_id IN (SELECT id FROM comentarios WHERE publicacion = ?1)").bind(id),
    DB.prepare('DELETE FROM comentarios WHERE publicacion = ?1').bind(id),
    DB.prepare("DELETE FROM reportes WHERE objeto_tipo = 'publicacion' AND objeto_id = ?1").bind(id),
    DB.prepare('DELETE FROM publicaciones WHERE id = ?1').bind(id),
  ];
}
// todo lo de la comunidad de un usuario (al dejar la comunidad o eliminar la cuenta)
function borrarComunidad(env, uid) {
  const DB = env.DB, MIAS = 'SELECT id FROM publicaciones WHERE usuario = ?1';
  return [
    DB.prepare(`DELETE FROM likes WHERE usuario = ?1 OR publicacion IN (${MIAS})`).bind(uid),
    DB.prepare(`DELETE FROM reportes WHERE usuario = ?1 OR (objeto_tipo = 'usuario' AND objeto_id = ?1) OR (objeto_tipo = 'publicacion' AND objeto_id IN (${MIAS}))
      OR (objeto_tipo = 'comentario' AND objeto_id IN (SELECT id FROM comentarios WHERE usuario = ?1 OR publicacion IN (${MIAS})))`).bind(uid),
    DB.prepare(`DELETE FROM comentarios WHERE usuario = ?1 OR publicacion IN (${MIAS})`).bind(uid),
    DB.prepare('DELETE FROM publicaciones WHERE usuario = ?1').bind(uid),
    DB.prepare('DELETE FROM seguidores WHERE seguidor = ?1 OR seguido = ?1').bind(uid),
    DB.prepare('DELETE FROM bloqueos WHERE usuario = ?1 OR bloqueado = ?1').bind(uid),
    DB.prepare('DELETE FROM perfiles WHERE usuario = ?1').bind(uid),
  ];
}

// ================================================================== MODERACION
async function moderacion(req, env, u, r, m) {
  if (!esAdmin(env, u)) throw fallo('No encontrado.', 404);
  const DB = env.DB;
  // fallos de deteccion reportados por los usuarios (lista sin los puntos; el detalle trae los puntos para reproducirlo)
  if (r === 'fallos' && m === 'GET') {
    const res = await DB.prepare('SELECT id, usuario, creado, ejercicio, nombre, reps_app, reps_real, comentario, version, estado, length(pose) AS pose_bytes FROM fallos ORDER BY creado DESC LIMIT 200').all();
    return json({ fallos: res.results || [] });
  }
  if (r.startsWith('fallos/') && m === 'GET') {
    const f = await DB.prepare('SELECT * FROM fallos WHERE id = ?1').bind(r.slice(7)).first();
    if (!f) throw fallo('No encontrado.', 404);
    return json({ fallo: { ...f, datos: JSON.parse(f.datos || '{}'), excluidas: JSON.parse(f.excluidas || '[]') } });
  }
  if (r.startsWith('fallos/') && m === 'POST') {
    const { estado } = await leerJSON(req);
    if (!['pendiente', 'revisado', 'corregido'].includes(estado)) throw fallo('Estado no válido.');
    await DB.prepare('UPDATE fallos SET estado = ?2 WHERE id = ?1').bind(r.slice(7), estado).run();
    return json({ ok: true });
  }
  // ---- suscripciones (v2.33.0): modo de los limites, planes regalados y uso
  if (r === 'planes' && m === 'GET') {
    if (!(await tablasPlan(env))) return json({ sinTablas: true });
    const modo = await modoLimites(env), ahora = Date.now();
    const lista = await DB.prepare(`SELECT p.usuario, p.plan, p.hasta, p.origen, p.nota, p.actualizado, pf.alias, us.email FROM planes p
      LEFT JOIN perfiles pf ON pf.usuario = p.usuario LEFT JOIN usuarios us ON us.id = p.usuario WHERE p.hasta IS NULL OR p.hasta > ?1 ORDER BY p.actualizado DESC LIMIT 100`).bind(ahora).all();
    const total = await DB.prepare('SELECT count(*) AS n FROM usuarios').first();
    return json({ modo, usuarios: lista.results || [], totalUsuarios: total ? total.n : 0, yo: u.id });
  }
  if (r === 'planes' && m === 'POST') {
    if (!(await tablasPlan(env))) throw fallo('Primero crea las tablas de planes en D1.', 409);
    const modo = (await leerJSON(req)).modo;
    if (!['apagado', 'prueba', 'activo'].includes(modo)) throw fallo('Modo inválido.');
    await DB.prepare("INSERT INTO ajustes_app (clave, valor) VALUES ('limites', ?1) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(modo).run();
    return json({ modo });
  }
  if (r === 'plan_usuario' && m === 'POST') {
    if (!(await tablasPlan(env))) throw fallo('Primero crea las tablas de planes en D1.', 409);
    const d = await leerJSON(req), quien = texto(d.quien, 120).replace(/^@/, '');
    if (!PLANES[d.plan]) throw fallo('Plan inválido.');
    const x = quien === 'yo' ? { id: u.id } : await DB.prepare('SELECT us.id FROM usuarios us LEFT JOIN perfiles pf ON pf.usuario = us.id WHERE lower(us.email) = lower(?1) OR pf.alias = ?1 COLLATE NOCASE LIMIT 1').bind(quien).first();
    if (!x) throw fallo('No encontré a esa persona (escribe su @alias de la comunidad o su correo).', 404);
    const dias = Math.floor(+d.dias) || 0, hasta = dias > 0 ? Date.now() + dias * 86400000 : null;
    if (d.plan === 'gratis') await DB.prepare('DELETE FROM planes WHERE usuario = ?1').bind(x.id).run();
    else await DB.prepare(`INSERT INTO planes (usuario, plan, hasta, origen, nota, actualizado) VALUES (?1, ?2, ?3, 'regalo', ?4, ?5)
      ON CONFLICT(usuario) DO UPDATE SET plan = excluded.plan, hasta = excluded.hasta, origen = excluded.origen, nota = excluded.nota, actualizado = excluded.actualizado`)
      .bind(x.id, d.plan, hasta, texto(d.nota, 120), Date.now()).run();
    if (d.reiniciarUso) await DB.prepare('DELETE FROM uso_plan WHERE usuario = ?1').bind(x.id).run();
    return json({ ok: true, usuario: x.id, plan: d.plan, hasta });
  }
  if (r === 'ia' && m === 'GET') { // uso de la foto del plato en los ultimos 7 dias
    const res = await DB.prepare(`SELECT substr(dia, 1, 10) AS dia, sum(CASE WHEN length(dia) = 10 THEN n ELSE 0 END) AS fotos, sum(CASE WHEN dia LIKE '%:t' THEN n ELSE 0 END) AS textos,
        sum(CASE WHEN dia LIKE '%:e' THEN n ELSE 0 END) AS etiquetas, sum(CASE WHEN dia LIKE '%:c' THEN n ELSE 0 END) AS entrenador, count(DISTINCT usuario) AS usuarios
      FROM uso_ia GROUP BY substr(dia, 1, 10) ORDER BY 1 DESC LIMIT 7`).all();
    return json({ dias: res.results || [], limite: LIMITE_IA_USUARIO, configurada: !!env.ANTHROPIC_API_KEY });
  }
  if (r === 'reportes' && m === 'GET') {
    const res = await DB.prepare(`SELECT r.objeto_tipo AS tipo, r.objeto_id AS id, count(*) AS n, group_concat(r.motivo, ' · ') AS motivos, max(r.creado) AS ultimo,
        CASE r.objeto_tipo
          WHEN 'publicacion' THEN (SELECT coalesce(p.texto, '') || ' [' || coalesce(json_extract(p.datos, '$.titulo'), '') || ']' FROM publicaciones p WHERE p.id = r.objeto_id)
          WHEN 'comentario' THEN (SELECT c.texto FROM comentarios c WHERE c.id = r.objeto_id)
          WHEN 'alimento' THEN (SELECT '🏷️ ' || a.nombre || ' · ' || coalesce(a.marca, '') || ' · ' || a.kcal || ' kcal, P ' || a.p || ', C ' || a.c || ', G ' || a.g || ' por 100 g · código ' || a.codigo FROM alimentos a WHERE a.codigo = r.objeto_id)
          ELSE (SELECT '@' || pf.alias || ' · ' || pf.nombre || ' · ' || coalesce(pf.bio, '') FROM perfiles pf WHERE pf.usuario = r.objeto_id) END AS contenido,
        CASE r.objeto_tipo
          WHEN 'publicacion' THEN (SELECT oculto FROM publicaciones WHERE id = r.objeto_id)
          WHEN 'comentario' THEN (SELECT oculto FROM comentarios WHERE id = r.objeto_id)
          WHEN 'alimento' THEN (SELECT oculto FROM alimentos WHERE codigo = r.objeto_id) ELSE 0 END AS oculto,
        CASE r.objeto_tipo
          WHEN 'publicacion' THEN (SELECT pf.alias FROM publicaciones p JOIN perfiles pf ON pf.usuario = p.usuario WHERE p.id = r.objeto_id)
          WHEN 'comentario' THEN (SELECT pf.alias FROM comentarios c JOIN perfiles pf ON pf.usuario = c.usuario WHERE c.id = r.objeto_id)
          ELSE (SELECT alias FROM perfiles WHERE usuario = r.objeto_id) END AS alias
      FROM reportes r WHERE r.estado = 'pendiente' GROUP BY r.objeto_tipo, r.objeto_id ORDER BY ultimo DESC LIMIT 100`).all();
    return json({ reportes: res.results || [] });
  }
  if (r === 'accion' && m === 'POST') {
    const { tipo, id, accion } = await leerJSON(req);
    const tabla = { publicacion: 'publicaciones', comentario: 'comentarios', alimento: 'alimentos' }[tipo], clave = tipo === 'alimento' ? 'codigo' : 'id';
    const lote = [], imgs = [];
    if (accion === 'ocultar' || accion === 'mostrar') {
      if (!tabla) throw fallo('Solo se pueden ocultar publicaciones, comentarios o alimentos.');
      lote.push(DB.prepare(`UPDATE ${tabla} SET oculto = ?2 WHERE ${clave} = ?1`).bind(id, accion === 'ocultar' ? 1 : 0));
    } else if (accion === 'borrar') {
      if (tipo === 'alimento') lote.push(DB.prepare('DELETE FROM alimentos WHERE codigo = ?1').bind(id));
      else if (tipo === 'publicacion') { lote.push(...borrarPublicacion(env, id)); imgs.push(id); }
      else if (tipo === 'comentario') lote.push(DB.prepare('DELETE FROM comentarios WHERE id = ?1').bind(id));
      else if (tipo === 'usuario') { lote.push(...borrarComunidad(env, id)); imgs.push(...await idsPublicaciones(env, id)); } // saca a la persona de la comunidad
      else throw fallo('Tipo inválido.');
    } else if (accion !== 'descartar') throw fallo('Acción inválida.');
    lote.push(DB.prepare("UPDATE reportes SET estado = 'revisado' WHERE objeto_tipo = ?1 AND objeto_id = ?2").bind(tipo, id));
    await DB.batch(lote);
    await borrarImagenes(env, imgs);
    return json({ ok: true });
  }
  throw fallo('No encontrado.', 404);
}

// ------------------------------------------------------------------ fallos de deteccion
// El usuario corrige el conteo de reps y acepta enviar el caso: llegan los puntos del cuerpo (sin imagen) y su
// correccion, para reproducir el fallo exacto y sumarlo al banco de pruebas.
const MAX_POSE = 3_000_000; // base64 del JSON comprimido
async function reportarFallo(req, env, u) {
  const b = await leerJSON(req);
  const txt = (x, n) => String(x ?? '').slice(0, n);
  const ent = (x) => (Number.isFinite(+x) ? Math.max(0, Math.min(1000, Math.round(+x))) : null);
  if (b.pose && (typeof b.pose !== 'string' || b.pose.length > MAX_POSE || !/^[A-Za-z0-9+/=]+$/.test(b.pose))) throw fallo('Datos de la serie no válidos.');
  const hoy = Date.now() - 86_400_000;
  const n = await env.DB.prepare('SELECT count(*) AS n FROM fallos WHERE usuario = ?1 AND creado > ?2').bind(u.id, hoy).first();
  if (n && n.n >= 30) throw fallo('Ya enviaste muchos reportes hoy. ¡Gracias! Inténtalo mañana.', 429);
  const id = crypto.randomUUID();
  const excl = Array.isArray(b.excluidas) ? b.excluidas.filter((x) => Number.isFinite(+x)).slice(0, 100).map(Number) : [];
  await env.DB.prepare(`INSERT INTO fallos (id, usuario, creado, ejercicio, nombre, reps_app, reps_real, excluidas, comentario, version, datos, pose, estado)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pendiente')`).bind(
    id, u.id, Date.now(), txt(b.ejercicio, 80), txt(b.nombre, 120), ent(b.repsApp), ent(b.repsReal), JSON.stringify(excl),
    txt(b.comentario, 500), txt(b.version, 20), txt(JSON.stringify(b.datos || {}), 20000), b.pose || null).run();
  return json({ ok: true, id });
}

// ================================================================== ALIMENTOS (codigos de barras de la comunidad)
// Base propia para los productos que Open Food Facts no tiene (muchos de Ecuador). Cualquiera puede consultar; para
// agregar hace falta sesion. Datos por 100 g, con controles de coherencia (las calorias deben cuadrar con los macros).
const COD = /^\d{6,14}$/;
const filaAlimento = (f) => ({ codigo: f.codigo, nombre: f.nombre, marca: f.marca || '', kcal: f.kcal, p: f.p, c: f.c, g: f.g, porcion: f.porcion, usos: f.usos });
async function leerAlimentos(env, resto, url) {
  if (resto === '' || resto === '/') { // busqueda por nombre o marca
    const q = texto(url.searchParams.get('q') || '', 40).toLowerCase();
    if (q.length < 2) throw fallo('Escribe al menos 2 letras.');
    const pal = q.split(/\s+/).filter(Boolean).slice(0, 4);
    const cond = pal.map((_, i) => `lower(nombre || ' ' || coalesce(marca, '')) LIKE ?${i + 1}`).join(' AND ');
    const r = await env.DB.prepare(`SELECT * FROM alimentos WHERE oculto = 0 AND ${cond} ORDER BY usos DESC LIMIT 30`).bind(...pal.map((w) => `%${w.replace(/[%_]/g, '')}%`)).all();
    return json({ alimentos: (r.results || []).map(filaAlimento) });
  }
  const codigo = resto.replace(/^\//, '');
  if (!COD.test(codigo)) throw fallo('Código no válido.');
  const f = await env.DB.prepare('SELECT * FROM alimentos WHERE codigo = ?1 AND oculto = 0').bind(codigo).first();
  if (!f) return json({ alimento: null });
  await env.DB.prepare('UPDATE alimentos SET usos = usos + 1 WHERE codigo = ?1').bind(codigo).run();
  return json({ alimento: filaAlimento(f) });
}
async function crearAlimento(req, env, u) {
  const b = await leerJSON(req);
  const codigo = String(b.codigo || ''), nombre = texto(b.nombre, 60), marca = texto(b.marca, 40);
  const num = (x, max) => { const v = +x; return Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 10) / 10 : NaN; };
  const kcal = num(b.kcal, 900), p = num(b.p ?? 0, 100), c = num(b.c ?? 0, 100), g = num(b.g ?? 0, 100), porcion = b.porcion ? num(b.porcion, 5000) : null;
  if (!COD.test(codigo)) throw fallo('Código de barras no válido.');
  if (nombre.length < 2) throw fallo('Falta el nombre del producto.');
  if ([kcal, p, c, g].some((x) => !Number.isFinite(x)) || (b.porcion && !Number.isFinite(porcion))) throw fallo('Revisa los números de la etiqueta.');
  if (p + c + g > 105) throw fallo('Proteína + carbohidratos + grasa no pueden pasar de 100 g por cada 100 g.');
  const calc = 4 * p + 4 * c + 9 * g; // las calorias deben parecerse a las de los macros (fibra, alcohol y redondeos dan margen)
  if (calc > 0 && Math.abs(calc - kcal) > Math.max(60, 0.35 * kcal)) throw fallo(`Las calorías (${kcal}) no cuadran con los macros (~${Math.round(calc)} kcal). Revisa si copiaste los datos por porción o por 100 g.`);
  const hoy = Date.now() - 86_400_000;
  const n = await env.DB.prepare('SELECT count(*) AS n FROM alimentos WHERE usuario = ?1 AND creado > ?2').bind(u.id, hoy).first();
  if (n && n.n >= 50) throw fallo('Ya agregaste muchos productos hoy. ¡Gracias! Sigue mañana.', 429);
  const ya = await env.DB.prepare('SELECT usuario, oculto FROM alimentos WHERE codigo = ?1').bind(codigo).first();
  if (ya && ya.usuario !== u.id && !ya.oculto) return json({ ok: true, existente: true }); // ya lo agrego otra persona
  const ahora = Date.now();
  await env.DB.prepare(`INSERT INTO alimentos (codigo, nombre, marca, kcal, p, c, g, porcion, usuario, creado, actualizado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
    ON CONFLICT(codigo) DO UPDATE SET nombre = ?2, marca = ?3, kcal = ?4, p = ?5, c = ?6, g = ?7, porcion = ?8, usuario = ?9, actualizado = ?10, oculto = 0`)
    .bind(codigo, nombre, marca, kcal, p, c, g, porcion, u.id, ahora).run();
  if (ya && ya.oculto) await env.DB.prepare("DELETE FROM reportes WHERE objeto_tipo = 'alimento' AND objeto_id = ?1").bind(codigo).run(); // datos nuevos: reportes desde cero
  return json({ ok: true });
}
async function reportarAlimento(env, u, codigo) {
  const f = await env.DB.prepare('SELECT usuario FROM alimentos WHERE codigo = ?1').bind(codigo).first();
  if (!f) throw fallo('Ese producto no está en la base.', 404);
  await env.DB.prepare(`INSERT INTO reportes (usuario, objeto_tipo, objeto_id, motivo, creado) VALUES (?1, 'alimento', ?2, 'falso', ?3)
    ON CONFLICT(usuario, objeto_tipo, objeto_id) DO UPDATE SET creado = excluded.creado, estado = 'pendiente'`).bind(u.id, codigo, Date.now()).run();
  const r = await env.DB.prepare("SELECT count(DISTINCT usuario) AS n FROM reportes WHERE objeto_tipo = 'alimento' AND objeto_id = ?1 AND estado = 'pendiente'").bind(codigo).first();
  if (r.n >= OCULTAR_CON) await env.DB.prepare('UPDATE alimentos SET oculto = 1 WHERE codigo = ?1').bind(codigo).run();
  return json({ ok: true, oculto: r.n >= OCULTAR_CON });
}

// ================================================================== IA (Claude Haiku en el servidor)
// La app nunca ve la clave: el servidor llama a la API de Claude con el secreto ANTHROPIC_API_KEY. Cada funcion tiene
// su limite por persona y por dia (tabla uso_ia; el "dia" lleva un sufijo por funcion: "2026-11-01" = foto del plato,
// "2026-11-01:t" = texto, ":e" = etiqueta, ":c" = entrenador), y hay un tope general diario para todas. (v2.22-2.23)
const LIMITE_IA_USUARIO = 10, LIMITE_IA_TOTAL = 600, MAX_FOTO = 400_000; // caracteres base64 (~300 KB)
const LIMITES_IA = { '': 10, t: 20, e: 10, c: 3 }; // plato, texto, etiqueta, entrenador
const MODELO_IA = 'claude-haiku-5-5';
const texto_ = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '');
const numIA = (x, max) => { const v = +String(x).replace(',', '.'); return Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v * 10) / 10) : 0; };
async function cupoIA(env, u, tipo, queHace) {
  if (!env.ANTHROPIC_API_KEY) throw fallo('Esta función con IA estará disponible muy pronto.', 503);
  const hoy = new Date().toISOString().slice(0, 10), dia = tipo ? `${hoy}:${tipo}` : hoy;
  const tot = await env.DB.prepare("SELECT coalesce(sum(n), 0) AS n FROM uso_ia WHERE substr(dia, 1, 10) = ?1").bind(hoy).first();
  if (tot && tot.n >= LIMITE_IA_TOTAL) throw fallo('Las funciones con IA llegaron a su límite de hoy. Inténtalo mañana.', 429);
  const stat = () => env.DB.prepare('INSERT INTO uso_ia (usuario, dia, n) VALUES (?1, ?2, 1) ON CONFLICT(usuario, dia) DO UPDATE SET n = n + 1').bind(u.id, dia).run();
  // v2.33.0: con los limites de los planes activos, la IA sale de la bolsa de creditos del mes (y el entrenador de su cupo)
  const pl = await planDe(env, u);
  if (pl.aplica) {
    const clave = tipo === 'c' ? 'coach' : 'ia', { lim, per } = limiteDe(pl.plan, clave);
    const usado = await usoDe(env, u.id, clave, per);
    if (lim != null && usado >= lim) throw fallo(mensajeLimite(pl.plan, clave), 429, { plan: pl.plan, limite: clave });
    return { dia, quedan: lim == null ? null : lim - usado - 1, contar: async () => { await stat(); await sumarUso(env, u.id, clave, per); } };
  }
  const lim = LIMITES_IA[tipo];
  const yo = await env.DB.prepare('SELECT n FROM uso_ia WHERE usuario = ?1 AND dia = ?2').bind(u.id, dia).first();
  if (yo && yo.n >= lim) throw fallo(`Ya usaste tus ${lim} ${queHace} de hoy. Mañana tendrás más.`, 429);
  return { dia, quedan: lim - ((yo && yo.n) || 0) - 1, contar: stat };
}

// ================================================================== PLANES DE SUSCRIPCION (v2.33.0)
// Los limites se aplican segun ajustes_app.limites: 'apagado' (nadie tiene limites, como antes), 'prueba' (solo los
// administradores, para probar cada plan) o 'activo' (todos). El cobro con Google Play llegara despues; por ahora los
// planes pagados se asignan desde Moderacion (regalos y pruebas).
const PLANES = {
  gratis: { nombre: 'Gratis', video: 3, ia: 10, coach: [1, 'mes'], pdf: false, videoComunidad: false, excel: false, historialDias: 30 },
  plus: { nombre: 'Plus', video: 20, ia: 30, coach: [1, 'semana'], pdf: true, videoComunidad: true, excel: true, historialDias: null },
  pro: { nombre: 'Pro', video: 40, ia: 90, coach: [3, 'semana'], pdf: true, videoComunidad: true, excel: true, historialDias: null },
  promax: { nombre: 'Pro Max', video: null, ia: 300, coach: [1, 'dia'], pdf: true, videoComunidad: true, excel: true, historialDias: null },
};
const PRECIOS = { plus: 3.99, pro: 9.99, promax: 19.99 };
// periodo en hora de Ecuador: mes '2026-11', semana '2026-S45' (lunes a domingo), dia '2026-11-03'
function periodo(per, t = Date.now()) {
  const d = new Date(t - 5 * 3600000), iso = d.toISOString();
  if (per === 'dia') return iso.slice(0, 10);
  if (per === 'mes') return iso.slice(0, 7);
  const lunes = new Date(d); lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const ene4 = new Date(Date.UTC(lunes.getUTCFullYear(), 0, 4)), l1 = new Date(ene4); l1.setUTCDate(ene4.getUTCDate() - ((ene4.getUTCDay() + 6) % 7));
  return `${lunes.getUTCFullYear()}-S${String(1 + Math.round((lunes - l1) / 604800000)).padStart(2, '0')}`;
}
function limiteDe(plan, clave) {
  const p = PLANES[plan] || PLANES.gratis;
  if (clave === 'coach') return { lim: p.coach[0], per: p.coach[1] };
  return { lim: p[clave], per: 'mes' };
}
const QUE = { video: 'análisis de video', ia: 'créditos IA de nutrición', coach: 'análisis del entrenador IA' };
const POR = { mes: 'este mes', semana: 'esta semana', dia: 'hoy' };
function mensajeLimite(plan, clave) {
  const { lim, per } = limiteDe(plan, clave), sig = { gratis: 'Plus', plus: 'Pro', pro: 'Pro Max' }[plan];
  return `Ya usaste tus ${lim} ${QUE[clave]} de ${POR[per]} (plan ${(PLANES[plan] || PLANES.gratis).nombre}).${sig ? ` Con ${sig} tienes más.` : ''}`;
}
let tablasOk = null;
async function tablasPlan(env) {
  if (tablasOk) return true;
  try { await env.DB.prepare("SELECT valor FROM ajustes_app WHERE clave = 'limites'").first(); tablasOk = true; } catch (e) { tablasOk = false; }
  return tablasOk;
}
async function modoLimites(env) {
  if (!(await tablasPlan(env))) return 'apagado';
  const r = await env.DB.prepare("SELECT valor FROM ajustes_app WHERE clave = 'limites'").first();
  return r ? r.valor : 'apagado';
}
async function planDe(env, u) {
  const modo = await modoLimites(env);
  if (modo === 'apagado') return { modo, aplica: false, plan: 'gratis' };
  let p = await env.DB.prepare('SELECT plan, hasta, origen FROM planes WHERE usuario = ?1').bind(u.id).first();
  // plan de Google Play vencido: ¿se renovo? (v2.37.0)
  if (p && p.origen === 'play' && p.hasta != null && p.hasta <= Date.now()) {
    try { if (await renovarPlay(env, u.id)) p = await env.DB.prepare('SELECT plan, hasta, origen FROM planes WHERE usuario = ?1').bind(u.id).first(); } catch (e) { /* sin tabla compras aun */ }
  }
  const vigente = p && PLANES[p.plan] && (p.hasta == null || p.hasta > Date.now());
  return { modo, aplica: modo === 'activo' || (modo === 'prueba' && esAdmin(env, u)), plan: vigente ? p.plan : 'gratis', hasta: vigente ? p.hasta : null };
}
async function usoDe(env, uid, clave, per) {
  const r = await env.DB.prepare('SELECT n FROM uso_plan WHERE usuario = ?1 AND periodo = ?2 AND tipo = ?3').bind(uid, periodo(per), clave).first();
  return r ? r.n : 0;
}
const sumarUso = (env, uid, clave, per) => env.DB.prepare('INSERT INTO uso_plan (usuario, periodo, tipo, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(usuario, periodo, tipo) DO UPDATE SET n = n + 1')
  .bind(uid, periodo(per), clave).run();
async function estadoPlan(env, u) {
  const pl = await planDe(env, u), p = PLANES[pl.plan];
  const out = { modo: pl.modo, aplica: pl.aplica, plan: pl.plan, nombre: p.nombre, hasta: pl.hasta || null, precios: PRECIOS, planes: PLANES,
    permisos: { pdf: !pl.aplica || p.pdf, videoComunidad: !pl.aplica || p.videoComunidad, excel: !pl.aplica || p.excel, historialDias: pl.aplica ? p.historialDias : null } };
  if (pl.aplica) {
    out.limites = {}; out.usos = {};
    for (const k of ['video', 'ia', 'coach']) { const { lim, per } = limiteDe(pl.plan, k); out.limites[k] = { lim, por: per }; out.usos[k] = await usoDe(env, u.id, k, per); }
  }
  return out;
}
async function usarPlan(req, env, u) {
  const tipo = (await leerJSON(req)).tipo;
  if (tipo !== 'video') throw fallo('Tipo inválido.');
  const pl = await planDe(env, u);
  if (!pl.aplica) return json({ ok: true });
  const { lim, per } = limiteDe(pl.plan, tipo), usado = await usoDe(env, u.id, tipo, per);
  if (lim != null && usado >= lim) throw fallo(mensajeLimite(pl.plan, tipo), 429, { plan: pl.plan, limite: tipo });
  await sumarUso(env, u.id, tipo, per);
  return json({ ok: true, quedan: lim == null ? null : lim - usado - 1 });
}

// ================================================================== COBRO CON GOOGLE PLAY (v2.37.0)
// La app de Android (TWA) compra con la Digital Goods API y manda aqui el purchaseToken. El servidor lo verifica con la
// Google Play Developer API (cuenta de servicio en el secreto PLAY_CUENTA_SERVICIO, JSON que Luis pega en Cloudflare),
// lo confirma (acknowledge: si no, Google devuelve el dinero a los 3 dias) y activa el plan hasta la fecha de vencimiento.
// Al vencer, planDe vuelve a preguntar a Google (renovacion automatica). Un token pertenece a una sola cuenta.
const PAQUETE = 'com.fuerzapro.app';
const PRODUCTOS = { plus_mensual: 'plus', plus_anual: 'plus', pro_mensual: 'pro', pro_anual: 'pro', promax_mensual: 'promax', promax_anual: 'promax' };
const RANGO = { gratis: 0, plus: 1, pro: 2, promax: 3 };
const aB64url = (b) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let tokenPlay = null, tokenPlayHasta = 0;
async function accesoPlay(env) {
  if (tokenPlay && Date.now() < tokenPlayHasta) return tokenPlay;
  let cta;
  try { cta = JSON.parse(env.PLAY_CUENTA_SERVICIO || ''); } catch (e) { cta = null; }
  if (!cta || !cta.client_email || !cta.private_key) throw fallo('Los pagos todavía no están configurados en el servidor.', 503);
  const ahora = Math.floor(Date.now() / 1000);
  const cab = aB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = aB64url(JSON.stringify({ iss: cta.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }));
  const der = Uint8Array.from(atob(cta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const llave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(cab + '.' + cuerpo));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + cab + '.' + cuerpo + '.' + aB64url(firma) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { console.error('play oauth', r.status, JSON.stringify(d).slice(0, 200)); throw fallo('No pude conectar con Google Play. Inténtalo en un momento.', 502); }
  tokenPlay = d.access_token; tokenPlayHasta = Date.now() + ((d.expires_in || 3600) - 120) * 1000;
  return tokenPlay;
}
// consulta la suscripcion en Google: { producto, plan, estado, hasta, renueva, confirmada, vinculado }
async function consultarPlay(env, token) {
  const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUETE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`,
    { headers: { authorization: 'Bearer ' + await accesoPlay(env) } });
  if (r.status === 400 || r.status === 404 || r.status === 410) return null; // token invalido o muy antiguo
  if (!r.ok) { console.error('play get', r.status, (await r.text()).slice(0, 200)); throw fallo('No pude verificar la compra con Google Play. Inténtalo en un momento.', 502); }
  const s = await r.json(), li = (s.lineItems || []).find((x) => PRODUCTOS[x.productId]) || null;
  if (!li) return null;
  return { producto: li.productId, plan: PRODUCTOS[li.productId], estado: s.subscriptionState || '', hasta: Date.parse(li.expiryTime) || 0,
    renueva: li.autoRenewingPlan && li.autoRenewingPlan.autoRenewEnabled ? 1 : 0, confirmada: s.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', vinculado: s.linkedPurchaseToken || null };
}
const VALIDOS = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']); // cancelada = vale hasta vencer
let comprasOk = null;
async function tablaCompras(env) {
  if (comprasOk) return true;
  try { await env.DB.prepare('SELECT token FROM compras LIMIT 1').first(); comprasOk = true; } catch (e) { comprasOk = false; }
  return comprasOk;
}
const daDerecho = (c) => c && VALIDOS.has(c.estado) && c.hasta > Date.now();
async function confirmarPlay(env, producto, token) {
  const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUETE}/purchases/subscriptions/${producto}/tokens/${encodeURIComponent(token)}:acknowledge`,
    { method: 'POST', headers: { authorization: 'Bearer ' + await accesoPlay(env), 'content-type': 'application/json' }, body: '{}' });
  if (!r.ok) console.error('play ack', r.status, (await r.text()).slice(0, 200));
}
// guarda la compra y pone el plan (sin bajar un regalo mejor que siga vigente)
async function aplicarCompra(env, uid, token, c) {
  const ahora = Date.now();
  await env.DB.prepare(`INSERT INTO compras (token, usuario, producto, plan, estado, hasta, renueva, creado, actualizado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
    ON CONFLICT(token) DO UPDATE SET producto = excluded.producto, plan = excluded.plan, estado = excluded.estado, hasta = excluded.hasta, renueva = excluded.renueva, actualizado = excluded.actualizado`)
    .bind(token, uid, c.producto, c.plan, c.estado, c.hasta, c.renueva, ahora).run();
  if (c.vinculado) await env.DB.prepare("UPDATE compras SET estado = 'REEMPLAZADA', actualizado = ?3 WHERE token = ?1 AND usuario = ?2").bind(c.vinculado, uid, ahora).run();
  if (!daDerecho(c)) return;
  const p = await env.DB.prepare('SELECT plan, hasta, origen FROM planes WHERE usuario = ?1').bind(uid).first();
  const vigente = p && PLANES[p.plan] && (p.hasta == null || p.hasta > ahora);
  if (vigente && p.origen !== 'play' && (RANGO[p.plan] > RANGO[c.plan] || (RANGO[p.plan] === RANGO[c.plan] && (p.hasta == null || p.hasta >= c.hasta)))) return;
  await env.DB.prepare(`INSERT INTO planes (usuario, plan, hasta, origen, nota, actualizado) VALUES (?1, ?2, ?3, 'play', ?4, ?5)
    ON CONFLICT(usuario) DO UPDATE SET plan = excluded.plan, hasta = excluded.hasta, origen = excluded.origen, nota = excluded.nota, actualizado = excluded.actualizado`)
    .bind(uid, c.plan, c.hasta, c.producto, ahora).run();
}
// POST /api/plan/compra {token} (compra nueva o restaurar compras): verifica, confirma y activa
async function compraPlay(req, env, u) {
  const token = (await leerJSON(req)).token;
  if (!env.PLAY_CUENTA_SERVICIO || !(await tablaCompras(env))) throw fallo('Los pagos todavía no están listos en el servidor.', 503);
  if (typeof token !== 'string' || token.length < 10 || token.length > 600) throw fallo('Compra no válida.');
  const dueno = await env.DB.prepare('SELECT usuario FROM compras WHERE token = ?1').bind(token).first();
  if (dueno && dueno.usuario !== u.id) throw fallo('Esta suscripción de Google Play ya está asociada a otra cuenta de FuerzaPro. Inicia sesión con esa cuenta.', 409);
  const c = await consultarPlay(env, token);
  if (!c) throw fallo('Google Play no reconoce esta compra.', 400);
  if (c.estado === 'SUBSCRIPTION_STATE_PENDING') return json({ ok: false, pendiente: true, error: 'El pago está pendiente. Cuando Google Play lo apruebe se activará tu plan.' });
  if (!c.confirmada && daDerecho(c)) await confirmarPlay(env, c.producto, token);
  await aplicarCompra(env, u.id, token, c);
  return json({ ...(await estadoPlan(env, u)), ok: daDerecho(c), comprado: c.plan, vence: c.hasta, estadoPlay: c.estado });
}
// al vencer un plan pagado con Play: pregunta a Google si se renovo (como mucho una vez cada 6 h por compra)
async function renovarPlay(env, uid) {
  if (!env.PLAY_CUENTA_SERVICIO) return false;
  const ahora = Date.now(), lista = (await env.DB.prepare(`SELECT token FROM compras WHERE usuario = ?1 AND estado IN ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED')
    AND hasta < ?2 AND hasta > ?3 AND actualizado < ?4 ORDER BY hasta DESC LIMIT 2`).bind(uid, ahora, ahora - 400 * DIA, ahora - 6 * 3600000).all()).results || [];
  let renovo = false;
  for (const { token } of lista) {
    try {
      const c = await consultarPlay(env, token);
      if (!c) { await env.DB.prepare("UPDATE compras SET estado = 'INVALIDA', actualizado = ?2 WHERE token = ?1").bind(token, ahora).run(); continue; }
      await aplicarCompra(env, uid, token, c);
      if (daDerecho(c)) renovo = true;
    } catch (e) { console.error('renovar play', e && e.message); }
  }
  return renovo;
}
async function llamarClaude(env, system, content, maxTokens = 900) {
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO_IA, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
    });
  } catch (e) { throw fallo('No pude conectar con la IA. Inténtalo en un momento.', 502); }
  if (!r.ok) { console.error('anthropic', r.status, (await r.text()).slice(0, 300)); throw fallo(r.status === 429 || r.status === 529 ? 'La IA está ocupada. Inténtalo en un momento.' : 'La IA no pudo responder. Inténtalo de nuevo.', 502); }
  const datos = await r.json();
  return ((datos.content || []).find((c) => c.type === 'text') || {}).text || '';
}
const jsonDe = (texto) => { try { return JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)); } catch (e) { throw fallo('La IA respondió algo que no entendí. Inténtalo de nuevo.', 502); } };
const fotoValida = (img) => { if (typeof img !== 'string' || !img || img.length > MAX_FOTO || !/^[A-Za-z0-9+/=]+$/.test(img)) throw fallo('Foto no válida. Vuelve a tomarla.'); return img; };
const alimentosIA = (lista) => (Array.isArray(lista) ? lista : []).slice(0, 12).map((a) => ({
  nombre: texto_(a.nombre, 50) || 'Alimento', gramos: numIA(a.gramos, 2000), kcal: numIA(a.kcal, 5000), p: numIA(a.p, 500), c: numIA(a.c, 500), g: numIA(a.g, 500),
  confianza: ['alta', 'media', 'baja'].includes(a.confianza) ? a.confianza : 'media',
})).filter((a) => a.gramos > 0);
const FORMATO_ALIMENTOS = `Responde SOLO con JSON valido, sin texto antes ni despues, con este formato exacto:
{"alimentos":[{"nombre":"arroz blanco cocido","gramos":150,"kcal":195,"p":4,"c":42,"g":0.4,"confianza":"alta"}],"nota":"una frase corta"}
kcal, p (proteina), c (carbohidratos) y g (grasa) son PARA ESOS GRAMOS, con valores de tablas de composicion de alimentos. Nombres en espanol y cortos; separa los alimentos (no "plato completo"); confianza = alta, media o baja segun lo seguro que estes de la porcion.`;

// ---------- foto del plato
const PROMPT_PLATO = `Eres nutricionista. Mira la foto de una comida (puede ser comida ecuatoriana o latinoamericana) e identifica cada alimento visible.
Para cada uno estima los gramos que hay en el plato (usa referencias: tamano del plato ~25 cm, cubiertos, manos). Incluye salsas o aceite visibles.
${FORMATO_ALIMENTOS}
Si la foto no es comida, devuelve {"alimentos":[],"nota":"No parece comida."}.`;
async function fotoPlato(req, env, u) {
  const cupo = await cupoIA(env, u, '', 'fotos del plato');
  const img = fotoValida((await leerJSON(req)).imagen);
  const res = jsonDe(await llamarClaude(env, PROMPT_PLATO, [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: 'Analiza este plato y responde solo con el JSON.' }]));
  await cupo.contar();
  return json({ alimentos: alimentosIA(res.alimentos), nota: texto_(res.nota, 200), quedan: cupo.quedan });
}

// ---------- comida escrita ("arroz con menestra y carne asada")
const PROMPT_TEXTO = `Eres nutricionista. La persona describe lo que comio (en Ecuador o Latinoamerica, en lenguaje coloquial). Conviertelo en alimentos con gramos.
Si dice cantidades ("2 huevos", "una taza", "medio plato"), usalas; si no, usa porciones tipicas de un adulto. Platos tipicos (encebollado, seco de pollo, bolon, tigrillo, guatita, etc.) separalos en sus componentes principales.
${FORMATO_ALIMENTOS}
Si el texto no describe comida, devuelve {"alimentos":[],"nota":"No entendi que comiste."}.`;
async function comidaTexto(req, env, u) {
  const t = texto_((await leerJSON(req)).texto, 400);
  if (t.length < 3) throw fallo('Escribe qué comiste.');
  const cupo = await cupoIA(env, u, 't', 'consultas escritas');
  const res = jsonDe(await llamarClaude(env, PROMPT_TEXTO, [{ type: 'text', text: t }], 900));
  await cupo.contar();
  return json({ alimentos: alimentosIA(res.alimentos), nota: texto_(res.nota, 200), quedan: cupo.quedan });
}

// ---------- tabla nutricional de una etiqueta (respaldo cuando la lectura del telefono falla)
const PROMPT_ETIQUETA = `Lee la tabla de informacion nutricional de la foto (etiqueta de un producto, puede estar arrugada o con reflejos).
Responde SOLO con JSON valido: {"porcion":30,"base":"porcion","kcal":150,"p":2,"c":21,"g":6,"nombre":"","marca":"","nota":""}
porcion = gramos (o ml) de una porcion o null; base = "100g" si los numeros que das son por 100 g/ml, o "porcion" si son por porcion (prefiere la columna por 100 g si existe);
kcal = energia en kcal (si solo hay kJ, divide para 4,184); p = proteina, c = carbohidratos totales, g = grasa total, en gramos; nombre y marca del producto si se ven (si no, "").
Si no ves una tabla nutricional, devuelve {"kcal":null,"nota":"No veo la tabla nutricional."}.`;
async function etiquetaIA(req, env, u) {
  const cupo = await cupoIA(env, u, 'e', 'lecturas de etiquetas con IA');
  const img = fotoValida((await leerJSON(req)).imagen);
  const r = jsonDe(await llamarClaude(env, PROMPT_ETIQUETA, [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: 'Lee la tabla y responde solo con el JSON.' }], 400));
  await cupo.contar();
  const n = (x, max) => (x == null || x === '' ? null : numIA(x, max));
  return json({ porcion: n(r.porcion, 2000), por100: r.base === '100g', kcal: n(r.kcal, 2000), p: n(r.p, 100), c: n(r.c, 100), g: n(r.g, 100),
    nombre: texto_(r.nombre, 60), marca: texto_(r.marca, 40), nota: texto_(r.nota, 200), quedan: cupo.quedan });
}

// ---------- entrenador IA: resumen de la semana con los datos del propio usuario (los arma la app, sin nombres)
const PROMPT_COACH = `Eres un entrenador de fuerza y nutricionista deportivo, directo y motivador. Recibes en JSON los datos reales de las ultimas semanas de un atleta (entrenamientos, volumen, velocidad medida con video a la misma carga, cardio, nutricion y metas).
Escribe en espanol de Ecuador, tuteando, un analisis de su semana: 4 a 6 vinetas cortas (empieza cada una con un emoji), con numeros concretos de sus datos: que mejoro, que se estanco, una recomendacion concreta de carga o volumen para la proxima semana (por ejemplo subir 2,5-5 kg si la velocidad con la misma carga subio) y una de nutricion si hay datos.
No inventes datos que no esten en el JSON; si faltan datos, dilo en una vineta y sugiere registrarlos. No des consejos medicos. Maximo 170 palabras. Solo el texto de las vinetas.`;
async function entrenadorIA(req, env, u) {
  const b = await leerJSON(req), datos = JSON.stringify(b.datos || {});
  if (datos.length > 12000) throw fallo('Demasiados datos para el análisis.');
  const cupo = await cupoIA(env, u, 'c', 'análisis del entrenador');
  const texto = texto_(await llamarClaude(env, PROMPT_COACH, [{ type: 'text', text: datos }], 700), 2000);
  await cupo.contar();
  return json({ texto, quedan: cupo.quedan });
}
