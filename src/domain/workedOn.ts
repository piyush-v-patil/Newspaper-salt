import type { Id, Subtask, Task, TimeEntry } from '@/data/types';
import { toDay, type Day } from './dates';
import { entryDay, entryMs, msToMinutes } from './time';

export interface WorkedOn {
  task: Task;
  /** Minutes tracked on the task that day. */
  minutes: number;
  /** Subtasks checked off that day. */
  subtasksDone: number;
}

/**
 * The progress a past day holds on tasks that have since moved on. A task
 * worked on but not finished rolls forward, yet the day it was worked on
 * should still show that work: these become faded, read-only copies on that
 * day. Tasks still on the day, or finished on it, already show there.
 */
export function workedOnByDay(
  entries: TimeEntry[],
  subtasks: Subtask[],
  tasks: Map<Id, Task>,
  days: Day[],
  today: Day,
  nowMs: number,
): Map<Day, WorkedOn[]> {
  const wanted = new Set(days.filter((d) => d < today));
  const work = new Map<string, { day: Day; taskId: Id; ms: number; subtasksDone: number }>();
  const add = (day: Day, taskId: Id, ms: number, subtaskCount: number) => {
    if (!wanted.has(day)) return;
    const key = `${day}|${taskId}`;
    const row = work.get(key) ?? { day, taskId, ms: 0, subtasksDone: 0 };
    row.ms += ms;
    row.subtasksDone += subtaskCount;
    work.set(key, row);
  };
  for (const entry of entries) add(entryDay(entry), entry.taskId, entryMs(entry, nowMs), 0);
  for (const subtask of subtasks) if (subtask.completedAt !== null) add(toDay(new Date(subtask.completedAt)), subtask.taskId, 0, 1);

  const result = new Map<Day, WorkedOn[]>();
  for (const row of work.values()) {
    const task = tasks.get(row.taskId);
    if (!task || task.state !== 'active' || task.kind !== 'task') continue;
    if (task.day === row.day || task.completedDay === row.day) continue;
    const minutes = msToMinutes(row.ms);
    if (minutes === 0 && row.subtasksDone === 0) continue;
    const list = result.get(row.day) ?? [];
    list.push({ task, minutes, subtasksDone: row.subtasksDone });
    result.set(row.day, list);
  }
  for (const list of result.values()) list.sort((a, b) => b.minutes - a.minutes || a.task.title.localeCompare(b.task.title));
  return result;
}
