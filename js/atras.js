// Botón "Atrás" en las ventanas emergentes y soporte del botón/gesto Atrás de Android.
// - Agrega un botón ‹ en la esquina superior izquierda de cada ventana (.modal con .modal-caja o similar).
// - Cada ventana abierta deja una entrada en el historial del navegador: el gesto Atrás cierra la ventana
//   de arriba en lugar de salir de la app.
// Para cerrar se usa el propio botón de cerrar de cada ventana (así corre su lógica de limpieza).
const CERRAR = '[id$="-cerrar"], .tj-x, #corr-cancelar, #marca-listo';
const SIN_BOTON = new Set(['en-hoja', 'co-hoja', 'nu-scan', 'tarjetas']); // menús chicos, cámara y tarjetas (ya tiene ✕)

const abiertas = [];      // ids en orden de apertura
let porAtras = null;      // id que se está cerrando por el gesto Atrás
let ignorar = 0;          // popstate que nosotros mismos provocamos con history.back()
let pendientes = [];      // aperturas que esperan a que termine un history.back()

const visible = (el) => el.style.display !== 'none';

export function cerrar(el) {
  const b = el.querySelector(CERRAR);
  if (b) b.click();
  else el.dispatchEvent(new MouseEvent('click', { bubbles: true })); // los menús se cierran al tocar el fondo
  if (visible(el)) el.style.display = 'none';
}

function empujar(id) {
  try { history.pushState({ afModal: id }, ''); } catch (e) {}
}

function alAbrir(id) {
  if (abiertas.includes(id)) return;
  abiertas.push(id);
  if (ignorar > 0) pendientes.push(id); else empujar(id);
}

function alCerrar(id) {
  const i = abiertas.indexOf(id);
  if (i < 0) return;
  abiertas.splice(i, 1);
  if (porAtras === id) { porAtras = null; return; }       // ya se consumió la entrada del historial
  const p = pendientes.indexOf(id);
  if (p >= 0) { pendientes.splice(p, 1); return; }         // nunca llegó a tener entrada
  ignorar++;
  try { history.back(); } catch (e) { ignorar--; }
}

function botonAtras(modal) {
  const caja = modal.querySelector('.modal-caja');
  if (!caja || caja.querySelector('.atras')) return;
  const boton = document.createElement('button');
  boton.type = 'button'; boton.className = 'atras'; boton.setAttribute('aria-label', 'Atrás'); boton.textContent = '‹';
  boton.onclick = () => cerrar(modal);
  // Si la ventana ya tiene una cabecera (título o buscador), el botón va al inicio de esa fila; si no, en una fila propia.
  const cab = caja.querySelector(':scope > .en-sec-cab, :scope > .en-sel-cab');
  if (cab) { cab.prepend(boton); cab.classList.add('con-atras'); return; }
  const fila = document.createElement('div');
  fila.className = 'atras-fila';
  fila.append(boton);
  caja.prepend(fila);
}

export function iniciar() {
  const modales = [...document.querySelectorAll('.modal[id]')];
  for (const m of modales) {
    if (!SIN_BOTON.has(m.id)) botonAtras(m);
    new MutationObserver(() => (visible(m) ? alAbrir(m.id) : alCerrar(m.id))).observe(m, { attributes: true, attributeFilter: ['style'] });
    if (visible(m)) alAbrir(m.id);
  }
  addEventListener('popstate', () => {
    if (ignorar > 0) {
      ignorar--;
      if (!ignorar) { const p = pendientes; pendientes = []; p.forEach(empujar); }
      return;
    }
    const id = abiertas[abiertas.length - 1];
    if (!id) return;
    porAtras = id;
    cerrar(document.getElementById(id));
  });
}
