// Stockage local de l'espace administrateur (IndexedDB) pour le travail hors connexion :
//   - « lectures »   : dernières réponses de l'API (dossiers consultés ou copiés par la préparation) ;
//   - « operations » : file des saisies en attente d'envoi (outbox) ;
//   - « locaux »     : dossiers créés sur l'appareil (local_id ↔ server_id) ;
//   - « journal »    : accusés de réception des saisies envoyées (trace des synchronisations) ;
//   - « cles »       : clé de chiffrement de l'appareil.
// Données de santé chiffrées au repos (AES-GCM 256, WebCrypto) avec une clé générée sur l'appareil,
// non exportable. Les enregistrements écrits par une version précédente (en clair) restent lisibles :
// une mise à jour de l'application ne fait perdre aucune saisie en attente.

const BASE = 'ami-hors-ligne';
const VERSION = 2;
export type Magasin = 'lectures' | 'operations' | 'locaux' | 'journal';
/** Champ clé des magasins dont la clé est dans l'objet (laissé en clair dans l'enveloppe chiffrée). */
const CLE_INTERNE: Partial<Record<Magasin, string>> = { operations: 'operationId', locaux: 'localId', journal: 'operationId' };

let ouverture: Promise<IDBDatabase> | null = null;

function base(): Promise<IDBDatabase> {
  ouverture ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, VERSION);
    // Montée de version : on ajoute seulement les magasins manquants, les données existantes restent.
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('lectures')) db.createObjectStore('lectures');
      if (!db.objectStoreNames.contains('operations')) db.createObjectStore('operations', { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains('locaux')) db.createObjectStore('locaux', { keyPath: 'localId' });
      if (!db.objectStoreNames.contains('journal')) db.createObjectStore('journal', { keyPath: 'operationId' });
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

async function transaction<T>(magasin: Magasin | 'cles', mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await base();
  return new Promise((resolve, reject) => {
    const t = db.transaction(magasin, mode);
    const requete = action(t.objectStore(magasin));
    t.oncomplete = () => resolve(requete.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// --- Chiffrement ----------------------------------------------------------------------------

/** Chiffrement disponible : contexte sécurisé (HTTPS ou localhost) avec WebCrypto. */
export const chiffrementDisponible = () => typeof crypto !== 'undefined' && !!crypto.subtle && globalThis.isSecureContext !== false;

let cle: Promise<CryptoKey | null> | null = null;

function cleAppareil(): Promise<CryptoKey | null> {
  cle ??= (async () => {
    if (!chiffrementDisponible()) return null;
    const existante = await transaction<CryptoKey | undefined>('cles', 'readonly', s => s.get('aes'));
    if (existante) return existante;
    const nouvelle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await transaction('cles', 'readwrite', s => s.put(nouvelle, 'aes'));
    return nouvelle;
  })().catch(() => null);
  return cle;
}

/** Enveloppe chiffrée telle qu'elle est rangée dans IndexedDB. */
interface Enveloppe { __chiffre: true; iv: Uint8Array; donnees: ArrayBuffer; [cle: string]: unknown }

const estEnveloppe = (v: unknown): v is Enveloppe => !!v && typeof v === 'object' && (v as Enveloppe).__chiffre === true;

/** Les photos (Blob) des saisies sont converties pour passer dans le texte chiffré. */
async function versTexte(valeur: unknown): Promise<string> {
  const blobs: Blob[] = [];
  const texte = JSON.stringify(valeur, (_k, v) => {
    if (v instanceof Blob) {
      blobs.push(v);
      return { __blob: blobs.length - 1, type: v.type };
    }
    return v;
  });
  if (!blobs.length) return texte;
  const contenus = await Promise.all(blobs.map(b => b.arrayBuffer().then(octetsEnBase64)));
  return JSON.stringify({ __texte: texte, __blobs: contenus });
}

function depuisTexte(texte: string): unknown {
  const brut = JSON.parse(texte);
  if (!brut || typeof brut !== 'object' || !('__texte' in brut)) return brut;
  const contenus: string[] = brut.__blobs;
  return JSON.parse(brut.__texte, (_k, v) => (v && typeof v === 'object' && typeof v.__blob === 'number'
    ? new Blob([base64EnOctets(contenus[v.__blob])], { type: v.type })
    : v));
}

function octetsEnBase64(b: ArrayBuffer): string {
  const o = new Uint8Array(b);
  let s = '';
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64EnOctets(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function chiffrer(magasin: Magasin, valeur: unknown): Promise<unknown> {
  const k = await cleAppareil();
  if (!k) return valeur;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const donnees = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(await versTexte(valeur)));
  const enveloppe: Enveloppe = { __chiffre: true, iv, donnees };
  const champ = CLE_INTERNE[magasin];
  if (champ) enveloppe[champ] = (valeur as Record<string, unknown>)[champ];
  return enveloppe;
}

async function dechiffrer<T>(valeur: unknown): Promise<T | undefined> {
  if (valeur == null) return undefined;
  if (!estEnveloppe(valeur)) return valeur as T; // écrit en clair par une version précédente
  const k = await cleAppareil();
  if (!k) return undefined;
  try {
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: valeur.iv }, k, valeur.donnees);
    return depuisTexte(new TextDecoder().decode(clair)) as T;
  } catch {
    return undefined; // clé effacée (révocation) : donnée illisible
  }
}

// --- API du stockage -------------------------------------------------------------------------

export const lire = async <T>(magasin: Magasin, cleLecture: string) =>
  dechiffrer<T>(await transaction<unknown>(magasin, 'readonly', s => s.get(cleLecture)));

export const ecrire = async (magasin: Magasin, valeur: unknown, cleEcriture?: string) => {
  const v = await chiffrer(magasin, valeur);
  return transaction(magasin, 'readwrite', s => s.put(v, cleEcriture));
};

export const effacer = (magasin: Magasin, cleEffacement: string) => transaction(magasin, 'readwrite', s => s.delete(cleEffacement));

export const toutLire = async <T>(magasin: Magasin): Promise<T[]> => {
  const brut = await transaction<unknown[]>(magasin, 'readonly', s => s.getAll());
  const valeurs = await Promise.all(brut.map(v => dechiffrer<T>(v)));
  return valeurs.filter(v => v !== undefined) as T[];
};

export const vider = (magasin: Magasin) => transaction(magasin, 'readwrite', s => s.clear());

/**
 * Effacement sécurisé (appareil révoqué, perte ou vol) : la base entière et sa clé disparaissent ;
 * ce qui resterait sur le disque est illisible sans la clé.
 */
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

/**
 * L'application est-elle entièrement copiée dans le cache du navigateur ? (page, scripts et styles de la
 * version en cours) : c'est la condition pour qu'elle s'ouvre sans réseau. Faux tant que la première
 * visite en ligne n'a pas fini de tout télécharger.
 */
export async function applicationEnCache(): Promise<boolean> {
  if (typeof caches === 'undefined' || !navigator.serviceWorker?.controller) return false;
  try {
    const fichiers = [
      new URL('/index.html', location.origin).href,
      ...Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'), s => s.src),
      ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]'), l => l.href),
    ].filter(u => u.startsWith(location.origin));
    const trouves = await Promise.all(fichiers.map(u => caches.match(u, { ignoreVary: true, ignoreSearch: true })));
    return trouves.every(Boolean);
  } catch {
    return false;
  }
}
