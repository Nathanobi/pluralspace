// ── PAGE SYSTÈME ──

// Clé de stockage des infos système local
const SYS_KEY = 'ps-system-info';
const PK_LAST_PUSH_KEY = 'ps-pk-last-push';

function getSysInfo() {
  try { return JSON.parse(localStorage.getItem(SYS_KEY) || '{}'); } catch(e) { return {}; }
}
function setSysInfo(data) {
  const cur = getSysInfo();
  localStorage.setItem(SYS_KEY, JSON.stringify({ ...cur, ...data }));
}

// ── Charger les infos dans le formulaire ──
function loadSysForm() {
  const sys = getSysInfo();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('sys-name-input',     sys.name);
  set('sys-tag-input',      sys.tag);
  set('sys-desc-input',     sys.description);
  set('sys-pronouns-input', sys.pronouns);
}

// ── Afficher les infos temporelles ──
function renderSysTimeline() {
  const sys  = getSysInfo();
  const fmtDate = ts => ts && ts > 0 ? new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDay  = str => str ? new Date(str).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  set('sys-info-pkid',       sys.pkId || '—');
  set('sys-info-created',    fmtDay(sys.pkCreated));

  // Dernier envoi PK — depuis config.js (btn-export-pk-api) OU btn-sys-send-pk
  const lastPk = parseInt(localStorage.getItem(PK_LAST_PUSH_KEY) || '0');
  set('sys-info-lastpk', fmtDate(lastPk));

  // Dernière sync cloud — utiliser fbGetLastSync si disponible (firebase.js)
  let lastSync = 0;
  if (typeof fbGetLastSync === 'function') {
    lastSync = fbGetLastSync();
  } else {
    // Fallback : chercher dans tous les ps-last-sync-* du localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ps-last-sync-')) {
        const val = parseInt(localStorage.getItem(key) || '0');
        if (val > lastSync) lastSync = val;
      }
    }
  }
  set('sys-info-lastsync', fmtDate(lastSync));
  set('sys-info-lastchange', fmtDate(sys.lastChanged));
}

// ── Enregistrer les infos système localement ──
document.getElementById('btn-sys-save')?.addEventListener('click', async () => {
  const name     = document.getElementById('sys-name-input').value.trim();
  const tag      = document.getElementById('sys-tag-input').value.trim();
  const desc     = document.getElementById('sys-desc-input').value.trim();
  const pronouns = document.getElementById('sys-pronouns-input').value.trim();
  setSysInfo({ name, tag, description: desc, pronouns, lastChanged: Date.now() });
  // Persister dans IndexedDB aussi
  await dbPut('settings', { key: 'system-info', value: JSON.stringify({ name, tag, description: desc, pronouns }) });
  const status = document.getElementById('sys-save-status');
  if (status) { status.style.color = 'var(--success)'; status.textContent = '✓ Enregistré localement.'; setTimeout(() => status.textContent = '', 3000); }
  // Mettre à jour le bloc accueil
  const nameEl = document.getElementById('pk-sys-name');
  if (nameEl && name) nameEl.textContent = name;
  renderSysTimeline();
  toast('Informations système sauvegardées.', 'success');
});

