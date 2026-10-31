# Diario de FuerzaPro

Bitácora de trabajo, de la más reciente a la más antigua. **Regla:** antes de empezar cualquier actividad, lee las
últimas entradas; al terminarla, agrega una entrada arriba con: fecha y hora (Ecuador), qué pidió Luis, qué se hizo,
versión publicada y qué quedó pendiente. Escribe en español sencillo.

---

## 2026-10-30

### 21:51 · v2.21.2 — Moderación: descargar los fallos reportados para Claude
- **Pidió:** seguir con la hoja de ruta.
- **Revisado** (D1, solo lectura): hay 1 fallo reportado.
  - Press de banca, v2.6.1, la app contó 12 y eran 10; la persona excluyó las reps de 3,93 s y 6,23 s.
  - Comentario: «Me contó mientras me acomodaba en la máquina».
  - Traer sus puntos (165 KB) a través del chat no es práctico.
- **Hecho:** en Comunidad → 🛡️ Moderación, cada fallo tiene dos botones nuevos (`js/comunidad.js`):
  - «⬇️ Descargar para Claude»: baja `fallo_<ejercicio>_real<N>_app<M>_<id>.json.gz` con el formato del banco
    (W, H, dur, hz, frames) más los datos del fallo (reps reales, excluidas, comentario, versión);
  - «✓ Corregido».
  - Probado en Chromium con datos simulados: el archivo se descomprime con el formato correcto.
- **Siguiente:** Luis descarga el fallo de press banca y lo adjunta en el chat; se agrega al banco y se corrige.

### 21:42 · v2.21.1 — Lectura de etiquetas: mejoras con la primera etiqueta real
- **Luis probó** con una funda de fideos: plástico arrugado y con reflejos.
  - 1.er intento: solo leyó la porción.
  - 2.º intento: porción 70, proteína 9 y carbohidratos 53; faltaron calorías y grasa, y quedó «por 100 g» por error.
- **Hecho** (`js/etiqueta.js`, `js/nutricion.js`):
  - Errores del OCR que ahora se reconocen:
    - «Calorías» leída como «Calonon»/«Calo-»: vale cualquier fila con kcal/kJ (no la de «calorías de grasa»);
    - «kca)», «k)» y «kcah» se toman como kcal/kJ;
    - «totalig» = «total 1 g» y «saturadaog» = «0 g».
  - Si hay calorías y 2 macros, el 3.º se **calcula** (4·P + 4·C + 9·G) y se marca en amarillo; si faltan las
    calorías y están los 3 macros, se calculan las calorías.
  - «Por 100 g» solo se elige si la etiqueta trae esa columna (con porción y una sola columna, los datos son por
    porción).
  - Foto a 2000 px de lado (antes 1600). Si falta algún dato, se hace una segunda lectura con la tabla como un solo
    bloque (psm 6) y se completan los datos.
  - «Ver lo que leyó la cámara» muestra el texto del OCR, para mandar captura cuando falle.
  - Prueba nueva con el texto de la etiqueta real (fideos: 260 kcal, P 9, C 53, grasa calculada 1,3; la etiqueta
    dice 1 g).

### 21:29 · v2.21.0 — Nutrición: leer la tabla de la etiqueta con la cámara
- **Pidió:** la foto de la etiqueta para que el formulario del producto nuevo se llene solo.
- **Hecho:**
  - `vendor/tesseract/` (~10 MB, licencia Apache 2.0):
    - Tesseract.js 6.0.1 con su motor 6.0.0 (versiones con SIMD y sin SIMD);
    - el idioma español en versión «best_int»;
    - todo funciona en el teléfono y sin internet. Se descarga solo la primera vez que se usa (el service worker lo
      guarda; no va en la lista BASE).
  - `js/etiqueta.js`:
    - `leerEtiqueta(foto)`: pasa la foto a gris con más contraste, la escala a ~1600 px y hace el OCR;
    - `interpretar(texto)` saca porción, kcal (convierte kJ si no hay kcal), grasa, carbohidratos y proteína;
    - detecta la columna «por 100 g/ml»;
    - corrige errores típicos del OCR: «g» leída como «9» («6 g» → «69»), comas perdidas («6,4 g» → «649»),
      «og» = «0 g» y «mi» = «ml»;
    - cuando hay duda, elige la combinación cuyas kcal (4·P + 4·C + 9·G) cuadran con la etiqueta.
  - **Formulario de alimento nuevo:** botón «📷 Leer la tabla de la etiqueta con la cámara». Llena los campos y los
    marca en violeta; el usuario los revisa antes de guardar.
  - Prueba nueva en `verificar.sh`: `pruebas/etiqueta/interpretar.mjs` (5 etiquetas, incluidos textos reales del OCR).
  - Probado de punta a punta en Chromium con 2 fotos sintéticas (borrosas, giradas y con ruido): 4 de 4 datos
    correctos en ~2 s.
