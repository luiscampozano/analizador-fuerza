// v2.73.0 dos idiomas (español / inglés). La app está escrita en español; en inglés se traduce lo que se ve
// con un diccionario (js/idioma_en.js: texto en español → texto en inglés) y un observador de la página:
// cada texto que aparece (también los que crea el código después) se cambia si está en el diccionario.
// - af_idioma: 'auto' (idioma del teléfono, por defecto) | 'es' | 'en'.
// - La primera vez en inglés, si la persona no eligió unidad, el peso empieza en libras.
// - Para no traducir algo (nombres, publicaciones de otros), ponerle data-sin-traducir al elemento.
import { EN, PATRONES } from './idioma_en.js';

const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const guardar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* nada */ } };

// quien ya usaba la app antes de que existiera el inglés se queda en español (no cambia de golpe por tener el teléfono en inglés)
if (leer('af_idioma') == null && leer('af_bienvenida') != null && leer('af_idioma_uni') == null) guardar('af_idioma', 'es');
export const preferencia = () => { const p = leer('af_idioma'); return p === 'es' || p === 'en' ? p : 'auto'; };
const delTelefono = () => { try { return /^es\b/i.test(navigator.language || 'es') ? 'es' : 'en'; } catch (e) { return 'es'; } };
export const idioma = () => { const p = preferencia(); return p === 'auto' ? delTelefono() : p; };
export const enIngles = () => idioma() === 'en';
export const telefono = delTelefono;

// cambiar el idioma: se guarda y se recarga (los textos originales están en español)
export function ponerPreferencia(p) {
  guardar('af_idioma', p === 'es' || p === 'en' ? p : null);
  try { location.reload(); } catch (e) { /* nada */ }
}

// traducir un texto suelto (para usar desde el código: t('Guardar'))
export function t(s) {
  if (!enIngles() || s == null) return s;
  const str = String(s), k = str.replace(/\s+/g, ' ').trim();
  if (!k) return str;
  const r = traducir(k);
  if (r == null) return str;
  const ini = str.match(/^\s*/)[0], fin = str.match(/\s*$/)[0];
  return ini + r + fin;
}
function traducir(k) {
  if (Object.prototype.hasOwnProperty.call(EN, k)) return EN[k];
  for (const [re, rep] of PATRONES) { if (re.test(k)) return k.replace(re, rep); }
  if (k.includes(' · ')) { // «Espalda · Máquina de riel»: cada parte por separado
    const p = k.split(' · '), r = p.map((x) => (Object.prototype.hasOwnProperty.call(EN, x) ? EN[x] : x));
    if (r.some((x, i) => x !== p[i])) return r.join(' · ');
  }
  return null;
}
// lo que ya se tradujo no se vuelve a traducir (en el calendario «L»→«M» y luego «M»→«T» sería un error)
const hechos = new WeakMap();

const ATRIBUTOS = ['placeholder', 'aria-label', 'title', 'alt'];
const saltar = (el) => !!(el && el.closest && el.closest('[data-sin-traducir],script,style,textarea,[contenteditable="true"]'));
function textoNodo(n) {
  if (saltar(n.parentElement)) return;
  const v = n.nodeValue; if (!v || !/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(v)) return;
  if (hechos.get(n) === v) return;
  const r = t(v); if (r !== v) { hechos.set(n, r); n.nodeValue = r; }
}
function atributos(el) {
  if (saltar(el)) return;
  for (const a of ATRIBUTOS) {
    const v = el.getAttribute && el.getAttribute(a); if (!v) continue;
    const m = hechos.get(el) || {}; if (m[a] === v) continue;
    const r = t(v); if (r !== v) { m[a] = r; hechos.set(el, m); el.setAttribute(a, r); }
  }
}
export function traducirArbol(raiz) {
  if (!enIngles() || !raiz) return;
  if (raiz.nodeType === 3) { textoNodo(raiz); return; }
  if (raiz.nodeType !== 1 || saltar(raiz)) return;
  atributos(raiz);
  raiz.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(atributos);
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) textoNodo(n);
}

// v2.74.0 PDF (jsPDF): traduce los textos y las tablas de un documento
export function traducirPDF(doc) {
  if (!enIngles() || !doc) return doc;
  const tr = (x) => (Array.isArray(x) ? x.map(tr) : typeof x === 'string' ? t(x) : x);
  for (const k of ['text', 'splitTextToSize', 'getTextWidth']) { const o = doc[k]; if (typeof o === 'function') doc[k] = function (txt, ...r) { return o.call(doc, tr(txt), ...r); }; }
  const at = doc.autoTable;
  if (typeof at === 'function') doc.autoTable = function (op = {}) {
    const fila = (f) => (Array.isArray(f) ? f.map((c) => (c && typeof c === 'object' && typeof c.content === 'string' ? { ...c, content: t(c.content) } : tr(c))) : f);
    return at.call(doc, { ...op, head: op.head && op.head.map(fila), body: op.body && op.body.map(fila), foot: op.foot && op.foot.map(fila) });
  };
  return doc;
}
export function iniciar() {
  if (typeof document === 'undefined') return;
  const en = enIngles();
  document.documentElement.lang = en ? 'en' : 'es';
  if (!en) return;
  // la primera vez en inglés: libras por defecto (si no eligió unidad antes)
  if (!leer('af_idioma_uni')) { if (!leer('af_unidades')) guardar('af_unidades', 'lb'); guardar('af_idioma_uni', '1'); }
  const empezar = () => {
    traducirArbol(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') textoNodo(m.target);
        else if (m.type === 'attributes') atributos(m.target);
        else m.addedNodes.forEach(traducirArbol);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  };
  if (document.body) empezar(); else document.addEventListener('DOMContentLoaded', empezar);
  // v2.74.0 números y fechas en formato de EE. UU. (punto decimal), aunque el código pida 'es-EC'
  const loc = (l) => (l == null || /^es/i.test(String(l)) ? 'en-US' : l);
  const N = Number.prototype.toLocaleString; Number.prototype.toLocaleString = function (l, o) { return N.call(this, loc(l), o); };
  for (const k of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) { const o = Date.prototype[k]; Date.prototype[k] = function (l, op) { return o.call(this, loc(l), op); }; }
  for (const k of ['NumberFormat', 'DateTimeFormat', 'RelativeTimeFormat']) {
    const O = Intl[k]; if (!O) continue;
    const F = function (l, op) { return new O(loc(l), op); }; F.prototype = O.prototype; F.supportedLocalesOf = O.supportedLocalesOf; Intl[k] = F;
  }
  // texto dibujado en lienzos (tarjetas para compartir, video con telemetría, gráficas)
  const C2 = typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype;
  if (C2) for (const k of ['fillText', 'strokeText', 'measureText']) { const o = C2[k]; C2[k] = function (txt, ...r) { return o.call(this, typeof txt === 'string' ? t(txt) : txt, ...r); }; }
  // avisos del navegador
  for (const f of ['alert', 'confirm', 'prompt']) {
    const o = window[f]; if (typeof o !== 'function') continue;
    window[f] = function (msg, ...r) { return o.call(window, t(msg), ...r); };
  }
}
iniciar();
