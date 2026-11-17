import Dexie, { type Table } from 'dexie';
import { backupFileName } from '@/domain/backupPolicy';
import type { BackupStore } from './types';

interface Snapshot {
  id: string;
  at: number;
  size: number;
  text: string;
}

/** Kept apart from the app's own database, so erasing or restoring that one leaves these alone. */
class SnapshotDb extends Dexie {
  snapshots!: Table<Snapshot, string>;
  constructor() {
    super('life-of-pi-backups');
    this.version(1).stores({ snapshots: 'id, at' });
  }
}

let snapshotDb: SnapshotDb | null = null;
const store = () => (snapshotDb ??= new SnapshotDb());

/** Backups inside the browser. They guard against mistakes, not against clearing the browser's data. */
export const browserBackups: BackupStore = {
  location: async () => null,
  chooseLocation: null,
  async list() {
    return (await store().snapshots.toArray()).map(({ id, at, size }) => ({ id, at, size }));
  },
  async write(at, text) {
    let id = backupFileName(at);
    // Two in the same minute get a suffix rather than replacing each other.
    for (let n = 2; await store().snapshots.get(id); n++) id = backupFileName(at).replace('.json', `-${n}.json`);
    await store().snapshots.put({ id, at, size: text.length, text });
  },
  async read(id) {
    const snapshot = await store().snapshots.get(id);
    if (!snapshot) throw new Error('That backup no longer exists.');
    return snapshot.text;
  },
  async remove(id) {
    await store().snapshots.delete(id);
  },
};