- **Pendiente:** probar con etiquetas reales ecuatorianas en el Xiaomi. Foto del plato: decidir (requiere IA de
  visión con costo).

### 21:20 · v2.20.0 — Perfil parte 2: últimas 12 semanas, análisis de video y seguidores
- **Pidió:** hacer la parte 2 del Perfil (estaba aprobada en la hoja de ruta).
- **Hecho** (`js/perfil.js`, `index.html`, `style.css`):
  - **Cabecera:** seguidores · siguiendo · publicados de la Comunidad.
    - Se leen de `/api/comunidad/u/<alias>`, solo con sesión y perfil público.
    - Se recuerdan en `af_pf_social` para verlos sin internet.
    - Al tocarlos se abre el perfil público (`comunidad.verPerfil`, nuevo export).
  - **Últimas 12 semanas:** gráfica con botones Duración (h; máx. 4 h por entreno si se olvidó terminar), Volumen (t),
    Series y ⚡ Velocidad (promedio de la mejor rep de las series con video, en línea). Recuerda la elegida en
    `af_pf_sem`.
  - **⚡ Análisis de video:**
    - totales: series medidas, últimos 30 días y m/s promedio con cambio % frente a los 30 días anteriores;
    - los 5 ejercicios más analizados, cada uno con minigráfica de su velocidad y la comparación **con la misma
      carga** (la que más usa): ▲/▼ % entre su primera y su última serie con ese peso;
    - al tocar un ejercicio se abre su última serie.
  - Nuevos deps de perfil en `app.js`: `abrirSerie`, `alias`, `verPerfil`.
- **Probado:** en Chromium a 412 px con 30 entrenos y 25 series de prueba; sin errores.

### 16:29 · Muñecos: zancadas reales, cambio de pierna y series cortas (sin cambio de versión)
- **Pidió:** volver a hacer los muñecos para seguir refinando el analizador; y qué sigue en la hoja de ruta.
- **Hecho** (`pruebas/munecos/munecos.mjs`): 3 variantes basadas en los fallos del banco real.
  - Zancada alternada con paso adelante y regreso (`zancada@alterna`).
  - Zancadas caminando (avanzan 0,6 m por rep y la cámara las sigue).
  - Búlgara con cambio de pierna a mitad del video (`bulgara_mancuernas@2piernas`; el banco tiene uno de 9+9).
  - Escena nueva «pocas reps» (2 reps con acomodarse antes y después).
  - El guion pasa a cada muñeco la rep en curso (`k`), su avance (`u`) y las reps hechas.
- **Resultado:** 3275/3465 tomas exactas (94,5 %). De los 190 errores, 127 son de zoom/caminar con el celular.
- **Probado y descartado** (no mejoraron o empeoraron muñecos/banco):
  - no dejar que los ángulos quiten la mitad de las reps;
  - recortar la 1.ª rep larga después de caminar;
  - aviso de «cámara se acercó/alejó»: en el banco real el tamaño cambia hasta 2× por la postura (sentadillas),
    así que daría falsos avisos.
- **Conclusión:** el código actual ya está en su límite con muñecos. Lo que falta se gana con videos reales nuevos
  (zancadas, búlgaras con 2 piernas, series de 1-2 reps) y con los reportes de «Corregir conteo».
- Mínimo de muñecos en `verificar.sh`: 3270. Banco real: 40/59.

## 2026-10-29

### 19:28 · v2.19.0 — Base de alimentos de la comunidad por código de barras
- **Pidió:** qué hacer cuando el código de barras no encuentra el alimento; que haya una base nacional de códigos.
  Luego: foto del plato para calcular calorías.
- **Investigado:** no hay una base pública y gratuita de códigos de Ecuador con datos nutricionales.
  - GS1 Ecuador registra los códigos, pero sin tabla nutricional y solo para sus socios.
  - Open Food Facts tiene pocos productos ecuatorianos.
  - USDA FoodData Central (dominio público) es de productos de EE. UU. y pide clave.
  - Solución: base propia que crece con los usuarios.
