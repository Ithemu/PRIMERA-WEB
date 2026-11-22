import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://ogkqjyoiadovchobbnik.supabase.co';
const supabaseKey = 'sb_publishable_DrVZWQpgCbF4pZfWh0UdMQ_cLRvIAut';

export const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE = 'productos';

// Bucket de Supabase Storage para las fotos del catalogo
export const BUCKET = 'catalogo-patitas-de-lanas';

/**
 * Sube un archivo de imagen al bucket publico y devuelve su URL publica.
 */
export async function uploadProductImage(file) {
  if (!file) throw new Error('No se recibio archivo.');
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeBase = (file.name.replace(/\.[^.]+$/, '') || 'producto')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'producto';
  const unique = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const path = safeBase + '-' + unique + '.' + ext;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
function normalizePayload(payload = {}) {
  const out = {
    name: (payload.name ?? '').toString().trim(),
    desc_text: (payload.desc_text ?? payload.desc ?? '').toString().trim(),
    price: Number(payload.price) || 0,
    stock: Number(payload.stock) || 0,
    emoji: (payload.emoji ?? '🧸').toString().trim() || '🧸',
    image_url: payload.image_url ? payload.image_url.toString().trim() : null,
    image_urls: Array.isArray(payload.image_urls)
      ? payload.image_urls.map((u) => (u ?? '').toString().trim()).filter(Boolean).slice(0, 3)
      : [],
  };
  if (payload.category != null) out.category = payload.category.toString().trim();
  if (payload.id != null && String(payload.id).trim() !== '') {
    out.id = payload.id;
  }
  return out;
}

export async function fetchProducts() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(normalizePayload(payload))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id, payload) {
  const clean = normalizePayload(payload);
  delete clean.id;
  const { data, error } = await supabase
    .from(TABLE)
    .update(clean)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* ---------- Configuracion del sitio (menu especial) ---------- */
export async function getConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('[config] getConfig error:', error);
    throw error;
  }
  return data;
}

export async function updateConfig(patch) {
  const { data, error } = await supabase
    .from('config')
    .update(patch)
    .eq('id', 1)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ---------- Pedidos ---------- */
function genOrderCode() {
  const d = new Date();
  const ymd = d.getFullYear().toString().slice(-2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'PDL-' + ymd + '-' + rnd;
}

export async function createOrder(payload) {
  const code = payload.codigo || genOrderCode();
  const { data, error } = await supabase
    .from('pedidos')
    .insert({ ...payload, codigo: code })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchOrders() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ---------- Cupones ---------- */
export async function validateCoupon(codigo) {
  const code = (codigo || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: 'Ingresa un código.' };
  const { data, error } = await supabase
    .from('cupones')
    .select('*')
    .eq('codigo', code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, msg: 'El cupón no existe.' };
  if (!data.activo) return { ok: false, msg: 'El cupón no está activo.' };
  if (data.usos_max != null && data.usos_actuales >= data.usos_max) {
    return { ok: false, msg: 'El cupón ya fue utilizado.' };
  }
  return { ok: true, cupon: data };
}

export async function fetchCoupons() {
  const { data, error } = await supabase
    .from('cupones')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCoupon(payload) {
  const clean = {
    codigo: (payload.codigo || '').trim().toUpperCase(),
    tipo: payload.tipo === 'fijo' ? 'fijo' : 'porcentaje',
    valor: Number(payload.valor) || 0,
    activo: payload.activo !== false,
    usos_max: payload.usos_max != null && payload.usos_max !== '' ? Number(payload.usos_max) : null,
  };
  const { data, error } = await supabase.from('cupones').insert(clean).select().single();
  if (error) throw error;
  return data;
}

export async function updateCoupon(id, patch) {
  const { data, error } = await supabase.from('cupones').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCoupon(id) {
  const { error } = await supabase.from('cupones').delete().eq('id', id);
  if (error) throw error;
}

/* Incrementa el uso de un cupon. Intenta RPC segura; si no existe, update directo. */
export async function incrementCouponUse(id) {
  const { error: rpcErr } = await supabase.rpc('increment_coupon_use', { coupon_id: id });
  if (!rpcErr) return;
  try {
    const { data } = await supabase.from('cupones').select('usos_actuales').eq('id', id).single();
    if (data) {
      await supabase.from('cupones').update({ usos_actuales: (data.usos_actuales || 0) + 1 }).eq('id', id);
    }
  } catch (_) { /* silencioso */ }
}

/* Productos filtrados por categoria (para el menu especial / papeleria) */
export async function fetchProductsByCategory(category) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('category', category)
    .order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
