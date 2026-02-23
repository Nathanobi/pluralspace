// ── PINTEREST IMPORT ──
// Gère la réception des images via #pinterest-import=... dans l'URL

const PINTEREST_PROXY = 'https://corsproxy.io/?';

async function fetchPinterestImage(url) {
  // Essai direct d'abord, puis proxy
  async function tryFetch(src) {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  try {
    return await tryFetch(url);
  } catch(e) {
    return await tryFetch(PINTEREST_PROXY + encodeURIComponent(url));
  }
}

function showPinterestToast(msg, duration = 3500) {
  const el = document.getElementById('pinterest-import-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, duration);
}

async function handlePinterestImport(data) {
  // Aller sur la page Images
  goToPage('images');

  // Import épingle unique
  if (data.img) {
    showPinterestToast('📌 Import Pinterest en cours…', 60000);
    try {
      const dataUrl = await fetchPinterestImage(data.img);
      const imgRec = {
        id: uid(), dataUrl, isCropped: false, originalDataUrl: dataUrl,
        prenomId: null, tags: [], createdAt: Date.now(),
        hostedUrl: data.img,
        pinterestUrl: data.pin || null,
        source: 'pinterest',
      };
      await dbPut('images', imgRec);
      images.push(imgRec);
      renderImages(); updateStats();
      showPinterestToast('📌 Image Pinterest importée !');
      logHistory('Image importée depuis Pinterest', 'image');
      toast('Image Pinterest importée avec succès.', 'success');
    } catch(e) {
      showPinterestToast('📌 Échec import : ' + e.message);
      toast('Échec import Pinterest : ' + e.message, 'error');
    }
    return;
  }

  // Import tableau (lot)
  if (data.batch && data.batch.length) {
    const urls   = data.batch;
    const total  = urls.length;
    let done = 0, errors = 0;

    showPinterestToast(`📌 Import de ${total} épingles… 0 %`, 120000);

    for (const url of urls) {
      try {
        const dataUrl = await fetchPinterestImage(url);
        const imgRec = {
          id: uid(), dataUrl, isCropped: false, originalDataUrl: dataUrl,
          prenomId: null, tags: [], createdAt: Date.now(),
          hostedUrl: url,
          pinterestUrl: data.board || null,
          source: 'pinterest',
        };
        await dbPut('images', imgRec);
        images.push(imgRec);
        done++;
        const pct = Math.round((done + errors) / total * 100);
        showPinterestToast(`📌 Import… ${done}/${total} (${pct} %)`, 120000);
        // Rafraîchir la galerie toutes les 5 images
        if (done % 5 === 0) renderImages();
      } catch(e) {
        errors++;
      }
    }

    renderImages(); updateStats();
    const msg = `📌 ${done} épingle(s) importée(s)${errors ? ` · ${errors} échec(s)` : ''}.`;
    showPinterestToast(msg);
    logHistory(`Import Pinterest tableau : ${done} images`, 'image');
    toast(msg, done > 0 ? 'success' : 'error');
  }
}

// ── Détection du hash au chargement ──
// On attend que l'app soit initialisée (db ouverte + données chargées)
function checkPinterestHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#pinterest-import=')) return;

  // Nettoyer le hash immédiatement pour éviter re-déclenchement
  history.replaceState(null, '', window.location.pathname);

  try {
    const raw  = decodeURIComponent(hash.slice('#pinterest-import='.length));
    const data = JSON.parse(raw);
    handlePinterestImport(data);
  } catch(e) {
    toast('Données Pinterest invalides : ' + e.message, 'error');
  }
}

// ── Share Target (PWA mobile) ──
// Quand l'app est ouverte via le menu "Partager" du téléphone
function checkShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl   = params.get('url')  || '';
  const sharedTitle = params.get('title') || '';

  // Pinterest partage en général l'URL de l'épingle
  if (sharedUrl && sharedUrl.includes('pinterest')) {
    history.replaceState(null, '', window.location.pathname);
    // Extraire l'image depuis l'URL de l'épingle via fetch de la page
    // (limité par CORS — on stocke au moins l'URL)
    toast('📌 Lien Pinterest reçu — ouverture en cours…', 'success');
    // Ouvrir l'épingle dans un nouvel onglet pour que l'utilisateur puisse
    // utiliser le bookmarklet dessus (fallback mobile)
    window.open(sharedUrl, '_blank');
  }
}