- **Hecho:**
  - Tabla `alimentos` en D1 (`sql/esquema.sql`).
  - Endpoints:
    - `GET /api/alimentos/:codigo` y `GET /api/alimentos?q=` (públicos);
    - `POST /api/alimentos` (con sesión; valida que las kcal cuadren con los macros; 50 por día; no se pisa el de
      otra persona);
    - `POST /api/alimentos/:codigo/reportar` (3 reportes = oculto);
    - moderación: ver, ocultar o borrar alimentos reportados.
  - Al borrar una cuenta, sus productos quedan sin autor.
  - **App** (`js/nutricion.js`):
    - el escaneo busca en este orden: mis alimentos (ahora también por código, antes no) → comunidad FuerzaPro →
      Open Food Facts → crear con la etiqueta;
    - el formulario tiene campo de marca y «Compartir con la comunidad» (marcado si hay sesión);
    - «Buscar en internet» muestra primero la comunidad;
    - botón «⚠️ ¿Datos incorrectos?».
  - Pruebas: `pruebas/servidor/alimentos_test.mjs` (21 OK). UI probada en Chromium a 412 px.
- **D1:** el filtro de seguridad no dejó crear la tabla desde aquí; Luis corrió el SQL
  en el panel de Cloudflare (19:31). Publicado y verificado: /api/alimentos responde en producción.
- **Pendientes:** foto de la etiqueta (OCR) para llenar el formulario solo; foto del
  plato (necesita una IA de visión con costo por uso: decidir).

### 16:40 · v2.18.1 — Muñecos: 30 ejercicios y menos errores
- **Pidió:** agregar las familias que faltaban y seguir bajando el error lo más posible. Después: nutrición (alimentos
  que el código de barras no encuentra, base nacional de códigos) y foto del plato para calorías.
- **Hecho (muñecos):**
  - 15 ejercicios nuevos en `pruebas/munecos/munecos.mjs`: zancada, búlgara, prensa 45°, curl femoral sentado, remo en
    polea, face pull, cruce de poleas, cargada, push press, abdominales, elevación de piernas colgado, pantorrilla de
    pie, encogimientos, fondos y remo con mancuerna;
  - total: 30 ejercicios × 84 tomas = 2520;
  - cada toma tiene su propia semilla fija (se puede repetir una sola para revisarla).
- **Resultado:** de 2310/2520 a 2395/2520 (91,7 % → 95,0 %); las tomas con error bajaron de 210 a 125. Banco real
  sin cambios: 40/59. Mínimo en `verificar.sh`: 2390.
- **Arreglos en `js/fisica.js`:**
  - **Primera rep después de acomodarse:** «sacar la barra» se mide con el tiempo de subida desde el 10 % del
    recorrido (`ts10`). Antes el temblor en reposo alargaba esa rep y se borraba.
  - **Caminar hacia la cámara al inicio o al final:**
    - si la persona se ve >35 % más grande o más chica, ese tramo se congela (`congelarAcercamiento`, no en alternos);
    - en sentadilla/peso muerto, la altura que sigue subiendo al final se corta;
    - una subida que sigue de largo (la última rep unida con caminar) se corta al nivel de los demás topes.
- **Arreglos en `js/ejercicios.js`:**
  - pantorrilla (de pie, Smith, unilateral): ahora sigue tobillos respecto a las puntas de los pies (`ancla: 'puntas'`).
    Antes seguía los hombros sin ancla, y con la cámara en mano no contaba;
  - en los muñecos de pantorrilla pasó de 41 a 76 de 84 tomas exactas.
- **Probado y descartado:**
  - escala más libre (±40 % / ±70 %) y corrección lenta de zoom: mejoran los muñecos, pero bajan el banco real
    (40 → 36–38);
  - ventana para el fondo de cada rep: empeoró todo.
- **Pendientes (límites conocidos):**
  - zoom fuerte / caminar con el celular a mitad de la serie (~80 de los 125 errores);
  - face pull y curl femoral filmados de frente (el movimiento va hacia la cámara);
  - remo con mancuerna con el brazo que trabaja del lado lejano (tapado);
  - encogimientos (recorrido de 7 cm).
- **Siguiente:** nutrición.

