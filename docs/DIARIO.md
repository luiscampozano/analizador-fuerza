# Diario de FuerzaPro

Bitácora de trabajo, de la más reciente a la más antigua. **Regla:** antes de empezar cualquier actividad, lee las
últimas entradas; al terminarla, agrega una entrada arriba con: fecha y hora (Ecuador), qué pidió Luis, qué se hizo,
versión publicada y qué quedó pendiente. Escribe en español sencillo.

---

## 2026-11-05

### 11:46 · v2.36.11 — Términos de servicio
- **Contexto:** Play Console (estado de comerciante de la app: «sí aplica», porque habrá suscripciones) pide un enlace a
  los términos de servicio.
- **Hecho:** `terminos.html` (servicio, cuenta 16+, salud: estimaciones orientativas, comunidad, suscripciones con
  Google Play: renovación automática, cancelación, prueba gratis, reembolsos; uso aceptable; ley de Ecuador). Enlazada
  desde la política de privacidad y en la lista del service worker.

### 10:51 · (sin cambio de versión) — borrar-cuenta.html: borrar solo algunos datos
- **Contexto:** Play Console (Seguridad de datos) pide un enlace para borrar datos sin eliminar la cuenta. Luis decidió
  declarar desde ya las compras dentro de la app (suscripciones) para no repetir formularios.
- **Hecho:** sección `#datos` en borrar-cuenta.html (entrenamientos, series, análisis, comidas, publicaciones, dejar la
  comunidad y pedido por correo). URL para Play: https://fuerzapro.pages.dev/borrar-cuenta.html#datos

## 2026-11-04

### 12:08 · (sin cambio de versión) — assetlinks.json para la app de Android
- **Contexto:** Luis verificó identidad y teléfono en Play Console (cuenta personal, declarada «trader»), creó la app
  `com.fuerzapro.app` y generó el paquete con PWABuilder (Standalone, notificaciones y Google Play Billing activados,
  llave nueva: la guarda él, nunca en el chat).
- **Hecho:** `.well-known/assetlinks.json` con la huella SHA-256 de la llave de subida (relación handle_all_urls para
  `com.fuerzapro.app`). Así la app abre la web a pantalla completa sin barra de Chrome.
- **Pendiente:** después de subir el .aab, copiar la huella SHA-256 de la «llave de firma de apps» de Google (Play
  Console → Prueba y lanzamiento → Configuración → Integridad de la app) y agregarla al mismo archivo.

## 2026-11-03

### 21:00 · v2.36.10 — Pesas (parte 2) y salto de básquet imposible
- **Pidió:** seguir con la parte 2; en su último video de básquet el último salto salió 231 cm.
- **Básquet:** el tercer tiro, lejos y con la cámara moviéndose: la IA perdió los pies. `saltoCm` usa solo puntos del
  pie con visibilidad ≥ 0,5 y descarta más de 80 cm.
- **Pesas (banco 44/62 igual; muñecos 3366; PIERNAS 551/551):**
  - Hack/péndulo (riel con detector del cuerpo): altura vertical ÷ sen α = recorrido por el riel (antes −21 %).
  - Cámara en diagonal: `anchoHombros` (ancho de hombros / torso) y `acostado` en fisica.js; aviso «📐 grabaste en
    diagonal» con 0,38-0,6 de pie o 0,38-1,3 acostado, salvo ejercicios que se graban de frente (muñecos: 90° 0,1;
    60° 0,4; 45° 0,5-0,7; 0° 0,77). En el banco avisa en 20/62 (muchos videos de Luis son en diagonal).
  - Trayectoria: desvío = percentil 85 (no el máximo).
  - RIR por «zona pesada»/relación general solo con ecuación validada o MVT personal (6 curls iguales a 0,53 m/s
    daban RIR 0,5; ahora ≥ 5).
  - Tope del 1RM por peso corporal para todos los métodos (3,5× o el de la ecuación).
- **No se tocó (riesgo para el conteo, probado antes):** zancada con cadera/piso (empeora muñecos alternos), step-up.

### 20:48 · v2.36.9 — Revisión independiente del analizador de pesas (parte 1)
- **Pidió:** incluir pesas en la revisión independiente.
- **Hecho (medido con el banco: 44/62 igual; muñecos 3364 → 3366; PIERNAS 551/551):**
  - **fisica.js:** contador por ángulos: primero el tope y luego el despegue (antes reps de 0 cm y velocidad
    negativa); `marcarReps` marca parcial toda rep que no sube; `v_media` = velocidad entre el 5 y el 95 % del
    recorrido (con quietud o deriva antes/después daba pérdidas de 20-60 % falsas; en muñecos de reps idénticas,
    series con pérdida ≥ 20 %: 39 → 15) con respaldo a la media completa si el recorrido ocurre «de golpe»;
    `v_total` (media completa) para el filtro de 2 m/s; picos de fuerza y potencia = percentil 90 (videos reales con
    picos imposibles 15 → 8); bajada de la última rep acotada; `MP.puntas`.
  - **analisis.js:** asistidas: lastre/asistencia con peso corporal × fracción (antes «+45 kg de lastre» con 30 kg de
    ayuda; ahora «14,7 kg de asistencia»), también en la tabla de cargas y el PDF; 1RM real de Entrenar en peso corporal
    = lastre + cuerpo (antes «287 % de tu máximo»); recorrido corto (`rcorto`: pantorrillas, encogimientos, curl de
    muñeca) sin zona pesada ni MVT de tabla (antes RIR 0/RPE 10 siempre); explosivos (`balistico`: saltos,
    olímpicos, swing, lanzamiento) sin RIR ni 1RM.
  - **ejercicios.js:** pantorrilla sentado (ancla puntas), en prensa y en máquina (punto puntas, ancla tobillos): antes 0
    reps; crunch máquina/declinado sentido «arriba»; fondos, fondos en banco y muscle up con ancla manos; pistol y
    rumano a una pierna con ancla piso; abdominales, elevaciones de piernas, hiperextensión, superman y crunch como
    aproximados (fuerza/potencia).
