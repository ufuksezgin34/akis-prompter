import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Profile, Script } from '../model/types';

export const DB_NAME = 'akis-prompter';
export const DB_VERSION = 1;

export interface SetList {
  id: string;
  name: string;
  items: { scriptId: string; done: boolean }[];
  updatedAt: number;
}

export interface Take {
  id: string;
  scriptId: string;
  number: number;
  note: string;
  good: boolean;
  /** Take başladığındaki/bittiğindeki okuma konumu (blok kimliği). Video dosyası DEĞİLDİR. */
  blockId: string | null;
  at: number;
}

interface AkisDB extends DBSchema {
  scripts: { key: string; value: Script; indexes: { updatedAt: number } };
  profiles: { key: string; value: Profile };
  meta: { key: string; value: unknown };
  setlists: { key: string; value: SetList };
  takes: { key: string; value: Take; indexes: { scriptId: string } };
}

export type AkisDatabase = IDBPDatabase<AkisDB>;

let dbPromise: Promise<AkisDatabase> | null = null;

/**
 * Şema göçleri `upgrade` içinde, IndexedDB'nin versionchange transaction'ında çalışır;
 * göç yarıda kalırsa tüm transaction geri alınır.
 */
export function getDB(): Promise<AkisDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<AkisDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const s = db.createObjectStore('scripts', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
          db.createObjectStore('profiles', { keyPath: 'id' });
          db.createObjectStore('meta');
          db.createObjectStore('setlists', { keyPath: 'id' });
          const t = db.createObjectStore('takes', { keyPath: 'id' });
          t.createIndex('scriptId', 'scriptId');
        }
      },
      blocking() {
        // Başka sekme yeni şemaya geçmek istiyor: bağlantıyı bırak, sayfa yenilemesi kullanıcıya bırakılır.
        void dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    }).catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/** Testler için. */
export async function _resetDB(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export type { AppSettings };
