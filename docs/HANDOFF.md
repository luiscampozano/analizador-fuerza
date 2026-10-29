# HANDOFF — FuerzaPro (analizador de fuerza por video)

**Para:** Gemini 3.8 Flash (conectado a GitHub y Cloudflare mediante Composio)
**De:** Claude (sesión de desarrollo anterior)
**Dueño del proyecto:** Ing. Luis Campozano, MBA
**Fecha del traspaso:** 27 de octubre de 2026 (al 29/10 la versión en producción es v2.7.1; el estado al día está en `docs/PROYECTO_CLAUDE.md`)

> Lee este documento COMPLETO antes de tocar cualquier archivo. La regla de oro es:
> **ningún cambio llega a `main` sin haber pasado `bash pruebas/verificar.sh` y sin haberlo revisado línea por línea.**
> Cada push a `main` se publica solo, en minutos, a usuarios reales.

---

## 0. Situación actual (lo más importante)

- Luis **está probando la app ahora mismo** en su celular (Xiaomi 13 Ultra) y **armando un nuevo lote de videos** para entrenar/afinar el analizador de video (conteo de reps, velocidad, fuerza).
- Va a pedir **muchos ajustes y cambios en la interfaz** en los próximos días. Esa es tu prioridad.
- **NO empieces** suscripciones, pagos ni Google Play Store hasta que Luis lo diga explícitamente. Esas etapas están planificadas (sección 9), pero vienen **después** de los ajustes de interfaz.
- Luis es ingeniero químico, **no programador**. Habla y documenta **siempre en español**, con lenguaje sencillo. Explica qué cambió y qué debe probar él en el celular.
- Luis cuida mucho sus límites de uso: trabaja **por partes, una cosa a la vez**, y no hagas trabajo que no pidió.

---

## 1. Datos del proyecto

| Cosa | Valor |
|---|---|
| Repositorio | `github.com/luiscampozano/analizador-fuerza` (público), rama `main` |
| Producción | https://fuerzapro.pages.dev (Cloudflare Pages, proyecto `fuerzapro`) |
| Cuenta Cloudflare (ID) | `9d467957de4f29b41e0ff6a5eb833561` |
| Base de datos | Cloudflare D1 `fuerzapro-db`, id `f5e490cf-cbb4-4021-9972-c7649911ff18`, enlazada al proyecto como `DB` |
| Publicación | GitHub Actions `.github/workflows/publicar.yml` → wrangler → Cloudflare Pages |
| Secretos en GitHub | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (ya puestos por Luis) |
| Variables en Cloudflare Pages | `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` (correos con acceso a moderación) |

### Reglas de seguridad (obligatorias)
1. **Nunca** pidas, muestres ni escribas en el chat el *Client secret* de Google ni el token de la API de Cloudflare. Si hace falta uno nuevo, Luis lo pone él mismo en GitHub → Settings → Secrets.
2. **Nunca** crees tokens de Cloudflare por API, ni subas código o datos a servicios externos (pastebins, 0x0.st, etc.).
3. Si un filtro de seguridad (de Composio o de cualquier herramienta) bloquea una acción, **no intentes rodearlo** (renombrar, ofuscar, dividir). Detente y explícale a Luis qué pasó.
4. El correo de Luis se usa solo para identificarlo; no lo envíes a ningún servicio.
5. No borres datos de producción (D1) sin confirmación explícita de Luis.

---

## 2. Qué es la app

FuerzaPro es una **PWA** (app web instalable) que:

