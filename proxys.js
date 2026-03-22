// ── PROXYS ──
let proxySort = 'chrono', proxySearch = '';
let proxyTagFilterMap = new Map();
let editingProxyId = null, selectedPrenomForProxy = null;
// Stack de modaux proxy ouverts (pour éviter la surcharge)
const MAX_PROXY_STACK = 3;
let proxyModalStack = [];

// ── FILTRES TAGS PROXYS ──
function renderProxyTagFilters() {
  const row  = document.getElementById('proxy-tag-filter-row');
  const cont = document.getElementById('proxy-tag-filters');
  if (!row || !cont) return;
  if (tags.length===0) { row.style.display='none'; return; }
  row.style.display='flex';
  const noTagState = proxyTagFilterMap.get('__notag__') || 0;
  const noTagStyle = noTagState === 1
    ? 'background:rgba(107,95,128,0.2);border:1px solid rgba(107,95,128,0.6);color:var(--text2);'
    : 'background:transparent;border:1px solid var(--border2);color:var(--text3);';
  cont.innerHTML =
    `<span class="tag-pill" data-proxy-filter-tag="__notag__" style="${noTagStyle}cursor:pointer;">◌ Sans tags</span>` +
    tagsSorted().map(t => {
      const c     = getTagColor(t.color);
      const state = proxyTagFilterMap.get(t.id) || 0;
      let style;
      if      (state ===  1) style = `background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
      else if (state === -1) style = `background:rgba(232,122,122,0.15);border:1px solid rgba(232,122,122,0.45);color:#e87a7a;text-decoration:line-through;`;
      else                   style = `background:transparent;border:1px solid var(--border2);color:var(--text3);`;
      return `<span class="tag-pill" data-proxy-filter-tag="${t.id}" style="${style}cursor:pointer;">${esc(t.name)}</span>`;
    }).join('');
  cont.querySelectorAll('[data-proxy-filter-tag]').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.proxyFilterTag;
      if (id === '__notag__') {
        const s = proxyTagFilterMap.get('__notag__') || 0;
        s === 0 ? proxyTagFilterMap.set('__notag__', 1) : proxyTagFilterMap.delete('__notag__');
      } else {
        const s = proxyTagFilterMap.get(id) || 0;
        if      (s ===  0) proxyTagFilterMap.set(id,  1);
        else if (s ===  1) proxyTagFilterMap.set(id, -1);
        else               proxyTagFilterMap.delete(id);
      }
      renderProxyTagFilters(); renderProxys();
    });
  });
}

// ── BANNIÈRE SANS PROXY ──
function renderNoProxyBanner() {
  const sans   = prenoms.filter(p => !proxys.find(px => px.prenomId===p.id));
  const banner = document.getElementById('no-proxy-banner');
  if (sans.length===0) { banner.style.display='none'; return; }
  banner.style.display='';
  document.getElementById('no-proxy-count-label').textContent = `${sans.length} prénom${sans.length>1?'s':''} sans proxy`;
  const grid = document.getElementById('no-proxy-grid');
  grid.innerHTML = sans.map(p =>
    `<div class="no-proxy-chip"><span>${esc(p.name)}</span><button data-quick-proxy="${p.id}">+ Proxy</button></div>`
  ).join('');
  grid.querySelectorAll('[data-quick-proxy]').forEach(btn => {
    btn.addEventListener('click', () => { const p=prenoms.find(x=>x.id===btn.dataset.quickProxy); if(p) openProxyModal(null,p); });
  });
}

let noProxyListOpen = false;
document.getElementById('btn-toggle-no-proxy').addEventListener('click', () => {
  noProxyListOpen = !noProxyListOpen;
  document.getElementById('no-proxy-list').style.display = noProxyListOpen ? '' : 'none';
  document.getElementById('btn-toggle-no-proxy').textContent = noProxyListOpen ? 'Masquer' : 'Afficher';
});

