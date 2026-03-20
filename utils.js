// ── GLOBAL STATE (accessible to all modules) ──
let prenoms = [], tags = [], proxys = [], images = [], profils = [];

// ── UTILS ──
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc  = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt  = ts  => new Date(ts).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})
                  + ' à ' + new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});

// ── TAG COLORS ──
const TAG_COLORS = [
  { name:'lavande', bg:'rgba(201,160,220,0.2)', border:'rgba(201,160,220,0.5)', text:'#c9a0dc' },
  { name:'rose',    bg:'rgba(232,160,180,0.2)', border:'rgba(232,160,180,0.5)', text:'#e8a0b4' },
  { name:'bleu',    bg:'rgba(120,180,220,0.2)', border:'rgba(120,180,220,0.5)', text:'#78b4dc' },
  { name:'vert',    bg:'rgba(126,200,160,0.2)', border:'rgba(126,200,160,0.5)', text:'#7ec8a0' },
  { name:'or',      bg:'rgba(232,200,122,0.2)', border:'rgba(232,200,122,0.5)', text:'#e8c87a' },
  { name:'peche',   bg:'rgba(232,180,140,0.2)', border:'rgba(232,180,140,0.5)', text:'#e8b48c' },
];
// Retourne les tags triés alphabétiquement (fr)
function tagsSorted() {
  return tags.slice().sort((a,b) => a.name.localeCompare(b.name, 'fr', {sensitivity:'base'}));
}

function getTagColor(colorVal) {
  // colorVal peut être un nom prédéfini ('lavande') ou un hex (#c9a0dc)
  if (!colorVal) return TAG_COLORS[0];
  const named = TAG_COLORS.find(c => c.name === colorVal);
  if (named) return named;
  // Hex custom : générer bg/border/text à partir du hex
  if (/^#[0-9a-fA-F]{6}$/.test(colorVal)) {
    return {
      name:   colorVal,
      bg:     colorVal + '33',   // ~20% opacité
      border: colorVal + '80',   // ~50% opacité
      text:   colorVal,
    };
  }
  return TAG_COLORS[0];
}
function tagPillHtml(tag) {
  const c = getTagColor(tag.color);
  return `<span class="tag-pill" style="background:${c.bg};border-color:${c.border};color:${c.text};">${esc(tag.name)}</span>`;
}