1. **Analiza videos de series de gimnasio en el propio celular** (no se suben a ningún servidor): detecta la pose con MediaPipe, cuenta repeticiones, calcula recorrido, velocidad, fuerza y potencia, RIR/RPE, 1RM estimado, alertas de técnica y trayectoria de la barra. Genera un video 1080×1920 con esqueleto, flecha de fuerza y gráficas, y un informe PDF.
2. **Registro de entrenamientos estilo Hevy** (pestaña Entrenar): rutinas, series, récords, progreso, calculadora de discos, importación desde Hevy/Strong/CSV, tarjetas para compartir.
3. **Nutrición:** registro de comidas, metas de macros, buscador (base local + Open Food Facts), escáner de código de barras.
4. **Perfil:** datos del atleta, marcas de powerlifting (total y DOTS), peso corporal, respaldo.
5. **Cuentas y nube:** Google o correo/contraseña, sincronización con D1. La app funciona igual sin cuenta y sin internet.
6. **Comunidad:** perfiles públicos, feed, likes, comentarios, seguir, bloquear, reportar y panel de moderación.
7. **Corrección y reporte de fallos:** el usuario corrige el número de reps y puede enviar la pose al servidor (`/api/fallos`) para mejorar el detector.

---

## 3. Arquitectura y mapa de archivos

JavaScript "vanilla" con módulos ES. **No hay compilación, ni npm, ni frameworks**: el archivo que está en el repo es exactamente el que corre en el celular.

```
index.html          Toda la interfaz (pestañas, modales). ~630 líneas.
style.css           Todos los estilos (tema violeta + cian). ~1080 líneas.
sw.js               Service worker: caché offline. Contiene VERSION ('af-X.Y.Z') y la lista BASE de archivos.
manifest.json       Manifiesto PWA (nombre, íconos, colores).
_worker.js          Servidor (Cloudflare Pages "advanced mode"): todas las rutas /api/*. ~680 líneas.
_routes.json        Solo /api/* pasa por _worker.js; lo demás son archivos estáticos.
privacidad.html     Política de privacidad (requerida por Google / Play Store).
normas.html         Normas de la comunidad.
sql/esquema.sql     Esquema de D1 (NO se publica; se aplica a mano).
iconos/             Íconos y logo.
vendor/             Librerías copiadas: mediapipe (wasm), mediabunny, jspdf, mp4-muxer. NO EDITAR.
pruebas/            verificar.sh + pruebas del servidor (NO se publica).
docs/               Este documento (NO se publica).

js/app.js           Interfaz principal y flujo de análisis de video. Contiene `const VERSION = 'X.Y.Z'`.
js/ejercicios.js    Biblioteca (169 ejercicios), grupos, DETECTOR por grupo, ALIAS_IMPORTAR (nombres de Hevy).
js/fisica.js        Motor físico: escala, señal de movimiento, reps (zigzag + detector "cuerpo"), v, F, P. DELICADO.
js/analisis.js      RIR, RPE, 1RM estimado, cargas sugeridas (VBT).
js/pose.js          MediaPipe PoseLandmarker (GPU o CPU), modelos lite/full/heavy.
js/lector.js        Lectura de video cuadro a cuadro (WebCodecs/Mediabunny, respaldo con <video>).
js/render.js        Video final con telemetría.
js/tecnica.js       Alertas de técnica.   js/trayectoria.js  Trayectoria de barra.
js/vivo.js          Modo en vivo con cámara.
js/almacen.js       IndexedDB (informes, videos, poses; VERSION_DB 4).
js/historial.js     Historial de series en localStorage.
js/sesiones.js      Agrupa series por día; exporta Excel (js/excel.js).
js/pdf.js           Informe PDF con jsPDF.
js/entrenar.js      Pestaña Entrenar (registro tipo Hevy, rutinas, tarjetas).
js/progreso.js      1RM, récords, cargas por RPE, calculadora de discos.
js/importar.js      Importación Hevy/Strong/CSV.
js/tarjetas.js      10 tarjetas 1080×1350 en canvas para compartir.
js/anatomia.js      Polígonos del cuerpo (licencia MIT, GV79). NO EDITAR a mano.
js/nutricion.js + js/alimentos.js   Pestaña Nutrición.
js/perfil.js        Pestaña Perfil.
js/nube.js          Cuenta y sincronización.   js/bienvenida.js  Pantalla de bienvenida.
js/comunidad.js     Pestaña Comunidad y moderación.
```