### 15:32 · v2.18.0 — Muñecos 3D desde todos los ángulos y con cámara en movimiento
- **Preguntó:** dónde quedan las series analizadas y si Claude puede revisar los videos en la nube.
  - **Respuesta:** en Cloudflare D1 solo se guardan los resultados (números), no los videos.
  - Los reportes de «Corregir conteo» sí traen el esqueleto: con eso Claude puede reproducir y arreglar errores.
- **Pidió:** seguir afinando el analizador de cada ejercicio con muñecos, desde todos los ángulos posibles y con
  movimiento de cámara.
- **Hecho:** `pruebas/munecos/munecos.mjs` (en `verificar.sh`; mínimo 1220 tomas):
  - 15 ejercicios en 3D: sentadilla, peso muerto, rumano, curl, martillo, tríceps polea, press militar, laterales,
    remo, banca, jalón, hip thrust, dominadas, flexiones y extensión de cuádriceps;
  - 7 ángulos de cámara: lateral, 60°, 45°, 20°, frente, diagonal de atrás y lado contrario;
  - 3 alturas de cámara;
  - 4 movimientos de cámara: fija, en mano, zoom/caminar y paneo;
  - 3 escenas: limpia, ritmo irregular (fatiga, pausas, profundidad variable) y acomodarse (caminar, movimientos
    chicos y alejarse al final);
  - la mano o pierna del lado lejano sale tapada (poca visibilidad y más ruido), como en los videos reales.
- **Resultado:** de 1197/1260 a 1225/1260 tomas exactas; las tomas con error bajaron de 63 a 35. El banco real pasa
  de 38 a 40/59.
- **Arreglos:**
  - **Contador por ángulos** (`js/conteo.js`, `js/fisica.js`) — ya no reemplaza al principal cuando:
    - el ángulo casi no cambia en la imagen (menos de 40°);
    - cuenta menos de 2 reps;
    - le quitaría reps a un conteo con reps parejas.
  - **Hip thrust / puente:** cuenta con el ángulo de cadera, no con el de rodilla.
  - **Filtro de «preparación»:** si el torso se ve muy corto (de frente o acostado hacia la cámara), no se compara
    su ángulo ni su largo, que cambian con cualquier movimiento de cámara.
  - **Sentadilla y peso muerto** (detector de cuerpo completo): caminar = pies que se mueven rápido. Un paneo lento
    o el temblor ya no cortan la serie.
  - **Dominadas, chin-up y asistidas:** se miden respecto a las manos (la barra no se mueve), no a la imagen. Así el
    temblor de la cámara no cambia el conteo.
- **Probado y descartado:** calcular la escala con la pierna cercana cuando la lejana no se ve. Mejoraba los
  muñecos con zoom (+7), pero empeoraba un video real (press francés 9→10).
- **Pendientes:**
  - zoom fuerte / caminar con el celular (la escala no sigue el zoom si el lado lejano no se ve);
  - acomodarse antes de la 1.ª rep (a veces se pierde la 1.ª);
  - siguientes familias: zancadas, prensa, polea, olímpicos, core.

### 15:09 · v2.17.0 — Boxeo calibrado con video real, PDF de cardio/boxeo y curl alterno por codos
- **Pidió:** el boxeo no contó todos los golpes y contó a destiempo; reporte PDF de la serie analizada; usar
  «muñecos» (esqueletos sintéticos) para arreglar el curl alterno; explicar la idea de imágenes en Comunidad.
- **Hecho:**
  - **Boxeo** (`js/actividad.js`), calibrado con su video (golpes marcados a mano cuadro por cuadro):
    - antes: 15 golpes, 8 de 20 bien y 6 falsos (3 al caminar hacia la cámara con los brazos colgando);
    - ahora: 20 golpes, 20 de 21 bien, 0 al caminar;
    - solo usa los puntos de la mano que la IA ve bien (la mano lejana suele quedar tapada);
    - un golpe cuenta solo con la muñeca a la altura del torso (brazo colgando no cuenta);
    - el largo del brazo se mide con la mano arriba; umbrales más finos (zigzag 0,10, pico 0,62);
    - el primer golpe del video ya cuenta;
    - guardia baja: solo con manos visibles y el brazo recogido (antes 82 % por la mano tapada; ahora 20 %).
  - **PDF de cardio/boxeo/HIIT:**
    - botón «📄 Informe PDF» en el resultado (`crearPDFActividad` en `js/pdf.js`);
    - contenido: datos clave, cuadro del video, técnica, gráfica de ritmo y tabla de cada golpe/paso (tiempo, mano, tipo).
  - **Curl alterno** (`contarAlterno` en `js/conteo.js` y `analizarAlterno` en `js/fisica.js`):
    - cada brazo se cuenta por su ángulo de codo, solo con cuadros donde la IA ve ese brazo;
    - si la IA pierde el brazo >0,4 s, no se unen los tramos;
    - una rep del codo debe coincidir con una subida real de la mano;
    - si la IA casi no ve un brazo, se cuenta como antes.
  - **Pruebas nuevas** (en `verificar.sh`):
    - `pruebas/alterno/sinteticos.mjs`: 4 muñecos (limpio, cámara en mano, pausas largas, mano tapada); todos OK;
    - `pruebas/actividad/boxeo_real.mjs`: con los puntos del esqueleto de su video, sin imagen.
    - Antes el curl alterno real del banco daba 12 (real 6) y ahora da 6; el banco pasa de 37 a 38/59.
