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

// foto -> imagen en escala de grises, con mas contraste y de ~2000 px de lado (el OCR lee mejor)
async function preparar(archivo) {
  const bmp = await createImageBitmap(archivo);
  const esc = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)) * (Math.max(bmp.width, bmp.height) < 1000 ? 1.6 : 1);
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
  await w.setParameters({ tessedit_pageseg_mode: '3' });
  const t1 = (await w.recognize(lienzo)).data.text || '';
  let r = interpretar(t1), texto = t1;
  // si faltan datos, segunda lectura tratando la tabla como un solo bloque (lee mejor las filas con plastico arrugado o
  // reflejos); lo que no se leyo la primera vez se completa con la segunda
  const leidos = (x) => ['kcal', 'p', 'c', 'g'].filter((k) => x[k] != null && !x.calculados.includes(k)).length;
  if (leidos(r) < 4) {
    alProgreso('segunda lectura', 0);
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    const t2 = (await w.recognize(lienzo)).data.text || '';
    const r2 = interpretar(t1 + '\n' + t2);
    if (leidos(r2) >= leidos(r)) { r = r2; texto = t1 + '\n' + t2; }
  }
  return { ...r, texto };
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
    .replace(/(\d)\s*kca[l1i|)\]]?(?![a-z])/g, '$1 kcal').replace(/(\d)\s*k[j)\]](?![a-z])/g, '$1 kj') // "260kca)" "1089k)"
    .replace(/([a-z])o\s*g\b/g, '$1 0 g').replace(/total\s*[il|]\s*g\b/g, 'total 1 g') // "saturadaog" "totalig"
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
  out.por100 = !!cab && (col === 1 || !lineas.some((l) => /porcion/.test(l) && l !== cab && /\d\s*(g|ml)\b/.test(l))); // si hay porcion y una sola columna, es por porcion
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
  // "Calorías" a veces sale como "Calonon" o "Calo-": vale cualquier fila con kcal/kJ o que empiece parecido (no la de grasa)
  const le = fila(/energia|calorias|valor energetico/, /de gr|grasa|dieta|basad/) || fila(/\d\s*(kcal|kj)\b|^cal[o0]|energ/, /de gr|grasa|dieta|basad|valores/);
  if (le) {
    const ns = numeros(le), k = ns.filter((x) => x.u === 'kcal'), kj = ns.filter((x) => x.u === 'kj');
    out.kcal = k.length ? k[Math.min(col, k.length - 1)].v : kj.length ? Math.round(kj[Math.min(col, kj.length - 1)].v / 4.184) : tomar(le);
  }
  out.g = tomar(fila(/gr\w*\s*\w*\s*tota|lipidos/, /satur|trans|ians|insat/) || fila(/grasas?\b|lipidos/, /satur|trans|ians|insat|de gr/), 'g');
  out.c = tomar(fila(/carbohidratos?|hidratos de carbono|carbo\w*\s*tota/, /azucar|fibra/), 'g');
  out.p = tomar(fila(/proteinas?|prote\w*/), 'g');
  // donde hubo duda (9 o g), se elige la combinacion cuyas calorias (4·P + 4·C + 9·G) cuadran mejor con la etiqueta
  const ops = (v) => (Array.isArray(v) ? v : [v]);
  let mejor = null;
  for (const p of ops(out.p)) for (const c of ops(out.c)) for (const g of ops(out.g)) {
    const err = out.kcal ? Math.abs(4 * (p || 0) + 4 * (c || 0) + 9 * (g || 0) - out.kcal) : (Array.isArray(out.p) || Array.isArray(out.c) || Array.isArray(out.g) ? [p, c, g].reduce((a, x) => a + (x || 0), 0) : 0);
    if (!mejor || err < mejor.err) mejor = { err, p, c, g };
  }
  if (mejor) Object.assign(out, { p: mejor.p, c: mejor.c, g: mejor.g });
  // con las calorias y dos de los macros, el que falta se calcula (y viceversa); se avisa cuales se calcularon
  out.calculados = [];
  const ok = (v) => v != null && v >= 0 && v <= 100;
  if (out.kcal > 0) {
    const falta = ['p', 'c', 'g'].filter((k) => !ok(out[k]));
    if (falta.length === 1) {
      const k = falta[0], resto = out.kcal - ['p', 'c', 'g'].filter((x) => x !== k).reduce((a, x) => a + out[x] * (x === 'g' ? 9 : 4), 0);
      const v = Math.round(resto / (k === 'g' ? 9 : 4) * 10) / 10;
      if (v >= 0 && v <= 100) { out[k] = Math.max(0, v); out.calculados.push(k); }
    }
  } else if (['p', 'c', 'g'].every((k) => ok(out[k]))) {
    out.kcal = Math.round(4 * out.p + 4 * out.c + 9 * out.g); out.calculados.push('kcal');
  }
  // valores imposibles: se dejan vacios para que el usuario los escriba
  for (const k of ['p', 'c', 'g']) if (out[k] != null && !(out[k] >= 0 && out[k] <= 100)) out[k] = null;
  if (out.kcal != null && !(out.kcal > 0 && out.kcal <= 2000)) out.kcal = null;
  if (out.porcion != null && !(out.porcion > 0 && out.porcion <= 2000)) out.porcion = null;
  return out;
}
