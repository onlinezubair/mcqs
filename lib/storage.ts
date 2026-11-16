const DB_NAME = 'mcqProjectorDB';
const DB_VERSION = 1;
const STORE_NAME = 'largeValues';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const result = request.result;
        if (result) resolve(result);
        else reject(new Error('IndexedDB open succeeded but result is null'));
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
  }
  return dbPromise;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed'));
  });
}

export async function idbDelete(key: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
  });
}

const MAX_LOCALSTORAGE = 500 * 1024;

export async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (value.length > MAX_LOCALSTORAGE) {
      const ptrKey = `__idb_ptr_${key}`;
      await idbSet(key, value);
      localStorage.setItem(ptrKey, '1');
    } else {
      throw e;
    }
  }
}

export async function safeGetItem(key: string): Promise<string | null> {
  const ptrKey = `__idb_ptr_${key}`;
  if (localStorage.getItem(ptrKey) === '1') {
    const result = await idbGet<string>(key);
    return result ?? null;
  }
  return localStorage.getItem(key);
}

export async function safeRemoveItem(key: string): Promise<void> {
  const ptrKey = `__idb_ptr_${key}`;
  localStorage.removeItem(key);
  localStorage.removeItem(ptrKey);
  try {
    await idbDelete(key);
  } catch {
    // ignore
  }
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}