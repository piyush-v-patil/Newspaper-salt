/** One record as the server holds it. */
export interface RemoteRow {
  tbl: string;
  id: string;
  data: unknown;
  deleted: boolean;
  changed_at: number;
  seq: number;
}

export type OutgoingChange = Omit<RemoteRow, 'seq'>;

/** The server, as the sync engine sees it. Supabase in the app; an in-memory stand-in in tests. */
export interface SyncTransport {
  /** Saves changes; for each record the most recent change wins. */
  push(changes: OutgoingChange[]): Promise<void>;
  /** Records changed after `sinceSeq`, oldest first, at most `limit`. */
  pull(sinceSeq: number, limit: number): Promise<RemoteRow[]>;
}

/** A server held in memory, with the same rules as the real one. For tests. */
export class MemoryTransport implements SyncTransport {
  rows = new Map<string, RemoteRow>();
  private seq = 0;
  async push(changes: OutgoingChange[]): Promise<void> {
    for (const c of changes) {
      const key = `${c.tbl}\u0000${c.id}`;
      const existing = this.rows.get(key);
      if (existing && existing.changed_at > c.changed_at) continue;
      this.rows.set(key, { ...c, data: c.deleted ? null : structuredClone(c.data), seq: ++this.seq });
    }
  }
  async pull(sinceSeq: number, limit: number): Promise<RemoteRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.seq > sinceSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
}