// ── PANNEAU LATÉRAL ──
function renderProxySideList() {
  const container = document.getElementById('proxy-side-list');
  if (!container) return;
  // Récupérer recherche + filtres du panneau
  const q        = (document.getElementById('proxy-side-search').value||'').trim().toLowerCase();
  const tagFilts = Array.from(document.querySelectorAll('#proxy-side-tag-filters .side-tag-pill.active-pill')).map(el=>el.dataset.sideTag);
  const sort     = (document.querySelector('#proxy-side-sort-btns .side-sort.active')||{}).dataset.sideSort || 'alpha';

  // Grouper proxys par prénom
  const groups = {};
  proxys.forEach(px => { if(!groups[px.prenomId]) groups[px.prenomId]=[]; groups[px.prenomId].push(px); });

  let items = prenoms.filter(p => groups[p.id]);
  // Filtre texte
  if (q) items = items.filter(p =>
    p.name.toLowerCase().includes(q) ||
    groups[p.id].some(px=>(px.prefix||'').toLowerCase().includes(q)||(px.suffix||'').toLowerCase().includes(q))
  );
  // Filtre tags
  if (tagFilts.length>0) items = items.filter(p => tagFilts.every(tid=>(p.tags||[]).includes(tid)));
  // Tri
  if (sort==='alpha') items.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  else items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  if (!items.length) { container.innerHTML='<div style="font-size:12px;color:var(--text3);padding:6px;">Aucun résultat</div>'; return; }
  container.innerHTML = items.map(p => {
    const pxList  = groups[p.id]||[];
    const valsHtml = pxList.map(px=>`<span style="font-size:11px;color:var(--accent3);background:rgba(155,111,181,.12);border:1px solid rgba(155,111,181,.25);border-radius:10px;padding:2px 7px;">${esc((px.prefix||'')+'text'+(px.suffix||''))}</span>`).join(' ');
    const pTags   = (p.tags||[]).map(tid=>tags.find(t=>t.id===tid)).filter(Boolean);
    const tagsH   = pTags.map(t=>{ const c=getTagColor(t.color); return `<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:${c.bg};color:${c.text};border:1px solid ${c.border};">${esc(t.name)}</span>`; }).join(' ');
    return `<div style="background:var(--bg2);border-radius:8px;padding:8px 10px;">
      <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:15px;color:var(--text);font-weight:600;">${esc(p.name)}</div>
        ${tagsH}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">${valsHtml}</div>
    </div>`;
  }).join('');
}

// Construire les contrôles du panneau latéral (appelé à l'ouverture du modal)
function buildProxySidePanelControls() {
  // Tags filter
  const tagFilterEl = document.getElementById('proxy-side-tag-filters');
  tagFilterEl.innerHTML = tagsSorted().map(t => {
    const c = getTagColor(t.color);
    return `<button class="side-tag-pill" data-side-tag="${t.id}" style="font-size:11px;padding:3px 8px;border-radius:12px;background:transparent;border:1px solid ${c.border};color:${c.text};cursor:pointer;font-family:inherit;">${esc(t.name)}</button>`;
  }).join('');
  tagFilterEl.querySelectorAll('.side-tag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active-pill');
      const c = getTagColor(tags.find(t=>t.id===btn.dataset.sideTag)?.color||'lavande');
      btn.style.background = btn.classList.contains('active-pill') ? c.bg : 'transparent';
      renderProxySideList();
    });
  });
  // Sort buttons
  const sortEl = document.getElementById('proxy-side-sort-btns');
  sortEl.querySelectorAll('.side-sort').forEach(btn => {
    btn.addEventListener('click', () => {
      sortEl.querySelectorAll('.side-sort').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProxySideList();
    });
  });
}

document.getElementById('proxy-side-search').addEventListener('input', renderProxySideList);

// ── APERÇU + CONFLIT ──
function updateProxyPreview() {
  const prefix = document.getElementById('proxy-prefix-input').value;
  const suffix = document.getElementById('proxy-suffix-input').value;
  document.getElementById('proxy-preview-prefix').textContent = prefix;
  document.getElementById('proxy-preview-name').textContent   = selectedPrenomForProxy ? selectedPrenomForProxy.name : 'Prénom';
  document.getElementById('proxy-preview-suffix').textContent = suffix;
  const conflict = document.getElementById('proxy-conflict-info');
  conflict.style.display = 'none';
  if (prefix || suffix) {
    const dupPx = proxys.find(px => {
      if (editingProxyId && px.id===editingProxyId) return false;
      return px.prefix===prefix && (px.suffix||'')===(suffix||'');
    });
    if (dupPx) {
      const dupPrenom = prenoms.find(p=>p.id===dupPx.prenomId);
      document.getElementById('proxy-conflict-prenom-name').textContent = dupPrenom ? dupPrenom.name : '?';
      document.getElementById('proxy-conflict-proxy-val').textContent   = (dupPx.prefix||'')+'text'+(dupPx.suffix||'');
      conflict.style.display = '';
      document.getElementById('btn-proxy-edit-existing').onclick = () => {
        // Fermer ce modal et ouvrir le resolver de conflit
        const currentPrefix = document.getElementById('proxy-prefix-input').value;
        const currentSuffix = document.getElementById('proxy-suffix-input').value;
        const conflictKey = (currentPrefix||'') + '|' + (currentSuffix||'');
        closeProxyModal();
        setTimeout(() => openConflictResolver(conflictKey), 100);
      };
    }
  }
}

document.getElementById('proxy-prefix-input').addEventListener('input', updateProxyPreview);
document.getElementById('proxy-suffix-input').addEventListener('input', updateProxyPreview);

