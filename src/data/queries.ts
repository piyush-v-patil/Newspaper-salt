import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { Day } from '@/domain/dates';
import { compareKeys } from '@/domain/ordering';
import { workedOnByDay, type WorkedOn } from '@/domain/workedOn';
import { db } from './db';
import type { BacklogFolder, CalendarEvent, DayRecord, Objective, WeekRecord, Id, ParallelTimer, RunningTimer, Session, Subtask, Task, TaskDay, TaskState, TimeEntry } from './types';

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

export interface ScheduledSession extends Session {
  task: Task;
}

/** Live calendar contents for a set of days: events, and the sessions of tasks still in play. */
export function useSchedule(days: Day[]): { sessions: ScheduledSession[]; events: CalendarEvent[] } | undefined {
  const key = days.join(',');
  return useLiveQuery(async () => {
    const rows = await db.sessions.where('day').anyOf(days).toArray();
    const tasks = await db.tasks.bulkGet(rows.map((r) => r.taskId));
    const sessions = rows.flatMap((row, i) => {
      const task = tasks[i];
      return task?.state === 'active' ? [{ ...row, task }] : [];
    });
    const events = await db.events.where('day').anyOf(days).toArray();
    return { sessions, events };
  }, [key]);
}

/** The timer that is running, or null. */
export function useRunningTimer(): RunningTimer | null {
  const row = useLiveQuery(() => db.meta.get('timer'), []);
  return (row?.value as RunningTimer | undefined) ?? null;
}

/** Every time entry for one task, oldest first. */
export function useTimeEntries(taskId: Id | undefined): TimeEntry[] {
  const rows = useLiveQuery(() => (taskId ? db.timeEntries.where('taskId').equals(taskId).sortBy('start') : []), [taskId]);
  return rows ?? [];
}

/** Every task in the archive or the trash, most recently moved there first. */
export function useTasksInState(state: Exclude<TaskState, 'active'>): Task[] {
  const rows = useLiveQuery(() => db.tasks.where('state').equals(state).toArray(), [state]);
  return useMemo(() => (rows ?? []).sort((a, b) => (b.stateChangedAt ?? 0) - (a.stateChangedAt ?? 0)), [rows]);
}

/** Time entries that started within a day. */
export function useDayEntries(day: Day): TimeEntry[] {
  const rows = useLiveQuery(() => {
    const start = new Date(`${day}T00:00:00`).getTime();
    return db.timeEntries.where('start').between(start, start + 24 * 60 * 60 * 1000, true, false).toArray();
  }, [day]);
  return rows ?? [];
}

export function emptyDayRecord(day: Day): DayRecord {
  return {
    day,
    planStatus: 'none',
    planStep: 0,
    planText: '',
    obstacles: '',
    shutdownMin: null,
    shutdownStatus: 'none',
    highlights: [],
    mood: null,
    reflection: '',
  };
}

/** The ritual record for a day; a blank one if nothing has been saved yet. Undefined while loading. */
export function useDayRecord(day: Day): DayRecord | undefined {
  return useLiveQuery(async () => (await db.days.get(day)) ?? emptyDayRecord(day), [day]);
}

/** Days that have been shut down, newest first. */
export function useShutdownDays(): DayRecord[] {
  const rows = useLiveQuery(() => db.days.toArray(), []);
  return useMemo(() => (rows ?? []).filter((d) => d.shutdownStatus === 'done').sort((a, b) => (a.day < b.day ? 1 : -1)), [rows]);
}

/** Tasks by id, for showing lists of ids such as a day's highlights. */
export function useTasksById(ids: Id[]): Map<Id, Task> {
  const key = ids.join(',');
  const rows = useLiveQuery(() => db.tasks.bulkGet(ids), [key]);
  return useMemo(() => new Map((rows ?? []).flatMap((t) => (t ? [[t.id, t] as const] : []))), [rows]);
}

export function useBacklogFolders(): BacklogFolder[] {
  const rows = useLiveQuery(() => db.backlogFolders.toArray(), []);
  return useMemo(() => (rows ?? []).slice().sort(byOrder), [rows]);
}

/** A week's objectives, in order. */
export function useObjectives(weekStart: Day): Objective[] {
  const rows = useLiveQuery(() => db.objectives.where('weekStart').equals(weekStart).toArray(), [weekStart]);
  return useMemo(() => (rows ?? []).slice().sort(byOrder), [rows]);
}

/** Live tasks linked to any of the given objectives, grouped by objective. */
export function useObjectiveTasks(objectiveIds: Id[]): Map<Id, Task[]> {
  const key = objectiveIds.join(',');
  const rows = useLiveQuery(() => (objectiveIds.length ? db.tasks.where('objectiveId').anyOf(objectiveIds).toArray() : []), [key]);
  return useMemo(() => {
    const grouped = new Map<Id, Task[]>();
    for (const task of rows ?? []) {
      if (task.state !== 'active' || !task.objectiveId) continue;
      const list = grouped.get(task.objectiveId);
      if (list) list.push(task);
      else grouped.set(task.objectiveId, [task]);
    }
    // Earliest day first; the backlog sorts last.
    for (const list of grouped.values()) list.sort((a, b) => (a.day === b.day ? compareKeys(a.order, b.order) : a.day < b.day ? -1 : 1));
    return grouped;
  }, [rows]);
}

/** Time entries that started within a range of days (inclusive). */
export function useEntriesBetween(first: Day, last: Day): TimeEntry[] {
  const rows = useLiveQuery(() => {
    const start = new Date(`${first}T00:00:00`).getTime();
    const end = new Date(`${last}T00:00:00`).getTime() + 24 * 60 * 60 * 1000;
    return db.timeEntries.where('start').between(start, end, true, false).toArray();
  }, [first, last]);
  return rows ?? [];
}

