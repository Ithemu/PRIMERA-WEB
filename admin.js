/* =========================================================
   Patitas de Lana · Panel de administración
   - Login con Supabase Auth
   - CRUD de productos
   - Subida de hasta 3 fotos por producto a Supabase Storage
   - Categorías: stock / papeleria / especial
   ========================================================= */

import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  signInAdmin,
  signOutAdmin,
    getSession,
  getConfig,
  updateConfig,
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from './js/supabase.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const escapeHtml = (v = '') => String(v)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const MAX_PHOTOS = 3;

const state = {
  products: [],
  editingId: null,
  photos: [], // URLs de las fotos (máx 3) del producto en edición
  uploading: false,
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
  setTimeout(() => { el.hidden = true; }, 4000);
}

/* Traduce el error de Supabase Auth a un mensaje claro para el admin */
function loginErrorText(err) {
  const raw = (err && (err.message || err.error_description || err.msg)) || '';
  const m = String(raw).toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'El usuario existe pero el correo no está confirmado. En Supabase: Authentication → Users → confirmálo (o mará "Auto Confirm").';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Error de conexión con Supabase. Revisá tu internet.';
  }
  if (m.includes('user not found')) {
    return 'No existe un usuario con ese correo. Crealo en Supabase → Authentication → Users.';
  }
  return 'No se pudo ingresar: ' + (raw || 'error desconocido');
}

function showLoginMsg(text, type = 'err') {
  const el = $('#loginMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'admin-form-msg ' + type;
  el.hidden = false;
}

/* ---------- Fotos (hasta 3) ---------- */
function renderPhotoGrid() {
  const grid = $('#photoGrid');
  const hint = $('#photoHint');
  if (!grid) return;

  grid.innerHTML = '';
  state.photos.forEach((url, idx) => {
    const item = document.createElement('div');
    item.className = 'admin-photo-item';
    item.innerHTML = `
      <img src="${url}" alt="Foto ${idx + 1}" />
      <span class="admin-photo-badge">${idx === 0 ? 'Principal' : idx + 1}</span>
      <button type="button" class="admin-photo-remove" data-remove="${idx}" aria-label="Quitar foto">✕</button>
    `;
    grid.appendChild(item);
  });

  grid.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.remove);
      state.photos.splice(i, 1);
      renderPhotoGrid();
      updatePreview();
    });
  });

  if (hint) {
    if (state.photos.length >= MAX_PHOTOS) {
      hint.textContent = `Llegaste al máximo de ${MAX_PHOTOS} fotos. Quitá una para subir otra.`;
    } else {
      hint.textContent = `Subí hasta ${MAX_PHOTOS} imágenes (${state.photos.length}/${MAX_PHOTOS}). La primera será la principal de la tarjeta.`;
    }
  }

  const pickBtn = $('#pickPhotosBtn');
  if (pickBtn) pickBtn.disabled = state.photos.length >= MAX_PHOTOS;
}

async function handleFiles(fileList) {
  if (state.uploading) return;
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const space = MAX_PHOTOS - state.photos.length;
  if (space <= 0) {
    showFormMsg(`Ya tienes ${MAX_PHOTOS} fotos. Quita una para subir otra.`, 'err');
    return;
  }
  if (files.length > space) {
    showFormMsg(`Solo puedes subir ${space} foto(s) más (máximo ${MAX_PHOTOS} por producto).`, 'err');
  }

  state.uploading = true;
  const pickBtn = $('#pickPhotosBtn');
  if (pickBtn) { pickBtn.disabled = true; pickBtn.textContent = '⏳ Subiendo…'; }

  try {
    for (const file of files.slice(0, space)) {
      if (!file.type.startsWith('image/')) continue;
      const url = await uploadProductImage(file);
      state.photos.push(url);
      renderPhotoGrid();
      updatePreview();
    }
    showToast('📷 Foto(s) subida(s)');
  } catch (err) {
    console.error(err);
    showFormMsg('Error al subir foto: ' + (err.message || 'desconocido'), 'err');
  } finally {
    state.uploading = false;
    if (pickBtn) {
      pickBtn.textContent = '📷 Subir fotos (máx. 3)';
      pickBtn.disabled = state.photos.length >= MAX_PHOTOS;
    }
  }
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
  const firstPhoto = state.photos[0] || '';

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
  if (firstPhoto) {
    imgEl.innerHTML = `<img src="${firstPhoto}" alt="${name}" />`;
  } else {
    imgEl.textContent = emoji;
  }
}