// ── DROPDOWN PRÉNOM ──
document.getElementById('proxy-prenom-input').addEventListener('input', function() {
  const q  = this.value.trim();
  const dd = document.getElementById('proxy-prenom-dropdown');
  if (!q) { dd.style.display='none'; return; }
  const ql = q.toLowerCase();
  const matches = prenoms
    .filter(p => p.name.toLowerCase().includes(ql))
    .sort((a, b) => {
      const al = a.name.toLowerCase(), bl = b.name.toLowerCase();
      // Exact en premier, puis début de mot, puis contient
      if (al === ql && bl !== ql) return -1;
      if (bl === ql && al !== ql) return  1;
      if (al.startsWith(ql) && !bl.startsWith(ql)) return -1;
      if (bl.startsWith(ql) && !al.startsWith(ql)) return  1;
      return al.localeCompare(bl, 'fr');
    })
    .slice(0, 12);
  const exact   = prenoms.find(p=>p.name.toLowerCase()===q.toLowerCase());
  dd.style.display='';
  dd.innerHTML = matches.map(p => {
    const cnt = proxys.filter(px=>px.prenomId===p.id).length;
    return `<div class="prenom-dropdown-item" data-pick="${p.id}"><span>${esc(p.name)}</span>${cnt>0?`<span class="already-has">${cnt} proxy${cnt>1?'s':''}</span>`:''}</div>`;
  }).join('') + (!exact ? `<div class="prenom-dropdown-item" data-proxy-create="${esc(q)}" style="color:var(--accent2);border-top:1px solid var(--border2);"><span>✦ Créer "${esc(q)}"</span></div>` : '');
  dd.querySelectorAll('[data-pick]').forEach(item => {
    item.addEventListener('click', () => selectPrenomForProxy(prenoms.find(p=>p.id===item.dataset.pick)));
  });
  dd.querySelectorAll('[data-proxy-create]').forEach(item => {
    item.addEventListener('click', async () => {
      const name = item.dataset.proxyCreate;
      const newP = { id:uid(), name, tags:[], notes:'', hasImage:false, imageId:null, createdAt:Date.now() };
      await dbPut('prenoms', newP);
      prenoms.push(newP);
      renderPrenoms(); renderNoProxyBanner(); renderProxySideList(); updateStats();
      selectPrenomForProxy(newP);
      toast(`Prénom "${name}" créé.`, 'success');
    });
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('#proxy-prenom-input') && !e.target.closest('#proxy-prenom-dropdown'))
    document.getElementById('proxy-prenom-dropdown').style.display='none';
});

function selectPrenomForProxy(prenom) {
  selectedPrenomForProxy = prenom;
  document.getElementById('proxy-prenom-input').value = '';
  document.getElementById('proxy-prenom-dropdown').style.display='none';
  const sel = document.getElementById('proxy-prenom-selected');
  sel.style.display='inline-flex';
  sel.innerHTML = `<span>${esc(prenom.name)}</span><span class="deselect" id="proxy-deselect">✕</span>`;
  document.getElementById('proxy-deselect').addEventListener('click', () => {
    selectedPrenomForProxy=null; sel.style.display='none'; updateProxyPreview();
  });
  updateProxyPreview();
}

// ── MULTI-PROXY INPUT ──
// Les lignes du formulaire multi-proxy sont gérées dynamiquement
function getProxyRows() {
  // Scoper au modal de base uniquement (pas les clones stackés)
  const container = document.getElementById('proxy-rows-container');
  return Array.from(container.querySelectorAll('.proxy-row-entry')).map(row => ({
    prefix: row.querySelector('.proxy-row-prefix').value,
    suffix: row.querySelector('.proxy-row-suffix').value,
  })).filter(r => r.prefix.trim() || r.suffix.trim());
}

function renderProxyRows() {
  const container = document.getElementById('proxy-rows-container');
  // Garder au moins une ligne
  const rows = container.querySelectorAll('.proxy-row-entry');
  if (rows.length===0) addProxyRow();
}

function addProxyRow(prefix='', suffix='') {
  const container = document.getElementById('proxy-rows-container');
  const idx = container.querySelectorAll('.proxy-row-entry').length;
  const div = document.createElement('div');
  div.className = 'proxy-row-entry';
  div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML = `
    <input type="text" class="input proxy-row-prefix" placeholder="Préfixe" value="${esc(prefix)}" style="flex:1;" />
    <input type="text" class="input proxy-row-suffix" placeholder="Suffixe" value="${esc(suffix)}" style="flex:1;" />
    <button type="button" class="btn btn-ghost btn-sm btn-icon proxy-row-del" title="Supprimer cette ligne">✕</button>
  `;
  div.querySelector('.proxy-row-del').addEventListener('click', () => {
    const rows = container.querySelectorAll('.proxy-row-entry');
    if (rows.length>1) div.remove(); else { div.querySelector('.proxy-row-prefix').value=''; div.querySelector('.proxy-row-suffix').value=''; }
    updateProxyPreviewFromFirst();
  });
  // Mettre à jour l'aperçu depuis la première ligne
  div.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateProxyPreviewFromFirst));
  container.appendChild(div);
}

