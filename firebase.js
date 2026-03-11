// ── PLURAL SPACE — Firebase Sync ──
// Auth Google + Firestore sync automatique
// Chaque utilisatrice a son propre espace : /users/{uid}/{collection}

// ── CONFIG ──
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDS7qaE9sCfGqIYlQHQOq0Z-wuAbE3acKI",
  authDomain:        "plural-space.firebaseapp.com",
  projectId:         "plural-space",
  storageBucket:     "plural-space.firebasestorage.app",
  messagingSenderId: "543388676990",
  appId:             "1:543388676990:web:a8f96d0b48ce5b78b6f92f"
};

// ── ÉTAT ──
let fbApp      = null;
let fbAuth     = null;
let fbDb       = null;
let fbUser     = null;          // utilisatrice connectée
let fbStorage  = null;
// listeners temps réel désactivés — sync via push auto uniquement
let fbSyncDebounce = {};        // debounce par collection

// Collections synchronisées (pas les settings — trop local)
const SYNC_COLLECTIONS = ['prenoms', 'tags', 'proxys', 'images', 'profils'];

// Debounce delay pour éviter de spammer Firestore (ms)
const SYNC_DEBOUNCE_MS = 800;

// ── INIT SDK (chargé via CDN dans index.html) ──
async function fbInit() {
  try {
    fbApp     = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth    = firebase.auth();
    fbDb      = firebase.firestore();
    fbStorage = firebase.storage();
    // Persistence LOCAL : indispensable pour iOS PWA (auth survit au redirect)
    try {
      await fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch(e) { console.warn('[Firebase] setPersistence :', e.code); }
    console.log('[Firebase] Initialisé ✓');
    // Gérer le retour après signInWithRedirect (PWA iOS)
    // On attend le résultat avant de démarrer le watcher d'auth
    try {
      // Afficher un indicateur si un redirect était en cours
      const redirectPending = localStorage.getItem('ps-auth-redirect-pending');
      if (redirectPending) {
        localStorage.removeItem('ps-auth-redirect-pending');
        // Montrer un toast de chargement
        const el = document.getElementById('toast-container');
        if (el) {
          const t = document.createElement('div');
          t.className = 'toast toast-info';
          t.textContent = '⏳ Connexion Google en cours…';
          el.appendChild(t);
          setTimeout(() => t.remove(), 4000);
        }
      }
      const result = await fbAuth.getRedirectResult();
      if (result && result.user) {
        console.log('[Firebase] Retour redirect OK :', result.user.email);
        toast('Connectée avec Google ✓', 'success');
      }
    } catch(e) {
      // auth/no-auth-event = pas de redirect en cours, c'est normal
      if (e.code !== 'auth/no-auth-event') {
        console.warn('[Firebase] getRedirectResult :', e.code);
        if (e.code === 'auth/unauthorized-domain') {
          toast('Domaine non autorisé — contactez l'administratrice.', 'error');
        } else if (e.code !== 'auth/null-user') {
          toast('Erreur de connexion : ' + e.code, 'error');
        }
      }
    }
    fbWatchAuthState();
  } catch(e) {
    console.error('[Firebase] Erreur init :', e);
  }
}

// ── AUTH ──

// Connexion Google
async function fbSignIn() {
  if (!fbAuth) return;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Détection fiable iOS PWA standalone vs Safari normal vs autres
    const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true; // iOS PWA ajoutée à l'écran
    // Sur iOS PWA standalone : signInWithRedirect ne revient pas dans la PWA (ouvre Safari séparé)
    // → on force signInWithPopup qui reste dans le WKWebView de la PWA
    // Sur iOS Safari normal : signInWithRedirect fonctionne mieux (popup souvent bloqué)
    // Sur Android/Desktop : signInWithPopup (plus fluide)
    if (isIOS) {
      // iOS : redirect (plus fiable que popup sur WebKit)
      localStorage.setItem('ps-auth-redirect-pending', '1');
      await fbAuth.signInWithRedirect(provider);
    } else {
      // Android / Desktop
      await fbAuth.signInWithPopup(provider);
    }
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      toast('Erreur de connexion Google.', 'error');
      console.error('[Firebase] SignIn :', e);
    }
  }
}