- **Explicado:** imágenes en Comunidad (guardarlas en el servidor tiene costo; decide Luis).
- **Pendientes:**
  - más videos reales de boxeo (de frente, con las dos manos visibles) y de otros cardios;
  - botón para bajar los reportes de fallos de D1 al banco.

### 16:05 · v2.16.0 — Pendientes de cardio: nube, Entrenar y modo en vivo
- **Pidió:** hacer todos los pendientes mientras graba videos de boxeo.
- **Hecho:**
  - **Nube:** los análisis de cardio, boxeo y HIIT se guardan en el almacén de informes (`actividad: true`). Así se
    sincronizan con la nube y entran al respaldo sin cambiar el servidor. Los de la v2.15.0 (`af_actividades`) se
    mudan solos una vez. El historial «Cardio y boxeo» los lee de ahí. Los videos siguen solo en el teléfono.
  - **Entrenar:**
    - las filas de cardio analizables tienen botón 🎥, que abre Analizar con el aviso de la serie;
    - el resultado queda pegado a la fila («⚡ 172 pasos/min · 344 pasos · ver análisis») y llena los minutos con la
      duración del clip si estaban vacíos;
    - «Volver» regresa al entrenamiento y el detalle del entrenamiento muestra el enlace ⚡.
  - **Modo en vivo para cardio:**
    - muestra el total (pasos, golpes, saltos…), el ritmo por minuto y el tiempo; cada 30 s dice el ritmo en voz alta;
    - sin aviso de pérdida de velocidad. Al terminar se analiza el video completo como siempre.
  - Arreglo: si no hay movimientos, el ritmo se muestra «--» en vez de 0.
  - Prueba: `pruebas/actividad/act2_e2e.js` en Chromium con la IA real y cámara simulada (todo OK).
- **Revisión de reportes de fallos (D1):** hay 1, de press de banca (v2.6.1, la app contó 12 y eran 10; comentario:
  «me contó mientras me acomodaba en la máquina»). Ese caso es justo el que corrigió el filtro de preparación de la
  v2.6.2. Traer la pose (165 KB) por Composio se corta en el camino; hace falta una herramienta de descarga directa
  (por ejemplo, una ruta de administrador `/api/mod/fallos/:id` que la app ya tiene, usada desde el panel de
  Moderación con un botón «Descargar para el banco»).
- **Pendiente:**
  - Videos reales de boxeo (Luis los está grabando) para calibrar el detector de golpes.
  - Pendientes anteriores: conteo propio para los ejercicios alternos, llevar los reportes de fallos de D1 al banco
    e imagen de la tarjeta en la Comunidad.


