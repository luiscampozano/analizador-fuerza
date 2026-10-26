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
const fallo = (msg, status = 400) => new Respuesta(json({ error: msg }, status));
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
  const u = await sesion(req, env);
  if (ruta.startsWith('/api/comunidad/')) return comunidad(req, env, u, ruta.slice(15), m, url);
  if (ruta.startsWith('/api/mod/')) return moderacion(req, env, u, ruta.slice(9), m);
  if (ruta === '/api/yo' && m === 'GET') return json({ usuario: publico(u) });
  if (ruta === '/api/auth/clave' && m === 'POST') return cambiarClave(req, env, u);
  if (ruta === '/api/sync' && m === 'POST') return sincronizar(req, env, u);
  if (ruta === '/api/cuenta' && m === 'DELETE') return borrarCuenta(env, u);
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
  await env.DB.batch([
    ...borrarComunidad(env, u.id),
    env.DB.prepare('DELETE FROM items WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM sesiones WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM credenciales WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ?1').bind(u.id),
  ]);
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
    await DB.batch(borrarComunidad(env, u.id));
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
    const datos = JSON.stringify(d.datos ?? null);
    if (!d.datos || typeof d.datos !== 'object' || datos.length > 40000) throw fallo('El resumen del entrenamiento es inválido o demasiado grande.');
    const recientes = await DB.prepare('SELECT count(*) AS n FROM publicaciones WHERE usuario = ?1 AND creado > ?2').bind(u.id, ahora - 3600000).first();
    if (recientes.n >= 15) throw fallo('Publicaste mucho en la última hora. Espera un poco.', 429);
    const previa = await DB.prepare('SELECT id FROM publicaciones WHERE usuario = ?1 AND ref = ?2').bind(u.id, ref).first();
    const id = previa ? previa.id : 'p' + aleatorio(12);
    if (previa) await DB.prepare('UPDATE publicaciones SET texto = ?2, datos = ?3, editado = ?4 WHERE id = ?1').bind(id, texto(d.texto, 1000), datos, ahora).run();
    else await DB.prepare('INSERT INTO publicaciones (id, usuario, ref, texto, datos, creado) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(id, u.id, ref, texto(d.texto, 1000), datos, ahora).run();
    const f = await DB.prepare(consultaPub('p.id = ?2')).bind(u.id, id).first();
    return json({ publicacion: publicacionJSON(f), nueva: !previa });
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
  if (r === 'reportes' && m === 'GET') {
    const res = await DB.prepare(`SELECT r.objeto_tipo AS tipo, r.objeto_id AS id, count(*) AS n, group_concat(r.motivo, ' · ') AS motivos, max(r.creado) AS ultimo,
        CASE r.objeto_tipo
          WHEN 'publicacion' THEN (SELECT coalesce(p.texto, '') || ' [' || coalesce(json_extract(p.datos, '$.titulo'), '') || ']' FROM publicaciones p WHERE p.id = r.objeto_id)
          WHEN 'comentario' THEN (SELECT c.texto FROM comentarios c WHERE c.id = r.objeto_id)
          ELSE (SELECT '@' || pf.alias || ' · ' || pf.nombre || ' · ' || coalesce(pf.bio, '') FROM perfiles pf WHERE pf.usuario = r.objeto_id) END AS contenido,
        CASE r.objeto_tipo
          WHEN 'publicacion' THEN (SELECT oculto FROM publicaciones WHERE id = r.objeto_id)
          WHEN 'comentario' THEN (SELECT oculto FROM comentarios WHERE id = r.objeto_id) ELSE 0 END AS oculto,
        CASE r.objeto_tipo
          WHEN 'publicacion' THEN (SELECT pf.alias FROM publicaciones p JOIN perfiles pf ON pf.usuario = p.usuario WHERE p.id = r.objeto_id)
          WHEN 'comentario' THEN (SELECT pf.alias FROM comentarios c JOIN perfiles pf ON pf.usuario = c.usuario WHERE c.id = r.objeto_id)
          ELSE (SELECT alias FROM perfiles WHERE usuario = r.objeto_id) END AS alias
      FROM reportes r WHERE r.estado = 'pendiente' GROUP BY r.objeto_tipo, r.objeto_id ORDER BY ultimo DESC LIMIT 100`).all();
    return json({ reportes: res.results || [] });
  }
  if (r === 'accion' && m === 'POST') {
    const { tipo, id, accion } = await leerJSON(req);
    const tabla = { publicacion: 'publicaciones', comentario: 'comentarios' }[tipo];
    const lote = [];
    if (accion === 'ocultar' || accion === 'mostrar') {
      if (!tabla) throw fallo('Solo se pueden ocultar publicaciones o comentarios.');
      lote.push(DB.prepare(`UPDATE ${tabla} SET oculto = ?2 WHERE id = ?1`).bind(id, accion === 'ocultar' ? 1 : 0));
    } else if (accion === 'borrar') {
      if (tipo === 'publicacion') lote.push(...borrarPublicacion(env, id));
      else if (tipo === 'comentario') lote.push(DB.prepare('DELETE FROM comentarios WHERE id = ?1').bind(id));
      else if (tipo === 'usuario') lote.push(...borrarComunidad(env, id)); // saca a la persona de la comunidad
      else throw fallo('Tipo inválido.');
    } else if (accion !== 'descartar') throw fallo('Acción inválida.');
    lote.push(DB.prepare("UPDATE reportes SET estado = 'revisado' WHERE objeto_tipo = ?1 AND objeto_id = ?2").bind(tipo, id));
    await DB.batch(lote);
    return json({ ok: true });
  }
  throw fallo('No encontrado.', 404);
}