- **Pendiente (parte 2):** hack medido en vertical (−21 %), aviso de cámara en diagonal, trayectoria relativa al ancla,
  step-up y zancada, velocidad propulsiva y relación general en ejercicios sin ecuación, tope de 1RM en singles.

### 20:32 · v2.36.8 — Revisión independiente de cardio y deportes (js/actividad.js)
- **Pidió:** revisar todos los ejercicios con un Claude independiente, uno por uno, para no tener más errores como el
  del salto. (El de pesas sigue en revisión.)
- **Hallazgos y arreglos:**
  1. **Ski erg se caía** (no tenía análisis): ahora cuenta tirones con los brazos.
  2. **Salto (vóley/básquet):** el tobillo sube 8-9 cm de más con el pie en punta → punto más bajo de talón/punta
     (pruebas: 10/30/50 cm reales → 10/30/50).
  3. **Boxeo:** la velocidad estaba tan suavizada que todos los golpes salían iguales (medía el largo del brazo):
     suavizado 0,02 s, relativa a la cadera con escala por cuadro; masa efectiva recalibrada a aficionado (2,2 % del
     peso en rectos, 1,9 % otros). Video real: mano 4,8 m/s, golpe fuerte 94 kg (antes 149 por errores compensados).
     El video usa el mismo criterio que la tarjeta («Más fuerte»).
  4. **Cuerdas de batalla alternas:** las dos manos se cancelaban (154/min en vez de 120): señal por brazo.
  5. **Persona quieta:** el temblor de la IA se contaba como 40-130 repeticiones con elogios: `pivotes()` exige
     amplitud mínima (0,08 torsos, 10° en ángulos, 0,03 en cuerda) y avisa «No detecté el movimiento».
  6. **Cuerda:** altura con el punto más bajo del pie (6,2 → 2,9 cm reales 3); conteo sigue con tobillos.
  7. **Fútbol:** pie respecto al tobillo de apoyo (antes la cadera restaba la carrera, −18 %).
  8. **Tenis/pádel:** cabeza 2× la mano, masa 0,3 kg; ×1,2 a 30 fps (vóley también); mano dominante única.
  9. **Básquet:** sin «Fuerza de empuje» (inestable); ángulo de salida del balón corrigiendo la gravedad; escala
     local en el seguimiento del balón.
  10. **Carrera:** rebote respecto al pie de apoyo (cámara en mano daba falso «rebotas mucho»).
  11. Textos con «null»/«0» y elogios sin movimiento; natación con índices por tiempo.
- **Pruebas:** sintéticos de carrera con el pie de apoyo en el piso; todas las pruebas del revisor pasan (en el
  scratchpad, no en el repositorio).

### 19:48 · v2.36.7 — El salto de básquet salía el doble
- **Pidió:** ¿de verdad saltó 32 cm?
- **Revisión:** no. Se medía la subida de la cadera desde la flexión previa al salto (sentadilla): 28-32 cm. Los pies
  solo se despegaron ~10 cm (tobillo de 715 a 693 px con ~0,0043 m/px).
- **Hecho:** `saltoCm` = pie más bajo en el vuelo (±0,35 s) respecto al piso antes y después (mediana de 0,4-1 s
  antes y después), con la escala de ese cuadro. Su tiro: 11 cm. Vóley sintético sigue en 39-40 cm.

### 19:27 · v2.36.6 — Básquet: el video no mostraba estadísticas
- **Pidió:** ya detecta los tiros (incluso el 3.º) pero abajo en el video no salía ninguna estadística.
- **Causa:** desde 2.36.5 la velocidad del balón solo sale con la IA del balón; con «Solo cuerpo» el panel quedaba vacío.
- **Hecho:** cada tiro guarda `salto` y `brazo`. Video: arriba a la derecha «Salto X cm», debajo «Brazo al soltar Y°» y
  «Mejor salto»; gráfica «Altura del salto en cada tiro (cm)» (si la IA del balón mide, sigue la de km/h). Informe:
  la misma gráfica de barras.

### 19:07 · v2.36.5 — Básquet: no contaba tiros y la IA del balón no lo veía
- **Pidió:** en básquet (video de noche, cámara en mano siguiéndolo, 3 tiros) contó 0 y en «Completo con balón» no
  reconoció el balón.
- **Causas:** (1) se exigía el codo estirado justo en el instante de mayor velocidad de la mano (en un tiro real ahí
  todavía está doblado); (2) la velocidad de salida viene del golpe de muñeca final y la IA del cuerpo no la ve (salía
  2-3 m/s); (3) el detector de balón con umbral 0,2 lo encontraba en 1 de cada 6 cuadros.
- **Hecho (js/actividad.js):** tiro = muñeca en su punto más alto (±0,3 s) sobre la cabeza con el codo ≥135°, cabeza
  sobre los hombros, que subió ≥0,5 torsos en los 0,8 s anteriores (con la mano que mejor se vea) y la otra mano
  también arriba (el balón va con las dos). «Solo cuerpo»: tiros, salto y ángulo del brazo; velocidad, ángulo de
  salida y fuerza solo cuando la IA del balón lo sigue (ajuste de su vuelo; ángulo medido). js/pose.js: umbral del
  detector 0,08; filtro de tamaño de balón por deporte (fútbol 11 cm, básquet 12, vóley 10,5, tenis 3,3 de radio) en
  el seguimiento y en el círculo del video.
- **Resultado con su video:** 2 de 3 tiros (el tercero, muy lejos, no); con la IA del balón (probada en Chromium sobre
  sus cuadros): 6 m/s y 53° de salida.

