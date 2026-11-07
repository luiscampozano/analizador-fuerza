-- FuerzaPro · esquema de la base de datos (Cloudflare D1)
-- Cuentas y sincronizacion
CREATE TABLE IF NOT EXISTS usuarios (id TEXT PRIMARY KEY, email TEXT, nombre TEXT, foto TEXT, creado INTEGER, visto INTEGER, seq INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sesiones (token_hash TEXT PRIMARY KEY, usuario TEXT NOT NULL, creado INTEGER, expira INTEGER);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(usuario);
CREATE TABLE IF NOT EXISTS items (usuario TEXT NOT NULL, tipo TEXT NOT NULL, id TEXT NOT NULL, data TEXT, borrado INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL, actualizado INTEGER, PRIMARY KEY (usuario, tipo, id));
CREATE INDEX IF NOT EXISTS items_seq ON items(usuario, seq);
-- Cuentas con correo y contrasena (hash PBKDF2)
CREATE TABLE IF NOT EXISTS credenciales (email TEXT PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, sal TEXT NOT NULL, iter INTEGER NOT NULL, creado INTEGER, fallos INTEGER NOT NULL DEFAULT 0, bloqueado_hasta INTEGER NOT NULL DEFAULT 0);
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
-- Fallos de deteccion reportados por los usuarios (puntos del cuerpo comprimidos, nunca video)
CREATE TABLE IF NOT EXISTS fallos (id TEXT PRIMARY KEY, usuario TEXT NOT NULL, creado INTEGER NOT NULL, ejercicio TEXT, nombre TEXT, reps_app INTEGER, reps_real INTEGER, excluidas TEXT, comentario TEXT, version TEXT, datos TEXT, pose TEXT, estado TEXT NOT NULL DEFAULT 'pendiente');
CREATE INDEX IF NOT EXISTS fallos_creado ON fallos(creado);
CREATE INDEX IF NOT EXISTS fallos_usuario ON fallos(usuario, creado);
-- Alimentos con codigo de barras que crean los usuarios (base comunitaria: lo que Open Food Facts no tiene).
-- Datos por 100 g. Se ocultan solos con 3 reportes de personas distintas (tabla reportes, objeto_tipo 'alimento').
CREATE TABLE IF NOT EXISTS alimentos (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, marca TEXT, kcal REAL NOT NULL, p REAL, c REAL, g REAL, porcion REAL, usuario TEXT, creado INTEGER NOT NULL, actualizado INTEGER, usos INTEGER NOT NULL DEFAULT 0, oculto INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS alimentos_usuario ON alimentos(usuario, creado);
-- Uso de la IA (foto del plato) por usuario y dia: limite diario y contador para Moderacion. (v2.22.0)
CREATE TABLE IF NOT EXISTS uso_ia (usuario TEXT NOT NULL, dia TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (usuario, dia));
CREATE INDEX IF NOT EXISTS uso_ia_dia ON uso_ia(dia);
-- v2.33.0: planes de suscripcion (modo de los limites, plan de cada usuario y uso por periodo)
CREATE TABLE IF NOT EXISTS planes (usuario TEXT PRIMARY KEY, plan TEXT NOT NULL, hasta INTEGER, origen TEXT, nota TEXT, actualizado INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS uso_plan (usuario TEXT NOT NULL, periodo TEXT NOT NULL, tipo TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (usuario, periodo, tipo));
CREATE TABLE IF NOT EXISTS ajustes_app (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
INSERT OR IGNORE INTO ajustes_app (clave, valor) VALUES ('limites', 'apagado');
-- v2.37.0: suscripciones compradas con Google Play (un token de compra = una sola cuenta). hasta = vencimiento (ms).
CREATE TABLE IF NOT EXISTS compras (token TEXT PRIMARY KEY, usuario TEXT NOT NULL, producto TEXT NOT NULL, plan TEXT NOT NULL, estado TEXT, hasta INTEGER, renueva INTEGER, creado INTEGER NOT NULL, actualizado INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS compras_usuario ON compras(usuario, hasta);
-- v2.38.0: comentarios de los usuarios (boton «Enviar comentario» de Perfil). captura = JPEG en base64 (opcional).
CREATE TABLE IF NOT EXISTS opiniones (id TEXT PRIMARY KEY, usuario TEXT NOT NULL, creado INTEGER NOT NULL, tipo TEXT, texto TEXT NOT NULL, captura TEXT, version TEXT, plataforma TEXT, estado TEXT NOT NULL DEFAULT 'nuevo');
CREATE INDEX IF NOT EXISTS opiniones_creado ON opiniones(creado);
CREATE INDEX IF NOT EXISTS opiniones_usuario ON opiniones(usuario, creado);
-- v2.40.0: conteo anonimo de uso. Una fila por telefono y dia: anon = identificador al azar del telefono (no es la cuenta).
CREATE TABLE IF NOT EXISTS visitas (dia TEXT NOT NULL, anon TEXT NOT NULL, plataforma TEXT, cuenta INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, anon));
