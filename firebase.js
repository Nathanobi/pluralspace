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
let fbSyncActive = false;       // listeners temps réel actifs
let fbListeners  = [];          // unsubscribe functions
let fbSyncDebounce = {};        // debounce par collection

// Collections synchronisées (pas les settings — trop local)
const SYNC_COLLECTIONS = ['prenoms', 'tags', 'proxys', 'images', 'profils'];

// Debounce delay pour éviter de spammer Firestore (ms)
const SYNC_DEBOUNCE_MS = 800;

// ── INIT SDK (chargé via CDN dans index.html) ──
function fbInit() {
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();
    // Activer la persistence offline (fonctionne hors ligne)
    fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    console.log('[Firebase] Initialisé ✓');
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
    await fbAuth.signInWithPopup(provider);
    // fbWatchAuthState gère le reste
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
  fbAuth.onAuthStateChanged(async user => {
    if (user) {
      fbUser = user;
      console.log('[Firebase] Connectée :', user.email);
      fbUpdateUI();
      // Charger les données cloud puis activer la sync auto
      await fbPullAll();
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

// Pull complet : charger tout depuis Firestore → IndexedDB + mémoire
async function fbPullAll() {
  if (!fbUser || !fbDb) return;
  try {
    fbSetSyncStatus('syncing');
    for (const col of SYNC_COLLECTIONS) {
      const snap = await fbColRef(col).get();
      if (snap.empty) continue;

      // Vider la collection locale et remplacer
      await dbClear(col);

      const items = [];
      snap.forEach(doc => items.push(doc.data()));

      for (const item of items) {
        await dbPut(col, item);
      }

      // Mettre à jour la mémoire
      if      (col === 'prenoms') prenoms = items;
      else if (col === 'tags')    tags    = items;
      else if (col === 'proxys')  proxys  = items;
      else if (col === 'images')  images  = items;
      else if (col === 'profils') profils = items;
    }
    // Rafraîchir tout l'affichage
    renderPrenoms(); renderProxys(); renderImages();
    renderProfils(); renderTagsPage(); renderTagsPrenomView();
    renderTagFilters(); renderImgTagFilters();
    renderProxyTagFilters(); renderProfilTagFilters();
    renderNoProxyBanner(); updateStats();
    fbSetSyncStatus('ok');
    console.log('[Firebase] Pull terminé ✓');
  } catch(e) {
    fbSetSyncStatus('error');
    console.error('[Firebase] Pull erreur :', e);
    toast('Erreur de synchronisation.', 'error');
  }
}

// Push un seul document vers Firestore
async function fbPushDoc(collection, item) {
  if (!fbUser || !fbDb || !item?.id) return;
  try {
    await fbColRef(collection).doc(item.id).set(item);
  } catch(e) {
    console.error(`[Firebase] Push ${collection}/${item.id} :`, e);
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

// Listeners temps réel : Firestore → local (pour sync multi-appareils)
function fbStartListeners() {
  if (fbSyncActive || !fbUser) return;
  fbSyncActive = true;

  for (const col of SYNC_COLLECTIONS) {
    const unsub = fbColRef(col).onSnapshot(snap => {
      snap.docChanges().forEach(async change => {
        const data = change.doc.data();
        if (change.type === 'added' || change.type === 'modified') {
          await dbPut(col, data);
          fbMergeInMemory(col, data, false);
        } else if (change.type === 'removed') {
          await dbDelete(col, data.id);
          fbMergeInMemory(col, data, true);
        }
      });
      // Rafraîchir l'affichage si des changements sont venus d'un autre appareil
      if (!snap.metadata.hasPendingWrites) {
        fbRefreshViews();
      }
    }, err => {
      console.error('[Firebase] Listener erreur :', err);
      fbSetSyncStatus('error');
    });
    fbListeners.push(unsub);
  }
  console.log('[Firebase] Listeners temps réel actifs ✓');
}

function fbStopListeners() {
  fbListeners.forEach(unsub => unsub());
  fbListeners = [];
  fbSyncActive = false;
}

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

// Push initial : envoyer toutes les données locales vers Firestore
// (utile à la première connexion pour migrer les données existantes)
async function fbPushAll() {
  if (!fbUser || !fbDb) return;
  try {
    fbSetSyncStatus('syncing');
    const counts = {};
    for (const col of SYNC_COLLECTIONS) {
      const items = await dbGetAll(col);
      counts[col] = items.length;
      // Batch write par lot de 500 (limite Firestore)
      for (let i = 0; i < items.length; i += 400) {
        const batch = fbDb.batch();
        items.slice(i, i + 400).forEach(item => {
          batch.set(fbColRef(col).doc(item.id), item);
        });
        await batch.commit();
      }
    }
    fbSetSyncStatus('ok');
    const total = Object.values(counts).reduce((a,b) => a+b, 0);
    toast(`${total} éléments synchronisés vers le cloud ✓`, 'success');
    console.log('[Firebase] Push all terminé :', counts);
  } catch(e) {
    fbSetSyncStatus('error');
    console.error('[Firebase] Push all erreur :', e);
    toast('Erreur lors de l\'envoi vers le cloud.', 'error');
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
  } else {
    unlogged.style.display = '';
    logged.style.display   = 'none';
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
