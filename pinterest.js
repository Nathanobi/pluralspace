// ── PINTEREST INTEGRATION ──
// Stratégie : API non-officielle Pinterest (cookies navigateur),
// avec fallback épingles individuelles via proxy CORS + og:image.

// ── ONGLETS GALERIE / PINTEREST ──
document.querySelectorAll('.img-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.img-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.img-tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('img-panel-' + btn.dataset.imgTab).classList.add('active');
  });
});

// ── MODE TABLEAU / ÉPINGLES ──
document.getElementById('pin-mode-board').addEventListener('click', () => {
  document.getElementById('pin-mode-board').classList.add('active');
  document.getElementById('pin-mode-pins').classList.remove('active');
  document.getElementById('pin-section-board').style.display = '';
  document.getElementById('pin-section-pins').style.display = 'none';
});
document.getElementById('pin-mode-pins').addEventListener('click', () => {
  document.getElementById('pin-mode-pins').classList.add('active');
  document.getElementById('pin-mode-board').classList.remove('active');
  document.getElementById('pin-section-board').style.display = 'none';
  document.getElementById('pin-section-pins').style.display = '';
});

// ── STATE ──
let loadedPins = [];

// ── UTILITAIRES ──

function isPinImported(pinUrl, pinId) {
  return images.some(img =>
    (pinUrl && img.pinterestUrl === pinUrl) ||
    (pinId  && img.pinterestPinId === pinId)
  );
}

function extractPinId(url) {
  const m = url.match(/\/pin\/(\d+)/);
  return m ? m[1] : null;
}

function pinLog(html, reset) {
  const el = document.getElementById('pin-log');
  el.style.display = '';
  if (reset) el.innerHTML = html || '';
  else el.innerHTML += html + '<br>';
  el.scrollTop = el.scrollHeight;
}

// Télécharge une image Pinterest → dataUrl (direct puis proxy)
async function fetchPinImage(imgUrl) {
  async function tryLoad(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const t = setTimeout(() => reject(new Error('timeout')), 12000);
      img.onload = () => {
        clearTimeout(t);
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 736; c.height = img.naturalHeight || 736;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/jpeg', 0.9));
        } catch(e) { reject(e); }
      };
      img.onerror = () => { clearTimeout(t); reject(new Error('onerror')); };
      img.src = src;
    });
  }
  return tryLoad(imgUrl)
    .catch(() => tryLoad('https://corsproxy.io/?' + encodeURIComponent(imgUrl)));
}

