/* =========================================================
   Personaje animado de la creadora
   Muestra el SVG (Supabase Storage) emergiendo en diagonal
   desde la esquina inferior derecha.
   ========================================================= */

const CREADORA_SVG_URL =
  'https://ogkqjyoiadovchobbnik.supabase.co/storage/v1/object/public/Animaciones/Animacion%20gracias%20por%20tu%20compra/personaje-animado.svg';

const CREADORA_VISIBLE_MS = 6500; // tiempo visible antes de ocultarse
let creadoraEl = null;
let creadoraHideTimer = null;

/**
 * Crea (una sola vez) el contenedor del personaje y lo monta en <body>.
 * Se mantiene oculto por CSS hasta añadir la clase "show".
 */
function ensureCreadora() {
  if (creadoraEl) return creadoraEl;

  creadoraEl = document.createElement('div');
  creadoraEl.className = 'creadora-anim';
  creadoraEl.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.src = CREADORA_SVG_URL;
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'eager';
  creadoraEl.appendChild(img);

  document.body.appendChild(creadoraEl);
  return creadoraEl;
}

/**
 * Muestra el personaje emergiendo en diagonal desde abajo-derecha.
 * Vuelve a montar el <img> para reiniciar su animación interna.
 */
export function mostrarGraciasPorCompra() {
  const el = ensureCreadora();

  // Reinicia la animación interna del SVG (clonar el nodo la reinicia)
  const oldImg = el.querySelector('img');
  if (oldImg) {
    const fresh = oldImg.cloneNode(true);
    oldImg.replaceWith(fresh);
  }

  clearTimeout(creadoraHideTimer);

  el.classList.remove('hide');
  // Forzar reflow para que la transición de entrada se dispare
  void el.offsetWidth;
  el.classList.add('show');

  creadoraHideTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
  }, CREADORA_VISIBLE_MS);
}

/**
 * Permite ocultarlo manualmente (por si se necesita desde otro flujo).
 */
export function ocultarGraciasPorCompra() {
  if (!creadoraEl) return;
  clearTimeout(creadoraHideTimer);
  creadoraEl.classList.remove('show');
  creadoraEl.classList.add('hide');
}

// Exponer global para poder llamarlo desde script.js u otras páginas
window.mostrarGraciasPorCompra = mostrarGraciasPorCompra;
window.ocultarGraciasPorCompra = ocultarGraciasPorCompra;

/* ---------- (MODO TEST) Disparador: click en "Inicio" ----------
   Al hacer click en el enlace "Inicio" (header o menú móvil) se muestra
   el personaje. Si ya estamos en index.html, evitamos recargar para poder
   ver la animación aquí mismo. Cuando pasemos a "al procesar compra",
   simplemente llamamos a mostrarGraciasPorCompra() desde el checkout y
   quitamos este bloque. */
function esEnlaceInicio(a) {
  if (!a) return false;
  const href = a.getAttribute('href') || '';
  const texto = (a.textContent || '').trim().toLowerCase();
  return href === 'index.html' && texto === 'inicio';
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!esEnlaceInicio(a)) return;

  mostrarGraciasPorCompra();

  // Si ya estamos en la página de inicio, no recargar: solo mostrar animación.
  const enInicio = /(^|\/)index\.html?$/.test(location.pathname) || location.pathname === '/' || location.pathname.endsWith('/');
  if (enInicio) {
    e.preventDefault();
    // Subir al inicio de la página (por si estaba scrolleado)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // Si NO estamos en inicio, seguimos la navegación normal; la animación
  // se verá brevemente antes de cambiar de página.
});