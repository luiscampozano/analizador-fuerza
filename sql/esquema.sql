-- FuerzaPro · esquema de la base de datos (Cloudflare D1)
-- Cuentas y sincronizacion
CREATE TABLE IF NOT EXISTS usuarios (id TEXT PRIMARY KEY, email TEXT, nombre TEXT, foto TEXT, creado INTEGER, visto INTEGER, seq INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sesiones (token_hash TEXT PRIMARY KEY, usuario TEXT NOT NULL, creado INTEGER, expira INTEGER);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(usuario);
CREATE TABLE IF NOT EXISTS items (usuario TEXT NOT NULL, tipo TEXT NOT NULL, id TEXT NOT NULL, data TEXT, borrado INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL, actualizado INTEGER, PRIMARY KEY (usuario, tipo, id));
CREATE INDEX IF NOT EXISTS items_seq ON items(usuario, seq);
-- Comunidad
CREATE TABLE IF NOT EXISTS perfiles (usuario TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE COLLATE NOCASE, nombre TEXT NOT NULL, foto TEXT, bio TEXT, gimnasio TEXT, categoria TEXT, creado INTEGER, actualizado INTEGER);
CREATE TABLE IF NOT EXISTS publicaciones (id TEXT PRIMARY KEY, usuario TEXT NOT NULL, ref TEXT NOT NULL, texto TEXT, datos TEXT, creado INTEGER NOT NULL, editado INTEGER, oculto INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS publicaciones_ref ON publicaciones(usuario, ref);
CREATE INDEX IF NOT EXISTS publicaciones_creado ON publicaciones(creado);
CREATE INDEX IF NOT EXISTS publicaciones_usuario ON publicaciones(usuario, creado);
CREATE TABLE IF NOT EXISTS seguidores (seguidor TEXT NOT NULL, seguido TEXT NOT NULL, creado INTEGER, PRIMARY KEY (seguidor, seguido));
CREATE INDEX IF NOT EXISTS seguidores_seguido ON seguidores(seguido);
CREATE TABLE IF NOT EXISTS likes (publicacion TEXT NOT NULL, usuario TEXT NOT NULL, creado INTEGER, PRIMARY KEY (publicacion, usuario));
CREATE INDEX IF NOT EXISTS likes_usuario ON likes(usuario);
CREATE TABLE IF NOT EXISTS comentarios (id TEXT PRIMARY KEY, publicacion TEXT NOT NULL, usuario TEXT NOT NULL, texto TEXT NOT NULL, creado INTEGER NOT NULL, oculto INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS comentarios_pub ON comentarios(publicacion, creado);
CREATE INDEX IF NOT EXISTS comentarios_usuario ON comentarios(usuario, creado);
CREATE TABLE IF NOT EXISTS bloqueos (usuario TEXT NOT NULL, bloqueado TEXT NOT NULL, creado INTEGER, PRIMARY KEY (usuario, bloqueado));
CREATE INDEX IF NOT EXISTS bloqueos_bloqueado ON bloqueos(bloqueado);
CREATE TABLE IF NOT EXISTS reportes (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL, objeto_tipo TEXT NOT NULL, objeto_id TEXT NOT NULL, motivo TEXT, creado INTEGER, estado TEXT NOT NULL DEFAULT 'pendiente');
CREATE UNIQUE INDEX IF NOT EXISTS reportes_unico ON reportes(usuario, objeto_tipo, objeto_id);
CREATE INDEX IF NOT EXISTS reportes_estado ON reportes(estado, creado);
