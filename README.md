# ⚡ Analizador de Fuerza

**Autor:** Ing. Luis Campozano, MBA

App web (PWA) que analiza el video de una serie de gimnasio **directamente en el celular** y entrega:

- Video vertical con el **esqueleto**, la **fuerza aplicada** en cada instante, la **velocidad** y la **potencia**, listo para redes.
- **Repeticiones**, recorrido, velocidad media y pico, **pérdida de velocidad** (fatiga).
- **RIR** (repeticiones en reserva), **RPE**, **1RM estimado** (peso máximo teórico) y **cargas sugeridas** para 1–15 repeticiones.
- **Historial** en el propio teléfono, con la evolución del 1RM y el **perfil carga-velocidad** al registrar varias cargas.

Nada se sube a internet: la detección de pose (MediaPipe) y la física corren en el navegador del teléfono.

## Usarla

1. Abre la app en Chrome del celular (enlace de GitHub Pages de este repositorio).
2. Menú ⋮ → **Instalar app** / **Agregar a pantalla principal**.
3. Elige el ejercicio, graba o elige el video, escribe el peso y pulsa **Analizar serie**.

La primera vez descarga la IA (~10–30 MB según la precisión); después funciona sin conexión.

## Ejercicios

28 ejercicios en 4 grupos: máquinas guiadas (remo en riel, prensa 45°, hack, Smith), peso libre (sentadilla, peso muerto, banca, press militar, remos, curl, hip thrust, zancada…), poleas (jalón, remo, tríceps, curl, face pull) y peso corporal (dominadas, fondos, flexiones, remo invertido, sentadilla). Las máquinas de palanca y los movimientos en arco (laterales, extensiones) no están soportados.

## Cómo calcula

| Qué | Cómo |
|---|---|
| Escala | Estatura del usuario + proporciones antropométricas (Drillis-Contini) del muslo y la pierna |
| Movimiento de cámara | Posición del punto seguido (manos, hombros, cadera o pies) relativa a una parte fija del cuerpo |
| Velocidad / aceleración | Filtro Savitzky-Golay sobre la posición a lo largo del eje principal del movimiento |
| Fuerza | F = m·(g·sen θ + a) / r (θ = inclinación del recorrido, r = relación de polea) |
| RIR | Extrapolación de la caída de velocidad por rep hasta la velocidad mínima de la última rep posible (MVT); en banca y sentadilla se combina con el %1RM por velocidad |
| RPE | 10 − RIR |
| 1RM | Epley con reps + RIR; en banca y sentadilla también por la relación carga-velocidad (González-Badillo y Sánchez-Medina 2010; Sánchez-Medina y col. 2017) |

Son **estimaciones**: velocidad y potencia tienen un margen de ±15–20 %, mayor si la cámara se mueve o está en diagonal.

## Estructura

```
index.html, style.css, manifest.json, sw.js   interfaz, estilos, instalación y modo sin conexión
js/ejercicios.js   biblioteca de ejercicios (punto seguido, ancla, sentido, MVT)
js/pose.js         MediaPipe Pose Landmarker en el navegador (GPU si hay)
js/fisica.js       motor físico (port del motor Python validado)
js/analisis.js     RIR, RPE, 1RM, cargas sugeridas, perfil carga-velocidad
js/render.js       video MP4 con telemetría (WebCodecs + mp4-muxer)
js/historial.js    historial local, respaldo y exportación CSV
```

## Licencias

Código © Ing. Luis Campozano, MBA. Incluye/usa MediaPipe Tasks Vision (Google, Apache 2.0) , mp4-muxer (Vanilagy, MIT) y Mediabunny (Vanilagy, MPL-2.0) para leer videos con el decodificador del teléfono.
