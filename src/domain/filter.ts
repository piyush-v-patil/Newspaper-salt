import type { Channel, Id, Task } from '@/data/types';

export type TaskFilter = { kind: 'channel'; id: Id } | { kind: 'context'; id: Id };

export function matchesFilter(task: Task, filter: TaskFilter | null, channels: Map<Id, Channel>): boolean {
  if (!filter) return true;
  if (filter.kind === 'channel') return task.channelId === filter.id;
  const channel = task.channelId ? channels.get(task.channelId) : undefined;
  return channel?.contextId === filter.id;
}
