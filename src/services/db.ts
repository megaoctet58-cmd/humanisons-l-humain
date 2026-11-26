/**
 * Petite couche d'accès à IndexedDB (sans dépendance externe).
 *
 * Magasins :
 *  - posts   : publications et contributions (toutes statuts confondus)
 *  - media   : fichiers binaires (audio, images, justificatifs) sous forme de Blob
 *  - reports : signalements
 *  - kv      : petites valeurs (catégories, favoris, réactions, paramètres…)
 *
 * Pour passer à une vraie base de données, il suffit de remplacer
 * `repository.ts` par une implémentation qui parle à l'API distante :
 * les composants n'utilisent jamais ce fichier directement.
 */

const DB_NAME = 'hlh';
const DB_VERSION = 1;
export type StoreName = 'posts' | 'media' | 'reports' | 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error("IndexedDB n'est pas disponible dans ce navigateur (navigation privée ?)."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('posts')) db.createObjectStore('posts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Impossible d'ouvrir la base locale."));
    req.onblocked = () => reject(new Error('La base locale est bloquée par un autre onglet.'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll<T>(name: StoreName): Promise<T[]> {
  return wrap((await store(name, 'readonly')).getAll() as IDBRequest<T[]>);
}

export async function get<T>(name: StoreName, key: string): Promise<T | undefined> {
  return wrap((await store(name, 'readonly')).get(key) as IDBRequest<T | undefined>);
}

export async function put<T>(name: StoreName, value: T, key?: string): Promise<void> {
  const s = await store(name, 'readwrite');
  await wrap(key === undefined ? s.put(value) : s.put(value, key));
}

export async function del(name: StoreName, key: string): Promise<void> {
  await wrap((await store(name, 'readwrite')).delete(key));
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const names: StoreName[] = ['posts', 'media', 'reports', 'kv'];
  await Promise.all(names.map((n) => wrap(db.transaction(n, 'readwrite').objectStore(n).clear())));
}

/** Estimation de l'espace utilisé / disponible (si le navigateur le permet). */
export async function storageEstimate(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return { usage: est?.usage, quota: est?.quota, persisted };
  } catch {
    return {};
  }
}

/** Demande au navigateur de ne pas effacer les données locales en cas de manque d'espace. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