// Déconnexion
async function fbSignOut() {
  if (!fbAuth) return;
  fbStopListeners();
  await fbAuth.signOut();
  fbUser = null;
  fbUpdateUI();
  toast('Déconnectée du compte Google.', 'success');
}

// Observer l'état de connexion
function fbWatchAuthState() {
  // Sur iOS PWA : écouter le retour au premier plan pour relire l'état auth
  // (après que l'utilisatrice ait fait l'auth dans Safari et soit revenue)
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && window.navigator.standalone) {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('ps-auth-redirect-pending')) {
        localStorage.removeItem('ps-auth-redirect-pending');
        try {
          const result = await fbAuth.getRedirectResult();
          if (result && result.user) {
            toast('Connectée avec Google ✓', 'success');
          }
        } catch(e) {
          if (e.code !== 'auth/no-auth-event' && e.code !== 'auth/null-user') {
            console.warn('[Firebase] visibilitychange getRedirectResult:', e.code);
          }
        }
      }
    });
  }

  fbAuth.onAuthStateChanged(async user => {
    if (user) {
      fbUser = user;
      console.log('[Firebase] Connectée :', user.email);
      fbUpdateUI();
      fbSetSyncStatus('ok');
      // Ne pas puller automatiquement — trop coûteux en lectures (313+ docs/connexion)
      // L'utilisatrice clique "Recharger" quand elle veut récupérer les données du cloud
      // Sauf si les données locales sont vides (premier appareil vierge)
      try {
        const localPrenoms = await dbGetAll('prenoms');
        if (localPrenoms.length === 0) {
          // Appareil vierge → pull automatique justifié
          await fbPullAll();
          toast('Données synchronisées depuis le cloud ✓', 'success');
        } else {
          toast('Connectée ✓', 'success');
        }
      } catch(e) {
        console.error('[Firebase] Vérification locale :', e);
        fbSetSyncStatus('ok');
      }
      fbStartListeners();
    } else {
      fbUser = null;
      fbStopListeners();
      fbUpdateUI();
    }
  });
}

// ── SYNC ──

// Chemin Firestore pour une collection : users/{uid}/{collection}
function fbColRef(collection) {
  return fbDb.collection('users').doc(fbUser.uid).collection(collection);
}

// Pull depuis Firestore → fusionne avec les données locales (ne remplace jamais)
async function fbPullAll() {
  if (!fbUser || !fbDb) return;
  try {
    fbSetSyncStatus('syncing');

    // Compter le total de docs dans Firestore
    let totalRemote = 0;
    for (const col of SYNC_COLLECTIONS) {
      const snap = await fbColRef(col).get();
      totalRemote += snap.size;

      if (snap.empty) continue; // Firestore vide pour cette collection → garder local

      const remoteItems = [];
      snap.forEach(doc => remoteItems.push(doc.data()));

      // ── Remplacement complet : snapshot local d'abord, puis vider, puis réécrire ──
      // (évite les doublons si les deux appareils avaient des items aux IDs différents)
      const localSnapshot = await dbGetAll(col); // snapshot AVANT clear

      await new Promise((res, rej) => {
        const tx    = db.transaction(col, 'readwrite');
        const store = tx.objectStore(col);
        const req   = store.clear();
        req.onsuccess = () => res();
        req.onerror   = rej;
      });

      if (col === 'images') {
        // Images : récupérer les dataUrl locaux depuis le snapshot
        const localImages = localSnapshot; // snapshot pris avant clear
        for (const remoteImg of remoteItems) {
          const localImg = localImages.find(x => x.id === remoteImg.id);
          if (localImg) {
            remoteImg.dataUrl         = localImg.dataUrl         || null;
            remoteImg.originalDataUrl = localImg.originalDataUrl || null;
          }
          await new Promise((res,rej) => {
            const r = db.transaction('images','readwrite').objectStore('images').put(remoteImg);
            r.onsuccess = () => res(); r.onerror = rej;
          });
        }
        images = await dbGetAll('images');
      } else {
        // Autres collections : écrire les docs Firestore (store déjà vidé)
        for (const item of remoteItems) {
          await new Promise((res,rej) => {
            const r = db.transaction(col,'readwrite').objectStore(col).put(item);
            r.onsuccess = () => res(); r.onerror = rej;
          });
        }
        const updated = await dbGetAll(col);
        if      (col === 'prenoms') prenoms = updated;
        else if (col === 'tags')    tags    = updated;
        else if (col === 'proxys')  proxys  = updated;
        else if (col === 'profils') profils = updated;
      }
    }

    // Rafraîchir tout l'affichage
    renderPrenoms(); renderProxys(); renderImages();
    renderProfils(); renderTagsPage(); renderTagsPrenomView();
    renderTagFilters(); renderImgTagFilters();
    renderProxyTagFilters(); renderProfilTagFilters();
    renderNoProxyBanner(); updateStats();
    fbSetLastSync(Date.now());
    fbSetSyncStatus('ok');
    console.log('[Firebase] Pull terminé ✓ (' + totalRemote + ' docs distants)');
    // Charger les logs depuis le cloud après pull
    if (typeof loadHistoryFromCloud === 'function') loadHistoryFromCloud();
  } catch(e) {
    fbSetSyncStatus('error');
    console.error('[Firebase] Pull erreur :', e);
    toast('Erreur de synchronisation.', 'error');
  }
}