// ── TOAST ──
function toast(msg, type='default') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const color = type==='success' ? 'var(--success)' : type==='error' ? 'var(--danger)' : 'var(--accent)';
  const icon  = type==='success' ? '✓' : type==='error' ? '✕' : '✦';
  el.innerHTML = `<span style="color:${color}">${icon}</span> ${esc(msg)}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── CONFIRM ──
let confirmStack = [];

function openConfirm(text, cb) {
  confirmStack.push(cb);
  document.getElementById('modal-confirm-text').textContent = text;
  document.getElementById('modal-confirm').classList.add('open');
}
document.getElementById('modal-confirm-close').addEventListener('click',  () => {
  confirmStack.pop();
  document.getElementById('modal-confirm').classList.remove('open');
});
document.getElementById('modal-confirm-cancel').addEventListener('click', () => {
  confirmStack.pop();
  document.getElementById('modal-confirm').classList.remove('open');
});
document.getElementById('modal-confirm-ok').addEventListener('click', () => {
  document.getElementById('modal-confirm').classList.remove('open');
  const cb = confirmStack.pop();
  if (cb) cb();
});

// ── NAVIGATION ──
function goToPage(page) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`.nav-link[data-page="${page}"]`).classList.add('active');
  document.getElementById('page-' + page).classList.add('active');
  if (page==='tags')   renderTagsPrenomView();
  if (page==='config') { renderConfigStats(); renderHistoryLog(); refreshImgbbKeyStatus(); refreshFolderStatus(); refreshPkStatus(); }
}
document.querySelectorAll('.nav-link[data-page]').forEach(link => {
  link.addEventListener('click', () => goToPage(link.dataset.page));
});

// Stat cards clickables sur l'accueil
document.querySelectorAll('.stat-card[data-goto]').forEach(card => {
  card.addEventListener('click', () => goToPage(card.dataset.goto));
});

// ── HAMBURGER NAV TOGGLE ──
(function() {
  const nav = document.getElementById('main-nav');
  const btn = document.getElementById('btn-nav-toggle');
  const STORAGE_KEY = 'ps-nav-collapsed';
  const isMobile = () => window.innerWidth <= 640;

  function setCollapsed(collapsed) {
    // Sur mobile la nav est en bas — pas de collapse
    if (isMobile()) { nav.classList.remove('nav-collapsed'); return; }
    nav.classList.toggle('nav-collapsed', collapsed);
    if (btn) btn.title = collapsed ? 'Agrandir la navigation' : 'Réduire la navigation';
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }

  if (btn) btn.addEventListener('click', () => setCollapsed(!nav.classList.contains('nav-collapsed')));

  // Restaurer l'état sauvegardé (desktop seulement)
  if (!isMobile()) {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
  }

  // Réagir au resize (passage desktop ↔ mobile)
  window.addEventListener('resize', () => {
    if (isMobile()) {
      nav.classList.remove('nav-collapsed');
    }
  });
})();

// ── STATS ──
async function updateStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // ── Prénoms ──
  const prenomCount    = prenoms.length;
  const withImg        = prenoms.filter(p => p.hasImage).length;
  const withProxy      = prenoms.filter(p => proxys.some(px => px.prenomId === p.id)).length;
  const withProfil     = prenoms.filter(p => profils.some(pr => pr.prenomId === p.id)).length;
  set('stat-prenoms',           prenomCount);
  set('stat-prenoms-withimg',   withImg);
  set('stat-prenoms-noimg',     prenomCount - withImg);
  set('stat-prenoms-withproxy', withProxy);
  set('stat-prenoms-noproxy',   prenomCount - withProxy);
  set('stat-prenoms-withprofil',withProfil);
  set('stat-prenoms-noprofil',  prenomCount - withProfil);

  // ── Images ──
  const imgCount   = images.length;
  const imgLinked  = images.filter(i => i.prenomId && prenoms.find(p => p.id === i.prenomId)).length;
  const imgCropped = images.filter(i => i.isCropped).length;
  const imgHosted  = images.filter(i => !!i.hostedUrl).length;
  set('stat-images',          imgCount);
  set('stat-images-linked',   imgLinked);
  set('stat-images-unlinked', imgCount - imgLinked);
  set('stat-images-cropped',  imgCropped);
  set('stat-images-uncropped',imgCount - imgCropped);
  set('stat-images-hosted',   imgHosted);
  set('stat-images-unhosted', imgCount - imgHosted);

  // ── Proxys ──
  const seen = {};
  for (const px of proxys) {
    const key = (px.prefix||'') + '|' + (px.suffix||'');
    if (!seen[key]) seen[key] = new Set();
    seen[key].add(px.prenomId);
  }
  const conflictCount = Object.values(seen).filter(s => s.size > 1).length;
  set('stat-proxys',           proxys.length);
  set('stat-proxys-conflicts', conflictCount);

  // ── Tags ──
  const prenomsWith    = prenoms.filter(p => p.tags && p.tags.length > 0).length;
  set('stat-tags',             tags.length);
  set('stat-tags-withprenoms', prenomsWith);
  set('stat-tags-noprenoms',   prenoms.length - prenomsWith);

  // ── Profils ──
  const profilCount    = profils.length;
  const profilComplete = profils.filter(pr => {
    const p = prenoms.find(x => x.id === pr.prenomId);
    return p && p.hasImage && proxys.some(px => px.prenomId === p.id) && pr.pronouns;
  }).length;
  const profilPk = profils.filter(pr => !!pr.pkMemberId).length;
  set('stat-profils',            profilCount);
  set('stat-profils-complete',   profilComplete);
  set('stat-profils-incomplete', profilCount - profilComplete);
  set('stat-profils-pk',         profilPk);
  set('stat-profils-nopk',       profilCount - profilPk);
}

// ── Charger les infos système PluralKit ──
async function fetchPkSystemInfo() {
  const token = localStorage.getItem('ps-pk-token');
  if (!token) return;
  try {
    const resp = await fetch('https://api.pluralkit.me/v2/systems/@me', {
      headers: { 'Authorization': token }
    });
    if (!resp.ok) return;
    const sys = await resp.json();
    const card = document.getElementById('pk-system-card');
    if (!card) return;
    card.style.display = '';
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    set('pk-sys-name', sys.name);
    set('pk-sys-id',   sys.id);
    set('pk-sys-tag',  sys.tag);
    const created = sys.created ? new Date(sys.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    set('pk-sys-created', created);
    if (sys.description) {
      const desc = document.getElementById('pk-sys-desc');
      if (desc) { desc.textContent = sys.description; desc.style.display = ''; }
    }
  } catch(e) {}
}

// ── SYNC TAGS PRÉNOM → IMAGES + PROFIL ──
// Appeler après chaque modification de prenom.tags
async function syncPrenomTags(prenom) {
  const tagIds = (prenom.tags || []).slice();
  // Toutes les images liées
  for (const img of images.filter(i => i.prenomId === prenom.id)) {
    if (JSON.stringify(img.tags||[]) !== JSON.stringify(tagIds)) {
      img.tags = tagIds;
      await dbPut('images', img);
    }
  }
  // Le profil lié
  const pr = profils.find(x => x.prenomId === prenom.id);
  if (pr) {
    if (JSON.stringify(pr.tags||[]) !== JSON.stringify(tagIds)) {
      pr.tags = tagIds;
      await dbPut('profils', pr);
    }
  }
}
