// Historial de series guardado en el propio celular (localStorage). Exportable/importable como JSON.
const CLAVE = 'af_historial_v1';

export function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) { return []; }
}
function escribir(lista) {
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); return true; } catch (e) { return false; }
}
export function agregar(registro) {
  const lista = leer();
  const nuevo = { id: Date.now().toString(36), fecha: new Date().toISOString(), ...registro };
  lista.push(nuevo);
  escribir(lista);
  return nuevo;
}
export function borrar(id) { escribir(leer().filter((r) => r.id !== id)); }
// cambia campos de una serie ya guardada (p. ej. al corregir a mano el conteo de reps)
export function actualizar(id, cambios) {
  const lista = leer(), r = lista.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, cambios, { editado: new Date().toISOString() });
  escribir(lista);
  return r;
}
export function exportar() {
  const blob = new Blob([JSON.stringify({ app: 'analizador-fuerza', version: 1, series: leer() }, null, 1)], { type: 'application/json' });
  return blob;
}
export async function importar(archivo) {
  const datos = JSON.parse(await archivo.text());
  const nuevas = Array.isArray(datos) ? datos : datos.series || [];
  const lista = leer(), ids = new Set(lista.map((r) => r.id));
  let agregadas = 0;
  for (const r of nuevas) if (r && r.id && !ids.has(r.id)) { lista.push(r); agregadas++; }
  lista.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  escribir(lista);
  return agregadas;
}
export function aCSV() {
  const cols = ['fecha', 'ejercicio', 'carga', 'reps', 'vMejor', 'perdida', 'rir', 'rpe', 'rm', 'fPico', 'pPico'];
  const filas = leer().map((r) => cols.map((c) => (r[c] ?? '')).join(','));
  return new Blob(['\ufeff' + [cols.join(','), ...filas].join('\n')], { type: 'text/csv' });
}
