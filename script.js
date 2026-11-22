/* =========================================================
   Patitas de Lana · Lógica interactiva con Supabase
   ========================================================= */

const WHATSAPP_NUMBER = '56912345678'; // Cambia por el número real de la tienda

/* ---------- Datos de productos ---------- */
let PRODUCTS = [];

/* Productos estáticos (papelería) que no vienen de Supabase.
   Se resuelven por id para poder añadirlos al carrito desde papeleria.html. */
const STATIC_PRODUCTS = {
    'papeleria-cuaderno': {
    id: 'papeleria-cuaderno',
    name: 'Cuaderno artesanal',
    desc: 'Encuadernado a mano con tapas decoradas.',
    price: 8990,
    emoji: '📓',
    image_url: null,
    stock: 10,
  },
  'papeleria-agenda': {
    id: 'papeleria-agenda',
    name: 'Agenda 2026',
    desc: 'Agenda semanal con ilustraciones originales.',
    price: 12990,
    emoji: '📔',
    image_url: null,
    stock: 2,
  },
  'papeleria-tarjetas': {
    id: 'papeleria-tarjetas',
    name: 'Set de tarjetas',
    desc: 'Tarjetas con diseños tejidos y sobres kraft.',
    price: 4990,
    emoji: '✉️',
    image_url: null,
    stock: 0,
  },
  'papeleria-marcapaginas': {
    id: 'papeleria-marcapaginas',
    name: 'Marcapáginas',
    desc: 'Marcapáginas tejidos a crochet, varios colores.',
    price: 2990,
    emoji: '🔖',
    image_url: null,
    stock: 15,
  },
};

/* Productos dinámicos (Supabase) registrados desde js/catalog.js */
const dynamicProducts = new Map();

function registerProducts(list) {
  if (!Array.isArray(list)) return;
  list.forEach((p) => {
    if (p && p.id != null) {
      dynamicProducts.set(String(p.id), {
        id: String(p.id),
        name: p.name,
        desc: p.desc || '',
        price: Number(p.price) || 0,
        emoji: p.emoji || '🧸',
        image_url: p.image_url || null,
      });
    }
  });
}

function findProduct(id) {
  const key = String(id);
  return (
    dynamicProducts.get(key) ||
    STATIC_PRODUCTS[key] ||
    PRODUCTS.find((p) => String(p.id) === key)
  );
}

window.registerProducts = registerProducts;

/* ---------- Utilidades ---------- */
const formatCLP = (value) => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return 'CLP $' + safe.toLocaleString('es-CL', { maximumFractionDigits: 0 });
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* ---------- Estado del carrito ---------- */
const STORAGE_KEY = 'patitas-de-lana-cart';

let cart = loadCart();

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

/* ---------- Carga de productos desde Supabase ----------
   El render del catálogo en stock vive en js/catalog.js (módulo ES).
   Aquí solo registramos los productos para que el carrito pueda
   resolverlos por id cuando se hace clic en "Añadir al Carrito". */
async function fetchProducts() {
  try {
    const { fetchProducts: fetchFromSupabase } = await import('./js/supabase.js');
    const data = await fetchFromSupabase();
    if (!Array.isArray(data)) return;

    PRODUCTS = data.map((p) => ({
      id: p.id,
      name: p.name,
      desc: p.desc_text || p.desc || '',
      price: Number(p.price) || 0,
      emoji: p.emoji || '🧸',
      image_url: p.image_url || null,
      stock: p.stock ?? 0,
    }));

    registerProducts(PRODUCTS);
  } catch (err) {
    console.error('Error al cargar productos de Supabase:', err.message);
  }
}

