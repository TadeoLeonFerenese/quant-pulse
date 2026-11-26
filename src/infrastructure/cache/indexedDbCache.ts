import type { SnapshotCachePort } from '@/domain/integrity/ports';
import type { TrustedSnapshot } from '@/domain/integrity/types';

const DEFAULT_DB_NAME = 'quant-pulse-cache';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

export class IndexedDbSnapshotCache implements SnapshotCachePort {
  private readonly dbName: string;
  private readonly idbFactory: IDBFactory | null;

  constructor(
    dbName = DEFAULT_DB_NAME,
    idbFactory: IDBFactory | null = typeof indexedDB === 'undefined' ? null : indexedDB,
  ) {
    this.dbName = dbName;
    this.idbFactory = idbFactory;
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    if (!this.idbFactory) {
      return Promise.resolve(null);
    }

    const factory = this.idbFactory;
    return new Promise((resolve) => {
      try {
        const request = factory.open(this.dbName, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'sourceId' });
          }
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  async get<T>(sourceId: string): Promise<TrustedSnapshot<T> | null> {
    const db = await this.openDatabase();
    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(sourceId);
        request.onsuccess = () => {
          const value = request.result as TrustedSnapshot<T> | undefined;
          resolve(value ?? null);
        };
        request.onerror = () => {
          resolve(null);
        };
        tx.oncomplete = () => {
          db.close();
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  }

  async set<T>(snapshot: TrustedSnapshot<T>): Promise<void> {
    const db = await this.openDatabase();
    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(snapshot);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }
}
