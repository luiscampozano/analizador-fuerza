// Importar entrenamientos desde otras apps (Hevy, Strong) o desde cualquier Excel/CSV con columnas
// de fecha, ejercicio, peso y repeticiones. Todo se lee en el telefono: el archivo no se sube a ningun lado.

const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim();
const normCab = (t) => norm(t).replace(/[^a-z0-9() ]/g, ' ').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ lectura de archivos
export async function leerArchivo(archivo) {
  const nombre = (archivo.name || '').toLowerCase();
  const buf = new Uint8Array(await archivo.arrayBuffer());
  const esZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (esZip || nombre.endsWith('.xlsx')) return leerXLSX(buf);
  if (nombre.endsWith('.xls')) throw new Error('El formato .xls antiguo no se puede leer. Abre el archivo y guárdalo como .xlsx o .csv.');
  return [leerCSV(new TextDecoder('utf-8').decode(buf).replace(/^﻿/, ''))];
}

export function leerCSV(texto) {
  const primera = texto.split(/\r?\n/).find((l) => l.trim()) || '';
  const cuenta = (c) => primera.split(c).length;
  const sep = [',', ';', '\t'].sort((a, b) => cuenta(b) - cuenta(a))[0];
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo); if (fila.some((x) => x.trim() !== '')) filas.push(fila);
  return filas;
}

async function inflar(datos) {
  const ds = new DecompressionStream('deflate-raw');
  const res = new Response(new Blob([datos]).stream().pipeThrough(ds));
  return new Uint8Array(await res.arrayBuffer());
}
async function leerZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('El archivo Excel está dañado.');
  const total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const archivos = {}, dec = new TextDecoder();
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nombre = dec.decode(buf.subarray(p + 46, p + 46 + ln));
    archivos[nombre] = async () => {
      const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const datos = buf.subarray(ini, ini + tam);
      return dec.decode(metodo === 0 ? datos : await inflar(datos));
    };
    p += 46 + ln + le + lc;
  }
  return archivos;
}
const ent = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, '&');
const textoT = (x) => [...x.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => ent(m[1])).join('');
const colNum = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