/* ---------- Carrito ---------- */
function addToCart(id, qty = 1) {
  const product = findProduct(id);
  if (!product) return;

  const addQty = Math.max(1, Math.floor(Number(qty) || 1));
  const key = String(product.id);
  const existing = cart.find((item) => String(item.id) === key);
  const currentQty = existing ? existing.qty : 0;

  // Respeta el stock disponible (undefined = sin limite)
  const maxStock = Number.isFinite(product.stock) ? Number(product.stock) : Infinity;
  if (maxStock <= 0) {
    showToast('\u274C ' + product.name + ' esta agotado');
    return;
  }

  // Cuanto realmente se puede agregar sin superar el stock
  const space = maxStock - currentQty;
  if (space <= 0) {
    showToast('Solo quedan ' + maxStock + ' ' + (maxStock === 1 ? 'unidad' : 'unidades') + ' de ' + product.name);
    return;
  }
  const finalAdd = Math.min(addQty, space);

  if (existing) {
    existing.qty += finalAdd;
  } else {
    cart.push({
      id: key,
      name: product.name,
      price: product.price,
      emoji: product.emoji,
      image_url: product.image_url || null,
      stock: Number.isFinite(product.stock) ? Number(product.stock) : null,
      qty: finalAdd,
    });
  }

  saveCart();
  renderCart();

  if (finalAdd < addQty) {
    showToast('Solo quedan ' + maxStock + ' ' + (maxStock === 1 ? 'unidad' : 'unidades') + ' de ' + product.name);
  } else {
    showToast('\u2705 ' + product.name + ' anadido al carrito');
  }
}

window.addToCart = addToCart;


/* ---------- Personaje "enfado" al quitar un item del carrito ---------- */
const ANGRY_SVG_URL =
  'https://ogkqjyoiadovchobbnik.supabase.co/storage/v1/object/public/Animaciones/Animacion%20enfado/personaje-animado.svg';

// ~6 cm de alto. 1cm = 37.795px aprox -> 6cm = ~227px. El ancho es proporcional.
const ANGRY_HEIGHT_PX = Math.round(6 * 37.795); // solo para calcular posiciones (el alto visual real es 6cm)

let angryTimer = null;
let angryEl = null;

function showAngryCharacter() {
  // Evitar apilar varios: si ya hay uno, lo reemplazamos.
  if (angryEl && angryEl.parentNode) {
    angryEl.parentNode.removeChild(angryEl);
    angryEl = null;
  }
  if (angryTimer) { clearTimeout(angryTimer); angryTimer = null; }

  const img = document.createElement('img');
  img.src = ANGRY_SVG_URL;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.className = 'angry-char';

  img.style.position = 'fixed';
  img.style.height = '6cm';
  img.style.width = 'auto';
  img.style.zIndex = '9999';
  img.style.pointerEvents = 'none';
  img.style.userSelect = 'none';
  img.style.willChange = 'transform, opacity';
  img.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  img.style.opacity = '0';

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 0; // pegado al borde

  // Bordes validos (NO superior): inferior, izquierdo, derecho.
  const edges = ['bottom', 'left', 'right'];
  const edge = edges[Math.floor(Math.random() * edges.length)];

  let tx = '0', ty = '0'; // transform inicial (para animar entrada desde el borde)

  if (edge === 'bottom') {
    // Pegado al borde inferior, posicion horizontal aleatoria.
    const maxLeft = Math.max(0, vw - ANGRY_HEIGHT_PX); // aprox ancho
    const left = Math.random() * maxLeft;
    img.style.left = left + 'px';
    img.style.bottom = margin + 'px';
    img.style.top = 'auto';
    img.style.right = 'auto';
    ty = '40px';
  } else if (edge === 'left') {
    // Pegado al borde izquierdo, posicion vertical aleatoria (evitando tapar el header).
    const minTop = 90;
    const maxTop = Math.max(minTop, vh - ANGRY_HEIGHT_PX);
    const top = minTop + Math.random() * (maxTop - minTop);
    img.style.left = margin + 'px';
    img.style.top = top + 'px';
    img.style.right = 'auto';
    img.style.bottom = 'auto';
    tx = '-40px';
  } else { // right
    const minTop = 90;
    const maxTop = Math.max(minTop, vh - ANGRY_HEIGHT_PX);
    const top = minTop + Math.random() * (maxTop - minTop);
    img.style.right = margin + 'px';
    img.style.top = top + 'px';
    img.style.left = 'auto';
    img.style.bottom = 'auto';
    tx = '40px';
  }

  // Entrada: arranca desplazado hacia dentro del borde y aparece
  img.style.transform = `translate(${tx}, ${ty})`;
  document.body.appendChild(img);
  angryEl = img;

  // Forzar reflow y animar entrada
  void img.offsetWidth;
  img.style.opacity = '1';
  img.style.transform = 'translate(0, 0)';

  // Desvanecer y quitar tras unos segundos
  angryTimer = setTimeout(() => {
    if (angryEl !== img) return;
    img.style.opacity = '0';
    img.style.transform = `translate(${tx}, ${ty})`;
    setTimeout(() => {
      if (img.parentNode) img.parentNode.removeChild(img);
      if (angryEl === img) angryEl = null;
    }, 400);
  }, 5200);
}

