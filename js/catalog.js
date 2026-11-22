import { fetchProducts, fetchProductsByCategory, getConfig } from './supabase.js';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCard(prod) {
  const stock = Number(prod.stock ?? 0);
  const agotado = stock <= 0;
  const disabled = agotado ? 'disabled' : '';
  const precioNum = Number(prod.price);
  const precioFormateado = Number.isFinite(precioNum) && precioNum > 0
    ? `CLP $${precioNum.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
    : 'Consultar precio';

  const imageUrl = prod.image_url ? String(prod.image_url).trim() : '';
  const safeName = escapeHtml(prod.name || 'Sin nombre');
  const safeDesc = escapeHtml(prod.desc_text || 'Pieza única hecha a mano con amor.');
  const safeEmoji = escapeHtml(prod.emoji || '🧸');
  const safeId = escapeHtml(prod.id ?? '');

  const mediaContent = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${safeName}" loading="lazy" />`
    : `<span class="catalog-card-emoji">${safeEmoji}</span>`;

  const overlay = agotado
    ? '<div class="catalog-card-soldout" aria-hidden="true"><span>AGOTADO</span></div>'
    : '';
  const media = `<div class="catalog-card-media${agotado ? ' is-soldout' : ''}">${mediaContent}${overlay}</div>`;

  let stockBadge;
  if (agotado) {
    stockBadge = '<span class="catalog-card-stock out">Agotado</span>';
  } else if (stock <= 3) {
    stockBadge = `<span class="catalog-card-stock low">¡Últimas ${stock} ${stock === 1 ? 'unidad' : 'unidades'}!</span>`;
  } else {
    stockBadge = `<span class="catalog-card-stock">Disponible: ${stock}</span>`;
  }

  const ctaLabel = agotado ? 'Sin stock' : 'Añadir al Carrito';

  return `
    <article class="catalog-card${agotado ? ' is-soldout' : ''}" data-stock="${stock}">
      ${media}
      <div class="catalog-card-body">
        <h3 class="catalog-card-title">${safeName}</h3>
        <p class="catalog-card-desc">${safeDesc}</p>
        <span class="catalog-card-price">${escapeHtml(precioFormateado)}</span>
        ${stockBadge}
        <div class="catalog-card-buy">
          <div class="card-qty" data-qty-box="${safeId}">
            <button type="button" class="card-qty-btn" data-qdec="${safeId}" aria-label="Quitar uno" ${disabled}>-</button>
            <span class="card-qty-num" data-qnum="${safeId}">1</span>
            <button type="button" class="card-qty-btn" data-qinc="${safeId}" aria-label="Agregar uno" ${disabled}>+</button>
          </div>
          <button class="catalog-card-cta" type="button" ${disabled} data-add="${safeId}">
            ${ctaLabel}
          </button>
        </div>
      </div>
    </article>
  `;
}

function wireGrid(catalogGrid) {
  catalogGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.catalog-card');
    if (!card) return;
    const numEl = card.querySelector('.card-qty-num');
    if (!numEl) return;

    const incBtn = e.target.closest('[data-qinc]');
    const decBtn = e.target.closest('[data-qdec]');
    const addBtn = e.target.closest('[data-add]');

    if (incBtn) {
      const maxStock = Number(card.dataset.stock ?? Infinity);
      let v = Number(numEl.textContent || 1) + 1;
      if (Number.isFinite(maxStock) && maxStock > 0) v = Math.min(v, maxStock);
      numEl.textContent = v;
      return;
    }
    if (decBtn) {
      let v = Number(numEl.textContent || 1) - 1;
      if (v < 1) v = 1;
      numEl.textContent = v;
      return;
    }
    if (addBtn) {
      const id = addBtn.dataset.add;
      const qty = Math.max(1, Number(numEl.textContent || 1));
      if (typeof window.addToCart === 'function') {
        window.addToCart(id, qty);
      }
      numEl.textContent = '1';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const catalogGrid = document.getElementById('catalogGrid');
  const yearSpan = document.getElementById('year');

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  if (!catalogGrid) return;

  // Parametrizacion: la categoria se lee del propio contenedor.
  // Sin data-category => muestra todos (catalogo en stock original).
  const category = catalogGrid.dataset.category || '';
  const emptyMsg = catalogGrid.dataset.empty || 'No hay amigurumis disponibles en este momento.';

  catalogGrid.innerHTML = '<p class="catalog-loading">Cargando productos... 🧶</p>';

  try {
    let productos;
    if (category === 'especial') {
      let cfg = null;
      try { cfg = await getConfig(); } catch (_) {}
      if (cfg) {
        const titleEl = document.getElementById('especialTitle');
        const heroEl = document.getElementById('especialHero');
        const name = (cfg.especial_nombre || 'Especial').trim();
        if (titleEl) titleEl.textContent = name;
        if (heroEl) heroEl.textContent = name;
        document.title = name + ' · Patitas de Lana';
        if (!cfg.especial_activo) {
          catalogGrid.innerHTML = '<p class="catalog-empty">Esta sección no está disponible por el momento.</p>';
          return;
        }
      }
      productos = await fetchProductsByCategory('especial');
    } else if (category) {
      productos = await fetchProductsByCategory(category);
    } else {
      productos = await fetchProducts();
    }

    console.log('[catalog] productos recibidos:', productos);

    if (!Array.isArray(productos) || productos.length === 0) {
      catalogGrid.innerHTML = `<p class="catalog-empty">${emptyMsg}</p>`;
      return;
    }

    if (typeof window.registerProducts === 'function') {
      window.registerProducts(productos);
    }

    catalogGrid.innerHTML = productos.map(renderCard).join('');
    wireGrid(catalogGrid);

  } catch (err) {
    console.error('Error inesperado:', err);
    catalogGrid.innerHTML = '<p class="catalog-error">Error al conectar con el servidor.</p>';
  }
});
