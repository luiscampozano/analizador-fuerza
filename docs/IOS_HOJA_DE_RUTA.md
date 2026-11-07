# FuerzaPro en iPhone — hoja de ruta

Preparada el 6 de noviembre de 2026. **Todavía no se empieza:** primero se lanza en Google Play. Se arranca cuando una
parte importante de los usuarios use iPhone o lo pidan seguido (Luis dirá «vamos con iPhone»).

## Fase 0 · Ahora (gratis)
- Los usuarios de iPhone usan la web: Safari → **fuerzapro.pages.dev** → Compartir → Agregar a pantalla de inicio.
- Sin cobro en iPhone/web: usan el plan Gratis (más adelante se puede cobrar en la web con PayPal u otro, sin Apple).
- Pendiente: probar en un iPhone/iPad prestado (lo delicado: video con telemetría con WebCodecs en Safari, cámara en vivo).
- Mirar en Moderación cuántos usuarios usan iPhone.

## Fase 1 · Lo que hay que tener (Luis)
| Qué | Para qué | Costo |
|---|---|---|
| Cuenta **Apple Developer** personal | Publicar en la App Store | $99 al año |
| **Codemagic** (compilación en la nube, Mac M2) conectado al GitHub | Armar la app sin tener Mac y subirla a TestFlight | Gratis 500 min/mes (cuentas personales); luego pago por minuto |
| **Llave de API de App Store Connect** (.p8) | Que Codemagic firme y suba la app | Gratis — la pega Luis en Codemagic, **nunca en el chat** |
| iPhone o iPad prestado | Probar con TestFlight | — |

Un iPad sirve para probar, no para compilar (Xcode solo existe en Mac; Swift Playgrounds no alcanza para esta app).

## Fase 2 · Programación (Claude)
1. **Capacitor**: envolver la misma app web en una app nativa de iOS (mejor que PWABuilder para iPhone porque permite
   usar el cobro de Apple). Archivo `codemagic.yaml` para compilar y subir a TestFlight.
2. **Cobro con Apple (StoreKit)**: los mismos 6 planes (`plus_mensual`… `promax_anual`). Servidor: verificar con la
   App Store Server API (llave en un secreto de Cloudflare que pone Luis), tabla `compras` con columna de plataforma
   (solo agregar columnas), notificaciones de Apple para renovaciones y reembolsos.
3. **Iniciar sesión con Apple** (Apple lo exige porque hay inicio con Google).
4. **Ajustes de iPhone**: cámara y modo en vivo, video con telemetría, gesto Atrás, zonas seguras de la pantalla.
5. Ya existe y Apple lo pide: borrar la cuenta desde la app, privacidad, términos.

## Fase 3 · Publicar
1. App Store Connect: ficha, capturas de iPhone, etiquetas de privacidad, cuenta de prueba para revisores.
2. **TestFlight**: sin mínimo de testers ni días (no hay regla de 12 × 14 como en Google).
3. Revisión de Apple: 1-2 días, más estricta que Google (puede pedir cambios una o dos veces).

## Tiempos estimados (trabajando por partes)
| Etapa | Tiempo |
|---|---|
| Cuenta de Apple aprobada + Codemagic + llave | 2-5 días (la verificación de Apple manda) |
| Capacitor + primera versión en TestFlight | 2-4 días |
| Cobro con Apple + servidor + Iniciar sesión con Apple | 5-8 días |
| Ajustes y pruebas en iPhone | 1 semana |
| Ficha + revisión de Apple (con posibles correcciones) | 3-7 días |
| **Total** | **unas 3 a 5 semanas** |

Costos: $99/año + comisión de Apple 15 % (programa de desarrolladores pequeños, igual que Google).
