import { supabase } from './supabaseClient.js'; // Ajusta la ruta a tu cliente de Supabase si varía

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
    const { data: productos, error } = await supabase
      .from('productos') // Asegúrate de que este es el nombre de tu tabla
      .select('*');

    if (error) {
      console.error('Error cargando productos de Supabase:', error);
      catalogGrid.innerHTML = '<p class="catalog-error">Ocurrió un error al cargar el catálogo.</p>';
      return;
    }

    console.log('[catalog] productos recibidos de Supabase:', productos);

    if (!productos || productos.length === 0) {
      catalogGrid.innerHTML = '<p class="catalog-empty">No hay amigurumis disponibles en este momento.</p>';
      return;
    }

    // Renderizado de Product Cards (usando las llaves exactas: name, desc_text, price, emoji)
    catalogGrid.innerHTML = productos.map(prod => {
      const precioFormateado = prod.price 
        ? `CLP $${Number(prod.price).toLocaleString('es-CL')}` 
        : 'Consultar precio';

      const icono = prod.emoji || '🧸';
      const descripcion = prod.desc_text || 'Pieza única hecha a mano con amor.';

      return `
        <article class="product-card">
          <div class="product-card-media">
            <span class="product-emoji">${icono}</span>
          </div>
          <div class="product-card-body">
            <h3 class="product-title">${prod.name}</h3>
            <p class="product-desc">${descripcion}</p>
            <div class="product-price">${precioFormateado}</div>
            <button class="btn-add-cart" data-id="${prod.id}" data-name="${prod.name}" data-price="${prod.price || 0}">
              Añadir al Carrito
            </button>
          </div>
        </article>
      `;
    }).join('');

  } catch (err) {
    console.error('Error inesperado:', err);
    catalogGrid.innerHTML = '<p class="catalog-error">Error al conectar con el servidor.</p>';
  }
});