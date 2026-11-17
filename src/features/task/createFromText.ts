import { useUi } from '@/app/uiStore';
import { createChannel } from '@/data/commands/channels';
import { createTask } from '@/data/commands/tasks';
import type { BacklogBucket, DailyPriority, Id, ListEdge, Task, TaskDay } from '@/data/types';
import { extractTokens } from '@/domain/tokens';

interface Extras {
  day: TaskDay;
  channelId?: Id | null;
  plannedMin?: number | null;
  priority?: DailyPriority;
  position?: ListEdge;
  bucket?: BacklogBucket;
  folderId?: Id | null;
}

/**
 * Creates a task from typed text. Typing shortcuts left in the text
 * (~time, #channel, !priority) are applied; explicit choices win over them.
 * While a channel filter is on, new tasks join that channel.
 */
export async function createFromText(text: string, extras: Extras): Promise<Task | null> {
  const parsed = extractTokens(text);
  if (!parsed.title) return null;

  let channelId = extras.channelId ?? null;
  if (!channelId && parsed.channelName) channelId = (await createChannel(parsed.channelName)).id;
  if (!channelId) {
    const { filter } = useUi.getState();
    if (filter?.kind === 'channel') channelId = filter.id;
  }

  return createTask({
    title: parsed.title,
    day: extras.day,
    channelId,
    plannedMin: extras.plannedMin ?? parsed.plannedMin ?? null,
    dailyPriority: extras.priority ?? parsed.priority,
    position: extras.position,
    backlogBucket: extras.bucket,
    backlogFolderId: extras.folderId,
  });
}
