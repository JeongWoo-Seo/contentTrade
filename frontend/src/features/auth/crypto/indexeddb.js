import { IDB_NAME, IDB_STORE } from './constants.js';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Persist encrypted credentials (plus IV/salt), keyed by account id.
// Record shape: { id, walletAddress, encryptedPrivateKey, privateKeyIv, encryptedSkOwn, skOwnIv, salt }
export function saveAccount(record) {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(record);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
      .catch(reject);
  });
}

export function getAccount(id) {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(id);
        req.onsuccess = () => {
          db.close();
          resolve(req.result || null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      })
      .catch(reject);
  });
}

export function deleteAccount(id) {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
      .catch(reject);
  });
}
