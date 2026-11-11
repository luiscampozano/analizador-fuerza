#!/usr/bin/env bash
# Corre los 3 recorridos automáticos (E2E) de FuerzaPro: analizar un video, registrar un entrenamiento y anotar una comida.
# Requiere Playwright con Chromium. En GitHub los instala el trabajo «recorridos» (.github/workflows).
cd "$(dirname "$0")/../.." || exit 1
if ! node -e "require('playwright')" 2>/dev/null; then echo "⚪ Recorridos E2E omitidos: falta Playwright en esta computadora"; exit 0; fi
MAL=0
for R in entrenar comida analizar; do
  if SAL=$(node pruebas/e2e/$R.cjs 2>&1); then echo "✅ Recorrido $R"; else echo "❌ Recorrido $R"; echo "$SAL" | tail -8; MAL=1; fi
done
[ $MAL = 0 ] && echo "🟢 RECORRIDOS BIEN" || { echo "🔴 FALLÓ ALGÚN RECORRIDO"; exit 1; }