// Nettoyer un item avant envoi Firestore (retirer les dataUrl trop lourds, limite 1MB)
// Upload image vers Firebase Storage → retourne l'URL de téléchargement
async function fbUploadImage(img) {
  if (!fbStorage || !fbUser || !img.dataUrl) return null;
  try {
    const base64 = img.dataUrl.split(',')[1];
    const mime   = img.dataUrl.split(';')[0].split(':')[1] || 'image/png';
    const ext    = mime.split('/')[1] || 'png';
    const path   = 'users/' + fbUser.uid + '/images/' + img.id + '.' + ext;
    const ref    = fbStorage.ref(path);
    await ref.putString(base64, 'base64', { contentType: mime });
    return await ref.getDownloadURL();
  } catch(e) {
    console.warn('[Firebase Storage] Upload échoué :', e.message);
    return null;
  }
}

function fbSanitize(collection, item) {
  if (collection !== 'images') return item;
  const doc = Object.assign({}, item);
  delete doc.dataUrl;
  delete doc.originalDataUrl;
  return doc;
}

// Push un seul document vers Firestore
async function fbPushDoc(collection, item) {
  if (!fbUser || !fbDb || !item?.id) return;
  try {
    // Pour les images : uploader vers Firebase Storage si pas encore de hostedUrl
    if (collection === 'images' && item.dataUrl && !item.hostedUrl) {
      const url = await fbUploadImage(item);
      if (url) {
        item.hostedUrl = url;
        await new Promise((res,rej) => {
          const r = db.transaction('images','readwrite').objectStore('images').put(item);
          r.onsuccess = () => res(); r.onerror = rej;
        });
      }
    }
    const doc = fbSanitize(collection, item);
    await fbColRef(collection).doc(doc.id).set(doc);
  } catch(e) {
    console.error('[Firebase] Push ' + collection + '/' + item.id + ' :', e);
    fbSetSyncStatus('error');
  }
}

// Supprimer un document de Firestore
async function fbDeleteDoc(collection, id) {
  if (!fbUser || !fbDb || !id) return;
  try {
    await fbColRef(collection).doc(id).delete();
  } catch(e) {
    console.error(`[Firebase] Delete ${collection}/${id} :`, e);
  }
}

// Push avec debounce (évite de spammer à chaque frappe)
function fbPushDebounced(collection, item) {
  if (!fbUser) return;
  const key = `${collection}/${item.id}`;
  clearTimeout(fbSyncDebounce[key]);
  fbSyncDebounce[key] = setTimeout(() => fbPushDoc(collection, item), SYNC_DEBOUNCE_MS);
}

// Listeners temps réel désactivés — trop coûteux en lectures Firestore (55k/jour)
// La sync se fait via push auto (ps:dbput) + boutons Envoyer/Recharger
function fbStartListeners() {
  console.log('[Firebase] Sync sans listeners temps réel (économie de quota) ✓');
}
function fbStopListeners() {}

