// ── MODAL TAG (nouveau) ──
let tagModalCallback = null;

// Synchronise picker + hex + preview dans un modal donné (par préfixe d'ID)
function syncTagColorUI(prefix, hex) {
  const picker  = document.getElementById(prefix + 'picker');
  const hexInp  = document.getElementById(prefix + 'hex');
  const preview = document.getElementById(prefix + 'preview');
  if (picker  && picker.value !== hex)                  picker.value = hex;
  if (hexInp  && document.activeElement !== hexInp)     hexInp.value = hex;
  if (preview) preview.style.background = hex;
}

// Retourne la couleur hex actuellement sélectionnée dans le modal création
function getTagModalColor() {
  // Priorité : hex input si valide, sinon chip sélectionné, sinon lavande
  const hexInp = document.getElementById('tag-color-hex');
  const hex = (hexInp && /^#[0-9a-fA-F]{6}$/.test(hexInp.value)) ? hexInp.value : null;
  if (hex) return hex;
  const chip = document.querySelector('#tag-color-chips .chip.selected');
  if (chip) {
    const c = TAG_COLORS.find(x => x.name === chip.dataset.color);
    return c ? c.text : '#c9a0dc';
  }
  return '#c9a0dc';
}

function openTagModal(cb) {
  tagModalCallback = cb;
  document.getElementById('tag-input-name').value = '';
  const initHex = '#c9a0dc';
  syncTagColorUI('tag-color-', initHex);

  const chips = document.getElementById('tag-color-chips');
  chips.innerHTML = TAG_COLORS.map((c, i) =>
    `<div class="chip${i===0?' selected':''}" data-color="${c.name}" style="background:${c.bg};border-color:${c.border};color:${c.text};">${c.name}</div>`
  ).join('');
  chips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      const c = TAG_COLORS.find(x => x.name === chip.dataset.color);
      if (c) syncTagColorUI('tag-color-', c.text);
    });
  });

  // Listeners picker / hex
  const picker = document.getElementById('tag-color-picker');
  const hexInp = document.getElementById('tag-color-hex');
  picker.oninput = () => { syncTagColorUI('tag-color-', picker.value); hexInp.value = picker.value; };
  hexInp.oninput = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value)) {
      picker.value = hexInp.value;
      document.getElementById('tag-color-preview').style.background = hexInp.value;
    }
  };

  document.getElementById('modal-tag').classList.add('open');
  setTimeout(() => document.getElementById('tag-input-name').focus(), 50);
}

async function saveTag() {
  const name = document.getElementById('tag-input-name').value.trim();
  if (!name) { toast('Le nom du tag est requis.', 'error'); return; }
  if (tags.find(t => t.name.toLowerCase()===name.toLowerCase())) { toast('Ce tag existe déjà.', 'error'); return; }
  // Stocker la couleur : nom prédéfini si chip sélectionnée, sinon hex
  const chip = document.querySelector('#tag-color-chips .chip.selected');
  const hexInp = document.getElementById('tag-color-hex');
  let color = 'lavande';
  if (chip) {
    color = chip.dataset.color;
    // Si hex input est différent de la couleur de ce chip, utiliser hex
    const chipHex = TAG_COLORS.find(x => x.name === color)?.text;
    if (hexInp && /^#[0-9a-fA-F]{6}$/.test(hexInp.value) && hexInp.value !== chipHex) {
      color = hexInp.value;
    }
  } else if (hexInp && /^#[0-9a-fA-F]{6}$/.test(hexInp.value)) {
    color = hexInp.value;
  }
  const tag = { id:uid(), name, color };
  await dbPut('tags', tag);
  tags.push(tag);
  const cb = tagModalCallback;
  document.getElementById('modal-tag').classList.remove('open');
  tagModalCallback = null;
  toast(`Tag "${name}" créé.`, 'success'); logHistory(`Tag "${name}" créé`, 'tag');
  renderTagFilters(); renderImgTagFilters(); renderProxyTagFilters(); renderProfilTagFilters(); renderTagsPrenomView(); updateStats();
  if (cb) cb(tag);
}

document.getElementById('modal-tag-close').addEventListener('click',  () => { document.getElementById('modal-tag').classList.remove('open'); tagModalCallback=null; });
document.getElementById('modal-tag-cancel').addEventListener('click', () => { document.getElementById('modal-tag').classList.remove('open'); tagModalCallback=null; });
document.getElementById('modal-tag-save').addEventListener('click', saveTag);
document.getElementById('tag-input-name').addEventListener('keydown', e => { if(e.key==='Enter') saveTag(); });

