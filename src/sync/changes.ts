import type { Dexie, Transaction } from 'dexie';
import { now } from '@/domain/clock';

/** A record changed on this device that the server has not seen yet. */
export interface PendingChange {
  tbl: string;
  id: string;
  changedAt: number;
}

const keyOf = (tbl: string, id: string) => `${tbl}\u0000${id}`;

/**
 * The outbox: every record changed on this device since it last reached
 * the server. Kept in localStorage, written synchronously the moment a
 * change is saved, so nothing is lost between saving and noting it.
 */
export class Outbox {
  private items: Map<string, PendingChange> | null = null;
  private listeners = new Set<() => void>();
  /** Off while signed out, so nothing piles up that no server will take. */
  tracking = false;

  constructor(private storageKey: string) {}

  private load(): Map<string, PendingChange> {
    if (this.items) return this.items;
    try {
      const list = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as PendingChange[];
      this.items = new Map(list.map((c) => [keyOf(c.tbl, c.id), c]));
    } catch {
      this.items = new Map();
    }
    return this.items;
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.load().values()]));
    } catch {
      /* storage full or blocked; the in-memory list still syncs this session */
    }
    for (const listener of this.listeners) listener();
  }

  note(tbl: string, id: string, changedAt = now()): void {
    this.load().set(keyOf(tbl, id), { tbl, id, changedAt });
    this.save();
  }

  noteAll(changes: PendingChange[]): void {
    const box = this.load();
    for (const c of changes) box.set(keyOf(c.tbl, c.id), c);
    this.save();
  }

  all(): PendingChange[] {
    return [...this.load().values()];
  }

  get size(): number {
    return this.load().size;
  }

  get(tbl: string, id: string): PendingChange | undefined {
    return this.load().get(keyOf(tbl, id));
  }

  /** Drops sent changes, unless the record changed again while they were on their way. */
  clearSent(sent: PendingChange[]): void {
    const box = this.load();
    for (const c of sent) {
      const current = box.get(keyOf(c.tbl, c.id));
      if (current && current.changedAt <= c.changedAt) box.delete(keyOf(c.tbl, c.id));
    }
    this.save();
  }

  drop(tbl: string, id: string): void {
    if (this.load().delete(keyOf(tbl, id))) this.save();
  }

  clear(): void {
    this.load().clear();
    this.save();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** Transactions that apply changes from the server are marked, so those changes are not sent back. */
const REMOTE = Symbol('remote');
export function markRemote(tx: Transaction): void {
  (tx as unknown as Record<symbol, boolean>)[REMOTE] = true;
}
const isRemote = (tx: Transaction) => (tx as unknown as Record<symbol, boolean>)[REMOTE] === true;

/** Watches every synced table: anything created, changed or deleted here is noted once its transaction commits. */
export function trackChanges(db: Dexie, tables: readonly string[], outbox: Outbox): void {
  for (const name of tables) {
    const table = db.table(name);
    const keyPath = table.schema.primKey.keyPath as string;
    const note = (tx: Transaction, id: unknown) => {
      if (!outbox.tracking || isRemote(tx) || id === undefined || id === null) return;
      tx.on('complete', () => outbox.note(name, String(id)));
    };
    table.hook('creating', function (primKey, obj, tx) {
      note(tx, primKey ?? (obj as Record<string, unknown>)[keyPath]);
    });
    table.hook('updating', function (_mods, primKey, _obj, tx) {
      note(tx, primKey);
    });
    table.hook('deleting', function (primKey, _obj, tx) {
      note(tx, primKey);
    });
  }
}
