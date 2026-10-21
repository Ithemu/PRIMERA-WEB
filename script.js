/* =========================================================
   Patitas de Lana · Lógica interactiva
   ========================================================= */

const WHATSAPP_NUMBER = '56912345678'; // Cambia por el número real de la tienda

/* ---------- Datos de productos ---------- */
const PRODUCTS = [
  { id: 'p1', name: 'Osito Miel', desc: 'Osito tejido de 15 cm en tonos crema.', price: 12990, emoji: '🧸' },
  { id: 'p2', name: 'Conejita Rosa', desc: 'Conejita con orejas largas y moño pastel.', price: 14990, emoji: '🐰' },
  { id: 'p3', name: 'Gatito Nube', desc: 'Gatito blanco de 12 cm, súper suave.', price: 11990, emoji: '🐱' },
  { id: 'p4', name: 'Panda Bambú', desc: 'Panda de 18 cm con hilo de algodón.', price: 16990, emoji: '🐼' },
  { id: 'p5', name: 'Zorrito Otoño', desc: 'Zorrito naranja de 15 cm, edición limitada.', price: 13990, emoji: '🦊' },
  { id: 'p6', name: 'Llavero Nubecita', desc: 'Mini llavero de 8 cm, ideal para regalo.', price: 5990, emoji: '☁️' },
  { id: 'p7', name: 'Sapo Saltarín', desc: 'Sapito verde de 10 cm con ojitos grandes.', price: 9990, emoji: '🐸' },
  { id: 'p8', name: 'Unicornio Pastel', desc: 'Unicornio de 20 cm con melena arcoíris.', price: 18990, emoji: '🦄' }
];

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
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;

  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 });
  }

  saveCart();
  renderCart();
  showToast(`✨ ${product.name} añadido al carrito`);
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
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

  totalEl.textContent = formatCLP(getTotal());
  countEl.textContent = getCount();
  checkoutBtn.disabled = cart.length === 0;
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
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  overlay.hidden = false;
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
}

$('#cartToggle').addEventListener('click', openCart);
$('#cartClose').addEventListener('click', closeCart);
overlay.addEventListener('click', () => {
  closeCart();
  closePayment();
});

/* ---------- Modal de pago ---------- */
const paymentModal = $('#paymentModal');

function openPayment() {
  if (cart.length === 0) return;
  $('#paymentAmount').textContent = formatCLP(getTotal());
  paymentModal.hidden = false;
  overlay.hidden = false;
}

function closePayment() {
  paymentModal.hidden = true;
  if (!cartDrawer.classList.contains('open')) overlay.hidden = true;
}

$('#checkoutBtn').addEventListener('click', openPayment);
$('#paymentClose').addEventListener('click', closePayment);
$('#paymentClose').addEventListener('click', () => {
  paymentModal.hidden = true;
});

$('#confirmPay').addEventListener('click', () => {
  const method = $('input[name="payMethod"]:checked').value;
  const total = formatCLP(getTotal());
  showToast(`✅ Pago simulado con ${method} por ${total}`);
  cart = [];
  saveCart();
  renderCart();
  closePayment();
  closeCart();
});

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

  modeHint.textContent = mode === 'stock'
    ? '🛍️ ¡Genial! Explora el catálogo en stock.'
    : '✨ ¡Perfecto! Cuéntanos tu idea personalizada.';

  // Scroll suave a la sección correspondiente
  const target = mode === 'stock' ? '#catalogo' : '#personalizados';
  setTimeout(() => {
    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 250);
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
$('#customForm').addEventListener('submit', (e) => {
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

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ---------- Año dinámico ---------- */
$('#year').textContent = new Date().getFullYear();

/* ---------- Init ---------- */
renderProducts();
renderCart();