// ── MODAL TAG ÉDITION ──
let editingTagId = null;
function openTagEditModal(tag) {
  editingTagId = tag.id;
  document.getElementById('tag-edit-name').value = tag.name;

  // Couleur initiale : hex si custom, sinon texte du TAG_COLORS correspondant
  const named = TAG_COLORS.find(c => c.name === tag.color);
  const initHex = named ? named.text : (tag.color.startsWith('#') ? tag.color : '#c9a0dc');
  syncTagColorUI('tag-edit-color-', initHex);

  const grid = document.getElementById('tag-edit-colors');
  grid.innerHTML = TAG_COLORS.map(c =>
    `<button class="color-option${tag.color===c.name?' selected':''}" data-color="${c.name}" type="button"><div class="tag-color-dot" style="background:${c.text};"></div>${c.name}</button>`
  ).join('');
  grid.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      grid.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const c = TAG_COLORS.find(x => x.name === opt.dataset.color);
      if (c) syncTagColorUI('tag-edit-color-', c.text);
    });
  });

  const picker = document.getElementById('tag-edit-color-picker');
  const hexInp = document.getElementById('tag-edit-color-hex');
  picker.oninput = () => { syncTagColorUI('tag-edit-color-', picker.value); hexInp.value = picker.value; };
  hexInp.oninput = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInp.value)) {
      picker.value = hexInp.value;
      document.getElementById('tag-edit-color-preview').style.background = hexInp.value;
    }
  };

  document.getElementById('modal-tag-edit').classList.add('open');
  setTimeout(() => document.getElementById('tag-edit-name').focus(), 50);
}

async function saveTagEdit() {
  const name = document.getElementById('tag-edit-name').value.trim();
  if (!name) { toast('Le nom du tag est requis.', 'error'); return; }
  if (tags.find(t => t.id!==editingTagId && t.name.toLowerCase()===name.toLowerCase())) { toast('Un tag avec ce nom existe déjà.', 'error'); return; }

  const selectedOpt = document.querySelector('#tag-edit-colors .color-option.selected');
  const hexInp      = document.getElementById('tag-edit-color-hex');
  let color = 'lavande';
  if (selectedOpt) {
    color = selectedOpt.dataset.color;
    const chipHex = TAG_COLORS.find(x => x.name === color)?.text;
    if (hexInp && /^#[0-9a-fA-F]{6}$/.test(hexInp.value) && hexInp.value !== chipHex) {
      color = hexInp.value;
    }
  } else if (hexInp && /^#[0-9a-fA-F]{6}$/.test(hexInp.value)) {
    color = hexInp.value;
  }

  const tag = tags.find(t => t.id===editingTagId);
  if (!tag) return;
  tag.name = name; tag.color = color;
  await dbPut('tags', tag);
  document.getElementById('modal-tag-edit').classList.remove('open');
  editingTagId = null;
  toast(`Tag "${name}" modifié.`, 'success'); logHistory(`Tag "${name}" modifié`, 'tag');
  renderTagsPage(); renderTagFilters(); renderImgTagFilters(); renderProxyTagFilters(); renderProfilTagFilters(); renderPrenoms(); renderTagsPrenomView();
}

document.getElementById('modal-tag-edit-close').addEventListener('click',  () => { document.getElementById('modal-tag-edit').classList.remove('open'); editingTagId=null; });
document.getElementById('modal-tag-edit-cancel').addEventListener('click', () => { document.getElementById('modal-tag-edit').classList.remove('open'); editingTagId=null; });
document.getElementById('modal-tag-edit-save').addEventListener('click', saveTagEdit);
document.getElementById('tag-edit-name').addEventListener('keydown', e => { if(e.key==='Enter') saveTagEdit(); });