### 15:40 · v2.15.0 — Análisis por video de cardio, boxeo y HIIT
- **Pidió:** usar el analizador en cardio (correr, bici, etc.), boxeo y expandirlo («hazlo todo»).
- **Hecho:**
  - Nuevo `js/actividad.js`; se elige en Analizar como cualquier ejercicio.
  - **Carrera y caminata** (cinta, correr, intervalos, caminar, cinta inclinada, senderismo):
    - cadencia (pasos/min), pasos, rebote vertical (cm), pie al pisar (cm delante de la cadera), inclinación del
      tronco y asimetría entre piernas;
    - alertas: cadencia < 155, rebote > 10 cm, sobrezancada > 35 cm, tronco > 20° o hacia atrás.
  - **Bici** (estática, spinning, exterior, de aire): RPM y ángulo de rodilla abajo (sillín: ideal 140-150°; < 135
    bajo, > 155 alto). También cierre de cadera arriba y alerta de cadencia < 60.
  - **Remo ergómetro:**
    - remadas/min y relación recuperación : empuje (ideal 2 : 1);
    - codo al 80 % del empuje de piernas (secuencia piernas → espalda → brazos) e inclinación al final (10-30°).
  - **Ski erg, elíptica y escaladora:** ritmo y postura del tronco.
  - **Saltar la cuerda:** saltos, saltos/min y altura del salto (alerta > 8 cm).
  - **Boxeo (saco):**
    - golpes por mano, golpes/min, velocidad de la mano (m/s, aprox.) y tipos (recto / gancho / uppercut, aprox.);
    - % de tiempo con la guardia baja; alertas de guardia, de usar una sola mano y de grabar a menos de 60 fps.
  - **HIIT:**
    - nuevos ejercicios burpees, jumping jacks y escaladores (mountain climbers); biblioteca: 198;
    - cuentan reps y ritmo, junto con cuerdas de batalla y HIIT genérico.
  - Video con telemetría propio (esqueleto, contador, ritmo en vivo, gráfica, destello en cada golpe y alertas).
  - Vista de resultados `v-actividad` y pestaña **«Cardio y boxeo»** en Perfil → Análisis de video.
  - Se guarda en `localStorage af_actividades`: no se sincroniza con la nube todavía.
  - En Analizar se ocultan los campos de peso y el modo en vivo para estas actividades, y se muestra un consejo de
    cómo grabar cada una.
- **Pruebas:**
  - `pruebas/actividad/sinteticos.mjs`: esqueletos sintéticos con valores conocidos. Los 6 casos dan lo esperado:
    170 pasos/min, rebote de 8 cm, tronco de 8°, 90 RPM, rodilla, 24 remadas/min con relación 1,9 : 1,
    120 saltos/min de 3,8 cm, 28/30 golpes rectos y 15 burpees/min.
  - `pruebas/actividad/act_e2e.js`: cadena completa en Chromium con la IA real (analizar → video → resultado →
    historial).
  - **Falta validar con videos reales** de cada actividad: 2-3 clips de 20-60 s de lado.
- **Pendiente:**
  - Videos reales para calibrar umbrales.
  - Sincronizar `af_actividades` con la nube.
  - Botón 🎥 en las filas de cardio de Entrenar para analizar desde ahí.
  - Modo en vivo para cardio.


### 15:10 · v2.14.0 — El video se corrige al corregir el conteo
- **Pidió:**
  - Que al corregir el conteo también se corrija el video del analizador.
  - Preguntó cómo llegan las actualizaciones si la app está en Play Store.
- **Hecho:**
  - Al guardar la corrección se vuelve a calcular la serie con los puntos guardados y se **rehace el video**
    (esqueleto, gráficas y contador «Reps») con las reps corregidas.
  - Si el video original sigue en memoria (se analizó en esta sesión; se recuerdan los últimos 5), lo hace solo.
  - Si no, aparece el botón **«🎬 Actualizar el video con el conteo corregido»**, que pide elegir el video original y
    avisa si la duración no coincide.
  - Si corriges a **más** reps de las detectadas, el contador del video muestra tu total al final de la serie.
  - Nuevas funciones en `js/app.js`: `crearVideoSerie`, `rehacerVideo` y `archivosSesion`; opción `repsTotal` en
    `js/render.js`.
  - Prueba completa en Chromium con la IA real (sentadilla de 5 reps → corregida a 4 → el video se rehízo y muestra
    «Reps: 4»).
- **Respuesta a Luis:** con la app en Play Store empaquetada como TWA, los cambios de la web le llegan a todos solos.
  Solo hay que subir una versión nueva a Play cuando cambia el "envoltorio" Android (nombre, ícono, permisos, nivel
  de API que exige Google cada año).


