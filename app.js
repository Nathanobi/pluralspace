// ── INIT ──
// ── GESTION HASH URL (shortcuts PWA) ──
function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '');
  const validPages = ['accueil', 'prenoms', 'images', 'proxys', 'tags', 'profils', 'config'];
  if (hash && validPages.includes(hash)) {
    goToPage(hash);
  }
}

async function init() {
  await openDB();
  prenoms = await dbGetAll('prenoms');
  tags    = await dbGetAll('tags');
  proxys  = await dbGetAll('proxys');
  images  = await dbGetAll('images');
  profils = await dbGetAll('profils');

  // Nettoyer uniquement les proxys sans prenomId (null/undefined) — pas les orphelins
  // (le nettoyage agressif supprimait des proxys valides après désync)
  for (const px of proxys.filter(x => !x.prenomId)) {
    await dbDelete('proxys', px.id);
  }
  proxys = proxys.filter(x => !!x.prenomId);

  const savedNotes = await dbGet('settings','globalNotes');
  if (savedNotes) document.getElementById('global-notes-input').value = savedNotes.value;

  renderAlphaFilter();
  renderTagFilters();
  renderImgTagFilters();
  renderProxyTagFilters();
  renderProfilTagFilters();
  renderPrenoms();
  renderProxys();
  renderNoProxyBanner();
  // Tags : vue par prénoms par défaut
  document.getElementById('tags-view-tags').style.display='none';
  document.getElementById('tags-view-prenoms').style.display='';
  renderTagsPrenomView();
  renderImages();
  renderProfils();
  updateStats();
}

init().then(async () => {
  // Restaurer le token PK depuis IndexedDB si absent du localStorage (autre appareil)
  try {
    if (!localStorage.getItem('ps-pk-token')) {
      const stored = await dbGet('settings', 'pk-token');
      if (stored && stored.value) {
        localStorage.setItem('ps-pk-token', stored.value);
      }
    }
  } catch(e) { /* token absent — pas critique */ }
  // Démarrer Firebase après init IndexedDB
  if (typeof fbStart === 'function') fbStart();
  // Charger les infos système PK si token disponible
  if (typeof fetchPkSystemInfo === 'function') fetchPkSystemInfo();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');

      // Détecter une mise à jour disponible
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouveau SW installé — proposer de recharger
            const banner = document.createElement('div');
            banner.style.cssText = [
              'position:fixed;bottom:calc(70px + env(safe-area-inset-bottom));left:50%;',
              'transform:translateX(-50%);z-index:9999;',
              'background:var(--bg3);border:1px solid var(--accent3);border-radius:var(--radius);',
              'padding:12px 20px;display:flex;align-items:center;gap:14px;',
              'box-shadow:var(--shadow);font-size:13px;color:var(--text);',
              'white-space:nowrap;'
            ].join('');
            const btn = document.createElement('button');
            btn.textContent = 'Recharger';
            btn.style.cssText = 'background:var(--accent3);color:var(--text);border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;';
            btn.onclick = () => {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage('skipWaiting');
              }
              window.location.reload();
            };
            banner.innerHTML = '<span>✦ Mise à jour disponible</span>';
            banner.appendChild(btn);
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 12000);
          }
        });
      });
    } catch(e) {
      console.warn('SW registration failed:', e);
    }
  });
}