// ── TAGS PAGE (gérer) ──
function renderTagsPage() {
  const container = document.getElementById('tags-list-container');
  const empty     = document.getElementById('tags-list-empty');
  const lbl       = document.getElementById('tags-count-label');
  lbl.textContent = `${tags.length} tag${tags.length!==1?'s':''} défini${tags.length!==1?'s':''}`;
  if (tags.length===0) { container.innerHTML=''; container.style.display='none'; empty.style.display=''; return; }
  container.style.display=''; empty.style.display='none';
  const counts = {};
  prenoms.forEach(p => (p.tags||[]).forEach(tid => counts[tid]=(counts[tid]||0)+1));
  const sorted = tags.slice().sort((a,b) => a.name.localeCompare(b.name,'fr'));
  container.innerHTML = '<div class="tags-grid">' + sorted.map(tag => {
    const c = getTagColor(tag.color);
    const n = counts[tag.id] || 0;
    return `<div class="tag-manage-card">
      <div class="tag-manage-left"><div class="tag-color-dot" style="background:${c.text};"></div>
      <div><div class="tag-manage-name">${esc(tag.name)}</div><div class="tag-manage-count">${n} prénom${n!==1?'s':''}</div></div></div>
      <div class="tag-manage-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-tag-edit="${tag.id}" title="Modifier">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" data-tag-del="${tag.id}" title="Supprimer">✕</button>
      </div></div>`;
  }).join('') + '</div>';
  container.querySelectorAll('[data-tag-edit]').forEach(btn => {
    btn.addEventListener('click', () => { const t=tags.find(t=>t.id===btn.dataset.tagEdit); if(t) openTagEditModal(t); });
  });
  container.querySelectorAll('[data-tag-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = tags.find(t=>t.id===btn.dataset.tagDel);
      if (!tag) return;
      const n = counts[tag.id]||0;
      openConfirm((n>0?`Supprimer le tag "${tag.name}" ? ${n} prénom${n>1?'s':''} perdront ce tag.`:`Supprimer le tag "${tag.name}" ?`), async () => {
        for (const p of prenoms) {
          if ((p.tags||[]).includes(tag.id)) { p.tags=p.tags.filter(t=>t!==tag.id); await dbPut('prenoms',p); }
        }
        await dbDelete('tags', tag.id);
        tags = tags.filter(t => t.id!==tag.id);
        toast(`Tag "${tag.name}" supprimé.`, 'success'); logHistory(`Tag "${tag.name}" supprimé`, 'tag');
        renderTagsPage(); renderTagFilters(); renderImgTagFilters(); renderProxyTagFilters(); renderProfilTagFilters(); renderPrenoms(); updateStats();
        renderTagsPrenomView();
      });
    });
  });
}

document.getElementById('btn-add-tag-page').addEventListener('click', () => openTagModal(() => renderTagsPage()));

// ── TAGS PAGE (par prénoms) ──
let tagsPageView   = 'prenoms';
let tagsTagFilterMap = new Map(); // tagId → 1 inclure | -1 exclure | 'untagged' special
let tagsDispImage  = false, tagsDispProxy = false, tagsDispProfil = false;

