// Stockage local de l'application RECO (IndexedDB), chiffré quand la plateforme le permet
// (section 12) : la clé AES-GCM est générée sur l'appareil, non exportable, et rangée dans
// IndexedDB ; les tâches et les actions en attente ne sont jamais écrites en clair.
// À la déconnexion, la base est supprimée (clé comprise) : les données ne sont plus lisibles.

const BASE = 'ami-reco';
const VERSION = 1;

let ouverture: Promise<IDBDatabase> | null = null;

function base(): Promise<IDBDatabase> {
  ouverture ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('donnees')) db.createObjectStore('donnees');
      if (!db.objectStoreNames.contains('cles')) db.createObjectStore('cles');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      ouverture = null;
      reject(r.error);
    };
  });
  return ouverture;
}

function requete<T>(magasin: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return base().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(magasin, mode);
    const r = action(t.objectStore(magasin));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** Chiffrement disponible : contexte sécurisé (HTTPS) avec WebCrypto. */
const chiffrementDisponible = () => typeof crypto !== 'undefined' && !!crypto.subtle && globalThis.isSecureContext !== false;

let cle: Promise<CryptoKey | null> | null = null;

function cleAppareil(): Promise<CryptoKey | null> {
  cle ??= (async () => {
    if (!chiffrementDisponible()) return null;
    const existante = await requete<CryptoKey | undefined>('cles', 'readonly', s => s.get('aes'));
    if (existante) return existante;
    const nouvelle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await requete('cles', 'readwrite', s => s.put(nouvelle, 'aes'));
    return nouvelle;
  })().catch(() => null);
  return cle;
}

interface Enveloppe { chiffre: boolean; iv?: Uint8Array; donnees: ArrayBuffer | string }

export async function ecrire(nom: string, valeur: unknown): Promise<void> {
  const texte = JSON.stringify(valeur);
  const k = await cleAppareil();
  let enveloppe: Enveloppe;
  if (k) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    enveloppe = { chiffre: true, iv, donnees: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(texte)) };
  } else {
    enveloppe = { chiffre: false, donnees: texte };
  }
  await requete('donnees', 'readwrite', s => s.put(enveloppe, nom));
}

export async function lire<T>(nom: string): Promise<T | null> {
  const e = await requete<Enveloppe | undefined>('donnees', 'readonly', s => s.get(nom)).catch(() => undefined);
  if (!e) return null;
  try {
    if (!e.chiffre) return JSON.parse(e.donnees as string) as T;
    const k = await cleAppareil();
    if (!k || !e.iv) return null;
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: e.iv }, k, e.donnees as ArrayBuffer);
    return JSON.parse(new TextDecoder().decode(clair)) as T;
  } catch {
    return null;
  }
}

/** Suppression sécurisée : la base et la clé disparaissent ensemble. */
export async function toutEffacer(): Promise<void> {
  const db = await ouverture?.catch(() => null);
  db?.close();
  ouverture = null;
  cle = null;
  await new Promise<void>(resolve => {
    const r = indexedDB.deleteDatabase(BASE);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}

export const estChiffre = chiffrementDisponible;

/**
 * Empreinte du mot de passe pour déverrouiller l'application sans réseau (PBKDF2, sel aléatoire).
 * Le mot de passe lui-même n'est jamais conservé.
 */
export async function empreinte(motDePasse: string, sel: Uint8Array): Promise<string> {
  if (!chiffrementDisponible()) return '';
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sel, iterations: 150000, hash: 'SHA-256' }, base, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
