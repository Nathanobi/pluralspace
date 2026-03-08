// ── PROFILS ──
let profilSort = 'alpha', profilSearch = '';
let filterProfilIncomplete = false, filterHorsPK = false;
let profilTagFilterMap = new Map();
let editingProfilId = null, selectedPrenomForProfil = null;

function isProfilIncomplete(pr) {
  return !pr.imageId || !proxys.some(px=>px.prenomId===pr.prenomId) || !pr.color || !pr.bio;
}

function renderProfilTagFilters() {
  const row  = document.getElementById('profil-tag-filter-row');
  const cont = document.getElementById('profil-tag-filters');
  if (!row||!cont) return;
  if (!tags.length) { row.style.display='none'; return; }
  row.style.display='flex';
  const noTagSt = profilTagFilterMap.get('__notag__') || 0;
  const noTagSty = noTagSt === 1
    ? 'background:rgba(107,95,128,0.2);border:1px solid rgba(107,95,128,0.6);color:var(--text2);'
    : 'background:transparent;border:1px solid var(--border2);color:var(--text3);opacity:.7;';
  cont.innerHTML =
    `<button class="tag-filter-pill" data-prftag="__notag__" style="${noTagSty}">◌ Sans tags</button>` +
    tagsSorted().map(t => {
      const c = getTagColor(t.color);
      const st = profilTagFilterMap.get(t.id)||0;
      let style='', label=esc(t.name);
      if (st===1)       { style=`background:${c.bg};border:1px solid ${c.border};color:${c.text};`; label='✓ '+label; }
      else if (st===-1) { style='background:rgba(220,50,50,.12);border:1px solid rgba(220,50,50,.4);color:#e07070;text-decoration:line-through;'; label='✕ '+label; }
      else              { style=`background:transparent;border:1px solid ${c.border};color:${c.text};opacity:.6;`; }
      return `<button class="tag-filter-pill" data-prftag="${t.id}" style="${style}">${label}</button>`;
    }).join('');
  cont.querySelectorAll('[data-prftag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.prftag;
      if (tid === '__notag__') {
        const s = profilTagFilterMap.get('__notag__') || 0;
        s === 0 ? profilTagFilterMap.set('__notag__', 1) : profilTagFilterMap.delete('__notag__');
      } else {
        const cur=profilTagFilterMap.get(tid)||0, nxt=cur===0?1:cur===1?-1:0;
        nxt===0?profilTagFilterMap.delete(tid):profilTagFilterMap.set(tid,nxt);
      }
      renderProfilTagFilters(); renderProfils();
    });
  });
}

// ── FILTRES TAGS PROFILS ──