### 18:39 · v2.36.4 — «Grabar» abría la galería; el modo en vivo no giraba
- **Pidió:** con 2.36.3 seguía igual: «Grabar» abría la galería y el modo en vivo no giraba.
- **Causa real de Grabar:** los campos de archivo están dentro del recuadro del video; el clic que la app hace en el
  campo de la cámara «subía» al recuadro, cuyo clic abre la galería, y esa ventana tapaba a la cámara.
  **Arreglo:** el recuadro ignora los clics que vienen de los campos (probado en Chromium: Grabar → solo
  `input-grabar`, Galería → solo `input-video`).
- **Giro:** Android solo deja cambiar la orientación en pantalla completa: el modo en vivo pide pantalla completa al
  abrir y luego `orientation.lock('any')`; al salir sale de pantalla completa y desbloquea.

### 17:50 · v2.36.3 — Tenis cámara en mano (original 4K 60 fps), botón Grabar y giro en vivo
- **Pidió:** con 2.36.2 su video sin trípode dio 1 golpe a 145 km/h (fueron 4); «Grabar» y «Galería» abren lo mismo
  (la galería); en el modo en vivo la imagen debe girar al rotar el celular.
- **Diagnóstico (video original):** jugadora lejos y pequeña en 4K vertical; la IA salta por momentos a OTRA persona
  (torso de otro tamaño, cadera 200 px más abajo) y pone la muñeca en la raqueta: velocidades de 30-40 m/s falsas.
  Solo ~35 % de los cuadros son confiables.
- **Hecho (js/actividad.js, deportes):** seguimiento de la persona principal (se descartan cuadros donde el torso
  cambia >35 % o la cadera salta >0,6 torsos por 1/30 s; se re-engancha tras 0,4 s); muñeca/tobillo descartados si el
  antebrazo/pierna mide fuera de 0,45-1,35 veces lo normal; picos de un cuadro corregidos (2 pasadas); velocidad medida
  sobre ~1/30 s también a 60/120 fps; aviso si menos del 60 % del video es usable. Resultado en el original: 2 golpes
  claros detectados (3,6 s y 8,0 s), los otros con la persona perdida.
- **Grabar:** campo propio `input-grabar` con `capture="environment"` fijo en el HTML (Xiaomi ignoraba el capture
  puesto al momento). **Vivo:** `screen.orientation.lock('any')` al abrir y vuelve a vertical al salir; pantalla
  más alta en horizontal.
- **Recomendación a Luis:** trípode, más cerca (la persona que ocupe al menos 1/3 del alto) y sin gente detrás.

### 17:28 · v2.36.2 — Tenis con cámara en mano: velocidades irreales (323 km/h) y golpes de más
- **Pidió:** video de una jugadora semi-pro (50 kg, 1,52 m), cámara en mano: 4 golpes, contó más y la pelota salió a
  323 km/h. Con trípode, velocidades razonables pero también contó de más.
- **Causas:** (1) la velocidad de la mano se medía en la imagen: al mover la cámara se sumaba su movimiento; (2) la IA
  intercambia izquierda/derecha y la mano «salta» al otro lado del cuerpo; (3) en tenis el impulso hacia atrás se
  contaba como otro golpe; (4) el video con telemetría de cardio/deportes seguía a la persona cuadro a cuadro sin
  suavizar (temblaba).
- **Hecho (js/actividad.js):** en deportes, copia de los puntos con izquierda/derecha corregidas cuando cruzarlas
  mueve todo mucho menos; velocidad del pie/mano respecto al centro de la cadera, en metros con la escala de cada
  cuadro (torso = 30 % de la estatura, mediana de 1 s); se descartan cuadros con cambio de escala >20 % en 0,2 s o
  movimiento brusco de cámara, y velocidades imposibles (mano >25 m/s, pie >32 m/s); umbral de golpe con el
  percentil 98; en tenis un golpe por cada 1,5 s. Video: encuadre suavizado (1,5 s).
- **Pendiente:** los videos ORIGINALES (no los de telemetría) de la jugadora, con trípode y en mano, para calibrar.
  No se guardan sus datos en el repositorio (es menor de edad).

### 17:00 · v2.36.1 — Modo en vivo: 120 fps y fps reales
- **Pidió:** eligió 1080p · 60 fps y la cámara seguía en 30 fps; agregar 120 fps. (El zoom ya le funciona.)
- **Hecho:** opciones 720p/1080p · 120 fps; si la cámara abre con menos fps de los pedidos y su máximo lo permite se
  exige con `applyConstraints`; si no, la línea dice el máximo que da el navegador y sugiere grabar con la cámara del
  celular. En boxeo/deportes, archivos de 100 fps o más se analizan a 120 Hz.
- **Nota:** Chrome en Android muchas veces limita la cámara web a 30 fps; la cámara nativa sí graba 60/120.

### 16:48 · v2.36.0 — 60 fps automático en deportes + cámara del modo en vivo
- **Pidió:** graba en 4K a 60 fps pero el análisis decía «menos de 60 fps»; en el modo en vivo quiere zoom y elegir
  calidad y fps.
- **Causa:** el análisis toma cuadros según la precisión (Rápida 15, Normal 30, Máxima 60 por segundo); con «Normal» un
  video de 60 fps se leía a 30. (El video con telemetría que se descarga siempre es de 30 fps.)
- **Hecho:**
  - `js/lector.js`: lee los fps reales del video (`computePacketStats`). `js/app.js`: en boxeo y deportes con balón,
    si el video es de 50 fps o más se analiza a 60 Hz aunque la precisión sea Normal. Avisos de fps actualizados.
  - Modo en vivo (`js/vivo.js`, index.html, style.css): selector «Calidad de cámara» (720p/1080p/4K a 30 o 60 fps,
    guardado en `af_vivo_res`), línea con la resolución y fps reales que entrega la cámara, zoom con barra y pellizco
    (si Chrome y la cámara lo permiten; se pide `zoom: true`), grabación con más bits según la calidad (6–52 Mbps).

