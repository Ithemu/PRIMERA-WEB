/* =========================================================
   Patitas de Lana · Panel de administración
   ========================================================= */

import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from './js/supabase.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);

const state = {
  products: [],
  editingId: null,
};

/* ---------- Utilidades ---------- */
function formatCLP(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return 'CLP $' + safe.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function showFormMsg(text, type = 'ok') {
  const el = $('#formMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'admin-form-msg ' + type;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3500);
}

/* ---------- Vista previa en vivo ---------- */
function updatePreview() {
  const form = $('#productForm');
  if (!form) return;

  const name = form.name.value.trim() || 'Nombre del producto';
  const desc = form.desc.value.trim() || 'Descripción del producto.';
  const price = Number(form.price.value) || 0;
  const stock = Number(form.stock.value) || 0;
  const emoji = form.emoji.value.trim() || '🧸';
  const imageUrl = form.image_url.value.trim();

  $('#previewName').textContent = name;
  $('#previewDesc').textContent = desc;
  $('#previewPrice').textContent = formatCLP(price);

  const stockEl = $('#previewStock');
  if (stock > 0) {
    stockEl.textContent = `${stock} en stock`;
    stockEl.classList.remove('out');
  } else {
    stockEl.textContent = 'Agotado';
    stockEl.classList.add('out');
  }

  const imgEl = $('#previewImg');
  if (imageUrl) {
    imgEl.innerHTML = `<img src="${imageUrl}" alt="${name}" />`;
  } else {
    imgEl.textContent = emoji;
  }
}

/* ---------- Tabla ---------- */
function renderTable() {
  const tbody = $('#productsTableBody');
  if (!tbody) return;

  if (!state.products.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Sin productos aún.</td></tr>';
    return;
  }

  tbody.innerHTML = state.products
    .map(
      (p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name ?? ''}</td>
        <td>${formatCLP(p.price)}</td>
        <td>${p.stock ?? 0}</td>
        <td class="admin-actions">
          <button class="admin-btn small" data-edit="${p.id}" type="button">Editar</button>
          <button class="admin-btn small danger" data-del="${p.id}" type="button">Eliminar</button>
        </td>
      </tr>
    `
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.edit;
      const product = state.products.find((p) => String(p.id) === String(id));
      if (product) fillForm(product);
    });
  });

  tbody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.del;
      if (!confirm('¿Eliminar este producto?')) return;
      try {
        await deleteProduct(id);
        await loadProducts();
        renderTable();
        showToast('🗑️ Producto eliminado');
      } catch (err) {
        alert('Error al eliminar: ' + err.message);
      }
    });
  });
}

/* ---------- Formulario ---------- */
function fillForm(product) {
  const form = $('#productForm');
  if (!form) return;

  state.editingId = product.id;
  form.id.value = product.id ?? '';
  form.id.readOnly = true;
  form.name.value = product.name ?? '';
  form.desc.value = product.desc_text ?? product.desc ?? '';
  form.price.value = product.price ?? 0;
  form.stock.value = product.stock ?? 0;
  form.emoji.value = product.emoji ?? '🧸';
  form.image_url.value = product.image_url ?? '';

  $('#formTitle').textContent = 'Editar producto';
  $('#saveBtn').textContent = 'Actualizar producto';
  $('#cancelBtn').hidden = false;

  updatePreview();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  const form = $('#productForm');
  if (!form) return;

  state.editingId = null;
  form.reset();
  form.id.readOnly = false;
  form.stock.value = 0;
  form.emoji.value = '🧸';

  $('#formTitle').textContent = 'Nuevo producto';
  $('#saveBtn').textContent = 'Guardar producto';
  $('#cancelBtn').hidden = true;

  updatePreview();
}

async function loadProducts() {
  state.products = await fetchProducts();
}

/* ---------- Init ---------- */
async function init() {
  const form = $('#productForm');
  if (!form) return;

  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  $('#cancelBtn').addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const price = Number(form.price.value);
    if (!name) {
      showFormMsg('El nombre es obligatorio.', 'err');
      form.name.focus();
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showFormMsg('El precio debe ser un número válido.', 'err');
      form.price.focus();
      return;
    }

    const payload = {
      name,
      desc_text: form.desc.value.trim(),
      price,
      stock: Number(form.stock.value) || 0,
      emoji: form.emoji.value.trim() || '🧸',
      image_url: form.image_url.value.trim() || null,
    };

    try {
      if (state.editingId != null) {
        await updateProduct(state.editingId, payload);
        showFormMsg('✅ Producto actualizado.', 'ok');
        showToast('✅ Producto actualizado');
      } else {
        const manualId = form.id.value.trim();
        if (manualId) payload.id = manualId;
        await createProduct(payload);
        showFormMsg('✅ Producto creado.', 'ok');
        showToast('✅ Producto creado');
      }
      await loadProducts();
      renderTable();
      resetForm();
    } catch (err) {
      showFormMsg('Error: ' + (err.message || 'desconocido'), 'err');
    }
  });

  updatePreview();

  try {
    await loadProducts();
    renderTable();
  } catch (err) {
    const tbody = $('#productsTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Error al cargar: ${err.message}</td></tr>`;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
