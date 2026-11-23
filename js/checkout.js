import {
  createOrder,
  validateCoupon,
  incrementCouponUse,
} from './supabase.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const STORAGE_KEY = 'patitas-de-lana-cart';
const EDGE_URL = ''; // misma base que Supabase; se resuelve abajo

function formatCLP(n) {
  const v = Math.round(Number(n) || 0);
  return 'CLP $' + v.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

/* ------------- Estado ------------- */
let cart = loadCart();
let envio = 0;                 // costo de envio actual
let carrierElegido = null;     // { nombre, precio, dias }
let cuponAplicado = null;      // { id, codigo, tipo, valor }

function subtotal() {
  return cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
}
function descuento() {
  if (!cuponAplicado) return 0;
  const sub = subtotal();
  if (cuponAplicado.tipo === 'porcentaje') {
    return Math.round(sub * (Number(cuponAplicado.valor) || 0) / 100);
  }
  return Math.min(sub, Number(cuponAplicado.valor) || 0);
}
function total() {
  return Math.max(0, subtotal() - descuento() + (Number(envio) || 0));
}

/* ------------- Render resumen ------------- */
function renderSummary() {
  const itemsEl = $('#summaryItems');
  if (itemsEl) {
    if (cart.length === 0) {
      itemsEl.innerHTML = '<p class="co-carriers-hint">Tu carrito está vacío. <a href="index.html">Ir a la tienda</a></p>';
    } else {
      itemsEl.innerHTML = cart.map((it) => {
        const thumb = it.image_url
          ? `<img src="${it.image_url}" alt="">`
          : `<div class="co-thumb-emoji">${it.emoji || '🧸'}</div>`;
        const linePrice = formatCLP((Number(it.price) || 0) * (Number(it.qty) || 0));
        return `
          <div class="co-summary-item">
            ${thumb}
            <div class="co-item-name">${escapeHtml(it.name)}<div class="co-item-qty">x${it.qty}</div></div>
            <div class="co-item-price">${linePrice}</div>
          </div>`;
      }).join('');
    }
  }

  const subEl = $('#sumSubtotal');
  if (subEl) subEl.textContent = formatCLP(subtotal());

  const discLine = $('#sumDiscountLine');
  const discEl = $('#sumDiscount');
  const d = descuento();
  if (discLine && discEl) {
    if (d > 0) { discLine.hidden = false; discEl.textContent = '- ' + formatCLP(d); }
    else { discLine.hidden = true; }
  }

  const envioEl = $('#sumEnvio');
  if (envioEl) {
    const entrega = getEntrega();
    if (entrega === 'retiro') envioEl.textContent = 'Retiro (gratis)';
    else if (carrierElegido) envioEl.textContent = formatCLP(envio);
    else envioEl.textContent = 'Por calcular';
  }

  const totalEl = $('#sumTotal');
  if (totalEl) totalEl.textContent = formatCLP(entregaTotal());
}

// Para el total mostrado: si es retiro, envio=0; si carrier sin elegir, igual suma 0 hasta elegir
function entregaTotal() {
  const entrega = getEntrega();
  const env = entrega === 'retiro' ? 0 : (Number(envio) || 0);
  return Math.max(0, subtotal() - descuento() + env);
}

function escapeHtml(v = '') {
  return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function getEntrega() {
  const r = $('input[name="entrega"]:checked');
  return r ? r.value : 'carrier';
}

/* ------------- Cotización de envío ------------- */
// Estructura preparada para Shipit. Hoy: simulado por región.
// Cuando se integre Shipit, esta función llamará a la Edge Function 'cotizar-envio'.
async function cotizarEnvio(region) {
  // TODO: reemplazar por llamada a Edge Function con la API de Shipit.
  // Simulación por zona:
  if (!region) return [];
  const esRM = region === 'Metropolitana';
  const base = esRM ? 2990 : 4990;
  return [
    { carrier: 'Chilexpress', precio: base, dias: '2-4 días hábiles' },
    { carrier: 'Starken', precio: base + 500, dias: '3-5 días hábiles' },
    { carrier: 'Bluexpress', precio: base + 300, dias: '2-4 días hábiles' },
    { carrier: 'Mercado Libre Envíos', precio: base + 200, dias: '3-6 días hábiles' },
  ];
}

async function renderCarriers() {
  const box = $('#carrierOptions');
  if (!box) return;
  const region = $('#regionSelect')?.value || '';
  if (getEntrega() === 'retiro') { box.innerHTML = ''; return; }
  if (!region) {
    box.innerHTML = '<p class="co-carriers-hint">Selecciona una región para ver las opciones de envío.</p>';
    carrierElegido = null; envio = 0;
    renderSummary();
    return;
  }
  box.innerHTML = '<p class="co-carriers-hint">Cotizando envío...</p>';
  const opciones = await cotizarEnvio(region);
  box.innerHTML = opciones.map((o, i) => `
    <label class="co-carrier-opt">
      <input type="radio" name="carrier" value="${escapeHtml(o.carrier)}" data-precio="${o.precio}" data-dias="${escapeHtml(o.dias)}" ${i === 0 ? 'checked' : ''} />
      <span>${escapeHtml(o.carrier)}</span>
      <span class="co-carrier-meta">${formatCLP(o.precio)} · ${escapeHtml(o.dias)}</span>
    </label>
  `).join('');

  // Seleccionar el primero por defecto
  const first = box.querySelector('input[name="carrier"]');
  if (first) {
    carrierElegido = { nombre: first.value, precio: Number(first.dataset.precio), dias: first.dataset.dias };
    envio = Number(first.dataset.precio);
  }
  $$('input[name="carrier"]', box).forEach((inp) => {
    inp.addEventListener('change', () => {
      carrierElegido = { nombre: inp.value, precio: Number(inp.dataset.precio), dias: inp.dataset.dias };
      envio = Number(inp.dataset.precio);
      renderSummary();
    });
  });
  renderSummary();
}

/* ------------- Entrega toggle ------------- */
function setupEntregaToggle() {
  $$('input[name="entrega"]').forEach((r) => {
    r.addEventListener('change', () => {
      const retiro = getEntrega() === 'retiro';
      const addr = $('#addressFields');
      const retiroInfo = $('#retiroInfo');
      if (addr) addr.hidden = retiro;
      if (retiroInfo) retiroInfo.hidden = !retiro;
      if (retiro) { envio = 0; carrierElegido = null; renderSummary(); }
      else { renderCarriers(); }
    });
  });
}

/* ------------- Cupón ------------- */
function setupCoupon() {
  const btn = $('#applyCouponBtn');
  const input = $('#couponInput');
  const msg = $('#couponMsg');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const code = (input?.value || '').trim();
    if (!code) return;
    if (msg) { msg.textContent = 'Validando...'; msg.className = 'co-coupon-msg'; }
    try {
      const res = await validateCoupon(code);
      if (!res.ok) {
        cuponAplicado = null;
        if (msg) { msg.textContent = res.msg; msg.className = 'co-coupon-msg err'; }
      } else {
        cuponAplicado = {
          id: res.cupon.id,
          codigo: res.cupon.codigo,
          tipo: res.cupon.tipo,
          valor: res.cupon.valor,
        };
        const etiqueta = res.cupon.tipo === 'porcentaje'
          ? `${res.cupon.valor}% de descuento`
          : `${formatCLP(res.cupon.valor)} de descuento`;
        if (msg) { msg.textContent = `✓ Cupón aplicado: ${etiqueta}`; msg.className = 'co-coupon-msg ok'; }
      }
    } catch (err) {
      if (msg) { msg.textContent = 'Error al validar cupón.'; msg.className = 'co-coupon-msg err'; }
    }
    renderSummary();
  });
}

