import { getConfig } from './supabase.js';

/**
 * Muestra dinamicamente el enlace "Especial" en el menu de navegacion
 * SOLO si el admin lo tiene activado (config.especial_activo).
 */
async function setupEspecialNav() {
  let cfg = null;
  try {
    cfg = await getConfig();
  } catch (_) {
    return; // sin config o sin acceso: no mostramos nada
  }
  if (!cfg || !cfg.especial_activo) return;

  const name = (cfg.especial_nombre || 'Especial').trim() || 'Especial';
  const isEspecialPage = /especial\.html$/i.test(window.location.pathname);

  const insertLink = (nav) => {
    if (!nav || nav.querySelector('a[href="especial.html"]')) return;
    const link = document.createElement('a');
    link.href = 'especial.html';
    link.textContent = name;
    if (isEspecialPage) link.classList.add('active');
    const nosotros = nav.querySelector('a[href="nosotros.html"]');
    if (nosotros) nav.insertBefore(link, nosotros);
    else nav.appendChild(link);
  };

  insertLink(document.getElementById('mainNav') || document.querySelector('.main-nav'));
  insertLink(document.getElementById('mobileNav'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEspecialNav);
} else {
  setupEspecialNav();
}
