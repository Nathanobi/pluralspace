// ── MODAL PRÉNOM ──
let editingPrenomId = null;
let selectedTagsForPrenom = [];

function openPrenomModal(prenom) {
  prenom = prenom || null;
  editingPrenomId = prenom ? prenom.id : null;
  document.getElementById('modal-prenom-title').textContent = prenom ? 'Modifier le prénom' : 'Nouveau prénom';
  document.getElementById('prenom-input-name').value  = prenom ? prenom.name : '';
  document.getElementById('prenom-input-notes').value = prenom ? (prenom.notes||'') : '';
  selectedTagsForPrenom = prenom ? (prenom.tags||[]).slice() : [];
  renderPrenomTagChips();
  document.getElementById('modal-prenom').classList.add('open');
  setTimeout(() => document.getElementById('prenom-input-name').focus(), 50);
}

function renderPrenomTagChips() {
  const container = document.getElementById('prenom-tag-chips');
  if (tags.length===0) { container.innerHTML='<span style="font-size:12px;color:var(--text3);">Aucun tag disponible</span>'; return; }
  container.innerHTML = tagsSorted().map(t => {
    const c   = getTagColor(t.color);
    const sel = selectedTagsForPrenom.includes(t.id);
    return `<div class="chip${sel?' selected':''}" data-tag-id="${t.id}" style="${sel?`background:${c.bg};border-color:${c.border};color:${c.text};`:''}">${esc(t.name)}</div>`;
  }).join('');
  container.querySelectorAll('.chip[data-tag-id]').forEach(chip => {
    chip.addEventListener('click', () => {
      const id  = chip.dataset.tagId;
      const tag = tags.find(t => t.id===id);
      const c   = getTagColor(tag.color);
      const idx = selectedTagsForPrenom.indexOf(id);
      if (idx>=0) { selectedTagsForPrenom.splice(idx,1); chip.classList.remove('selected'); chip.removeAttribute('style'); }
      else        { selectedTagsForPrenom.push(id); chip.classList.add('selected'); chip.style.background=c.bg; chip.style.borderColor=c.border; chip.style.color=c.text; }
    });
  });
}

function closePrenomModal() {
  document.getElementById('modal-prenom').classList.remove('open');
  editingPrenomId = null;
}

async function savePrenom() {
  const raw = document.getElementById('prenom-input-name').value.trim();
  if (!raw) { toast('Le prénom est requis.', 'error'); return; }
  const notes = document.getElementById('prenom-input-notes').value.trim();

  // Mode édition : un seul prénom
  if (editingPrenomId) {
    const name = raw;
    const p = prenoms.find(p => p.id===editingPrenomId);
    if (!p) return;
    p.name=name; p.notes=notes; p.tags=selectedTagsForPrenom.slice();
    await dbPut('prenoms', p);
    await syncPrenomTags(p);
    toast(`Prénom "${name}" modifié.`, 'success'); logHistory(`Prénom "${name}" modifié`, 'prenom');
    closePrenomModal();
    renderPrenoms(); renderNoProxyBanner(); renderProxySideList(); updateStats();
    return;
  }

  // Mode création : détecter si multiple (virgules)
  const names = raw.split(',').map(n => n.trim()).filter(n => n.length > 0);
  if (names.length === 0) { toast('Aucun prénom valide.', 'error'); return; }

  const duplicates = names.filter(n => prenoms.find(p => p.name.toLowerCase()===n.toLowerCase()));
  const toCreate   = names.filter(n => !prenoms.find(p => p.name.toLowerCase()===n.toLowerCase()));

  if (toCreate.length === 0) {
    toast(`Tous ces prénoms existent déjà (${duplicates.join(', ')}).`, 'error'); return;
  }

  for (const name of toCreate) {
    const prenom = { id:uid(), name, tags:selectedTagsForPrenom.slice(), notes, hasImage:false, imageId:null, createdAt:Date.now() };
    await dbPut('prenoms', prenom);
    prenoms.push(prenom);
    await syncPrenomTags(prenom);
  }

  if (duplicates.length > 0) {
    toast(`${toCreate.length} créé(s). Ignorés (déjà existants) : ${duplicates.join(', ')}.`, 'success');
  } else {
    const label = toCreate.length === 1 ? `"${toCreate[0]}"` : `${toCreate.length} prénoms`;
    toast(`${label} enregistré(s).`, 'success');
  }
  logHistory(toCreate.length === 1 ? `Prénom "${toCreate[0]}" créé` : `${toCreate.length} prénoms créés`, 'prenom');

  closePrenomModal();
  renderPrenoms(); renderNoProxyBanner(); renderProxySideList(); updateStats();
}