export async function leerXLSX(buf) {
  const z = await leerZip(buf);
  const compartidos = z['xl/sharedStrings.xml'] ? [...(await z['xl/sharedStrings.xml']()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoT(m[1])) : [];
  const hojas = Object.keys(z).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  const out = [];
  for (const h of hojas) {
    const xml = await z[h]();
    const filas = [];
    for (const m of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const fila = [];
      for (const c of m[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1], cuerpo = c[2] || '';
        const ref = (at.match(/r="([A-Z]+\d+)"/) || [])[1], t = (at.match(/t="(\w+)"/) || [])[1];
        const v = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let val = '';
        if (t === 's') val = compartidos[+v] ?? '';
        else if (t === 'inlineStr') val = textoT(cuerpo);
        else if (v !== undefined) val = t === 'str' || t === 'b' ? ent(v) : +v;
        fila[ref ? colNum(ref) : fila.length] = val;
      }
      for (let i = 0; i < fila.length; i++) if (fila[i] === undefined) fila[i] = '';
      if (fila.some((x) => String(x).trim() !== '')) filas.push(fila);
    }
    out.push(filas);
  }
  return out;
}

// ------------------------------------------------------------------ columnas
const SINONIMOS = {
  fecha: ['start time', 'date', 'fecha', 'dia', 'inicio', 'fecha y hora', 'workout date', 'fecha inicio'],
  fin: ['end time', 'fin', 'hora fin'],
  titulo: ['title', 'workout name', 'workout', 'entrenamiento', 'rutina', 'nombre del entrenamiento', 'titulo', 'sesion'],
  ejercicio: ['exercise title', 'exercise name', 'exercise', 'ejercicio', 'nombre del ejercicio'],
  kg: ['weight kg', 'weight (kg)', 'peso (kg)', 'peso kg', 'kg', 'peso', 'weight', 'carga', 'carga (kg)'],
  lb: ['weight lbs', 'weight (lbs)', 'weight lb', 'lbs', 'lb', 'peso (lb)', 'peso lb'],
  reps: ['reps', 'repeticiones', 'rep', 'repetitions'],
  rpe: ['rpe'],
  tipo: ['set type', 'tipo', 'tipo de serie'],
  orden: ['set order', 'set index', 'serie', 'set', 'n serie'],
  duracion: ['duration', 'duracion'],
  notas: ['exercise notes', 'notas', 'notes'],
};
function columnas(cab) {
  const c = cab.map(normCab), out = {};
  for (const [k, lista] of Object.entries(SINONIMOS)) {
    const i = c.findIndex((x) => lista.includes(x));
    if (i >= 0 && !Object.values(out).includes(i)) out[k] = i;
  }
  return out;
}
function elegirTabla(tablas) {
  let mejor = null;
  for (const filas of tablas) for (let f = 0; f < Math.min(6, filas.length); f++) {
    const col = columnas(filas[f]);
    const pts = ('fecha' in col) * 3 + ('ejercicio' in col) * 3 + ('kg' in col || 'lb' in col) * 2 + ('reps' in col) * 2;
    if (!mejor || pts > mejor.pts) mejor = { pts, filas: filas.slice(f + 1), col, cab: filas[f] };
  }
  return mejor;
}

// ------------------------------------------------------------------ valores
const MESES = { jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dec: 11, dic: 11 };
export function leerFecha(x) {
  if (typeof x === 'number' && x > 20000 && x < 80000) { // numero de serie de Excel (hora local)
    const d = new Date(Math.round((x - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
  }
  const t = String(x ?? '').trim(); if (!t) return null;
  const hora = (h, mi, ap) => { h = +h || 0; if (ap) { ap = ap.toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; } return [h, +mi || 0]; };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0);
  m = t.match(/^(\d{1,2})\s+([a-zA-Z]{3})[a-zA-Z.]*\s+(\d{4}),?\s*(?:(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i); // Hevy: 15 Mar 2024, 18:30
  if (m && norm(m[2]) in MESES) { const [h, mi] = hora(m[4], m[5], m[6]); return new Date(+m[3], MESES[norm(m[2])], +m[1], h, mi); }
  m = t.match(/^([a-zA-Z]{3})[a-zA-Z.]*\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
  if (m && norm(m[1]) in MESES) { const [h, mi] = hora(m[4], m[5], m[6]); return new Date(+m[3], MESES[norm(m[1])], +m[2], h, mi); }
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s*(?:(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
  if (m) {
    let d = +m[1], mes = +m[2]; if (mes > 12 && d <= 12) [d, mes] = [mes, d]; // dd/mm salvo que sea claramente mm/dd
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3], [h, mi] = hora(m[4], m[5], m[6]);
    return new Date(y, mes - 1, d, h, mi);
  }
  const p = Date.parse(t); return Number.isFinite(p) ? new Date(p) : null;
}
export function leerNumero(x) {
  if (typeof x === 'number') return x;
  let t = String(x ?? '').trim().replace(/[^\d,.-]/g, ''); if (!t) return null;
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.'); else t = t.replace(/,/g, '');
  const n = parseFloat(t); return Number.isFinite(n) ? n : null;
}
function leerDuracionMin(x) {
  if (typeof x === 'number') return x < 1 ? x * 1440 : x; // fraccion de dia de Excel o minutos
  const t = String(x ?? '').toLowerCase(); let min = 0, ok = false;
  const h = t.match(/(\d+)\s*h/), mi = t.match(/(\d+)\s*m/), hms = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hms) return +hms[1] * 60 + +hms[2];
  if (h) { min += +h[1] * 60; ok = true; } if (mi) { min += +mi[1]; ok = true; }
  return ok ? min : null;
}
function leerTipo(tipo, orden) {
  const t = norm(tipo || ''), o = norm(orden || '');
  if (t.startsWith('warm') || t.startsWith('calent') || o === 'w') return 'calentamiento';
  if (t.startsWith('fail') || t.startsWith('fallo') || o === 'f') return 'fallo';
  if (t.startsWith('drop') || o === 'd') return 'drop';
  return 'normal';
}

// ------------------------------------------------------------------ ejercicios
const EQUIPO = { barbell: ['Barra'], dumbbell: ['Mancuernas', 'Mancuerna'], cable: ['Polea'], machine: ['Máquina de placas', 'Máquina con discos', 'Máquina de riel', 'Smith'],
  smith: ['Smith'], kettlebell: ['Kettlebell'], bodyweight: ['Peso corporal'], weighted: ['Peso corporal'], ez: ['Barra Z'], barra: ['Barra'], mancuernas: ['Mancuernas', 'Mancuerna'],
  mancuerna: ['Mancuerna', 'Mancuernas'], polea: ['Polea'], maquina: ['Máquina de placas', 'Máquina con discos', 'Máquina de riel'] };
const VACIAS = new Set(['con', 'de', 'del', 'en', 'la', 'el', 'al', 'a', 'y', 'the', 'on', 'with', 'of', 'bar', 'plate', 'flat', 'back', 'standing', 'bench', 'loaded', 'band', 'assisted', 'machine', 'barbell', 'dumbbell', 'cable', 'smith', 'kettlebell', 'bodyweight', 'weighted', 'ez', 'barra', 'mancuernas', 'mancuerna', 'polea', 'maquina']);
const raiz = (w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);
const fichas = (t) => norm(t).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean).map(raiz);

export function emparejar(nombre, ejercicios) {
  const n = norm(nombre);
  const exacto = ejercicios.find((e) => norm(e.nombre) === n || norm(e.corto) === n);
  if (exacto) return exacto.id;
  const todas = fichas(nombre), clave = todas.filter((w) => !VACIAS.has(w));
  if (!clave.length) return null;
  const equipos = todas.flatMap((w) => EQUIPO[w] || []);
  let mejor = null;
  for (const e of ejercicios) {
    const fe = new Set(fichas(`${e.en || ''} ${e.nombre}`));
    const cubiertas = clave.filter((w) => fe.has(w)).length;
    if (cubiertas / clave.length < 0.6) continue;
    const extra = fichas(e.en || '').filter((w) => !VACIAS.has(w) && !todas.includes(w)).length; // palabras que el nombre importado no tiene (incline, front…)
    const eq = equipos.length ? (equipos.includes(e.equipo) ? 1 : -0.5) : 0;
    const asis = e.asistido && !todas.some((w) => w.startsWith('assist') || w.startsWith('asist')) ? -1.5 : 0;
    const pts = todas.filter((w) => fe.has(w)).length - 0.6 * extra + eq + asis - fe.size * 0.001;
    if (!mejor || pts > mejor.pts) mejor = { pts, id: e.id };
  }
  return mejor ? mejor.id : null;
}

// ------------------------------------------------------------------ armado de entrenamientos
function hash(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36); }

// unidad: 'kg' | 'lb' (solo se usa si el archivo no dice la unidad en la columna)
export function convertir(tablas, ejercicios, { unidad = 'kg' } = {}) {
  const t = elegirTabla(tablas);
  if (!t || !('fecha' in t.col) || !('ejercicio' in t.col)) throw new Error('No encontré las columnas de fecha y ejercicio. El archivo debe tener al menos: Fecha, Ejercicio, Peso y Reps.');
  const { col } = t;
  const lb = !('kg' in col) && 'lb' in col ? true : unidad === 'lb' && !(normCab(t.cab[col.kg] || '').includes('kg'));
  const cab = t.cab.map(normCab).join('|');
  const origen = cab.includes('exercise title') ? 'hevy' : cab.includes('workout name') && cab.includes('exercise name') ? 'strong' : 'excel';
  const grupos = new Map(), sinPareja = new Set(); let filas = 0, series = 0;
  for (const f of t.filas) {
    const fecha = leerFecha(f[col.fecha]), nombre = String(f[col.ejercicio] ?? '').trim();
    if (!fecha || !nombre) continue;
    filas++;
    let kg = leerNumero(f[col.kg ?? col.lb]); const reps = leerNumero(f[col.reps]);
    if (!(kg > 0) && !(reps > 0)) continue; // filas de descanso o cardio sin datos
    if (kg !== null && lb) kg *= 0.45359237;
    const titulo = 'titulo' in col ? String(f[col.titulo] ?? '').trim() : '';
    const clave = 'titulo' in col ? `${+fecha}|${titulo}` : fecha.toDateString();
    if (!grupos.has(clave)) {
      let fin = 'fin' in col ? leerFecha(f[col.fin]) : null;
      if (!fin && 'duracion' in col) { const d = leerDuracionMin(f[col.duracion]); if (d) fin = new Date(+fecha + d * 60000); }
      grupos.set(clave, { id: 'imp-' + hash(clave + origen), titulo: titulo || 'Entrenamiento', inicio: fecha.toISOString(), fin: fin ? fin.toISOString() : null,
        origen, ejercicios: [] });
    }
    const g = grupos.get(clave);
    let e = g.ejercicios.find((x) => x.nombre === nombre);
    if (!e) {
      const id = emparejar(nombre, ejercicios);
      if (!id) sinPareja.add(nombre);
      e = { ej: id, nombre, notas: 'notas' in col ? String(f[col.notas] ?? '').trim() : '', series: [] };
      g.ejercicios.push(e);
    }
    const rpe = leerNumero(f[col.rpe]);
    e.series.push({ kg: kg !== null ? Math.round(kg * 100) / 100 : null, reps: reps !== null ? Math.round(reps) : null, rpe: rpe > 0 ? rpe : null,
      tipo: leerTipo(f[col.tipo], f[col.orden]), hecha: true });
    series++;
  }
  const entrenos = [...grupos.values()].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  return { entrenos, origen, filas, series, sinPareja: [...sinPareja], lb };
}
