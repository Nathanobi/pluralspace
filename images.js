// ── Résoudre la meilleure URL d'affichage pour une image ──
// Priorité : dataUrl (local) > croppedHostedUrl (si recadrée) > hostedUrl
function resolveImageSrc(img) {
  if (!img) return null;
  if (img.dataUrl && img.dataUrl.startsWith('data:image')) return img.dataUrl;
  if (img.isCropped && img.croppedHostedUrl) return img.croppedHostedUrl;
  return img.hostedUrl || null;
}

// ── IMAGES ──
let imgSort = 'chrono', imgSearch = '', imgTagFilterMap = new Map(), imgUnlinkedOnly = false, imgHostedFilter = 0; // 0=tous, 1=hébergée, -1=non hébergée
let editingImageId = null, selectedPrenomForImage = null, selectedTagsForImage = [], currentIsCropped = false, currentHostedUrl = null;
let currentOriginalDataUrl = null;

function renderImgTagFilters() {
  const row  = document.getElementById('img-tag-filter-row');
  const cont = document.getElementById('img-tag-filters');
  if (tags.length===0) { row.style.display='none'; return; }
  row.style.display='flex';
  const noTagState = imgTagFilterMap.get('__notag__') || 0;
  const noTagStyle = noTagState === 1
    ? 'background:rgba(107,95,128,0.2);border:1px solid rgba(107,95,128,0.6);color:var(--text2);'
    : 'background:transparent;border:1px solid var(--border2);color:var(--text3);';
  cont.innerHTML =
    `<span class="tag-pill" data-img-filter-tag="__notag__" style="${noTagStyle}cursor:pointer;">◌ Sans tags</span>` +
    tagsSorted().map(t => {
      const c     = getTagColor(t.color);
      const state = imgTagFilterMap.get(t.id) || 0;
      let style;
      if      (state ===  1) style = `background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
      else if (state === -1) style = `background:rgba(232,122,122,0.15);border:1px solid rgba(232,122,122,0.45);color:#e87a7a;text-decoration:line-through;`;
      else                   style = `background:transparent;border:1px solid var(--border2);color:var(--text3);`;
      return `<span class="tag-pill" data-img-filter-tag="${t.id}" style="${style}cursor:pointer;">${esc(t.name)}</span>`;
    }).join('');
  cont.querySelectorAll('[data-img-filter-tag]').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.imgFilterTag;
      if (id === '__notag__') {
        const s = imgTagFilterMap.get('__notag__') || 0;
        s === 0 ? imgTagFilterMap.set('__notag__', 1) : imgTagFilterMap.delete('__notag__');
      } else {
        const s = imgTagFilterMap.get(id) || 0;
        if      (s ===  0) imgTagFilterMap.set(id,  1);
        else if (s ===  1) imgTagFilterMap.set(id, -1);
        else               imgTagFilterMap.delete(id);
      }
      renderImgTagFilters(); renderImages();
    });
  });
}

function getFilteredImages() {
  let list = images.slice();
  if (imgUnlinkedOnly) list = list.filter(img => !img.prenomId || !prenoms.find(x=>x.id===img.prenomId));
  if (imgHostedFilter ===  1) list = list.filter(img =>  !!img.hostedUrl);
  if (imgHostedFilter === -1) list = list.filter(img => !img.hostedUrl);
  if (imgSearch) {
    const q = imgSearch.toLowerCase();
    list = list.filter(img => {
      const p = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
      if (p && p.name.toLowerCase().includes(q)) return true;
      return (img.tags||[]).some(tid => { const t=tags.find(x=>x.id===tid); return t&&t.name.toLowerCase().includes(q); });
    });
  }
  for (const [tid, state] of imgTagFilterMap) {
    if (tid === '__notag__') {
      if (state === 1) list = list.filter(img => !(img.tags||[]).length);
    } else {
      if (state ===  1) list = list.filter(img =>  (img.tags||[]).includes(tid));
      if (state === -1) list = list.filter(img => !(img.tags||[]).includes(tid));
    }
  }
  const nameOf = img => { const p=img.prenomId?prenoms.find(x=>x.id===img.prenomId):null; return p?p.name:'zzz'; };
  if      (imgSort==='alpha')   list.sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'fr'));
  else if (imgSort==='alpha-z') list.sort((a,b)=>nameOf(b).localeCompare(nameOf(a),'fr'));
  else if (imgSort==='old')     list.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  else                          list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); // chrono
  return list;
}