### 16:28 · v2.35.4 — Tenis: contaba el doble; video de deportes más claro
- **Pidió:** en su video de tenis (2 golpes de derecha, 5 s a 30 fps) contó 4 y el video no mostraba lo esperado
  («1800 por minuto», «Balón» en vez de pelota).
- **Causa:** de lado la IA confunde la mano izquierda con la derecha: el mismo golpe salía en las dos manos (0,03 s
  aparte). Además saltos de un solo cuadro inflaban la velocidad.
- **Hecho (js/actividad.js):** `unir()` deja un golpe por movimiento entre las dos manos/pies (0,9 s tenis, 1,2 s vóley,
  1 s fútbol); velocidad con mediana de 3 cuadros (básquet sin mediana: la mano frena al soltar). Video: arriba a la
  derecha la velocidad del pie/mano (no el ritmo), «Pelota» en tenis/pádel y gráfica de barras con los km/h de cada
  golpe (celeste si la midió la IA del balón). Informe (app.js): la misma gráfica de barras.
- **Prueba nueva:** `tenis_real.json.gz` (puntos del video de Luis) → 2 golpes, dentro de deportes.mjs.

### 16:19 · v2.35.3 — Arreglo del formulario al elegir Tenis/pádel
- **Pidió:** en Tenis salían «Peso de discos», «Peso de la barra» e «Inclinación del riel» (del ejercicio anterior) y no
  salían los botones «Solo cuerpo / Completo».
- **Causa probable:** la página (index.html) vieja en el celular con el código nuevo: al no encontrar los botones nuevos
  fallaba y ya no se ajustaban los campos. En Chromium con la versión actual funciona bien.
- **Hecho:** `pintarModoDep` no falla si faltan los botones y `elegir`/inicio ajustan los campos aunque falle el dibujo
  de la ficha.

### 16:01 · v2.35.2 — Preparación para Google Play (cuenta personal, app gratis)
- **Pidió:** publicar con cuenta personal (la SAS queda para cuando se cobre; Google permite transferir la app).
  Su verificación de identidad está en revisión; el teléfono se verifica después.
- **Hecho:**
  - `borrar-cuenta.html`: cómo eliminar la cuenta desde la app o la web (Perfil → 🗑️ Eliminar cuenta) o por correo a
    fuerzapro2026@gmail.com (30 días); qué se borra y qué se conserva (alimentos sin autor, copias de D1 ≤30 días).
  - `privacidad.html`: IA de nutrición y entrenador (Anthropic), fotos/videos de la comunidad en R2 (videos 1 año),
    plan y uso, enlace a borrar-cuenta. Correo de contacto público ahora fuerzapro2026@gmail.com (también en
    normas.html y en «olvidé mi contraseña»).
  - `docs/play/`: FICHA_PLAY_STORE.md (nombre, descripciones, categoría, políticas, clasificación, seguridad de datos,
    prueba cerrada), icono-512.png e imagen-destacada-1024x500.png.
- **Pendiente:** aprobación de identidad → teléfono → PWABuilder (.aab; la llave la guarda Luis) → assetlinks.json →
  prueba cerrada con 12+ probadores 14 días → producción. Herramienta de moderación para borrar cuentas pedidas por correo.

### 13:55 · v2.35.1 — Figuras de los deportes
- **Pidió:** las figuras de los deportes no eran correctas (fútbol, básquet y tenis tenían la misma; vóley, emoji).
- **Hecho (js/figura.js):** plantillas nuevas `patada` (con el balón en el piso), `tiro` (salta y lanza con el balón en la
  mano), `remate` (salta y golpea el balón arriba) y `raqueta` (golpe de derecha con raqueta dibujada: mango + cabeza
  en la dirección del antebrazo). Natación muestra la brazada de lado. La caja del dibujo ahora incluye el balón.

### 13:47 · v2.35.0 — Deportes en el analizador + IA del balón (experimental)
- **Pidió:** analizar fútbol, básquet, vóley, pádel y natación (esta solo grabando desde fuera de la piscina), con dos
  opciones: «Solo cuerpo» (modelo actual) y «Análisis completo» con la IA del balón, con etiqueta «Experimental».
- **Hecho (js/actividad.js):**
  - Fútbol: patadas = pico de velocidad del pie con el otro pie apoyado y la rodilla casi estirada (no cuenta correr).
    Balón estimado por choque pie-balón (masa efectiva 2,8 % del peso, rebote 0,5 → ~1,25× el pie); fuerza media =
    0,43 kg · v / 9 ms.
  - Vóley: remates/saques con la mano sobre los hombros (mano 4 % del peso, balón 270 g, 12 ms) + altura de salto.
  - Tenis/pádel: golpes; cabeza de la raqueta ~1,5× la mano; pelota 58 g, 5 ms. Cuenta los «por arriba».
  - Básquet: tiro = la mano sube sobre los hombros con el codo estirado; velocidad y ángulo de salida (45-55° ideal),
    salto y fuerza de empuje.
  - Natación 🧪: ciclos de brazada del brazo visible, ritmo, velocidad (avance de la cadera, celular fijo), ritmo por
    100 m y avance por ciclo.
  - Nuevo ejercicio `voley`. Telemetría: «Balón ~X km/h · Y kg» y «Máx.» debajo del ritmo; círculo cian en el balón.
- **IA del balón:** `cargarDetectorBalon()` en js/pose.js (EfficientDet-Lite0 de MediaPipe, clase «sports ball», ~7 MB).
  Corre sobre los mismos cuadros que la pose; tras cada contacto sigue el balón 0,4 s y mide su velocidad (ajuste
  lineal). Si lo ve, reemplaza la estimación («medida con la IA del balón»). Selector en el formulario (`af_modo_dep`).
