/** Device-local recovery for unfinished uploads. Remote OAuth tokens are never stored. */
export interface RecoverableUpload {
  id: string;
  file: Blob;
  name: string;
  lastModified: number;
  caption: string;
  uploadedPath?: string;
}
const DATABASE = "everymoment-upload-recovery";
const STORE = "queues";
const TTL = 24 * 60 * 60 * 1000;

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function recoveryKey(token: string, kind: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return `${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}:${kind}`;
}
export async function readRecovery(key: string): Promise<RecoverableUpload[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      let result: RecoverableUpload[] = [];
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        if (entry.value.expiresAt < Date.now()) entry.delete();
        else if (entry.key === key) result = entry.value.items;
        entry.continue();
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export async function writeRecovery(key: string, items: RecoverableUpload[]): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      if (items.length) store.put({ expiresAt: Date.now() + TTL, items }, key);
      else store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