function removeFromCart(id) {
  const key = String(id);
  const before = cart.length;
  cart = cart.filter((item) => String(item.id) !== key);
  saveCart();
  renderCart();
  if (cart.length < before && typeof showAngryCharacter === 'function') {
    showAngryCharacter();
  }
}

function changeQty(id, delta) {
  const key = String(id);
  const item = cart.find((i) => String(i.id) === key);
  if (!item) return;

  // Al incrementar, no superar el stock disponible
  if (delta > 0 && Number.isFinite(item.stock) && item.qty >= item.stock) {
    showToast(`Solo quedan ${item.stock} ${item.stock === 1 ? 'unidad' : 'unidades'} de ${item.name}`);
    return;
  }

  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  renderCart();
}

function getTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function renderCart() {
  const itemsEl = $('#cartItems');
  const totalEl = $('#cartTotal');
  const countEl = $('#cartCount');
  const checkoutBtn = $('#checkoutBtn');

  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Tu carrito está vacío 🧶<br>¡Agrega un amigurumi!</p>';
  } else {
    itemsEl.innerHTML = cart.map((item) => `
      <div class="cart-item">
        <div class="cart-item-img">${item.image_url ? `<img src="${item.image_url}" alt="">` : `<span aria-hidden="true">${item.emoji}</span>`}</div>
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <span>${formatCLP(item.price)} c/u</span>
          <div class="qty-controls">
            <button data-action="dec" data-id="${item.id}" aria-label="Quitar uno">−</button>
            <span>${item.qty}</span>
            <button data-action="inc" data-id="${item.id}" aria-label="Agregar uno">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-action="remove" data-id="${item.id}" aria-label="Eliminar">🗑️</button>
      </div>
    `).join('');
  }

  if (totalEl) totalEl.textContent = formatCLP(getTotal());
  if (countEl) countEl.textContent = getCount();
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

/* Delegación de eventos del carrito */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'inc') changeQty(id, 1);
  if (action === 'dec') changeQty(id, -1);
  if (action === 'remove') removeFromCart(id);
});

/* Delegación para botones "Añadir al Carrito" de productos estáticos (papelería) */
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('.btn-add[data-id]');
  if (!addBtn) return;
  e.preventDefault();
  addToCart(addBtn.dataset.id);
});

/* ---------- Drawer del carrito ---------- */
const cartDrawer = $('#cartDrawer');
const overlay = $('#overlay');

function openCart() {
  if (cartDrawer) {
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
  }
  if (overlay) overlay.style.display = '';
}

function closeCart() {
  if (cartDrawer) {
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
  }
  if (overlay) overlay.style.display = 'none';
}

const cartToggle = $('#cartToggle');
const cartClose = $('#cartClose');
if (cartToggle) cartToggle.addEventListener('click', openCart);
if (cartClose) cartClose.addEventListener('click', closeCart);
if (overlay) {
  overlay.addEventListener('click', () => {
    closeCart();
    closePayment();
  });
}

/* ---------- Modal de pago ---------- */
const paymentModal = $('#paymentModal');

function openPayment() {
  if (cart.length === 0) return;
  const amountEl = $('#paymentAmount');
  if (amountEl) amountEl.textContent = formatCLP(getTotal());
  if (paymentModal) {
    paymentModal.removeAttribute('hidden');
    paymentModal.style.display = '';
  }
  if (overlay) overlay.style.display = '';
}

function closePayment() {
  if (paymentModal) {
    paymentModal.style.display = 'none';
    paymentModal.setAttribute('hidden', '');
  }
  if (overlay && (!cartDrawer || !cartDrawer.classList.contains('open'))) {
    overlay.style.display = 'none';
  }
}

const checkoutBtn = $('#checkoutBtn');
const paymentClose = $('#paymentClose');
const confirmPay = $('#confirmPay');