- **Pruebas:** `pruebas/actividad/deportes.mjs` (esqueletos de velocidad conocida + balón sintético a 90 km/h) en
  verificar.sh. Detector probado en Chromium con un balón dibujado.
- **Pendiente:** videos reales de Luis (patada, tiro, remate, pádel, natación) para calibrar; prueba vertical de salto.

### 13:24 · v2.34.1 — Fuerza del golpe en el video con telemetría
- **Pidió:** la fuerza salía en el informe pero no en el video; ponerla debajo de la velocidad (ritmo).
- **Hecho:** cada golpe guarda su velocidad (`v`). En el video, debajo de «golpes/min»: «Golpe ~X kg · Y m/s» del último
  golpe (amarillo) y «Máx. ~Z kg» hasta ese momento. Sin peso corporal solo muestra la velocidad.
- **Idea de Luis (pendiente, por fases):** en deportes con balón y natación, dos opciones: «Solo cuerpo» (modelo actual)
  y «Análisis completo» con la IA del balón, con etiqueta «Experimental».

### 13:13 · v2.34.0 — Boxeo: fuerza aproximada del golpe
- **Pidió:** que el boxeo calcule la fuerza del golpe con la velocidad, el peso y la altura. La IA que sigue el balón
  queda solo para deportes con pelota (fútbol, básquet, pádel, vóley) y con aviso de que tarda más; pesas no la necesitan.
- **Hecho:** en `js/actividad.js` cada golpe lleva `fuerza` (kg) = 129 · masa efectiva · velocidad / 9,81, con masa
  efectiva 4 % del peso corporal en rectos y 3,5 % en ganchos/uppercuts (calibrado con boxeadores olímpicos, Walilko
  2005: 2,9 kg, 9,1 m/s, 3427 N). La altura ya entra en la escala (m por píxel). KPI «Golpe más fuerte» (kg, N y típico,
  ±35 %) y nota de que es la fuerza si impacta un saco. app.js y vivo.js pasan el peso corporal. Video real de prueba:
  149 kg el más fuerte (sombra, 30 fps).
- **Pendiente:** videos de Luis golpeando un saco, de lado, a 60 fps (y en cámara lenta) para validar; soporte de videos
  en cámara lenta; fuerza en patada, remate y lanzamiento (fase siguiente).

### 11:25 · v2.33.1 — «Créditos IA para nutrición» 10 / 30 / 90 / 300
- **Pidió:** que los créditos digan «para nutrición» (no confundir con el analizador) y subirlos a 10 / 30 / 90 / 300.
- **Hecho:** `PLANES.ia` = 10 / 30 / 90 / 300; textos «Créditos IA para nutrición» en la ventana de planes, «créditos IA de
  nutrición» en Perfil y en el aviso de límite. Tablas de D1 ya creadas por Luis (v2.33.0 publicada).

### 11:13 · v2.33.0 — Suscripciones programadas (límites apagados)
- **Pidió:** programar los planes con el cobro apagado; no ponerlo a él en Pro Max (quiere probar cada plan).
- **Luis corre en D1:** tablas `planes`, `uso_plan`, `ajustes_app` (+ `limites = apagado`). Están en sql/esquema.sql.
- **Hecho:**
  - Servidor: `PLANES` (Gratis/Plus/Pro/Pro Max con video 3/20/40/∞ al mes, créditos IA 9/27/81/243 al mes, entrenador
    1/mes, 1/semana, 3/semana, 1/día; PDF, video en comunidad y Excel desde Plus; historial de velocidad 30 días en
    Gratis). Modo `ajustes_app.limites`: **apagado** (nadie, como antes), **prueba** (solo administradores) o **activo**
    (todos con cuenta). `GET /api/plan`, `POST /api/plan/usar` (análisis de video). La IA usa la bolsa mensual cuando el
    plan aplica (si no, los límites diarios de antes). Video en la comunidad bloqueado en Gratis. Periodos en hora de
    Ecuador. Moderación: `GET/POST /api/mod/planes` (modo) y `POST /api/mod/plan_usuario` (regalar por @alias o correo,
    con días; «yo» para probar, reinicia contadores). Borrar la cuenta borra su plan y su uso. Prueba `planes_test` (18).
  - App: `js/plan.js` (estado en `af_plan`, revisar antes de analizar y descontar al terminar, ventana «⭐ Mejora tu plan»
    con la tabla de planes; cualquier 429/403 de límite la abre). Tarjeta «⭐ Plan …» en Perfil con el uso. PDF con marca
    de agua «MUESTRA» en Gratis. Excel bloqueado en Gratis (el respaldo sigue libre: son los datos de la persona).
    Historial de velocidad de 30 días en Gratis. Moderación: sección «💳 Suscripciones».
- **Pendiente:** cobro con Google Play (Play Store); qué hacer con quienes usan la app sin cuenta cuando se active.

### 10:40 · v2.32.0 — Figuras animadas propias para los 198 ejercicios
- **Pidió:** reemplazar los emojis por una imagen de cada ejercicio (opción 1: animaciones propias; después, poco a
  poco, videos suyos).
- **Hecho:** `js/figura.js` (nuevo): una persona estilizada dibujada en SVG desde los ángulos de cada segmento
  (vista de lado o de frente), con equipo (barra vista de punta, mancuernas, kettlebell, cables con su anclaje) y
  accesorios (banco, banco inclinado, barra fija, paralelas, asientos, bici, remo...). ~70 plantillas de movimiento
  cubren los 198 ejercicios (`MAPA`). `miniatura(id)` = cuadro fijo (~0,8 KB) para listas; `animacion(id)` = SVG
  animado con SMIL (~4 KB, sin JavaScript). Sin archivos nuevos que descargar: se generan en el teléfono.
  - Dónde se ven: selector de ejercicios y tarjetas del entreno, «Progreso y músculos» (animada, arriba), elegir
    ejercicio en Analizar (animada), Mis marcas y Análisis de video en Perfil. Los ejercicios creados por el usuario
    siguen con emoji.
