// ── CONFIGURATION PAGE ──

// ── HISTORIQUE DES MODIFICATIONS ──
const HISTORY_KEY = 'ps-history';
const HISTORY_MAX = 200;

const HISTORY_COLORS = {
  prenom:  { dot: '#c9a0dc', label: 'Prénom' },
  image:   { dot: '#78b4dc', label: 'Image' },
  proxy:   { dot: '#e8c87a', label: 'Proxy' },
  tag:     { dot: '#7ec8a0', label: 'Tag' },
  profil:  { dot: '#e8a0b4', label: 'Profil' },
  system:  { dot: '#6b5f80', label: 'Système' },
};

function logHistory(action, type='system') {
  const entries = getHistory();
  entries.unshift({ action, type, ts: Date.now() });
  if (entries.length > HISTORY_MAX) entries.splice(HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  // Sync vers Firestore via IndexedDB (document unique 'history-log')
  if (typeof dbPut === 'function') {
    dbPut('settings', { key: 'history-log', entries }).catch(() => {});
  }
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

// Charger les logs depuis Firestore si disponible (appelé après pull)
async function loadHistoryFromCloud() {
  if (typeof dbGet !== 'function') return;
  try {
    const stored = await dbGet('settings', 'history-log');
    if (stored && stored.entries && stored.entries.length > 0) {
      // Fusionner les logs cloud avec les logs locaux
      const local  = getHistory();
      const cloud  = stored.entries;
      const merged = [...local, ...cloud];
      // Dédupliquer par ts+action et trier par date décroissante
      const seen = new Set();
      const deduped = merged.filter(e => {
        const key = `${e.ts}-${e.action}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).sort((a, b) => b.ts - a.ts).slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped));
      renderHistoryLog();
    }
  } catch(e) { /* silencieux */ }
}

function renderHistoryLog() {
  const log   = document.getElementById('history-log');
  const empty = document.getElementById('history-empty');
  if (!log) return;
  const entries = getHistory();
  if (entries.length===0) { log.innerHTML=''; empty.style.display=''; return; }
  empty.style.display='none';
  log.innerHTML = entries.map(e => {
    const c   = HISTORY_COLORS[e.type] || HISTORY_COLORS.system;
    const ago = formatAgo(e.ts);
    const dt  = new Date(e.ts);
    const dateStr = dt.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
    const timeStr = dt.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    return `<div class="history-entry">
      <div class="history-entry-dot" style="background:${c.dot};"></div>
      <div class="history-entry-body">
        <div class="history-entry-action">${esc(e.action)}</div>
        <div class="history-entry-time">${ago} · ${dateStr} ${timeStr} · <span style="color:${c.dot};">${c.label}</span></div>
      </div>
    </div>`;
  }).join('');
}

function formatAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff/1000);
  if (s<60)  return 'à l\'instant';
  const m = Math.floor(s/60);
  if (m<60)  return `il y a ${m} min`;
  const h = Math.floor(m/60);
  if (h<24)  return `il y a ${h}h`;
  const d = Math.floor(h/24);
  if (d<7)   return `il y a ${d}j`;
  return new Date(ts).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}

document.getElementById('btn-clear-history').addEventListener('click', () => {
  openConfirm('Effacer tout l\'historique ?', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistoryLog();
    toast('Historique effacé.', 'success');
  });
});

// ── THÈMES ──
const THEMES = {
  lavande: { accent:'#c9a0dc', accent2:'#e8c5f5', accent3:'#9b6fb5' },
  rose:    { accent:'#dca0b4', accent2:'#f5c5d8', accent3:'#b56f84' },
  bleu:    { accent:'#a0b4dc', accent2:'#c5d8f5', accent3:'#6f84b5' },
  vert:    { accent:'#a0dcb4', accent2:'#c5f5d8', accent3:'#6fb584' },
  or:      { accent:'#dcc8a0', accent2:'#f5e8c5', accent3:'#b5986f' },
  peche:   { accent:'#dcb4a0', accent2:'#f5d8c5', accent3:'#b5846f' },
};

// Génère accent2 (plus clair) et accent3 (plus sombre) depuis une couleur hex
function hexToAccentVariants(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const h2c = v => v.toString(16).padStart(2,'0');
  return {
    accent:  hex,
    accent2: '#' + h2c(clamp(r+45)) + h2c(clamp(g+45)) + h2c(clamp(b+45)),
    accent3: '#' + h2c(clamp(r-35)) + h2c(clamp(g-35)) + h2c(clamp(b-35)),
  };
}

function setAccentVars(accent, accent2, accent3) {
  const s = document.documentElement.style;
  s.setProperty('--accent',  accent);
  s.setProperty('--accent2', accent2);
  s.setProperty('--accent3', accent3);
}

function applyTheme(name) {
  const t = THEMES[name];
  if (!t) return;
  setAccentVars(t.accent, t.accent2, t.accent3);
  document.querySelectorAll('.theme-color-btn').forEach(b => b.classList.toggle('active', b.dataset.theme===name));
  localStorage.setItem('ps-theme', name);
  localStorage.removeItem('ps-custom-accent');
  syncAccentUI(t.accent);
}

function applyCustomAccent(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const v = hexToAccentVariants(hex);
  setAccentVars(v.accent, v.accent2, v.accent3);
  document.querySelectorAll('.theme-color-btn').forEach(b => b.classList.remove('active'));
  localStorage.setItem('ps-custom-accent', hex);
  syncAccentUI(hex);
  return true;
}

function syncAccentUI(hex) {
  const picker  = document.getElementById('custom-accent-picker');
  const hexInp  = document.getElementById('custom-accent-hex');
  const preview = document.getElementById('custom-accent-preview');
  if (picker  && picker.value !== hex)                   picker.value  = hex;
  if (hexInp  && document.activeElement !== hexInp)      hexInp.value  = hex;
  if (preview) preview.style.background = hex;
}

// ── Listeners couleur accent ──
document.getElementById('theme-color-options').addEventListener('click', e => {
  const btn = e.target.closest('[data-theme]');
  if (btn) applyTheme(btn.dataset.theme);
});

document.getElementById('custom-accent-picker').addEventListener('input', function() {
  syncAccentUI(this.value);
  document.getElementById('custom-accent-hex').value = this.value;
});
document.getElementById('custom-accent-picker').addEventListener('change', function() {
  applyCustomAccent(this.value);
  toast('Couleur appliquée.', 'success');
});

document.getElementById('custom-accent-hex').addEventListener('input', function() {
  const v = this.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    document.getElementById('custom-accent-picker').value = v;
    document.getElementById('custom-accent-preview').style.background = v;
  }
});
document.getElementById('btn-apply-custom-accent').addEventListener('click', () => {
  const hex = document.getElementById('custom-accent-hex').value.trim();
  if (applyCustomAccent(hex)) toast('Couleur appliquée.', 'success');
  else toast('Format invalide — utilisez #RRGGBB', 'error');
});
document.getElementById('btn-reset-accent').addEventListener('click', () => {
  applyTheme('lavande');
  toast('Thème réinitialisé.', 'success');
});

// ── Mode sombre / clair ──
function applyColorMode(mode) {
  document.documentElement.classList.toggle('light-mode', mode === 'light');
  const darkBtn  = document.getElementById('btn-mode-dark');
  const lightBtn = document.getElementById('btn-mode-light');
  if (darkBtn)  darkBtn.classList.toggle('active',  mode !== 'light');
  if (lightBtn) lightBtn.classList.toggle('active', mode === 'light');
  localStorage.setItem('ps-color-mode', mode);
}
document.getElementById('btn-mode-dark').addEventListener('click',  () => applyColorMode('dark'));
document.getElementById('btn-mode-light').addEventListener('click', () => applyColorMode('light'));

// ── Restauration au démarrage ──
const savedColorMode   = localStorage.getItem('ps-color-mode');
if (savedColorMode) applyColorMode(savedColorMode);

const savedCustomAccent = localStorage.getItem('ps-custom-accent');
const savedTheme        = localStorage.getItem('ps-theme');
if (savedCustomAccent) applyCustomAccent(savedCustomAccent);
else if (savedTheme && THEMES[savedTheme]) applyTheme(savedTheme);

// ── POLICE ──
function applyFont(font) {
  document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font===font));
  const prop = font==='dm-sans' ? "'DM Sans', sans-serif" : "'Cormorant Garamond', serif";
  document.documentElement.style.setProperty('--font-names', prop);
  localStorage.setItem('ps-font', font);
}
document.querySelectorAll('[data-font]').forEach(btn => {
  btn.addEventListener('click', () => applyFont(btn.dataset.font));
});
const savedFont = localStorage.getItem('ps-font');
if (savedFont) applyFont(savedFont);

// ── STATS ──
function renderConfigStats() {
  const el = document.getElementById('config-stats-display');
  if (!el) return;
  const stats = [
    { num: prenoms.length,   lbl: 'Prénoms' },
    { num: proxys.length,    lbl: 'Proxys' },
    { num: images.length,    lbl: 'Images' },
    { num: tags.length,      lbl: 'Tags' },
    { num: profils.length,   lbl: 'Profils' },
    { num: prenoms.filter(p=>!p.hasImage).length, lbl: 'Sans image' },
  ];
  el.innerHTML = stats.map(s =>
    `<div class="config-stat-pill"><div class="config-stat-num">${s.num}</div><div class="config-stat-lbl">${s.lbl}</div></div>`
  ).join('');
}

// ── EXPORT JSON ──
document.getElementById('btn-export-data').addEventListener('click', async () => {
  const withImages = document.getElementById('export-include-images')?.checked ?? false;

  // Images : toujours exportées pour préserver les liens (imageId dans prénoms/profils)
  // Par défaut sans les dataUrl (base64) pour garder un fichier léger
  // Si "inclure images complètes" coché, on inclut aussi les dataUrl
  const imagesExport = images.map(img => {
    const base = {
      id: img.id,
      prenomId: img.prenomId,
      isCropped: img.isCropped,
      hostedUrl: img.hostedUrl || null,
      tags: img.tags || [],
      createdAt: img.createdAt,
    };
    if (withImages) {
      base.dataUrl         = img.dataUrl || null;
      base.originalDataUrl = img.originalDataUrl || null;
    }
    return base;
  });

  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    includesImageData: withImages,
    prenoms,
    tags,
    proxys,
    profils,
    images: imagesExport,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `plural-space-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const imgInfo = withImages
    ? ` + ${images.length} image(s) complètes`
    : ` + ${images.length} référence(s) image`;
  toast(`Données exportées${imgInfo}.`, 'success');
});

// ── IMPORT JSON ──
document.getElementById('btn-import-data').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  this.value = '';
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.prenoms && !data.tags && !data.proxys) {
      toast('Fichier invalide — format non reconnu.', 'error');
      return;
    }
    openConfirm('Importer ces données ? Les données actuelles seront FUSIONNÉES (pas remplacées).', async () => {
      let added = { prenoms:0, tags:0, proxys:0, profils:0 };
      // Tags
      for (const t of (data.tags||[])) {
        if (!tags.find(x=>x.id===t.id)) { await dbPut('tags', t); tags.push(t); added.tags++; }
      }
      // Prénoms
      for (const p of (data.prenoms||[])) {
        if (!prenoms.find(x=>x.id===p.id)) { await dbPut('prenoms', p); prenoms.push(p); added.prenoms++; }
      }
      // Proxys
      for (const px of (data.proxys||[])) {
        if (!proxys.find(x=>x.id===px.id)) { await dbPut('proxys', px); proxys.push(px); added.proxys++; }
      }
      // Profils
      for (const pr of (data.profils||[])) {
        if (!profils.find(x=>x.id===pr.id)) { await dbPut('profils', pr); profils.push(pr); added.profils++; }
      }
      // Images (présentes depuis version 2, ou si incluses manuellement)
      added.images = 0;
      for (const img of (data.images||[])) {
        if (!images.find(x=>x.id===img.id)) {
          await dbPut('images', img);
          images.push(img);
          added.images++;
          // Mettre à jour hasImage sur le prénom lié si nécessaire
          const p = prenoms.find(x=>x.id===img.prenomId);
          if (p && !p.hasImage) {
            p.hasImage = true;
            p.imageId  = p.imageId || img.id;
            await dbPut('prenoms', p);
          }
        } else {
          // Image déjà existante : mettre à jour dataUrl/originalDataUrl si maintenant disponibles
          const existing = images.find(x=>x.id===img.id);
          if (existing && !existing.dataUrl && img.dataUrl) {
            existing.dataUrl         = img.dataUrl;
            existing.originalDataUrl = img.originalDataUrl || img.dataUrl;
            await dbPut('images', existing);
          }
        }
      }
      const imgMsg = added.images > 0 ? `, +${added.images} images` : '';
      toast(`Import terminé : +${added.prenoms} prénoms, +${added.tags} tags, +${added.proxys} proxys, +${added.profils} profils${imgMsg}.`, 'success');
      renderPrenoms(); renderTagsPage(); renderTagsPrenomView(); renderProxys(); renderProfils();
      renderImages(); renderTagFilters(); renderImgTagFilters(); renderNoProxyBanner(); updateStats(); renderConfigStats();
    });
  } catch(e) {
    toast('Erreur lors de la lecture du fichier.', 'error');
  }
});

// ── EXPORT PLURALKIT ──
document.getElementById('btn-export-pk').addEventListener('click', () => {
  const members = profils.map(pr => {
    const p      = prenoms.find(x=>x.id===pr.prenomId);
    const name   = p ? p.name : (pr.name||'Inconnu');
    const img    = pr.imageId ? images.find(x=>x.id===pr.imageId) : null;
    const pxList = proxys.filter(x=>x.prenomId===pr.prenomId);

    const member = {
      id:          pr.id.slice(0,5),  // PK attend des IDs courts
      name:        name,
      display_name: null,
      description: pr.bio || null,
      pronouns:    pr.pronouns || null,
      color:       pr.color ? pr.color.replace('#','') : null,
      avatar_url:  null, // PK n'accepte pas les data URLs
      proxy_tags:  pxList.map(px => ({ prefix: px.prefix||'', suffix: px.suffix||'' })),
      keep_proxy:  false,
      autoproxy_enabled: null,
      message_count: 0,
      created: new Date(pr.createdAt||Date.now()).toISOString(),
    };
    return member;
  });

  // Tags → Groupes PK : chaque tag devient un groupe avec ses membres
  const groups = tags.map(t => {
    const c = getTagColor(t.color);
    const memberIds = prenoms
      .filter(p => (p.tags||[]).includes(t.id))
      .map(p => {
        const pr = profils.find(pr2 => pr2.prenomId === p.id);
        return pr?.pkMemberId || pr?.id?.slice(0,5) || p.id.slice(0,5);
      });
    return {
      id:           t.id.slice(0,5),
      name:         t.name,
      display_name: null,
      description:  null,
      icon:         null,
      banner:       null,
      color:        c.text.replace('#',''),
      members:      memberIds,
    };
  });

  const pkSystem = {
    version: 2,
    name:    'Mon système',
    description: null,
    tag:     null,
    avatar_url: null,
    timezone: 'UTC',
    members,
    groups,
    switches: [],
  };

  const blob = new Blob([JSON.stringify(pkSystem, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pluralkit-system-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const info = document.getElementById('pk-export-info');
  info.style.display = '';
  info.innerHTML = `<strong style="color:var(--accent2);">${members.length} membre${members.length!==1?'s':''} exporté${members.length!==1?'s':''}.</strong><br>
    ⚠ Note : les images (avatars) ne sont pas incluses car PluralKit nécessite des URLs publiques. 
    Uploadez vos images sur un hébergeur (Imgur, Discord…) puis ajoutez les URLs dans PluralKit directement.<br>
    Pour importer : <code style="background:var(--bg4);padding:2px 6px;border-radius:4px;">pk;system import</code> dans Discord et envoyez le fichier.`;
  toast(`${members.length} membres exportés pour PluralKit.`, 'success');
});

// ── EXPORT DIRECT VERS PLURALKIT VIA API ──

// Calcule une signature de comparaison d'un profil pour détecter les changements
function profilSignature(pr, prenom, pxList, avatarUrl) {
  const name  = prenom ? prenom.name : (pr.name || 'Inconnu');
  return JSON.stringify({
    name,
    description: pr.bio       || null,
    pronouns:    pr.pronouns  || null,
    color:       pr.color ? pr.color.replace('#','') : null,
    avatar_url:  avatarUrl,
    proxy_tags:  pxList.map(px => ({ prefix: px.prefix||'', suffix: px.suffix||'' })),
  });
}

// Signature d'un groupe (tag) pour détecter les changements
function groupSignature(t, memberIds) {
  const c = getTagColor(t.color);
  return JSON.stringify({
    name:    t.name,
    color:   c.text.replace('#',''),
    members: [...memberIds].sort(),
  });
}

// Récupère l'avatar URL d'un profil
function getAvatarUrl(pr, prenom) {
  const imgObj = pr.imageId ? images.find(x => x.id === pr.imageId) : null;
  if (imgObj) {
    // Priorité : URL de l'image recadrée si disponible
    if (imgObj.isCropped && imgObj.croppedHostedUrl) return imgObj.croppedHostedUrl;
    if (imgObj.hostedUrl) return imgObj.hostedUrl;
  }
  if (prenom && prenom.imageId) {
    const img2 = images.find(x => x.id === prenom.imageId);
    if (img2) {
      if (img2.isCropped && img2.croppedHostedUrl) return img2.croppedHostedUrl;
      if (img2.hostedUrl) return img2.hostedUrl;
    }
  }
  return null;
}

document.getElementById('btn-export-pk-api').addEventListener('click', async () => {
  const token = getPkToken();
  if (!token) {
    toast('Token PluralKit requis. Configurez-le dans la section PluralKit.', 'error');
    return;
  }

  const log = document.getElementById('pk-push-log');
  const btn = document.getElementById('btn-export-pk-api');
  log.style.display = '';
  log.innerHTML = '⟳ Connexion à PluralKit…<br>';
  btn.disabled = true;

  const addLog = (msg) => { log.innerHTML += msg + '<br>'; log.scrollTop = log.scrollHeight; };

  try {
    // ── ÉTAPE 1 : MEMBRES ──
    addLog('↓ Récupération des membres PluralKit existants…');
    const existingMembers = await pkFetch('/systems/@me/members');
    const existingByName  = {};
    const existingById    = {};
    existingMembers.forEach(m => {
      existingByName[m.name.toLowerCase()] = m;
      existingById[m.id] = m;
    });
    addLog(`✓ ${existingMembers.length} membres trouvés sur PluralKit`);
    addLog('');

    let mCreated = 0, mUpdated = 0, mSkipped = 0, mErrors = 0;
    const total = profils.length;
    let done = 0;

    // Mettre à jour le bouton avec la progression
    const updateProgress = () => {
      btn.textContent = `⟳ ${done}/${total}`;
    };

    for (const pr of profils) {
      done++;
      updateProgress();

      const prenom   = prenoms.find(x => x.id === pr.prenomId);
      const name     = prenom ? prenom.name : (pr.name || 'Inconnu');
      const pxList   = proxys.filter(x => x.prenomId === pr.prenomId);
      const avatarUrl = getAvatarUrl(pr, prenom);

      const payload = {
        name,
        display_name:  null,
        description:   pr.bio       || null,
        pronouns:      pr.pronouns  || null,
        color:         pr.color ? pr.color.replace('#', '') : null,
        avatar_url:    avatarUrl,
        proxy_tags:    pxList.map(px => ({ prefix: px.prefix || '', suffix: px.suffix || '' })),
        keep_proxy:    false,
      };

      try {
        let existingMember = pr.pkMemberId ? existingById[pr.pkMemberId] : null;
        if (!existingMember) existingMember = existingByName[name.toLowerCase()];

        if (existingMember) {
          // Vérifier si quelque chose a changé
          const newSig = profilSignature(pr, prenom, pxList, avatarUrl);
          const oldSig = pr.pkLastSync || '';
          if (newSig === oldSig) {
            mSkipped++;
            continue; // Rien à faire, pas d'appel API
          }
          await pkFetch('/members/' + existingMember.id, 'PATCH', payload);
          if (pr.pkMemberId !== existingMember.id) pr.pkMemberId = existingMember.id;
          pr.pkLastSync = newSig;
          await dbPut('profils', pr);
          addLog(`✓ [${done}/${total}] Mis à jour : <strong>${esc(name)}</strong>${avatarUrl ? ' 🖼' : ''}`);
          mUpdated++;
        } else {
          const newMember = await pkFetch('/members', 'POST', payload);
          pr.pkMemberId  = newMember.id;
          pr.pkLastSync  = profilSignature(pr, prenom, pxList, avatarUrl);
          await dbPut('profils', pr);
          addLog(`✦ [${done}/${total}] Créé : <strong>${esc(name)}</strong>${avatarUrl ? ' 🖼' : ''}`);
          mCreated++;
        }
        await new Promise(r => setTimeout(r, 550));
      } catch(e) {
        addLog(`✕ [${done}/${total}] Erreur pour <strong>${esc(name)}</strong> : ${esc(e.message)}`);
        mErrors++;
      }
    }

    addLog('');
    if (mSkipped > 0) addLog(`— ${mSkipped} membre(s) inchangé(s), ignoré(s)`);
    addLog(`═══ Membres : ${mCreated} créé(s), ${mUpdated} mis à jour, ${mErrors} erreur(s) ═══`);
    addLog('');

    // ── ÉTAPE 2 : GROUPES (tags → groupes PK) ──
    addLog('↓ Récupération des groupes PluralKit existants…');
    const existingGroups = await pkFetch('/systems/@me/groups?with_members=true');
    const groupByName    = {};
    const groupById      = {};
    existingGroups.forEach(g => {
      groupByName[g.name.toLowerCase()] = g;
      groupById[g.id] = g;
    });
    addLog(`✓ ${existingGroups.length} groupes trouvés sur PluralKit`);
    addLog('');

    let gCreated = 0, gUpdated = 0, gSkipped = 0, gErrors = 0;

    for (const t of tags) {
      // Membres du groupe = prénoms ayant ce tag ET ayant un profil avec pkMemberId
      const memberIds = prenoms
        .filter(p => (p.tags||[]).includes(t.id))
        .map(p => {
          const pr = profils.find(pr2 => pr2.prenomId === p.id);
          return pr && pr.pkMemberId ? pr.pkMemberId : null;
        })
        .filter(Boolean);

      const c = getTagColor(t.color);
      const groupPayload = {
        name:         t.name,
        display_name: null,
        description:  null,
        icon:         null,
        color:        c.text.replace('#',''),
      };

      try {
        let existingGroup = t.pkGroupId ? groupById[t.pkGroupId] : null;
        if (!existingGroup) existingGroup = groupByName[t.name.toLowerCase()];

        const newSig = groupSignature(t, memberIds);
        const oldSig = t.pkLastSync || '';

        if (existingGroup) {
          if (newSig === oldSig) {
            gSkipped++;
            continue;
          }
          await pkFetch('/groups/' + existingGroup.id, 'PATCH', groupPayload);
          // Mettre à jour les membres du groupe
          await pkFetch('/groups/' + existingGroup.id + '/members/overwrite', 'POST', memberIds);
          if (t.pkGroupId !== existingGroup.id) t.pkGroupId = existingGroup.id;
          t.pkLastSync = newSig;
          await dbPut('tags', t);
          addLog(`✓ Groupe mis à jour : <strong>${esc(t.name)}</strong> (${memberIds.length} membres)`);
          gUpdated++;
        } else {
          const newGroup = await pkFetch('/groups', 'POST', groupPayload);
          t.pkGroupId  = newGroup.id;
          if (memberIds.length > 0) {
            await pkFetch('/groups/' + newGroup.id + '/members/overwrite', 'POST', memberIds);
          }
          t.pkLastSync = newSig;
          await dbPut('tags', t);
          addLog(`✦ Groupe créé : <strong>${esc(t.name)}</strong> (${memberIds.length} membres)`);
          gCreated++;
        }
        await new Promise(r => setTimeout(r, 600));
      } catch(e) {
        addLog(`✕ Erreur groupe <strong>${esc(t.name)}</strong> : ${esc(e.message)}`);
        gErrors++;
      }
    }

    addLog('');
    if (gSkipped > 0) addLog(`— ${gSkipped} groupe(s) inchangé(s), ignoré(s)`);
    addLog(`═══ Groupes : ${gCreated} créé(s), ${gUpdated} mis à jour, ${gErrors} erreur(s) ═══`);

    const totalChanges = mCreated + mUpdated + gCreated + gUpdated;
    toast(`Export PK terminé : ${mCreated+mUpdated} membres, ${gCreated+gUpdated} groupes.`, (mErrors+gErrors) ? 'info' : 'success');
    logHistory(`Export PluralKit : ${mCreated} créés, ${mUpdated} mis à jour, ${gCreated} groupes créés, ${gUpdated} groupes mis à jour`, 'config');

  } catch(e) {
    addLog(`✕ Erreur générale : ${esc(e.message)}`);
    toast('Erreur lors de l\'export PluralKit.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⟡ Envoyer à PK';
  }
});

// ── RÉINITIALISATION ──
document.getElementById('btn-reset-all').addEventListener('click', () => {
  openConfirm('⚠ Supprimer TOUTES les données ? Cette action est irréversible.', () => {
    openConfirm('Confirmer une seconde fois : tout supprimer ?', async () => {
      for (const store of ['prenoms','tags','proxys','images','profils','settings']) {
        await dbClear(store);
      }
      prenoms=[]; tags=[]; proxys=[]; images=[]; profils=[];
      toast('Toutes les données ont été supprimées.', 'success');
      renderPrenoms(); renderTagsPage(); renderTagsPrenomView(); renderProxys(); renderImages();
      renderProfils(); renderTagFilters(); renderImgTagFilters(); renderNoProxyBanner();
      updateStats(); renderConfigStats();
    });
  });
});

document.getElementById('btn-reset-cloud').addEventListener('click', () => {
  openConfirm('⚠ Vider TOUTES les données Firestore ? Les données locales ne seront pas touchées.', () => {
    openConfirm('Confirmer : supprimer définitivement le cloud ?', async () => {
      const btn = document.getElementById('btn-reset-cloud');
      btn.disabled = true;
      btn.textContent = '⏳ Suppression…';
      try {
        const COLS = ['prenoms','tags','proxys','profils','images'];
        let total = 0;
        for (const col of COLS) {
          const snap = await fbColRef(col).get();
          if (snap.empty) continue;
          const BATCH = 450; // limite Firestore
          const docs  = [];
          snap.forEach(d => docs.push(d.ref));
          for (let i = 0; i < docs.length; i += BATCH) {
            const batch = fbDb.batch();
            docs.slice(i, i + BATCH).forEach(ref => batch.delete(ref));
            await batch.commit();
            total += Math.min(BATCH, docs.length - i);
            btn.textContent = `⏳ ${total} supprimés…`;
          }
        }
        // Réinitialiser lastSync pour forcer un push complet au prochain "Envoyer tout"
        localStorage.removeItem('ps-last-sync');
        toast(`Cloud vidé — ${total} document(s) supprimé(s).`, 'success');
        btn.textContent = '☁ Vider le cloud';
      } catch(e) {
        toast('Erreur : ' + e.message, 'error');
        btn.textContent = '☁ Vider le cloud';
      }
      btn.disabled = false;
    });
  });
});

// ── CLÉ IMGBB ──
// IMGBB_KEY_STORAGE est déclaré dans images.js — on le réutilise ici directement

function refreshImgbbKeyStatus() {
  const key    = localStorage.getItem('ps-imgbb-key') || '';
  const status = document.getElementById('imgbb-key-status');
  const input  = document.getElementById('imgbb-key-input');
  if (!status || !input) return;
  if (key) {
    status.innerHTML = `<span style="color:var(--success);">✓ Clé configurée</span> — ${key.slice(0,6)}${'•'.repeat(Math.max(0,key.length-6))}`;
    input.value = '';
    input.placeholder = 'Modifier la clé…';
  } else {
    status.textContent = 'Aucune clé configurée — l\'hébergement automatique est désactivé.';
    input.placeholder = 'Collez votre clé API ici…';
  }
}

document.getElementById('btn-save-imgbb-key').addEventListener('click', () => {
  const key = document.getElementById('imgbb-key-input').value.trim();
  if (!key) { toast('La clé est vide.','error'); return; }
  localStorage.setItem('ps-imgbb-key', key);
  toast('Clé API imgbb sauvegardée.','success');
  refreshImgbbKeyStatus();
});

document.getElementById('btn-clear-imgbb-key').addEventListener('click', () => {
  openConfirm('Effacer la clé API imgbb ?', () => {
    localStorage.removeItem('ps-imgbb-key');
    toast('Clé effacée.','success');
    refreshImgbbKeyStatus();
  });
});

// refreshImgbbKeyStatus() est appelé depuis utils.js > goToPage('config') via renderConfigStats

// ── DOSSIER D'IMAGES FAVORI ──
const FOLDER_PATH_KEY = 'ps-img-folder-path';

function refreshFolderStatus() {
  const saved  = localStorage.getItem(FOLDER_PATH_KEY) || '';
  const input  = document.getElementById('img-folder-path');
  const status = document.getElementById('img-folder-status');
  if (!input) return;
  input.value = saved;
  if (status) status.innerHTML = saved
    ? `<span style="color:var(--success);">✓ Chemin mémorisé</span>`
    : 'Aucun chemin mémorisé.';
}

document.getElementById('btn-save-img-folder').addEventListener('click', () => {
  const val = document.getElementById('img-folder-path').value.trim();
  if (!val) { toast('Le chemin est vide.', 'error'); return; }
  localStorage.setItem(FOLDER_PATH_KEY, val);
  toast('Chemin sauvegardé.', 'success');
  refreshFolderStatus();
});

document.getElementById('btn-clear-img-folder').addEventListener('click', () => {
  localStorage.removeItem(FOLDER_PATH_KEY);
  document.getElementById('img-folder-path').value = '';
  toast('Chemin effacé.', 'success');
  refreshFolderStatus();
});

// ── IMPORT DOSSIER ENTIER ──
document.getElementById('btn-import-folder').addEventListener('click', () => {
  document.getElementById('img-folder-import-picker').click();
});

document.getElementById('img-folder-import-picker').addEventListener('change', async function() {
  const files = Array.from(this.files || []).filter(f => f.type.startsWith('image/'));
  if (!files.length) { toast('Aucune image trouvée dans ce dossier.', 'error'); this.value=''; return; }

  const log = document.getElementById('img-folder-import-log');
  log.style.display = '';
  log.textContent = `⏳ Import de ${files.length} image(s) en cours…`;

  let done = 0, errors = 0;
  for (const file of files) {
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const img = { id: uid(), dataUrl, isCropped: false, originalDataUrl: dataUrl,
                    prenomId: null, tags: [], createdAt: Date.now(), hostedUrl: null };
      await dbPut('images', img);
      images.push(img);
      done++;
      if (done % 5 === 0) log.textContent = `⏳ ${done}/${files.length} importées…`;
    } catch(e) { errors++; }
  }

  renderImages(); updateStats();
  log.innerHTML = `<span style="color:var(--success);">✓ ${done} image(s) importée(s)</span>${errors ? ` · ${errors} erreur(s)` : ''}.`;
  toast(`${done} image(s) importée(s) depuis le dossier.`, 'success');
  logHistory(`Import dossier : ${done} images`, 'image');
  this.value = '';
});

// ── CONNEXION PLURALKIT ──
const PK_TOKEN_KEY = 'ps-pk-token';
const PK_API       = 'https://api.pluralkit.me/v2';

function getPkToken() { return localStorage.getItem(PK_TOKEN_KEY) || ''; }

async function pkFetch(endpoint, method = 'GET', body = null) {
  const token = getPkToken();
  if (!token) throw new Error('NO_TOKEN');
  const opts = {
    method,
    headers: { 'Authorization': token, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(PK_API + endpoint, opts);
  if (res.status === 401) throw new Error('TOKEN_INVALID');
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || msg; } catch(e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function refreshPkStatus() {
  const statusEl = document.getElementById('pk-token-status');
  const importBtn = document.getElementById('btn-pk-import');
  if (!statusEl) return;

  const token = getPkToken();
  if (!token) {
    statusEl.textContent = 'Non connecté.';
    if (importBtn) importBtn.disabled = true;
    return;
  }

  statusEl.innerHTML = '<span style="color:var(--text3);">Vérification…</span>';
  try {
    const system = await pkFetch('/systems/@me');
    const memberCount = system.member_count ?? system.memberCount ?? (await pkFetch('/systems/@me/members')).length;
    statusEl.innerHTML = `<span style="color:var(--success);">✓ Connecté</span> — Système : <strong>${esc(system.name||'Sans nom')}</strong> · ${memberCount} membre(s)`;
    if (importBtn) importBtn.disabled = false;
    // Stocker l'ID du système pour référence
    localStorage.setItem('ps-pk-system-id', system.id || '');
  } catch(e) {
    if (e.message === 'TOKEN_INVALID') {
      statusEl.innerHTML = '<span style="color:var(--danger);">✕ Token invalide</span>';
    } else if (e.message === 'NO_TOKEN') {
      statusEl.textContent = 'Non connecté.';
    } else {
      statusEl.innerHTML = `<span style="color:var(--danger);">✕ Erreur : ${esc(e.message)}</span>`;
    }
    if (importBtn) importBtn.disabled = true;
  }
}

document.getElementById('btn-save-pk-token').addEventListener('click', async () => {
  const key = document.getElementById('pk-token-input').value.trim();
  if (!key) { toast('Le token est vide.', 'error'); return; }
  localStorage.setItem(PK_TOKEN_KEY, key);
  document.getElementById('pk-token-input').value = '';
  toast('Token sauvegardé, vérification…', 'success');
  await refreshPkStatus();
});

document.getElementById('btn-clear-pk-token').addEventListener('click', () => {
  openConfirm('Déconnecter PluralKit ?', () => {
    localStorage.removeItem(PK_TOKEN_KEY);
    localStorage.removeItem('ps-pk-system-id');
    document.getElementById('pk-token-input').value = '';
    toast('Déconnecté de PluralKit.', 'success');
    refreshPkStatus();
    document.getElementById('btn-pk-import').disabled = true;
  });
});

// ── IMPORT DEPUIS PLURALKIT ──

// Télécharge une image distante → dataUrl
// Tente d'abord direct, puis via proxy CORS si refusé
function fetchImageAsDataUrl(url) {
  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('Timeout')), 8000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const c = document.createElement('canvas');
          c.width  = img.naturalWidth  || 256;
          c.height = img.naturalHeight || 256;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch(e) { reject(e); }
      };
      img.onerror = () => { clearTimeout(timer); reject(new Error('onerror')); };
      img.src = src;
    });
  }

  return loadImg(url).catch(() =>
    loadImg('https://corsproxy.io/?' + encodeURIComponent(url))
  );
}

document.getElementById('btn-pk-import').addEventListener('click', async () => {
  const log     = document.getElementById('pk-import-log');
  const btn     = document.getElementById('btn-pk-import');
  log.style.display = '';
  log.innerHTML = '⏳ Récupération des membres…';
  btn.disabled  = true;

  try {
    log.innerHTML = '⏳ Récupération des membres et groupes…';

    // Récupérer membres et groupes en parallèle
    const [members, pkGroups] = await Promise.all([
      pkFetch('/systems/@me/members'),
      pkFetch('/systems/@me/groups').catch(() => []),
    ]);
    if (!members.length) { log.innerHTML = 'Aucun membre trouvé dans votre système PluralKit.'; btn.disabled=false; return; }

    // Récupérer les membres de chaque groupe séquentiellement avec pause
    // pour éviter le rate-limit 429 de l'API PluralKit
    if (pkGroups.length > 0) {
      log.innerHTML = `⏳ Récupération des membres des groupes (0/${pkGroups.length})…`;
      for (let gi = 0; gi < pkGroups.length; gi++) {
        const g = pkGroups[gi];
        try {
          const gMembers = await pkFetch(`/groups/${g.id}/members`);
          g.members = gMembers;
        } catch(e) {
          if (e.message && e.message.includes('429')) {
            // Rate-limité : attendre 2s et réessayer une fois
            await new Promise(r => setTimeout(r, 2000));
            try {
              g.members = await pkFetch(`/groups/${g.id}/members`);
            } catch(e2) {
              g.members = [];
            }
          } else {
            g.members = [];
          }
        }
        log.innerHTML = `⏳ Récupération des membres des groupes (${gi + 1}/${pkGroups.length})…`;
        // Pause de 300ms entre chaque appel pour rester sous le rate-limit
        if (gi < pkGroups.length - 1) await new Promise(r => setTimeout(r, 300));
      }
    }

    // ── Groupes PK → Tags locaux ──
    // pkMemberIdToTagIds : map pkMemberId → [tagId locaux]
    const pkMemberIdToTagIds = new Map();
    let tagsCreated = 0;

    for (const g of pkGroups) {
      const gName = g.display_name || g.name || '?';
      let tag = tags.find(t => t.name.toLowerCase() === gName.toLowerCase());
      if (!tag) {
        const hexColor = g.color ? '#' + g.color : '#c9a0dc';
        tag = { id: uid(), name: gName, color: hexColor };
        await dbPut('tags', tag);
        tags.push(tag);
        tagsCreated++;
      }
      for (const memberEntry of (g.members || [])) {
        const pkMemberId = typeof memberEntry === 'string' ? memberEntry : memberEntry.id;
        if (!pkMemberId) continue;
        if (!pkMemberIdToTagIds.has(pkMemberId)) pkMemberIdToTagIds.set(pkMemberId, []);
        pkMemberIdToTagIds.get(pkMemberId).push(tag.id);
      }
    }
    if (tagsCreated > 0) {
      renderTagFilters(); renderImgTagFilters(); renderTagsPrenomView(); updateStats();
    }

    const total    = members.length;
    let created    = 0, skipped = 0, updated = 0, proxysCreated = 0, avatarsImported = 0;

    // Barre de progression
    log.innerHTML = `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px;">
          <span id="pk-prog-label">Initialisation…</span>
          <span id="pk-prog-pct">0 %</span>
        </div>
        <div style="height:4px;background:var(--bg4);border-radius:4px;overflow:hidden;">
          <div id="pk-prog-bar" style="height:100%;width:0%;background:var(--accent3);border-radius:4px;transition:width .2s ease;"></div>
        </div>
      </div>
      <div id="pk-prog-log" style="font-size:12px;line-height:1.9;"></div>`;

    function updateProgress(i, label) {
      const pct = Math.round((i / total) * 100);
      const bar = document.getElementById('pk-prog-bar');
      const lbl = document.getElementById('pk-prog-label');
      const pctEl = document.getElementById('pk-prog-pct');
      if (bar)   bar.style.width = pct + '%';
      if (lbl)   lbl.textContent = label;
      if (pctEl) pctEl.textContent = pct + ' %';
    }

    function appendLog(html) {
      const el = document.getElementById('pk-prog-log');
      if (el) el.innerHTML += html + '<br>';
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const memberName = m.display_name || m.name || '?';
      updateProgress(i, `${memberName} (${i + 1}/${total})`);
      appendLog(`<strong>${esc(memberName)}</strong>`);

      // ── Prénom ──
      // Stratégie : chercher d'abord un profil déjà lié à ce pkMemberId
      // pour éviter de fusionner deux membres PK différents qui ont le même nom
      let prenom;
      const existingProfilByPk = profils.find(pr => pr.pkMemberId === m.id);
      if (existingProfilByPk) {
        // Ce membre PK a déjà été importé → utiliser son prénom
        prenom = prenoms.find(p => p.id === existingProfilByPk.prenomId);
      }
      if (!prenom) {
        // Chercher par nom uniquement s'il n'existe qu'un seul prénom avec ce nom
        // (pour ne pas fusionner deux Némésis par exemple)
        const byName = prenoms.filter(p => p.name.toLowerCase() === memberName.toLowerCase());
        const alreadyLinkedIds = profils.filter(pr => pr.pkMemberId).map(pr => pr.prenomId);
        const unlinkedByName   = byName.filter(p => !alreadyLinkedIds.includes(p.id));
        if (unlinkedByName.length === 1) {
          prenom = unlinkedByName[0]; // un seul candidat non encore lié → on l'utilise
        }
      }
      if (!prenom) {
        // Créer un nouveau prénom
        prenom = { id: uid(), name: memberName, tags: [], notes: '', hasImage: false, imageId: null, createdAt: m.created ? new Date(m.created).getTime() : Date.now() };
        await dbPut('prenoms', prenom);
        prenoms.push(prenom);
        appendLog(`&nbsp;&nbsp;<span style="color:var(--success);">✦ Prénom créé</span>`);
        created++;
      } else {
        appendLog(`&nbsp;&nbsp;<span style="color:var(--text3);">◌ Prénom existant</span>`);
        skipped++;
      }

      // ── Profil ──
      let profil = profils.find(pr => pr.prenomId === prenom.id);
      const pkData = {
        pkMemberId: m.id,
        pronouns:   (m.pronouns || '').slice(0, 100),
        color:      m.color ? '#' + m.color : '',
        bio:        (m.description || '').slice(0, 500),
      };
      if (!profil) {
        profil = { id: uid(), prenomId: prenom.id, name: prenom.name, imageId: null, createdAt: m.created ? new Date(m.created).getTime() : Date.now(), ...pkData };
        await dbPut('profils', profil);
        profils.push(profil);
        appendLog(`&nbsp;&nbsp;<span style="color:var(--accent3);">◉ Profil créé</span>`);
        updated++;
      } else if (!profil.pkMemberId) {
        profil.pkMemberId = m.id;
        if (!profil.pronouns && pkData.pronouns) profil.pronouns = pkData.pronouns;
        if (!profil.color    && pkData.color)    profil.color    = pkData.color;
        if (!profil.bio      && pkData.bio)      profil.bio      = pkData.bio;
        await dbPut('profils', profil);
        appendLog(`&nbsp;&nbsp;<span style="color:var(--accent3);">⟡ Profil associé à PK</span>`);
        updated++;
      }

      // ── Proxys (proxy_tags) ──
      const pkProxys = m.proxy_tags || [];
      const existingPx = proxys.filter(x => x.prenomId === prenom.id);
      let newPxCount = 0;
      for (const pt of pkProxys) {
        const prefix = pt.prefix || '';
        const suffix = pt.suffix || '';
        const dup = existingPx.some(x => (x.prefix||'')===prefix && (x.suffix||'')===suffix);
        if (!dup && (prefix || suffix)) {
          const px = { id: uid(), prenomId: prenom.id, prefix, suffix, createdAt: m.created ? new Date(m.created).getTime() : Date.now() };
          await dbPut('proxys', px);
          proxys.push(px);
          existingPx.push(px);
          newPxCount++;
          proxysCreated++;
        }
      }
      if (newPxCount > 0) appendLog(`&nbsp;&nbsp;<span style="color:var(--success);">⟡ ${newPxCount} proxy importé${newPxCount>1?'s':''}</span>`);

      // ── Avatar ──
      if (m.avatar_url) {
        // Vérifier si une image avec exactement cette URL existe déjà pour ce prénom
        const existingImg = images.find(i2 => i2.prenomId === prenom.id && i2.hostedUrl === m.avatar_url);
        if (!existingImg) {
          updateProgress(i, `${memberName} — téléchargement avatar…`);
          try {
            const dataUrl = await fetchImageAsDataUrl(m.avatar_url);
            const imgRec = { id: uid(), dataUrl, isCropped: true, originalDataUrl: dataUrl,
                             prenomId: prenom.id, tags: [], createdAt: m.created ? new Date(m.created).getTime() : Date.now(), hostedUrl: m.avatar_url };
            await dbPut('images', imgRec);
            images.push(imgRec);
            prenom.hasImage = true; prenom.imageId = imgRec.id;
            if (profil) { profil.imageId = imgRec.id; await dbPut('profils', profil); }
            await dbPut('prenoms', prenom);
            appendLog(`&nbsp;&nbsp;<span style="color:var(--text3);">✧ Avatar importé</span>`);
            avatarsImported++;
          } catch(avatarErr) {
            // Stocker juste l'URL si le téléchargement échoue (CORS Discord)
            const imgRec = { id: uid(), dataUrl: null, isCropped: true, originalDataUrl: null,
                             prenomId: prenom.id, tags: [], createdAt: m.created ? new Date(m.created).getTime() : Date.now(), hostedUrl: m.avatar_url };
            await dbPut('images', imgRec);
            images.push(imgRec);
            prenom.hasImage = true; prenom.imageId = imgRec.id;
            await dbPut('prenoms', prenom);
            appendLog(`&nbsp;&nbsp;<span style="color:var(--text3);">✧ Avatar URL sauvegardée</span>`);
          }
        }
      }

      // ── Tags des groupes PK → Prénom + Images + Profil ──
      // Fait en dernier pour que profil et avatar existent déjà
      const memberTagIds = pkMemberIdToTagIds.get(m.id) || [];
      if (memberTagIds.length > 0) {
        let changed = false;
        for (const tid of memberTagIds) {
          if (!(prenom.tags||[]).includes(tid)) { prenom.tags = [...(prenom.tags||[]), tid]; changed = true; }
        }
        if (changed) await dbPut('prenoms', prenom);
        // Propager vers images et profil via syncPrenomTags
        await syncPrenomTags(prenom);
        const tagNames = memberTagIds.map(tid => { const t=tags.find(x=>x.id===tid); return t?`"${t.name}"`:tid; }).join(', ');
        appendLog(`&nbsp;&nbsp;<span style="color:var(--accent3);">✦ Tags ${tagNames}</span>`);
      }
    }

    // Progression 100 %
    updateProgress(total, 'Terminé');

    const summary = `<br><strong>✓ Import terminé :</strong> ${created} prénom(s), ${updated} profil(s), ${proxysCreated} proxy(s), ${avatarsImported} avatar(s)${tagsCreated > 0 ? `, ${tagsCreated} tag(s) créé(s) depuis les groupes PK` : ''}. ${skipped} existant(s) ignoré(s).`;
    const logEl = document.getElementById('pk-prog-log');
    if (logEl) logEl.innerHTML += summary;

    logHistory(`Import PluralKit : ${created} créés, ${updated} profils, ${proxysCreated} proxys`, 'system');
    renderPrenoms(); renderProfils(); renderProxys(); renderImages(); renderNoProxyBanner(); updateStats();
    toast(`Import PK terminé — ${created} créés, ${proxysCreated} proxys, ${avatarsImported} avatars.`, 'success');
  } catch(e) {
    log.innerHTML = `<span style="color:var(--danger);">✕ Erreur : ${esc(e.message)}</span>`;
    toast('Échec de l\'import PK : ' + e.message, 'error');
  }
  btn.disabled = false;
});