document.getElementById('btn-add-prenom').addEventListener('click',    () => openPrenomModal());
document.getElementById('modal-prenom-close').addEventListener('click', closePrenomModal);
document.getElementById('modal-prenom-cancel').addEventListener('click', closePrenomModal);
document.getElementById('modal-prenom-save').addEventListener('click',  savePrenom);
document.getElementById('prenom-input-name').addEventListener('keydown', e => { if(e.key==='Enter' && !document.getElementById('prenom-input-name').value.includes(',')) savePrenom(); });
document.getElementById('btn-create-tag-inline').addEventListener('click', () => {
  openTagModal(newTag => { selectedTagsForPrenom.push(newTag.id); renderPrenomTagChips(); });
});

// Aperçu en temps réel des prénoms multiples
document.getElementById('prenom-input-name').addEventListener('input', function() {
  const val   = this.value;
  const preview = document.getElementById('prenom-multi-preview');
  const hint    = document.getElementById('prenom-multi-hint');
  if (!preview || !hint) return;
  if (!val.includes(',')) {
    preview.style.display = 'none';
    hint.style.display    = 'none';
    return;
  }
  const names = val.split(',').map(n => n.trim()).filter(n => n.length > 0);
  if (names.length < 2) { preview.style.display='none'; hint.style.display='none'; return; }
  preview.style.display = 'flex';
  hint.style.display    = '';
  const dupes = names.filter(n => prenoms.find(p => p.name.toLowerCase()===n.toLowerCase()));
  preview.innerHTML = names.map(n => {
    const isDupe = dupes.includes(n);
    return `<span class="badge ${isDupe ? 'badge-warn' : 'badge-success'}" style="font-size:11px;">${esc(n)}${isDupe?' ✗':''}</span>`;
  }).join('');
  const newCount = names.length - dupes.length;
  hint.textContent = `${newCount} nouveau(x) · ${dupes.length} déjà existant(s)`;
});
document.getElementById('btn-create-tag-inline').addEventListener('click', () => {
  openTagModal(newTag => { selectedTagsForPrenom.push(newTag.id); renderPrenomTagChips(); });
});

// ── ALPHA FILTER ──
let filterLetter = null;
function renderAlphaFilter() {
  const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  document.getElementById('alpha-filter').innerHTML = letters.map(l =>
    `<button class="alpha-btn${filterLetter===l?' active':''}" data-letter="${l}">${l}</button>`
  ).join('');
  document.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterLetter = filterLetter===btn.dataset.letter ? null : btn.dataset.letter;
      renderAlphaFilter(); renderPrenoms();
    });
  });
}

// ── TAG FILTERS (page prénoms) ──
// tagFilterMap : Map<tagId, 1=inclure | -1=masquer>
let tagFilterMap = new Map();

function renderTagFilters() {
  const row       = document.getElementById('tag-filter-row');
  const container = document.getElementById('tag-filters');
  if (tags.length===0) { row.style.display='none'; return; }
  row.style.display='flex';
  const noTagState = tagFilterMap.get('__notag__') || 0;
  const noTagStyle = noTagState === 1
    ? 'background:rgba(107,95,128,0.2);border:1px solid rgba(107,95,128,0.6);color:var(--text2);'
    : 'background:transparent;border:1px solid var(--border2);color:var(--text3);';
  container.innerHTML =
    `<span class="tag-pill" data-filter-tag="__notag__" style="${noTagStyle}cursor:pointer;">◌ Sans tags</span>` +
    tagsSorted().map(t => {
      const c     = getTagColor(t.color);
      const state = tagFilterMap.get(t.id) || 0;
      let style;
      if      (state ===  1) style = `background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
      else if (state === -1) style = `background:rgba(232,122,122,0.15);border:1px solid rgba(232,122,122,0.45);color:#e87a7a;text-decoration:line-through;`;
      else                   style = `background:transparent;border:1px solid var(--border2);color:var(--text3);`;
      const title = state===1 ? '1 clic de plus pour masquer' : state===-1 ? '1 clic de plus pour désactiver' : 'Clic = inclure · Clic×2 = masquer';
      return `<span class="tag-pill" data-filter-tag="${t.id}" title="${title}" style="${style}cursor:pointer;">${esc(t.name)}</span>`;
    }).join('');
  container.querySelectorAll('[data-filter-tag]').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.filterTag;
      if (id === '__notag__') {
        const s = tagFilterMap.get('__notag__') || 0;
        s === 0 ? tagFilterMap.set('__notag__', 1) : tagFilterMap.delete('__notag__');
      } else {
        const s = tagFilterMap.get(id) || 0;
        if      (s ===  0) tagFilterMap.set(id,  1);
        else if (s ===  1) tagFilterMap.set(id, -1);
        else               tagFilterMap.delete(id);
      }
      renderTagFilters(); renderPrenoms();
    });
  });
}

