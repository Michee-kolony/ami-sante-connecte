// Stockage local de l'espace administrateur (IndexedDB) pour le travail hors connexion :
// « lectures » = dernières réponses de l'API (dossiers consultés), « operations » = saisies en attente d'envoi.

const BASE = 'ami-hors-ligne';
const VERSION = 1;
export type Magasin = 'lectures' | 'operations';

let ouverture: Promise<IDBDatabase> | null = null;

function base(): Promise<IDBDatabase> {
  ouverture ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('lectures')) db.createObjectStore('lectures');
      if (!db.objectStoreNames.contains('operations')) db.createObjectStore('operations', { keyPath: 'operationId' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      ouverture = null;
      reject(r.error);
    };
  });
  return ouverture;
}

async function transaction<T>(magasin: Magasin, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await base();
  return new Promise((resolve, reject) => {
    const t = db.transaction(magasin, mode);
    const requete = action(t.objectStore(magasin));
    t.oncomplete = () => resolve(requete.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const lire = <T>(magasin: Magasin, cle: string) => transaction<T | undefined>(magasin, 'readonly', (s) => s.get(cle));
export const ecrire = (magasin: Magasin, valeur: unknown, cle?: string) => transaction(magasin, 'readwrite', (s) => s.put(valeur, cle));
export const effacer = (magasin: Magasin, cle: string) => transaction(magasin, 'readwrite', (s) => s.delete(cle));
export const toutLire = <T>(magasin: Magasin) => transaction<T[]>(magasin, 'readonly', (s) => s.getAll());
export const vider = (magasin: Magasin) => transaction(magasin, 'readwrite', (s) => s.clear());