function renderImages() {
  const list  = getFilteredImages();
  const grid  = document.getElementById('images-grid');
  const empty = document.getElementById('images-empty');
  const lbl   = document.getElementById('images-count-label');
  lbl.textContent = `${images.length} image${images.length!==1?'s':''}${list.length!==images.length?' · '+list.length+' affiché'+(list.length!==1?'s':''):''}`;  
  if (list.length===0) { grid.style.display='none'; empty.style.display=''; return; }
  grid.style.display='grid'; empty.style.display='none';

  grid.innerHTML = list.map(img => {
    const p       = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
    const imgTags = (img.tags||[]).map(tid=>tags.find(t=>t.id===tid)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"fr",{sensitivity:"base"}));
    const tagsHtml = imgTags.slice(0,3).map(tagPillHtml).join('');
    return `<div class="image-card" data-img-id="${img.id}">
      ${(img.dataUrl||img.hostedUrl) ? `<img class="image-card-thumb" src="${img.dataUrl||img.hostedUrl}" loading="lazy" />` : '<div class="image-card-thumb-placeholder">◈</div>'}
      <div class="image-card-body">
        <div class="image-card-name${p?'':' unlinked'}">${p?esc(p.name):'Sans prénom'}</div>
        ${imgTags.length>0 ? `<div class="image-card-tags">${tagsHtml}${imgTags.length>3?`<span style="font-size:11px;color:var(--text3);">+${imgTags.length-3}</span>`:''}</div>` : ''}
        <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px;">
          ${img.isCropped
            ? '<span class="badge badge-success" style="font-size:10px;">✂ Recadrée</span>'
            : '<span class="badge badge-warn" style="font-size:10px;">◌ Non recadrée</span>'}
          ${img.hostedUrl
            ? '<span class="badge badge-success" style="font-size:10px;">✧ Hébergée</span>'
            : '<span class="badge badge-warn" style="font-size:10px;">◌ Non hébergée</span>'}
          ${img.pinterestUrl ? '<span class="badge" style="font-size:10px;background:rgba(230,0,35,0.15);color:#e60023;border-color:rgba(230,0,35,0.3);">📌 Pinterest</span>' : ''}
        </div>
      </div>
      <div class="image-card-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-img-edit="${img.id}" title="Modifier" style="background:rgba(15,13,23,0.8);">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" data-img-del="${img.id}" title="Supprimer" style="background:rgba(15,13,23,0.8);">✕</button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.image-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-img-edit]')||e.target.closest('[data-img-del]')) return;
      const img = images.find(x=>x.id===card.dataset.imgId);
      if (img) openImageDetail(img);
    });
  });
  grid.querySelectorAll('[data-img-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); const img=images.find(x=>x.id===btn.dataset.imgEdit); if(img) openImageModal(img); });
  });
  grid.querySelectorAll('[data-img-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const img = images.find(x=>x.id===btn.dataset.imgDel);
      if (!img) return;
      const p = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
      openConfirm(`Supprimer cette image${p?' de "'+p.name+'"':''} ?`, async () => {
        if (img.prenomId) { const pr=prenoms.find(x=>x.id===img.prenomId); if(pr&&pr.imageId===img.id){pr.hasImage=false;pr.imageId=null;await dbPut('prenoms',pr);} }
        await dbDelete('images',img.id);
        images=images.filter(x=>x.id!==img.id);
        toast('Image supprimée.','success'); logHistory('Image supprimée', 'image');
        renderImages(); renderPrenoms(); updateStats();
      });
    });
  });
}

document.querySelectorAll('[data-img-sort]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.imgSort === 'unlinked') {
      imgUnlinkedOnly = !imgUnlinkedOnly;
      btn.classList.toggle('active', imgUnlinkedOnly);
    } else if (btn.dataset.imgSort === 'hosted') {
      imgHostedFilter = imgHostedFilter === 1 ? 0 : 1;
      btn.classList.toggle('active', imgHostedFilter === 1);
      // Désactiver l'autre filtre hébergée
      const notHostedBtn = document.querySelector('[data-img-sort="not-hosted"]');
      if (notHostedBtn && imgHostedFilter === 1) { imgHostedFilter = 1; notHostedBtn.classList.remove('active'); }
    } else if (btn.dataset.imgSort === 'not-hosted') {
      imgHostedFilter = imgHostedFilter === -1 ? 0 : -1;
      btn.classList.toggle('active', imgHostedFilter === -1);
      document.querySelector('[data-img-sort="hosted"]')?.classList.remove('active');
    } else if (btn.dataset.imgSort === 'cropped') {
      imgCroppedFilter = imgCroppedFilter === 1 ? 0 : 1;
      btn.classList.toggle('active', imgCroppedFilter === 1);
      document.querySelector('[data-img-sort="not-cropped"]')?.classList.remove('active');
    } else if (btn.dataset.imgSort === 'not-cropped') {
      imgCroppedFilter = imgCroppedFilter === -1 ? 0 : -1;
      btn.classList.toggle('active', imgCroppedFilter === -1);
      document.querySelector('[data-img-sort="cropped"]')?.classList.remove('active');
    } else {
      // Boutons de tri (pas filtres booléens)
      imgSort = btn.dataset.imgSort;
      const filterBtns = ['unlinked','hosted','not-hosted','cropped','not-cropped'];
      document.querySelectorAll('[data-img-sort]').forEach(b => {
        if (!filterBtns.includes(b.dataset.imgSort)) b.classList.remove('active');
      });
      btn.classList.add('active');
    }
    renderImages();
  });
});
document.getElementById('image-search').addEventListener('input', e => { imgSearch=e.target.value.trim(); renderImages(); });

// ── PINTEREST URL ──


// ── MODAL IMAGE ──
function openImageModal(img) {
  img = img||null;
  editingImageId         = img ? img.id : null;
  selectedPrenomForImage = null;
  selectedTagsForImage   = img ? (img.tags||[]).slice() : [];
  currentOriginalDataUrl = img ? (img.originalDataUrl||null) : null;
  currentIsCropped       = img ? (img.isCropped || false) : false;
  currentHostedUrl       = img ? (img.hostedUrl || null) : null;

  document.getElementById('modal-image-title').textContent = img ? 'Modifier l\'image' : 'Ajouter une image';
  document.getElementById('img-drop-content').style.display = '';
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-preview').src = '';
  const prevEl = document.getElementById('img-preview');
  prevEl.removeAttribute('data-showing-original');
  prevEl.removeAttribute('data-cropped-src');
  document.getElementById('img-prenom-input').value = '';
  document.getElementById('img-prenom-dropdown').style.display='none';
  document.getElementById('img-prenom-selected').style.display='none';
  document.getElementById('img-crop-status').innerHTML='';
  // Zone hébergement
  document.getElementById('img-hosted-wrap').style.display = 'none';
  document.getElementById('img-hosted-url').textContent = '';
  document.getElementById('btn-copy-hosted-url').style.display = 'none';
  document.getElementById('img-upload-progress').style.display = 'none';
  if (img && img.dataUrl && img.dataUrl.startsWith('data:image')) {
    document.getElementById('img-preview').src = img.dataUrl;
    document.getElementById('img-drop-content').style.display='none';
    document.getElementById('img-preview-wrap').style.display='';
    updateCropStatusUI(img.isCropped, img.originalDataUrl);
    showHostedZone(img);
  } else if (img && resolveImageSrc(img)) {
    // Pas de dataUrl local → utiliser la meilleure URL (recadrée en priorité)
    const displaySrc = resolveImageSrc(img);
    document.getElementById('img-drop-content').style.display='none';
    document.getElementById('img-preview-wrap').style.display='';
    document.getElementById('img-preview').src = displaySrc;
    updateCropStatusUI(img.isCropped, null);
    showHostedZone(img);
    // Télécharger en arrière-plan pour avoir un vrai dataUrl local
    toast('Chargement de l\'image…', 'info');
    fetch(resolveImageSrc(img) || img.hostedUrl)
      .then(r => r.blob())
      .then(blob => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      }))
      .then(async dataUrl => {
        img.dataUrl = dataUrl;
        img.originalDataUrl = dataUrl;
        await dbPut('images', img);
        document.getElementById('img-preview').src = dataUrl;
        currentOriginalDataUrl = dataUrl;
        updateCropStatusUI(img.isCropped, dataUrl);
        toast('Image chargée localement ✓', 'success');
      })
      .catch(() => toast('Image affichée depuis le cloud (modification limitée)', 'info'));
  }
  if (img && img.prenomId) { const p=prenoms.find(x=>x.id===img.prenomId); if(p) selectPrenomForImage(p); }
  renderImgTagChips();
  const modalImageEl = document.getElementById('modal-image');
  modalImageEl.classList.add('open');
  // Bloquer les pointer-events 300ms pour éviter ghost click mobile
  modalImageEl.style.pointerEvents = 'none';
  setTimeout(() => { modalImageEl.style.pointerEvents = ''; }, 350);
}

function showHostedZone(img) {
  const wrap = document.getElementById('img-hosted-wrap');
  wrap.style.display = '';
  if (img && img.hostedUrl) {
    document.getElementById('img-hosted-url').textContent = (img.isCropped && img.croppedHostedUrl) ? img.croppedHostedUrl : (img.hostedUrl || '');
    document.getElementById('btn-copy-hosted-url').style.display = '';
  } else {
    document.getElementById('img-hosted-url').innerHTML = '<span style="color:var(--text3);font-style:italic;">Non hébergée — cliquez pour générer un lien</span>';
    document.getElementById('btn-copy-hosted-url').style.display = 'none';
  }
}

function updateCropStatusUI(isCropped, originalDataUrl, forcedHosted) {
  const el = document.getElementById('img-crop-status');
  if (!isCropped) { el.innerHTML='<span style="color:var(--text3);">◌ Image non recadrée</span>'; return; }
  // isCroppedHosted : true=hébergée, false=non hébergée, undefined=vérifier en DB
  const editingImg = editingImageId ? images.find(x => x.id === editingImageId) : null;
  const isCroppedHosted = forcedHosted === true ? true
    : forcedHosted === false ? false
    : !!(editingImg && editingImg.croppedHostedUrl);
  el.innerHTML = '<span style="color:var(--success);">✂ Image recadrée</span>'
    + (!isCroppedHosted ? ' · <span style="color:var(--warn);font-size:11px;">⚠ Non hébergée</span>' : '')
    + (originalDataUrl ? ' · <button class="btn btn-ghost btn-sm" id="btn-show-original" style="padding:2px 8px;font-size:11px;">Voir originale</button>' : '');
  const btn = el.querySelector('#btn-show-original');
  if (btn) {
    btn.addEventListener('click', () => {
      const prev = document.getElementById('img-preview');
      if (prev.dataset.showingOriginal==='true') {
        // Revenir à la version recadrée : utiliser croppedSrc mémorisé
        const croppedSrc = prev.dataset.croppedSrc || '';
        if (croppedSrc) {
          prev.src = croppedSrc;
          prev.dataset.showingOriginal='false';
          btn.textContent='Voir originale';
        }
      } else {
        // Mémoriser la version recadrée actuelle avant de montrer l'originale
        prev.dataset.croppedSrc = prev.src;
        prev.src = originalDataUrl;
        prev.dataset.showingOriginal='true';
        btn.textContent='Voir recadrée';
      }
    });
  }
}

function renderImgTagChips() {
  const cont = document.getElementById('img-tag-chips');
  if (tags.length===0) { cont.innerHTML='<span style="font-size:12px;color:var(--text3);">Aucun tag disponible</span>'; return; }
  cont.innerHTML = tagsSorted().map(t => {
    const c   = getTagColor(t.color);
    const sel = selectedTagsForImage.includes(t.id);
    return `<div class="chip${sel?' selected':''}" data-img-tag="${t.id}" style="${sel?`background:${c.bg};border-color:${c.border};color:${c.text};`:''}">${esc(t.name)}</div>`;
  }).join('');
  cont.querySelectorAll('[data-img-tag]').forEach(chip => {
    chip.addEventListener('click', () => {
      const id  = chip.dataset.imgTag;
      const tag = tags.find(x=>x.id===id);
      const c   = getTagColor(tag.color);
      const idx = selectedTagsForImage.indexOf(id);
      if (idx>=0) { selectedTagsForImage.splice(idx,1); chip.classList.remove('selected'); chip.removeAttribute('style'); }
      else        { selectedTagsForImage.push(id); chip.classList.add('selected'); chip.style.background=c.bg; chip.style.borderColor=c.border; chip.style.color=c.text; }
    });
  });
}

function selectPrenomForImage(prenom) {
  selectedPrenomForImage = prenom;
  document.getElementById('img-prenom-input').value='';
  document.getElementById('img-prenom-dropdown').style.display='none';
  const sel = document.getElementById('img-prenom-selected');
  sel.style.display='inline-flex';
  sel.innerHTML=`<span>${esc(prenom.name)}</span><span class="deselect" id="img-deselect">✕</span>`;
  document.getElementById('img-deselect').addEventListener('click', () => { selectedPrenomForImage=null; sel.style.display='none'; });
  // Fusionner les tags du prénom avec ceux de l'image (toujours, nouvelle ou existante)
  if (prenom.tags && prenom.tags.length > 0) {
    prenom.tags.forEach(tid => {
      if (!selectedTagsForImage.includes(tid)) selectedTagsForImage.push(tid);
    });
    renderImgTagChips();
  }
}

document.getElementById('img-prenom-input').addEventListener('input', function() {
  const q  = this.value.trim();
  const dd = document.getElementById('img-prenom-dropdown');
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
    const hasImg=p.hasImage;
    return `<div class="prenom-dropdown-item" data-img-pick="${p.id}"><span>${esc(p.name)}</span>${hasImg?'<span class="already-has">a déjà une image</span>':''}</div>`;
  }).join('') + (!exact?`<div class="prenom-dropdown-item" data-img-create="${esc(q)}" style="color:var(--accent2);border-top:1px solid var(--border2);"><span>✦ Créer "${esc(q)}"</span></div>`:'');
  dd.querySelectorAll('[data-img-pick]').forEach(item => {
    item.addEventListener('click', () => selectPrenomForImage(prenoms.find(p=>p.id===item.dataset.imgPick)));
  });
  dd.querySelectorAll('[data-img-create]').forEach(item => {
    item.addEventListener('click', async () => {
      const name = item.dataset.imgCreate;
      const newP = { id:uid(), name, tags:[], notes:'', hasImage:false, imageId:null, createdAt:Date.now() };
      await dbPut('prenoms',newP); prenoms.push(newP);
      renderPrenoms(); renderNoProxyBanner(); updateStats();
      selectPrenomForImage(newP);
      toast(`Prénom "${name}" créé.`,'success');
    });
  });
});
document.addEventListener('click', e => {
  if (!e.target.closest('#img-prenom-input') && !e.target.closest('#img-prenom-dropdown'))
    document.getElementById('img-prenom-dropdown').style.display='none';
});

// Drop zone
const dropZone = document.getElementById('img-drop-zone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',      e  => { e.preventDefault(); dropZone.classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith('image/')) loadImageFile(f); });
document.getElementById('btn-img-browse').addEventListener('click', () => document.getElementById('img-file-input').click());
document.getElementById('btn-img-change').addEventListener('click', () => document.getElementById('img-file-input').click());
document.getElementById('img-file-input').addEventListener('change', function() { if(this.files[0]) loadImageFile(this.files[0]); this.value=''; });

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    document.getElementById('img-preview').src = dataUrl;
    document.getElementById('img-drop-content').style.display='none';
    document.getElementById('img-preview-wrap').style.display='';
    currentOriginalDataUrl = dataUrl;
    currentIsCropped = false;
    currentHostedUrl = null;
    updateCropStatusUI(false, null);
    // Nouvelle image chargée : on efface l'ancienne URL hébergée si c'était une édition
    showHostedZone(editingImageId ? images.find(x=>x.id===editingImageId) : null);
  };
  reader.readAsDataURL(file);
}

// ── Upload image recadrée via imgbb ──
async function uploadCroppedImage(imgId, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
  if (!getImgbbKey()) return null;
  try {
    const url = await uploadToImgbb(dataUrl);
    return url || null;
  } catch(e) {
    return null;
  }
}

// ── IMPORT PINTEREST ──

function extractPinterestOgImage(html) {
  // Plusieurs patterns car Pinterest change son HTML selon la plateforme
  const patterns = [
    /property="og:image"\s+content="([^"]+)"/i,
    /content="([^"]+)"\s+property="og:image"/i,
    /"og:image","content":"([^"]+)"/i,
    /(https:\/\/i\.pinimg\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && (m[1] || m[0])) return m[1] || m[0];
  }
  return null;
}

function setPinterestStatus(msg, type) {
  const el = document.getElementById('img-pinterest-status');
  if (!el) return;
  el.style.display = msg ? '' : 'none';
  el.textContent   = msg;
  el.style.color   = type === 'ok'    ? 'var(--success)'
                   : type === 'error' ? 'var(--danger)'
                   : 'var(--text3)';
}

function loadImageFromDataUrl(dataUrl) {
  document.getElementById('img-preview').src = dataUrl;
  document.getElementById('img-drop-content').style.display = 'none';
  document.getElementById('img-preview-wrap').style.display = '';
  currentOriginalDataUrl = dataUrl;
  currentIsCropped = false;
  currentHostedUrl = null;
  updateCropStatusUI(false, null);
  showHostedZone(editingImageId ? images.find(x => x.id === editingImageId) : null);
}

document.getElementById('btn-img-pinterest')?.addEventListener('click', async () => {
  const input = document.getElementById('img-pinterest-input');
  const url   = (input?.value || '').trim();
  const btn   = document.getElementById('btn-img-pinterest');
  if (!url) { setPinterestStatus('Collez un lien Pinterest.', 'warn'); return; }

  btn.disabled    = true;
  btn.textContent = '⏳ Chargement…';
  setPinterestStatus('Récupération en cours…', 'info');

  try {
    let imageUrl = null;

    // ── CAS 1 : URL directe d'image pinimg.com ──
    if (url.includes('pinimg.com') || /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)) {
      imageUrl = url;
      setPinterestStatus("URL image directe détectée…", "info");
    }

    // ── CAS 2 : URL de pin (pinterest.com/pin/... ou pin.it/...) ──
    if (!imageUrl) {
      setPinterestStatus("Récupération de la page du pin…", "info");
      try {
        const apiUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
        const resp   = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json   = await resp.json();
        const html   = json.contents || '';

        if (html.length < 200) {
          // Pinterest a renvoyé une page vide — bot protection active
          throw new Error("Pinterest a bloqué la requête (page vide). Essayez de copier l'URL directe de l'image (i.pinimg.com/…) depuis le navigateur.");
        }

        imageUrl = extractPinterestOgImage(html);
        if (!imageUrl) {
          throw new Error("Image non trouvée dans la page. Essayez de copier l'URL directe de l'image depuis Pinterest.");
        }
      } catch(e) {
        if (e.message.includes('bloqué') || e.message.includes('non trouvée') || e.message.includes('URL directe')) {
          throw e;
        }
        throw new Error('Impossible de récupérer la page : ' + e.message);
      }
    }

    // ── Charger l'image via weserv (CORS-safe sur tous supports) ──
    setPinterestStatus("Chargement de l'image…", "info");
    const weservUrl = 'https://images.weserv.nl/?url=' + encodeURIComponent(imageUrl) + '&output=jpg';
    const imgResp   = await fetch(weservUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgResp.ok) throw new Error('Impossible de charger l\u2019image (weserv HTTP ' + imgResp.status + ').');

    const blob   = await imgResp.blob();
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });

    loadImageFromDataUrl(dataUrl);
    setPinterestStatus('✓ Image importée depuis Pinterest !', 'ok');
    input.value = '';

  } catch(e) {
    setPinterestStatus('✕ ' + e.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '⬇ Importer';
  }
});

// Permettre aussi d'importer en appuyant sur Entrée dans le champ
document.getElementById('img-pinterest-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-img-pinterest')?.click();
});

async function saveImage() {
  const preview   = document.getElementById('img-preview');
  const dataUrl   = preview.dataset.showingOriginal==='true' ? (preview.dataset.croppedSrc||preview.src) : preview.src;
  const statusEl  = document.getElementById('img-crop-status');
  const isCropped = currentIsCropped;
  if (!dataUrl||!dataUrl.startsWith('data:image')) {
    if (!editingImageId) { toast('Veuillez sélectionner une image.','error'); return; }
  }
  if (editingImageId) {
    const img = images.find(x=>x.id===editingImageId);
    if (!img) return;
    if (img.prenomId !== (selectedPrenomForImage?selectedPrenomForImage.id:null)) {
      if (img.prenomId) { const old=prenoms.find(x=>x.id===img.prenomId); if(old){old.hasImage=false;old.imageId=null;await dbPut('prenoms',old);} }
      if (selectedPrenomForImage) { selectedPrenomForImage.hasImage=true; selectedPrenomForImage.imageId=img.id; await dbPut('prenoms',selectedPrenomForImage); }
    }
    if (dataUrl&&dataUrl.startsWith('data:image')) {
      img.dataUrl=dataUrl; img.isCropped=isCropped;
      if(currentOriginalDataUrl) img.originalDataUrl=currentOriginalDataUrl;
      // Invalider hostedUrl seulement si l'image a changé ET qu'on n'a pas re-uploadé
      if (img.hostedUrl && !currentHostedUrl && currentOriginalDataUrl && dataUrl !== img.dataUrl) { img.hostedUrl = null; }
      // Appliquer le nouvel hostedUrl si uploadé manuellement pendant cette session
      if (currentHostedUrl) { img.hostedUrl = currentHostedUrl; }
    }
    img.prenomId=selectedPrenomForImage?selectedPrenomForImage.id:null;
    img.tags=selectedTagsForImage.slice();
    // Si recadrée et pas encore de croppedHostedUrl → uploader via imgbb ou Firebase Storage
    if (img.isCropped && dataUrl && dataUrl.startsWith('data:image') && !img.croppedHostedUrl) {
      img.croppedHostedUrl = await uploadCroppedImage(img.id, dataUrl);
    }
    await dbPut('images',img);
    // Synchroniser les tags de l'image vers le prénom associé
    if (selectedPrenomForImage) {
      const p = prenoms.find(x=>x.id===selectedPrenomForImage.id);
      if (p) {
        const merged = Array.from(new Set([...(p.tags||[]), ...selectedTagsForImage]));
        if (merged.length !== (p.tags||[]).length || merged.some(t=>!(p.tags||[]).includes(t))) {
          p.tags = merged;
          await dbPut('prenoms', p);
        }
      }
    }
    toast('Image modifiée.','success'); logHistory('Image modifiée', 'image');
  } else {
    const img={ id:uid(), dataUrl, isCropped, originalDataUrl:currentOriginalDataUrl||dataUrl, prenomId:selectedPrenomForImage?selectedPrenomForImage.id:null, tags:selectedTagsForImage.slice(), createdAt:Date.now(), hostedUrl: currentHostedUrl };
    // Auto-upload : imgbb si clé dispo, sinon Firebase Storage
    if (!img.hostedUrl) {
      const uploadedUrl = await uploadCroppedImage(img.id, dataUrl);
      if (uploadedUrl) {
        img.hostedUrl = uploadedUrl;
        if (isCropped) img.croppedHostedUrl = uploadedUrl;
        toast('Image ajoutée et hébergée ✓', 'success');
      } else {
        toast('Image ajoutée (hébergement indisponible — sync limitée)', 'info');
      }
    } else if (isCropped && !img.croppedHostedUrl) {
      img.croppedHostedUrl = await uploadCroppedImage(img.id, dataUrl);
    }
    if (isCropped) updateCropStatusUI(true, currentOriginalDataUrl || null, !!(img.croppedHostedUrl));
    await dbPut('images',img); images.push(img);
    if (selectedPrenomForImage) {
      const p = prenoms.find(x=>x.id===selectedPrenomForImage.id) || selectedPrenomForImage;
      p.hasImage = true;
      p.imageId  = img.id;
      // Synchroniser les tags de l'image vers le prénom
      const merged = Array.from(new Set([...(p.tags||[]), ...selectedTagsForImage]));
      p.tags = merged;
      await dbPut('prenoms', p);
    }
    if (!getImgbbKey()) toast('Image ajoutée.','success'); logHistory('Image ajoutée', 'image');
  }
  currentOriginalDataUrl=null; currentHostedUrl=null;
  document.getElementById('modal-image').classList.remove('open');
  editingImageId=null; selectedPrenomForImage=null;
  renderImages(); renderPrenoms(); updateStats();
}

document.getElementById('btn-add-image').addEventListener('click',     () => openImageModal());
document.getElementById('modal-image-close').addEventListener('click',  () => { document.getElementById('modal-image').classList.remove('open'); currentOriginalDataUrl=null; });
document.getElementById('modal-image-cancel').addEventListener('click', () => { document.getElementById('modal-image').classList.remove('open'); currentOriginalDataUrl=null; });
document.getElementById('modal-image-save').addEventListener('click',   saveImage);
document.getElementById('btn-create-tag-img').addEventListener('click', () => {
  openTagModal(newTag => { selectedTagsForImage.push(newTag.id); renderImgTagChips(); });
});

// Détail image
function openImageDetail(img) {
  const p = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
  document.getElementById('modal-image-detail-name').textContent = p ? p.name : 'Image sans prénom';
  document.getElementById('modal-image-detail-img').src  = img.dataUrl||img.hostedUrl||'';
  const imgTags = (img.tags||[]).map(tid=>tags.find(t=>t.id===tid)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"fr",{sensitivity:"base"}));
  document.getElementById('modal-image-detail-info').innerHTML =
    (p ? `<span class="badge badge-success">✓ Lié à ${esc(p.name)}</span>` : '<span class="badge badge-warn">◌ Sans prénom</span>')
    + (img.isCropped ? '<span class="badge badge-success" style="font-size:10px;">✂ Recadrée</span>' : '<span class="badge badge-warn" style="font-size:10px;">◌ Non recadrée</span>')
    + (img.hostedUrl ? '<span class="badge badge-success" style="font-size:10px;">✧ Hébergée</span>' : '')
    + (img.pinterestUrl ? `<a href="${img.pinterestUrl}" target="_blank" rel="noopener" class="badge" style="font-size:10px;background:rgba(230,0,35,0.15);color:#e60023;border-color:rgba(230,0,35,0.3);text-decoration:none;">📌 Voir sur Pinterest</a>` : '')
    + imgTags.map(tagPillHtml).join('');
  // Lien hébergé
  const urlRow = document.getElementById('modal-image-detail-url-row');
  if (img.hostedUrl) {
    urlRow.style.display = '';
    const urlEl = document.getElementById('modal-image-detail-url');
    urlEl.href = img.hostedUrl;
    urlEl.textContent = img.hostedUrl;
    document.getElementById('modal-image-detail-copy-url').onclick = () => {
      navigator.clipboard.writeText(img.hostedUrl).then(() => toast('Lien copié !','success'));
    };
  } else {
    urlRow.style.display = 'none';
  }
  document.getElementById('modal-image-detail').classList.add('open');
  document.getElementById('modal-image-detail-delete').onclick = () => {
    document.getElementById('modal-image-detail').classList.remove('open');
    openConfirm('Supprimer cette image ?', async () => {
      if (img.prenomId) { const pr=prenoms.find(x=>x.id===img.prenomId); if(pr){pr.hasImage=false;pr.imageId=null;await dbPut('prenoms',pr);} }
      await dbDelete('images',img.id); images=images.filter(x=>x.id!==img.id);
      toast('Image supprimée.','success'); logHistory('Image supprimée', 'image'); renderImages(); renderPrenoms(); updateStats();
    });
  };
  document.getElementById('modal-image-detail-edit').onclick = () => {
    document.getElementById('modal-image-detail').classList.remove('open');
    // Délai pour éviter le ghost click mobile (300ms touch delay)
    setTimeout(() => openImageModal(img), 50);
  };
  document.getElementById('modal-image-detail-download').onclick = () => {
    if (!img.dataUrl) { toast('Aucune image locale à télécharger.', 'error'); return; }
    const p2 = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
    const name = (p2 ? p2.name.replace(/[^a-zA-Z0-9\-_]/g, '_') : 'image') + (img.isCropped ? '_crop' : '');
    const ext  = img.dataUrl.startsWith('data:image/png') ? 'png' : img.dataUrl.startsWith('data:image/webp') ? 'webp' : 'jpg';
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = `${name}.${ext}`;
    a.click();
  };
}('click',  () => document.getElementById('modal-image-detail').classList.remove('open'));
document.getElementById('modal-image-detail-close').addEventListener('click',  () => document.getElementById('modal-image-detail').classList.remove('open'));
document.getElementById('modal-image-detail-close2').addEventListener('click', () => document.getElementById('modal-image-detail').classList.remove('open'));

// ── CROP ENGINE ──
let cropImg = null, cropState = {scale:1, offX:0, offY:0};
let cropDragging = false, cropDragStart = {x:0, y:0, offX:0, offY:0};
let cropCallback = null;

function openCropModal(dataUrl, cb) {
  cropCallback = cb;
  // Ouvrir le modal AVANT de mesurer le container (sinon clientWidth = 0 sur mobile)
  document.getElementById('modal-crop').classList.add('open');
  requestAnimationFrame(() => {
    const canvas    = document.getElementById('crop-canvas');
    const container = document.getElementById('crop-container');
    // Laisser une marge pour le padding du modal sur mobile
    const maxSize = Math.min(window.innerWidth - 32, window.innerHeight - 200, 440);
    const size    = Math.min(container.clientWidth || maxSize, maxSize);
    canvas.width=size; canvas.height=size;
    canvas.style.width=size+'px'; canvas.style.height=size+'px';
    cropImg = new Image();
    cropImg.onload = () => {
      const sx=size/cropImg.width, sy=size/cropImg.height;
      cropState.scale  = Math.max(sx,sy)*100;
      cropState.offX   = (size - cropImg.width*cropState.scale/100)/2;
      cropState.offY   = (size - cropImg.height*cropState.scale/100)/2;
      document.getElementById('crop-zoom').value = Math.round(cropState.scale);
      document.getElementById('crop-zoom-label').textContent = Math.round(cropState.scale)+'%';
      drawCrop();
    };
    cropImg.src = dataUrl;
  });
}

function drawCrop() {
  const canvas = document.getElementById('crop-canvas');
  const ctx    = canvas.getContext('2d');
  const s      = canvas.width;
  ctx.clearRect(0,0,s,s);
  ctx.fillStyle='#0f0d17'; ctx.fillRect(0,0,s,s);
  if (!cropImg) return;
  ctx.drawImage(cropImg, cropState.offX, cropState.offY, cropImg.width*cropState.scale/100, cropImg.height*cropState.scale/100);
  // Overlay sombre hors cercle
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,s,s);
  ctx.arc(s/2, s/2, s/2-2, 0, Math.PI*2, true);
  ctx.fillStyle='rgba(0,0,0,0.52)'; ctx.fill();
  ctx.restore();
  // Cercle Discord
  ctx.beginPath(); ctx.arc(s/2,s/2,s/2-2,0,Math.PI*2);
  ctx.strokeStyle='rgba(201,160,220,0.6)'; ctx.lineWidth=2.5; ctx.stroke();
  // Croix centrale
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(s/2-15,s/2); ctx.lineTo(s/2+15,s/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s/2,s/2-15); ctx.lineTo(s/2,s/2+15); ctx.stroke();
}

function clampCrop() {
  const canvas = document.getElementById('crop-canvas');
  const s = canvas.width;
  const iw = cropImg.width*cropState.scale/100;
  const ih = cropImg.height*cropState.scale/100;
  cropState.offX = Math.min(0, Math.max(s-iw, cropState.offX));
  cropState.offY = Math.min(0, Math.max(s-ih, cropState.offY));
}

document.getElementById('crop-canvas').addEventListener('mousedown', e => { cropDragging=true; cropDragStart={x:e.clientX,y:e.clientY,offX:cropState.offX,offY:cropState.offY}; e.preventDefault(); });
document.addEventListener('mousemove', e => { if(!cropDragging||!cropImg)return; cropState.offX=cropDragStart.offX+(e.clientX-cropDragStart.x); cropState.offY=cropDragStart.offY+(e.clientY-cropDragStart.y); clampCrop(); drawCrop(); });
document.addEventListener('mouseup', () => { cropDragging=false; });
let pinchStartDist = 0, pinchStartScale = 1;
document.getElementById('crop-canvas').addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    cropDragging = true;
    const t = e.touches[0];
    cropDragStart = {x:t.clientX, y:t.clientY, offX:cropState.offX, offY:cropState.offY};
  } else if (e.touches.length === 2) {
    cropDragging = false;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchStartDist  = Math.hypot(dx, dy);
    pinchStartScale = cropState.scale;
  }
  e.preventDefault();
}, {passive:false});
document.getElementById('crop-canvas').addEventListener('touchmove', e => {
  if (e.touches.length === 2 && cropImg) {
    // Pinch zoom
    const dx   = e.touches[0].clientX - e.touches[1].clientX;
    const dy   = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / pinchStartDist;
    const newScale = Math.max(10, Math.min(400, pinchStartScale * ratio));
    const s = document.getElementById('crop-canvas').width;
    cropState.offX = s/2 - (s/2 - cropState.offX) * (newScale / cropState.scale);
    cropState.offY = s/2 - (s/2 - cropState.offY) * (newScale / cropState.scale);
    cropState.scale = newScale;
    clampCrop(); drawCrop();
    document.getElementById('crop-zoom').value = Math.round(newScale);
    document.getElementById('crop-zoom-label').textContent = Math.round(newScale) + '%';
  } else if (cropDragging && cropImg && e.touches.length === 1) {
    const t = e.touches[0];
    cropState.offX = cropDragStart.offX + (t.clientX - cropDragStart.x);
    cropState.offY = cropDragStart.offY + (t.clientY - cropDragStart.y);
    clampCrop(); drawCrop();
  }
  e.preventDefault();
}, {passive:false});
document.getElementById('crop-canvas').addEventListener('touchend', () => { cropDragging = false; });
document.getElementById('crop-canvas').addEventListener('wheel', e => {
  if (!cropImg) return; e.preventDefault();
  const canvas=document.getElementById('crop-canvas'); const s=canvas.width;
  const delta   = e.deltaY>0 ? -4 : 4;
  const prevScale = cropState.scale;
  cropState.scale = Math.max(10, Math.min(400, cropState.scale+delta));
  cropState.offX  = s/2 - (s/2 - cropState.offX)*(cropState.scale/prevScale);
  cropState.offY  = s/2 - (s/2 - cropState.offY)*(cropState.scale/prevScale);
  clampCrop(); drawCrop();
  document.getElementById('crop-zoom').value = Math.round(cropState.scale);
  document.getElementById('crop-zoom-label').textContent = Math.round(cropState.scale)+'%';
},{passive:false});
document.getElementById('crop-zoom').addEventListener('input', function() {
  if (!cropImg) return;
  const canvas=document.getElementById('crop-canvas'); const s=canvas.width;
  const prev  = cropState.scale;
  cropState.scale = Number(this.value);
  cropState.offX  = s/2-(s/2-cropState.offX)*(cropState.scale/prev);
  cropState.offY  = s/2-(s/2-cropState.offY)*(cropState.scale/prev);
  clampCrop(); drawCrop();
  document.getElementById('crop-zoom-label').textContent = Math.round(cropState.scale)+'%';
});
document.getElementById('btn-crop-reset').addEventListener('click', () => {
  if (!cropImg) return;
  const canvas=document.getElementById('crop-canvas'); const s=canvas.width;
  const sx=s/cropImg.width, sy=s/cropImg.height;
  cropState.scale=Math.max(sx,sy)*100;
  cropState.offX=(s-cropImg.width*cropState.scale/100)/2;
  cropState.offY=(s-cropImg.height*cropState.scale/100)/2;
  document.getElementById('crop-zoom').value=Math.round(cropState.scale);
  document.getElementById('crop-zoom-label').textContent=Math.round(cropState.scale)+'%';
  drawCrop();
});
document.getElementById('modal-crop-validate').addEventListener('click', () => {
  if (!cropImg) return;
  const srcCanvas = document.getElementById('crop-canvas');
  const out=document.createElement('canvas'); out.width=srcCanvas.width; out.height=srcCanvas.height;
  out.getContext('2d').drawImage(cropImg, cropState.offX, cropState.offY, cropImg.width*cropState.scale/100, cropImg.height*cropState.scale/100);
  const croppedUrl = out.toDataURL('image/png');
  document.getElementById('modal-crop').classList.remove('open');
  if (cropCallback) cropCallback(croppedUrl);
  cropCallback=null;
});
document.getElementById('modal-crop-close').addEventListener('click',  () => { document.getElementById('modal-crop').classList.remove('open'); cropCallback=null; });
document.getElementById('modal-crop-cancel').addEventListener('click', () => { document.getElementById('modal-crop').classList.remove('open'); cropCallback=null; });
document.getElementById('btn-img-crop').addEventListener('click', () => {
  const src=document.getElementById('img-preview').src;
  if(!src||!src.startsWith('data:image')){ toast('Chargez d\'abord une image.','error'); return; }
  if (!currentOriginalDataUrl) currentOriginalDataUrl=src;
  openCropModal(src, croppedUrl => {
    document.getElementById('img-preview').src=croppedUrl;
    document.getElementById('img-drop-content').style.display='none';
    document.getElementById('img-preview-wrap').style.display='';
    currentIsCropped = true;
    updateCropStatusUI(true, currentOriginalDataUrl, false);
    // Mettre à jour la zone hébergée : recadrage pas encore hébergé
    const _editImg = editingImageId ? images.find(x => x.id === editingImageId) : null;
    showHostedZone(_editImg ? Object.assign({}, _editImg, { isCropped: true, croppedHostedUrl: null }) : null);
    toast('Image recadrée !','success'); logHistory('Image recadrée', 'image');
  });
});

// ── HÉBERGEMENT AUTOMATIQUE (imgbb.com) ──
// imgbb supporte CORS depuis le navigateur, clé API gratuite requise
// Obtenir une clé : https://api.imgbb.com/ (inscription gratuite)

const IMGBB_KEY_STORAGE = 'ps-imgbb-key';

function getImgbbKey() {
  return localStorage.getItem(IMGBB_KEY_STORAGE) || '';
}

async function uploadToImgbb(dataUrl) {
  const key = getImgbbKey();
  if (!key) throw new Error('NO_KEY');

  // imgbb attend le base64 sans le header "data:image/...;base64,"
  const base64 = dataUrl.split(',')[1];

  const form = new FormData();
  form.append('image', base64);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: 'POST',
    body: form,
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message || 'Erreur imgbb');
  // Utiliser l'URL directe (lien vers le fichier image brut)
  return json.data.url;
}

document.getElementById('btn-upload-catbox').addEventListener('click', async () => {
  const preview = document.getElementById('img-preview');
  const dataUrl = preview.dataset.showingOriginal==='true'
    ? (preview.dataset.croppedSrc||preview.src)
    : preview.src;

  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    toast('Chargez d\'abord une image.','error');
    return;
  }

  // Vérifier si une clé est configurée
  if (!getImgbbKey()) {
    // Proposer de saisir la clé
    const key = window.prompt(
      'Clé API imgbb requise.\n\n' +
      '1. Allez sur https://api.imgbb.com/\n' +
      '2. Créez un compte gratuit\n' +
      '3. Copiez votre clé API\n\n' +
      'Collez votre clé ici (elle sera sauvegardée localement) :'
    );
    if (!key || !key.trim()) return;
    localStorage.setItem(IMGBB_KEY_STORAGE, key.trim());
    toast('Clé API imgbb sauvegardée.','success');
  }

  const btn      = document.getElementById('btn-upload-catbox');
  const progress = document.getElementById('img-upload-progress');
  const bar      = document.getElementById('img-upload-bar');
  const status   = document.getElementById('img-upload-status');

  btn.disabled = true;
  btn.textContent = '…';
  progress.style.display = '';
  status.textContent = 'Upload en cours…';
  bar.style.width = '40%';

  try {
    const url = await uploadToImgbb(dataUrl);
    bar.style.width = '100%';
    status.textContent = '✓ Hébergée avec succès';

    // Sauvegarder l'URL dans l'objet image si déjà enregistrée
    currentHostedUrl = url; // toujours mémoriser pour saveImage
    if (editingImageId) {
      const img = images.find(x=>x.id===editingImageId);
      if (img) { img.hostedUrl = url; await dbPut('images', img); }
    }
    // Toujours rafraîchir les cartes et la zone hébergée
    renderImages();
    showHostedZone({ hostedUrl: url });

    setTimeout(() => { progress.style.display='none'; bar.style.width='0%'; }, 1500);
    toast('Image hébergée sur imgbb !','success');
  } catch(e) {
    bar.style.width = '0%';
    if (e.message === 'NO_KEY') {
      status.textContent = '✕ Aucune clé API';
    } else if (e.message.includes('400') || e.message.includes('key')) {
      status.textContent = '✕ Clé API invalide';
      localStorage.removeItem(IMGBB_KEY_STORAGE); // reset pour re-saisie
      toast('Clé API invalide — elle a été effacée, réessayez.','error');
    } else {
      status.textContent = '✕ ' + e.message;
      toast('Échec de l\'upload : ' + e.message,'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '↑ Héberger';
  }
});

document.getElementById('btn-copy-hosted-url').addEventListener('click', () => {
  const url = document.getElementById('img-hosted-url').textContent.trim();
  if (url && url.startsWith('http')) {
    navigator.clipboard.writeText(url).then(() => toast('Lien copié !','success'));
  }
});