function updateProxyPreviewFromFirst() {
  const first = document.querySelector('.proxy-row-entry');
  if (!first) return;
  const prefix = first.querySelector('.proxy-row-prefix').value;
  const suffix = first.querySelector('.proxy-row-suffix').value;
  // Sync avec les inputs cachés pour la logique de conflit
  document.getElementById('proxy-prefix-input').value = prefix;
  document.getElementById('proxy-suffix-input').value = suffix;
  updateProxyPreview();
}

document.getElementById('btn-add-proxy-row').addEventListener('click', () => addProxyRow());

// ── OUVERTURE/FERMETURE MODAL ──
function openProxyModal(proxy, preselected, stacked=false) {
  proxy = proxy||null; preselected = preselected||null;

  if (stacked) {
    // Créer un nouveau modal empilé (cloné)
    const existingBase = document.getElementById('modal-proxy');
    const clone = existingBase.cloneNode(true);
    const newId = 'modal-proxy-stack-' + Date.now();
    clone.id = newId;
    // Calculer le z-index max de toutes les modals ouvertes pour s'assurer d'être au-dessus
    const maxZ = Math.max(...Array.from(document.querySelectorAll('.modal-overlay.open, .modal-overlay[style*="display: flex"]'))
      .map(el => parseInt(el.style.zIndex||getComputedStyle(el).zIndex||100)), 100);
    clone.style.zIndex = maxZ + 50 + proxyModalStack.length * 10;
    // Décaler légèrement pour effet "empilé"
    clone.querySelector('.modal').style.transform = `translate(${proxyModalStack.length*16}px, ${proxyModalStack.length*16}px)`;
    document.body.appendChild(clone);
    proxyModalStack.push(newId);
    // Fermeture du clone
    clone.querySelector('.modal-close').addEventListener('click', () => closeStackedProxyModal(newId));
    clone.querySelector('[id$="-cancel"]') && clone.querySelector('[id$="-cancel"]').addEventListener('click', () => closeStackedProxyModal(newId));
    // Init du clone
    _initProxyModal(clone, proxy, preselected, newId);
    clone.classList.add('open');
    return;
  }

  editingProxyId = proxy ? proxy.id : null;
  document.getElementById('modal-proxy-title').textContent = proxy ? 'Modifier le proxy' : 'Nouveau proxy';
  // Reset champs
  document.getElementById('proxy-prenom-input').value='';
  document.getElementById('proxy-prenom-dropdown').style.display='none';
  document.getElementById('proxy-conflict-info').style.display='none';
  document.getElementById('proxy-prenom-selected').style.display='none';
  selectedPrenomForProxy=null;
  // Reset lignes multi-proxy
  const container = document.getElementById('proxy-rows-container');
  container.innerHTML='';
  if (proxy) {
    addProxyRow(proxy.prefix||'', proxy.suffix||'');
    const p = prenoms.find(x=>x.id===proxy.prenomId);
    if (p) selectPrenomForProxy(p);
  } else {
    addProxyRow();
    if (preselected) selectPrenomForProxy(preselected);
  }
  updateProxyPreviewFromFirst();
  buildProxySidePanelControls();
  renderProxySideList();
  document.getElementById('modal-proxy').classList.add('open');
  setTimeout(() => document.querySelector('.proxy-row-prefix') && document.querySelector('.proxy-row-prefix').focus(), 50);
}

function _initProxyModal(modal, proxy, preselected, modalId) {
  // Pour le modal empilé : remplir les valeurs
  const prefixInp = modal.querySelector('.proxy-row-prefix');
  const suffixInp = modal.querySelector('.proxy-row-suffix');
  if (proxy) { if(prefixInp) prefixInp.value=proxy.prefix||''; if(suffixInp) suffixInp.value=proxy.suffix||''; }
  // Save button
  const saveBtn = modal.querySelector('[id$="-save"]');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const prefix = prefixInp ? prefixInp.value : '';
      const suffix = suffixInp ? suffixInp.value : '';
      if (!prefix.trim()&&!suffix.trim()) { toast('Préfixe ou suffixe requis.','error'); return; }
      if (proxy) { proxy.prefix=prefix; proxy.suffix=suffix; await dbPut('proxys',proxy); toast('Proxy modifié.','success'); logHistory('Proxy modifié', 'proxy'); }
      closeStackedProxyModal(modalId);
      renderProxys(); renderNoProxyBanner(); renderPrenoms(); renderProxySideList(); updateStats();
      // Rafraîchir l'aperçu dans le modal de base
      updateProxyPreviewFromFirst();
    });
  }
}

function closeStackedProxyModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  proxyModalStack = proxyModalStack.filter(x=>x!==id);
}

function closeProxyModal() {
  document.getElementById('modal-proxy').classList.remove('open');
  // Fermer aussi les empilés
  proxyModalStack.forEach(id => { const el=document.getElementById(id); if(el) el.remove(); });
  proxyModalStack = [];
  editingProxyId=null; selectedPrenomForProxy=null;
}

