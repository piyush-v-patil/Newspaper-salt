import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { Day } from '@/domain/dates';
import { compareKeys } from '@/domain/ordering';
import { db } from './db';
import type { Id, Subtask, Task, TaskDay } from './types';

const byOrder = (a: { order: string }, b: { order: string }) => compareKeys(a.order, b.order);

export async function tasksForDay(day: TaskDay): Promise<Task[]> {
  const rows = await db.tasks.where('[state+day]').equals(['active', day]).toArray();
  return rows.sort(byOrder);
}

/** Live list of a day's tasks; undefined while the first read is in flight. */
export function useTasksForDay(day: TaskDay): Task[] | undefined {
  return useLiveQuery(() => tasksForDay(day), [day]);
}

/** Live tasks for every day from `start` to `end` inclusive, grouped by day and ordered. */
export function useTasksInRange(start: Day, end: Day): Map<Day, Task[]> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.tasks.where('[state+day]').between(['active', start], ['active', end], true, true).toArray();
    const grouped = new Map<Day, Task[]>();
    for (const task of rows) {
      const list = grouped.get(task.day);
      if (list) list.push(task);
      else grouped.set(task.day, [task]);
    }
    for (const list of grouped.values()) list.sort(byOrder);
    return grouped;
  }, [start, end]);
}

export function useTask(id: Id | undefined): Task | undefined {
  return useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id]);
}

/** Live subtasks for a set of tasks, grouped by task and ordered. */
export function useSubtasks(taskIds: Id[]): Map<Id, Subtask[]> {
  const key = taskIds.join(',');
  const rows = useLiveQuery(() => (taskIds.length ? db.subtasks.where('taskId').anyOf(taskIds).toArray() : []), [key]);
  return useMemo(() => {
    const grouped = new Map<Id, Subtask[]>();
    for (const subtask of rows ?? []) {
      const list = grouped.get(subtask.taskId);
      if (list) list.push(subtask);
      else grouped.set(subtask.taskId, [subtask]);
    }
    for (const list of grouped.values()) list.sort(byOrder);
    return grouped;
  }, [rows]);
}