### 14:40 · v2.13.0 — Segundo contador de reps por ángulos (todos los ejercicios)
- **Pidió:** aplicar todas las mejoras al analizador, que funcionen con todo tipo de ejercicio y sin depender de muchos videos.
- **Hecho:**
  - Nuevo `js/conteo.js`. Cuenta las reps con el ángulo de la articulación que mueve cada ejercicio (codo, hombro,
    cadera, rodilla, tobillo), con la distancia entre manos (aperturas, pec deck, pájaro), con la distancia entre
    rodillas (abductores) o con la altura de los hombros (encogimientos). Asigna la señal automáticamente a los 169
    ejercicios de fuerza y a los creados por el usuario.
  - Cuenta con % del recorrido e histéresis (30 %/70 %) y con un segundo zigzag sobre la misma señal.
  - Usa los puntos crudos de la IA (sin interpolar). Así se validó, e interpolando la mejora desaparecía.
  - **Regla:** si el contador principal y el de ángulos no coinciden, gana el de ángulos solo cuando sus dos
    conteos coinciden entre sí y sus reps son regulares (variación de duración < 55 %).
  - **Validación** (banco de 59 videos, sin videos nuevos):
    - **29 → 37 exactos**; error total 103 → 84 reps. Mejoran 11 videos y empeoran 2 (un jalón de 8 → 7 y un
      rack pull de 6 → 2).
    - Validación cruzada (40 repeticiones de 5 partes): ~33 de 59 con videos que la regla no vio.
  - **Robustez:** variaciones sintéticas de los mismos videos (cámara girada 8°, 60 % más lejos, temblor de 4 px,
    paneo, video 25 % más rápido o 20 % más lento). El contador nuevo gana en todas (34-37/59 contra 22-29/59) y casi
    no le afecta la velocidad del video.
  - El modo en vivo y los ejercicios alternos (curl alterno) siguen con el contador principal.
  - `res.conteo` indica qué contador se usó.
  - Herramientas en `pruebas/banco/`: `tabla_app.mjs`, `cv_app.py`, `robustez.mjs` y `analizar.mjs`, que ahora
    pasa los puntos crudos.
- **Pendiente:**
  - Señal propia para los alternos.
  - Llevar los reportes de fallos de D1 al banco (ya traen los puntos y la versión).
  - Probar con el lote nuevo de videos de Luis cuando lo tenga.
  - Mejorar los 22 videos que siguen fallando: extensión de cuádriceps, búlgaras, zancada, remo en máquina,
    press con mancuernas y aperturas.


### 13:20 · Análisis: cómo mejorar el analizador sin depender de muchos videos de Luis
- **Pidió:** que el analizador falle menos sin tener que grabar tantos videos. Mandó capturas de un reel de
  @juvebobadillo3 que cuenta perfecto el cierre de manerales en una pec deck.
- **Por qué el del reel no falla:** mide **un solo ejercicio** en **una sola máquina**, con cámara fija de frente.
  Su señal es la distancia entre las manos convertida a **% del recorrido** (0 % abierto, 100 % cerrado) y cuenta
  una rep cuando pasa el umbral de cierre y vuelve a abrir (histéresis). Nuestra app intenta 169 ejercicios, con
  cámara en mano y desde cualquier ángulo.
- **Prueba hecha** (`pruebas/banco/angulos.mjs`, sobre el banco de 59 videos ya etiquetados, sin videos nuevos):
  contar con **ángulos de las articulaciones** (codo, rodilla, cadera…) y con distancias medidas en "torsos". Estas
  señales no cambian si la cámara se mueve o se acerca. Se usa % del recorrido y umbrales 30 %/70 %.
  - Con la señal elegida según el ejercicio: **27/59** exactos. El analizador actual saca **29/59**.
  - Cuando los dos métodos dan el mismo número (21 videos), aciertan 16 (76 %).
  - Si en cada video se eligiera bien entre los dos métodos, el techo sería **41/59**.
  - Los métodos se complementan: el de ángulos acierta donde el actual falla (curl martillo, jalón, press de hombro,
    pájaro, sentadillas de 1-3 reps) y viceversa (press francés, tríceps, rack pull).
  - Fallas del método de ángulos: cuenta doble cuando el recorrido es corto y la señal tiene ruido (press francés
    18 en vez de 9). Un intento de fusionar reps más juntas que medio período empeoró (24/59); queda descartado.
- **Pendiente (propuesto a Luis):**
  1. Combinar los dos métodos con una regla de confianza y validarla con validación cruzada para no
     "aprenderse" el banco.
  2. Señal propia por ejercicio para máquinas como la pec deck y las aperturas (distancia entre manos en % del recorrido).
  3. Probar la robustez con variaciones sintéticas de los videos que ya tenemos (rotar, escalar, agregar ruido,
     acelerar).
  4. Usar los reportes de fallos de los usuarios como banco que crece solo.
  5. Opcional: bases de datos públicas de conteo de repeticiones para investigación (RepCount, Countix), si la red
     lo permite y Luis está de acuerdo.