async function saveProxy() {
  if (!selectedPrenomForProxy) { toast('Veuillez sélectionner un prénom.','error'); return; }
  const rows = getProxyRows();
  if (rows.length===0) { toast('Au moins un proxy (préfixe ou suffixe) est requis.','error'); return; }
  // Vérif doublons
  for (const row of rows) {
    const dup = proxys.find(px => {
      if (editingProxyId && px.id===editingProxyId) return false;
      return px.prefix===row.prefix && (px.suffix||'')===(row.suffix||'');
    });
    if (dup) { toast('Un proxy est déjà utilisé — voir le conflit.','error'); return; }
  }
  if (editingProxyId && rows.length===1) {
    // Mode édition d'un proxy existant (une seule ligne)
    const px = proxys.find(x=>x.id===editingProxyId);
    px.prefix=rows[0].prefix; px.suffix=rows[0].suffix; px.prenomId=selectedPrenomForProxy.id;
    await dbPut('proxys',px);
    toast('Proxy modifié.','success');
  } else {
    // Créer tous les proxys
    for (const row of rows) {
      const px = { id:uid(), prenomId:selectedPrenomForProxy.id, prefix:row.prefix, suffix:row.suffix, createdAt:Date.now() };
      await dbPut('proxys',px);
      proxys.push(px);
    }
    toast(`${rows.length} proxy${rows.length>1?'s':''} créé${rows.length>1?'s':''} pour "${selectedPrenomForProxy.name}".`,'success'); logHistory(`${rows.length} proxy créé(s) pour ${selectedPrenomForProxy.name}`, 'proxy');
  }
  closeProxyModal();
  renderProxys(); renderNoProxyBanner(); renderPrenoms(); renderProxySideList(); updateStats();
}

document.getElementById('modal-proxy-close').addEventListener('click',  closeProxyModal);
document.getElementById('modal-proxy-cancel').addEventListener('click', closeProxyModal);

// Bouton "Voir les prénoms avec proxy" (mobile)
document.getElementById('btn-show-proxy-side').addEventListener('click', () => {
  // Remplir la liste du modal side avec les mêmes données que le panneau latéral
  const search = '';
  const list2  = document.getElementById('proxy-side-list2');
  renderProxySideList2(search);
  document.getElementById('modal-proxy-side').style.display = 'flex';
  document.getElementById('proxy-side-search2').value = '';
  document.getElementById('proxy-side-search2').focus();
});

document.getElementById('modal-proxy-side-close').addEventListener('click', () => {
  document.getElementById('modal-proxy-side').style.display = 'none';
});

document.getElementById('proxy-side-search2').addEventListener('input', function() {
  renderProxySideList2(this.value.trim());
});