/* ---------- Tabla ---------- */
function categoryLabel(cat) {
  const map = { stock: 'Stock', papeleria: 'Papelería', especial: 'Especial' };
  return map[cat] || '—';
}

function photoCount(p) {
  if (Array.isArray(p.image_urls) && p.image_urls.length) return p.image_urls.length;
  return p.image_url ? 1 : 0;
}

function renderTable() {
  const tbody = $('#productsTableBody');
  if (!tbody) return;

  if (!state.products.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">Sin productos aún.</td></tr>';
    return;
  }

  tbody.innerHTML = state.products
    .map(
      (p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name ?? ''}</td>
        <td>${categoryLabel(p.category)}</td>
        <td>${formatCLP(p.price)}</td>
        <td>${p.stock ?? 0}</td>
        <td>${photoCount(p)}</td>
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
  form.category.value = product.category || 'stock';

  // Fotos existentes (image_urls) o respaldo en image_url
  if (Array.isArray(product.image_urls) && product.image_urls.length) {
    state.photos = product.image_urls.slice(0, MAX_PHOTOS);
  } else if (product.image_url) {
    state.photos = [product.image_url];
  } else {
    state.photos = [];
  }
  renderPhotoGrid();

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
  state.photos = [];
  form.reset();
  form.id.readOnly = false;
  form.stock.value = 0;
  form.emoji.value = '🧸';
  form.category.value = 'stock';

  renderPhotoGrid();

  $('#formTitle').textContent = 'Nuevo producto';
  $('#saveBtn').textContent = 'Guardar producto';
  $('#cancelBtn').hidden = true;

  updatePreview();
}

async function loadProducts() {
  state.products = await fetchProducts();
}

/* ---------- Sesión / Login ---------- */
function showPanel(session) {
  const gate = $('#adminGate');
  const content = $('#adminContent');
  if (gate) gate.hidden = !!session;
  if (content) content.hidden = !session;
}

/* ---------- Init ---------- */
// Registra los listeners del panel UNA sola vez (idempotente).
let panelReady = false;
function setupPanel() {
  if (panelReady) return;
  panelReady = true;

  const form = $('#productForm');
  if (!form) return;

  // ----- Fotos -----
  const photoInput = $('#photoInput');
  const pickBtn = $('#pickPhotosBtn');
  if (pickBtn && photoInput) {
    pickBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async (e) => {
      await handleFiles(e.target.files);
      photoInput.value = '';
    });
  }

  // ----- Form -----
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  const cancelBtn = $('#cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

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
      showFormMsg('El precio debe ser un numero valido.', 'err');
      form.price.focus();
      return;
    }

    const payload = {
      name,
      desc_text: form.desc.value.trim(),
      price,
      stock: Number(form.stock.value) || 0,
      emoji: form.emoji.value.trim() || '\uD83E\uDDF8',
      category: form.category.value || 'stock',
      image_url: state.photos[0] || null,
      image_urls: state.photos.slice(0, MAX_PHOTOS),
    };

    try {
      if (state.editingId != null) {
        await updateProduct(state.editingId, payload);
        showFormMsg('Producto actualizado.', 'ok');
        showToast('Producto actualizado');
      } else {
        const manualId = form.id.value.trim();
        if (manualId) payload.id = manualId;
        await createProduct(payload);
        showFormMsg('Producto creado y guardado en Supabase.', 'ok');
        showToast('Producto creado');
      }
      await loadProducts();
      renderTable();
      resetForm();
    } catch (err) {
      showFormMsg('Error: ' + (err.message || 'desconocido'), 'err');
    }
  });

    updatePreview();
    renderPhotoGrid();

    setupEspecialConfig();
    setupCouponsForm();
}

