import { fetchProducts } from './supabase.js';

const state = {
  products: [],
  selectedId: null,
  loading: false,
  error: null,
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);

function formatCLP(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function ensureModal() {
  let modal = $('#catalogModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'catalogModal';
  modal.className = 'catalog-modal';
  modal.setAttribute('hidden', '');
  modal.innerHTML = `
    <div class="catalog-backdrop" data-close></div>
    <div class="catalog-shell" role="dialog" aria-modal="true" aria-labelledby="catalogTitle">
      <header class="catalog-header">
        <div>
          <p class="catalog-eyebrow">Catálogo en stock</p>
          <h2 id="catalogTitle">Elige tu amigurumi</h2>
        </div>
        <button class="catalog-close" type="button" data-close aria-label="Cerrar">✕</button>
      </header>
      <div class="catalog-body">
        <div class="catalog-grid" id="catalogGrid" role="listbox" aria-label="Productos"></div>
        <aside class="catalog-detail" id="catalogDetail" aria-live="polite"></aside>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeCatalog();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeCatalog();
  });

  return modal;
}

function renderGrid() {
  const grid = $('#catalogGrid');
  if (!grid) return;

  if (state.loading) {
    grid.innerHTML = '<p class="catalog-status">Cargando amigurumis… 🧶</p>';
    return;
  }
  if (state.error) {
    grid.innerHTML = `<p class="catalog-status catalog-error">No pudimos cargar el catálogo: ${state.error}</p>`;
    return;
  }
  if (!state.products.length) {
    grid.innerHTML = '<p class="catalog-status">Aún no hay productos en stock.</p>';
    return;
  }

  grid.innerHTML = state.products
    .map((p) => {
      const isSelected = String(p.id) === String(state.selectedId);
      const selected = isSelected ? 'selected' : '';
      const thumb = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" />`
        : `<span class="catalog-emoji">${p.emoji || '🧸'}</span>`;
      const stock = Number(p.stock ?? 0);
      const stockLabel = stock > 0 ? `${stock} en stock` : 'Agotado';
      return `
        <button class="catalog-tile ${selected}" type="button" data-id="${p.id}" role="option" aria-selected="${isSelected}">
          <div class="catalog-tile-img">${thumb}</div>
          <div class="catalog-tile-info">
            <strong>${p.name}</strong>
            <span>${stockLabel}</span>
          </div>
        </button>
      `;
    })
    .join('');

  grid.querySelectorAll('.catalog-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      state.selectedId = String(tile.dataset.id);
      renderGrid();
      renderDetail();
    });
  });
}

function renderDetail() {
  const detail = $('#catalogDetail');
  if (!detail) return;

  const product = state.products.find((p) => String(p.id) === String(state.selectedId));
  if (!product) {
    detail.innerHTML = `
      <div class="catalog-detail-empty">
        <span>🧶</span>
        <p>Selecciona un amigurumi para ver los detalles.</p>
      </div>
    `;
    return;
  }

  const stock = Number(product.stock ?? 0);
  const disabled = stock <= 0 ? 'disabled' : '';
  const img = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}" />`
    : `<span class="catalog-detail-emoji">${product.emoji || '🧸'}</span>`;

  const desc = product.desc_text || product.desc || '';
  detail.innerHTML = `
    <div class="catalog-detail-img">${img}</div>
    <h3>${product.name}</h3>
    <p class="catalog-detail-desc">${desc}</p>
    <div class="catalog-detail-meta">
      <span class="catalog-price">${formatCLP(product.price)}</span>
      <span class="catalog-stock ${stock > 0 ? '' : 'out'}">${stock > 0 ? `${stock} disponibles` : 'Agotado'}</span>
    </div>
    <button class="catalog-add" type="button" ${disabled} data-add="${product.id}">
      ${stock > 0 ? 'Agregar al carrito 🛒' : 'Sin stock'}
    </button>
  `;

  const addBtn = detail.querySelector('[data-add]');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (typeof window.addToCart === 'function') {
        window.addToCart(product.id);
      }
    });
  }
}

export async function openCatalog() {
  const modal = ensureModal();
  modal.removeAttribute('hidden');
  document.body.classList.add('catalog-open');

  if (!state.products.length) {
    state.loading = true;
    state.error = null;
    renderGrid();
    try {
      state.products = await fetchProducts();
      if (typeof window.registerProducts === 'function') {
        window.registerProducts(state.products);
      }
      if (state.products.length && state.selectedId == null) {
        state.selectedId = String(state.products[0].id);
      }
    } catch (err) {
      state.error = err.message || 'Error desconocido';
    } finally {
      state.loading = false;
    }
  }

  renderGrid();
  renderDetail();
}

export function closeCatalog() {
  const modal = $('#catalogModal');
  if (modal) modal.setAttribute('hidden', '');
  document.body.classList.remove('catalog-open');
}

export function bindCatalogTriggers() {
  document.querySelectorAll('[data-open-catalog]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openCatalog();
    });
  });
}

window.openCatalog = openCatalog;
window.closeCatalog = closeCatalog;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindCatalogTriggers);
} else {
  bindCatalogTriggers();
}