// El boton "Pagar" del carrito lleva a la pagina de checkout completa.
// (El modal de pago antiguo queda como respaldo en paginas sin checkout.html).
if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
  if (cart.length === 0) return;
  window.location.href = 'checkout.html';
});
if (paymentClose) paymentClose.addEventListener('click', closePayment);

if (confirmPay) {
  confirmPay.addEventListener('click', () => {
    const method = $('input[name="payMethod"]:checked').value;
    const total = formatCLP(getTotal());
    showToast(`✅ Pago simulado con ${method} por ${total}`);
    cart = [];
    saveCart();
    renderCart();
    closePayment();
    closeCart();
  });
}

/* ---------- Selector de modo ---------- */
const modeCards = $$('.mode-card');
const modeHint = $('#modeHint');
const sections = $$('[data-mode-section]');

function selectMode(mode) {
  modeCards.forEach((card) => {
    const isSelected = card.dataset.mode === mode;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-checked', String(isSelected));
  });

  sections.forEach((sec) => {
    sec.classList.toggle('active', sec.dataset.modeSection === mode);
  });

  if (modeHint) {
    modeHint.textContent = mode === 'stock'
      ? '🛍️ ¡Genial! Explora el catálogo en stock.'
      : '✨ ¡Perfecto! Cuéntanos tu idea personalizada.';
  }

  // "stock" navega a la vista de catálogo; "custom" navega a personalizados
  if (mode === 'stock') {
    setTimeout(() => {
      window.location.href = 'catalogo.html';
    }, 250);
  } else if (mode === 'custom') {
    setTimeout(() => {
      window.location.href = 'personalizados.html';
    }, 250);
  }
}

modeCards.forEach((card) => {
  card.addEventListener('click', () => selectMode(card.dataset.mode));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectMode(card.dataset.mode);
    }
  });
});

/* ---------- Carga de imágenes de referencia ---------- */
const uploadInput = $('#imagenes');
const uploadBtn = $('#uploadBtn');
const uploadArea = $('#uploadArea');
const uploadPreview = $('#uploadPreview');

let uploadedFiles = [];

function renderUploadPreview() {
  if (!uploadPreview) return;
  uploadPreview.innerHTML = uploadedFiles.map((file, idx) => `
    <div class="upload-thumb">
      <img src="${file.url}" alt="${file.name}" />
      <button type="button" data-remove="${idx}" aria-label="Quitar imagen">✕</button>
    </div>
  `).join('');
}

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
  files.forEach((file) => {
    uploadedFiles.push({
      name: file.name,
      url: URL.createObjectURL(file),
    });
  });
  renderUploadPreview();
}

if (uploadBtn && uploadInput) {
  uploadBtn.addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    uploadInput.value = '';
  });
}

if (uploadArea) {
  ['dragenter', 'dragover'].forEach((evt) => {
    uploadArea.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    uploadArea.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });
  });
  uploadArea.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });
}

if (uploadPreview) {
  uploadPreview.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const idx = Number(btn.dataset.remove);
    const removed = uploadedFiles.splice(idx, 1)[0];
    if (removed?.url) URL.revokeObjectURL(removed.url);
    renderUploadPreview();
  });
}

/* ---------- Formulario personalizado → WhatsApp ---------- */
const customForm = $('#customForm');
if (customForm) {
  customForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const tipo = $('#tipo').value;
    const tamano = $('#tamano').value;
    const colores = $('#colores').value.trim() || 'A definir';
    const nombre = $('#nombre').value.trim();
    const detalles = $('#detalles').value.trim() || 'Sin detalles adicionales';
    const ideaEl = $('#idea');
    const idea = ideaEl ? ideaEl.value.trim() : '';

    if (!nombre) {
      showToast('Por favor, ingresa tu nombre 😊');
      $('#nombre').focus();
      return;
    }

    const imagenesTxt = uploadedFiles.length
      ? uploadedFiles.map((f) => `  - ${f.name}`).join('\n')
      : '  (sin imágenes adjuntas)';

    let mensaje =
      `¡Hola Patitas de Lana! 🧶 Quiero cotizar un amigurumi personalizado:\n\n` +
      `• Tipo: ${tipo}\n` +
      `• Tamaño: ${tamano}\n` +
      `• Colores: ${colores}\n` +
      `• Detalles: ${detalles}\n`;

    if (idea) mensaje += `• Idea: ${idea}\n`;

    mensaje +=
      `• Imágenes de referencia:\n${imagenesTxt}\n\n` +
      `Mi nombre es ${nombre}. ¡Gracias!`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener');
  });
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ---------- Menú hamburguesa ---------- */
const navToggle = $('#navToggle');
const mobileNav = $('#mobileNav');