// ── RENDER PRÉNOMS ──
let currentSort = 'alpha';
let searchQuery = '';
let filterNoImage = false, filterNoProxy = false, filterNoProfil = false;

function getFilteredPrenoms() {
  let list = prenoms.slice();
  if (searchQuery) { const q=searchQuery.toLowerCase(); list=list.filter(p=>p.name.toLowerCase().includes(q)); }
  if (filterLetter) {
    if (filterLetter==='#') list=list.filter(p => !/^[a-zA-ZÀ-ÿ]/.test(p.name));
    else list=list.filter(p => p.name.toUpperCase().startsWith(filterLetter));
  }
  for (const [tid, state] of tagFilterMap) {
    if (tid === '__notag__') {
      if (state === 1) list = list.filter(p => !(p.tags||[]).length);
    } else {
      if (state ===  1) list = list.filter(p =>  (p.tags||[]).includes(tid));
      if (state === -1) list = list.filter(p => !(p.tags||[]).includes(tid));
    }
  }
  if (filterNoImage)         list=list.filter(p => !p.hasImage);
  if (filterNoProxy)         list=list.filter(p => !proxys.some(px=>px.prenomId===p.id));
  if (filterNoProfil)        list=list.filter(p => !profils.some(pr=>pr.prenomId===p.id));
  if      (currentSort==='alpha')   list.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  else if (currentSort==='alpha-z') list.sort((a,b)=>b.name.localeCompare(a.name,'fr'));
  else if (currentSort==='chrono')  list.sort((a,b)=>b.createdAt-a.createdAt);
  else if (currentSort==='old')     list.sort((a,b)=>a.createdAt-b.createdAt);
  return list;
}

// Boutons filtres rapides (indépendants du tri)
document.querySelectorAll('[data-prenom-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.prenomFilter;
    if (f==='noimage')  { filterNoImage  = !filterNoImage;  btn.classList.toggle('active', filterNoImage); }
    if (f==='noproxy')  { filterNoProxy  = !filterNoProxy;  btn.classList.toggle('active', filterNoProxy); }
    if (f==='noprofil') { filterNoProfil = !filterNoProfil; btn.classList.toggle('active', filterNoProfil); }
    renderPrenoms();
  });
});