export function emptyWeekRecord(weekStart: Day): WeekRecord {
  return { weekStart, planStatus: 'none', planText: '', reviewStatus: 'none', reviewText: '' };
}

export function useWeekRecord(weekStart: Day): WeekRecord | undefined {
  return useLiveQuery(async () => (await db.weeks.get(weekStart)) ?? emptyWeekRecord(weekStart), [weekStart]);
}

/** Faded copies of work done on past days for tasks that have since moved on, for the days shown. */
export function useWorkedOn(days: Day[], today: Day): Map<Day, WorkedOn[]> {
  const key = days.join(',');
  const result = useLiveQuery(async () => {
    const past = days.filter((d) => d < today);
    if (past.length === 0) return new Map<Day, WorkedOn[]>();
    const sorted = [...past].sort();
    const start = new Date(`${sorted[0]}T00:00:00`).getTime();
    const end = new Date(`${sorted[sorted.length - 1]}T00:00:00`).getTime() + 24 * 60 * 60 * 1000;
    const entries = await db.timeEntries.where('start').between(start, end, true, false).toArray();
    const subtasks = await db.subtasks.filter((s) => s.completedAt !== null && s.completedAt >= start && s.completedAt < end).toArray();
    const ids = [...new Set([...entries.map((e) => e.taskId), ...subtasks.map((s) => s.taskId)])];
    const tasks = new Map((await db.tasks.bulkGet(ids)).flatMap((t) => (t ? [[t.id, t] as const] : [])));
    return workedOnByDay(entries, subtasks, tasks, past, today, Date.now());
  }, [key, today]);
  return result ?? EMPTY_WORKED_ON;
}
const EMPTY_WORKED_ON = new Map<Day, WorkedOn[]>();

/** A paused task stays "current" this long after its last timed stretch. */
const RECENT_WORK_MS = 3 * 60 * 60 * 1000;

/**
 * The task being worked on: the one being timed, or else the one most
 * recently timed if it is unfinished and was worked on in the last few hours.
 * Read from stored data, so every window agrees on it.
 */
export function useCurrentFocusTask(): Task | null {
  return (
    useLiveQuery(async () => {
      const timer = (await db.meta.get('timer'))?.value as RunningTimer | undefined;
      const last = await db.timeEntries.orderBy('start').last();
      const id = timer?.taskId ?? (last && last.end !== null && Date.now() - last.end < RECENT_WORK_MS ? last.taskId : null);
      if (!id) return null;
      const task = await db.tasks.get(id);
      return task && task.state === 'active' && task.completedAt === null ? task : null;
    }, []) ?? null
  );
}

/** Open tasks due on or before `day` that are planned for some other day, or for none. */
export function useDueElsewhere(day: Day): Task[] {
  return (
    useLiveQuery(
      async () =>
        (await db.tasks.where('state').equals('active').filter((t) => !!t.dueDay && t.dueDay <= day && t.day !== day && t.completedAt === null).toArray()).sort(
          (a, b) => (a.dueDay! < b.dueDay! ? -1 : a.dueDay! > b.dueDay! ? 1 : 0),
        ),
      [day],
    ) ?? []
  );
}

export interface TrackedBlock {
  id: Id;
  day: Day;
  startMin: number;
  endMin: number;
  task: Task;
  running: boolean;
}

/**
 * Time actually worked on each of `days`, as blocks of minutes. An entry
 * that crosses midnight is split between the two days; the running entry
 * runs to `nowMs`.
 */
export function useTracked(days: Day[], nowMs: number, enabled: boolean): TrackedBlock[] {
  const key = days.join(',');
  const rows = useLiveQuery(async () => {
    if (!enabled || days.length === 0) return [];
    const sorted = [...days].sort();
    const from = new Date(`${sorted[0]}T00:00:00`).getTime() - 24 * 3600_000;
    const to = new Date(`${sorted[sorted.length - 1]}T00:00:00`).getTime() + 24 * 3600_000;
    const entries = await db.timeEntries.where('start').between(from, to).toArray();
    const tasks = await db.tasks.bulkGet(entries.map((e) => e.taskId));
    return entries.flatMap((entry, i) => (tasks[i] && tasks[i]!.state !== 'deleted' ? [{ entry, task: tasks[i]! }] : []));
  }, [key, enabled]);
  return useMemo(() => {
    const blocks: TrackedBlock[] = [];
    for (const { entry, task } of rows ?? []) {
      const end = entry.end ?? nowMs;
      for (const day of days) {
        const dayStart = new Date(`${day}T00:00:00`).getTime();
        const startMin = Math.max(0, (entry.start - dayStart) / 60_000);
        const endMin = Math.min(24 * 60, (end - dayStart) / 60_000);
        if (endMin - startMin < 1) continue;
        blocks.push({ id: `tracked-${entry.id}-${day}`, day, startMin, endMin, task, running: entry.end === null });
      }
    }
    return blocks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, nowMs]);
}

/** Every open task (not finished, archived or deleted), for picking one by name. */
export function useOpenTasks(): Task[] {
  return useLiveQuery(() => db.tasks.where('state').equals('active').filter((t) => t.completedAt === null && t.kind === 'task').toArray(), []) ?? [];
}

/** Timers running alongside the main one. */
export function useParallelTimers(): ParallelTimer[] {
  const row = useLiveQuery(() => db.meta.get('parallel'), []);
  return (row?.value as ParallelTimer[] | undefined) ?? [];
}
