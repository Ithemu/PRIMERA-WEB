import { fetchProducts } from './supabase.js';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
  const catalogGrid = document.getElementById('catalogGrid');
  const yearSpan = document.getElementById('year');

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  if (!catalogGrid) return;

  catalogGrid.innerHTML = '<p class="catalog-loading">Cargando catálogo en stock... 🧶</p>';

  try {
    const productos = await fetchProducts();
    console.log('[catalog] productos recibidos de Supabase:', productos);

    if (!Array.isArray(productos) || productos.length === 0) {
      catalogGrid.innerHTML = '<p class="catalog-empty">No hay amigurumis disponibles en este momento.</p>';
      return;
    }

    if (typeof window.registerProducts === 'function') {
      window.registerProducts(productos);
    }

        catalogGrid.innerHTML = productos.map((prod) => {
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

      // Overlay "AGOTADO" sobre la imagen cuando no hay stock
      const overlay = agotado
        ? '<div class="catalog-card-soldout" aria-hidden="true"><span>AGOTADO</span></div>'
        : '';

      const media = `<div class="catalog-card-media${agotado ? ' is-soldout' : ''}">${mediaContent}${overlay}</div>`;

      // Etiqueta de stock en el cuerpo de la tarjeta
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
        <article class="catalog-card${agotado ? ' is-soldout' : ''}">
          ${media}
          <div class="catalog-card-body">
            <h3 class="catalog-card-title">${safeName}</h3>
            <p class="catalog-card-desc">${safeDesc}</p>
            <span class="catalog-card-price">${escapeHtml(precioFormateado)}</span>
            ${stockBadge}
            <button class="catalog-card-cta" type="button" ${disabled} data-add="${safeId}">
              ${ctaLabel}
            </button>
          </div>
        </article>
      `;
    }).join('');

    catalogGrid.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof window.addToCart === 'function') {
          window.addToCart(btn.dataset.add);
        }
      });
    });

  } catch (err) {
    console.error('Error inesperado:', err);
    catalogGrid.innerHTML = '<p class="catalog-error">Error al conectar con el servidor.</p>';
  }
});