/* ------------- Realizar pedido ------------- */
function getFormData() {
  const form = $('#checkoutForm');
  const fd = new FormData(form);
  return {
    nombre: (fd.get('nombre') || '').toString().trim(),
    apellido: (fd.get('apellido') || '').toString().trim(),
    email: (fd.get('email') || '').toString().trim(),
    telefono: (fd.get('telefono') || '').toString().trim(),
    entrega: getEntrega(),
    carrier: carrierElegido?.nombre || null,
    calle: (fd.get('calle') || '').toString().trim(),
    comuna: (fd.get('comuna') || '').toString().trim(),
    ciudad: (fd.get('ciudad') || '').toString().trim(),
    region: (fd.get('region') || '').toString().trim(),
    notas: (fd.get('notas') || '').toString().trim(),
    metodo_pago: (fd.get('metodo_pago') || 'webpay').toString(),
  };
}

function validateForm(data) {
  if (cart.length === 0) return 'Tu carrito está vacío.';
  if (!data.nombre) return 'Falta tu nombre.';
  if (!data.apellido) return 'Falta tu apellido.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return 'Correo inválido.';
  if (!data.telefono) return 'Falta tu teléfono.';
  if (data.entrega === 'carrier') {
    if (!data.region) return 'Selecciona tu región.';
    if (!carrierElegido) return 'Selecciona un método de envío.';
    if (!data.calle) return 'Falta tu calle y número.';
    if (!data.comuna) return 'Falta tu comuna.';
    if (!data.ciudad) return 'Falta tu ciudad.';
  }
  return null;
}

