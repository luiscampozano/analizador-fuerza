# FuerzaPro — Documento maestro para el Proyecto de Claude

**Autor del proyecto:** Ing. Luis Campozano, MBA
**Actualizado:** 29 de octubre de 2026 · **Versión en producción:** v2.19.0
**App:** https://fuerzapro.pages.dev · **Repositorio:** https://github.com/luiscampozano/analizador-fuerza

Este documento tiene cuatro partes:

1. **Cómo armar el Proyecto en Claude** (pasos para Luis).
2. **Instrucciones del Proyecto** (el "system prompt" para copiar y pegar).
3. **Conocimiento del proyecto** (todo lo hecho, cómo funciona, qué falta).
4. **Cómo trabajamos** (el procedimiento para mejorar la interfaz y publicar sin romper nada).

---

# PARTE 1 — Cómo armar el Proyecto en Claude (paso a paso)

> Un **Proyecto** de Claude guarda dos cosas que no se pierden entre conversaciones:
> unas **instrucciones** fijas y unos **archivos de conocimiento**. Cada chat nuevo dentro del proyecto
> arranca sabiendo todo eso, sin que tengas que volver a explicar.

### Paso 1. Crear el proyecto
1. Entra a **claude.ai** → en el menú lateral, **Proyectos** → **Crear proyecto**.
2. Nombre: `FuerzaPro`.
3. Descripción: `App de fuerza por video + registro de entrenamientos (PWA en Cloudflare). Ing. Luis Campozano, MBA.`

### Paso 2. Pegar las instrucciones
1. Dentro del proyecto, busca **Instrucciones del proyecto** (o "Set project instructions").
2. Copia **todo** el bloque de la PARTE 2 (lo que está entre las líneas `===== INICIO =====` y `===== FIN =====`) y pégalo ahí.
3. Guarda.

### Paso 3. Subir el conocimiento
Sube como archivos del proyecto ("Project knowledge"):
1. **Este documento** (`PROYECTO_CLAUDE.md`).
2. `docs/HANDOFF.md` del repositorio (el manual de cambios seguros).
3. Si tu cuenta permite conectar GitHub al proyecto, agrega el repositorio `luiscampozano/analizador-fuerza`
   (al menos `index.html`, `style.css`, `sw.js`, `_worker.js`, `sql/esquema.sql` y la carpeta `js/`).
   Así Claude puede leer el código real dentro del proyecto. Si no, no pasa nada: el código siempre está en GitHub.
4. Guarda en tu Drive o computadora el archivo **`banco_fuerzapro.zip`** (el banco de prueba del conteo de reps, ver PARTE 3, sección 8).
   No hace falta subirlo al proyecto; es para las sesiones de programación.

### Paso 4. Dónde se programa
- **Para planear, decidir, diseñar pantallas, revisar capturas y redactar:** chats dentro del Proyecto.
- **Para editar el código y publicar:** una sesión de **Claude Code** (claude.ai/code) con el repositorio
  `analizador-fuerza`, que es donde Claude puede leer, probar y subir cambios. El repositorio ahora tiene
  un archivo **`CLAUDE.md`** en la raíz: Claude Code lo lee solo al empezar, así que también arranca con todo el contexto.
- Si una sesión se llena, abre otra: el contexto vive en el Proyecto, en `CLAUDE.md` y en `docs/`, no en la conversación.

### Paso 5. Mantenerlo al día
Al terminar cada etapa importante, pide: *"Actualiza docs/PROYECTO_CLAUDE.md con lo que hicimos"* y vuelve a subir
el archivo nuevo al Proyecto (reemplazando el anterior).

---

# PARTE 2 — Instrucciones del Proyecto (copiar y pegar)