if (navToggle && mobileNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Abrir menú');
    });
  });
}

/* ---------- Año dinámico ---------- */
const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Decorar tarjetas estáticas de papelería ----------
   Aplica el mismo estándar que el catálogo: etiqueta de stock y overlay
   "AGOTADO" sobre la imagen, y deshabilita el botón si no hay stock. */
function decoratePapeleriaCards() {
  const cards = $$('.product-card');
  cards.forEach((card) => {
    const btn = card.querySelector('.btn-add[data-id]');
    if (!btn) return;
    const product = findProduct(btn.dataset.id);
    if (!product) return;

    const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : null;
    const agotado = stock !== null && stock <= 0;

    // Overlay AGOTADO sobre la imagen
    const img = card.querySelector('.product-img');
    if (img && agotado && !img.querySelector('.catalog-card-soldout')) {
      const overlayEl = document.createElement('div');
      overlayEl.className = 'catalog-card-soldout';
      overlayEl.setAttribute('aria-hidden', 'true');
      overlayEl.innerHTML = '<span>AGOTADO</span>';
      img.appendChild(overlayEl);
      img.classList.add('is-soldout');
    }

    // Etiqueta de stock (antes del botón)
    if (stock !== null && !card.querySelector('.product-stock')) {
      const badge = document.createElement('span');
      badge.className = 'product-stock' + (agotado ? ' out' : (stock <= 3 ? ' low' : ''));
      if (agotado) {
        badge.textContent = 'Agotado';
      } else if (stock <= 3) {
        badge.textContent = `¡Últimas ${stock} ${stock === 1 ? 'unidad' : 'unidades'}!`;
      } else {
        badge.textContent = `Disponible: ${stock}`;
      }
      btn.parentNode.insertBefore(badge, btn);
    }

    // Deshabilitar el botón si está agotado
    if (agotado) {
      btn.disabled = true;
      btn.textContent = 'Sin stock';
    }
  });
}

/* ---------- Init ---------- */
renderCart();
closePayment();
closeCart();
decoratePapeleriaCards();

/* El catálogo en stock (js/catalog.js) ya carga los productos desde Supabase
   y los registra vía window.registerProducts para que el carrito los resuelva.
   No duplicamos la carga aquí para evitar condiciones de carrera. */

/* ---------- Acceso discreto al panel: 5 clicks seguidos en el logo ---------- */
(function setupBrandSecret() {
  const CLICKS_NEEDED = 5;
  const WINDOW_MS = 1500; // tiempo maximo entre el 1er y el 5to click

  let count = 0;
  let lastTs = 0;
  let navTimer = null;

  function getBrand() {
    return document.querySelector('.site-header .brand') || document.querySelector('.brand');
  }

  document.addEventListener('click', (e) => {
    const brand = getBrand();
    if (!brand || !brand.contains(e.target)) return;

    // Siempre interceptamos la navegacion del logo para poder contar los clicks.
    e.preventDefault();

    const now = Date.now();
    if (now - lastTs > WINDOW_MS) count = 0; // reinicia si tardo mucho
    lastTs = now;
    count += 1;

    // Reinicia el temporizador de navegacion normal (un click simple -> inicio)
    if (navTimer) clearTimeout(navTimer);

    if (count >= CLICKS_NEEDED) {
      count = 0;
      if (navTimer) { clearTimeout(navTimer); navTimer = null; }
      // Acceso secreto al panel
      window.location.href = 'admin.html';
      return;
    }

    // Un click simple: navegar a inicio tras breve espera (por si vienen mas clicks)
    navTimer = setTimeout(() => {
      count = 0;
      const href = brand.getAttribute('href');
      if (href) window.location.href = href;
    }, 320);
  }, true);
})();