function renderTagsPrenomView() {
  const filterArea = document.getElementById('tags-prenom-filter');
  const results    = document.getElementById('tags-prenom-results');

  // Filtres pills — même style que Prénoms/Images/Proxys : span.tag-pill
  const showUntagged = tagsTagFilterMap.get('untagged') || 0;
  const noTagStyle = showUntagged === 1
    ? 'background:rgba(107,95,128,0.2);border:1px solid rgba(107,95,128,0.6);color:var(--text2);'
    : 'background:transparent;border:1px solid var(--border2);color:var(--text3);';
  filterArea.innerHTML =
    `<span class="tag-pill" data-tpf="untagged" style="${noTagStyle}cursor:pointer;">◌ Sans tags</span>` +
    tagsSorted().map(t => {
      const c  = getTagColor(t.color);
      const st = tagsTagFilterMap.get(t.id) || 0;
      let style;
      if      (st ===  1) style = `background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
      else if (st === -1) style = `background:rgba(232,122,122,0.15);border:1px solid rgba(232,122,122,0.45);color:#e87a7a;text-decoration:line-through;`;
      else                style = `background:transparent;border:1px solid var(--border2);color:var(--text3);`;
      const title = st===1 ? '1 clic de plus pour masquer' : st===-1 ? '1 clic de plus pour désactiver' : 'Clic = inclure · Clic×2 = masquer';
      return `<span class="tag-pill" data-tpf="${t.id}" title="${title}" style="${style}cursor:pointer;">${esc(t.name)}</span>`;
    }).join('');

  filterArea.querySelectorAll('[data-tpf]').forEach(pill => {
    pill.addEventListener('click', () => {
      const v=pill.dataset.tpf, cur=tagsTagFilterMap.get(v)||0;
      if (v === 'untagged') {
        cur === 0 ? tagsTagFilterMap.set(v, 1) : tagsTagFilterMap.delete(v);
      } else {
        if      (cur ===  0) tagsTagFilterMap.set(v,  1);
        else if (cur ===  1) tagsTagFilterMap.set(v, -1);
        else                 tagsTagFilterMap.delete(v);
      }
      renderTagsPrenomView();
    });
  });

  // Calculer la liste de prénoms à afficher selon les filtres actifs
  const includes = [...tagsTagFilterMap.entries()].filter(([k,v])=>v===1&&k!=='untagged').map(([k])=>k);
  const excludes = [...tagsTagFilterMap.entries()].filter(([k,v])=>v===-1).map(([k])=>k);
  const wantUntagged = (tagsTagFilterMap.get('untagged')||0)===1;
  const hasFilters = includes.length||excludes.length||wantUntagged;

  const sortedTags = tagsSorted();
  let html = '';

  if (!hasFilters) {
    // Aucun filtre : afficher toutes les sections
    sortedTags.forEach(tag => {
      const c    = getTagColor(tag.color);
      const list = prenoms.filter(p=>(p.tags||[]).includes(tag.id)).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
      if (list.length) html += tagSectionHtml(tag.name, c.text, list);
    });
    const untagged = prenoms.filter(p=>!p.tags||!p.tags.length).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    if (untagged.length) html += tagSectionHtml('Sans tag','var(--text3)',untagged);
  } else {
    // Filtrer les prénoms
    let filtered = prenoms.slice();
    includes.forEach(tid => { filtered = filtered.filter(p=>(p.tags||[]).includes(tid)); });
    excludes.forEach(tid => { filtered = filtered.filter(p=>!(p.tags||[]).includes(tid)); });
    if (wantUntagged) filtered = filtered.filter(p=>!p.tags||!p.tags.length);
    filtered.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    // Regrouper par sections tag pour les prénoms filtrés
    if (wantUntagged) {
      if (filtered.length) html += tagSectionHtml('Sans tag','var(--text3)',filtered);
    } else {
      // Afficher une section par tag inclus (ou toutes les sections si aucun include)
      const tagsToShow = includes.length ? sortedTags.filter(t=>includes.includes(t.id)) : sortedTags;
      tagsToShow.forEach(tag => {
        const c = getTagColor(tag.color);
        const list = filtered.filter(p=>(p.tags||[]).includes(tag.id));
        if (list.length) html += tagSectionHtml(tag.name, c.text, list);
      });
    }
  }

  results.innerHTML = html || '<div class="empty-state"><div class="empty-icon">◇</div><p>Aucun prénom trouvé.</p></div>';
  bindChipClicks();
}
function tagSectionHtml(title, color, list) {
  const chips = list.map(p => {
    const img    = tagsDispImage && p.imageId ? images.find(x=>x.id===p.imageId) : null;
    const pxList = tagsDispProxy ? proxys.filter(px=>px.prenomId===p.id) : [];
    const hasProfil = tagsDispProfil ? profils.some(pr=>pr.prenomId===p.id) : false;
    let extra = '';
    if (img && img.dataUrl) extra += `<img class="tags-prenom-chip-img" src="${img.dataUrl}" />`;
    if (pxList.length>0) extra += `<div class="tags-prenom-chip-proxys">${pxList.map(px=>`<span class="proxy-mini-pill" style="font-size:10px;">${esc((px.prefix||'')+'text'+(px.suffix||''))}</span>`).join('')}</div>`;
    if (tagsDispProfil) extra += `<div class="tags-prenom-chip-profil" style="color:${hasProfil?'var(--success)':'var(--text3)'};">${hasProfil?'◉ Profil':'◌ Pas de profil'}</div>`;
    return `<div class="tags-prenom-chip" data-chip-prenom="${p.id}"><div class="tags-prenom-chip-name${p.hasImage?'':' no-image'}">${esc(p.name)}</div>${extra}</div>`;
  }).join('');
  return `<div class="tags-prenom-section">
    <div class="tags-section-header">
      <div class="tag-color-dot" style="background:${color};"></div>
      <div class="tags-section-title" style="color:${color};">${esc(title)}</div>
      <div class="tags-section-count">${list.length}</div>
    </div>
    <div class="tags-prenom-chips">${chips}</div></div>`;
}

// Popover contextuel pour les chips
let chipPopoverCloseHandler = null;