// ── SCRAPING TABLEAU ──
async function fetchBoardPins(boardUrl) {
  const clean = boardUrl.replace(/\/$/, '');
  const match = clean.match(/pinterest\.[^/]+\/([^/?#]+)\/([^/?#]+(?:\/[^/?#]+)?)/);
  if (!match) throw new Error('URL non reconnue. Format : pinterest.com/utilisateur/tableau/');

  const username  = match[1];
  const boardPath = match[2]; // ex: "board" ou "board/subboard"
  const slug      = boardPath.split('/')[0];
  const sourcePath = '/' + username + '/' + boardPath + '/';

  // Récupérer l'ID du tableau
  const boardInfoUrl = 'https://www.pinterest.com/resource/BoardResource/get/?'
    + 'source_url=' + encodeURIComponent(sourcePath)
    + '&data=' + encodeURIComponent(JSON.stringify({ options: { username, slug } }));

  let boardId;
  try {
    const resp = await fetch(boardInfoUrl, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    boardId = data?.resource_response?.data?.id;
    if (!boardId) throw new Error('Board ID introuvable');
  } catch(e) {
    throw new Error(
      'Pinterest a refusé la requête (' + e.message + ').\n\n' +
      'Solution : ouvrez pinterest.fr dans un autre onglet, connectez-vous, puis réessayez ici.\n' +
      'Ou utilisez le mode Épingles individuelles.'
    );
  }

  // Pagination
  const allPins = [];
  let bookmark  = null;
  for (let page = 0; page < 40; page++) {
    const opts = { board_id: boardId, page_size: 25 };
    if (bookmark) opts.bookmarks = [bookmark];

    const feedUrl = 'https://www.pinterest.com/resource/BoardFeedResource/get/?'
      + 'source_url=' + encodeURIComponent(sourcePath)
      + '&data=' + encodeURIComponent(JSON.stringify({ options: opts }));

    const resp = await fetch(feedUrl, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data  = await resp.json();
    const items = data?.resource_response?.data || [];
    const bk    = data?.resource_response?.bookmark;

    for (const pin of items) {
      if (pin?.type !== 'pin') continue;
      const imgUrl = pin?.images?.['736x']?.url || pin?.images?.orig?.url;
      if (!imgUrl) continue;
      allPins.push({
        pinId:       String(pin.id),
        pinUrl:      'https://www.pinterest.com/pin/' + pin.id + '/',
        imgUrl,
        description: (pin.description || pin.title || '').slice(0, 120),
      });
    }
    if (!bk || bk === '-end-') break;
    bookmark = bk;
  }
  return allPins;
}

// ── RENDU GRILLE ÉPINGLES ──
function renderPinGrid(pins) {
  const grid = document.getElementById('pin-board-grid');
  if (!pins.length) {
    grid.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:8px 0;">Aucune épingle trouvée.</p>';
    return;
  }
  grid.innerHTML = pins.map((pin, i) => {
    const imported = isPinImported(pin.pinUrl, pin.pinId);
    return `<div class="pin-card" data-pin-idx="${i}">
      <img src="${pin.imgUrl}" loading="lazy" alt="${esc(pin.description)}"
           onerror="this.style.display='none';this.parentElement.style.background='var(--bg3)'" />
      <div class="pin-card-badge ${imported ? 'imported' : 'not-imported'}">
        ${imported ? '✓ Importé' : '📌'}
      </div>
      <div class="pin-card-overlay">
        <div class="pin-desc">${esc(pin.description)}</div>
        <button class="btn btn-sm pin-import-btn ${imported ? 'btn-ghost' : 'btn-primary'}"
                data-pin-idx="${i}" ${imported ? 'disabled style="opacity:.5;"' : ''}>
          ${imported ? '✓ Déjà importé' : '⬇ Importer'}
        </button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pin-import-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const pin = pins[parseInt(btn.dataset.pinIdx)];
      await importSinglePin(pin, btn);
    });
  });
}

// ── IMPORT UNE ÉPINGLE ──
async function importSinglePin(pin, btnEl) {
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳…'; }
  try {
    const dataUrl = await fetchPinImage(pin.imgUrl);
    const imgObj = {
      id: uid(), dataUrl,
      isCropped: false, originalDataUrl: dataUrl,
      prenomId: null, tags: [], createdAt: Date.now(),
      hostedUrl: null,
      pinterestUrl:  pin.pinUrl,
      pinterestPinId: pin.pinId,
      pinterestDesc:  pin.description,
    };
    await dbPut('images', imgObj);
    images.push(imgObj);
    if (btnEl) {
      btnEl.textContent = '✓ Importé';
      btnEl.disabled = true;
      btnEl.classList.replace('btn-primary', 'btn-ghost');
      const badge = btnEl.closest('.pin-card')?.querySelector('.pin-card-badge');
      if (badge) { badge.className = 'pin-card-badge imported'; badge.textContent = '✓ Importé'; }
    }
    updateStats();
    return true;
  } catch(e) {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '⬇ Importer'; }
    toast('Échec : ' + e.message, 'error');
    return false;
  }
}

// ── CHARGER UN TABLEAU ──
document.getElementById('btn-pin-load-board').addEventListener('click', async () => {
  const url     = document.getElementById('pin-board-url').value.trim();
  const btn     = document.getElementById('btn-pin-load-board');
  const status  = document.getElementById('pin-board-status');
  const actions = document.getElementById('pin-board-actions');
  const grid    = document.getElementById('pin-board-grid');
  if (!url) { toast('Entrez une URL de tableau Pinterest.', 'error'); return; }

  btn.disabled = true; btn.textContent = '⏳ Chargement…';
  status.style.cssText = 'display:;background:var(--bg3);color:var(--text2);padding:8px 12px;border-radius:var(--radius-sm);margin-bottom:12px;';
  status.textContent = '⏳ Connexion à Pinterest…';
  actions.style.display = 'none';
  grid.innerHTML = '';
  loadedPins = [];
  document.getElementById('pin-log').style.display = 'none';

  try {
    const pins = await fetchBoardPins(url);
    loadedPins = pins;
    const importedN = pins.filter(p => isPinImported(p.pinUrl, p.pinId)).length;
    const newN      = pins.length - importedN;

    status.style.background = 'rgba(126,200,160,0.12)';
    status.style.color      = 'var(--success)';
    status.textContent      = `✓ ${pins.length} épingle${pins.length>1?'s':''} — ${importedN} déjà importée${importedN>1?'s':''}, ${newN} nouvelle${newN>1?'s':''}`;
    actions.style.display   = 'flex';
    document.getElementById('pin-board-count').textContent = newN + ' à importer';
    renderPinGrid(pins);
  } catch(err) {
    status.style.background = 'rgba(232,122,122,0.1)';
    status.style.color      = 'var(--danger)';
    status.textContent      = '✕ ' + err.message.split('\n')[0];
    grid.innerHTML = `<div style="padding:16px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border2);font-size:13px;line-height:1.8;max-width:560px;">
      <strong>Pourquoi ça ne fonctionne pas ?</strong><br>
      Pinterest bloque les requêtes depuis d'autres sites sans authentification valide.<br><br>
      <strong>Solutions :</strong><br>
      <strong>1.</strong> Ouvrez <a href="https://www.pinterest.fr" target="_blank" style="color:var(--accent3);">pinterest.fr</a>
         dans un autre onglet → connectez-vous → revenez ici et réessayez.<br>
      <strong>2.</strong> Ou passez en mode <strong>Épingles individuelles</strong>
         (coller les URLs une par une).<br>
      <div style="margin-top:10px;font-size:11px;color:var(--text3);">Erreur : ${esc(err.message)}</div>
    </div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Charger le tableau';
  }
});

// ── TOUT IMPORTER ──
document.getElementById('btn-pin-import-all').addEventListener('click', async () => {
  if (!loadedPins.length) return;
  const btn = document.getElementById('btn-pin-import-all');
  btn.disabled = true;
  pinLog('', true);
  let ok = 0, fail = 0;
  for (let i = 0; i < loadedPins.length; i++) {
    const pin = loadedPins[i];
    pinLog(`<span style="color:var(--text3);">(${i+1}/${loadedPins.length})</span> ${esc(pin.description || 'Épingle #' + (i+1))}…`);
    if (isPinImported(pin.pinUrl, pin.pinId)) {
      pinLog(`&nbsp;&nbsp;<span style="color:var(--text3);">◌ Déjà importée</span>`); ok++;
    } else {
      const s = await importSinglePin(pin, null);
      if (s) { pinLog(`&nbsp;&nbsp;<span style="color:var(--success);">✦ Importée</span>`); ok++; }
      else   { pinLog(`&nbsp;&nbsp;<span style="color:var(--danger);">✕ Échec</span>`);    fail++; }
    }
  }
  pinLog(`<br><strong>✓ Terminé : ${ok} importée${ok>1?'s':''}, ${fail} échec${fail>1?'s':''}.</strong>`);
  renderImages(); renderPinGrid(loadedPins);
  btn.disabled = false;
});

// ── IMPORTER LES NOUVELLES SEULEMENT ──
document.getElementById('btn-pin-import-new').addEventListener('click', async () => {
  if (!loadedPins.length) return;
  const btn = document.getElementById('btn-pin-import-new');
  btn.disabled = true;
  const toImport = loadedPins.filter(p => !isPinImported(p.pinUrl, p.pinId));
  if (!toImport.length) { toast('Toutes les épingles sont déjà importées.', 'success'); btn.disabled=false; return; }
  pinLog('', true);
  let ok = 0, fail = 0;
  for (let i = 0; i < toImport.length; i++) {
    const pin = toImport[i];
    pinLog(`<span style="color:var(--text3);">(${i+1}/${toImport.length})</span> ${esc(pin.description || 'Épingle #' + (i+1))}…`);
    const s = await importSinglePin(pin, null);
    if (s) { pinLog(`&nbsp;&nbsp;<span style="color:var(--success);">✦ Importée</span>`); ok++; }
    else   { pinLog(`&nbsp;&nbsp;<span style="color:var(--danger);">✕ Échec</span>`);    fail++; }
  }
  pinLog(`<br><strong>✓ Terminé : ${ok} importée${ok>1?'s':''}, ${fail} échec${fail>1?'s':''}.</strong>`);
  renderImages(); renderPinGrid(loadedPins);
  btn.disabled = false;
});

// ── IMPORT ÉPINGLES INDIVIDUELLES ──
document.getElementById('btn-pin-import-urls').addEventListener('click', async () => {
  const raw = document.getElementById('pin-urls-input').value.trim();
  if (!raw) { toast('Entrez au moins une URL d\'épingle.', 'error'); return; }
  const btn = document.getElementById('btn-pin-import-urls');
  btn.disabled = true;

  // Extraire les URLs uniques valides
  const urls = [...new Set(
    raw.split(/[\n,\s]+/).map(s => s.trim())
       .filter(s => s.match(/pinterest\.[^/]+\/pin\/\d+/))
  )];
  if (!urls.length) { toast('Aucune URL d\'épingle valide trouvée.', 'error'); btn.disabled=false; return; }

  pinLog('', true);
  pinLog(`<strong>${urls.length} épingle${urls.length>1?'s':''} à traiter…</strong>`);
  let ok = 0, fail = 0, skip = 0;

  for (let i = 0; i < urls.length; i++) {
    const pinUrl = urls[i];
    const pinId  = extractPinId(pinUrl);
    pinLog(`<span style="color:var(--text3);">(${i+1}/${urls.length})</span> ${esc(pinUrl)}…`);

    if (isPinImported(pinUrl, pinId)) {
      pinLog(`&nbsp;&nbsp;<span style="color:var(--text3);">◌ Déjà importée</span>`); skip++; continue;
    }
    try {
      const imgUrl = await fetchPinImageUrl(pinUrl);
      const pin = { pinId: pinId || ('pin_'+i), pinUrl, imgUrl, description: '' };
      const s = await importSinglePin(pin, null);
      if (s) { pinLog(`&nbsp;&nbsp;<span style="color:var(--success);">✦ Importée</span>`); ok++; }
      else   { pinLog(`&nbsp;&nbsp;<span style="color:var(--danger);">✕ Téléchargement échoué</span>`); fail++; }
    } catch(e) {
      pinLog(`&nbsp;&nbsp;<span style="color:var(--danger);">✕ ${esc(e.message)}</span>`); fail++;
    }
  }
  pinLog(`<br><strong>✓ Terminé : ${ok} importée${ok>1?'s':''}, ${skip} déjà présente${skip>1?'s':''}, ${fail} échec${fail>1?'s':''}.</strong>`);
  renderImages();
  btn.disabled = false;
});

// Récupère l'URL d'image via la balise og:image de la page d'épingle
async function fetchPinImageUrl(pinUrl) {
  const proxy = 'https://corsproxy.io/?' + encodeURIComponent(pinUrl);
  const resp = await fetch(proxy, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' depuis Pinterest');
  const html = await resp.text();
  const m = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
         || html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m || !m[1]) throw new Error('Image introuvable dans la page de l\'épingle');
  return m[1].replace(/\/\d+x\//, '/736x/').replace(/\/\d+x\//, '/736x/');
}
