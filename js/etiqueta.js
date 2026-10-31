// Leer la tabla nutricional de una etiqueta con la camara (OCR en el telefono, sin internet: Tesseract.js en vendor/).
// Se carga solo cuando se usa (~10 MB la primera vez; luego queda guardado). Devuelve los numeros para llenar el
// formulario de un alimento nuevo; el usuario siempre los revisa antes de guardar. (v2.21.0)
const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
let lib = null, trabajador = null;

function cargarScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el lector de etiquetas.'));
    document.head.appendChild(s);
  });
}
async function obtenerTrabajador(alProgreso) {
  if (trabajador) return trabajador;
  if (!lib) lib = cargarScript(BASE + 'tesseract.min.js').then(() => window.Tesseract);
  const T = await lib;
  trabajador = await T.createWorker('spa', 1, {
    workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE, gzip: true, workerBlobURL: false,
    logger: (m) => { if (m && typeof m.progress === 'number') alProgreso(m.status, m.progress); },
  });
  return trabajador;
}

// foto -> imagen en escala de grises, con mas contraste y de ~1600 px de ancho (el OCR lee mejor)
async function preparar(archivo) {
  const bmp = await createImageBitmap(archivo);
  const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)) * (Math.max(bmp.width, bmp.height) < 1000 ? 1.6 : 1);
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * 1.5 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(im, 0, 0);
  return c;
}

export async function leerEtiqueta(archivo, alProgreso = () => {}) {
  const w = await obtenerTrabajador(alProgreso);
  const lienzo = await preparar(archivo);
  const r = await w.recognize(lienzo);
  return { ...interpretar(r.data.text || ''), texto: r.data.text || '' };
}

// ------------------------------------------------------------------ texto -> numeros
// Etiquetas de Ecuador (RTE INEN 022) y similares: "Tamaño por porción 30 g", "Energía (Calorías) 150 kcal 628 kJ",
// "Grasa total 5 g", "Carbohidratos totales 20 g", "Proteína 3 g". Toma el primer numero de cada fila (suele ser
// "por porción"); si la etiqueta trae una columna "por 100 g", se detecta y se usa esa.
const num = (t) => parseFloat(String(t).replace(',', '.'));
export function interpretar(texto) {
  const lineas = String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d)\s*[oO]\b/g, '$10').replace(/(\d)\s+([.,])\s*(\d)/g, '$1$2$3')
    .replace(/\bo\s*g\b/g, '0 g') // "og" = "0 g"
    .replace(/(\d)\s*mi\b/g, '$1 ml') // "200 mi" = "200 ml"
    .replace(/(\d)\s+9(?=\s*[(\n]|\s*$)/gm, '$1 g') // el OCR suele leer la "g" como "9": "30 9 (6 galletas)"
    .split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // numeros de una fila, sin los porcentajes (%VD)
  // un numero sin unidad que termina en 9 puede ser "<numero> g" mal leido ("6 g" -> "69"): se guarda la alternativa
  const numeros = (l) => [...l.replace(/\d+[.,]?\d*\s*%/g, ' ').matchAll(/(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g|ml)?/g)]
    .map((m) => (!m[2] && /[.,]\d9$/.test(m[1]) ? { v: num(m[1].slice(0, -1)), u: 'g', alt: null } // "4,79" = "4,7 g" (las etiquetas usan 1 decimal)
      : { v: num(m[1]), u: m[2] || '', alt: !m[2] && /\d9$/.test(m[1]) ? alternativas(m[1].slice(0, -1)) : null }));
  // "649" puede ser "64 g" o "6,4 g" (la coma tambien se pierde a veces)
  function alternativas(t) { const a = [num(t)]; if (/^\d{2,3}$/.test(t)) a.push(num(t.slice(0, -1) + '.' + t.slice(-1))); return a; }
  const fila = (re, excluir = null) => lineas.find((l) => re.test(l) && !(excluir && excluir.test(l)));
  const out = { porcion: null, kcal: null, p: null, c: null, g: null, por100: false };
  // ¿hay columna por 100 g / 100 ml?
  const cab = lineas.find((l) => /(por|en|cada)\s*100\s*(g|ml)\b/.test(l));
  const col = cab && /porcion/.test(cab) && cab.indexOf('porcion') < cab.indexOf('100') ? 1 : 0; // "por porcion | por 100 g"
  out.por100 = !!cab;
  const tomar = (l, preferir = null) => {
    if (!l) return null;
    let ns = numeros(l).filter((x) => x.u !== 'mg');
    if (preferir) { const k = ns.filter((x) => x.u === preferir); if (k.length > col) ns = k; } // sin borrar la columna buscada
    const x = ns[Math.min(col, ns.length - 1)];
    return x ? (x.alt != null ? [x.v, ...x.alt] : x.v) : null;
  };
  const lp = lineas.find((l) => /porcion/.test(l) && l !== cab && /\d\s*(g|ml)\b/.test(l));
  if (lp) { const m = lp.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/); if (m) out.porcion = num(m[1]); }
  // energia: se prefiere el numero en kcal; si solo hay kJ se convierte
  const le = fila(/energia|calorias|valor energetico/);
  if (le) {
    const ns = numeros(le), k = ns.filter((x) => x.u === 'kcal'), kj = ns.filter((x) => x.u === 'kj');
    out.kcal = k.length ? k[Math.min(col, k.length - 1)].v : kj.length ? Math.round(kj[Math.min(col, kj.length - 1)].v / 4.184) : tomar(le);
  }
  out.g = tomar(fila(/grasas?\s*totales?|grasa\b|grasas\b|lipidos/, /saturad|trans|monoinsat|poliinsat/), 'g');
  out.c = tomar(fila(/carbohidratos?|hidratos de carbono/, /azucar/), 'g');
  out.p = tomar(fila(/proteinas?/), 'g');
  // donde hubo duda (9 o g), se elige la combinacion cuyas calorias (4·P + 4·C + 9·G) cuadran mejor con la etiqueta
  const ops = (v) => (Array.isArray(v) ? v : [v]);
  let mejor = null;
  for (const p of ops(out.p)) for (const c of ops(out.c)) for (const g of ops(out.g)) {
    const err = out.kcal ? Math.abs(4 * (p || 0) + 4 * (c || 0) + 9 * (g || 0) - out.kcal) : (Array.isArray(out.p) || Array.isArray(out.c) || Array.isArray(out.g) ? [p, c, g].reduce((a, x) => a + (x || 0), 0) : 0);
    if (!mejor || err < mejor.err) mejor = { err, p, c, g };
  }
  if (mejor) Object.assign(out, { p: mejor.p, c: mejor.c, g: mejor.g });
  // valores imposibles: se dejan vacios para que el usuario los escriba
  for (const k of ['p', 'c', 'g']) if (out[k] != null && !(out[k] >= 0 && out[k] <= 100)) out[k] = null;
  if (out.kcal != null && !(out.kcal > 0 && out.kcal <= 2000)) out.kcal = null;
  if (out.porcion != null && !(out.porcion > 0 && out.porcion <= 2000)) out.porcion = null;
  return out;
}