/* ---------- Cupones ---------- */
let couponsReady = false;
let couponsCache = [];

function setupCouponsForm() {
    if (couponsReady) return;
    couponsReady = true;

    const form = $('#couponForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const codigo = (fd.get('codigo') || '').toString().trim().toUpperCase();
        const tipo = (fd.get('tipo') || 'porcentaje').toString();
        const valor = Number(fd.get('valor')) || 0;
        const usosRaw = (fd.get('usos_max') || '').toString().trim();
        const msg = $('#couponFormMsg');

        if (!codigo) { showCouponMsg('Ingresa un código.', 'err'); return; }
        if (valor <= 0) { showCouponMsg('El valor debe ser mayor a 0.', 'err'); return; }
        if (tipo === 'porcentaje' && valor > 100) { showCouponMsg('El porcentaje no puede superar 100.', 'err'); return; }

        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
        try {
          await createCoupon({
            codigo, tipo, valor,
            usos_max: usosRaw === '' ? null : Number(usosRaw),
            activo: true,
          });
          showCouponMsg('Cupón creado ✓', 'ok');
          form.reset();
          await loadCoupons();
        } catch (err) {
          showCouponMsg('Error: ' + (err.message || 'desconocido'), 'err');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = 'Crear cupón'; }
        }
      });
    }

    // Delegacion en la tabla de cupones (toggle activo / borrar)
    const tbody = $('#couponsTableBody');
    if (tbody) {
      tbody.addEventListener('change', async (e) => {
        const chk = e.target.closest('.admin-coupon-active');
        if (!chk) return;
        const id = chk.dataset.id;
        try { await updateCoupon(id, { activo: chk.checked }); }
        catch (err) { alert('Error: ' + err.message); chk.checked = !chk.checked; }
      });
      tbody.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-del-coupon]');
        if (!del) return;
        if (!confirm('¿Eliminar este cupón?')) return;
        try { await deleteCoupon(del.dataset.delCoupon); await loadCoupons(); }
        catch (err) { alert('Error: ' + err.message); }
      });
    }
}

