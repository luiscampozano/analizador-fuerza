// FuerzaPro · servidor (Cloudflare Pages, modo avanzado).
// Solo atiende /api/*; el resto de la app son archivos estaticos (env.ASSETS).
// Datos en Cloudflare D1 (binding DB). Inicio de sesion con Google (ID token verificado aqui).
//
//   POST   /api/auth/google  {credential}            -> {token, usuario}
//   GET    /api/yo                                    -> {usuario}
//   POST   /api/sync         {desde, cambios:[...]}   -> {cambios, cursor, mas}
//   POST   /api/salir                                 -> {ok}
//   DELETE /api/cuenta                                -> {ok}   (borra la cuenta y todos sus datos)

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
  if (ruta === '/api/salir' && m === 'POST') return salir(req, env);
  const u = await sesion(req, env);
  if (ruta === '/api/yo' && m === 'GET') return json({ usuario: publico(u) });
  if (ruta === '/api/sync' && m === 'POST') return sincronizar(req, env, u);
  if (ruta === '/api/cuenta' && m === 'DELETE') return borrarCuenta(env, u);
  throw fallo('No encontrado.', 404);
}

const publico = (u) => ({ id: u.id, email: u.email, nombre: u.nombre, foto: u.foto, creado: u.creado });

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
    env.DB.prepare('DELETE FROM items WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM sesiones WHERE usuario = ?1').bind(u.id),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ?1').bind(u.id),
  ]);
  return json({ ok: true });
}