function showToast(msg) {
  const t = $('#toast');
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

async function placeOrder() {
  const btn = $('#placeOrderBtn');
  const data = getFormData();
  const err = validateForm(data);
  if (err) { showToast('⚠️ ' + err); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

  const envioFinal = data.entrega === 'retiro' ? 0 : (Number(envio) || 0);
  const payload = {
    ...data,
    cupon: cuponAplicado?.codigo || null,
    items: cart.map((it) => ({
      id: it.id, name: it.name, price: Number(it.price) || 0, qty: Number(it.qty) || 0,
      image_url: it.image_url || null,
    })),
    subtotal: subtotal(),
    descuento: descuento(),
    envio: envioFinal,
    total: Math.max(0, subtotal() - descuento() + envioFinal),
    estado: 'pendiente',
  };

  try {
    const order = await createOrder(payload);

    // Incrementar uso del cupón
    if (cuponAplicado?.id) { try { await incrementCouponUse(cuponAplicado.id); } catch (_) {} }

    // Enviar correo (Edge Function con Resend). No bloquea el pedido si falla.
    let emailResult = null;
    try { emailResult = await sendOrderEmail(order, payload); } catch (e) { console.warn('Email no enviado:', e); }

    // Limpiar carrito
    cart = [];
    saveCart(cart);

    // Mostrar confirmación (sabiendo si el correo al comprador salió)
    showConfirm(order, data, emailResult);

  } catch (e) {
    console.error(e);
    showToast('❌ Error al guardar el pedido: ' + (e.message || 'desconocido'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Realizar pedido'; }
  }
}

async function sendOrderEmail(order, payload) {
  // Llama a la Edge Function 'send-order-email' de Supabase.
  // Devuelve la data de respuesta (incluye buyerDelivered) o null si falla.
  const mod = await import('./supabase.js');
  const supabaseClient = mod.supabase;
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.functions.invoke('send-order-email', {
    body: { order, payload },
  });
  if (error) throw error;
  return data;
}

function showConfirm(order, data, emailResult) {
  const overlay = $('#orderConfirm');
  const msgEl = $('#confirmMsg');
  const codeEl = $('#confirmCode');
  const buyerDelivered = !!(emailResult && emailResult.buyerDelivered);

  if (msgEl) {
    if (buyerDelivered) {
      msgEl.innerHTML = `Se ha enviado la información de tu pedido y tu boleta a tu correo <strong>${escapeHtml(data.email)}</strong>.<br>¡Muchas gracias por tu compra! 🧶`;
    } else {
      // Pedido guardado, pero el correo al comprador aún no pudo salir (dominio pendiente).
      msgEl.innerHTML = `Tu pedido <strong>${escapeHtml(order.codigo || order.id || '')}</strong> fue registrado con éxito.<br>
      Te enviaremos la confirmación a <strong>${escapeHtml(data.email)}</strong> a la brevedad.<br>¡Muchas gracias por tu compra! 🧶`;
    }
  }
  if (codeEl) codeEl.textContent = order.codigo || order.id || '—';
  if (overlay) overlay.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------- Init ------------- */
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (cart.length === 0) {
    // Carrito vacío: igual mostramos el resumen con mensaje
  }

  renderSummary();
  setupEntregaToggle();
  setupCoupon();

  const regionSel = $('#regionSelect');
  if (regionSel) regionSel.addEventListener('change', renderCarriers);

  const placeBtn = $('#placeOrderBtn');
  if (placeBtn) placeBtn.addEventListener('click', placeOrder);
});