// Mettre à jour la mémoire sans re-fetch complet
function fbMergeInMemory(col, item, remove) {
  let arr;
  if      (col === 'prenoms') arr = prenoms;
  else if (col === 'tags')    arr = tags;
  else if (col === 'proxys')  arr = proxys;
  else if (col === 'images')  arr = images;
  else if (col === 'profils') arr = profils;
  else return;

  const idx = arr.findIndex(x => x.id === item.id);
  if (remove) {
    if (idx >= 0) arr.splice(idx, 1);
  } else {
    // Pour les images : préserver les dataUrl locaux non stockés dans Firestore
    if (col === 'images' && idx >= 0) {
      item.dataUrl         = arr[idx].dataUrl         || null;
      item.originalDataUrl = arr[idx].originalDataUrl || null;
    }
    if (idx >= 0) arr[idx] = item;
    else arr.push(item);
  }
}

function fbRefreshViews() {
  renderPrenoms(); renderProxys(); renderImages();
  renderProfils(); renderTagsPage(); renderTagsPrenomView();
  renderTagFilters(); renderImgTagFilters();
  renderProxyTagFilters(); renderProfilTagFilters();
  renderNoProxyBanner(); updateStats();
}

// ── Timestamp de dernière sync (par utilisatrice) ──
function fbGetLastSync() {
  if (!fbUser) return 0;
  return parseInt(localStorage.getItem(`ps-last-sync-${fbUser.uid}`) || '0', 10);
}
function fbSetLastSync(ts) {
  if (!fbUser) return;
  localStorage.setItem(`ps-last-sync-${fbUser.uid}`, String(ts));
}