function openChipPopover(prenomId, anchorEl) {
  const p      = prenoms.find(x=>x.id===prenomId);
  if (!p) return;
  const img    = p.imageId ? images.find(x=>x.id===p.imageId) : null;
  const pxList = proxys.filter(x=>x.prenomId===p.id);
  const profil = profils.find(x=>x.prenomId===p.id);

  const pop     = document.getElementById('chip-popover');
  const nameEl  = document.getElementById('chip-popover-name');
  const actsEl  = document.getElementById('chip-popover-actions');
  nameEl.textContent = p.name;

  const actions = [
    { icon: '✎', label: 'Modifier le prénom', fn: () => { closeChipPopover(); openPrenomModal(p); } },
    img
      ? { icon: '✂', label: img.isCropped ? 'Modifier l\'image' : '◌ Recadrer l\'image', fn: () => { closeChipPopover(); openImageModal(img); } }
      : { icon: '◈', label: 'Ajouter une image', fn: () => { closeChipPopover(); const m=openImageModal(); } },
    pxList.length>0
      ? { icon: '⟡', label: `${pxList.length} proxy — modifier`, fn: () => { closeChipPopover(); openProxyModal(pxList[0]); } }
      : { icon: '⟡', label: 'Ajouter un proxy', fn: () => { closeChipPopover(); openProxyModal(null, p); } },
    profil
      ? { icon: '◉', label: 'Modifier le profil', fn: () => { closeChipPopover(); openProfilModal(profil); } }
      : { icon: '◌', label: 'Créer un profil', fn: () => { closeChipPopover(); openProfilModal(null); setTimeout(()=>{ selectPrenomForProfil(p); },50); } },
    { icon: '✕', label: 'Supprimer le prénom', danger: true, fn: () => {
      closeChipPopover();
      openConfirm(`Supprimer le prénom "${p.name}" ?`, async () => {
        await dbDelete('prenoms', p.id);
        prenoms = prenoms.filter(x=>x.id!==p.id);
        toast(`Prénom "${p.name}" supprimé.`, 'success');
        renderPrenoms(); renderNoProxyBanner(); renderProxySideList(); renderTagsPrenomView(); updateStats();
      });
    }},
  ];

  actsEl.innerHTML = '';
  actions.forEach(act => {
    const btn = document.createElement('button');
    btn.className = 'chip-popover-action' + (act.danger ? ' danger' : '');
    btn.innerHTML = `<span class="chip-action-icon">${act.icon}</span>${esc(act.label)}`;
    btn.addEventListener('click', act.fn);
    actsEl.appendChild(btn);
  });

  // Positionner le popover
  const rect = anchorEl.getBoundingClientRect();
  const popW = 200;
  let left = rect.left;
  let top  = rect.bottom + 6;
  if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
  if (top + 240 > window.innerHeight - 12) top = rect.top - 240 - 6;
  pop.style.left = left + 'px';
  pop.style.top  = top  + 'px';
  pop.classList.add('open');

  // Fermer au clic extérieur
  if (chipPopoverCloseHandler) document.removeEventListener('click', chipPopoverCloseHandler);
  chipPopoverCloseHandler = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
      closeChipPopover();
    }
  };
  setTimeout(() => document.addEventListener('click', chipPopoverCloseHandler), 10);
}

function closeChipPopover() {
  const pop = document.getElementById('chip-popover');
  if (pop) pop.classList.remove('open');
  if (chipPopoverCloseHandler) {
    document.removeEventListener('click', chipPopoverCloseHandler);
    chipPopoverCloseHandler = null;
  }
}

// Délégation d'événement pour les chips (re-bindée à chaque renderTagsPrenomView)
function bindChipClicks() {
  document.getElementById('tags-prenom-results').querySelectorAll('[data-chip-prenom]').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = chip.dataset.chipPrenom;
      const pop = document.getElementById('chip-popover');
      // Toggle : si déjà ouvert pour ce prénom, fermer
      if (pop.classList.contains('open') && pop.dataset.currentPrenom === pid) {
        closeChipPopover();
      } else {
        pop.dataset.currentPrenom = pid;
        openChipPopover(pid, chip);
      }
    });
  });
}

// Display toggles
document.querySelectorAll('.display-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = btn.dataset.disp;
    if (d==='image')  tagsDispImage  = !tagsDispImage;
    if (d==='proxy')  tagsDispProxy  = !tagsDispProxy;
    if (d==='profil') tagsDispProfil = !tagsDispProfil;
    btn.classList.toggle('on', d==='image'?tagsDispImage:d==='proxy'?tagsDispProxy:tagsDispProfil);
    renderTagsPrenomView();
  });
});

// View selector
document.querySelectorAll('.tag-view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tagsPageView = btn.dataset.view;
    document.querySelectorAll('.tag-view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tags-view-tags').style.display    = tagsPageView==='tags'    ? '' : 'none';
    document.getElementById('tags-view-prenoms').style.display = tagsPageView==='prenoms' ? '' : 'none';
    if (tagsPageView==='prenoms') renderTagsPrenomView();
    else renderTagsPage();
  });
});