function renderProxySideList2(search) {
  const list2 = document.getElementById('proxy-side-list2');
  // Réutiliser les mêmes données que renderProxySideList()
  let items = prenoms.filter(p => proxys.some(px => px.prenomId === p.id));
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(p => {
      const pxList = proxys.filter(px => px.prenomId === p.id);
      return p.name.toLowerCase().includes(q) || pxList.some(px => (px.prefix+px.suffix).toLowerCase().includes(q));
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (!items.length) {
    list2.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px;">Aucun résultat</div>';
    return;
  }
  list2.innerHTML = items.map(p => {
    const pxList = proxys.filter(px => px.prenomId === p.id);
    const tagsHtml = (p.tags||[]).map(tid => { const t = tags.find(x=>x.id===tid); return t ? tagPillHtml(t) : ''; }).join('');
    return `<div class="proxy-row-entry" style="background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:10px 14px;cursor:pointer;" data-side2-pick="${p.id}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-family:'Cormorant Garamond',serif;font-size:17px;color:var(--text);">${esc(p.name)}</span>
        ${tagsHtml}
      </div>
      ${pxList.map(px => `<span class="preview-bubble" style="font-size:12px;padding:2px 8px;margin-right:4px;"><span style="color:var(--accent3);">${esc(px.prefix||'')}</span>text<span style="color:var(--accent3);">${esc(px.suffix||'')}</span></span>`).join('')}
    </div>`;
  }).join('');
  // Clic sur un prénom → le sélectionner dans le formulaire et fermer
  list2.querySelectorAll('[data-side2-pick]').forEach(el => {
    el.addEventListener('click', () => {
      const p = prenoms.find(x => x.id === el.dataset.side2Pick);
      if (p) {
        selectPrenomForProxy(p);
        document.getElementById('modal-proxy-side').style.display = 'none';
      }
    });
  });
}
document.getElementById('btn-add-proxy').addEventListener('click',      () => openProxyModal());
document.getElementById('modal-proxy-save').addEventListener('click',   saveProxy);

// ── RENDER PROXYS ──

function getFilteredProxys() {
  let list = proxys.slice();
  if (proxySearch) {
    const q = proxySearch.toLowerCase();
    list = list.filter(px => {
      const p = prenoms.find(x=>x.id===px.prenomId);
      return (p&&p.name.toLowerCase().includes(q))||(px.prefix||'').toLowerCase().includes(q)||(px.suffix||'').toLowerCase().includes(q);
    });
  }
  // Filtre tags 3 états : 1=inclure, -1=exclure
  proxyTagFilterMap.forEach((st, tid) => {
    if (tid === '__notag__') {
      if (st === 1) list = list.filter(px => { const p=prenoms.find(x=>x.id===px.prenomId); return !p||!(p.tags||[]).length; });
    } else {
      if (st===1)  list = list.filter(px => { const p=prenoms.find(x=>x.id===px.prenomId); return !!(p&&(p.tags||[]).includes(tid)); });
      if (st===-1) list = list.filter(px => { const p=prenoms.find(x=>x.id===px.prenomId); return  !(p&&(p.tags||[]).includes(tid)); });
    }
  });
  if (proxySort==='alpha-name') list.sort((a,b)=>{
    const na=prenoms.find(p=>p.id===a.prenomId); const nb=prenoms.find(p=>p.id===b.prenomId);
    return (na?na.name:'').localeCompare(nb?nb.name:'','fr');
  });
  else if (proxySort==='alpha-name-z') list.sort((a,b)=>{
    const na=prenoms.find(p=>p.id===a.prenomId); const nb=prenoms.find(p=>p.id===b.prenomId);
    return (nb?nb.name:'').localeCompare(na?na.name:'','fr');
  });
  else if (proxySort==='alpha-proxy') list.sort((a,b)=>(a.prefix||'').localeCompare(b.prefix||'','fr'));
  else if (proxySort==='chrono')      list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  else if (proxySort==='old')         list.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  return list;
}

function renderProxys() {
  const list  = getFilteredProxys();
  const tbody = document.getElementById('proxy-tbody');
  const empty = document.getElementById('proxy-empty');
  const table = document.getElementById('proxy-table');
  const lbl   = document.getElementById('proxys-count-label');
  const totalPrenoms = new Set(proxys.map(x=>x.prenomId)).size; const shownPrenoms = new Set(list.map(x=>x.prenomId)).size; lbl.textContent = `${proxys.length} proxy${proxys.length!==1?'s':''} configuré${proxys.length!==1?'s':''}${shownPrenoms!==totalPrenoms?' · '+shownPrenoms+' prénom'+(shownPrenoms!==1?'s':'')+' affiché'+(shownPrenoms!==1?'s':''):''}`;  
  if (list.length===0) { table.style.display='none'; empty.style.display=''; detectProxyConflicts(); return; }
  table.style.display=''; empty.style.display='none';
  detectProxyConflicts();

  // Grouper par prénom (une ligne par prénom)
  const prenomsDone = new Set();
  const rows = [];
  list.forEach(px => {
    if (!prenomsDone.has(px.prenomId)) {
      prenomsDone.add(px.prenomId);
      const p = prenoms.find(x=>x.id===px.prenomId);
      if (p) rows.push({ p, pxList: proxys.filter(x=>x.prenomId===p.id) });
    }
  });

  tbody.innerHTML = rows.map(({p, pxList}) => {
    // Une ligne par proxy individuel
    const proxyRows = pxList.map((px, idx) => {
      const proxyStr = (px.prefix||'') + 'texte' + (px.suffix||'');
      return `<tr class="proxy-sub-row${idx===0?' proxy-sub-row-first':''}">
        ${idx===0
          ? `<td class="proxy-name-cell" rowspan="${pxList.length}" style="vertical-align:top;padding-top:12px;">${esc(p.name)}
              <button class="btn btn-ghost btn-sm" data-add-proxy-for="${p.id}" style="display:block;margin-top:6px;padding:2px 8px;font-size:11px;">+ Proxy</button>
             </td>`
          : ''}
        <td>
          <div class="preview-bubble" style="display:inline-flex;">${esc(px.prefix||'')}<strong class="preview-name" style="white-space:pre;">${esc(p.name)}</strong>${esc(px.suffix||'')}</div>
          <span style="font-size:11px;color:var(--text3);margin-left:8px;">${esc((px.prefix||'')||'(aucun)')} · ${esc((px.suffix||'')||'(aucun)')}</span>
        </td>
        <td class="proxy-actions-cell"><div class="proxy-row-actions" style="gap:4px;">
          <button class="btn btn-ghost btn-sm btn-icon" data-proxy-edit="${px.id}" title="Modifier ce proxy">✎</button>
          <button class="btn btn-danger btn-sm btn-icon" data-proxy-del="${px.id}" title="Supprimer ce proxy">✕</button>
        </div></td>
      </tr>`;
    }).join('');
    return proxyRows;
  }).join('');

  tbody.querySelectorAll('[data-proxy-edit]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); const px=proxys.find(x=>x.id===el.dataset.proxyEdit); if(px) openProxyModal(px); });
  });
  tbody.querySelectorAll('[data-add-proxy-for]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); const p=prenoms.find(x=>x.id===btn.dataset.addProxyFor); if(p) openProxyModal(null,p); });
  });
  tbody.querySelectorAll('[data-proxy-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const px = proxys.find(x=>x.id===btn.dataset.proxyDel);
      if (!px) return;
      const p  = prenoms.find(x=>x.id===px.prenomId);
      const proxyStr = (px.prefix||'') + 'texte' + (px.suffix||'');
      openConfirm(`Supprimer le proxy "${proxyStr}" de "${p?p.name:'?'}" ?`, async () => {
        await dbDelete('proxys', px.id);
        proxys = proxys.filter(x=>x.id!==px.id);
        toast('Proxy supprimé.','success'); logHistory('Proxy supprimé', 'proxy');
        renderProxys(); renderNoProxyBanner(); renderPrenoms(); renderProxySideList(); updateStats();
      });
    });
  });
}

