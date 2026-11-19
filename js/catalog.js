import { fetchProducts } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const catalogGrid = document.getElementById('catalogGrid');
  const yearSpan = document.getElementById('year');

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  if (!catalogGrid) return;

  // Estado de carga inicial
  catalogGrid.innerHTML = '<p class="catalog-loading">Cargando catálogo en stock... 🧶</p>';

  try {
    const productos = await fetchProducts();
    console.log('[catalog] productos recibidos de Supabase:', productos);

    if (!Array.isArray(productos) || productos.length === 0) {
      catalogGrid.innerHTML = '<p class="catalog-empty">No hay amigurumis disponibles en este momento.</p>';
      return;
    }

    // Registra los productos para que el carrito (script.js) los resuelva por id
    if (typeof window.registerProducts === 'function') {
      window.registerProducts(productos);
    }

    // Renderizado de Product Cards (usando las llaves exactas: name, desc_text, price, emoji, stock)
    catalogGrid.innerHTML = productos.map((prod) => {
      const stock = Number(prod.stock ?? 0);
      const disabled = stock <= 0 ? 'disabled' : '';
      const precioFormateado = prod.price
        ? `CLP $${Number(prod.price).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
        : 'Consultar precio';

      const imageUrl = prod.image_url ? String(prod.image_url).trim() : '';
      const media = imageUrl
        ? `<img src="${imageUrl}" alt="${prod.name || 'Producto'}" loading="lazy" />`
        : `<span class="catalog-card-emoji">${prod.emoji || '🧸'}</span>`;

      const descripcion = prod.desc_text || 'Pieza única hecha a mano con amor.';
      const ctaLabel = stock > 0 ? 'Añadir al Carrito' : 'Sin stock';

      return `
        <article class="catalog-card">
          <div class="catalog-card-media">${media}</div>
          <div class="catalog-card-body">
            <h3 class="catalog-card-title">${prod.name || 'Sin nombre'}</h3>
            <p class="catalog-card-desc">${descripcion}</p>
            <span class="catalog-card-price">${precioFormateado}</span>
            <button class="catalog-card-cta" type="button" ${disabled} data-add="${prod.id}">
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