### Rutas del servidor (`_worker.js`)
`POST /api/auth/google` · `POST /api/auth/correo` · `POST /api/auth/clave` · `GET /api/yo` · `POST /api/salir` · `POST /api/sync` · `DELETE /api/cuenta` · `GET /api/foto/:id` · `/api/comunidad/*` · `/api/mod/*` (solo ADMIN_EMAILS) · `POST /api/fallos`.

### Tablas D1
`usuarios, sesiones, items, credenciales, perfiles, publicaciones, seguidores, likes, comentarios, bloqueos, reportes, fallos` (ver `sql/esquema.sql`).

### Modelos de IA
Los modelos `.task` de MediaPipe **no están en el repo** (`modelos/` no existe en producción): `js/pose.js` los baja de Google Storage, y el wasm viene de `vendor/mediapipe` (con jsDelivr de respaldo). No los agregues al repo (son pesados).

---

## 4. Cómo publicar (flujo de despliegue)

1. Haces commit a `main` en GitHub (Composio → herramientas de GitHub).
2. GitHub Actions corre el trabajo **`verificar`** (`bash pruebas/verificar.sh`):
   sintaxis de todo el JS, versión de `sw.js` = versión de `app.js`, que cada archivo de la caché exista, y 98 pruebas del servidor.
3. **Solo si `verificar` pasa**, el trabajo **`publicar`** sube el sitio a Cloudflare Pages. Si falla, producción se queda con la versión anterior (no se rompe nada, pero tu cambio no sale).
4. En ramas que no son `main` y en pull requests solo corre `verificar` (sirve para probar sin publicar).

### Cómo comprobar que se publicó
- En GitHub → Actions: la ejecución del commit debe estar en verde en **ambos** trabajos.
- Abre `https://fuerzapro.pages.dev/sw.js` y comprueba que dice la versión nueva (`const VERSION = 'af-X.Y.Z'`). Puede tardar 1–3 minutos.
- Abre `https://fuerzapro.pages.dev/js/app.js` y comprueba `const VERSION = 'X.Y.Z'`.
- Dile a Luis: "cierra y vuelve a abrir la app dos veces" (el service worker se actualiza en segundo plano).

---

## 5. PROCEDIMIENTO SEGURO PARA HACER CAMBIOS (sigue cada paso, en orden)

> El mayor riesgo con herramientas de commit por API es **subir un archivo cortado o con partes perdidas**.
> Los archivos grandes (`app.js`, `style.css`, `index.html`, `entrenar.js`, `_worker.js`) tienen cientos de líneas.
> Si subes una versión incompleta, la app deja de funcionar para todos.

### Paso 1 — Entender el pedido
- Repite a Luis, en una o dos frases, lo que vas a cambiar. Si es ambiguo, pregunta **antes** de tocar código.
- Haz **un cambio pequeño por publicación**. No mezcles varios pedidos en un commit.

### Paso 2 — Leer el archivo actual COMPLETO desde `main`
- Descarga el archivo de `main` (nunca trabajes desde una copia vieja ni desde memoria).
- Anota cuántas líneas tiene y su SHA. Busca todos los lugares relacionados (por ejemplo, un `id` de HTML se usa en `index.html`, `app.js` y `style.css`).

### Paso 3 — Editar con cambios mínimos
- Cambia **solo** las líneas necesarias. No reformatees, no reordenes, no "limpies" código que no te pidieron.
- Mantén el estilo existente: nombres en español, comillas simples, sin punto y coma omitido, sin librerías nuevas.
- **No agregues dependencias externas** (CDN, npm). Todo debe funcionar sin conexión.
- Textos visibles al usuario: en español, con tildes correctas.

### Paso 4 — Subir la versión (SIEMPRE que cambie algo que ve el usuario)
Cambia **las dos** a la vez, con el mismo número:
- `sw.js` → `const VERSION = 'af-2.6.3';`
- `js/app.js` → `const VERSION = '2.6.3';`