### 13:16 · Diario
- **Pidió:** escribir todo lo que se hace en un documento tipo diario y leerlo antes de cada actividad.
- **Hecho:** se creó este `docs/DIARIO.md` y se agregó la regla en `CLAUDE.md`.

### 12:07 · v2.12.0 — Editar hora y duración, ventana «Guardar entrenamiento»
- **Pidió:** poder editar la hora y la fecha durante y después del entreno; al terminar, poner foto, nota, etc. (como Hevy).
- **Hecho:**
  - Al tocar ⏱ se pueden cambiar la duración o la hora de inicio.
  - Al terminar aparece la ventana con título, «¿cómo te fue?», foto (reducida a 1080 px), fecha y duración.
    Cancelar vuelve al entreno.
  - Botón ✏️ Editar en el detalle. La foto se ve en el detalle y en la lista.
  - El reloj muestra horas (1:15:00).
- **No incluido:** gimnasio, visibilidad, Health Connect (este último requiere la app de Play Store).

### 11:52 · v2.11.0 — Cardio
- **Pidió:** registro de cardio con todo tipo de cardio en la biblioteca.
- **Hecho:**
  - 26 ejercicios de cardio; la biblioteca queda en 195.
  - Se registran km y minutos, con ritmo, km/h, /500 m o /100 m según el ejercicio.
  - Ficha propia por ejercicio de cardio.
  - Importa distancia y tiempo desde Hevy y Strong.
  - Pestaña Running en Mis marcas.
  - El cardio no aparece en Analizar.
- **Para Luis:** volver a importar el CSV de Hevy agrega 5 sesiones de cardio antiguas (sin duplicar).

### 11:45 · v2.10.0 — Mis marcas
- **Pidió:** que la tarjeta de powerlifting sirva para cualquier persona, con pestañas por disciplina.
- **Hecho:** pestañas Récords (por defecto), Powerlifting, Culturismo y CrossFit.

### 11:40 · v2.9.0 — Estadísticas por período
- **Hecho:**
  - Períodos de 7 días, 1 mes, 3 meses y 1 año.
  - Tocar un músculo del dibujo o un grupo abre sus ejercicios. El toque tolera bordes.

### 11:27 · v2.8.1
- **Hecho:** el calendario de constancia va primero en Entrenar; tocar el logo lleva a Entrenar.

### 11:18 · v2.8.0 — Reorganización Entrenar / Perfil
- **Hecho:**
  - Entrenar queda con lo de hoy y el calendario.
  - Perfil queda con Powerlifting, Estadísticas (cuerpo de la semana), Ejercicios, Medidas, Análisis de video y
    ⚙️ Ajustes (cuenta, importar, respaldo).

### 10:32 · Documentación para no perder memoria
- **Hecho:** `CLAUDE.md` en el repo (instrucciones que Claude lee al abrir el repo) y `docs/PROYECTO_CLAUDE.md` (documento
  maestro). `banco_fuerzapro.zip` entregado a Luis para que lo guarde.
- **Decisión de Luis:** seguir trabajando en estos chats con espacio de trabajo (no hace falta un Proyecto de claude.ai).

### 10:23 · v2.7.1 — Botón Atrás, calendario mensual, ejercicios compactos
- **Hecho:**
  - Botón ‹ en todas las ventanas y gesto Atrás de Android.
  - Calendario mensual de constancia.
  - Lista de ejercicios con ventana flotante.
- **Revisión de los cambios de Gemini (v2.7.0):**
  - El reemplazo de ejercicio ya no arrastra pesos.
  - La pregunta de la rutina ya no se cuelga.
  - Se corrigió «sesiónes».

## 2026-10-27
- **22:01 · v2.7.0 (Gemini):** reemplazar ejercicio, menú ⋯, actualizar rutina al terminar, músculos en la ficha.
- **21:35 · Traspaso:** `docs/HANDOFF.md`, `pruebas/verificar.sh` y Actions que verifica antes de publicar.
- **12:37 · v2.6.2:** reintentos cuando la IA no ve a la persona; filtro de preparación en press, remo y curl.
- **00:08 · v2.6.1:** tarjeta de músculos anatómica.

## Antes (resumen)
El historial completo, de la v1.0 a la v2.6.0, está en `docs/PROYECTO_CLAUDE.md` (sección "Historial de versiones").
