import type { Workspace, Unit, Pool, ManualDiscount, Sale } from './model';
export type CachedWorkspace = {
  data: Workspace;
  version: number;
  artist: {
    id: string;
    displayName: string;
    email: string;
    provider?: string;
  };
};
export type PendingSale = {
  id: string;
  artistId: string;
  createdAt: string;
  eventId: string;
  saleDate: string;
  units: Unit[];
  pools: Pool[];
  reference: string;
  manualDiscount?: ManualDiscount;
  lines: Sale['lines'];
  error?: string;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('boothbook-offline', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('pending', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function operation<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      request = run(tx.objectStore(store));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || request.error || Error('Unable to save on this device.'));
    };
  });
}
export const cacheWorkspace = (row: CachedWorkspace) =>
  operation('state', 'readwrite', (s) => s.put(row, 'workspace'));
export const cachedWorkspace = () =>
  operation<CachedWorkspace | undefined>('state', 'readonly', (s) => s.get('workspace'));
export const clearCachedWorkspace = () =>
  operation('state', 'readwrite', (s) => s.delete('workspace'));
export const cacheReport = (row: CachedWorkspace, eventId: string) =>
  operation('state', 'readwrite', (s) => s.put(row, 'report:' + row.artist.id + ':' + eventId));
export const cachedReport = (artistId: string, eventId: string) =>
  operation<CachedWorkspace | undefined>('state', 'readonly', (s) =>
    s.get('report:' + artistId + ':' + eventId),
  );
export const savePending = (sale: PendingSale) =>
  operation('pending', 'readwrite', (s) => s.put(sale));
export const removePending = (id: string) => operation('pending', 'readwrite', (s) => s.delete(id));
export async function pendingSales(artistId: string) {
  return (await operation<PendingSale[]>('pending', 'readonly', (s) => s.getAll()))
    .filter((s) => s.artistId === artistId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
