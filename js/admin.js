import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  signInAdmin,
  signOutAdmin,
  getSession,
} from './supabase.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);

const state = {
  products: [],
  editingId: null,
  session: null,
};

function ensureAdminModal() {
  let modal = $('#adminModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'adminModal';
  modal.className = 'admin-modal';
  modal.setAttribute('hidden', '');
  modal.innerHTML = `
    <div class="admin-backdrop" data-close></div>
    <div class="admin-shell" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
      <header class="admin-header">
        <h2 id="adminTitle">Panel de administración</h2>
        <button class="admin-close" type="button" data-close aria-label="Cerrar">✕</button>
      </header>
      <div class="admin-body" id="adminBody"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeAdmin();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeAdmin();
  });

  return modal;
}

function renderLogin() {
  const body = $('#adminBody');
  body.innerHTML = `
    <form class="admin-login" id="adminLoginForm">
      <p class="admin-hint">Ingresa con tu cuenta de administrador.</p>
      <label>Email
        <input type="email" name="email" required autocomplete="username" />
      </label>
      <label>Contraseña
        <input type="password" name="password" required autocomplete="current-password" />
      </label>
      <button type="submit" class="admin-btn primary">Entrar</button>
      <p class="admin-error" id="adminError" hidden></p>
    </form>
  `;

  $('#adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    const errEl = $('#adminError');
    errEl.hidden = true;
    try {
      const { session } = await signInAdmin(email, password);
      state.session = session;
      await loadProducts();
      renderPanel();
    } catch (err) {
      errEl.textContent = err.message || 'No se pudo iniciar sesión';
      errEl.hidden = false;
    }
  });
}

async function loadProducts() {
  state.products = await fetchProducts();
}

function renderPanel() {
  const body = $('#adminBody');
  body.innerHTML = `
    <div class="admin-toolbar">
      <button class="admin-btn primary" id="adminNewBtn" type="button">+ Nuevo producto</button>
      <button class="admin-btn ghost" id="adminLogoutBtn" type="button">Cerrar sesión</button>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Categoría</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody id="adminTableBody"></tbody>
      </table>
    </div>
    <div class="admin-form-wrap" id="adminFormWrap" hidden></div>
  `;

  $('#adminLogoutBtn').addEventListener('click', async () => {
    await signOutAdmin();
    state.session = null;
    renderLogin();
  });

  $('#adminNewBtn').addEventListener('click', () => openForm(null));

  renderTable();
}

function renderTable() {
  const tbody = $('#adminTableBody');
  if (!tbody) return;

  if (!state.products.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin productos aún.</td></tr>';
    return;
  }

  tbody.innerHTML = state.products
    .map(
      (p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.price}</td>
        <td>${p.stock ?? 0}</td>
        <td>${p.category ?? ''}</td>
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
      const id = Number(btn.dataset.edit);
      const product = state.products.find((p) => p.id === id);
      openForm(product);
    });
  });

  tbody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.del);
      if (!confirm('¿Eliminar este producto?')) return;
      try {
        await deleteProduct(id);
        await loadProducts();
        renderTable();
      } catch (err) {
        alert('Error al eliminar: ' + err.message);
      }
    });
  });
}

function openForm(product) {
  state.editingId = product ? product.id : null;
  const wrap = $('#adminFormWrap');
  wrap.hidden = false;

  const p = product || {
    name: '',
    desc: '',
    price: 0,
    emoji: '🧸',
    image_url: '',
    category: '',
    stock: 0,
  };

  wrap.innerHTML = `
    <form class="admin-form" id="adminProductForm">
      <h3>${product ? 'Editar producto' : 'Nuevo producto'}</h3>
      <label>Nombre <input name="name" required value="${p.name ?? ''}" /></label>
      <label>Descripción <textarea name="desc" rows="2">${p.desc ?? ''}</textarea></label>
      <label>Precio <input name="price" type="number" min="0" step="1" required value="${p.price ?? 0}" /></label>
      <label>Stock <input name="stock" type="number" min="0" step="1" value="${p.stock ?? 0}" /></label>
      <label>Categoría <input name="category" value="${p.category ?? ''}" /></label>
      <label>Emoji <input name="emoji" value="${p.emoji ?? '🧸'}" maxlength="4" /></label>
      <label>URL de imagen <input name="image_url" type="url" value="${p.image_url ?? ''}" placeholder="https://..." /></label>
      <div class="admin-form-actions">
        <button type="submit" class="admin-btn primary">Guardar</button>
        <button type="button" class="admin-btn ghost" id="adminCancelBtn">Cancelar</button>
      </div>
      <p class="admin-error" id="adminFormError" hidden></p>
    </form>
  `;

  $('#adminCancelBtn').addEventListener('click', () => {
    wrap.hidden = true;
    wrap.innerHTML = '';
  });

  $('#adminProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      name: form.name.value.trim(),
      desc_text: form.desc.value.trim(),
      price: Number(form.price.value),
      stock: Number(form.stock.value),
      category: form.category.value.trim(),
      emoji: form.emoji.value.trim() || '🧸',
      image_url: form.image_url.value.trim() || null,
    };
    const errEl = $('#adminFormError');
    errEl.hidden = true;
    try {
      if (state.editingId) {
        await updateProduct(state.editingId, payload);
      } else {
        await createProduct(payload);
      }
      await loadProducts();
      renderTable();
      wrap.hidden = true;
      wrap.innerHTML = '';
      alert('✅ Producto guardado en Supabase');
    } catch (err) {
      errEl.textContent = err.message || 'Error al guardar';
      errEl.hidden = false;
    }
  });
}

export async function openAdmin() {
  const modal = ensureAdminModal();
  modal.removeAttribute('hidden');
  document.body.classList.add('admin-open');

  if (!state.session) {
    state.session = await getSession();
  }

  if (state.session) {
    try {
      await loadProducts();
      renderPanel();
    } catch (err) {
      renderLogin();
    }
  } else {
    renderLogin();
  }
}

export function closeAdmin() {
  const modal = $('#adminModal');
  if (modal) modal.setAttribute('hidden', '');
  document.body.classList.remove('admin-open');
}

export function bindAdminTriggers() {
  document.querySelectorAll('[data-open-admin]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openAdmin();
    });
  });

  if (window.location.hash === '#admin') {
    openAdmin();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindAdminTriggers);
} else {
  bindAdminTriggers();
}