document.querySelectorAll('[data-proxy-sort]').forEach(btn => {
  btn.addEventListener('click', () => {
    proxySort = btn.dataset.proxySort;
    document.querySelectorAll('[data-proxy-sort]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderProxys();
  });
});
document.getElementById('proxy-search').addEventListener('input', e => { proxySearch=e.target.value.trim(); renderProxys(); });

// ── RÉSOLUTION DE CONFLITS ──
function openConflictResolver(conflictKey) {
  const [prefix, suffix] = conflictKey.split('|');
  // Trouver tous les proxys qui ont ce préfixe+suffixe
  const conflictPxs = proxys.filter(px => (px.prefix||'')=== prefix && (px.suffix||'')===suffix);
  if (conflictPxs.length < 2) { toast('Conflit déjà résolu.', 'info'); return; }

  // Créer le modal de résolution
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '300';
  overlay.id = 'modal-conflict-resolver';

  const proxyStr = (prefix||'') + 'texte' + (suffix||'');

  overlay.innerHTML = `
    <div class="modal" style="max-width:700px;">
      <div class="modal-header">
        <div class="modal-title">⚠ Conflit — <span style="color:var(--accent2);">${esc(proxyStr)}</span></div>
        <button class="modal-close" id="btn-conflict-close">✕</button>
      </div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:20px;">Ce proxy est utilisé par plusieurs prénoms. Modifie l'un d'eux pour résoudre le conflit.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
        ${conflictPxs.map((px, i) => {
          const p = prenoms.find(x=>x.id===px.prenomId);
          return `<div style="background:var(--bg3);border:1px solid rgba(232,122,122,0.3);border-radius:var(--radius);padding:16px;">
            <div style="font-size:16px;font-family:'Cormorant Garamond',serif;color:var(--accent2);margin-bottom:12px;">${esc(p?p.name:'?')}</div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
              <div style="flex:1;">
                <label style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;">Préfixe</label>
                <input class="input conflict-prefix-${i}" value="${esc(px.prefix||'')}" placeholder="Préfixe" style="margin-top:4px;"/>
              </div>
              <div style="flex:1;">
                <label style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;">Suffixe</label>
                <input class="input conflict-suffix-${i}" value="${esc(px.suffix||'')}" placeholder="Suffixe" style="margin-top:4px;"/>
              </div>
            </div>
            <div class="preview-bubble" id="conflict-preview-${i}">${esc(px.prefix||'')}<strong class="preview-name">${esc(p?p.name:'?')}</strong>${esc(px.suffix||'')}</div>
            <button class="btn btn-primary" style="margin-top:12px;width:100%;" data-conflict-save="${px.id}" data-conflict-idx="${i}">✓ Enregistrer</button>
          </div>`;
        }).join('')}
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" id="btn-conflict-cancel">Fermer</button></div>
    </div>`;

  document.body.appendChild(overlay);

  // Aperçu en temps réel
  conflictPxs.forEach((px, i) => {
    const p = prenoms.find(x=>x.id===px.prenomId);
    const prefixInp = overlay.querySelector(`.conflict-prefix-${i}`);
    const suffixInp = overlay.querySelector(`.conflict-suffix-${i}`);
    const preview   = overlay.querySelector(`#conflict-preview-${i}`);
    const updatePreview = () => {
      if (preview) preview.innerHTML = `${esc(prefixInp.value)}<strong class="preview-name">${esc(p?p.name:'?')}</strong>${esc(suffixInp.value)}`;
    };
    prefixInp?.addEventListener('input', updatePreview);
    suffixInp?.addEventListener('input', updatePreview);
  });

  // Sauvegarder
  overlay.querySelectorAll('[data-conflict-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pxId = btn.dataset.conflictSave;
      const idx  = parseInt(btn.dataset.conflictIdx);
      const px   = proxys.find(x=>x.id===pxId);
      if (!px) return;
      const newPrefix = (overlay.querySelector(`.conflict-prefix-${idx}`)?.value || '').trim();
      const newSuffix = (overlay.querySelector(`.conflict-suffix-${idx}`)?.value || '').trim();
      if (!newPrefix && !newSuffix) { toast('Préfixe ou suffixe requis.','error'); return; }
      // Vérifier nouveau conflit
      const dup = proxys.find(x => x.id!==pxId && (x.prefix||'')=== newPrefix && (x.suffix||'')===newSuffix);
      if (dup) { toast('Ce proxy est encore en conflit avec un autre prénom.','error'); return; }
      px.prefix = newPrefix; px.suffix = newSuffix;
      await dbPut('proxys', px);
      toast('Proxy modifié.', 'success');
      overlay.remove();
      renderProxys(); detectProxyConflicts();
    });
  });

  overlay.querySelector('#btn-conflict-close')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btn-conflict-cancel')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target===overlay) overlay.remove(); });
}

