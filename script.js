/* =========================================================
   Patitas de Lana · Lógica interactiva con Supabase
   ========================================================= */

const WHATSAPP_NUMBER = '56912345678'; // Cambia por el número real de la tienda

/* ---------- Datos de productos ---------- */
let PRODUCTS = [];

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
  return dynamicProducts.get(key) || PRODUCTS.find((p) => String(p.id) === key);
}

window.registerProducts = registerProducts;

/* ---------- Utilidades ---------- */
const formatCLP = (value) =>
  'CLP $' + value.toLocaleString('es-CL', { maximumFractionDigits: 0 });

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

/* ---------- Carga de productos desde Supabase ---------- */
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
    renderProducts();
  } catch (err) {
    console.error('Error al cargar productos de Supabase:', err.message);
  }
}

/* ---------- Render de productos ---------- */
function renderProducts() {
  const grid = $('#productGrid');
  if (!grid) return;

  grid.innerHTML = PRODUCTS.map((p) => `
    <article class="product-card">
      <div class="product-img" aria-hidden="true">${p.emoji}</div>
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <span class="product-price">${formatCLP(p.price)}</span>
        <button class="btn-add" data-id="${p.id}">Añadir al Carrito</button>
      </div>
    </article>
  `).join('');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    addToCart(btn.dataset.id);
  });
}

/* ---------- Carrito ---------- */
function addToCart(id) {
  const product = findProduct(id);
  if (!product) return;

  const key = String(product.id);
  const existing = cart.find((item) => String(item.id) === key);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: key,
      name: product.name,
      price: product.price,
      emoji: product.emoji,
      image_url: product.image_url || null,
      qty: 1,
    });
  }

  saveCart();
  renderCart();
  showToast(`✨ ${product.name} añadido al carrito`);
}

window.addToCart = addToCart;

function removeFromCart(id) {
  const key = String(id);
  cart = cart.filter((item) => String(item.id) !== key);
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const key = String(id);
  const item = cart.find((i) => String(i.id) === key);
  if (!item) return;
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
        <div class="cart-item-img" aria-hidden="true">${item.emoji}</div>
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

if (checkoutBtn) checkoutBtn.addEventListener('click', openPayment);
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

  // "stock" abre el modal de catálogo (js/catalog.js); "custom" navega a personalizados
  if (mode === 'stock') {
    if (typeof window.openCatalog === 'function') {
      window.openCatalog();
    } else {
      // Fallback: si el módulo aún no cargó, navega a la página del catálogo
      setTimeout(() => {
        window.location.href = 'catalogo.html';
      }, 250);
    }
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

    if (!nombre) {
      showToast('Por favor, ingresa tu nombre 😊');
      $('#nombre').focus();
      return;
    }

    const mensaje =
      `¡Hola Patitas de Lana! 🧶 Quiero cotizar un amigurumi personalizado:\n\n` +
      `• Tipo: ${tipo}\n` +
      `• Tamaño: ${tamano}\n` +
      `• Colores: ${colores}\n` +
      `• Detalles: ${detalles}\n\n` +
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

/* ---------- Año dinámico ---------- */
const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Init ---------- */
renderProducts();
renderCart();
closePayment();
closeCart();

/* Si estamos en catalogo.html, carga productos reales desde Supabase */
if ($('#productGrid')) {
  fetchProducts();
}

/* Asegura que la página siempre inicie en "Inicio" */
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname);
}
