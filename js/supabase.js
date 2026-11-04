import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://ogkqjyoiadovchobbnik.supabase.co';
const supabaseKey = 'sb_publishable_DrVZWQpgCbF4pZfWh0UdMQ_cLRvIAut';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Prueba de conexión (solo para desarrollo)
supabase
  .from('products')
  .select('id')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.warn('[Supabase] Error de conexión:', error.message);
    } else {
      console.log('[Supabase] Conexión OK ✅', data);
    }
  });
