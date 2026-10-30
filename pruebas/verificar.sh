#!/usr/bin/env bash
# Verificación rápida antes de publicar FuerzaPro.
# Uso (desde la raíz del repo):  bash pruebas/verificar.sh
# Requiere Node 22 o superior (usa node:sqlite para las pruebas del servidor).
set -u
cd "$(dirname "$0")/.."
FALLOS=0
mal() { echo "❌ $*"; FALLOS=$((FALLOS+1)); }
bien() { echo "✅ $*"; }

# 1) Sintaxis de todos los módulos JavaScript
for f in js/*.js _worker.js sw.js; do
  if node --input-type=module --check < "$f" 2>/tmp/af_err.txt; then :; else mal "Sintaxis en $f"; cat /tmp/af_err.txt; fi
done
[ $FALLOS -eq 0 ] && bien "Sintaxis JS correcta"

# 2) La versión del service worker y la de la app deben coincidir
V_SW=$(grep -oE "af-[0-9]+\.[0-9]+\.[0-9]+" sw.js | head -1 | sed 's/af-//')
V_APP=$(grep -oE "const VERSION = '[0-9.]+'" js/app.js | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
if [ "$V_SW" = "$V_APP" ]; then bien "Versión coherente: $V_APP"; else mal "Versión distinta: sw.js=$V_SW app.js=$V_APP"; fi

# 3) Todos los archivos de la lista de caché del service worker existen
for f in $(node -e "const s=require('fs').readFileSync('sw.js','utf8');const m=s.match(/const BASE = \[([\s\S]*?)\];/);console.log(m[1].match(/'[^']+'/g).map(x=>x.slice(1,-1)).filter(x=>x!=='./').join(' '))"); do
  [ -f "$f" ] || mal "sw.js pide '$f' pero no existe"
done
# y todo js/*.js está en la lista de caché
for f in js/*.js; do grep -q "'$f'" sw.js || mal "$f no está en la lista BASE de sw.js"; done
bien "Lista de caché revisada"

# 4) Pruebas del servidor (_worker.js) con base de datos en memoria
for t in pruebas/servidor/*.mjs; do
  SAL=$(node "$t" 2>&1); OK=$(echo "$SAL" | grep -c '^OK'); F=$(echo "$SAL" | grep -c 'FAIL\|Error')
  if [ "$F" -eq 0 ] && [ "$OK" -gt 0 ]; then bien "$t: $OK pruebas OK"; else mal "$t: $F fallos"; echo "$SAL" | grep -B2 -A5 'FAIL\|Error' | head -30; fi
done

# 5) Analisis de cardio/boxeo: esqueletos sinteticos y un video real
SAL=$(node pruebas/actividad/sinteticos.mjs 2>&1); if echo "$SAL" | grep -q 'Todos los casos dentro'; then bien "Cardio/boxeo sintéticos OK"; else mal "Cardio/boxeo sintéticos"; echo "$SAL" | tail -15; fi
SAL=$(node pruebas/alterno/sinteticos.mjs 2>&1); if echo "$SAL" | grep -q 'Todos los casos dentro'; then bien "Curl alterno (muñecos) OK"; else mal "Curl alterno (muñecos)"; echo "$SAL"; fi
SAL=$(node pruebas/munecos/munecos.mjs 2>&1); N=$(echo "$SAL" | grep -o 'TOTAL [0-9]*' | grep -o '[0-9]*'); if [ "${N:-0}" -ge 3270 ]; then bien "Muñecos 3D: $(echo "$SAL" | tail -1)"; else mal "Muñecos 3D bajaron: $(echo "$SAL" | tail -1) (mínimo 3270)"; fi
SAL=$(node pruebas/actividad/boxeo_real.mjs 2>&1); if echo "$SAL" | grep -q '^OK'; then bien "Boxeo real: $(echo "$SAL" | head -1)"; else mal "Boxeo real"; echo "$SAL"; fi

echo
if [ $FALLOS -eq 0 ]; then echo "🟢 TODO BIEN — se puede publicar"; else echo "🔴 $FALLOS problema(s) — NO publicar"; exit 1; fi
