# Diario de FuerzaPro

Bitácora de trabajo, de la más reciente a la más antigua. **Regla:** antes de empezar cualquier actividad, lee las
últimas entradas; al terminarla, agrega una entrada arriba con: fecha y hora (Ecuador), qué pidió Luis, qué se hizo,
versión publicada y qué quedó pendiente. Escribe en español sencillo.

---

## 2026-10-29

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