- **Pendiente:** afinar algunas figuras (hack, prensa, step-up, escaladores); suscripciones (siguiente paso).

### 10:24 · v2.31.0 — Calculadora de calentamiento + plan de suscripciones acordado
- **Pidió:** igualar a Hevy/Lyfta: calculadora de calentamiento y fotos/videos de demostración de cada ejercicio (no
  emojis). Acordó los planes (ver abajo).
- **Hecho:** en el menú «⋯» de cada ejercicio, «🔥 Calcular calentamiento»: con el peso de trabajo arma barra sola × 10,
  40 % × 5, 60 % × 3 y 80 % × 2 (menos pasos con pesos livianos), redondeado a 2,5 kg; barra 20 kg (Barra Z 10, sin
  barra en mancuernas/máquinas). Reemplaza los calentamientos no hechos y los pone al inicio. `seriesCalentamiento()`.
- **Planes acordados (cobro apagado hasta que Luis diga):** Gratis / Plus $3,99 / Pro $9,99 / Pro Max $19,99.
  Video al mes 3 / 20 / 40 / ilimitado. Bolsa de créditos IA al mes (foto del plato, comida escrita, etiqueta)
  9 / 27 / 81 / 243. Entrenador IA 1 al mes / 1 por semana / 3 por semana / diario. PDF: muestra en Gratis, completo
  desde Plus. Comunidad con video desde Plus. Progreso de velocidad: último mes en Gratis. Excel/respaldo desde Plus.
  Pro Max: atleta serio + entrenadores con alumnos (función futura). Anual = 2 meses gratis; 7 días de prueba de Pro.
- **Pendiente decidir:** de dónde salen las fotos/animaciones de los ejercicios (derechos de uso).

### 10:04 · v2.30.0 — Búlgara: velocidad pareja entre piernas; reporte de sentadilla revisado
- **Pidió:** arreglar la velocidad distinta entre piernas de la búlgara y revisar su reporte de sentadilla (11 vs 12).
- **Causa (búlgara):** la IA confundía a ratos los tobillos (la mancuerna tapa el pie de adelante), así que el «piso»
  saltaba con cada rep; y con las piernas abiertas la escala por cuadro cambiaba ±15 % con la postura. Una pierna
  salía con ~60 cm de recorrido y la otra con ~30.
- **Hecho (solo ancla `piso`, búlgara):** el piso es la mediana de 2 s del tobillo más bajo; la escala, la mediana de
  4 s; el umbral del conteo usa el recorrido típico de las oscilaciones (`umbralTipico`), así acomodarse en el banco no
  tapa las reps.
- **Resultado:** su búlgara 0,60 vs 0,55 m/s por pierna (antes ~0,8 vs ~0,35), 16 reps, 8 + 8. Banco real 44/62 (+ el
  otro video de búlgara de 18 reps ahora exacto; el de 8 da 7; + su sentadilla). Muñecos 3374 → 3364 (búlgara con
  zoom/caminar y «acomodarse» pierde 10 tomas; se prefirió acertar los videos reales). Mínimo de verificar.sh: 3350.
  La prueba `bulgara_real.mjs` exige además que las dos piernas no difieran más de 30 % en velocidad.
- **Sentadilla (fallo df8ff1a8):** la versión actual ya cuenta 12 (la 2.25 contaba 11); agregada al banco.
- **Pendientes:** definir con Luis qué incluye cada plan de suscripción.

## 2026-11-02

### 15:08 · v2.29.0 — Dos lados en un video para todos los ejercicios unilaterales + PDF con comparación
- **Pidió:** el informe de la búlgara salía con 8 reps (una pierna); quiere un PDF con las dos y aplicarlo a todos los
  ejercicios unilaterales.
- **Hecho:**
  - **PDF de dos lados** (`crearPDF(..., { pareja })` en js/pdf.js): página 1 con la comparación (reps, mejor velocidad,
    velocidad media, pérdida, fuerza y potencia pico, 1RM; diferencia en %) y una frase de qué lado fue más rápido
    (> 10 % = lado débil); luego el detalle completo de cada lado. Se arma solo si la serie tiene pareja.
  - **Ejercicios a un brazo o a una pierna** (`ej.unilateral`: remo con mancuerna, curl concentrado, prensa a una
    pierna, extensión a una pierna...): `cambioDeLado` (js/fisica.js) mide cuánto se mueve cada mano/pie en ventanas
    de 1 s; si un lado domina ≥ 3 s y después el otro, cuenta cada lado con su punto y en su parte del video
    (`res.cambioLado`) y la app guarda 2 series («brazo derecho/izquierdo» o «pierna …»).
  - Las series guardan `datos.lado` (texto); las de v2.26–2.28 con `datos.pierna` siguen funcionando.
  - Pistas de los ejercicios: ya no dicen «analiza cada lado en un video aparte».
  - Muñeco nuevo `remo_mancuerna@2brazos`: 92/105 bien contados y el cambio de lado exacto en todos.
    Muñecos 3374/3570 (los anteriores sin cambios: 3282); banco real 42/61 sin cambios.
- **Ojo:** en la búlgara de Luis la velocidad sale muy distinta entre piernas (posible error de medición); el PDF lo
  marcará como lado débil hasta que se revise la escala con las piernas separadas.
- **Pendientes:** que Luis pruebe el PDF y un remo a un brazo con los dos lados.

### 13:56 · v2.28.0 — Búlgara real con las dos piernas: 5 → 16 reps
- **Pidió:** su búlgara de 16 reps (8 por pierna, en un video) salió con 5; mandó el reporte (fallo baba227e).
- **Causa:** se seguían los hombros respecto al promedio de los tobillos. Luis se inclina mucho (agarrado del rack): los
  hombros casi no bajan; y al cambiar de pierna el pie de atrás baja/sube del banco, un movimiento enorme que subía el
  umbral del conteo y tapaba las reps de la segunda pierna.
