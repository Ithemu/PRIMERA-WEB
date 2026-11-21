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
