import { BACKLOG, type BacklogBucket, type BacklogPriority, type Task, type TaskDay } from '@/data/types';

/** Rough time horizons for backlog tasks, soonest first. */
export const BUCKETS: { id: BacklogBucket; label: string }[] = [
  { id: 'soon', label: 'Next week or two' },
  { id: 'month', label: 'Next month' },
  { id: 'quarter', label: 'Next quarter' },
  { id: 'year', label: 'Next year' },
  { id: 'someday', label: 'Someday' },
  { id: 'never', label: 'Never' },
];

export const BACKLOG_PRIORITIES: { id: BacklogPriority; label: string }[] = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: 'none', label: 'No priority' },
];

const PREFIX = 'backlog/';

/** The drag-and-drop list id for one bucket of the backlog page. */
export const bucketListId = (bucket: BacklogBucket) => `${PREFIX}${bucket}`;

/** Where a list id puts a task: a day, the backlog, or one bucket of the backlog. */
export function listTarget(listId: string): { day: TaskDay; bucket?: BacklogBucket } {
  return listId.startsWith(PREFIX) ? { day: BACKLOG, bucket: listId.slice(PREFIX.length) as BacklogBucket } : { day: listId };
}

export function groupByBucket(tasks: Task[]): Record<BacklogBucket, Task[]> {
  const groups = Object.fromEntries(BUCKETS.map((b) => [b.id, [] as Task[]])) as Record<BacklogBucket, Task[]>;
  for (const task of tasks) (groups[task.backlogBucket] ?? groups.someday).push(task);
  return groups;
}
