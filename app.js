// ── INIT ──
async function init() {
  await openDB();
  prenoms = await dbGetAll('prenoms');
  tags    = await dbGetAll('tags');
  proxys  = await dbGetAll('proxys');
  images  = await dbGetAll('images');
  profils = await dbGetAll('profils');

  const savedNotes = await dbGet('settings','globalNotes');
  if (savedNotes) document.getElementById('global-notes-input').value = savedNotes.value;

  renderAlphaFilter();
  renderTagFilters();
  renderImgTagFilters();
  renderPrenoms();
  renderProxys();
  renderNoProxyBanner();
  // Tags : vue par prénoms par défaut
  document.getElementById('tags-view-tags').style.display='none';
  document.getElementById('tags-view-prenoms').style.display='';
  renderTagsPrenomView();
  renderImages();
  renderProfils();
  updateStats();
  // Vérifier import Pinterest au démarrage
  setTimeout(() => { checkPinterestHash(); checkShareTarget(); }, 100);
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