- **Hecho:**
  - Búlgara (mancuernas, barra, Smith): se sigue la **cadera** respecto al **pie apoyado en el piso** (ancla nueva
    `piso` = tobillo más bajo).
  - `cortePorPies` (js/piernas.js): detecta en qué cuadros cambia la postura de los pies; si hay pausa (≥ 1 s) cada
    pierna se cuenta con su propio umbral y sus bordes se limpian por separado (`analizar` en js/fisica.js).
  - En búlgara/zancada se tolera 35° (antes 25°) de dirección en las reps de los bordes (la última rep al bajarse).
  - Prueba nueva `pruebas/piernas/bulgara_real.mjs` (16 reps, cambio en 8) en `verificar.sh`.
- **Resultado:** su video 16/16 y 8 + 8. Banco real 42/61 (se sumó su video; el otro de búlgara pasó de 2 a 9 con real 8).
  Muñecos 3275 → 3282; búlgara de una pierna 94 → 102 de 105.
- **Ojo:** la velocidad medida sale distinta entre piernas en su video (≈0,8 vs ≈0,35 m/s); falta revisar la escala
  con las piernas separadas. Zancadas y step-up siguen con hombros (con alternas empeoraba).
- **Pendientes:** que Luis vuelva a analizar el video original; revisar su reporte de sentadilla (11 vs 12).

### 13:10 · v2.27.0 — Editar un entrenamiento guardado por completo
- **Pidió (con captura):** al editar un entreno solo dejaba cambiar nombre/foto/fecha/duración; quiere editar primero
  ejercicios, series y reps, y al final esa ventana.
- **Hecho:** «✏️ Editar» abre el entreno en la misma pantalla del entreno en curso (modo `editando`): agregar, quitar o
  cambiar ejercicios y series. Botones «Cancelar» (vuelve al detalle sin cambios) y «Guardar» (abre la ventana de
  nombre, foto, fecha y duración y guarda sobre el mismo entreno). Los récords se recalculan. Sin reloj de descanso
  ni cronómetro en este modo. Si hay un entreno en curso, pide terminarlo primero.
- **Pendientes:** que Luis lo pruebe en el celular.

### 12:54 · v2.26.0 — Búlgara/zancada/step-up: las dos piernas en un mismo video
- **Pidió:** que el analizador detecte el cambio de pierna cuando se graban las dos piernas seguidas y lo parta en dos series.
- **Hecho:**
  - `js/piernas.js` (nuevo): en el fondo de cada rep mide la postura de las piernas (rodilla y tobillo izquierdos respecto
    a los derechos, en largos de muslo). Busca el punto donde la postura cambia claramente (dos grupos de 2+ reps,
    diferencia > ½ muslo y > 2,5 veces lo que varía dentro de cada grupo). Si alterna rep a rep, no parte.
    Qué pierna es cuál: la que trabaja tiene la rodilla más alta en el fondo (estimado; hay botón «↔ Están al revés»).
  - Ejercicios: búlgara (mancuernas, barra, Smith), zancada fija/barra/atrás/curtsy y step-up.
  - App: se guardan 2 series (historial «… · pierna izquierda/derecha»), cada una con sus reps, velocidad, RIR y 1RM
    (se reusan las reps del video completo excluyendo las de la otra pierna, también al corregir el conteo).
    Un solo video con telemetría para las dos. En Resultados: «Ver pierna X →». En un entreno, la 2.ª pierna va a la
    serie siguiente (se crea si falta).
  - Muñecos: 377/377 tomas bien (0 falsos cambios en una pierna ni en zancada alterna; cambio exacto en las de 2 piernas);
    `verificar.sh` lo revisa. Conteo total de muñecos sin cambios (3275).
- **Ojo:** los 3 videos reales de búlgara/zancada del banco ya fallaban en el conteo (no sirven para validar esto).
- **Pendientes:** que Luis grabe una búlgara con las dos piernas y la reporte si sale mal.

### 11:07 · v2.25.0 — Comunidad: publicar la serie analizada con su video
- **Pidió:** poder publicar el video del analizador en la comunidad, sin límite de duración (los límites irán en las
  suscripciones), y que el video se borre de la comunidad al año.
- **Hecho:**
  - Botón «📣 Publicar en la comunidad» bajo el video de una serie y de una actividad (boxeo, cardio). La publicación
    muestra el video y los datos (reps, velocidad, RIR, 1RM, pérdida; o los indicadores de la actividad).
  - El teléfono comprime el video a 720p con Mediabunny (ya estaba en vendor/): 2,5 Mbps hasta 1 min, 1,6 hasta 5 min,
    1 Mbps más largo (prueba: 30 s de 30 MB → 9,3 MB en ~20 s). Si no puede comprimir, sube el original.
  - Subida por partes de 8 MB (multipart de R2, reintenta cada parte 2 veces): sin tope por el límite de 100 MB por
    petición de Cloudflare. Servidor: `POST …/video/inicio`, `PUT …/video/parte`, `POST …/video/fin`, `…/cancelar`,
    `DELETE …/video`; `GET /api/vid/pub/<id>` con rangos (para adelantar). Se guarda como `vid/<id>`; `datos.video.t`.
  - Al año el servidor deja de entregarlo y la app muestra «el video ya no está disponible»; para liberar el espacio,
    Luis debe crear en el bucket una regla de ciclo de vida (prefijo `vid/`, borrar a los 365 días).
  - Se borra con la publicación, la cuenta, al dejar la comunidad o desde Moderación. Editar conserva el video.
  - `nube.api` acepta un Blob como cuerpo (partes del video). Pruebas: `com_test` pasa de 53 a 60.
- **Pendientes:** regla de ciclo de vida en R2 (Luis); probar publicar una serie real desde el celular.