Reglas de numeración: arreglo pequeño → último número (2.6.2 → 2.6.3); función nueva → número del medio (2.6.x → 2.7.0).
Si creas un archivo nuevo en `js/`, **agrégalo a la lista `BASE` de `sw.js`** (si no, `verificar` falla y la app no funcionaría sin internet).

### Paso 5 — Verificar ANTES de publicar en `main`
Lo más seguro es publicar primero en una **rama de prueba**:
1. Crea la rama `cambio/<descripcion-corta>` desde `main`.
2. Sube ahí **todos** los archivos del cambio en **un solo commit** (con `GITHUB_COMMIT_MULTIPLE_FILES` o la herramienta equivalente de Composio).
3. **Relee desde GitHub cada archivo que subiste** y compara con lo que querías:
   - mismo número de líneas que el original ± las que agregaste/quitaste;
   - el final del archivo está intacto (las últimas 10 líneas son las mismas que antes);
   - revisa el "diff" del commit (GitHub → compare): solo deben aparecer tus líneas.
4. Espera a que el trabajo **`verificar`** de esa rama termine en verde (GitHub → Actions). Si está en rojo, lee el registro, corrige en la misma rama y repite.
5. Solo entonces lleva el cambio a `main` (pull request y merge, o el mismo commit en `main`).

Si el cambio es solo de texto o estilo **y** muy pequeño, puedes ir directo a `main`, pero los pasos 3 (releer y diff) y 4 (Actions en verde) siguen siendo obligatorios.

### Paso 6 — Comprobar producción
- Actions de `main` en verde (verificar + publicar).
- `https://fuerzapro.pages.dev/sw.js` muestra la versión nueva.
- Si el cambio toca el servidor, prueba la ruta: por ejemplo `https://fuerzapro.pages.dev/api/yo` debe responder JSON (401 sin sesión es normal).

### Paso 7 — Informar a Luis
En español sencillo: qué cambió, en qué versión, y **qué debe probar él** en el celular (pasos concretos). Pídele captura si algo se ve mal.

### Si algo sale mal (deshacer)
- La forma más segura de deshacer es **revertir el commit** (GitHub "Revert" o un nuevo commit con el contenido anterior del archivo) y subir la versión otra vez (ej. 2.6.4) para que los celulares se actualicen.
- Nunca uses "force push" sobre `main`.

### Cambios en la base de datos (D1)
- Solo **agregar** (tablas o columnas nuevas con `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN`). Nunca borrar ni renombrar columnas existentes.
- Primero agrégalo a `sql/esquema.sql` en el repo; luego ejecútalo en D1 con la herramienta de Cloudflare de Composio (consulta SQL a la base `f5e490cf-cbb4-4021-9972-c7649911ff18`); después verifica con `SELECT name FROM sqlite_master WHERE type='table'` o `PRAGMA table_info(tabla)`.
- Haz la migración **antes** de publicar el código que la usa.
- El código del servidor debe seguir funcionando si la columna aún no existe (por si acaso).

### Lugares delicados — pregunta antes o ten muchísimo cuidado
- `js/fisica.js` (conteo de reps): cada ajuste anterior se midió contra un banco de 59 videos etiquetados. Un cambio "lógico" puede empeorar otros ejercicios. Ver sección 7.
- `_worker.js` (autenticación, sincronización): un error deja a todos sin cuenta. Corre siempre las pruebas.
- `js/almacen.js` (`VERSION_DB`): subir el número dispara una migración de IndexedDB en todos los teléfonos. No lo toques sin necesidad.
- `js/historial.js` clave `af_historial_v1` y las claves de `localStorage` que empiezan por `af_`: **no las renombres** o los usuarios pierden sus datos.
- `vendor/` y `js/anatomia.js`: no se editan a mano.

---

## 6. Etapas realizadas (historial de versiones)