```
===== INICIO =====
Eres el desarrollador principal de FuerzaPro, la app del Ing. Luis Campozano, MBA.

QUIÉN ES LUIS
- Ingeniero químico (ESPOL) con MBA (UEES). No es programador: explícale todo en español sencillo,
  sin jerga, diciendo QUÉ cambió y QUÉ debe probar él en el celular.
- Responde y documenta SIEMPRE en español. Su crédito de autor es "Ing. Luis Campozano, MBA".
- Cuida mucho sus límites de uso: trabaja por partes, una cosa a la vez, sin trabajo que no pidió.
  Respuestas directas; nada de relleno.
- Su celular de prueba es un Xiaomi 13 Ultra (Android, Chrome). Su laptop es una Dell Inspiron sin GPU.

QUÉ ES FUERZAPRO
- PWA (app web instalable) en https://fuerzapro.pages.dev, repo público github.com/luiscampozano/analizador-fuerza
  (rama main). JavaScript puro con módulos ES: sin compilación, sin npm, sin frameworks.
- Analiza videos de series de gimnasio en el propio teléfono (MediaPipe): reps, velocidad, fuerza, RIR/RPE, 1RM.
- Registro de entrenamientos estilo Hevy, Nutrición, Perfil, cuentas (Google/correo) con nube en Cloudflare D1,
  Comunidad con moderación, tarjetas para compartir, reporte de fallos del conteo.
- Publicación automática: cada push a main pasa por GitHub Actions ("verificar" y luego "publicar" en Cloudflare Pages).
- El conocimiento del proyecto (PROYECTO_CLAUDE.md y HANDOFF.md) tiene la arquitectura, el historial y los pendientes.
  Consúltalo antes de responder sobre el código.

ETAPA ACTUAL
- Luis está probando la app y armando un nuevo lote de videos para afinar el analizador.
- Prioridad: ajustes de interfaz que él pida (normalmente con capturas de pantalla).
- NO empezar suscripciones, pagos ni Google Play Store hasta que Luis lo pida explícitamente.

REGLAS PARA CAMBIAR CÓDIGO (obligatorias)
1. Lee el archivo actual completo desde main antes de editar. Busca todos los usos relacionados (ids de HTML en
   index.html, js/*.js y style.css).
2. Cambios mínimos. No reformatees ni "limpies" lo que no te pidieron. Mantén el estilo: nombres en español,
   comillas simples, textos visibles con tildes. Sin dependencias nuevas; todo debe funcionar sin internet.
3. Toda versión que cambie algo visible sube el número EN DOS LUGARES a la vez: sw.js (const VERSION = 'af-X.Y.Z')
   y js/app.js (const VERSION = 'X.Y.Z'). Arreglo = último número; función nueva = número del medio.
   Archivo nuevo en js/ => agrégalo a la lista BASE de sw.js.
4. Antes de publicar: bash pruebas/verificar.sh debe terminar en "TODO BIEN". Si puedes, prueba en Chromium con
   Playwright a 412 px de ancho, con datos de prueba, y mira las capturas.
5. Publica con commit a main; espera que GitHub Actions termine en verde (verificar + publicar) y confirma que
   https://fuerzapro.pages.dev/sw.js muestra la versión nueva. Dile a Luis que cierre y abra la app dos veces.
6. No toques sin necesidad ni sin avisar: js/fisica.js (conteo de reps; mide antes/después con el banco de prueba),
   _worker.js (cuentas y nube; corre las pruebas), VERSION_DB de js/almacen.js, claves de localStorage "af_*",
   ids de ejercicios en js/ejercicios.js, vendor/ y js/anatomia.js.
7. Base de datos D1: solo agregar tablas/columnas (nunca borrar ni renombrar). Primero en sql/esquema.sql, luego
   ejecutar en D1, verificar, y recién entonces publicar el código que la usa.
8. Si Gemini u otra IA hizo cambios, revísalos (git log / diff) antes de construir encima y corrige lo que esté mal.

SEGURIDAD
- Nunca pidas ni muestres el Client secret de Google ni el token de Cloudflare. Luis los pone él mismo en
  GitHub Secrets / Cloudflare. No crees tokens por API.
- Si un filtro de seguridad bloquea algo, no lo rodees (no renombrar, no ofuscar, no subir a servicios externos):
  explícale a Luis qué pasó.
- No borres datos de producción sin su confirmación explícita. El correo de Luis es solo para identificarlo.
- Para GitHub usa la conexión directa de Claude; Composio solo para lo que esa conexión no pueda hacer
  (por ejemplo, consultas a Cloudflare D1).

AL TERMINAR CADA CAMBIO
- Resume en español sencillo: versión, qué cambió, qué corregiste, y una lista corta de qué debe probar Luis.
- Si la etapa fue grande, ofrece actualizar docs/PROYECTO_CLAUDE.md.
===== FIN =====
```