## 2026-11-01

### 23:24 · v2.24.0 — Comunidad: publicaciones con imagen (Cloudflare R2)
- **Pidió:** guardar imágenes en la comunidad; Luis activó R2, creó el bucket `fuerzapro-imagenes` y la conexión
  `IMAGENES` en Cloudflare Pages (Settings → Bindings).
- **Hecho:**
  - Al compartir desde las tarjetas, la tarjeta que se estaba viendo acompaña la publicación; también se puede poner
    una foto propia o quitarla. La app la convierte a JPEG de máximo 1350 px (~100–500 KB).
  - Servidor: `PUT/DELETE /api/comunidad/publicaciones/<id>/imagen` (solo el dueño, solo JPEG, máx. ~500 KB) y
    `GET /api/img/pub/<id>` (pública, no se sirve si la publicación está oculta). Se guarda como `pub/<id>.jpg`;
    `datos.img` = hora de subida (sin cambios en D1). Editar el texto conserva la imagen.
  - Borrar la publicación, dejar la comunidad, eliminar la cuenta o borrar desde Moderación borra también la imagen.
  - Pruebas: `com_test` pasa de 44 a 53.
- **Pendientes:** que Luis publique un entreno con tarjeta y otro con foto desde el celular.

### 22:56 · v2.23.0 — Cardio (calorías, récords, natación en metros) y 3 funciones más con IA
- **Pidió:** seguir con 1 (mejoras de cardio) y 2 (más usos de la IA), y saber el costo de guardar imágenes en la comunidad.
- **Hecho (cardio):**
  - Calorías estimadas por ejercicio de cardio (tabla MET del ACSM; correr/caminar según el ritmo, bici según la
    velocidad) con el peso corporal más reciente; se ven al registrar y en el detalle del entrenamiento.
  - Récords de cardio: distancia más larga, más tiempo y mejor ritmo/velocidad.
  - Natación se registra en metros y el ritmo en min/100 m.
- **Hecho (IA, Claude Haiku 5.5 en el servidor, cada una con su propio límite diario por persona):**
  - «✍️ Escribir lo que comí» (`POST /api/ia/texto`, 20 al día): lista editable igual que la foto del plato.
  - «🤖 Leerla con IA» en el formulario de producto cuando la lectura del teléfono queda incompleta
    (`POST /api/ia/etiqueta`, 10 al día; foto de 1280 px).
  - «🤖 Entrenador IA» en Perfil (`POST /api/ia/entrenador`, 3 al día): la app arma un resumen de las últimas 4 semanas
    (entrenos, mejores series, velocidad con video, cardio, nutrición de 7 días, peso), sin nombre ni correo; el último
    análisis queda guardado en el teléfono (`af_pf_coach`).
  - Sin cambios en la base de datos: `uso_ia` guarda cada función con un sufijo en el día (`:t`, `:e`, `:c`); el tope
    general de 600 al día cuenta todas. Moderación muestra el uso por función.
  - Pruebas: `ia_test` pasa de 9 a 15.
- **Costo de imágenes en la comunidad (solo respuesta, nada hecho):** casi cero con Cloudflare R2 (10 GB gratis).
- **Pendientes:** que Luis pruebe las 3 funciones de IA y el cardio en el celular.

## 2026-10-31

### 23:21 · v2.22.0 — Nutrición: foto del plato con IA (Claude Haiku 5.5)
- **Pidió:** foto del plato con Haiku, usando los créditos de API de su plan Max (USD 100 al mes).
- **Luis configuró:**
  - la clave de la Console, guardada como secreto `ANTHROPIC_API_KEY` en Cloudflare Pages (fuerzapro → Production);
  - Claude nunca vio la clave.
- **Hecho:**
  - **Servidor** (`_worker.js`): `POST /api/ia/plato` (con sesión).
    - La app manda la foto reducida en el teléfono (768 px, JPEG 0,75, ~80 KB en base64; así el servidor casi no
      gasta CPU del plan gratis).
    - El servidor llama a `claude-haiku-5-5` con un prompt en español: alimentos, gramos y macros por porción, y
      confianza.
    - Valida y limpia la respuesta.
    - Límite: 10 fotos por persona al día y 600 al día en total (tabla `uso_ia`); los errores no cuentan.
    - Sin la clave responde «disponible muy pronto».
    - Moderación: `GET /api/mod/ia` muestra el uso de los últimos 7 días.
  - **App** (`js/nutricion.js`):
    - botón «📸 Foto del plato (IA, aproximado)» en Agregar alimento;
    - muestra la lista con checkbox, gramos editables y 🟢🟡🔴 según la confianza en la porción, y los totales en
      vivo;
    - avisa del margen de error de ±40 % según los estudios;
    - se guarda cada alimento con `fuente: 'ia'`.
  - **Pruebas:** `pruebas/servidor/ia_test.mjs` (9 OK, con la respuesta de Claude simulada). UI probada en Chromium.
- **Costo estimado:** ~USD 0,0004 por foto (unos USD 1,1 al mes con 30 usuarios × 3 fotos al día).
- Luis creó la tabla `uso_ia` en la consola de D1 (23:24) y se publicó.

## 2026-10-30

### 21:56 · Fallo de press banca revisado (sin cambio de versión)
- Luis descargó el fallo desde Moderación y lo adjuntó en el chat.
  - Se agregó al banco como `fallo_bd375cc2` (real 10).
  - El banco vive fuera del repo público: son puntos del cuerpo de Luis.
- **La versión actual ya lo cuenta bien:** 10 reps, la primera a los 8,9 s. Los 2 movimientos de acomodarse (3,9 s y
  6,2 s) ya no cuentan; los mejoró `quitarPreparacion` después de la v2.6.1.
- Banco: 41/60. Luis puede marcarlo «✓ Corregido» en Moderación (desde aquí no se escribe en D1 de producción).

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
