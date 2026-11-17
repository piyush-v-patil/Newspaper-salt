import type { Dexie } from 'dexie';
import { markRemote, type Outbox, type PendingChange } from './changes';
import type { RemoteRow, SyncTransport } from './transport';

const PUSH_BATCH = 500;
const PULL_BATCH = 1000;
/**
 * Each pull looks back a little before the last position, in case a change
 * was committed on the server slightly out of order. Applying a change twice
 * does no harm.
 */
const OVERLAP = 200;

export interface SyncState {
  /** The highest server position this device has applied. */
  cursor: number;
}

/** Sends this device's changes: the current version of each changed record, or a deletion. */
export async function push(db: Dexie, transport: SyncTransport, outbox: Outbox): Promise<number> {
  const pending = outbox.all();
  for (let i = 0; i < pending.length; i += PUSH_BATCH) {
    const batch = pending.slice(i, i + PUSH_BATCH);
    const changes = await Promise.all(
      batch.map(async (c) => {
        const data = await db.table(c.tbl).get(c.id);
        return { tbl: c.tbl, id: c.id, data: data ?? null, deleted: data === undefined, changed_at: c.changedAt };
      }),
    );
    await transport.push(changes);
    outbox.clearSent(batch);
  }
  return pending.length;
}

/**
 * Applies what other devices changed. A record changed here more recently
 * than the server's version is left alone; it goes up on the next push.
 */
export async function pull(db: Dexie, transport: SyncTransport, outbox: Outbox, state: SyncState, tables: readonly string[]): Promise<{ applied: number; state: SyncState }> {
  let cursor = state.cursor;
  let applied = 0;
  let since = Math.max(0, cursor - OVERLAP);
  for (;;) {
    const rows = await transport.pull(since, PULL_BATCH);
    if (rows.length === 0) break;
    applied += await apply(db, outbox, rows, tables);
    since = rows[rows.length - 1].seq;
    cursor = Math.max(cursor, since);
    if (rows.length < PULL_BATCH) break;
  }
  return { applied, state: { cursor } };
}

async function apply(db: Dexie, outbox: Outbox, rows: RemoteRow[], tables: readonly string[]): Promise<number> {
  const known = new Set(tables);
  const wanted = rows.filter((row) => {
    if (!known.has(row.tbl)) return false;
    const local = outbox.get(row.tbl, row.id);
    // A newer change here wins; an older one is overtaken.
    if (local && local.changedAt > row.changed_at) return false;
    return true;
  });
  if (wanted.length === 0) return 0;
  const touched = [...new Set(wanted.map((r) => r.tbl))].map((t) => db.table(t));
  let applied = 0;
  await db.transaction('rw', touched, async (tx) => {
    markRemote(tx);
    for (const row of wanted) {
      const table = db.table(row.tbl);
      if (row.deleted) await table.delete(row.id);
      else await table.put(row.data);
      applied++;
    }
  });
  for (const row of wanted) {
    const local = outbox.get(row.tbl, row.id);
    if (local && local.changedAt <= row.changed_at) outbox.drop(row.tbl, row.id);
  }
  return applied;
}

/** One full round: send what changed here, then fetch what changed elsewhere. */
export async function syncOnce(db: Dexie, transport: SyncTransport, outbox: Outbox, state: SyncState, tables: readonly string[]) {
  const sent = await push(db, transport, outbox);
  const { applied, state: next } = await pull(db, transport, outbox, state, tables);
  return { sent, applied, state: next };
}

/** Marks every record on this device as changed, so the next push uploads all of it. */
export async function markEverything(db: Dexie, outbox: Outbox, tables: readonly string[], at: number): Promise<void> {
  const changes: PendingChange[] = [];
  for (const tbl of tables) {
    for (const key of await db.table(tbl).toCollection().primaryKeys()) changes.push({ tbl, id: String(key), changedAt: at });
  }
  outbox.noteAll(changes);
}

/** Replaces this device's data with the account's: everything here is cleared, then the server's copy applied. */
export async function replaceWithRemote(db: Dexie, transport: SyncTransport, outbox: Outbox, tables: readonly string[]): Promise<SyncState> {
  outbox.clear();
  await db.transaction('rw', tables.map((t) => db.table(t)), async (tx) => {
    markRemote(tx);
    for (const t of tables) await db.table(t).clear();
  });
  return (await pull(db, transport, outbox, { cursor: 0 }, tables)).state;
}