| Versión | Qué se hizo |
|---|---|
| Etapa 1 (local) | Script Python `analizar.py` en la laptop de Luis (YOLO-pose, física, video). Validado con remo BodyFit 130 kg. |
| v1.0 | App web que analiza series de gimnasio en el celular. |
| v1.1 | Arreglo al analizar un segundo video; modos de precisión. |
| v1.2 | Decodificador del teléfono (WebCodecs), escala robusta, curl alterno; v1.2.1 conteo de reps más robusto. |
| v1.3 | 124 ejercicios por músculo, buscador en inglés, ejercicios propios. |
| v1.4 | Modo en vivo, perfil carga-velocidad, trayectoria, técnica, sesiones, Excel. |
| v1.5 | Abrir series del historial e informe PDF; v1.5.1 arreglo de 1RM en sentadilla. |
| v1.6 | Pestaña Entrenar (tipo Hevy) e importación; v1.6.1 importación 4-5× más rápida. |
| v1.7 | Rutinas, récords personales, progreso y 1RM real. |
| v1.8 | Pestaña Nutrición. |
| v1.9 | Pestaña Perfil, Comunidad (próximamente), barra reorganizada. |
| v2.0 | Nueva marca **FuerzaPro**; mudanza a fuerzapro.pages.dev; política de privacidad; arreglo de carga de MediaPipe en Cloudflare; reps de preparación. |
| v2.1 | Cuentas con Google y sincronización en la nube (D1). |
| v2.2 | Comunidad (perfiles, feed, likes, comentarios, moderación). |
| v2.3 | Bienvenida, cuentas con correo, reps lentas; v2.3.1 1RM con reps lentas. |
| v2.4 | Borrar series del historial, variantes a una pierna/brazo; v2.4.1 reps por zigzag, sin reps de desenganche. |
| — | Publicación automática con GitHub Actions. |
| v2.5.0 | Detector "por grupo" para sentadilla y peso muerto; **corrección manual de reps**; **reporte de fallos** (`/api/fallos`, tabla `fallos`, panel en moderación). |
| v2.6.0 | **Tarjetas para compartir** (10 diseños) e **importación completa de Hevy** (18 ejercicios nuevos, alias; 169 ejercicios). |
| v2.6.1 | Tarjeta de músculos con cuerpo anatómico y comparación de volumen con dibujos. |
| v2.6.2 | Reintentos cuando la IA no ve a la persona (CPU, reproductor) + diagnóstico opcional; filtro de "preparación" en press/remo/curl (codo poco extendido, primera rep lenta). |
| (traspaso) | `pruebas/verificar.sh` + pruebas del servidor en el repo; Actions verifica antes de publicar. |

---

## 7. El analizador de video: cómo funciona el conteo y cómo mejorarlo

- `js/fisica.js → analizar()` recibe los puntos de MediaPipe por cuadro.
- Detectores:
  - **zigzag + umbral** (general) sobre la señal de movimiento del punto seguido (muñeca, cadera…), con filtro `quitarPreparacion` (quita reps de agarrar/soltar la carga).
  - **detector "cuerpo"** (`repsCuerpo`) para los grupos de `DETECTOR` en `ejercicios.js`:
    - `fondos` = sentadillas (incluye smith, hack, belt squat, corporal, buenos días);
    - `topes` = pesos muertos (no rack pull).
    Usa altura vertical del punto sobre los tobillos, ventana con pies quietos, nivel de reposo y amplitud típica; descarta reps con v > 2 m/s.
- Resultado con el banco de prueba (59 videos de Luis etiquetados): **29/59 exactos** (antes 23/59).
- El banco de prueba (poses extraídas y etiquetas) quedó en el entorno de Claude y **no está en el repo**. Las etiquetas están en un artefacto de Claude. Si vas a cambiar `fisica.js`, pide a Luis los videos y las reps reales, y compara **antes y después** con todos los videos, no solo con uno.
- Con la función de reporte, los fallos reales llegan a la tabla `fallos` de D1 (ejercicio, reps app, reps reales, pose comprimida). Luis los ve en Comunidad → Moderación. Son la mejor fuente para afinar.

**Luis está armando un nuevo lote de videos** para esto. Cuando lo entregue: etiquetar (ejercicio + reps reales), medir el acierto actual, cambiar, volver a medir. No publicar un cambio de `fisica.js` que empeore el total.

