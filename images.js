// ── IMAGES ──
let imgSort = 'chrono', imgSearch = '', imgTagFilterMap = new Map(), imgUnlinkedOnly = false;
let editingImageId = null, selectedPrenomForImage = null, selectedTagsForImage = [];
let currentOriginalDataUrl = null;

function renderImgTagFilters() {
  const row  = document.getElementById('img-tag-filter-row');
  const cont = document.getElementById('img-tag-filters');
  if (tags.length===0) { row.style.display='none'; return; }
  row.style.display='flex';
  cont.innerHTML = tagsSorted().map(t => {
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
      const s  = imgTagFilterMap.get(id) || 0;
      if      (s ===  0) imgTagFilterMap.set(id,  1);
      else if (s ===  1) imgTagFilterMap.set(id, -1);
      else               imgTagFilterMap.delete(id);
      renderImgTagFilters(); renderImages();
    });
  });
}

function getFilteredImages() {
  let list = images.slice();
  if (imgUnlinkedOnly) list = list.filter(img => !img.prenomId);
  if (imgSearch) {
    const q = imgSearch.toLowerCase();
    list = list.filter(img => {
      const p = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
      if (p && p.name.toLowerCase().includes(q)) return true;
      return (img.tags||[]).some(tid => { const t=tags.find(x=>x.id===tid); return t&&t.name.toLowerCase().includes(q); });
    });
  }
  for (const [tid, state] of imgTagFilterMap) {
    if (state ===  1) list = list.filter(img =>  (img.tags||[]).includes(tid));
    if (state === -1) list = list.filter(img => !(img.tags||[]).includes(tid));
  }
  if (imgSort==='alpha') list.sort((a,b)=>{
    const pa=a.prenomId?prenoms.find(x=>x.id===a.prenomId):null;
    const pb=b.prenomId?prenoms.find(x=>x.id===b.prenomId):null;
    return (pa?pa.name:'zzz').localeCompare(pb?pb.name:'zzz','fr');
  });
  else list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return list;
}