// Push incrémental : envoyer uniquement les documents modifiés depuis la dernière sync
// + upload imgbb automatique pour les images sans hostedUrl
async function fbPushAll() {
  if (!fbUser || !fbDb) return;
  try {
    fbSetSyncStatus('syncing');
    const lastSync  = fbGetLastSync();
    const syncStart = Date.now();
    let totalPushed = 0;

    // Vérifier si Firestore est vide pour cette utilisatrice (vraie première sync)
    // lastSync peut être défini par pullAll même si Firestore est vide
    let firestoreEmpty = false;
    try {
      const testSnap = await fbColRef('prenoms').limit(1).get();
      firestoreEmpty = testSnap.empty;
    } catch(e) { /* quota ou réseau — on se fie à lastSync */ }
    const isFirst = lastSync === 0 || firestoreEmpty;

    // ── Étape 1 : uploader vers Firebase Storage les images sans hostedUrl ──
    const allImages0 = await dbGetAll('images');
    const toUpload   = allImages0.filter(img => img.dataUrl && !img.hostedUrl);
    if (toUpload.length > 0) {
      toast('Upload de ' + toUpload.length + ' image(s)…', 'info');
      let uploaded = 0;
      for (const img of toUpload) {
        const url = await fbUploadImage(img);
        if (url) {
          img.hostedUrl = url;
          await new Promise((res,rej) => {
            const r = db.transaction('images','readwrite').objectStore('images').put(img);
            r.onsuccess = () => res(); r.onerror = rej;
          });
          uploaded++;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      console.log('[Firebase Storage] ' + uploaded + '/' + toUpload.length + ' uploadées');
    }

    // ── Étape 2 : push Firestore — uniquement les docs modifiés depuis lastSync ──
    const BATCH_SIZE = 50;
    const PAUSE_MS   = 400;
    for (const col of SYNC_COLLECTIONS) {
      const allItems = await dbGetAll(col);
      // Première sync : tout envoyer. Sinon : uniquement updatedAt > lastSync
      const items = isFirst
        ? allItems
        : allItems.filter(item => (item.updatedAt || item.createdAt || 0) > lastSync);
      if (items.length === 0) continue;
      let pushed = 0;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const slice = items.slice(i, i + BATCH_SIZE);
        const batch = fbDb.batch();
        slice.forEach(item => {
          const doc = fbSanitize(col, item);
          batch.set(fbColRef(col).doc(doc.id), doc);
        });
        try {
          await batch.commit();
          pushed += slice.length;
        } catch(batchErr) {
          for (const item of slice) {
            try {
              const doc = fbSanitize(col, item);
              await fbColRef(col).doc(doc.id).set(doc);
              pushed++;
            } catch(e2) { console.error(`[Firebase] ${col}/${item.id}:`, e2.message); }
            await new Promise(r => setTimeout(r, 80));
          }
        }
        if (i + BATCH_SIZE < items.length) await new Promise(r => setTimeout(r, PAUSE_MS));
      }
      totalPushed += pushed;
      console.log(`[Firebase] ${col} : ${pushed}/${items.length} modifiés envoyés`);
    }

    // Sauvegarder le timestamp de cette sync réussie
    fbSetLastSync(syncStart);
    fbSetSyncStatus('ok');
    const msg = isFirst
      ? `Première sync : ${totalPushed} éléments envoyés ✓`
      : totalPushed > 0
        ? `${totalPushed} modification(s) synchronisée(s) ✓`
        : 'Tout est déjà à jour ✓';
    toast(msg, 'success');
    console.log('[Firebase] Push terminé, lastSync mis à jour');
  } catch(e) {
    fbSetSyncStatus('error');
    console.error('[Firebase] Push erreur :', e);
    toast('Erreur de synchronisation.', 'error');
  }
}

// ── UI ──

function fbSetSyncStatus(state) {
  const dot  = document.getElementById('fb-sync-dot');
  const lbl  = document.getElementById('fb-sync-label');
  if (!dot || !lbl) return;
  const states = {
    ok:      { color: 'var(--success)', text: 'Synchronisé' },
    syncing: { color: 'var(--warn)',    text: 'Synchronisation…' },
    error:   { color: 'var(--danger)',  text: 'Erreur de sync' },
    offline: { color: 'var(--text3)',   text: 'Hors ligne' },
  };
  const s = states[state] || states.offline;
  dot.style.background = s.color;
  lbl.textContent = s.text;
}

function fbUpdateUI() {
  const logged   = document.getElementById('fb-logged');
  const unlogged = document.getElementById('fb-unlogged');
  const avatar   = document.getElementById('fb-avatar');
  const name     = document.getElementById('fb-user-name');
  const email    = document.getElementById('fb-user-email');
  const syncRow  = document.getElementById('fb-sync-row');

  if (!logged || !unlogged) return;

  if (fbUser) {
    unlogged.style.display = 'none';
    logged.style.display   = '';
    if (avatar) {
      if (fbUser.photoURL) {
        avatar.innerHTML = `<img src="${fbUser.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
      } else {
        avatar.textContent = fbUser.displayName?.[0] || '?';
      }
    }
    if (name)  name.textContent  = fbUser.displayName || 'Utilisatrice';
    if (email) email.textContent = fbUser.email || '';
    if (syncRow) syncRow.style.display = '';
    fbSetSyncStatus('ok');
    const cloudResetRow = document.getElementById('btn-reset-cloud-row');
    if (cloudResetRow) cloudResetRow.style.display = '';
  } else {
    unlogged.style.display = '';
    logged.style.display   = 'none';
    const cloudResetRow = document.getElementById('btn-reset-cloud-row');
    if (cloudResetRow) cloudResetRow.style.display = 'none';
    if (syncRow) syncRow.style.display = 'none';
    fbSetSyncStatus('offline');
  }
}

// ── SYNC AUTOMATIQUE via événements custom ──
// db.js émet des événements 'ps:dbput' et 'ps:dbdelete'
// Firebase les écoute et sync vers Firestore

function fbInstallHooks() {
  // Écouter les événements émis par db.js
  window.addEventListener('ps:dbput', e => {
    const { store, val } = e.detail;
    if (fbUser && SYNC_COLLECTIONS.includes(store)) {
      fbPushDebounced(store, val);
    }
  });

  window.addEventListener('ps:dbdelete', e => {
    const { store, key } = e.detail;
    if (fbUser && SYNC_COLLECTIONS.includes(store)) {
      fbDeleteDoc(store, key);
    }
  });

  console.log('[Firebase] Hooks événements installés ✓');
}

// ── DÉMARRAGE ──
// Appelé depuis index.html après chargement des SDKs
function fbStart() {
  fbInit();
  fbInstallHooks();
  fbUpdateUI();

  // Détecter offline/online
  window.addEventListener('online',  () => fbSetSyncStatus(fbUser ? 'ok' : 'offline'));
  window.addEventListener('offline', () => fbSetSyncStatus('offline'));
}