function renderPrenoms() {
  const list  = getFilteredPrenoms();
  const grid  = document.getElementById('prenoms-grid');
  const empty = document.getElementById('prenoms-empty');
  const lbl   = document.getElementById('prenoms-count-label');
  const total = prenoms.length;
  lbl.textContent = `${total} prénom${total!==1?'s':''} enregistré${total!==1?'s':''}${list.length!==total?' · '+list.length+' affiché'+(list.length!==1?'s':''):''}`;
  if (list.length===0) { grid.style.display='none'; empty.style.display=''; return; }
  grid.style.display='grid'; empty.style.display='none';

  grid.innerHTML = list.map(p => {
    const pTags     = (p.tags||[]).map(tid=>tags.find(t=>t.id===tid)).filter(Boolean)
                       .sort((a,b) => a.name.localeCompare(b.name, 'fr', {sensitivity:'base'}));
    const pProxys   = proxys.filter(px=>px.prenomId===p.id);
    const hasProxy  = pProxys.length>0;
    const hasProfil = profils.some(pr=>pr.prenomId===p.id);
    const tagsHtml  = pTags.map(tagPillHtml).join('');

    return `<div class="prenom-card" data-id="${p.id}">
      <div class="prenom-card-header">
        <div class="prenom-name${p.hasImage?'':' no-image'}">${esc(p.name)}</div>
        <div class="prenom-actions">
          <button class="btn btn-ghost btn-sm btn-icon" data-edit="${p.id}" title="Modifier">✎</button>
          <button class="btn btn-danger btn-sm btn-icon" data-del="${p.id}" title="Supprimer">✕</button>
        </div>
      </div>
      ${pTags.length>0 ? `<div class="prenom-tags">${tagsHtml}</div>` : ''}
      <div class="prenom-status">
        ${p.hasImage
          ? `<span class="badge badge-success badge-btn" data-img-popover="${p.id}" title="Voir l'image">✓ Image</span>`
          : `<span class="badge badge-warn badge-redirect" data-goto="images">◌ Sans image</span>`}
        ${hasProxy
          ? `<span class="badge badge-success badge-btn" data-proxy-popover="${p.id}" title="Voir les proxys">✓ Proxy</span>`
          : `<span class="badge badge-warn badge-redirect" data-goto="proxys">◌ Sans proxy</span>`}
        ${hasProfil
          ? `<span class="badge badge-success badge-btn" data-profil-popover="${p.id}" title="Voir le profil">✓ Profil</span>`
          : `<span class="badge badge-warn badge-redirect" data-goto="profils">◌ Sans profil</span>`}
      </div>
      ${p.notes ? `<div class="prenom-notes-display">${esc(p.notes)}</div>` : ''}
      <div class="prenom-date">Ajouté le ${fmt(p.createdAt)}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); const p=prenoms.find(x=>x.id===btn.dataset.edit); if(p) openPrenomModal(p); });
  });
  grid.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const p = prenoms.find(x=>x.id===btn.dataset.del);
      if (!p) return;
      openConfirm(`Supprimer le prénom "${p.name}" ?`, async () => {
        await dbDelete('prenoms', p.id);
        prenoms = prenoms.filter(x=>x.id!==p.id);
        toast(`Prénom "${p.name}" supprimé.`, 'success'); logHistory(`Prénom "${p.name}" supprimé`, 'prenom');
        renderPrenoms(); renderNoProxyBanner(); renderProxySideList(); updateStats();
      });
    });
  });
  grid.querySelectorAll('[data-goto]').forEach(badge => {
    badge.addEventListener('click', e => { e.stopPropagation(); goToPage(badge.dataset.goto); });
  });
  // Image popover
  grid.querySelectorAll('[data-img-popover]').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const pr = prenoms.find(x=>x.id===badge.dataset.imgPopover);
      if (!pr||!pr.imageId) return;
      const img = images.find(x=>x.id===pr.imageId);
      if (!img||(!img.dataUrl&&!img.hostedUrl)) return;
      const pop = document.getElementById('img-popover');
      document.getElementById('img-popover-img').src  = img.dataUrl||img.hostedUrl;
      document.getElementById('img-popover-name').textContent = pr.name;
      const rect = badge.getBoundingClientRect();
      pop.style.left = '0'; pop.style.top = '0'; pop.classList.add('open');
      const pw = pop.offsetWidth || 240, ph = pop.offsetHeight || 80;
      let left = rect.left, top = rect.bottom + 8;
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      if (left < 8) left = 8;
      if (top + ph > window.innerHeight - 8) top = rect.top - ph - 8;
      if (top < 8) top = 8;
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      const close = ev => { if(!pop.contains(ev.target)&&ev.target!==badge){ pop.classList.remove('open'); document.removeEventListener('click',close); } };
      setTimeout(() => document.addEventListener('click',close), 10);
    });
  });
  // Proxy popover
  grid.querySelectorAll('[data-proxy-popover]').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const pr = prenoms.find(x=>x.id===badge.dataset.proxyPopover);
      if (!pr) return;
      const pxList = proxys.filter(x=>x.prenomId===pr.id);
      if (!pxList.length) return;
      const pop = document.getElementById('proxy-popover');
      document.getElementById('proxy-popover-content').textContent = pxList.map(px=>(px.prefix||'')+pr.name+(px.suffix||'')).join('  ·  ');
      const rect = badge.getBoundingClientRect();
      pop.style.left = '0'; pop.style.top = '0'; pop.classList.add('open');
      const pw = pop.offsetWidth || 240, ph = pop.offsetHeight || 80;
      let left = rect.left, top = rect.bottom + 8;
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      if (left < 8) left = 8;
      if (top + ph > window.innerHeight - 8) top = rect.top - ph - 8;
      if (top < 8) top = 8;
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      const close = ev => { if(!pop.contains(ev.target)&&ev.target!==badge){ pop.classList.remove('open'); document.removeEventListener('click',close); } };
      setTimeout(() => document.addEventListener('click',close), 10);
    });
  });
  // Profil badge → ouvrir directement le profil
  grid.querySelectorAll('[data-profil-popover]').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const pr   = prenoms.find(x=>x.id===badge.dataset.profilPopover);
      const prof = pr ? profils.find(x=>x.prenomId===pr.id) : null;
      if (!prof) return;
      goToPage('profils');
      // Laisser le temps à la page de s'afficher, puis ouvrir le modal
      setTimeout(() => openProfilModal(prof), 60);
    });
  });
}

document.querySelectorAll('.sort-btn[data-sort]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentSort = btn.dataset.sort;
    document.querySelectorAll('.sort-btn[data-sort]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPrenoms();
  });
});
document.getElementById('prenom-search').addEventListener('input', e => { searchQuery=e.target.value.trim(); renderPrenoms(); });

// Notes globales
let noteOpen = true;
document.getElementById('note-section-toggle').addEventListener('click', () => {
  noteOpen = !noteOpen;
  document.getElementById('note-section-body').style.display = noteOpen ? '' : 'none';
  document.getElementById('note-chevron').textContent = noteOpen ? '▼' : '▶';
});
let noteSaveTimer;
document.getElementById('global-notes-input').addEventListener('input', e => {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(async () => await dbPut('settings',{key:'globalNotes',value:e.target.value}), 600);
});
