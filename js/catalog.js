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

  try {
    grid.innerHTML = state.products
      .map((p) => {
        const stock = Number(p.stock ?? 0);
        const disabled = stock <= 0 ? 'disabled' : '';
        const imageUrl = p.image_url ? String(p.image_url).trim() : '';
        const media = imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
          : `<span class="catalog-card-emoji">${escapeHtml(p.emoji || '🧸')}</span>`;
        const desc = p.desc_text || p.desc || '';
        const ctaLabel = stock > 0 ? 'Añadir al Carrito' : 'Sin stock';
        return `
          <article class="catalog-card">
            <div class="catalog-card-media">${media}</div>
            <div class="catalog-card-body">
              <h3 class="catalog-card-title">${escapeHtml(p.name || 'Sin nombre')}</h3>
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
  } catch (err) {
    console.error('[catalog] error al renderizar tarjetas:', err);
    grid.innerHTML = `<p class="catalog-status catalog-error">Error al renderizar productos: ${escapeHtml(err?.message || 'desconocido')}</p>`;
  }
}

async function loadCatalog() {
  const grid = $('#catalogGrid');
  if (!grid) return;

  state.loading = true;
  state.error = null;
  renderGrid();

  try {
    const data = await fetchProducts();
    console.log('[catalog] productos recibidos de Supabase:', data);
    if (!Array.isArray(data)) {
      state.error = 'La consulta a Supabase no devolvió una lista válida. Revisa la tabla "productos" y las políticas RLS.';
      state.products = [];
    } else {
      state.products = data.map((p) => ({
        id: p.id,
        name: p.name ?? '',
        desc_text: p.desc_text ?? p.desc ?? '',
        price: Number(p.price) || 0,
        stock: p.stock == null ? 0 : Number(p.stock),
        emoji: p.emoji || '🧸',
        image_url: p.image_url || null,
      }));
      if (typeof window.registerProducts === 'function') {
        window.registerProducts(state.products);
      }
    }
  } catch (err) {
    console.error('[catalog] error al cargar productos:', err);
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
