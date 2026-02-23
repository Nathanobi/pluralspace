// ── DB ──
const DB_NAME = 'PluralSpace', DB_VERSION = 1;
let db;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      ['prenoms','tags','proxys','images','profils','settings'].forEach(name => {
        if (!d.objectStoreNames.contains(name)) {
          const s = d.createObjectStore(name, { keyPath: name==='settings' ? 'key' : 'id' });
          if (name==='prenoms') {
            s.createIndex('name','name',{unique:false});
            s.createIndex('createdAt','createdAt',{unique:false});
          }
        }
      });
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror = rej;
  });
}

const dbGet    = (store, key) => new Promise((res,rej) => { const r=db.transaction(store,'readonly').objectStore(store).get(key); r.onsuccess=()=>res(r.result); r.onerror=rej; });
const dbGetAll = store       => new Promise((res,rej) => { const r=db.transaction(store,'readonly').objectStore(store).getAll(); r.onsuccess=()=>res(r.result); r.onerror=rej; });
const dbPut    = (store,val) => new Promise((res,rej) => { const r=db.transaction(store,'readwrite').objectStore(store).put(val); r.onsuccess=()=>res(r.result); r.onerror=rej; });
const dbDelete = (store,key) => new Promise((res,rej) => { const r=db.transaction(store,'readwrite').objectStore(store).delete(key); r.onsuccess=()=>res(); r.onerror=rej; });
const dbClear  = store       => new Promise((res,rej) => { const r=db.transaction(store,'readwrite').objectStore(store).clear(); r.onsuccess=()=>res(); r.onerror=rej; });
