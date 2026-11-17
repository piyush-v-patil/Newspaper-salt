import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { command, db } from '../db';
import type { Channel, Context, Id } from '../types';
import { recordUndo } from '../undo';

/** Tag colours, assigned in turn so new channels look distinct. */
export const CHANNEL_COLORS = [
  '#4f5bd5', '#2e9f68', '#c9820f', '#d0507a', '#3a8fc9', '#8a5bd0',
  '#d2603a', '#3aa6a0', '#7a8a2e', '#b0509f', '#5c6b7a', '#c2473f',
];

/** Lower-case, no leading #, spaces to hyphens: how a channel name is stored. */
export function normalizeChannelName(name: string): string {
  return name.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
}

/** Returns the existing channel of that name, or creates one. */
export const createChannel = command(async (name: string, contextId: Id | null = null): Promise<Channel> => {
  const clean = normalizeChannelName(name);
  if (!clean) throw new Error('A channel needs a name.');
  const all = await db.channels.toArray();
  const existing = all.find((c) => c.name === clean);
  if (existing) return existing;
  const channel: Channel = {
    id: crypto.randomUUID(),
    contextId,
    name: clean,
    color: CHANNEL_COLORS[all.length % CHANNEL_COLORS.length],
    isDefault: false,
    enabled: true,
    order: keyAtEdge(all.map((c) => c.order).sort(compareKeys), 'bottom'),
  };
  await db.channels.add(channel);
  return channel;
});

/** Renames, recolours, moves, enables or disables a channel. Making one the default clears the others. */
export const updateChannel = command(async (id: Id, patch: Partial<Omit<Channel, 'id'>>): Promise<void> => {
  const next = { ...patch };
  if (next.name !== undefined) {
    next.name = normalizeChannelName(next.name);
    if (!next.name) return;
  }
  if (next.isDefault) {
    for (const other of await db.channels.toArray()) if (other.isDefault && other.id !== id) await db.channels.update(other.id, { isDefault: false });
  }
  await db.channels.update(id, next);
});

export const createContext = command(async (name: string): Promise<Context> => {
  const clean = name.trim();
  if (!clean) throw new Error('A context needs a name.');
  const all = await db.contexts.toArray();
  const context: Context = {
    id: crypto.randomUUID(),
    name: clean,
    color: CHANNEL_COLORS[(all.length * 5) % CHANNEL_COLORS.length],
    isPersonal: false,
    order: keyAtEdge(all.map((c) => c.order).sort(compareKeys), 'bottom'),
  };
  await db.contexts.add(context);
  return context;
});

export const updateContext = command(async (id: Id, patch: Partial<Omit<Context, 'id'>>): Promise<void> => {
  if (patch.name !== undefined && !patch.name.trim()) return;
  await db.contexts.update(id, patch);
});

/** Deletes a context. Its channels stay, without a context. */
export const deleteContext = command(async (id: Id): Promise<void> => {
  const context = await db.contexts.get(id);
  if (!context) return;
  const channels = await db.channels.where('contextId').equals(id).toArray();
  await db.contexts.delete(id);
  for (const channel of channels) await db.channels.update(channel.id, { contextId: null });
  recordUndo(
    `Context “${context.name}” deleted`,
    async () => {
      await db.contexts.put(context);
      for (const channel of channels) await db.channels.update(channel.id, { contextId: id });
    },
    true,
  );
});
