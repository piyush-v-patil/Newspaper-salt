import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, syncConfigured } from './config';
import type { OutgoingChange, RemoteRow, SyncTransport } from './transport';

let client: SupabaseClient | null = null;

/** The one Supabase client, or null when this build has no project set. */
export function supabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pi-auth' },
  });
  return client;
}

/** The server as the sync engine sees it: the push_records function and the records table. */
export function supabaseTransport(sb: SupabaseClient): SyncTransport {
  return {
    async push(changes: OutgoingChange[]) {
      const { error } = await sb.rpc('push_records', { changes });
      if (error) throw new Error(error.message);
    },
    async pull(sinceSeq: number, limit: number): Promise<RemoteRow[]> {
      const { data, error } = await sb.from('records').select('tbl, id, data, deleted, changed_at, seq').gt('seq', sinceSeq).order('seq').limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ ...r, changed_at: Number(r.changed_at), seq: Number(r.seq) }) as RemoteRow);
    },
  };
}