// ── SIMULATEUR DE PROXY ──
function runProxySimulator(input) {
  const result = document.getElementById('proxy-sim-result');
  if (!input || !input.trim()) { result.innerHTML = ''; return; }

  // Chercher quel proxy correspond au message
  // Algorithme : tester chaque proxy (prefix + suffix), longest-match en premier
  let bestMatch = null;
  let bestLen   = -1;

  for (const px of proxys) {
    const prefix = px.prefix || '';
    const suffix = px.suffix || '';
    // Le message doit commencer par prefix ET finir par suffix (si défini)
    const startsOk = prefix === '' || input.startsWith(prefix);
    const endsOk   = suffix === '' || input.endsWith(suffix);
    if (!startsOk || !endsOk) continue;
    // Au moins prefix ou suffix doit être non-vide (sinon ce serait un proxy vide)
    if (prefix === '' && suffix === '') continue;
    // Longueur totale du match = longueur prefix + suffix (pour privilégier les plus spécifiques)
    const matchLen = prefix.length + suffix.length;
    if (matchLen > bestLen) {
      bestLen   = matchLen;
      bestMatch = px;
    }
  }

  if (!bestMatch) {
    result.innerHTML = `<div class="sim-miss">Aucun proxy ne correspond à ce message.</div>`;
    return;
  }

  const p   = prenoms.find(x=>x.id===bestMatch.prenomId);
  const img = p && p.imageId ? images.find(x=>x.id===p.imageId) : null;

  const prefix   = bestMatch.prefix || '';
  const suffix   = bestMatch.suffix || '';
  // Extraire le contenu du message (sans le proxy)
  let msgContent = input;
  if (prefix && msgContent.startsWith(prefix)) msgContent = msgContent.slice(prefix.length);
  if (suffix && msgContent.endsWith(suffix))   msgContent = msgContent.slice(0, -suffix.length);
  msgContent = msgContent.trim();

  const avatarHtml = (img && img.dataUrl)
    ? `<img src="${img.dataUrl}" />`
    : `<span>✍</span>`;

  const proxyDisplay = `${esc(prefix)}<span style="color:var(--text3);">nom</span>${esc(suffix)}`;

  result.innerHTML = `<div class="sim-hit">
    <div class="sim-hit-avatar">${avatarHtml}</div>
    <div>
      <div class="sim-hit-name">${esc(p ? p.name : '?')}</div>
      <div class="sim-hit-proxy">${proxyDisplay}</div>
    </div>
    ${msgContent ? `<div class="sim-hit-message">${esc(msgContent)}</div>` : ''}
  </div>`;
}

document.getElementById('proxy-sim-input').addEventListener('input', e => {
  runProxySimulator(e.target.value);
});

// ── DÉTECTION DE CONFLITS ──
// Un conflit = deux prénoms différents ont un proxy identique (même prefix ET même suffix)
function detectProxyConflicts() {
  const seen    = {};  // clé "prefix|suffix" → [prenomId, ...]
  const wrap    = document.getElementById('proxy-conflicts-wrap');
  const listEl  = document.getElementById('proxy-conflicts-list');

  for (const px of proxys) {
    const key = (px.prefix||'') + '|' + (px.suffix||'');
    if (!seen[key]) seen[key] = [];
    if (!seen[key].includes(px.prenomId)) seen[key].push(px.prenomId);
  }

  const conflicts = Object.entries(seen).filter(([, ids]) => ids.length > 1);

  if (conflicts.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  listEl.innerHTML = conflicts.map(([key, ids]) => {
    const [prefix, suffix] = key.split('|');
    const names = ids.map(id => { const p=prenoms.find(x=>x.id===id); return p?p.name:'?'; }).join(', ');
    const proxyStr = `${prefix}nom${suffix}`;
    return `<span class="conflict-chip" style="cursor:pointer;" data-conflict-key="${esc(key)}" title="Cliquer pour résoudre">
      <span class="conflict-chip-proxy">${esc(proxyStr)}</span>
      <span class="conflict-chip-names">→ ${esc(names)}</span>
      <span style="font-size:10px;margin-left:4px;color:var(--accent2);">✎ Résoudre</span>
    </span>`;
  }).join('');
  // Listeners sur les chips de conflit
  listEl.querySelectorAll('[data-conflict-key]').forEach(chip => {
    chip.addEventListener('click', () => openConflictResolver(chip.dataset.conflictKey));
  });
}