function renderImages() {
  const list  = getFilteredImages();
  const grid  = document.getElementById('images-grid');
  const empty = document.getElementById('images-empty');
  const lbl   = document.getElementById('images-count-label');
  lbl.textContent = `${images.length} image${images.length!==1?'s':''}`;
  if (list.length===0) { grid.style.display='none'; empty.style.display=''; return; }
  grid.style.display='grid'; empty.style.display='none';

  grid.innerHTML = list.map(img => {
    const p       = img.prenomId ? prenoms.find(x=>x.id===img.prenomId) : null;
    const imgTags = (img.tags||[]).map(tid=>tags.find(t=>t.id===tid)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"fr",{sensitivity:"base"}));
    const tagsHtml = imgTags.slice(0,3).map(tagPillHtml).join('');
    return `<div class="image-card" data-img-id="${img.id}">
      ${img.dataUrl ? `<img class="image-card-thumb" src="${img.dataUrl}" loading="lazy" />` : '<div class="image-card-thumb-placeholder">◈</div>'}
      <div class="image-card-body">
        <div class="image-card-name${p?'':' unlinked'}">${p?esc(p.name):'Sans prénom'}</div>
        ${imgTags.length>0 ? `<div class="image-card-tags">${tagsHtml}${imgTags.length>3?`<span style="font-size:11px;color:var(--text3);">+${imgTags.length-3}</span>`:''}</div>` : ''}
        <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px;">
          ${img.isCropped
            ? '<span class="badge badge-success" style="font-size:10px;">✂ Recadrée</span>'
            : '<span class="badge badge-warn" style="font-size:10px;">◌ Non recadrée</span>'}
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
    } else {
      imgSort = btn.dataset.imgSort;
      document.querySelectorAll('[data-img-sort]:not([data-img-sort="unlinked"])').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    }
    renderImages();
  });
});
document.getElementById('image-search').addEventListener('input', e => { imgSearch=e.target.value.trim(); renderImages(); });

// ── MODAL IMAGE ──
function openImageModal(img) {
  img = img||null;
  editingImageId      = img ? img.id : null;
  selectedPrenomForImage = null;
  selectedTagsForImage   = img ? (img.tags||[]).slice() : [];
  currentOriginalDataUrl = img ? (img.originalDataUrl||null) : null;
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
  if (img && img.dataUrl) {
    document.getElementById('img-preview').src = img.dataUrl;
    document.getElementById('img-drop-content').style.display='none';
    document.getElementById('img-preview-wrap').style.display='';
    updateCropStatusUI(img.isCropped, img.originalDataUrl);
    showHostedZone(img);
  }
  if (img && img.prenomId) { const p=prenoms.find(x=>x.id===img.prenomId); if(p) selectPrenomForImage(p); }
  renderImgTagChips();
  document.getElementById('modal-image').classList.add('open');
}

function showHostedZone(img) {
  const wrap = document.getElementById('img-hosted-wrap');
  wrap.style.display = '';
  if (img && img.hostedUrl) {
    document.getElementById('img-hosted-url').textContent = img.hostedUrl;
    document.getElementById('btn-copy-hosted-url').style.display = '';
  } else {
    document.getElementById('img-hosted-url').innerHTML = '<span style="color:var(--text3);font-style:italic;">Non hébergée — cliquez pour générer un lien</span>';
    document.getElementById('btn-copy-hosted-url').style.display = 'none';
  }
}

function updateCropStatusUI(isCropped, originalDataUrl) {
  const el = document.getElementById('img-crop-status');
  if (!isCropped) { el.innerHTML='<span style="color:var(--text3);">◌ Image non recadrée</span>'; return; }
  el.innerHTML = '<span style="color:var(--success);">✂ Image recadrée</span>'
    + (originalDataUrl ? ' · <button class="btn btn-ghost btn-sm" id="btn-show-original" style="padding:2px 8px;font-size:11px;">Voir originale</button>' : '');
  const btn = el.querySelector('#btn-show-original');
  if (btn) {
    btn.addEventListener('click', () => {
      const prev = document.getElementById('img-preview');
      if (prev.dataset.showingOriginal==='true') {
        const img = editingImageId ? images.find(x=>x.id===editingImageId) : null;
        prev.src = (img && img.dataUrl) ? img.dataUrl : (prev.dataset.croppedSrc||prev.src);
        prev.dataset.showingOriginal='false';
        btn.textContent='Voir originale';
      } else {
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
}

document.getElementById('img-prenom-input').addEventListener('input', function() {
  const q  = this.value.trim();
  const dd = document.getElementById('img-prenom-dropdown');
  if (!q) { dd.style.display='none'; return; }
  const matches = prenoms.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())).slice(0,12);
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
    updateCropStatusUI(false, null);
    // Nouvelle image chargée : on efface l'ancienne URL hébergée si c'était une édition
    showHostedZone(editingImageId ? images.find(x=>x.id===editingImageId) : null);
  };
  reader.readAsDataURL(file);
}

async function saveImage() {
  const preview   = document.getElementById('img-preview');
  const dataUrl   = preview.dataset.showingOriginal==='true' ? (preview.dataset.croppedSrc||preview.src) : preview.src;
  const statusEl  = document.getElementById('img-crop-status');
  const isCropped = statusEl.innerHTML.includes('Recadrée');
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
      // Si l'image a changé, on invalide l'URL hébergée
      if (img.hostedUrl && currentOriginalDataUrl) { img.hostedUrl = null; }
    }
    img.prenomId=selectedPrenomForImage?selectedPrenomForImage.id:null;
    img.tags=selectedTagsForImage.slice();
    await dbPut('images',img);
    toast('Image modifiée.','success'); logHistory('Image modifiée', 'image');
  } else {
    const img={ id:uid(), dataUrl, isCropped, originalDataUrl:currentOriginalDataUrl||dataUrl, prenomId:selectedPrenomForImage?selectedPrenomForImage.id:null, tags:selectedTagsForImage.slice(), createdAt:Date.now(), hostedUrl:null };
    // Auto-upload imgbb si clé disponible
    if (getImgbbKey()) {
      try {
        img.hostedUrl = await uploadToImgbb(dataUrl);
        toast('Image ajoutée et hébergée ✓','success');
      } catch(e) {
        toast('Image ajoutée (hébergement échoué — sync limitée)','info');
      }
    }
    await dbPut('images',img); images.push(img);
    if (selectedPrenomForImage) { selectedPrenomForImage.hasImage=true; selectedPrenomForImage.imageId=img.id; await dbPut('prenoms',selectedPrenomForImage); }
    if (!getImgbbKey()) toast('Image ajoutée.','success'); logHistory('Image ajoutée', 'image');
  }
  currentOriginalDataUrl=null;
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
  document.getElementById('modal-image-detail-img').src  = img.dataUrl||'';
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
    openImageModal(img);
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
document.getElementById('modal-image-detail-close2').addEventListener('click', () => document.getElementById('modal-image-detail').classList.remove('open'));

// ── CROP ENGINE ──
let cropImg = null, cropState = {scale:1, offX:0, offY:0};
let cropDragging = false, cropDragStart = {x:0, y:0, offX:0, offY:0};
let cropCallback = null;

function openCropModal(dataUrl, cb) {
  cropCallback = cb;
  const canvas    = document.getElementById('crop-canvas');
  const container = document.getElementById('crop-container');
  const size      = Math.min(container.clientWidth||440, 440);
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
  document.getElementById('modal-crop').classList.add('open');
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
document.getElementById('crop-canvas').addEventListener('touchstart', e => { if(e.touches.length===1){cropDragging=true;const t=e.touches[0];cropDragStart={x:t.clientX,y:t.clientY,offX:cropState.offX,offY:cropState.offY};e.preventDefault();}},{passive:false});
document.getElementById('crop-canvas').addEventListener('touchmove',  e => { if(!cropDragging||!cropImg||e.touches.length!==1)return;const t=e.touches[0];cropState.offX=cropDragStart.offX+(t.clientX-cropDragStart.x);cropState.offY=cropDragStart.offY+(t.clientY-cropDragStart.y);clampCrop();drawCrop();e.preventDefault();},{passive:false});
document.getElementById('crop-canvas').addEventListener('touchend',   () => { cropDragging=false; });
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
    updateCropStatusUI(true, currentOriginalDataUrl);
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
    if (editingImageId) {
      const img = images.find(x=>x.id===editingImageId);
      if (img) { img.hostedUrl = url; await dbPut('images', img); renderImages(); }
    }

    // Afficher l'URL et activer le bouton copier
    document.getElementById('img-hosted-url').textContent = url;
    document.getElementById('btn-copy-hosted-url').style.display = '';

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