function renderProfils() {
  const list  = getProfils();
  const grid  = document.getElementById('profils-grid');
  const empty = document.getElementById('profils-empty');
  const lbl   = document.getElementById('profils-count-label');
  lbl.textContent = `${profils.length} profil${profils.length!==1?'s':''}${list.length!==profils.length?' · '+list.length+' affiché'+(list.length!==1?'s':''):''}`;  
  if (list.length===0) { grid.style.display='none'; empty.style.display=''; return; }
  grid.style.display='grid'; empty.style.display='none';

  grid.innerHTML = list.map(pr => {
    const p     = prenoms.find(x=>x.id===pr.prenomId);
    const img   = pr.imageId  ? images.find(x=>x.id===pr.imageId)  : null;
    const pxList= proxys.filter(x=>x.prenomId===pr.prenomId);
    const name  = p ? p.name : (pr.name||'?');
    const colorBar = pr.color ? `<div class="profil-color-bar" style="background:${esc(pr.color)};"></div>` : '';
    const avatarHtml = (img&&(img.dataUrl||img.hostedUrl))
      ? `<div class="profil-card-avatar"><img src="${img.dataUrl||img.hostedUrl}" /></div>`
      : `<div class="profil-card-avatar no-img">✦</div>`;
    const proxysHtml = pxList.map(px=>`<span class="proxy-mini-pill" style="font-size:10px;">${esc((px.prefix||'')+name+(px.suffix||''))}</span>`).join(' ');
    const pTags = (prenoms.find(x=>x.id===pr.prenomId)?.tags||[])
      .map(tid=>tags.find(t=>t.id===tid)).filter(Boolean)
      .sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
    const tagsHtml = pTags.map(t=>{const c=getTagColor(t.color);return '<span class="tag-pill" style="font-size:10px;padding:2px 8px;background:'+c.bg+';color:'+c.text+';border:1px solid '+c.border+';">'+esc(t.name)+'</span>';}).join('');
    const badges = [
      img ? (img.isCropped?'<span class="badge badge-success" style="font-size:10px;">✂ Image</span>':'<span class="badge badge-warn" style="font-size:10px;">◌ Non recadrée</span>') : '<span class="badge badge-warn" style="font-size:10px;">◌ Sans image</span>',
      pxList.length>0 ? `<span class="badge badge-success" style="font-size:10px;">⟡ ${pxList.length} proxy${pxList.length>1?'s':''}</span>` : '<span class="badge badge-warn" style="font-size:10px;">◌ Sans proxy</span>',
      pr.pkMemberId ? '<span class="badge badge-pk" style="font-size:10px;">⟡ Profil PK</span>' : '<span class="badge badge-warn" style="font-size:10px;">◌ Hors PK</span>',
    ].join('');
    return `<div class="profil-card" data-profil-id="${pr.id}">
      ${colorBar}
      <div class="profil-card-top">
        ${avatarHtml}
        <div class="profil-card-info">
          <div class="profil-card-name">${esc(name)}</div>
          ${pr.pronouns?`<div class="profil-card-pronouns">${esc(pr.pronouns)}</div>`:''}
          ${pxList.length>0?`<div class="profil-card-proxys">${proxysHtml}</div>`:''}
        </div>
      </div>
      ${pr.bio?`<div class="profil-card-bio">${esc(pr.bio)}</div>`:''}
      ${pTags.length>0?`<div class="prenom-tags" style="padding:4px 12px 6px;">${tagsHtml}</div>`:''}
      <div class="profil-card-footer">${badges}</div>
      <div class="profil-card-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-profil-edit="${pr.id}" style="background:rgba(15,13,23,0.8);">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" data-profil-del="${pr.id}" style="background:rgba(15,13,23,0.8);">✕</button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.profil-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-profil-edit]')||e.target.closest('[data-profil-del]')) return;
      const pr = profils.find(x=>x.id===card.dataset.profilId);
      if (pr) openProfilDetail(pr);
    });
  });
  grid.querySelectorAll('[data-profil-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); const pr=profils.find(x=>x.id===btn.dataset.profilEdit); if(pr) openProfilModal(pr); });
  });
  grid.querySelectorAll('[data-profil-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pr = profils.find(x=>x.id===btn.dataset.profilDel);
      const p  = pr ? prenoms.find(x=>x.id===pr.prenomId) : null;
      openConfirm(`Supprimer le profil de "${p?p.name:'?'}" ?`, async () => {
        await dbDelete('profils', pr.id);
        profils = profils.filter(x=>x.id!==pr.id);
        toast('Profil supprimé.', 'success'); logHistory('Profil supprimé', 'profil');
        renderProfils(); updateStats();
      });
    });
  });
}

function getProfils() {
  let list = profils.slice();
  if (profilSearch) {
    const q = profilSearch.toLowerCase();
    list = list.filter(pr => {
      const p = prenoms.find(x=>x.id===pr.prenomId);
      return (p&&p.name.toLowerCase().includes(q)) || (pr.bio&&pr.bio.toLowerCase().includes(q));
    });
  }
  if (filterProfilIncomplete) list = list.filter(isProfilIncomplete);
  if (filterHorsPK) list = list.filter(pr => !pr.pkMemberId);
  // Filtre tags 3 états : 1=inclure, -1=exclure
  profilTagFilterMap.forEach((st, tid) => {
    if (tid === '__notag__') {
      if (st === 1) list = list.filter(pr => { const p=prenoms.find(x=>x.id===pr.prenomId); return !p||!(p.tags||[]).length; });
    } else {
      if (st===1)  list = list.filter(pr => { const p=prenoms.find(x=>x.id===pr.prenomId); return !!(p&&(p.tags||[]).includes(tid)); });
      if (st===-1) list = list.filter(pr => { const p=prenoms.find(x=>x.id===pr.prenomId); return  !(p&&(p.tags||[]).includes(tid)); });
    }
  });
  if (profilSort==='alpha') list.sort((a,b) => {
    const na = prenoms.find(x=>x.id===a.prenomId); const nb = prenoms.find(x=>x.id===b.prenomId);
    return (na?na.name:'').localeCompare(nb?nb.name:'', 'fr');
  });
  else if (profilSort==='alpha-z') list.sort((a,b) => {
    const na = prenoms.find(x=>x.id===a.prenomId); const nb = prenoms.find(x=>x.id===b.prenomId);
    return (nb?nb.name:'').localeCompare(na?na.name:'', 'fr');
  });
  else if (profilSort==='chrono') list.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  else if (profilSort==='old')    list.sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
  return list;
}

document.querySelectorAll('[data-profil-sort]').forEach(btn => {
  btn.addEventListener('click', () => {
    profilSort = btn.dataset.profilSort;
    document.querySelectorAll('[data-profil-sort]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderProfils();
  });
});
document.getElementById('profil-search').addEventListener('input', e => { profilSearch=e.target.value.trim(); renderProfils(); });
document.getElementById('filter-profil-incomplete').addEventListener('click', (e) => {
  filterProfilIncomplete = !filterProfilIncomplete;
  e.currentTarget.classList.toggle('active', filterProfilIncomplete);
  renderProfils();
});
document.getElementById('filter-profil-horspk').addEventListener('click', (e) => {
  filterHorsPK = !filterHorsPK;
  e.currentTarget.classList.toggle('active', filterHorsPK);
  renderProfils();
});

// ── MODAL PROFIL ──
function openProfilModal(profil) {
  profil = profil||null;
  editingProfilId = profil ? profil.id : null;
  document.getElementById('modal-profil-title').textContent = profil ? 'Modifier le profil' : 'Nouveau profil';
  document.getElementById('profil-prenom-input').value = '';
  document.getElementById('profil-prenom-dropdown').style.display='none';
  document.getElementById('profil-prenom-selected').style.display='none';
  document.getElementById('profil-linked-info').style.display='none';
  document.getElementById('profil-input-pronouns').value = profil ? (profil.pronouns||'') : '';
  document.getElementById('profil-input-color').value    = profil ? (profil.color||'') : '';
  document.getElementById('profil-color-picker').value   = profil ? (profil.color||'#c9a0dc') : '#c9a0dc';
  document.getElementById('profil-input-bio').value      = profil ? (profil.bio||'') : '';
  selectedPrenomForProfil = null;
  if (profil) {
    const p = prenoms.find(x=>x.id===profil.prenomId);
    if (p) selectPrenomForProfil(p);
  }
  // S'assurer que le modal profil est AU-DESSUS des autres (z-index élevé)
  document.getElementById('modal-profil').style.zIndex = '130';
  document.getElementById('modal-profil').classList.add('open');
  setTimeout(() => document.getElementById('profil-prenom-input').focus(), 50);
}

function selectPrenomForProfil(prenom) {
  selectedPrenomForProfil = prenom;
  document.getElementById('profil-prenom-input').value = '';
  document.getElementById('profil-prenom-dropdown').style.display='none';
  const sel = document.getElementById('profil-prenom-selected');
  sel.style.display='inline-flex';
  sel.innerHTML = `<span>${esc(prenom.name)}</span><span class="deselect" id="profil-deselect">✕</span>`;
  document.getElementById('profil-deselect').addEventListener('click', () => {
    selectedPrenomForProfil=null; sel.style.display='none';
    document.getElementById('profil-linked-info').style.display='none';
  });
  refreshProfilLinkedInfo(prenom);
}

function refreshProfilLinkedInfo(prenom) {
  const info        = document.getElementById('profil-linked-info');
  const imgContent  = document.getElementById('profil-img-content');
  const imgActions  = document.getElementById('profil-img-actions');
  const proxyContent = document.getElementById('profil-proxy-content');
  const proxyActions = document.getElementById('profil-proxy-actions');

  const img    = prenom.imageId ? images.find(x=>x.id===prenom.imageId) : null;
  const pxList = proxys.filter(x=>x.prenomId===prenom.id);

  // ── Image ──
  if (img && (img.dataUrl||img.hostedUrl)) {
    imgContent.innerHTML = `<img class="profil-linked-thumb" src="${img.dataUrl||img.hostedUrl}" />
      ${img.isCropped
        ? '<span class="badge badge-success" style="font-size:10px;">✂ Recadrée</span>'
        : '<span class="badge badge-warn" style="font-size:10px;">Non recadrée</span>'}`;
    const cropHtml = img.isCropped ? '' : '<button class="btn btn-primary btn-sm" id="btn-profil-crop-now">✂ Recadrer</button>';
    imgActions.innerHTML = cropHtml + '<button class="btn btn-ghost btn-sm" id="btn-profil-change-img">✎ Changer</button>';

    imgActions.querySelector('#btn-profil-change-img')?.addEventListener('click', () => {
      // Ouvrir image modal PAR-DESSUS le profil modal (z-index supérieur)
      document.getElementById('modal-image').style.zIndex = '200';
      openImageModal(img);
      _watchModalClose('modal-image', () => {
        document.getElementById('modal-image').style.zIndex = '';
        const up = prenoms.find(p=>p.id===prenom.id);
        if (up) { selectedPrenomForProfil=up; refreshProfilLinkedInfo(up); }
      });
    });
    imgActions.querySelector('#btn-profil-crop-now')?.addEventListener('click', () => {
      openCropModal(img.originalDataUrl||img.dataUrl, async croppedUrl => {
        img.dataUrl=croppedUrl; img.isCropped=true;
        if (!img.originalDataUrl) img.originalDataUrl=croppedUrl;
        await dbPut('images',img);
        toast('Image recadrée !','success');
        renderImages();
        refreshProfilLinkedInfo(prenom);
      });
    });
  } else {
    imgContent.innerHTML = '<span style="color:var(--text3);font-style:italic;">Aucune image liée</span>';
    imgActions.innerHTML = '<button class="btn btn-ghost btn-sm" id="btn-profil-goto-img">+ Ajouter</button>';
    imgActions.querySelector('#btn-profil-goto-img')?.addEventListener('click', () => {
      document.getElementById('modal-image').style.zIndex = '200';
      openImageModal();
      _watchModalClose('modal-image', () => {
        document.getElementById('modal-image').style.zIndex = '';
        const up = prenoms.find(p=>p.id===prenom.id);
        if (up) { selectedPrenomForProfil=up; refreshProfilLinkedInfo(up); }
      });
    });
  }

  // ── Proxy(s) ──
  if (pxList.length>0) {
    proxyContent.innerHTML = pxList.map(px =>
      `<span class="proxy-mini-pill" style="cursor:pointer;" data-profil-edit-px="${px.id}">${esc((px.prefix||'')+prenom.name+(px.suffix||''))}</span>`
    ).join(' ');
    proxyContent.querySelectorAll('[data-profil-edit-px]').forEach(el => {
      el.addEventListener('click', () => {
        const px = proxys.find(x=>x.id===el.dataset.profilEditPx);
        if (px) {
          document.getElementById('modal-proxy').style.zIndex='200';
          openProxyModal(px);
          _watchModalClose('modal-proxy', () => {
            document.getElementById('modal-proxy').style.zIndex='';
            refreshProfilLinkedInfo(prenom);
          });
        }
      });
    });
  } else {
    proxyContent.innerHTML = '<span style="color:var(--text3);font-style:italic;">Aucun proxy</span>';
  }
  proxyActions.innerHTML = '<button class="btn btn-ghost btn-sm" id="btn-profil-add-px">+ Proxy</button>';
  proxyActions.querySelector('#btn-profil-add-px')?.addEventListener('click', () => {
    document.getElementById('modal-proxy').style.zIndex='200';
    openProxyModal(null, prenom);
    _watchModalClose('modal-proxy', () => {
      document.getElementById('modal-proxy').style.zIndex='';
      const up = prenoms.find(p=>p.id===prenom.id);
      if (up) refreshProfilLinkedInfo(up);
    });
  });

  info.style.display='';
}

// Utilitaire : observer la fermeture d'un modal pour déclencher un callback
function _watchModalClose(modalId, cb) {
  const el = document.getElementById(modalId);
  if (!el) return;
  const obs = new MutationObserver(() => {
    if (!el.classList.contains('open')) { obs.disconnect(); cb(); }
  });
  obs.observe(el, { attributes:true, attributeFilter:['class'] });
}

// Recherche prénom dans modal profil
document.getElementById('profil-prenom-input').addEventListener('input', function() {
  const q  = this.value.trim();
  const dd = document.getElementById('profil-prenom-dropdown');
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
    const hasProfil = profils.some(pr => pr.prenomId === p.id);
    const profilBadge = hasProfil
      ? `<span class="already-has">a déjà un profil</span>`
      : '';
    return `<div class="prenom-dropdown-item" data-profil-pick="${p.id}"><span>${esc(p.name)}</span>${profilBadge}</div>`;
  }).join('')
    + (!exact?`<div class="prenom-dropdown-item" data-profil-create="${esc(q)}" style="color:var(--accent2);border-top:1px solid var(--border2);"><span>✦ Créer "${esc(q)}"</span></div>`:'');
  dd.querySelectorAll('[data-profil-pick]').forEach(item => {
    item.addEventListener('click', () => selectPrenomForProfil(prenoms.find(p=>p.id===item.dataset.profilPick)));
  });
  dd.querySelectorAll('[data-profil-create]').forEach(item => {
    item.addEventListener('click', async () => {
      const name = item.dataset.profilCreate;
      const newP = { id:uid(), name, tags:[], notes:'', hasImage:false, imageId:null, createdAt:Date.now() };
      await dbPut('prenoms',newP); prenoms.push(newP);
      renderPrenoms(); renderNoProxyBanner(); updateStats();
      selectPrenomForProfil(newP);
      toast(`Prénom "${name}" créé.`,'success');
    });
  });
});
document.addEventListener('click', e => {
  if (!e.target.closest('#profil-prenom-input') && !e.target.closest('#profil-prenom-dropdown'))
    document.getElementById('profil-prenom-dropdown').style.display='none';
});

// Sync color picker
document.getElementById('profil-color-picker').addEventListener('input', function() { document.getElementById('profil-input-color').value=this.value; });
document.getElementById('profil-input-color').addEventListener('input', function() {
  if (/^#[0-9a-fA-F]{6}$/.test(this.value)) document.getElementById('profil-color-picker').value=this.value;
});

async function saveProfil() {
  if (!selectedPrenomForProfil) { toast('Veuillez sélectionner un prénom.','error'); return; }
  const prenom   = selectedPrenomForProfil;
  const img      = prenom.imageId ? images.find(x=>x.id===prenom.imageId) : null;
  const pronouns = document.getElementById('profil-input-pronouns').value.trim();
  const color    = document.getElementById('profil-input-color').value.trim();
  const bio      = document.getElementById('profil-input-bio').value.trim();
  if (editingProfilId) {
    const pr = profils.find(x=>x.id===editingProfilId);
    if (!pr) return;
    pr.prenomId=prenom.id; pr.name=prenom.name; pr.imageId=img?img.id:null;
    pr.pronouns=pronouns; pr.color=color; pr.bio=bio;
    await dbPut('profils',pr);
    toast(`Profil de "${prenom.name}" modifié.`,'success'); logHistory(`Profil de "${prenom.name}" modifié`, 'profil');
  } else {
    const pr={ id:uid(), prenomId:prenom.id, name:prenom.name, imageId:img?img.id:null,
               pronouns, color, bio, createdAt:Date.now() };
    await dbPut('profils',pr); profils.push(pr);
    toast(`Profil de "${prenom.name}" créé.`,'success'); logHistory(`Profil de "${prenom.name}" créé`, 'profil');
  }
  document.getElementById('modal-profil').classList.remove('open');
  editingProfilId=null; selectedPrenomForProfil=null;
  renderProfils(); updateStats();
}

document.getElementById('btn-add-profil').addEventListener('click',      () => openProfilModal());
document.getElementById('modal-profil-close').addEventListener('click',   () => document.getElementById('modal-profil').classList.remove('open'));
document.getElementById('modal-profil-cancel').addEventListener('click',  () => document.getElementById('modal-profil').classList.remove('open'));
document.getElementById('modal-profil-save').addEventListener('click',    saveProfil);

// ── DÉTAIL PROFIL ──
function openProfilDetail(profil) {
  const p      = prenoms.find(x=>x.id===profil.prenomId);
  const img    = profil.imageId ? images.find(x=>x.id===profil.imageId) : null;
  const pxList = proxys.filter(x=>x.prenomId===profil.prenomId);
  const name   = p ? p.name : (profil.name||'?');

  document.getElementById('profil-detail-name').textContent = name;
  const body = document.getElementById('profil-detail-body');
  const avatarHtml = (img&&(img.dataUrl||img.hostedUrl))
    ? `<div class="profil-detail-avatar"><img src="${img.dataUrl||img.hostedUrl}" /></div>`
    : `<div class="profil-detail-avatar" style="border:2px dashed var(--border);font-size:36px;color:var(--text3);">✦</div>`;
  body.innerHTML = `
    <div class="profil-detail-section">
      ${avatarHtml}
      <div class="profil-detail-meta">
        ${pxList.length>0?`<div class="profil-detail-row"><div class="profil-detail-key">Proxy(s)</div><div class="profil-detail-val">${pxList.map(px=>`<span class="proxy-mini-pill">${esc((px.prefix||'')+name+(px.suffix||''))}</span>`).join(' ')}</div></div>`:''}
        ${profil.pronouns?`<div class="profil-detail-row"><div class="profil-detail-key">Pronoms</div><div class="profil-detail-val">${esc(profil.pronouns)}</div></div>`:''}
        ${profil.color?`<div class="profil-detail-row"><div class="profil-detail-key">Couleur</div><div class="profil-detail-val" style="display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border-radius:50%;background:${esc(profil.color)};"></div>${esc(profil.color)}</div></div>`:''}
        <div class="profil-detail-row"><div class="profil-detail-key">Image</div><div class="profil-detail-val">${img?(img.isCropped?'✂ Recadrée':'◌ Non recadrée'):'Aucune'}</div></div>
        ${profil.pkMemberId?`<div class="profil-detail-row"><div class="profil-detail-key">PluralKit</div><div class="profil-detail-val"><span class="badge badge-pk" style="font-size:11px;">⟡ Profil PK</span> <span style="font-family:monospace;font-size:11px;color:var(--text3);">${esc(profil.pkMemberId)}</span></div></div>`:`<div class="profil-detail-row"><div class="profil-detail-key">PluralKit</div><div class="profil-detail-val"><span class="badge badge-warn" style="font-size:11px;">◌ Hors PK</span></div></div>`}
      </div>
    </div>
    ${profil.bio?`<div class="profil-detail-bio">${esc(profil.bio)}</div>`:''}`;

  document.getElementById('modal-profil-detail').classList.add('open');
  document.getElementById('profil-detail-delete').onclick = () => {
    document.getElementById('modal-profil-detail').classList.remove('open');
    openConfirm(`Supprimer le profil de "${name}" ?`, async () => {
      await dbDelete('profils', profil.id);
      profils = profils.filter(x=>x.id!==profil.id);
      toast('Profil supprimé.','success');
      renderProfils(); updateStats();
    });
  };
  document.getElementById('profil-detail-edit').onclick = () => {
    document.getElementById('modal-profil-detail').classList.remove('open');
    openProfilModal(profil);
  };
  document.getElementById('profil-detail-copy').onclick = () => {
    const lines = [`**${name}**`];
    if (pxList.length>0) lines.push('Proxys : '+pxList.map(px=>`\`${(px.prefix||'')+name+(px.suffix||'')}\``).join(', '));
    if (profil.pronouns) lines.push('Pronoms : '+profil.pronouns);
    if (profil.color)    lines.push('Couleur : '+profil.color);
    if (profil.bio)      lines.push('\n'+profil.bio);
    navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Copié !','success'));
  };
}

document.getElementById('modal-profil-detail-close').addEventListener('click', () => document.getElementById('modal-profil-detail').classList.remove('open'));
