import { fetchProducts } from './supabase.js';

const state = {
  products: [],
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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderGrid() {
  const grid = $('#catalogGrid');
  if (!grid) return;

  if (state.loading) {
    grid.innerHTML = '<p class="catalog-status">Cargando amigurumis… 🧶</p>';
    return;
  }
  if (state.error) {
    grid.innerHTML = `<p class="catalog-status catalog-error">No pudimos cargar el catálogo: ${escapeHtml(state.error)}</p>`;
    return;
  }
  if (!state.products.length) {
    grid.innerHTML = `
      <div class="catalog-status catalog-empty">
        <p>🧶 Aún no hay productos en stock.</p>
        <p class="catalog-empty-hint">
          Si esperabas ver productos, revisa que la tabla <code>products</code> en Supabase
          tenga filas y que las políticas RLS permitan lectura pública.
        </p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.products
    .map((p) => {
      const stock = Number(p.stock ?? 0);
      const disabled = stock <= 0 ? 'disabled' : '';
      const media = p.image_url
        ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
        : `<span class="catalog-card-emoji">${escapeHtml(p.emoji || '🧸')}</span>`;
      const desc = p.desc_text || p.desc || '';
      const ctaLabel = stock > 0 ? 'Añadir al Carrito' : 'Sin stock';
      return `
        <article class="catalog-card">
          <div class="catalog-card-media">${media}</div>
          <div class="catalog-card-body">
            <h3 class="catalog-card-title">${escapeHtml(p.name)}</h3>
            <p class="catalog-card-desc">${escapeHtml(desc)}</p>
            <span class="catalog-card-price">${formatCLP(p.price)}</span>
            <button class="catalog-card-cta" type="button" ${disabled} data-add="${escapeHtml(p.id)}">
              ${ctaLabel}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof window.addToCart === 'function') {
        window.addToCart(btn.dataset.add);
      }
    });
  });
}

async function loadCatalog() {
  const grid = $('#catalogGrid');
  if (!grid) return;

  state.loading = true;
  state.error = null;
  renderGrid();

  try {
    state.products = await fetchProducts();
    if (typeof window.registerProducts === 'function') {
      window.registerProducts(state.products);
    }
  } catch (err) {
    const msg = err?.message || 'Error desconocido';
    state.error = /failed to fetch/i.test(msg)
      ? 'No se pudo conectar con el servidor. Verifica tu conexión o que el sitio se esté sirviendo por HTTP (no file://).'
      : msg;
  } finally {
    state.loading = false;
    renderGrid();
  }
}

/* Compatibilidad: si algún trigger antiguo llama a openCatalog, solo recarga */
export async function openCatalog() {
  await loadCatalog();
}

export function closeCatalog() {
  /* No-op: el catálogo ahora es una vista de página, no un modal */
}

window.openCatalog = openCatalog;
window.closeCatalog = closeCatalog;

function bootstrap() {
  const grid = $('#catalogGrid');
  if (!grid) return;
  // Estado inicial visible mientras llega la respuesta de Supabase
  state.loading = true;
  renderGrid();
  loadCatalog();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