---

# PARTE 3 — Conocimiento del proyecto

## 1. Historia y objetivo

- **Origen (etapa 1, oct 2026):** script de Python en la laptop de Luis (`analizar.py`, YOLO-pose) que procesaba un video
  y generaba un video con esqueleto, flecha de fuerza y gráficas. Validado con un remo en máquina BodyFit de riel inclinado,
  130 kg, 45°, estatura 1,68 m, peso corporal 77,8 kg: 6 reps, v media 0,4–0,6 m/s.
- **Decisión:** llevarlo a una **app en el celular**, al estilo **Hevy** (registro de entrenamientos) **más el análisis por video**.
- **Meta final:** publicarla en **Google Play Store** con **planes de suscripción** para generar ingresos.
  También sirve como contenido para su canal de YouTube **Titan Labs**.
- **Marca:** **FuerzaPro** (el ícono dice "Fuerza"). Logo propio: brazo flexionado con mancuerna.
  Colores: base violeta (#7C5CFF) + cian (#22D3EE) con acentos amarillos IPF (#F2C200), tema oscuro.
- **Trabajo con varias IAs:** Claude es el desarrollador principal. Gemini 3.8 Flash ayuda con cambios (conectado a GitHub y
  Cloudflare vía Composio) siguiendo `docs/HANDOFF.md`. Claude revisa lo que hace Gemini.

## 2. Infraestructura

| Cosa | Valor |
|---|---|
| Repositorio | github.com/luiscampozano/analizador-fuerza (público), rama `main` |
| Producción | https://fuerzapro.pages.dev (Cloudflare Pages, proyecto `fuerzapro`) |
| Cuenta Cloudflare (ID) | `9d467957de4f29b41e0ff6a5eb833561` |
| Base de datos | Cloudflare D1 `fuerzapro-db`, id `f5e490cf-cbb4-4021-9972-c7649911ff18`, enlazada como `DB` |
| Publicación | `.github/workflows/publicar.yml`: trabajo **verificar** (todas las ramas) → **publicar** (solo main, solo si verificar pasó) |
| Secretos GitHub | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Variables Cloudflare | `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` (correos con acceso a moderación) |
| No se publica | `pruebas/`, `docs/`, `sql/`, `README.md`, `CLAUDE.md`, `HANDOFF.md` |
| Dirección antigua | GitHub Pages del mismo repo muestra un aviso de mudanza a fuerzapro.pages.dev |

## 3. Funciones de la app (pestañas)

**Entrenar** (pantalla inicial)
- Registro tipo Hevy: series normales, de calentamiento, al fallo y drop; kg, reps y RPE; descanso con temporizador.
- Rutinas (crear, editar, renombrar, empezar). Al terminar una rutina modificada, la app pregunta si actualizarla.
- Menú ⋯ por ejercicio: reemplazar, ver progreso y músculos, mover arriba o abajo, eliminar.
- 1RM de referencia y peso sugerido por reps y RPE. Calculadora de discos.
- **Constancia:** calendario mensual. Tocar un día abre ese entrenamiento. Debajo, la racha.
- Botón 🧮 Discos (calculadora de discos) junto a "+ Nueva rutina".
- Desde v2.8.0, Entrenar es **solo lo de hoy**: la semana, empezar, rutinas, el calendario de constancia (que se
  queda aquí porque nos distingue de Hevy) y la lista de entrenamientos. La historia pasó a Perfil.
- Tarjetas para compartir al terminar (10 diseños 1080×1350) y publicar en la Comunidad.
- Importar desde Hevy, Strong o CSV/Excel (el historial de Luis: 702 entrenamientos y 14 842 series, todo
  emparejado) y exportar.

**Analizar** (video)
- Elige el ejercicio (169 en la biblioteca, buscador también en inglés, ejercicios propios), la carga y el perfil.
- MediaPipe detecta la pose en el teléfono con modelos lite, full o heavy. Si no ve a la persona, reintenta con
  CPU y luego con el reproductor, y ofrece enviar un diagnóstico.
- Resultados: reps, velocidad media y pico, pérdida de velocidad, fuerza, potencia, RIR/RPE, 1RM estimado,
  alertas de técnica y trayectoria de la barra.
- Genera un video 1080×1920 con telemetría y un informe PDF. También hay un modo en vivo con la cámara.
- **Corregir conteo:** el usuario pone las reps reales y puede **reportar el fallo**; se envía la pose comprimida
  a `/api/fallos`.

**Nutrición:** comidas por día, metas de calorías y macros, base local de alimentos, Open Food Facts y escáner de
código de barras.

**Comunidad:** perfil público (alias), feed Siguiendo/Descubrir, likes, comentarios, seguir, bloquear y reportar.
Panel de **Moderación** (solo ADMIN_EMAILS), que incluye los reportes de fallos del conteo.

**Perfil (tu historia, desde v2.8.0):**
- Arriba: foto y nombre (Editar) y el botón ⚙️, que abre "Ajustes y cuenta".
- Tarjeta **Mis marcas** con pestañas Récords / Powerlifting / Culturismo / CrossFit / Running (recuerda la última) y KPIs.
- "Información", con cuatro botones:
  - 📊 **Estadísticas**: período 7 días / 1 mes / 3 meses / 1 año; cuerpo coloreado (de poco a mucho) y series por
    grupo muscular. Tocar un músculo o un grupo abre sus ejercicios (ventana `pf-grupo`).
  - 🏋️ **Ejercicios**: récords y progreso de cada ejercicio, con buscador y orden. Cada uno muestra el cuerpo
    anatómico, el 1RM, los récords, la gráfica y la tabla de RPE.
  - ⚖️ **Medidas**: peso corporal con gráfica.
  - ⚡ **Análisis de video**: historial de análisis.
- **Ajustes y cuenta (⚙️):** cuenta y nube, importar o exportar (Hevy, Strong, Excel), respaldo completo,
  restaurar, guía y versión.

**Cuentas y nube:** Google o correo con contraseña. Se sincroniza con D1. La app funciona igual sin cuenta y sin
internet.

**Ventanas:** todas tienen botón ‹ Atrás arriba a la izquierda. El gesto o botón Atrás de Android cierra la
ventana de arriba (`js/atras.js`).

## 4. Mapa de archivos

```
index.html  style.css  sw.js(VERSION + lista BASE)  manifest.json  _worker.js(API)  _routes.json(/api/*)
privacidad.html  normas.html  sql/esquema.sql  iconos/  vendor/(NO editar)  pruebas/  docs/  CLAUDE.md
js/app.js         interfaz principal, análisis de video, corrección, VERSION
js/atras.js       botón Atrás y gesto Atrás de Android en las ventanas
js/ejercicios.js  biblioteca (195, con cardio: cardio:true, medida dist|tiempo, vel), grupos, DETECTOR por grupo, ALIAS_IMPORTAR
js/fisica.js      motor físico y conteo de reps (DELICADO)
js/analisis.js    RIR, RPE, 1RM, cargas (VBT)
js/pose.js        MediaPipe (GPU/CPU)          js/lector.js   lectura de video (WebCodecs/Mediabunny)
js/render.js      video con telemetría         js/pdf.js      informe PDF
js/tecnica.js     alertas de técnica           js/trayectoria.js  trayectoria de barra
js/vivo.js        modo en vivo                 js/almacen.js  IndexedDB (VERSION_DB 4)
js/historial.js   series en localStorage       js/sesiones.js + js/excel.js  sesiones y Excel
js/entrenar.js    pestaña Entrenar             js/progreso.js 1RM, récords, RPE, discos
js/importar.js    Hevy/Strong/CSV              js/tarjetas.js tarjetas para compartir
js/anatomia.js    polígonos del cuerpo (MIT)   js/nutricion.js + js/alimentos.js
js/perfil.js      Perfil                       js/nube.js     cuenta y sincronización
js/bienvenida.js  pantalla inicial             js/comunidad.js Comunidad y moderación
```

**Rutas del servidor:**
- `POST /api/auth/google`, `/api/auth/correo`, `/api/auth/clave`
- `GET /api/yo`, `POST /api/salir`, `POST /api/sync`, `DELETE /api/cuenta`, `GET /api/foto/:id`
- `/api/comunidad/*` y `/api/mod/*` (solo administradores)
- `POST /api/fallos`

**Tablas D1:** usuarios, sesiones, items, credenciales, perfiles, publicaciones, seguidores, likes, comentarios,
bloqueos, reportes, fallos.

## 5. Historial de versiones (todas las etapas)

| Versión | Qué se hizo |
|---|---|
| Etapa 1 | Script Python local (YOLO-pose, física, video), validado con remo 130 kg. |
| v1.0 | App web que analiza series en el celular. |
| v1.1 | Arreglo del segundo video, modos de precisión. |
| v1.2 | Decodificador del teléfono (WebCodecs), escala robusta, curl alterno. v1.2.1: conteo más robusto. |
| v1.3 | 124 ejercicios por músculo, buscador en inglés, ejercicios propios. |
| v1.4 | Modo en vivo, perfil carga-velocidad, trayectoria, técnica, sesiones, Excel. |
| v1.5 | Abrir series del historial, PDF por serie. v1.5.1: 1RM de sentadilla. |
| v1.6 | Pestaña Entrenar tipo Hevy, importación. v1.6.1: importación 4-5× más rápida. |
| v1.7 | Rutinas, récords, progreso, 1RM real. |
| v1.8 | Nutrición. |
| v1.9 | Perfil, Comunidad (próximamente), barra reorganizada. |
| v2.0 | Marca FuerzaPro, mudanza a Cloudflare, política de privacidad, arreglo de MediaPipe, reps de preparación. |
| v2.1 | Cuentas con Google y nube (D1). |
| v2.2 | Comunidad completa con moderación. |
| v2.3 | Bienvenida, cuentas con correo, reps lentas. v2.3.1: 1RM con reps lentas. |
| v2.4 | Borrar series, variantes a una pierna o brazo. v2.4.1: reps por zigzag, sin reps de desenganche. |
| — | Publicación automática con GitHub Actions. |
| v2.5.0 | Detector por grupo (sentadilla y peso muerto), corrección manual de reps, reporte de fallos. |
| v2.6.0 | Tarjetas para compartir, importación completa de Hevy (169 ejercicios). |
| v2.6.1 | Tarjeta de músculos anatómica, comparación de volumen con dibujos. |
| v2.6.2 | Reintentos cuando la IA no ve a la persona, filtro de preparación en press, remo y curl. |
| (traspaso) | `pruebas/verificar.sh`, pruebas del servidor, Actions verifica antes de publicar, `docs/HANDOFF.md`. |
| v2.7.0 (Gemini) | Reemplazar ejercicio, menú ⋯, actualizar rutina al terminar, cuerpo con músculos en la ficha del ejercicio. |
| v2.16.0 | Cardio/boxeo: análisis sincronizados con la nube (en informes), botón 🎥 en las filas de cardio de Entrenar con resultado enlazado, y modo en vivo para cardio. |
| v2.17.0 | Boxeo calibrado con video real (manos visibles, sin contar brazos colgando), PDF de cardio/boxeo, curl alterno contado por el codo de cada brazo (muñecos sintéticos + banco 38/59). |
| v2.18.0 | Muñecos 3D: 15 ejercicios × 7 ángulos × cámara fija/en mano/zoom/paneo × 3 escenas (1225/1260). Conteo más robusto de frente y con cámara en mano; dominadas ancladas a las manos; banco 40/59. |
| v2.18.1 | Muñecos: 30 ejercicios (2395/2520, de 91,7 % a 95 %). Primera rep tras acomodarse, caminar hacia la cámara al inicio/final y pantorrilla anclada a las puntas de los pies. Banco 40/59. |
| v2.19.0 | Nutrición: base comunitaria de alimentos por código de barras (tabla D1 `alimentos`, /api/alimentos), búsqueda mis alimentos → comunidad → Open Food Facts, compartir y reportar productos. |
| v2.15.0 | Análisis por video de cardio (carrera, bici, remo, elíptica, cuerda), boxeo y HIIT (`js/actividad.js`), con video propio, vista de resultados e historial «Cardio y boxeo». Validado con esqueletos sintéticos; falta validar con videos reales. |
| v2.14.0 | Al corregir el conteo se rehace el video con las reps corregidas (automático si el original sigue en memoria; si no, botón para elegirlo). |
| v2.13.0 | Segundo contador por ángulos (`js/conteo.js`) combinado con el principal: banco 29 → 37/59, más robusto a cámara y velocidad. Detalle en `docs/DIARIO.md`. |
| v2.12.0 | Editar hora de inicio y duración durante el entreno (tocar ⏱). Al terminar, ventana «Guardar entrenamiento» (título, cómo te fue, foto reducida a 1080 px JPEG, fecha/hora de inicio y duración); Cancelar vuelve al entreno. «✏️ Editar» en el detalle para cambiarlo después. Foto y descripción se ven en el detalle y la lista, y se sincronizan con la nube. Reloj con horas (1:15:00). |
| v2.11.0 | **Cardio**: 26 ejercicios nuevos (grupo «Cardio»: correr, cinta, caminar, bici, spinning, elíptica, remo ergómetro, ski erg, natación, escaladora, cuerda, HIIT, boxeo, baile, deportes…; 195 en total). En Entrenar se registran km + minutos (o solo minutos) con ritmo/velocidad automático; ficha de progreso propia; importación de distancia y tiempo desde Hevy/Strong; pestaña **Running** en Mis marcas. El cardio no aparece en Analizar (sin video) ni en las estadísticas de músculos. |
| v2.10.0 | Tarjeta "Mis marcas" en Perfil con pestañas: Récords (6 levantamientos más pesados de cualquier ejercicio, por defecto), Powerlifting (total y DOTS), Culturismo (series/semana por grupo en 4 semanas + ejercicio más fuerte), CrossFit (arranque, cargada, envión, thruster, sentadilla frontal, dominadas). Running pendiente: la app aún no registra distancia ni tiempo. |
| v2.9.0 | Estadísticas con período (7 días, 1 mes, 3 meses, 1 año; en períodos largos, promedio de series por semana). Tocar un músculo del dibujo o un grupo abre la ventana con sus ejercicios del período (series, máximo, 1RM) y de ahí su progreso. |
| v2.8.1 | Calendario de constancia primero en Entrenar; tocar el logo de arriba lleva siempre a Entrenar. |
| v2.8.0 | Reorganización Entrenar/Perfil: Entrenar = lo de hoy + calendario; Perfil = Powerlifting + Estadísticas (cuerpo de la semana), Ejercicios, Medidas, Análisis de video y ⚙️ Ajustes (cuenta, importar, respaldo). |
| v2.7.1 | Botón Atrás en todas las ventanas y gesto Atrás de Android, calendario mensual de constancia, lista de ejercicios compacta con ventana flotante. Correcciones a v2.7.0: el reemplazo ya no arrastra pesos; la pregunta de rutina ya no se cuelga; "sesiones". |

## 6. Decisiones tomadas por Luis

- Precio y planes (ver sección 9). La familia de Luis recibirá **Pro Max de por vida** (regalo desde el administrador).
- Detectores de reps **por grupo muscular** (uno para cada tipo de movimiento).
- Las reps de preparación (agarrar o soltar la carga) no cuentan; Luis cuenta el **total** de reps de la serie.
- Primero ajustes de interfaz con su uso real; después suscripciones; después Play Store.

## 7. Cómo cuenta las reps el analizador (resumen técnico)

- `js/fisica.js → analizar()` recibe 33 puntos de MediaPipe por cuadro, los interpola y escala px→m con la
  estatura. Calcula la posición del punto seguido relativo a un ancla del cuerpo, que quita el movimiento de
  la cámara.
- **Detector general:** zigzag con umbral sobre la señal de movimiento, más `quitarPreparacion`:
  - quita reps al inicio o final cuya dirección se aparta (agarrar o soltar la carga);
  - quita reps con el codo poco extendido;
  - quita una primera rep anormalmente lenta.
- **Detector "cuerpo"** (`repsCuerpo`) para los grupos de `DETECTOR` en `ejercicios.js`:
  - `fondos`: sentadillas, smith, hack, belt squat, corporal, buenos días;
  - `topes`: pesos muertos.

  Mide la altura del punto sobre los tobillos en la ventana donde los pies están quietos, con un nivel de
  reposo y una amplitud típica. Descarta reps con v > 2 m/s.
- **Segundo contador (v2.13.0):** `js/conteo.js`. Ángulo de la articulación principal de cada ejercicio, contado con histéresis y zigzag sobre los puntos crudos; reemplaza al principal cuando sus dos conteos coinciden y son regulares. **Banco: 37/59** (validación cruzada ~33). Medir con `APP=<repo>/js node pruebas/banco/analizar.mjs` (pasa `frames`).
- **Precisión actual** con el banco de 59 videos de Luis: **29/59 exactas** (empezó en 23/59). Medido otra vez con
  v2.7.1: 29/59.

## 7b. Experimento con ángulos (29/10)
`pruebas/banco/angulos.mjs`: cuenta las reps con ángulos de las articulaciones y con histéresis sobre el % del recorrido.
Saca 27/59 solo. Se complementa con el detector actual: cuando los dos coinciden aciertan el 76 %, y el techo
combinado es 41/59. Detalle en `docs/DIARIO.md`.

## 8. Banco de prueba del conteo (`banco_fuerzapro.zip`)

- Contiene:
  - `kp/*.json.gz`: puntos de la pose de cada video a 30 Hz, extraídos con MediaPipe en Python;
  - `etiquetas.json`: ejercicio, kg y reps reales de 60 videos;
  - los scripts de evaluación.
- Uso:
  1. Descomprímelo en `/home/claude/banco`.
  2. Corre `APP=<repo>/js node analizar.mjs etiquetas.json` y mira la última línea, `ACIERTOS x/59`.
  3. Si quieres el error total, `bash cmp.sh salida.txt`.
- Regla: **ningún cambio de `fisica.js` se publica si baja el total de aciertos**. Se mide antes y después con todos
  los videos.
- Los videos originales (1,5 GB) están en el Drive de Luis. Las etiquetas también están en el artefacto
  "banco" de Claude.
- **Nuevo lote:** cuando Luis entregue los videos nuevos, se procesa así:
  1. extraer los puntos (`extraer.py`);
  2. etiquetar ejercicio y reps reales;
  3. sumarlos al banco;
  4. medir.

  Los reportes de fallos reales (tabla `fallos` en D1) también sirven para el banco.

## 9. Pendientes

**Ahora (prioridad):**
0. **Parte 2 de Perfil** (aprobada por Luis): gráfica semanal con botones Duración / Volumen / Series /
   **Velocidad media de los videos** (lo que nos diferencia de Hevy), una sección "Análisis de video" más rica
   (series medidas y evolución de la velocidad) y seguidores/siguiendo de la Comunidad en la cabecera.
1. Ajustes de interfaz que Luis vaya pidiendo mientras prueba la app.
2. Nuevo lote de videos: etiquetar, ampliar el banco y crear **detectores por grupo** para press y máquinas,
   brazos y espalda (como se hizo con sentadilla y peso muerto).
3. Revisar los reportes de fallos que lleguen a Moderación.
4. Caso abierto: "No se ve bien" en videos de tríceps en el teléfono de un familiar (en escritorio sí detecta).
   La v2.6.2 agregó reintentos y diagnóstico; falta ver si llegan reportes.
5. Posible: imagen de la tarjeta dentro de las publicaciones de la Comunidad.
6. Cardio (hecho en v2.11.0). Posibles mejoras: récords de cardio al terminar, calorías estimadas, distancia en metros para natación.

**Después (solo cuando Luis lo pida):**

*Suscripciones*

| Plan | Precio |
|---|---|
| Gratis | $0 |
| Plus | $3.99/mes |
| Pro | $9.99/mes |
| Pro Max | $19.99/mes |

- Anual = 2 meses gratis. 7 días de prueba de Pro.
- Qué incluye cada plan: confirmar con Luis.
- Implementación:
  - tabla de planes en D1;
  - interruptor general apagado hasta el lanzamiento;
  - modo de prueba;
  - regalar planes desde el administrador.
- Google cobra 15% en suscripciones.

*Google Play Store*
- Empaquetar como TWA (Bubblewrap/PWABuilder) con `assetlinks.json`.
- Cobros con Google Play Billing (Digital Goods API) y validación en el servidor.
- Play Console: ficha, capturas, política de privacidad (ya existe), seguridad de datos, prueba cerrada y luego
  producción.

---

# PARTE 4 — Cómo trabajamos para mejorar la interfaz

### Lo que hace Luis
1. Usa la app en su Xiaomi, toma **capturas de pantalla** de lo que quiere cambiar.
2. Las manda en el chat con una descripción corta ("falta un botón atrás", "que sea un calendario", "más compacto").
3. Cuando se publica, **cierra y abre la app dos veces** y prueba lo que se le indique.

### Lo que hace Claude en cada pedido
1. **Entender:** interpretar las capturas; si algo es ambiguo y caro de rehacer, preguntar una sola vez; si no, decidir lo
   más razonable y decirlo.
2. **Actualizar:** `git pull` del repo; revisar si hubo cambios de Gemini (`git log`, `git diff`) y corregir lo que esté mal.
3. **Ubicar:** buscar los ids, funciones y estilos implicados (`index.html`, `js/<pestaña>.js`, `style.css`).
4. **Editar con cambios mínimos**, respetando el estilo y los colores del tema (variables `--accent-green` violeta,
   `--accent-blue` cian, `--accent-orange` amarillo, `--bg-card`, `--bg-input`, `--border-color`, `--text-muted`).
5. **Subir versión** en `sw.js` y `js/app.js`. Si hay archivo nuevo en `js/`, agregarlo a `BASE` de `sw.js`.
6. **Verificar:**
   - `bash pruebas/verificar.sh`: sintaxis, versión, caché y 98 pruebas del servidor.
   - Prueba en Chromium con Playwright a 412×900, con entrenamientos de prueba cargados en IndexedDB
     (`almacen.guardarEntrenos`) y `localStorage.af_bienvenida = 'omitida'` para saltar la bienvenida.
     Se toman capturas y se revisan, y se prueba el flujo completo: abrir, cerrar, gesto Atrás y guardar.
7. **Publicar:** commit a main con mensaje `vX.Y.Z: …` en español; esperar a que GitHub Actions termine en verde;
   comprobar que `https://fuerzapro.pages.dev/sw.js` muestra la versión nueva.
8. **Informar a Luis:** qué cambió, qué se corrigió y qué probar, en lenguaje sencillo y breve.

### Cuando el cambio es grande
- Dividirlo en partes publicables (una versión por parte) para no gastar el límite de uso de una sola vez.
- Para cambios de riesgo, primero en una rama `cambio/<nombre>` (ahí solo corre "verificar") y luego a main.

### Si algo sale mal
- Revertir el commit (no usar force push), subir la versión y publicar. La versión anterior queda en línea mientras
  "verificar" falle.