---

## 8. Pendientes inmediatos (lo que viene ahora)

1. **Ajustes de interfaz que pida Luis** (prioridad). Uno por uno, con el procedimiento de la sección 5.
2. Detectores por grupo para press/máquinas, brazos y espalda (como se hizo con sentadilla y peso muerto), usando el nuevo lote de videos.
3. Revisar los reportes de fallos que lleguen (tabla `fallos`).
4. Caso abierto: en el teléfono de un familiar salió "No se ve bien" en videos de tríceps (en escritorio se detecta bien). v2.6.2 agregó reintentos y un diagnóstico opcional; esperar si llegan reportes.
5. Posible: imagen de la tarjeta en las publicaciones de la Comunidad.

---

## 9. Pendiente para DESPUÉS (no empezar sin permiso de Luis)

### 9.1 Suscripciones (decididas por Luis)
| Plan | Precio |
|---|---|
| Gratis | $0 |
| Plus | $3.99/mes |
| Pro | $9.99/mes |
| Pro Max | $19.99/mes |

- Precio anual = 2 meses gratis. **7 días de prueba de Pro**.
- Qué incluye cada plan: **confirmar con Luis** antes de programar.
- Implementación acordada:
  - tabla de planes en D1;
  - **interruptor general apagado** hasta el lanzamiento (nadie pierde funciones mientras tanto);
  - modo de prueba;
  - el administrador puede **regalar planes** (Luis quiere Pro Max de por vida para su familia).
- Google cobra comisión (15% en suscripciones).

### 9.2 Google Play Store
- Empaquetar la PWA como **TWA** (Trusted Web Activity, p. ej. con Bubblewrap/PWABuilder) + `assetlinks.json` en el sitio.
- Cobros dentro de Android con **Google Play Billing** (Digital Goods API) y validación en el servidor.
- Cuenta de Play Console, ficha, capturas, política de privacidad (ya existe: `/privacidad.html`), formulario de seguridad de datos, pruebas cerradas antes de producción.

---

## 10. Trampas conocidas

- **Tamaño de los commits por Composio:** subir archivos grandes en una sola llamada puede cortarse. Sube pocos archivos por commit y **siempre relee** lo subido (paso 5.3).
- **Filtro de Composio con la palabra "mediapipe":** algunas operaciones con rutas `vendor/mediapipe` son bloqueadas. No intentes ofuscarlo; no hace falta tocar esa carpeta.
- **Caché del service worker:** si olvidas subir la versión, los teléfonos siguen mostrando lo viejo aunque el código esté publicado.
- **Archivo nuevo sin agregarlo a `BASE` en `sw.js`:** `verificar` falla (a propósito).
- **IDs de ejercicios** (`js/ejercicios.js`): están guardados en el historial de los usuarios; no cambies un `id` existente. Para renombrar, cambia solo `nombre`.
- **Textos en el HTML con `id`:** `app.js` los busca por `id`; si cambias un `id` en `index.html`, búscalo en todo el repo.
- La app debe seguir funcionando **sin cuenta y sin internet**.

---

## 11. Lista de verificación rápida (cópiala en cada cambio)

- [ ] Entendí y le confirmé a Luis qué voy a cambiar.
- [ ] Leí los archivos completos desde `main` y busqué todos los usos relacionados.
- [ ] Cambios mínimos, sin reformatear, sin dependencias nuevas, textos en español.
- [ ] Subí la versión en `sw.js` **y** `js/app.js` (mismo número).
- [ ] Archivo nuevo de `js/` agregado a `BASE` en `sw.js`.
- [ ] Subí a una rama de prueba y **releí** cada archivo desde GitHub (líneas, final del archivo, diff).
- [ ] `verificar` en verde en GitHub Actions.
- [ ] Llevé a `main`; `verificar` y `publicar` en verde.
- [ ] `https://fuerzapro.pages.dev/sw.js` muestra la versión nueva.
- [ ] Le expliqué a Luis qué cambió y qué debe probar en el celular.
