import { useLiveQuery } from 'dexie-react-hooks';
import { compareKeys } from '@/domain/ordering';
import { db, getSettings } from './db';
import type { Settings, Task, TaskDay } from './types';

export async function tasksForDay(day: TaskDay): Promise<Task[]> {
  const rows = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
  return rows.sort((a, b) => compareKeys(a.order, b.order));
}

/** Live list of a day's tasks; undefined while the first read is in flight. */
export function useTasksForDay(day: TaskDay): Task[] | undefined {
  return useLiveQuery(() => tasksForDay(day), [day]);
}

/** Live settings; undefined until the first read completes. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), []);
}
