import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { command, db } from '../db';
import type { Channel, Id } from '../types';

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
