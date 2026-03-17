import type { HistoricalSnapshot, SalesRecord, SOHRecord, UploadedFile } from './types';

const DB_NAME = 'inventoryplanner03';
const DB_VERSION = 1;

type SalesBucket = {
  period: string;
  records: SalesRecord[];
  updatedAt: string;
};

type SohBucket = {
  key: string;
  period: string;
  region: 'jkt' | 'sby';
  records: SOHRecord[];
  updatedAt: string;
};

type SnapshotBucket = HistoricalSnapshot & { period: string };

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB tidak tersedia di environment ini.');
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains('sales_by_period')) {
        db.createObjectStore('sales_by_period', { keyPath: 'period' });
      }

      if (!db.objectStoreNames.contains('soh_by_period_region')) {
        db.createObjectStore('soh_by_period_region', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('uploaded_files')) {
        db.createObjectStore('uploaded_files', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('historical_snapshots')) {
        db.createObjectStore('historical_snapshots', { keyPath: 'period' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Gagal membuka IndexedDB'));
  });

  return dbPromise;
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const result = await requestToPromise(store.getAll() as IDBRequest<T[]>);
  await txDone(tx);
  return result ?? [];
}

async function getFromStore<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const result = await requestToPromise(store.get(key) as IDBRequest<T | undefined>);
  await txDone(tx);
  return result;
}

async function putToStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await requestToPromise(store.put(value as never));
  await txDone(tx);
}

async function bulkPutToStore<T>(storeName: string, values: T[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const value of values) {
    store.put(value as never);
  }
  await txDone(tx);
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await requestToPromise(store.delete(key));
  await txDone(tx);
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await requestToPromise(store.clear());
  await txDone(tx);
}

function sohKey(period: string, region: 'jkt' | 'sby'): string {
  return `${period}__${region}`;
}

export async function idbSaveSales(period: string, records: SalesRecord[]): Promise<void> {
  const bucket: SalesBucket = { period, records, updatedAt: new Date().toISOString() };
  await putToStore('sales_by_period', bucket);
}

export async function idbGetSales(period: string): Promise<SalesRecord[] | null> {
  const bucket = await getFromStore<SalesBucket>('sales_by_period', period);
  return bucket?.records ?? null;
}

export async function idbDeleteSales(period: string): Promise<void> {
  await deleteFromStore('sales_by_period', period);
}

export async function idbSaveSOH(period: string, region: 'jkt' | 'sby', records: SOHRecord[]): Promise<void> {
  const bucket: SohBucket = {
    key: sohKey(period, region),
    period,
    region,
    records,
    updatedAt: new Date().toISOString(),
  };
  await putToStore('soh_by_period_region', bucket);
}

export async function idbGetSOH(period: string, region: 'jkt' | 'sby'): Promise<SOHRecord[] | null> {
  const bucket = await getFromStore<SohBucket>('soh_by_period_region', sohKey(period, region));
  return bucket?.records ?? null;
}

export async function idbDeleteSOH(period: string, region: 'jkt' | 'sby'): Promise<void> {
  await deleteFromStore('soh_by_period_region', sohKey(period, region));
}

export async function idbReplaceUploadedFiles(files: UploadedFile[]): Promise<void> {
  await clearStore('uploaded_files');
  await bulkPutToStore('uploaded_files', files);
}

export async function idbGetUploadedFiles(): Promise<UploadedFile[]> {
  return getAllFromStore<UploadedFile>('uploaded_files');
}

export async function idbDeleteUploadedFile(fileId: string): Promise<void> {
  await deleteFromStore('uploaded_files', fileId);
}

export async function idbGetSnapshots(): Promise<HistoricalSnapshot[]> {
  const all = await getAllFromStore<SnapshotBucket>('historical_snapshots');
  return all.map(s => s);
}

export async function idbUpsertSnapshot(snapshot: HistoricalSnapshot): Promise<void> {
  await putToStore('historical_snapshots', snapshot as SnapshotBucket);
}

export async function idbGetSnapshot(period: string): Promise<HistoricalSnapshot | undefined> {
  return getFromStore<SnapshotBucket>('historical_snapshots', period);
}