// ── Envoyer sur PluralKit ──
document.getElementById('btn-sys-send-pk')?.addEventListener('click', async () => {
  const token = localStorage.getItem('ps-pk-token');
  if (!token) { toast('Token PluralKit requis.', 'error'); return; }
  const name     = document.getElementById('sys-name-input').value.trim();
  const tag      = document.getElementById('sys-tag-input').value.trim();
  const desc     = document.getElementById('sys-desc-input').value.trim();
  const pronouns = document.getElementById('sys-pronouns-input').value.trim();
  const status   = document.getElementById('sys-save-status');
  if (status) { status.style.color = 'var(--text3)'; status.textContent = '⟳ Envoi en cours…'; }
  try {
    const body = {};
    if (name)     body.name = name;
    if (tag)      body.tag  = tag;
    if (desc)     body.description = desc;
    if (pronouns) body.pronouns = pronouns;
    await fetch('https://api.pluralkit.me/v2/systems/@me', {
      method: 'PATCH',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    localStorage.setItem(PK_LAST_PUSH_KEY, Date.now().toString());
    setSysInfo({ name, tag, description: desc, pronouns, lastChanged: Date.now() });
    if (status) { status.style.color = 'var(--success)'; status.textContent = '✓ Envoyé sur PluralKit !'; setTimeout(() => status.textContent = '', 4000); }
    toast('Système mis à jour sur PluralKit ✓', 'success');
    renderSysTimeline();
  } catch(e) {
    if (status) { status.style.color = 'var(--danger)'; status.textContent = '✕ Erreur : ' + e.message; }
    toast('Erreur envoi PK : ' + e.message, 'error');
  }
});

// ── Sync depuis PluralKit ──
document.getElementById('btn-pk-sync-system')?.addEventListener('click', async () => {
  const token = localStorage.getItem('ps-pk-token');
  if (!token) { toast('Token PluralKit requis.', 'error'); return; }
  const btn = document.getElementById('btn-pk-sync-system');
  btn.disabled = true; btn.textContent = '⟳ Chargement…';
  try {
    const resp = await fetch('https://api.pluralkit.me/v2/systems/@me', { headers: { 'Authorization': token } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const sys = await resp.json();
    setSysInfo({
      name: sys.name, tag: sys.tag, description: sys.description,
      pronouns: sys.pronouns, pkId: sys.id,
      pkCreated: sys.created, lastChanged: Date.now()
    });
    loadSysForm();
    renderSysTimeline();
    // Mettre à jour le bloc accueil
    if (typeof fetchPkSystemInfo === 'function') fetchPkSystemInfo();
    toast('Informations système récupérées depuis PluralKit ✓', 'success');
  } catch(e) {
    toast('Erreur sync PK : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '⟡ Sync PluralKit';
  }
});

// ── RECHERCHE GLOBALE ──
let globalFilter = 'all';

document.querySelectorAll('[data-global-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    globalFilter = btn.dataset.globalFilter;
    document.querySelectorAll('[data-global-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    runGlobalSearch();
  });
});

document.getElementById('global-search-input')?.addEventListener('input', runGlobalSearch);

function runGlobalSearch() {
  const q       = (document.getElementById('global-search-input')?.value || '').trim().toLowerCase();
  const results = document.getElementById('global-search-results');
  const empty   = document.getElementById('global-search-empty');
  const list    = document.getElementById('global-search-list');
  const count   = document.getElementById('global-search-count');

  if (!q) { results.style.display = 'none'; empty.style.display = 'none'; return; }

  const items = [];
  const match = str => str && str.toLowerCase().includes(q);

  if (globalFilter === 'all' || globalFilter === 'prenoms') {
    prenoms.filter(p => match(p.name) || match(p.notes)).forEach(p => {
      items.push({ type: 'Prénom', icon: '★', name: p.name, sub: p.notes || '', goto: 'prenoms', id: p.id });
    });
  }
  if (globalFilter === 'all' || globalFilter === 'profils') {
    profils.filter(pr => {
      const p = prenoms.find(x => x.id === pr.prenomId);
      return match(pr.name) || match(pr.bio) || match(pr.pronouns) || match(p?.name);
    }).forEach(pr => {
      items.push({ type: 'Profil', icon: '◉', name: pr.name, sub: pr.pronouns || pr.bio?.slice(0,60) || '', goto: 'profils' });
    });
  }
  if (globalFilter === 'all' || globalFilter === 'proxys') {
    proxys.filter(px => {
      const p = prenoms.find(x => x.id === px.prenomId);
      return match(px.prefix) || match(px.suffix) || match(p?.name);
    }).forEach(px => {
      const p = prenoms.find(x => x.id === px.prenomId);
      items.push({ type: 'Proxy', icon: '⟡', name: p?.name || '?', sub: (px.prefix||'') + 'texte' + (px.suffix||''), goto: 'proxys' });
    });
  }
  if (globalFilter === 'all' || globalFilter === 'images') {
    images.filter(img => {
      const p = img.prenomId ? prenoms.find(x => x.id === img.prenomId) : null;
      return match(p?.name);
    }).forEach(img => {
      const p = img.prenomId ? prenoms.find(x => x.id === img.prenomId) : null;
      items.push({ type: 'Image', icon: '◈', name: p?.name || 'Sans prénom', sub: img.isCropped ? 'Recadrée' : '', goto: 'images' });
    });
  }
  if (globalFilter === 'all' || globalFilter === 'tags') {
    tags.filter(t => match(t.name)).forEach(t => {
      const n = prenoms.filter(p => (p.tags||[]).includes(t.id)).length;
      items.push({ type: 'Tag', icon: '◇', name: t.name, sub: n + ' prénom(s)', goto: 'tags' });
    });
  }

  if (items.length === 0) {
    results.style.display = 'none'; empty.style.display = '';
  } else {
    empty.style.display = 'none'; results.style.display = '';
    count.textContent = items.length + ' résultat(s)';
    list.innerHTML = items.slice(0, 50).map(it =>
      `<div class="global-result-item" data-goto="${it.goto}">
        <span class="global-result-type">${it.icon} ${it.type}</span>
        <div>
          <div class="global-result-name">${esc(it.name)}</div>
          ${it.sub ? `<div class="global-result-sub">${esc(it.sub)}</div>` : ''}
        </div>
      </div>`
    ).join('');
    list.querySelectorAll('[data-goto]').forEach(el => {
      el.addEventListener('click', () => goToPage(el.dataset.goto));
    });
  }
}

// ── VUE D'ENSEMBLE RÉTRACTABLE ──
document.querySelectorAll('.sys-collapse-header').forEach(header => {
  header.addEventListener('click', () => {
    const targetId = header.dataset.collapse;
    const body     = document.getElementById(targetId);
    const isOpen   = header.classList.contains('open');
    header.classList.toggle('open', !isOpen);
    body.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) renderCollapseBody(targetId);
  });
});

function renderCollapseBody(id) {
  const body = document.getElementById(id);
  if (!body) return;

  if (id === 'sys-col-prenoms') {
    body.innerHTML = prenoms.slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'))
      .map(p => `<span class="sys-overview-chip">★ ${esc(p.name)}</span>`).join('');
    const cnt = document.getElementById('sys-col-prenoms-count');
    if (cnt) cnt.textContent = prenoms.length;
  }
  if (id === 'sys-col-profils') {
    body.innerHTML = profils.slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'))
      .map(pr => `<span class="sys-overview-chip">◉ ${esc(pr.name)}</span>`).join('');
    const cnt = document.getElementById('sys-col-profils-count');
    if (cnt) cnt.textContent = profils.length;
  }
  if (id === 'sys-col-proxys') {
    const byPrenom = {};
    proxys.forEach(px => {
      const p = prenoms.find(x=>x.id===px.prenomId);
      const n = p?.name || '?';
      if (!byPrenom[n]) byPrenom[n] = [];
      byPrenom[n].push((px.prefix||'') + 'texte' + (px.suffix||''));
    });
    body.innerHTML = Object.entries(byPrenom).sort(([a],[b])=>a.localeCompare(b,'fr'))
      .map(([n,pxs]) => `<span class="sys-overview-chip">⟡ ${esc(n)} <span style="opacity:.6;font-size:10px;">(${pxs.join(', ')})</span></span>`).join('');
    const cnt = document.getElementById('sys-col-proxys-count');
    if (cnt) cnt.textContent = proxys.length;
  }
  if (id === 'sys-col-images') {
    body.innerHTML = images.map(img => {
      const p = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
      const thumb = img.dataUrl || img.hostedUrl || '';
      return `<span class="sys-overview-chip">${thumb ? `<img src="${thumb}" />` : '◈'} ${esc(p?.name||'Sans prénom')}</span>`;
    }).join('');
    const cnt = document.getElementById('sys-col-images-count');
    if (cnt) cnt.textContent = images.length;
  }
  if (id === 'sys-col-tags') {
    body.innerHTML = tags.slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'))
      .map(t => {
        const c = getTagColor(t.color);
        return `<span class="sys-overview-chip" style="background:${c.bg};border-color:${c.border};color:${c.text};">◇ ${esc(t.name)}</span>`;
      }).join('');
    const cnt = document.getElementById('sys-col-tags-count');
    if (cnt) cnt.textContent = tags.length;
  }
}

// Initialiser les compteurs de la vue d'ensemble (sans ouvrir les sections)
function initSysCollapseCounters() {
  const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
  setCount('sys-col-prenoms-count', prenoms.length);
  setCount('sys-col-profils-count', profils.length);
  setCount('sys-col-proxys-count',  proxys.length);
  setCount('sys-col-images-count',  images.length);
  setCount('sys-col-tags-count',    tags.length);
}

// Appelé quand on navigue vers la page Système
function initSystemePage() {
  loadSysForm();
  renderSysTimeline();
  initSysCollapseCounters();
}