function showCouponMsg(text, type) {
    const el = $('#couponFormMsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'admin-form-msg ' + (type || '');
    el.hidden = false;
}

async function loadCoupons() {
    const tbody = $('#couponsTableBody');
    if (!tbody) return;
    try {
      const list = await fetchCoupons();
      couponsCache = list;
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Aún no hay cupones.</td></tr>';
        return;
      }
      tbody.innerHTML = list.map((c) => {
        const valorTxt = c.tipo === 'porcentaje' ? `${c.valor}%` : 'CLP $' + Number(c.valor || 0).toLocaleString('es-CL');
        const usosTxt = c.usos_max != null ? `${c.usos_actuales || 0} / ${c.usos_max}` : `${c.usos_actuales || 0} / ∞`;
        return `
          <tr>
            <td class="admin-coupon-code">${escapeHtml(c.codigo)}</td>
            <td>${c.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo'}</td>
            <td>${valorTxt}</td>
            <td>${usosTxt}</td>
            <td><input type="checkbox" class="admin-coupon-active" data-id="${c.id}" ${c.activo ? 'checked' : ''} /></td>
            <td><button type="button" class="admin-btn ghost" data-del-coupon="${c.id}">Eliminar</button></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error al cargar cupones: ${escapeHtml(err.message)}</td></tr>`;
    }
}

/* ---------- Config del menu Especial (on/off + nombre) ---------- */
let especialReady = false;
async function setupEspecialConfig() {
  const section = $('#especialConfigSection');
  if (!section) return;

  if (!especialReady) {
    especialReady = true;
    const saveBtn = $('#especialSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveEspecialConfig);
  }

  // Cargar valores actuales
  try {
    const cfg = await getConfig();
    const activo = $('#especialActivo');
    const nombre = $('#especialNombre');
    if (activo) activo.checked = !!cfg.especial_activo;
    if (nombre) nombre.value = cfg.especial_nombre || 'Especial';
    } catch (err) {
    console.error('[especial] error al cargar config:', err);
    const st = $('#especialStatus');
    if (st) {
      const msg = err && (err.message || err.error_description || err.details);
      st.textContent = 'Error config: ' + (msg || 'desconocido');
      st.className = 'admin-especial-status err';
    }
  }
}

async function saveEspecialConfig() {
  const activo = $('#especialActivo');
  const nombre = $('#especialNombre');
  const st = $('#especialStatus');
  const btn = $('#especialSaveBtn');

  const especial_activo = !!activo?.checked;
  const especial_nombre = (nombre?.value || '').trim() || 'Especial';

  if (especial_activo && !especial_nombre) {
    if (st) { st.textContent = 'Poné un nombre para el menú.'; st.className = 'admin-especial-status err'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    await updateConfig({ especial_activo, especial_nombre });
    if (st) { st.textContent = 'Guardado ✓'; st.className = 'admin-especial-status ok'; }
    setTimeout(() => { if (st) st.textContent = ''; }, 2500);
  } catch (err) {
    if (st) { st.textContent = 'Error: ' + (err.message || 'desconocido'); st.className = 'admin-especial-status err'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  }
}

async function refreshPanelData() {
  try {
    await loadProducts();
    renderTable();
    await loadCoupons();
  } catch (err) {
    const tbody = $('#productsTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Error al cargar: ${err.message}</td></tr>`;
    }
  }
}

async function init() {
  const form = $('#productForm');
  if (!form) return;

  // ----- Login (siempre se registra) -----
  const loginForm = $('#loginForm');
  if (loginForm) {
    const togglePw = $('#togglePw');
    if (togglePw) {
      togglePw.addEventListener('click', () => {
        const input = loginForm.password;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        togglePw.textContent = show ? 'Ocultar' : 'Ver';
        togglePw.setAttribute('aria-pressed', show ? 'true' : 'false');
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      if (!email || !password) {
        showLoginMsg('Ingresa tu correo y contrasena.');
        return;
      }
      const btn = $('#loginBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }
      try {
        await signInAdmin(email, password);
        const session = await getSession();
        if (!session) {
          showLoginMsg('No se pudo iniciar sesion. Revisa tu correo y contrasena.');
          return;
        }
                showLoginMsg('', 'ok');
        console.info('[admin] login exitoso:', email);
        // TODO (pendiente): avisar por correo (Resend Edge Function 'notify-login')
        // de este login exitoso a patitasdelanaa@gmail.com.
        showPanel(session);
        setupPanel();          // <-- engancha fotos/form tras el login
        await refreshPanelData();
            } catch (err) {
        // Mensaje segun el correo ingresado:
        //  - Correo de la duena => mensaje generico de credenciales.
        //  - Cualquier otro correo => mensaje de "intruso".
        const ADMIN_OWNER_EMAIL = 'patitasdelanaa@gmail.com';
        const isOwnerEmail = email.toLowerCase() === ADMIN_OWNER_EMAIL;
        if (isOwnerEmail) {
          showLoginMsg('Error en credenciales, revise contraseña.');
        } else {
          showLoginMsg('Te he pillado basura, estás intentando ingresar a una cuenta con seguridad, lárgate.');
        }
        console.warn('[admin] intento de login fallido:', email, '| owner:', isOwnerEmail);
        // TODO (pendiente): avisar por correo (Resend Edge Function 'notify-login')
        // de los intentos de login (exitosos y fallidos) a patitasdelanaa@gmail.com.
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }
      }
    });
  }

  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await signOutAdmin(); } catch (_) {}
      showPanel(null);
      panelReady = false;
    });
  }

  // ----- Check sesion existente -----
  let session = null;
  try { session = await getSession(); } catch (_) {}
  showPanel(session);

  if (session) {
    setupPanel();
    await refreshPanelData();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
